import { VENDORS } from "@/lib/vendors";

/** Every venue the desk reads. Not a balance, and not a new coin. */
export function VendorHub() {
  return (
    <section className="px-4 pb-6">
      <h2 className="text-lg font-semibold">Vendors</h2>
      <p className="mt-1 text-sm text-white/50">
        {VENDORS.length} venues. Each one is a book this desk already reads. Senda does not hold the inventory.
      </p>
      <ul className="mt-3 divide-y divide-white/10">
        {VENDORS.map((row) => (
          <li key={row.name} className="py-3">
            <p className="text-sm font-semibold">{row.name}</p>
            <p className="text-[11px] tracking-wide text-white/40 uppercase">{row.kind}</p>
            <p className="mt-1 text-sm text-white/55">{row.does}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
