import { matchRoute, useLocation } from "./Utils/router";
import { Redirect } from "./Utils/Link";
import Home from "./Pages/Home";
import WhiteBoard from "./Pages/WhiteBoard";
import Projects from "./Pages/Projects";
import Toolz from "./Pages/Toolz";
import Games from "./Pages/Games";

// First match wins. /toolz and /toolz/:toolId render the same <Toolz> element
// type in the same position, so switching tools keeps the page (sidebar,
// config) mounted and only swaps the active tool.
const ROUTES = [
  { path: "/",               render: () => <Home /> },
  { path: "/projects",       render: () => <Projects /> },
  { path: "/toolz",          render: () => <Toolz /> },
  { path: "/toolz/:toolId",  render: ({ toolId }) => <Toolz toolId={toolId} /> },
  { path: "/games",          render: () => <Games /> },
  { path: "/games/:gameId",  render: ({ gameId }) => <Games gameId={gameId} /> },
  { path: "/white-board",    render: () => <WhiteBoard /> },
];

// Old share links used /toolz?tool=x and /games?game=x — already in the wild
// as multiplayer/sync invites, so they're rewritten to /toolz/x and /games/x
// with every other query param (room, sync, …) carried over.
function legacyRedirect(pathname, search) {
  const legacy = { "/toolz": "tool", "/games": "game" }[pathname.replace(/\/+$/, "")];
  if (!legacy) return null;
  const params = new URLSearchParams(search);
  const id = params.get(legacy);
  if (!id) return null;
  params.delete(legacy);
  const qs = params.toString();
  return `${pathname.replace(/\/+$/, "")}/${encodeURIComponent(id)}${qs ? `?${qs}` : ""}`;
}

const App = () => {
  const { pathname, search } = useLocation();

  const redirect = legacyRedirect(pathname, search);
  if (redirect) return <Redirect to={redirect} />;

  for (const route of ROUTES) {
    const params = matchRoute(route.path, pathname);
    if (params) return <section>{route.render(params)}</section>;
  }
  return <Redirect to="/" />;
};

export default App;
