import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Reveal } from "../components/ui";
import { Icon } from "../components/icon";
import { gallery } from "../data";

// Swiper `effect: "fade"` with prev/next buttons that dim at either end (no loop), as in the template.
function Arrow({ dir, disabled, onClick, className }: { dir: "prev" | "next"; disabled: boolean; onClick: () => void; className: string }) {
  return (
    <button
      type="button"
      aria-label={dir === "prev" ? "Previous image" : "Next image"}
      disabled={disabled}
      onClick={onClick}
      className={`cursor-pointer rounded-full bg-secondary text-body transition-opacity hover:text-primary disabled:pointer-events-none disabled:opacity-35 ${className}`}
    >
      <Icon name={dir === "prev" ? "arrowLeft" : "arrowRight"} className="size-full" />
    </button>
  );
}

export function Gallery() {
  const [index, setIndex] = useState(0);
  const last = gallery.images.length - 1;
  const prev = () => setIndex((i) => Math.max(0, i - 1));
  const next = () => setIndex((i) => Math.min(last, i + 1));
  const image = gallery.images[index];

  return (
    <section id="gallery" aria-label={gallery.title}>
      <Reveal>
        <h3 className="display-3 px-4 text-center">{gallery.title}</h3>
        <p className="mx-auto mb-12 px-4 text-center lg:w-1/3">{gallery.body}</p>
        <div className="container-bs relative pb-16 md:pb-0">
          <div
            className="relative mx-auto aspect-[1555/916] w-10/12 overflow-hidden rounded-2xl"
            role="region"
            aria-roledescription="carousel"
            aria-label={`Image ${index + 1} of ${last + 1}`}
          >
            <AnimatePresence initial={false}>
              <motion.img
                key={image.src}
                src={image.src}
                alt={image.alt}
                loading="lazy"
                className="absolute inset-0 size-full rounded-2xl object-cover"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              />
            </AnimatePresence>
          </div>
          {/* Desktop: large side arrows. Mobile: small pair centred under the image. */}
          <Arrow dir="prev" disabled={index === 0} onClick={prev} className="absolute top-1/2 left-0 hidden size-[70px] -translate-y-1/2 p-4 md:block" />
          <Arrow dir="next" disabled={index === last} onClick={next} className="absolute top-1/2 right-0 hidden size-[70px] -translate-y-1/2 p-4 md:block" />
          <div className="absolute bottom-0 left-1/2 flex -translate-x-1/2 gap-6 md:hidden">
            <Arrow dir="prev" disabled={index === 0} onClick={prev} className="size-[50px] p-2" />
            <Arrow dir="next" disabled={index === last} onClick={next} className="size-[50px] p-2" />
          </div>
        </div>
      </Reveal>
    </section>
  );
}
