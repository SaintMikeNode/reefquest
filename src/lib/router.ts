import { useEffect, useState } from "react";

// Tiny hash router: #/ (home), #/island/roatan, #/heat, #/learn, #/about.
// Hash routes need no server rewrite rules and work offline from the static files.
export type Route =
  | { page: "home" }
  | { page: "island"; id: string }
  | { page: "heat" }
  | { page: "learn" }
  | { page: "about" };

export function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts[0] === "island" && parts[1]) return { page: "island", id: parts[1] };
  if (parts[0] === "heat") return { page: "heat" };
  if (parts[0] === "learn") return { page: "learn" };
  if (parts[0] === "about") return { page: "about" };
  return { page: "home" };
}

/** Hash changes to ignore: set by the 3D view when it undoes an accidental Back (see IslandScene). */
export const navGuard = { skip: 0 };

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(location.hash));
  useEffect(() => {
    const on = () => {
      if (navGuard.skip > 0) {
        navGuard.skip--;
        return;
      }
      setRoute(parse(location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

export const href = {
  home: "#/",
  island: (id: string) => `#/island/${id}`,
  heat: "#/heat",
  learn: "#/learn",
  about: "#/about",
};
