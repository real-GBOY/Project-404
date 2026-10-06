/**
 * Print a self-contained HTML document through the browser's own print dialog ("Save as PDF" there makes the file). The page is
 * loaded into an off-screen frame so the app itself is untouched; the frame's title becomes the suggested file name. The frame is
 * removed after printing, or after a minute if the dialog never reports back.
 */
export function printHtml(html: string, title: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    Object.assign(frame.style, {
      position: "fixed",
      right: "0",
      bottom: "0",
      width: "0",
      height: "0",
      border: "0",
      visibility: "hidden",
    });
    const cleanup = () => frame.remove();
    frame.onload = () => {
      const win = frame.contentWindow;
      if (!win) return reject(new Error("print frame unavailable"));
      frame.contentDocument!.title = title;
      win.addEventListener("afterprint", cleanup, { once: true });
      setTimeout(cleanup, 60_000);
      // images are inlined, but give layout a moment so the first page is complete when the dialog opens
      requestAnimationFrame(() => {
        win.focus();
        win.print();
        resolve();
      });
    };
    frame.srcdoc = html;
    document.body.append(frame);
  });
}
