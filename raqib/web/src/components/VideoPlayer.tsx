/* eslint-disable jsx-a11y/media-has-caption -- field footage has no captions to offer */

/** The protected evidence video: no download control, fits the viewer. Shown only when the person asks to load it. */
export function VideoPlayer({ src }: { src: string }) {
  return (
    <video
      src={src}
      controls
      controlsList="nodownload"
      style={{ maxWidth: "100%", maxHeight: "60vh" }}
    />
  );
}
