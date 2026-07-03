// Pure, dependency-free generation math. Unit-tested in placement.test.ts.
// No React-Native / Expo imports may be added here — jest transforms this file.

export type LatLon = { lat: number; lon: number };
export type Candidate = { osmID: string; lat: number; lon: number };

const EARTH_RADIUS_KM = 6371;
/** meters per degree of latitude */
const METERS_PER_DEGREE = ((EARTH_RADIUS_KM * 2 * Math.PI) / 360) * 1000;

export function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

/** Great-circle distance in KM (haversine). */
export function getDistanceFromLatLonInKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/** Great-circle distance in meters between two points. */
export function metersBetween(a: LatLon, b: LatLon): number {
  return getDistanceFromLatLonInKm(a.lat, a.lon, b.lat, b.lon) * 1000;
}

/** Bounding box (degrees) around origin covering +/- maxDistanceMeters, padded. */
export function computeBbox(
  origin: LatLon,
  maxDistanceMeters: number,
  paddingFactor = 1.2,
): { south: number; north: number; west: number; east: number } {
  const d = maxDistanceMeters * paddingFactor;
  const dLat = d / METERS_PER_DEGREE;
  const dLon = d / (METERS_PER_DEGREE * Math.cos(deg2rad(origin.lat)));
  return {
    south: origin.lat - dLat,
    north: origin.lat + dLat,
    west: origin.lon - dLon,
    east: origin.lon + dLon,
  };
}

/**
 * Random bearing (radians) within the user's allowed wedge. Ported verbatim
 * from the original getLocations.calculateTheta so directional behavior is
 * unchanged ("fixing the crimes of the circular slider component"). `rand` is
 * injectable for deterministic tests.
 */
export function calculateTheta(
  minRadian: number,
  maxRadian: number,
  rand: () => number = Math.random,
): number {
  const fixedMax = Math.abs(minRadian - Math.PI * 2) + Math.PI / 2;
  const fixedMin = Math.abs(maxRadian - Math.PI * 2) + Math.PI / 2;
  if (fixedMin < fixedMax) {
    return rand() * (fixedMax - fixedMin) + fixedMin;
  }
  const maxCircleRads = 2 * Math.PI;
  const highRandom = rand() * (maxCircleRads - fixedMin) + fixedMin;
  const lowRandom = rand() * fixedMax;
  const isLow = rand() < 0.5;
  return isLow ? lowRandom : highRandom;
}

/** meters projected to degrees; exported for the projection + tests. */
export const METERS_PER_DEGREE_LAT = METERS_PER_DEGREE;
