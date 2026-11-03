import { useEffect, useState } from "react";
import { getHouse, type HouseListing } from "@/lib/sol-house";

export function useHouse() {
  const [rows, setRows] = useState<HouseListing[]>([]);
  useEffect(() => {
    let live = true;
    const pull = () =>
      getHouse()
        .then((next) => {
          if (live) setRows(next);
        })
        .catch(() => undefined);
    void pull();
    const id = window.setInterval(pull, 20_000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, []);
  return rows;
}
