import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { toast } from "sonner";

/** Camera, or a photo of a code. Phantom and Solflare print an address or a solana: link. */
export function PayScan({ onCode }: { onCode: (text: string) => void }) {
  const [on, setOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;

  useEffect(() => {
    if (!on) return;
    let stop = false;
    let stream: MediaStream | null = null;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    void navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((next) => {
        stream = next;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = next;
        return video.play();
      })
      .then(() => {
        const tick = () => {
          if (stop) return;
          const video = videoRef.current;
          if (video && ctx && video.videoWidth > 0) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
            const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const hit = jsQR(frame.data, frame.width, frame.height);
            if (hit?.data) {
              onCodeRef.current(hit.data);
              setOn(false);
              return;
            }
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      })
      .catch(() => {
        toast.error("The camera did not open. Load a photo of the code instead.");
        setOn(false);
      });
    return () => {
      stop = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [on]);

  async function fromFile(file: File) {
    const bmp = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(bmp, 0, 0);
    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const hit = jsQR(frame.data, frame.width, frame.height);
    if (!hit?.data) {
      toast.error("No code in that photo.");
      return;
    }
    onCodeRef.current(hit.data);
  }

  return (
    <div>
      <div className="flex gap-2">
        <button type="button" onClick={() => setOn((v) => !v)} className="min-h-12 flex-1 rounded-full bg-white px-4 text-sm font-semibold text-black">
          {on ? "Stop" : "Scan"}
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} className="min-h-12 flex-1 rounded-full border border-white/15 px-4 text-sm font-semibold">
          Load a photo
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void fromFile(file).catch(() => toast.error("That photo did not open."));
          }}
        />
      </div>
      {on ? (
        <div className="relative mt-3 overflow-hidden rounded-[22px] bg-black">
          <video ref={videoRef} muted playsInline className="aspect-square w-full object-cover" />
          <div className="pointer-events-none absolute inset-6 rounded-2xl border-2 border-[#d7e36a]/80" />
          <span className="senda-scan pointer-events-none absolute inset-x-8 h-[2px] bg-[#d7e36a] shadow-[0_0_12px_#d7e36a]" />
          <p className="absolute inset-x-0 bottom-3 text-center text-xs font-semibold text-white">Hold the code in the frame</p>
        </div>
      ) : null}
    </div>
  );
}
