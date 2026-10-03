import { vi } from "vitest";

/** In-memory AsyncStorage so persistence code runs under Node. */
const store = new Map<string, string>();

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (k: string) => store.get(k) ?? null,
    setItem: async (k: string, v: string) => void store.set(k, v),
    removeItem: async (k: string) => void store.delete(k),
    clear: async () => store.clear(),
  },
}));

export const memoryStorage = store;
