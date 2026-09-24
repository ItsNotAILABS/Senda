import { logoFor, type HouseListing } from "@/lib/sol-house";
import { cn } from "@/lib/utils";

export function TokenMark({
  stock,
  size = 40,
  className,
}: {
  stock: Pick<HouseListing, "symbol" | "image">;
  size?: number;
  className?: string;
}) {
  const src = stock.image || logoFor(stock.symbol);
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={cn("rounded-xl bg-paper object-contain p-1", className)}
    />
  );
}
