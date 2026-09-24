/** Jobs a person turns on. Nothing signs until they press run. */

const KEY = "senda.agents.v1";

export type DailyJob = { symbol: string; mint: string; usd: number; lastDay: string };
export type CheapJob = { usd: number; under: number };
export type RichJob = { usd: number };

export type AgentJobs = {
  cheap: CheapJob | null;
  rich: RichJob | null;
  daily: DailyJob | null;
};

function blank(): AgentJobs {
  return { cheap: null, rich: null, daily: null };
}

export function loadJobs(): AgentJobs {
  if (typeof window === "undefined") return blank();
  try {
    const p = JSON.parse(window.localStorage.getItem(KEY) || "") as AgentJobs;
    return { cheap: p.cheap ?? null, rich: p.rich ?? null, daily: p.daily ?? null };
  } catch {
    return blank();
  }
}

export function saveJobs(j: AgentJobs): AgentJobs {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(j));
  } catch {
    /* quota */
  }
  return j;
}

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}
