import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Every file runs in one fork (see vite.config.ts); RTL's auto-cleanup registers once per module instance.
afterEach(() => cleanup());
