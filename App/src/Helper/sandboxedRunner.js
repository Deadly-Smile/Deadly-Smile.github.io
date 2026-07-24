// Shared sandboxed-iframe JS execution, used by both Code Runner (free-form
// scripts) and Practice (graded functions). The iframe uses
// sandbox="allow-scripts" with NO allow-same-origin, so whatever runs inside
// it cannot reach window.parent's DOM/localStorage — only postMessage gets
// out. Bootstrap functions below run *inside* that iframe (serialized via
// Function.prototype.toString()), never in this module's own scope.

function scriptBootstrap() {
  const send = (type, extra) => { try { window.parent.postMessage(Object.assign({ type }, extra), "*"); } catch {} };
  const fmt = (a) => { try { return typeof a === "object" ? JSON.stringify(a, null, 2) : String(a); } catch { return String(a); } };
  ["log", "error", "warn", "info", "debug"].forEach(level => {
    console[level] = (...args) => send("console", { level, text: args.map(fmt).join(" ") });
  });
  window.onerror = (msg, src, line, col) => { send("error", { text: "Uncaught: " + msg + " (line " + line + ":" + col + ")" }); return true; };
  window.onunhandledrejection = (e) => send("error", { text: "Unhandled: " + e.reason });
  window.addEventListener("message", async (e) => {
    if (!e.data || e.data.type !== "run") return;
    try {
      const fn = new Function("return (async () => {\n" + e.data.code + "\n})()");
      const r = await fn();
      if (r !== undefined) send("return", { text: String(r) });
    } catch (err) {
      send("error", { text: String(err) });
    }
    send("done", {});
  });
}

function gradeBootstrap() {
  const send = (type, extra) => { try { window.parent.postMessage(Object.assign({ type }, extra), "*"); } catch {} };
  window.addEventListener("message", (e) => {
    if (!e.data || e.data.type !== "runTests") return;
    const { code, functionName, argsList } = e.data;
    let fn;
    try {
      const getFn = new Function(code + "\n;return typeof " + functionName + " !== 'undefined' ? " + functionName + " : undefined;");
      fn = getFn();
    } catch (err) {
      send("gradeError", { text: String(err) });
      return;
    }
    if (typeof fn !== "function") {
      send("gradeError", { text: "`" + functionName + "` is not defined — make sure your function is named exactly that." });
      return;
    }
    const results = argsList.map(args => {
      try {
        return { actual: fn(...args) };
      } catch (err) {
        return { error: String(err) };
      }
    });
    send("testResults", { results });
  });
}

function makeSandboxedIframe(bootstrap) {
  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  iframe.setAttribute("sandbox", "allow-scripts");
  iframe.srcdoc = "<script>(" + bootstrap.toString() + ")();</script>";
  document.body.appendChild(iframe);
  return iframe;
}

/** Runs a whole script, streaming console/return output via onLine. */
export async function runScript(code, onLine, { timeoutMs = 5000 } = {}) {
  return new Promise(resolve => {
    const iframe = makeSandboxedIframe(scriptBootstrap);

    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      clearTimeout(timeout);
      try { document.body.removeChild(iframe); } catch {}
      resolve(result);
    };

    const timeout = setTimeout(() => finish({ error: `⏱ Timed out after ${timeoutMs / 1000}s` }), timeoutMs);

    function onMessage(e) {
      if (e.source !== iframe.contentWindow || !e.data) return;
      if (e.data.type === "console") onLine({ type: e.data.level, text: e.data.text });
      else if (e.data.type === "error") onLine({ type: "error", text: e.data.text });
      else if (e.data.type === "return") onLine({ type: "return", text: e.data.text });
      else if (e.data.type === "done") finish({});
    }
    window.addEventListener("message", onMessage);

    iframe.addEventListener("load", () => {
      iframe.contentWindow.postMessage({ type: "run", code }, "*");
    }, { once: true });
  });
}

/**
 * Runs `functionName` (defined by `code`) once per entry in `argsList`,
 * inside a single sandboxed iframe load. Resolves { results } where results
 * is an array of { actual } | { error }, one per input — or { gradeError }
 * if the function itself never got defined (syntax error, wrong name, etc).
 * Deliberately knows nothing about expected values — comparing actual vs.
 * expected happens back in the trusted caller, not inside the sandbox.
 */
export async function runFunctionAgainstInputs(code, functionName, argsList, { timeoutMs = 5000 } = {}) {
  return new Promise(resolve => {
    const iframe = makeSandboxedIframe(gradeBootstrap);

    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      clearTimeout(timeout);
      try { document.body.removeChild(iframe); } catch {}
      resolve(result);
    };

    const timeout = setTimeout(() => finish({ gradeError: `⏱ Timed out after ${timeoutMs / 1000}s` }), timeoutMs);

    function onMessage(e) {
      if (e.source !== iframe.contentWindow || !e.data) return;
      if (e.data.type === "testResults") finish({ results: e.data.results });
      else if (e.data.type === "gradeError") finish({ gradeError: e.data.text });
    }
    window.addEventListener("message", onMessage);

    iframe.addEventListener("load", () => {
      iframe.contentWindow.postMessage({ type: "runTests", code, functionName, argsList }, "*");
    }, { once: true });
  });
}
