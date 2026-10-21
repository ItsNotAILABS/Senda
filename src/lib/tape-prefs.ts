export type TapeSpeed = "slow" | "desk" | "fast";
export type TapeFilter = "all" | "up" | "down";

export type TapePrefs = { speed: TapeSpeed; filter: TapeFilter };

const KEY = "senda.tape.prefs.v1";

export const TAPE_SECONDS: Record<TapeSpeed, number> = { slow: 96, desk: 48, fast: 18 };

export function readTapePrefs(): TapePrefs {
  if (typeof localStorage === "undefined") return { speed: "slow", filter: "all" };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "") as Partial<TapePrefs>;
    const speed = raw.speed === "desk" || raw.speed === "fast" ? raw.speed : "slow";
    const filter = raw.filter === "up" || raw.filter === "down" ? raw.filter : "all";
    return { speed, filter };
  } catch {
    return { speed: "slow", filter: "all" };
  }
}

export function writeTapePrefs(next: TapePrefs) {
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("senda-tape"));
}
