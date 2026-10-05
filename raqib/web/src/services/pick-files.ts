/**
 * Open the browser's file chooser (optionally the camera on phones) and hand back the chosen files. A throw-away
 * input keeps this out of the component tree; the chooser must be opened from a user gesture.
 */
export function pickFiles(accept: string, capture: boolean, onPick: (files: File[]) => void): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = accept;
  input.multiple = true;
  if (capture) input.setAttribute("capture", "environment");
  input.onchange = () => {
    onPick(Array.from(input.files ?? []));
    input.remove();
  };
  input.click();
}
