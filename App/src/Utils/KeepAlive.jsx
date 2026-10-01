import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "./router";

// Keep-alive for components that must keep running while the user is
// elsewhere (Music Player keeps playing, P2P Chat keeps its connection/call).
//
// <KeepAliveProvider> sits at the app root, so instances outlive any page.
// Each instance renders through a portal into its own host <div>. While a
// <KeepAliveSlot> for it is mounted, the host is moved into the slot; when
// the slot unmounts, the host is moved into a hidden "parking" container.
// React never sees the portal target change, so the component is never
// remounted. The host always stays in the document (appendChild moves it in
// one step): browsers pause <audio>/<video> elements removed from the
// document, which would cut off e.g. a call's remote audio.
//
// Inside an instance: useKeepAliveActive() says whether it is on screen,
// useKeepAliveRelease() unmounts it for good, and <BackgroundDock> renders
// an indicator into a shared bottom-left stack (so several don't overlap).

const KeepAliveContext = createContext(null);
const InstanceContext = createContext({ active: true, release: () => {} });

export function KeepAliveProvider({ children }) {
  // id -> { element, host }. Insertion order is render order.
  const [instances, setInstances] = useState(() => new Map());
  const [activeIds, setActiveIds] = useState(() => new Set());
  const [dock, setDock] = useState(null);
  const parkingRef = useRef(null);
  const { pathname } = useLocation();

  const park = useCallback((host) => {
    if (parkingRef.current) parkingRef.current.appendChild(host);
  }, []);

  // Hosts are created outside the state updater (StrictMode runs updaters
  // twice) and reused if a slot re-registers before the commit lands.
  const hostsRef = useRef(new Map());
  const ensure = useCallback((id, element) => {
    let host = hostsRef.current.get(id);
    if (!host) {
      host = document.createElement("div");
      host.style.display = "contents"; // layout-transparent wrapper
      park(host);
      hostsRef.current.set(id, host);
    }
    setInstances((prev) => {
      if (prev.has(id)) return prev;
      const next = new Map(prev);
      next.set(id, { element, host });
      return next;
    });
  }, [park]);

  const setActive = useCallback((id, on) => {
    setActiveIds((prev) => {
      if (prev.has(id) === on) return prev;
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  }, []);

  const release = useCallback((id) => {
    hostsRef.current.get(id)?.remove();
    hostsRef.current.delete(id);
    setInstances((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const api = useMemo(() => ({ instances, ensure, setActive, park, dock }), [instances, ensure, setActive, park, dock]);

  // The WhiteBoard keeps its status pill in the bottom-left corner.
  const raised = pathname.startsWith("/white-board");

  return (
    <KeepAliveContext.Provider value={api}>
      {children}
      <div ref={parkingRef} hidden aria-hidden="true" />
      <div
        ref={setDock}
        style={{
          position: "fixed",
          left: 16,
          bottom: raised ? 64 : 16,
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 8,
          maxWidth: "calc(100vw - 32px)",
          pointerEvents: "none", // the empty dock must not block clicks; items opt back in
        }}
      />
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
  const park = ctx?.park;

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
      park(instance.host);
      setActive(id, false);
    };
  }, [setActive, park, id, instance]);

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

// Renders `children` into the shared bottom-left indicator stack.
export function BackgroundDock({ children }) {
  const dock = useContext(KeepAliveContext)?.dock;
  if (!dock) return null;
  return createPortal(<div style={{ pointerEvents: "auto", maxWidth: "100%" }}>{children}</div>, dock);
}
