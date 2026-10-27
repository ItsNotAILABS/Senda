/** Route settings the majors book and the agent tab share. Stored on this phone only. */

export type RouteAim = "fast" | "price";

export type RoutePro = {
  aim: RouteAim;
  slippageBps: 30 | 50 | 80 | 100;
  maxImpact: 0.5 | 1 | 3 | 5;
  direct: boolean;
};

const KEY = "senda.route.pro.v1";

export const ROUTE_PRO: RoutePro = { aim: "fast", slippageBps: 50, maxImpact: 1, direct: false };

export function routePro(): RoutePro {
  if (typeof localStorage === "undefined") return ROUTE_PRO;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null") as Partial<RoutePro> | null;
    if (!raw) return ROUTE_PRO;
    const slippageBps = ([30, 50, 80, 100] as const).find((n) => n === raw.slippageBps) ?? ROUTE_PRO.slippageBps;
    const maxImpact = ([0.5, 1, 3, 5] as const).find((n) => n === raw.maxImpact) ?? ROUTE_PRO.maxImpact;
    return {
      aim: raw.aim === "price" ? "price" : "fast",
      slippageBps,
      maxImpact,
      direct: raw.direct === true,
    };
  } catch {
    return ROUTE_PRO;
  }
}

export function saveRoutePro(next: RoutePro) {
  localStorage.setItem(KEY, JSON.stringify(next));
}
