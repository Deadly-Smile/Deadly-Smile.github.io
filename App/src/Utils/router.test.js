// Plain Node script: node src/Utils/router.test.js
// Stubs just enough of window/history for navigate() to run outside a browser.

const listeners = {};
const location = { href: "http://x.test/", pathname: "/", search: "", hash: "" };
function setUrl(path) {
  const u = new URL(path, location.href);
  Object.assign(location, { href: u.href, pathname: u.pathname, search: u.search, hash: u.hash });
}
const calls = [];
globalThis.window = {
  location,
  history: {
    pushState: (_s, _t, url) => { calls.push(["push", url]); setUrl(url); },
    replaceState: (_s, _t, url) => { calls.push(["replace", url]); setUrl(url); },
  },
  scrollTo: () => {},
  addEventListener: (n, f) => { (listeners[n] ??= []).push(f); },
  removeEventListener: () => {},
  dispatchEvent: e => { (listeners[e.type] ?? []).forEach(f => f(e)); },
};

const { matchRoute, navigate } = await import("./router.js");

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${label}${ok ? "" : ` — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`}`);
}

check("static match", matchRoute("/toolz", "/toolz"), {});
check("trailing slash ignored", matchRoute("/toolz", "/toolz/"), {});
check("root", matchRoute("/", "/"), {});
check("root doesn't match subpath", matchRoute("/", "/toolz"), null);
check("param", matchRoute("/toolz/:toolId", "/toolz/json"), { toolId: "json" });
check("param decoded", matchRoute("/games/:gameId", "/games/a%20b"), { gameId: "a b" });
check("bad encoding → no match", matchRoute("/games/:gameId", "/games/%E0%A4%A"), null);
check("extra segment", matchRoute("/toolz/:toolId", "/toolz/json/x"), null);
check("static mismatch", matchRoute("/toolz/:toolId", "/games/json"), null);

let events = 0;
window.addEventListener("app:navigate", () => events++);

navigate("/toolz/json?x=1");
check("push navigates", [location.pathname, location.search], ["/toolz/json", "?x=1"]);
check("push fires event", events, 1);

navigate("/toolz/json?x=1");
check("same URL is a no-op", [calls.length, events], [1, 1]);

navigate("/toolz", { replace: true });
check("replace uses replaceState", calls.at(-1), ["replace", "/toolz"]);

navigate("regex");
check("relative path resolves against current", location.pathname, "/regex");

if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nall passed");
