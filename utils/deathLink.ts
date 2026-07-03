import { getDistanceFromLatLonInKm } from "./getLocations";

export const DEATH_LINK_MODES = {
  OFF: "OFF",
  RESPAWN: "RESPAWN",
  TRAP: "TRAP",
} as const;

export type DeathLinkMode =
  (typeof DEATH_LINK_MODES)[keyof typeof DEATH_LINK_MODES];

/** Display names of the 8 Archipela-Go! trap items (all honor-system). */
export const TRAP_NAMES = [
  "Shuffle Trap",
  "Silence Trap",
  "Fog Of War Trap",
  "Push Up Trap",
  "Socializing Trap",
  "Sit Up Trap",
  "Jumping Jack Trap",
  "Touch Grass Trap",
] as const;

/** Pick a random trap display name to announce on a DeathLink (Trap mode). */
export function pickRandomTrap(): string {
  return TRAP_NAMES[Math.floor(Math.random() * TRAP_NAMES.length)];
}

/** Great-circle distance in meters between two lat/lon points. */
export function metersBetween(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  return (
    getDistanceFromLatLonInKm(
      a.latitude,
      a.longitude,
      b.latitude,
      b.longitude,
    ) * 1000
  );
}
