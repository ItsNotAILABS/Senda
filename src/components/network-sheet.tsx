import { PHANTOM_NETS, type PhantomNet } from "@/lib/chain-book";
import { cn } from "@/lib/utils";

export function NetBrief({ net }: { net: PhantomNet }) {
  return (
    <section className="mt-3 rounded-[22px] bg-[#101114] p-4">
      <p className="text-sm font-semibold">
        {net.name}
        {net.badge ? ` · ${net.badge}` : ""}
      </p>
      <p className="mt-1 text-sm text-white/70">{net.tradable}</p>
      <p className="mt-1 text-xs text-white/45">{net.native}</p>
      {net.symbols ? (
        <p className="mt-2 font-mono text-[11px] text-white/40">{net.symbols.join(" · ")}</p>
      ) : null}
      {net.href ? (
        <a href={net.href} className="mt-3 inline-flex min-h-10 items-center rounded-full bg-white px-4 text-sm font-semibold text-black">
          Open that account
        </a>
      ) : null}
    </section>
  );
}

export function NetworkSheet({
  open,
  current,
  onClose,
  onPick,
}: {
  open: boolean;
  current: string;
  onClose: () => void;
  onPick: (id: string) => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/70" onClick={onClose}>
      <div
        className="max-h-[86vh] w-full overflow-y-auto rounded-t-[28px] bg-[#141416] px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center">
          <button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-full bg-white/10 text-lg" aria-label="Close">
            ×
          </button>
          <p className="flex-1 text-center text-lg font-semibold">Change Network</p>
          <span className="size-10" />
        </div>
        <ul>
          {PHANTOM_NETS.map((net) => (
            <li key={net.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(net.id);
                  onClose();
                }}
                className="flex w-full items-center gap-3 py-3 text-left"
              >
                <span className="grid size-10 place-items-center rounded-full bg-[#2a2a2e] text-sm font-semibold">{net.mark}</span>
                <span className={cn("text-base font-semibold", current === net.id ? "text-white" : "text-white/90")}>{net.name}</span>
                {net.badge ? <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs text-white/80">{net.badge}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
