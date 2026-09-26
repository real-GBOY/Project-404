import { useEffect, useRef, useState } from "react";
import { motion, type PanInfo } from "motion/react";
import { ArrowLink, Reveal } from "../components/ui";
import { rooms, roomsSection, type Room } from "../data";

const GAP = 20; // Swiper spaceBetween

// Swiper breakpoints from the template: 1 / 2 (≥1024) / 3 (≥1280) cards per view.
function perViewFor(width: number) {
  return width >= 1280 ? 3 : width >= 1024 ? 2 : 1;
}

function useViewportWidth() {
  const [w, setW] = useState(() => window.innerWidth);
  useEffect(() => {
    const onResize = () => setW(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return w;
}

function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

function RoomCard({ room }: { room: Room }) {
  const rows: [string, string][] = [
    ["Price:", `$${room.price} / night`],
    ["Size:", room.size],
    ["Capacity:", room.capacity],
    ["Bed:", room.bed],
    ["Services:", room.services],
  ];
  return (
    <article>
      {/* Template hover: photo dims + zooms, details slide up from the bottom. Also on keyboard focus. */}
      <a
        href="#rooms"
        className="group relative block overflow-hidden rounded-2xl bg-black"
        aria-label={`${room.name} — from $${room.price} per night`}
        draggable={false}
      >
        <img
          src={room.image}
          alt=""
          loading="lazy"
          draggable={false}
          className="aspect-[991/1234] w-full rounded-2xl object-cover transition-all duration-500 ease-in-out group-hover:scale-110 group-hover:opacity-50 group-focus-visible:scale-110 group-focus-visible:opacity-50"
        />
        <div className="absolute -bottom-[125px] p-8 text-left opacity-0 transition-all duration-500 ease-in-out group-hover:bottom-5 group-hover:opacity-100 group-focus-visible:bottom-5 group-focus-visible:opacity-100 sm:p-12 md:max-2xl:-bottom-[180px]">
          <h4 className="display-6 text-white!">{room.name}</h4>
          <p className="text-white">{room.description}</p>
          <table className="text-white">
            <tbody>
              {rows.map(([k, v]) => (
                <tr key={k}>
                  <td className="pe-2 align-top">{k}</td>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 mb-0 text-white underline">{roomsSection.detailsLabel}</p>
        </div>
      </a>
      <div className="mt-4 text-center">
        <h4 className="display-6">
          <a href="#rooms">{room.name}</a>
        </h4>
        <p>
          <span className="fs-4 text-primary">${room.price}</span>/night
        </p>
      </div>
    </article>
  );
}

export function Rooms() {
  const perView = perViewFor(useViewportWidth());
  const [trackRef, trackWidth] = useElementWidth<HTMLDivElement>();
  const pages = Math.max(1, rooms.length - perView + 1);
  const [index, setIndex] = useState(0);
  const current = Math.min(index, pages - 1);

  const slideWidth = trackWidth ? (trackWidth - GAP * (perView - 1)) / perView : 0;
  const step = slideWidth + GAP;

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const swipe = info.offset.x + info.velocity.x * 0.2;
    if (swipe < -step / 4) setIndex(Math.min(current + 1, pages - 1));
    else if (swipe > step / 4) setIndex(Math.max(current - 1, 0));
  };

  return (
    <section id="rooms" className="py-32">
      <Reveal className="px-side">
        <div className="flex flex-wrap items-center justify-between">
          <h3 className="display-3 text-center">{roomsSection.title}</h3>
          <ArrowLink href={roomsSection.cta.href} className="mt-4">
            {roomsSection.cta.label}
          </ArrowLink>
        </div>

        <div
          ref={trackRef}
          className="mt-12 overflow-hidden"
          role="region"
          aria-roledescription="carousel"
          aria-label="Rooms"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") setIndex(Math.min(current + 1, pages - 1));
            if (e.key === "ArrowLeft") setIndex(Math.max(current - 1, 0));
          }}
        >
          <motion.div
            className="flex cursor-grab active:cursor-grabbing"
            style={{ gap: GAP }}
            animate={{ x: -current * step }}
            transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
            drag={pages > 1 ? "x" : false}
            dragConstraints={{ left: -(pages - 1) * step, right: 0 }}
            dragElastic={0.15}
            dragMomentum={false}
            onDragEnd={onDragEnd}
          >
            {rooms.map((room, i) => (
              <div
                key={room.name}
                className="shrink-0"
                style={{ width: slideWidth || `${100 / perView}%` }}
                aria-hidden={i < current || i >= current + perView}
              >
                <RoomCard room={room} />
              </div>
            ))}
          </motion.div>
        </div>

        {pages > 1 && (
          <div className="mt-12 flex justify-center" role="group" aria-label="Choose slide">
            {Array.from({ length: pages }, (_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === current}
                onClick={() => setIndex(i)}
                className={`mx-[5px] size-[18px] cursor-pointer rounded-full bg-primary transition-opacity ${i === current ? "opacity-100" : "opacity-20 hover:opacity-50"}`}
              />
            ))}
          </div>
        )}
      </Reveal>
    </section>
  );
}
