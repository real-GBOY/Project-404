import "@testing-library/jest-dom/vitest";

// Explicit cleanup for every test file. RTL's own auto-cleanup registers once per module
// instance, and this project runs all files in a single fork (see vite.config.ts) — without
// this, a file that renders after another can inherit its DOM.
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
afterEach(() => cleanup());
