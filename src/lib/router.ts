import { useEffect, useState } from "react";

// Tiny hash router: #/ (home), #/islands, #/island/roatan, #/learn (heat data and lessons, as two
// tabs: #/learn/heat, #/learn/lessons), #/support, #/about. The old #/heat still opens the heat tab.
// Hash routes need no server rewrite rules and work offline from the static files.
export type LearnTab = "heat" | "lessons";
export type Route =
  | { page: "home" }
  | { page: "islands" }
  | { page: "island"; id: string }
  | { page: "learn"; tab: LearnTab }
  | { page: "support" }
  | { page: "about" };

export function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts[0] === "island" && parts[1]) return { page: "island", id: parts[1] };
  if (parts[0] === "islands") return { page: "islands" };
  if (parts[0] === "heat") return { page: "learn", tab: "heat" };
  // The heat data is the main tab; the lessons are the second.
  if (parts[0] === "learn") return { page: "learn", tab: parts[1] === "lessons" ? "lessons" : "heat" };
  if (parts[0] === "support") return { page: "support" };
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
  islands: "#/islands",
  island: (id: string) => `#/island/${id}`,
  learn: "#/learn",
  heat: "#/learn/heat",
  lessons: "#/learn/lessons",
  support: "#/support",
  about: "#/about",
};
