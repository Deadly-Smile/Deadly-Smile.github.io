import { useEffect } from "react";
import { navigate } from "./router";

// A real <a href> so middle-click / Ctrl/Cmd-click / "open in new tab" keep
// working; only a plain left-click is intercepted for client-side navigation.
export function Link({ to, replace = false, onClick, target, children, ...rest }) {
  function handleClick(e) {
    onClick?.(e);
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey || e.ctrlKey || e.shiftKey || e.altKey ||
      (target && target !== "_self")
    ) return;
    e.preventDefault();
    navigate(to, { replace });
  }

  return (
    <a href={to} target={target} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}

export function Redirect({ to }) {
  useEffect(() => { navigate(to, { replace: true }); }, [to]);
  return null;
}
