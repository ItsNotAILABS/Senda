import { renderSVG } from "uqr";

/** Black on white so a camera can read it. The code is a request, not a payment. */
export function PayQr({ value }: { value: string }) {
  const svg = renderSVG(value, { ecc: "M", border: 2 });
  return (
    <div
      className="h-[220px] w-[220px] overflow-hidden rounded-2xl bg-white p-2"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
