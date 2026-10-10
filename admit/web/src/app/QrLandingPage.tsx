import { QR_LANDING_IMAGE } from "@/config/env";

/**
 * Where a ticket's QR lands when it is scanned by an ordinary phone camera or QR app (the door scanner reads the link instead).
 * It deliberately shows nothing about the ticket: the token in the address is never used or displayed here.
 */
export function QrLandingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-night p-4">
      <img
        src={QR_LANDING_IMAGE}
        alt="Scanned ticket QR code"
        className="max-h-[96vh] max-w-full rounded-sm object-contain"
      />
    </main>
  );
}
