import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

// Minimal History-API router. The URL is the single source of truth:
// navigate() writes it, useLocation() subscribes to it. popstate covers the
// browser's back/forward buttons; NAV_EVENT covers our own pushState calls
// (which, unlike back/forward, don't fire popstate on their own).

const NAV_EVENT = "app:navigate";

function subscribe(onChange) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(NAV_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(NAV_EVENT, onChange);
  };
}

function getSnapshot() {
  return window.location.pathname + window.location.search;
}

export function navigate(to, { replace = false } = {}) {
  const url = new URL(to, window.location.href);
  const next = url.pathname + url.search + url.hash;
  if (next === window.location.pathname + window.location.search + window.location.hash) return;
  window.history[replace ? "replaceState" : "pushState"](null, "", next);
  if (!replace) window.scrollTo(0, 0);
  window.dispatchEvent(new Event(NAV_EVENT));
}

export function useLocation() {
  const href = useSyncExternalStore(subscribe, getSnapshot);
  return useMemo(() => {
    const url = new URL(href, window.location.origin);
    return { pathname: url.pathname, search: url.search };
  }, [href]);
}

// Same shape as react-router's: [URLSearchParams, setSearchParams(next, { replace })].
// `next` may be an object, a URLSearchParams, or a function of the current params.
export function useSearchParams() {
  const { search } = useLocation();
  const params = useMemo(() => new URLSearchParams(search), [search]);

  const setParams = useCallback((next, options) => {
    const current = new URLSearchParams(window.location.search);
    const resolved = new URLSearchParams(typeof next === "function" ? next(current) : next);
    const qs = resolved.toString();
    navigate(window.location.pathname + (qs ? `?${qs}` : ""), options);
  }, []);

  // setParams reads window.location at call time, so it's stable and never stale.
  return useMemo(() => [params, setParams], [params, setParams]);
}

// matchRoute("/toolz/:toolId", "/toolz/json") → { toolId: "json" }; null on no match.
// Trailing slashes are ignored.
export function matchRoute(pattern, pathname) {
  const split = s => s.split("/").filter(Boolean);
  const want = split(pattern);
  const got = split(pathname);
  if (want.length !== got.length) return null;

  const params = {};
  for (let i = 0; i < want.length; i++) {
    if (want[i].startsWith(":")) {
      try { params[want[i].slice(1)] = decodeURIComponent(got[i]); }
      catch { return null; }
    } else if (want[i] !== got[i]) {
      return null;
    }
  }
  return params;
}

export function useDocumentTitle(title) {
  useEffect(() => {
    if (title) document.title = title;
  }, [title]);
}
