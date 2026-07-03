import { LocationObjectCoords } from "expo-location";
import { locationInfo } from "../components/LocationInfoPopup";
import {
  deg2rad,
  getDistanceFromLatLonInKm,
  calculateTheta,
  computeBbox,
  placeTrip,
  selectCandidate,
} from "./placement";
import type { Candidate, LatLon } from "./placement";

export { getDistanceFromLatLonInKm } from "./placement";

const DISTANCE_LENIENCY = 0.1;

/** Effective [minDist, maxDist] for a trip, preserving distance_tier scaling and
 *  the thin-annulus-at-floor clamp for low tiers. */
function annulusBounds(
  maximum_distance: number,
  minimum_distance: number,
  distance_tier: number,
): { minDist: number; maxDist: number } {
  let maxDist = (maximum_distance / 10) * distance_tier;
  let minDist = minimum_distance;
  if (maxDist < minimum_distance)
    maxDist = minimum_distance * (1 + DISTANCE_LENIENCY);
  if (minDist > maximum_distance)
    minDist = maximum_distance * (1 - DISTANCE_LENIENCY);
  return { minDist, maxDist };
}

/**
 * Overpass API endpoints, tried in order. If one is down, overloaded, or
 * unreachable, the next is used as a fallback so generation keeps working.
 * See https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances
 *
 * Note: both instances advertise IPv6. On a network with broken IPv6 routing,
 * React Native's fetch tries IPv6 first and fails with "Network request failed"
 * without falling back to IPv4 (unlike curl/browsers), so all endpoints fail.
 * If generation fails only on one network, check that its IPv6 works.
 */
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
];

/** Abort a single Overpass request if it hasn't responded in time. */
const OVERPASS_TIMEOUT_MS = 15000;

/** Above this max distance the single-area query is skipped in favor of the
 *  per-location fallback (avoids an enormous bbox / oversized Overpass query). */
export const AREA_QUERY_MAX_DISTANCE_M = 10000;

/**
 * Maximum number of times we re-roll coordinates when Overpass returns nothing
 * (endpoint unavailable, or no matching road near the random point) before
 * giving up and returning a "0" result to the caller.
 */
const MAX_GENERATION_RETRIES = 30;

/**
 * Wait provided amount of time (in milliseconds)
 */
const wait = (time: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, time));

/**
 * Return a openstreetmaps 'lookup' API url
 * See https://nominatim.org/release-docs/latest/api/Lookup/ for more info
 */
const lookupApi = (type: string, id: number) => {
  return `https://nominatim.openstreetmap.org/lookup?osm_ids=${type}${id}&extratags=1&format=json`;
};

/**
 * Return a openstreetmaps reverse geocoding API url
 * See https://nominatim.org/release-docs/latest/api/Reverse/ for more info
 */
const getOSMTypeAndIdAPI = (
  latitude: number,
  longitude: number,
  zoom: number,
) => {
  return `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&zoom=${zoom}&addressdetails=1&extratags=1&format=json`;
};

const fetchOverpassInfo = async (latitude: number, longitude: number) => {
  console.log("getting overpass info from lat lon:", latitude, longitude);
  const query = `[out:json];
  way(around:200, ${latitude},${longitude})->.a;
  (
    way.a["tracktype"="grade1"];
    way.a["tracktype"="grade2"];
    way.a["tracktype"="grade3"];
    way.a["highway"="residential"];
    way.a["highway"="living_street"];
    way.a["highway"="pedestrian"];
    way.a["highway"="track"];
    way.a["highway"="footway"];
    way.a["highway"="bridleway"];
    way.a["highway"="steps"];
    way.a["highway"="cycleway"];
    way.a["highway"="service"];
    way.a["highway"="secondary"]["maxspeed:type"~":urban"];
    way.a["highway"="tertiary"]["maxspeed:type"~":urban"];
    way.a["highway"="secondary"]["maxspeed"~"^[0-5][0-9]?$"];
    way.a["highway"="tertiary"]["maxspeed"~"^[0-5][0-9]?$"];
    way.a["highway"="secondary"]["maxspeed"~"^[0-3][0-9]? mph$"];
    way.a["highway"="tertiary"]["maxspeed"~"^[0-3][0-9]? mph$"];
  );
  >;
  out skel;`;
  let lastError: unknown = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OVERPASS_TIMEOUT_MS);
    try {
      const data = await fetch(endpoint, {
        method: "POST",
        body: "data=" + encodeURIComponent(query),
        referrer: "com.aki665.archipelago",
        headers: { "user-agent": "archipela-go/0.7.0" },
        signal: controller.signal,
      });
      // A busy/overloaded instance returns an HTML error page, not JSON, so
      // bail out to the next endpoint instead of letting data.json() throw.
      if (!data.ok) {
        throw new Error(
          `Overpass endpoint ${endpoint} returned HTTP ${data.status}`,
        );
      }
      const res: {
        elements: [{ type: string; id: number; lat: number; lon: number }];
      } = await data.json();
      // Log the RESOLVED body, not the Promise. In React Native,
      // console.log(data.json()) prints a pending Promise ({_h,_i,_j,_k}),
      // which is not the response content — always await first.
      console.log(
        `Overpass ${endpoint} OK: ${res.elements?.length ?? 0} elements`,
      );
      return res.elements;
    } catch (e) {
      lastError = e;
      console.log(`Overpass endpoint failed (${endpoint}):`, e);
      await wait(500);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError ?? new Error("All Overpass endpoints failed");
};

/**
 * One Overpass query over the whole play area. Returns every road NODE (with
 * lat/lon) belonging to a matching way in the bbox, minus banned nodes, so the
 * caller can place all trips locally without further network calls. Returns null
 * when the area is too large or all endpoints fail — the caller then falls back
 * to the per-location generator.
 */
export async function fetchRoadCandidates(
  origin: LatLon,
  maxDistanceMeters: number,
  bannedOsmIDs: Set<string>,
): Promise<Candidate[] | null> {
  if (maxDistanceMeters > AREA_QUERY_MAX_DISTANCE_M) {
    console.log(
      `Area ${maxDistanceMeters}m exceeds ${AREA_QUERY_MAX_DISTANCE_M}m; using per-location fallback.`,
    );
    return null;
  }
  const b = computeBbox(origin, maxDistanceMeters);
  // Overpass estimates cost from area; hint timeout/maxsize so it schedules well.
  const areaKm2 = Math.max(1, Math.PI * (maxDistanceMeters / 1000) ** 2);
  const timeout = Math.min(180, Math.max(25, Math.ceil(areaKm2 * 2)));
  const query = `[bbox:${b.south},${b.west},${b.north},${b.east}][timeout:${timeout}][out:json];
  (
    way["tracktype"="grade1"];
    way["tracktype"="grade2"];
    way["tracktype"="grade3"];
    way["highway"="residential"];
    way["highway"="living_street"];
    way["highway"="pedestrian"];
    way["highway"="track"];
    way["highway"="footway"];
    way["highway"="bridleway"];
    way["highway"="steps"];
    way["highway"="cycleway"];
    way["highway"="service"];
    way["highway"="secondary"]["maxspeed:type"~":urban"];
    way["highway"="tertiary"]["maxspeed:type"~":urban"];
    way["highway"="secondary"]["maxspeed"~"^[0-5][0-9]?$"];
    way["highway"="tertiary"]["maxspeed"~"^[0-5][0-9]?$"];
    way["highway"="secondary"]["maxspeed"~"^[0-3][0-9]? mph$"];
    way["highway"="tertiary"]["maxspeed"~"^[0-3][0-9]? mph$"];
  )->.roads;
  node(w.roads);
  out skel qt;`;

  let lastError: unknown = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OVERPASS_TIMEOUT_MS);
    try {
      const data = await fetch(endpoint, {
        method: "POST",
        body: "data=" + encodeURIComponent(query),
        referrer: "com.aki665.archipelago",
        headers: { "user-agent": "archipela-go/0.7.0" },
        signal: controller.signal,
      });
      if (!data.ok) {
        throw new Error(`Overpass ${endpoint} returned HTTP ${data.status}`);
      }
      const res: {
        elements: { type: string; id: number; lat: number; lon: number }[];
      } = await data.json();
      const candidates: Candidate[] = [];
      for (const el of res.elements) {
        if (el.type !== "node" || el.lat == null || el.lon == null) continue;
        const osmID = el.type[0].toUpperCase() + el.id;
        if (bannedOsmIDs.has(osmID)) continue;
        candidates.push({ osmID, lat: el.lat, lon: el.lon });
      }
      console.log(
        `Overpass area ${endpoint} OK: ${candidates.length} candidate nodes`,
      );
      return candidates;
    } catch (e) {
      lastError = e;
      console.log(`Overpass area endpoint failed (${endpoint}):`, e);
      await wait(500);
    } finally {
      clearTimeout(timer);
    }
  }
  console.log("All Overpass area endpoints failed:", lastError);
  return null;
}

/**
 * Calculates a random latitude and longitude a certain distance away from given coordinates
 * Taken from https://gis.stackexchange.com/questions/334297/generate-coordinates-with-minimum-maximum-distance-from-given-coordinates
 * @param latitude starting latitude
 * @param longitude starting longitude
 * @param max maximum distance (in M)
 * @param min minimum distance (in M)
 * @returns Object with new cordinates and distance in KM
 */
async function generateLocationOverpass(
  latitude: number,
  longitude: number,
  max: number,
  theta: number,
  zoom: number,
  bannedOsmIDs: Set<string>,
  min = 0,
) {
  if (min > max) {
    console.log("max", max);
    return { distance: 0, newLatitude: 0, newLongitude: 0, osmID: "0" };
  }

  // earth radius in km
  const EARTH_RADIUS = 6371;

  // 1° latitude in meters
  const DEGREE = ((EARTH_RADIUS * 2 * Math.PI) / 360) * 1000;

  const randomNumber = Math.random();
  console.log(randomNumber);
  // random distance within [min-max] in m in a non-uniform way

  const r = (max - min) * randomNumber ** 0.5 + min;
  console.log(
    "Generated distance",
    r,
    `from (${max} - ${min}) * ${randomNumber} ** 0.5 + ${min}`,
  );

  const dy = r * Math.sin(theta);
  const dx = r * Math.cos(theta);

  let newLatitude = latitude + dy / DEGREE;
  let newLongitude = longitude + dx / (DEGREE * Math.cos(deg2rad(latitude)));

  console.log("generated coordinates:", newLatitude, newLongitude);
  try {
    await wait(125);
    const res = await fetchOverpassInfo(newLatitude, newLongitude);

    // Pick the first returned node that isn't a banned location. osmIDs are
    // formatted as the capitalized first letter of the type + the id, e.g.
    // "N123" for node 123 (matching how banned locations are stored).
    const eligible = res.filter((node) => {
      if (node.lat == null || node.lon == null) return false;
      const osmID = node.type[0].toUpperCase() + node.id;
      if (bannedOsmIDs.has(osmID)) return false;
      const fromOrigin =
        getDistanceFromLatLonInKm(latitude, longitude, node.lat, node.lon) *
        1000;
      return fromOrigin >= min && fromOrigin <= max;
    });
    const coords = eligible[0];
    if (coords == null)
      return { distance: 0, newLatitude: 0, newLongitude: 0, osmID: "0" };

    console.log("coords", coords);
    console.log(newLatitude, "is now", coords.lat);
    console.log(newLongitude, "is now", coords.lon);

    newLatitude = coords.lat;
    newLongitude = coords.lon;
    const osmID = coords.type[0].toUpperCase() + coords.id;
    const distance = getDistanceFromLatLonInKm(
      latitude,
      longitude,
      newLatitude,
      newLongitude,
    );
    return {
      newLatitude,
      newLongitude,
      distance,
      osmID,
    };
  } catch (e) {
    console.log(e);
    return { distance: 0, newLatitude: 0, newLongitude: 0, osmID: "0" };
  }
}

/**
 * Returns a set of coordinates based on input. If resulting coordinates are farther than maximum_distance or nearer than minimum_distance, coordinates get rolled again
 */
async function getLocationCoordinates(
  latitude: number,
  longitude: number,
  maximum_distance: number,
  distance_tier: number,
  useNearZoom: boolean,
  minRadian: number,
  maxRadian: number,
  bannedOsmIDs: Set<string>,
  minimum_distance = 0,
  correction = 0,
  loop_count = 0,
  fail_count = 0,
): Promise<{
  newLatitude: number;
  newLongitude: number;
  distance: number;
  osmID: string;
}> {
  console.log(`${maximum_distance} / 10 * ${distance_tier}`);
  const { minDist, maxDist } = annulusBounds(
    maximum_distance,
    minimum_distance,
    distance_tier,
  );
  const zoom = loop_count > 1 || useNearZoom ? 18 : 17;

  const theta = calculateTheta(minRadian, maxRadian);
  let res = await generateLocationOverpass(
    latitude,
    longitude,
    maxDist,
    theta,
    zoom,
    bannedOsmIDs,
    minDist,
  );
  if (res.osmID === "0") {
    // No usable road came back. This happens either because Overpass is
    // unavailable or because the random point had no matching road nearby.
    // Re-roll a bounded number of times (with a small delay so we don't hammer
    // the API) and otherwise give up, returning "0" so the caller can react.
    if (fail_count >= MAX_GENERATION_RETRIES) {
      console.log(
        "Giving up generating coordinates after",
        fail_count,
        "failed attempts (Overpass unavailable or no matching roads nearby).",
      );
      return res;
    }
    await wait(250);
    res = await getLocationCoordinates(
      latitude,
      longitude,
      maximum_distance,
      distance_tier,
      useNearZoom,
      minRadian,
      maxRadian,
      bannedOsmIDs,
      minimum_distance,
      correction,
      loop_count,
      fail_count + 1,
    );
  }
  return res;
}

export default async function getLocations(
  initialCords: LocationObjectCoords,
  maximum_distance: number,
  minimum_distance: number,
  speed_requirement: number,
  trip: {
    distance_tier: number;
    key_needed: number;
    speed_tier: number;
  },
  useNearZoom: boolean,
  maxRadian: number,
  minRadian: number,
  bannedOsmIDs: Set<string>,
  candidates?: Candidate[] | null,
): Promise<{
  lat: number;
  lon: number;
  osmID: string;
  duplicate: boolean;
}> {
  const origin = { lat: initialCords.latitude, lon: initialCords.longitude };
  const { minDist, maxDist } = annulusBounds(
    maximum_distance,
    minimum_distance,
    trip.distance_tier,
  );

  // Fast path: place locally against the cached candidate set.
  if (candidates && candidates.length > 0) {
    const placed = placeTrip(
      origin,
      candidates,
      minDist,
      maxDist,
      minRadian,
      maxRadian,
      bannedOsmIDs,
    );
    if (!placed) return { lat: 0, lon: 0, osmID: "0", duplicate: false };
    return {
      lat: placed.lat,
      lon: placed.lon,
      osmID: placed.osmID,
      duplicate: false,
    };
  }

  // Fallback: original per-location Overpass generation (now floor-enforced).
  const coordinates = await getLocationCoordinates(
    initialCords.latitude,
    initialCords.longitude,
    maximum_distance,
    trip.distance_tier,
    useNearZoom,
    minRadian,
    maxRadian,
    bannedOsmIDs,
    minimum_distance,
  );
  return {
    lat: coordinates.newLatitude,
    lon: coordinates.newLongitude,
    osmID: coordinates.osmID,
    duplicate: false,
  };
}
