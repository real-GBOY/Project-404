import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Versioned JSON storage. Values are stored as `{ v, data }`. A value written before
 * versioning existed (no wrapper) is treated as version 0 and walked through the migrations.
 */
export type Migrations = Record<number, (data: unknown) => unknown>;

type Envelope = { v: number; data: unknown };

const isEnvelope = (x: unknown): x is Envelope =>
  typeof x === "object" && x !== null && typeof (x as Envelope).v === "number" && "data" in x;

/** Runs `migrations[from]`, `migrations[from + 1]` … up to (not including) `version`. */
export function migrate<T>(raw: unknown, version: number, migrations: Migrations): T {
  let from = 0;
  let data = raw;
  if (isEnvelope(raw)) {
    from = raw.v;
    data = raw.data;
  }
  for (let v = from; v < version; v++) data = migrations[v] ? migrations[v]!(data) : data;
  return data as T;
}

function warn(action: string, key: string, e: unknown) {
  if (__DEV__) console.warn(`[storage] ${action} "${key}" failed`, e);
}

/** Reads and migrates. Returns `fallback` when nothing is stored or storage fails. */
export async function loadVersioned<T>(
  key: string,
  opts: { version: number; fallback: T; migrations?: Migrations },
): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw == null) return opts.fallback;
    return migrate<T>(JSON.parse(raw), opts.version, opts.migrations ?? {});
  } catch (e) {
    warn("read", key, e);
    return opts.fallback;
  }
}

export async function saveVersioned(key: string, version: number, data: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify({ v: version, data } satisfies Envelope));
  } catch (e) {
    warn("write", key, e);
  }
}

export async function removeKey(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch (e) {
    warn("remove", key, e);
  }
}
