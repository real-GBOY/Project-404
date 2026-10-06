import { createElement, useState, type CSSProperties, type ReactNode } from "react";

interface HoverProps {
  as?: string;
  style?: CSSProperties;
  hover?: CSSProperties;
  children?: ReactNode;
  [key: string]: unknown;
}

/** Element with a hover style layer (the design's `style-hover` attribute). */
export function Hover({ as = "div", style, hover, children, ...rest }: HoverProps) {
  const [on, setOn] = useState(false);
  return createElement(
    as,
    {
      ...rest,
      style: on ? { ...style, ...hover } : style,
      onMouseEnter: () => setOn(true),
      onMouseLeave: () => setOn(false),
    },
    children,
  );
}
