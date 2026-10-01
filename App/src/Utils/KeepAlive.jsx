import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Keep-alive for components that must keep running while the user is
// elsewhere (e.g. the Music Player keeps playing across tool/page switches).
//
// <KeepAliveProvider> sits at the app root, so instances outlive any page.
// Each instance renders through a portal into its own detached host <div>;
// a <KeepAliveSlot> just physically moves that host div into place while it
// is mounted and detaches it again on unmount. React never sees the portal
// target change, so the component is never remounted — its state, effects
// and audio keep going while it is not on screen.
//
// Instances can read whether they are on screen with useKeepAliveActive()
// (e.g. to pause rendering work or show a mini-player instead), and end
// themselves with useKeepAliveRelease().

const KeepAliveContext = createContext(null);
const InstanceContext = createContext({ active: true, release: () => {} });

export function KeepAliveProvider({ children }) {
  // id -> { element, host }. Insertion order is render order.
  const [instances, setInstances] = useState(() => new Map());
  const [activeIds, setActiveIds] = useState(() => new Set());

  const ensure = useCallback((id, element) => {
    setInstances((prev) => {
      if (prev.has(id)) return prev;
      const next = new Map(prev);
      const host = document.createElement("div");
      host.style.display = "contents"; // layout-transparent wrapper
      next.set(id, { element, host });
      return next;
    });
  }, []);

  const setActive = useCallback((id, on) => {
    setActiveIds((prev) => {
      if (prev.has(id) === on) return prev;
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  }, []);

  const release = useCallback((id) => {
    setInstances((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.get(id).host.remove();
      next.delete(id);
      return next;
    });
  }, []);

  const api = useMemo(() => ({ instances, ensure, setActive }), [instances, ensure, setActive]);

  return (
    <KeepAliveContext.Provider value={api}>
      {children}
      {[...instances].map(([id, { element, host }]) =>
        createPortal(
          <InstanceContext.Provider key={id} value={{ active: activeIds.has(id), release: () => release(id) }}>
            {element}
          </InstanceContext.Provider>,
          host,
          id
        )
      )}
    </KeepAliveContext.Provider>
  );
}

// Where a kept-alive instance appears while this slot is mounted. `element`
// is only used the first time `id` is seen; later renders reuse the live
// instance.
export function KeepAliveSlot({ id, element, className, style }) {
  const ctx = useContext(KeepAliveContext);
  const slotRef = useRef(null);
  const instance = ctx?.instances.get(id);

  const ensure = ctx?.ensure;
  const setActive = ctx?.setActive;

  useLayoutEffect(() => {
    if (ensure && !instance) ensure(id, element);
    // `element` is intentionally read only on first registration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ensure, id, instance]);

  useLayoutEffect(() => {
    const slot = slotRef.current;
    if (!setActive || !instance || !slot) return;
    slot.appendChild(instance.host);
    setActive(id, true);
    return () => {
      instance.host.remove();
      setActive(id, false);
    };
  }, [setActive, id, instance]);

  // Without a provider (shouldn't happen) fall back to a normal mount.
  if (!ctx) return element;
  return <div ref={slotRef} className={className} style={{ display: "contents", ...style }} />;
}

export function useKeepAliveActive() {
  return useContext(InstanceContext).active;
}

export function useKeepAliveRelease() {
  return useContext(InstanceContext).release;
}
