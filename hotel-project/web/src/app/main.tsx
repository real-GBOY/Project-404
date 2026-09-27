import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MotionConfig } from "motion/react";
import { LandingPage } from "@/features/landing";
import { NotFoundPage } from "@/features/not-found";
import { SmoothScroll } from "./smooth-scroll";
import "@/styles/index.css";

// The site is a single page: the root is the landing page, every other path is a 404.
const isHome = ["/", "/index.html"].includes(window.location.pathname);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* "user" honours the OS reduced-motion setting for every animation in the tree. */}
    <MotionConfig reducedMotion="user">
      <SmoothScroll>{isHome ? <LandingPage /> : <NotFoundPage />}</SmoothScroll>
    </MotionConfig>
  </StrictMode>,
);
