import { useState } from "react";
import { Reveal } from "../components/ui";
import { Icon } from "../components/icon";
import { services, servicesSection, type Service } from "../data";

function ServiceCard({ service }: { service: Service }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-hairline p-8 text-center transition-colors duration-300 hover:border-primary sm:p-12">
      <div className="relative inline-block">
        <img src="/images/pattern2.png" alt="" aria-hidden="true" width={23} height={23} className="absolute top-full left-1/2 -z-10 -translate-x-[calc(50%+1.5rem)] -translate-y-1/2" />
        <Icon name={service.icon} size={70} className="text-accent" />
      </div>
      <h4 className="display-6 my-4">{service.title}</h4>
      <p className={open ? "" : "line-clamp-4"}>{service.body}</p>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="group mt-2 inline-flex cursor-pointer items-center px-[2.4rem] py-4 capitalize"
      >
        <span className="relative inline-block underline underline-offset-4 transition-transform duration-300 group-hover:translate-x-[-0.7rem]">
          {open ? "Show Less" : servicesSection.readMore}
          <Icon
            name="arrowRight"
            className={`absolute top-1/2 right-0 -translate-y-1/2 opacity-0 transition-all duration-300 group-hover:right-[-1.6rem] group-hover:opacity-100 ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>
    </div>
  );
}

export function Services() {
  return (
    <section id="services" className="py-32">
      <Reveal className="px-side">
        <h3 className="display-3 mx-auto text-center lg:w-1/3">{servicesSection.title}</h3>
        <div className="isolate mt-12 grid items-start gap-x-6 gap-y-6 md:grid-cols-2 xl:grid-cols-3">
          {services.map((s) => (
            <ServiceCard key={s.title} service={s} />
          ))}
        </div>
      </Reveal>
    </section>
  );
}
