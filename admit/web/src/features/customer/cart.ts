/** The ticket selection survives a reload and the step from the event page to the details form (sessionStorage, per event). */

export type Cart = Record<string, number>;

const key = (org: string, event: string) => `admit.cart.${org}.${event}`;

export function loadCart(org: string, event: string): Cart {
  try {
    const raw = sessionStorage.getItem(key(org, event));
    const parsed = raw ? (JSON.parse(raw) as Cart) : {};
    return Object.fromEntries(Object.entries(parsed).filter(([, n]) => Number.isInteger(n) && n > 0));
  } catch {
    return {};
  }
}

export function saveCart(org: string, event: string, cart: Cart): void {
  try {
    sessionStorage.setItem(key(org, event), JSON.stringify(cart));
  } catch {
    /* private mode: the cart then lives only in memory for this visit */
  }
}

export function clearCart(org: string, event: string): void {
  try {
    sessionStorage.removeItem(key(org, event));
  } catch {
    /* nothing to clear */
  }
}

export const cartCount = (cart: Cart) => Object.values(cart).reduce((n, q) => n + q, 0);

/**
 * Can one more of this type be added? Per-type availability and the per-booking maximum are enforced here for a smooth UI and again by the
 * server, which holds the seats (the client may be stale).
 */
export function canAdd(cart: Cart, type: { id: string; remaining: number; maxPerBooking: number; onSale: boolean }, eventMax: number): boolean {
  const q = cart[type.id] ?? 0;
  return type.onSale && q < type.remaining && q < type.maxPerBooking && cartCount(cart) < eventMax;
}

/** Sum of the selected tickets, in minor units. */
export function cartTotal(event: { ticketTypes: { id: string; priceMinor: number }[] }, cart: Cart): number {
  return event.ticketTypes.reduce((n, t) => n + t.priceMinor * (cart[t.id] ?? 0), 0);
}
