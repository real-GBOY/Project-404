import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Explicit cleanup per test: every file runs in one fork (see vite.config.ts), and RTL's
// auto-cleanup registers once per module instance.
afterEach(() => cleanup());
