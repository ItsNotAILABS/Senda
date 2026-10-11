/** People this browser has paid. The address is theirs. The tag does not receive money. */

const KEY = "senda.mx.payees.v1";

export type MxPayee = {
  id: string;
  name: string;
  address: string;
};

export function loadPayees(): MxPayee[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const rows = JSON.parse(localStorage.getItem(KEY) || "[]") as MxPayee[];
    if (!Array.isArray(rows)) return [];
    return rows.filter((p) => p && p.address && p.name);
  } catch {
    return [];
  }
}

export function savePayee(input: { name: string; address: string }): MxPayee[] {
  const name = input.name.trim();
  const address = input.address.trim();
  const prev = loadPayees().filter((p) => p.address !== address);
  const next = [{ id: address, name: name || address.slice(0, 4), address }, ...prev].slice(0, 24);
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
