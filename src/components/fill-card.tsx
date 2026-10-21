export function FillCard({
  title,
  symbol,
  amount,
  paid,
  received,
  where,
  when,
  sig,
  onDone,
}: {
  title: string;
  symbol: string;
  amount: string;
  paid: string;
  received: string;
  where: string;
  when: string;
  sig: string;
  onDone: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50" role="dialog">
      <div className="w-full rounded-t-[28px] bg-[#0c0c0f] px-4 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="rounded-[28px] bg-[#d7e36a] px-4 py-4 text-black">
          <p className="text-[11px] font-semibold tracking-[0.16em]">FILLED</p>
          <h2 className="mt-1 text-4xl font-semibold tracking-tight">{title}</h2>
          <div className="mt-3 flex items-center justify-between rounded-full bg-black px-3 py-2 text-white">
            <span className="flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-full bg-[#d7e36a] text-xs font-semibold text-black">{symbol.slice(0, 2)}</span>
              <span>
                <span className="block text-sm font-semibold">{symbol}</span>
                <span className="block text-xs text-white/50">Sent just now</span>
              </span>
            </span>
            <span className="font-mono text-sm">{amount}</span>
          </div>
        </div>
        <p className="mt-4 font-mono text-5xl">{amount}</p>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-white/50">You paid</dt><dd>{paid}</dd></div>
          <div className="flex justify-between"><dt className="text-white/50">You received</dt><dd>{received}</dd></div>
          <div className="flex justify-between"><dt className="text-white/50">Where</dt><dd>{where}</dd></div>
          <div className="flex justify-between"><dt className="text-white/50">When</dt><dd>{when}</dd></div>
        </dl>
        <p className="mt-3 truncate font-mono text-xs text-[#d7e36a]">{sig}</p>
        <button type="button" onClick={onDone} className="mt-4 min-h-12 w-full rounded-full bg-[#d7e36a] text-sm font-semibold text-black">Done</button>
      </div>
    </div>
  );
}
