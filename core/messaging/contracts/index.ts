/**
 * The messaging wire contract — REST DTOs and realtime events — as one import surface.
 * Type-only apart from event-name constants, no dependencies: web apps consume this file
 * directly (as `@auric/contracts/messaging`) instead of keeping a copy.
 */
export * from "./messaging-types.js";
export * from "./realtime-events.js";
