/** What this desk can be paid. The cut is a Solana address. An ad is a link you added. */

const KEY = "senda.desk.earn.v1";

export type DeskAd = { id: string; name: string; href: string; line: string };
export type DeskEarn = { fee: string; ads: DeskAd[] };

export function readEarn(): DeskEarn {
  if (typeof window === "undefined") return { fee: "", ads: [] };
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) || "{}") as Partial<DeskEarn>;
    const ads = Array.isArray(raw.ads) ? raw.ads.filter((a) => a && typeof a.href === "string" && a.href.startsWith("https://")).slice(0, 6) : [];
    return { fee: typeof raw.fee === "string" ? raw.fee : "", ads };
  } catch {
    return { fee: "", ads: [] };
  }
}

function write(next: DeskEarn) {
  window.localStorage.setItem(KEY, JSON.stringify(next));
}

export function saveFee(fee: string): DeskEarn {
  const next = { ...readEarn(), fee: fee.trim() };
  write(next);
  return next;
}

export function addAd(name: string, href: string, line: string): DeskEarn | { error: string } {
  let url: URL;
  try {
    url = new URL(href.trim());
  } catch {
    return { error: "The ad needs a full https link." };
  }
  if (url.protocol !== "https:") return { error: "The ad link has to be https." };
  if (!name.trim()) return { error: "Name the company." };
  const cur = readEarn();
  if (cur.ads.length >= 6) return { error: "Six ads is the limit. Remove one." };
  const next = {
    ...cur,
    ads: [{ id: crypto.randomUUID(), name: name.trim().slice(0, 40), href: url.toString(), line: line.trim().slice(0, 120) }, ...cur.ads],
  };
  write(next);
  return next;
}

export function dropAd(id: string): DeskEarn {
  const next = { ...readEarn(), ads: readEarn().ads.filter((a) => a.id !== id) };
  write(next);
  return next;
}
