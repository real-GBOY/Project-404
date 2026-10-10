import jsQR from "jsqr";

export type CameraFailure = "blocked" | "missing";

export interface Camera {
  stop(): void;
  /** True when this camera can switch its torch on/off. */
  canTorch: boolean;
  torch(on: boolean): Promise<void>;
}

/** Map a getUserMedia error to the two failures the scanner has screens for. */
export function classifyCameraError(err: unknown): CameraFailure {
  const name = (err as { name?: string } | null)?.name ?? "";
  return name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError"
    ? "blocked"
    : "missing";
}

export async function openCamera(
  video: HTMLVideoElement,
  facing: "environment" | "user",
): Promise<Camera> {
  if (!navigator.mediaDevices?.getUserMedia)
    throw Object.assign(new Error("no camera api"), { name: "NotFoundError" });
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
  video.srcObject = stream;
  video.setAttribute("playsinline", "true");
  await video.play().catch(() => undefined);
  const track = stream.getVideoTracks()[0];
  const caps = (track?.getCapabilities?.() ?? {}) as { torch?: boolean };
  return {
    canTorch: !!caps.torch,
    async torch(on) {
      await track
        ?.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] })
        .catch(() => undefined);
    },
    stop() {
      stream.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    },
  };
}

interface DetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}

/**
 * Reads frames and reports each QR payload found. Uses the platform BarcodeDetector where there is one and jsQR elsewhere. Returns a stop
 * function. Throttled to ~8 reads a second, which is faster than anyone can present a ticket.
 */
export function startDecoding(video: HTMLVideoElement, onCode: (code: string) => void): () => void {
  let stopped = false;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const Detector = (
    window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => DetectorLike }
  ).BarcodeDetector;
  const native = Detector ? new Detector({ formats: ["qr_code"] }) : null;

  const tick = async () => {
    if (stopped) return;
    try {
      if (video.readyState >= 2 && video.videoWidth) {
        if (native) {
          const found = await native.detect(video);
          if (found[0]?.rawValue) onCode(found[0].rawValue);
        } else if (ctx) {
          const w = Math.min(video.videoWidth, 640);
          const h = Math.round((video.videoHeight / video.videoWidth) * w);
          canvas.width = w;
          canvas.height = h;
          ctx.drawImage(video, 0, 0, w, h);
          const img = ctx.getImageData(0, 0, w, h);
          const hit = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" });
          if (hit?.data) onCode(hit.data);
        }
      }
    } catch {
      /* a bad frame is not an error worth surfacing */
    }
    setTimeout(() => void tick(), 125);
  };
  void tick();
  return () => {
    stopped = true;
  };
}
