import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Plain JSON read, used only to import data written before storage was versioned.
 * New code should use lib/versioned. Never throws; failures are logged in development.
 */
export async function loadJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch (e) {
    if (__DEV__) console.warn(`[storage] read "${key}" failed`, e);
    return fallback;
  }
}
