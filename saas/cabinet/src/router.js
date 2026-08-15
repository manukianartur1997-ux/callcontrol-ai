// Hand-rolled hash router.
//
// Hash routing is a hard requirement, not a taste choice: the Worker serves
// dist/ with SPA fallback to the ROOT landing page, so /app/calls as a real
// path would render the landing. Everything lives at /app/#/... and only the
// fragment changes.
import { useEffect, useState } from "react";

// '#/calls/123' -> { page: 'calls', id: '123' }; '' and '#/' -> dashboard.
export function parseHash() {
  const raw = window.location.hash.replace(/^#\/?/, "");
  const [page, id] = raw.split("/").filter(Boolean);
  return { page: page || "dashboard", id: id || null };
}

export function navigate(path) {
  const clean = path.startsWith("#") ? path.slice(1) : path;
  window.location.hash = clean.startsWith("/") ? clean : `/${clean}`;
}

export function useHashRoute() {
  const [route, setRoute] = useState(parseHash);
  useEffect(() => {
    const onChange = () => setRoute(parseHash());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}
