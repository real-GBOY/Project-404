import type { ComponentProps, ReactNode } from "react";
import { motion } from "motion/react";
import { Icon } from "./icon";

/*
 * Template `.btn.btn-primary.btn-arrow`: on hover the label slides left and an arrow fades in
 * on its right. `variant="link"` is the underlined text-only version used on service cards.
 */
const BTN_BASE =
  "group inline-flex items-center justify-center rounded-btn capitalize transition-colors duration-300 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const BTN_VARIANT = {
  primary: "bg-secondary px-[2.4rem] py-4 text-body hover:text-body",
  link: "px-[2.4rem] py-4 text-body hover:text-body",
};

function ArrowLabel({ children, underline }: { children: ReactNode; underline?: boolean }) {
  return (
    <span
      className={
        "relative inline-block transition-transform duration-300 ease-out will-change-transform group-hover:translate-x-[-0.7rem]" +
        (underline ? " underline underline-offset-4" : "")
      }
    >
      {children}
      <Icon
        name="arrowRight"
        className="absolute top-1/2 right-0 -translate-y-1/2 opacity-0 transition-all duration-300 ease-out group-hover:right-[-1.6rem] group-hover:opacity-100"
      />
    </span>
  );
}

type ArrowLinkProps = ComponentProps<"a"> & { variant?: keyof typeof BTN_VARIANT };

export function ArrowLink({ variant = "primary", className = "", children, ...rest }: ArrowLinkProps) {
  return (
    <a className={`${BTN_BASE} ${BTN_VARIANT[variant]} ${className}`} {...rest}>
      <ArrowLabel underline={variant === "link"}>{children}</ArrowLabel>
    </a>
  );
}

export function ArrowButton({ className = "", children, ...rest }: ComponentProps<"button">) {
  return (
    <button className={`${BTN_BASE} ${BTN_VARIANT.primary} cursor-pointer ${className}`} {...rest}>
      <ArrowLabel>{children}</ArrowLabel>
    </button>
  );
}

/** Scroll-in reveal matching the template's AOS `fade-up` (1s, once). */
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 100 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 1, delay, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {children}
    </motion.div>
  );
}
