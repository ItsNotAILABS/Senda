import { renderSVG } from "uqr";

/** A Solana Pay request. Black on white so a camera can read it. Nothing moves until the other wallet signs. */
export function PayQr({ value }: { value: string }) {
  const svg = renderSVG(value, { ecc: "M", border: 2 });
  return (
    <div
      className="mx-auto w-full max-w-[240px] overflow-hidden rounded-2xl bg-white p-3"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
