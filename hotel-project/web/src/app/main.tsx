import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MotionConfig } from "motion/react";
import { LandingPage } from "@/features/landing";
import { SmoothScroll } from "./smooth-scroll";
import "@/styles/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* "user" honours the OS reduced-motion setting for every animation in the tree. */}
    <MotionConfig reducedMotion="user">
      <SmoothScroll>
        <LandingPage />
      </SmoothScroll>
    </MotionConfig>
  </StrictMode>,
);
