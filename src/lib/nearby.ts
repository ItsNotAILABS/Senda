/** Offline notes. Payload is the instrument. BLE / NFC / code carry it. */

export type NearbyPayload = {
  v: 1;
  id: string;
  code: string;
  from: string;
  amount: number;
  ccy: string;
  ts: number;
};

export function encodeNote(n: NearbyPayload): string {
  const json = JSON.stringify(n);
  return `SENDA1.${btoa(unescape(encodeURIComponent(json)))}`;
}

export function decodeNote(raw: string): NearbyPayload | { error: string } {
  const s = raw.trim();
  const body = s.startsWith("SENDA1.") ? s.slice(7) : s;
  try {
    const json = decodeURIComponent(escape(atob(body)));
    const p = JSON.parse(json) as NearbyPayload;
    if (p.v !== 1 || !(p.amount > 0) || !p.code || !p.from) return { error: "Bad note." };
    return p;
  } catch {
    return { error: "Could not read that note." };
  }
}

export function makeCode(): string {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  const buf = crypto.getRandomValues(new Uint8Array(6));
  for (const b of buf) s += a[b % a.length];
  return `${s.slice(0, 3)}-${s.slice(3)}`;
}

const SERVICE = "a1b2c3d4-e5f6-4890-abcd-ef1234567890";
const CHAR = "a1b2c3d4-e5f6-4890-abcd-ef1234567891";

type BluetoothDeviceLike = {
  gatt?: {
    connect: () => Promise<{
      getPrimaryService: (u: string) => Promise<{
        getCharacteristic: (u: string) => Promise<{ writeValue: (d: BufferSource) => Promise<void> }>;
      }>;
    }>;
  };
};

export async function bluetoothSend(payload: string): Promise<void> {
  const nav = navigator as Navigator & {
    bluetooth?: {
      requestDevice: (o: unknown) => Promise<BluetoothDeviceLike>;
    };
  };
  if (!nav.bluetooth) throw new Error("This browser has no Bluetooth. Use the code or NFC.");
  const device = await nav.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [SERVICE],
  });
  const gatt = await device.gatt?.connect();
  if (!gatt) throw new Error("Could not connect.");
  try {
    const svc = await gatt.getPrimaryService(SERVICE);
    const ch = await svc.getCharacteristic(CHAR);
    await ch.writeValue(new TextEncoder().encode(payload.slice(0, 500)));
  } catch {
    throw new Error("Phone connected, but it isn’t running Senda nearby. Use the code.");
  }
}

export async function nfcWrite(payload: string): Promise<void> {
  const Ctor = (window as unknown as { NDEFReader?: new () => { write: (o: unknown) => Promise<void> } }).NDEFReader;
  if (!Ctor) throw new Error("NFC isn’t on this phone. Use the code.");
  const n = new Ctor();
  await n.write({ records: [{ recordType: "text", data: payload }] });
}

export function nearbyChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  return new BroadcastChannel("senda-nearby");
}
