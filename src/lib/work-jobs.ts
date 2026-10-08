/** A job is paid in USDC. The wallet signs. Senda does not hold the pay. */

const KEY = "senda.jobs.v1";

export type WorkJob = {
  id: string;
  title: string;
  brief: string;
  pay: number;
  worker: string;
  symbol?: string;
  status: "open" | "paid" | "cancelled";
  sig?: string;
  at: number;
};

export const JOB_STARTS: { title: string; brief: string; pay: number }[] = [
  { title: "Overnight watch", brief: "Watch one PreStock print and write the move.", pay: 25 },
  { title: "Sheet clerk", brief: "Fill the note on the cheapest and richest names.", pay: 15 },
  { title: "Research brief", brief: "One page on why the token sits off the mark.", pay: 40 },
];

function load(): WorkJob[] {
  if (typeof window === "undefined") return [];
  try {
    const rows = JSON.parse(window.localStorage.getItem(KEY) || "[]") as WorkJob[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function save(rows: WorkJob[]) {
  window.localStorage.setItem(KEY, JSON.stringify(rows.slice(0, 40)));
}

export function listJobs(): WorkJob[] {
  return load();
}

export function postJob(input: { title: string; brief: string; pay: number; worker: string; symbol?: string }): WorkJob {
  const title = input.title.trim();
  if (!title) throw new Error("Name the job.");
  const pay = Math.round(input.pay * 100) / 100;
  if (!(pay > 0)) throw new Error("Set a USDC amount.");
  const row: WorkJob = {
    id: crypto.randomUUID(),
    title,
    brief: input.brief.trim(),
    pay,
    worker: input.worker.trim(),
    symbol: input.symbol?.trim() || undefined,
    status: "open",
    at: Date.now(),
  };
  save([row, ...load()]);
  return row;
}

export function markJobPaid(id: string, sig: string) {
  save(load().map((j) => (j.id === id ? { ...j, status: "paid", sig } : j)));
}

export function cancelJob(id: string) {
  save(load().map((j) => (j.id === id && j.status === "open" ? { ...j, status: "cancelled" } : j)));
}
