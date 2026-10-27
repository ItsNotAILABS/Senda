import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { toast } from "sonner";

/** Reads a wallet QR with the camera. Phantom and Solflare encode an address or a solana: link. */
export function PayScan({ onCode }: { onCode: (text: string) => void }) {
  const [on, setOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
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
        toast.error("The camera did not open. Paste the code instead.");
        setOn(false);
      });
    return () => {
      stop = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [on]);

  return (
    <div>
      <button type="button" onClick={() => setOn((v) => !v)} className="min-h-12 shrink-0 rounded-full bg-white px-4 text-sm font-semibold text-black">
        {on ? "Stop" : "Scan"}
      </button>
      {on ? <video ref={videoRef} muted playsInline className="mt-2 aspect-square w-full rounded-2xl bg-black object-cover" /> : null}
    </div>
  );
}
