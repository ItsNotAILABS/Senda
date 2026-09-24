import { useCallback, useEffect, useState } from "react";
import { getTape, type TapePrint } from "@/lib/tape";

export function useTape() {
  const [prints, setPrints] = useState<TapePrint[]>([]);
  const [live, setLive] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const rows = await getTape();
      setPrints(rows);
      setLive(true);
    } catch {
      /* keep last */
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const pushLocal = useCallback((print: TapePrint) => {
    setPrints((prev) => [print, ...prev.filter((p) => p.id !== print.id)].slice(0, 48));
  }, []);

  return { prints, live, pushLocal, refresh };
}
