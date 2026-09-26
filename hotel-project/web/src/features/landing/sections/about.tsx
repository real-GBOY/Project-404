import { useEffect, useRef, useState } from "react";
import { animate, useInView, useReducedMotion } from "motion/react";
import { ArrowLink, Reveal } from "../components/ui";
import { about, stats } from "../data";

export function About() {
  const { wide, main, small } = about.images;
  return (
    <section id="about-us" className="py-32">
      <Reveal className="px-side">
        <h3 className="display-3 mx-auto text-center lg:w-1/3">{about.title}</h3>
        <div className="mt-4 grid items-start gap-x-6 lg:mt-12 lg:grid-cols-2">
          <div>
            <div className="p-6 sm:p-12">
              <p>{about.body}</p>
              <ArrowLink href={about.cta.href} className="mt-4">
                {about.cta.label}
              </ArrowLink>
            </div>
            <img src={wide.src} alt={wide.alt} loading="lazy" className="mt-6 h-auto max-w-full rounded-2xl" />
          </div>
          <div className="mt-12 lg:mt-0">
            <img src={main.src} alt={main.alt} loading="lazy" className="h-auto max-w-full rounded-2xl" />
            <img src={small.src} alt={small.alt} loading="lazy" className="mt-6 h-auto max-w-full rounded-2xl" />
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/** Counts up from 0 the first time the number scrolls into view. */
function CountUp({ value, suffix }: { value: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);

  useEffect(() => {
    if (!inView || reduce) return;
    const controls = animate(0, value, { duration: 1.6, ease: "easeOut", onUpdate: (v) => setShown(Math.round(v)) });
    return () => controls.stop();
  }, [inView, reduce, value]);

  return (
    <span ref={ref} aria-label={`${value}${suffix}`}>
      {shown}
      {suffix}
    </span>
  );
}

// Each number has the template's soft peach dot tucked behind it at a slightly different spot.
const DOT_POSITIONS = ["left-[12%] top-[58%]", "left-[18%] top-[40%]", "left-[30%] top-[72%]", "left-[14%] top-[36%]"];

export function Stats() {
  return (
    <section id="info" aria-label="Hotel in numbers">
      <Reveal className="container-bs">
        <div className="grid gap-y-6 md:grid-cols-4">
          {stats.map((s, i) => (
            <div key={s.label} className="text-center">
              <h3 className="display-1 text-primary!">
                <span className="relative inline-block">
                  <img
                    src="/images/pattern1.png"
                    alt=""
                    aria-hidden="true"
                    width={37}
                    height={37}
                    className={`absolute -z-10 -translate-1/2 ${DOT_POSITIONS[i % DOT_POSITIONS.length]}`}
                  />
                  <CountUp value={s.value} suffix={s.suffix} />
                </span>
              </h3>
              <p className="capitalize">{s.label}</p>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
