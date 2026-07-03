# Generation Speed + Minimum-Distance Floor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the per-location Overpass loop with a single area-wide query feeding a local road-node index, and enforce the slot's `minimum_distance` as a structural floor at node selection — fixing the bug where checks generate closer than the minimum.

**Architecture:** A new pure, dependency-free `utils/placement.ts` holds all generation math (bbox, annulus sampling, and `selectCandidate`, which only ever returns nodes within `[min, max]` of the origin — the floor made structural). It is unit-tested with jest. `utils/getLocations.ts` orchestrates: one `fetchRoadCandidates` area query builds a candidate node list once per session; each trip is placed locally against it via `placeTrip`; if the area query fails or the area is too large, it falls back to the existing per-location path (with the same floor fix applied). `screens/MapScreen.tsx` fetches the candidate set once, caches it per session, and threads it through generation and reroll.

**Tech Stack:** Expo / React Native 0.81 / React 19 / TypeScript 5.9 (pnpm), Overpass API, `@react-native-async-storage/async-storage` (via `utils/storageHandler.ts`); jest + ts-jest for the pure-core unit tests.

## Global Constraints

- **`minimum_distance` is a HARD FLOOR** every generated check must respect (great-circle distance from the generation origin ≥ `minimum_distance`).
- **Preserve `distance_tier` near/far variation.** `maxDist = (maximum_distance / 10) * distance_tier`; low tiers get a thin annulus at the floor (near-start / backtracking placement). Do NOT flatten this or push all checks outward.
- **Single area query with a fallback.** One Overpass query per session; fall back to the existing per-location method when the area query fails or the area exceeds `AREA_QUERY_MAX_DISTANCE_M`.
- **No WASM / no new heavy deps** beyond the dev-only jest toolchain. Road-graph filters (Most Roads / Closest Roads) are OUT OF SCOPE (deferred spec).
- **Preserve `getLocations`' external return shape** `{ lat: number; lon: number; osmID: string; duplicate: boolean }` and the `osmID: "0"` "could not generate" sentinel, so `MapScreen`'s existing dedupe/retry/`osmID === "0"` logic keeps working.
- **osmID format** is the capitalized first letter of the OSM type + id (nodes → `"N" + id`), matching how banned locations are stored.
- **Verification:** pure core (`utils/placement.ts`) via `npx jest`; everything else via `npx tsc --noEmit` (pre-existing baseline = **9** app-source errors, one in `MapScreen.tsx`; add ZERO new) and `ESLINT_USE_FLAT_CONFIG=false npx eslint <files>` (plain `npm run lint` is broken repo-wide by a pre-existing ESLint v9/legacy-config mismatch). On-device generation behavior (real GPS + Overpass) is a human gate after all tasks.

## File Structure

- **Create** `utils/placement.ts` — pure generation math + floor enforcement (no imports; unit-tested).
- **Create** `utils/placement.test.ts` — jest unit + property tests for the above.
- **Create** `jest.config.js`, `tsconfig.jest.json` — minimal jest/ts-jest setup scoped to `utils/*.test.ts`.
- **Modify** `package.json` — add `test` script + jest devDeps (also updates `pnpm-lock.yaml`).
- **Modify** `utils/getLocations.ts` — `fetchRoadCandidates` (area query); rewrite `getLocations` to place locally via `placement.ts` when candidates are supplied, else fall back to the per-location path (floor-fixed); re-export `getDistanceFromLatLonInKm` from `placement.ts`.
- **Modify** `screens/MapScreen.tsx` — fetch candidates once, cache per session (`sessionName + "_candidates"`), thread into `getCoordinatesForLocations` and `rerollSelectedLocation`.

---

### Task 1: Minimal jest harness (pure-core only)

**Files:**
- Create: `jest.config.js`, `tsconfig.jest.json`, `utils/sanity.test.ts`
- Modify: `package.json` (+ `pnpm-lock.yaml` via install)

**Interfaces:**
- Produces: a working `npx jest` that compiles and runs `utils/**/*.test.ts` through ts-jest, isolated from React-Native/Expo code.

- [ ] **Step 1: Add dev dependencies**

Run: `pnpm add -D jest@^29 ts-jest@^29 @types/jest@^29`
Expected: installs succeed; `package.json` gains those devDependencies.

- [ ] **Step 2: Create `tsconfig.jest.json`**

The repo's `tsconfig.json` uses `"moduleResolution": "bundler"`, which ts-jest cannot consume; give jest its own CommonJS tsconfig:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "node",
    "isolatedModules": false,
    "types": ["jest", "node"]
  }
}
```

- [ ] **Step 3: Create `jest.config.js`**

Scope jest to `utils/` test files only so it never transforms RN/Expo modules:

```js
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/utils"],
  testMatch: ["**/*.test.ts"],
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.jest.json" }],
  },
};
```

- [ ] **Step 4: Add the `test` script**

In `package.json` `"scripts"`, add:

```json
    "test": "jest",
```

- [ ] **Step 5: Add a sanity test**

Create `utils/sanity.test.ts`:

```ts
describe("jest harness", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Run jest**

Run: `npx jest`
Expected: PASS — 1 test passed. If ts-jest complains about the tsconfig, confirm `tsconfig.jest.json` sets `module: commonjs` / `moduleResolution: node`.

- [ ] **Step 7: Confirm tsc unaffected**

Run: `npx tsc --noEmit 2>&1 | grep -v node_modules | grep -c "error TS"`
Expected: `9` (baseline unchanged; the sanity test file adds none).

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-lock.yaml jest.config.js tsconfig.jest.json utils/sanity.test.ts
git commit -m "test: add minimal jest+ts-jest harness scoped to utils pure logic"
```

---

### Task 2: Pure geo core in `utils/placement.ts`

**Files:**
- Create: `utils/placement.ts`
- Create/Modify: `utils/placement.test.ts`
- Modify: `utils/getLocations.ts` (re-export moved symbol)

**Interfaces:**
- Produces: `LatLon`, `Candidate` types; `deg2rad`, `getDistanceFromLatLonInKm(lat1,lon1,lat2,lon2): number`, `metersBetween(a:LatLon,b:LatLon): number`, `computeBbox(origin:LatLon, maxDistanceMeters:number, paddingFactor?:number): {south:number;north:number;west:number;east:number}`, `calculateTheta(minRadian:number, maxRadian:number, rand?:()=>number): number`.
- `getDistanceFromLatLonInKm` is re-exported from `utils/getLocations.ts` so existing importers (`components/LocationInfoPopup.tsx`, `utils/deathLink.ts`) keep working unchanged.

- [ ] **Step 1: Write failing tests**

Create `utils/placement.test.ts`:

```ts
import {
  getDistanceFromLatLonInKm,
  metersBetween,
  computeBbox,
} from "./placement";

describe("getDistanceFromLatLonInKm", () => {
  it("is ~0 for identical points", () => {
    expect(getDistanceFromLatLonInKm(59.9, 10.7, 59.9, 10.7)).toBeCloseTo(0, 5);
  });
  it("matches a known distance (~1.11 km per 0.01° latitude)", () => {
    const km = getDistanceFromLatLonInKm(59.9, 10.7, 59.91, 10.7);
    expect(km).toBeGreaterThan(1.0);
    expect(km).toBeLessThan(1.2);
  });
});

describe("computeBbox", () => {
  const origin = { lat: 59.9, lon: 10.7 };
  it("contains the origin", () => {
    const b = computeBbox(origin, 1000);
    expect(b.south).toBeLessThan(origin.lat);
    expect(b.north).toBeGreaterThan(origin.lat);
    expect(b.west).toBeLessThan(origin.lon);
    expect(b.east).toBeGreaterThan(origin.lon);
  });
  it("spans at least maxDistance from origin to each edge", () => {
    const b = computeBbox(origin, 1000, 1.2);
    const north = metersBetween(origin, { lat: b.north, lon: origin.lon });
    expect(north).toBeGreaterThanOrEqual(1000);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest placement`
Expected: FAIL — cannot find module `./placement`.

- [ ] **Step 3: Create `utils/placement.ts`**

```ts
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
```

- [ ] **Step 4: Run to verify pass**

Run: `npx jest placement`
Expected: PASS — all `getDistanceFromLatLonInKm` / `computeBbox` tests green.

- [ ] **Step 5: Re-export from `getLocations.ts`, remove its local copy**

In `utils/getLocations.ts`: delete its local `getDistanceFromLatLonInKm` and `deg2rad` definitions, and at the top add:

```ts
import {
  deg2rad,
  getDistanceFromLatLonInKm,
  calculateTheta,
} from "./placement";

export { getDistanceFromLatLonInKm } from "./placement";
```

Also delete `getLocations.ts`'s local `calculateTheta` definition (now imported from `placement.ts`). Leave the rest of `getLocations.ts` untouched for now.

- [ ] **Step 6: Verify types + lint + tests**

Run: `npx jest placement && npx tsc --noEmit 2>&1 | grep -v node_modules | grep -c "error TS" && ESLINT_USE_FLAT_CONFIG=false npx eslint utils/placement.ts utils/getLocations.ts`
Expected: jest PASS; tsc `9`; eslint 0 errors. (Confirm `components/LocationInfoPopup.tsx` and `utils/deathLink.ts` still import `getDistanceFromLatLonInKm` from `../utils/getLocations` without change — the re-export keeps them working.)

- [ ] **Step 7: Commit**

```bash
git add utils/placement.ts utils/placement.test.ts utils/getLocations.ts
git commit -m "feat(generation): pure geo core (bbox/distance/theta) in placement.ts, unit-tested"
```

---

### Task 3: Annulus placement + `selectCandidate` floor enforcement

**Files:**
- Modify: `utils/placement.ts`
- Modify: `utils/placement.test.ts`

**Interfaces:**
- Produces:
  - `annulusRadius(minDist:number, maxDist:number, rand?:()=>number): number`
  - `projectPoint(origin:LatLon, r:number, theta:number): LatLon`
  - `selectCandidate(origin:LatLon, candidates:Candidate[], target:LatLon, minDist:number, maxDist:number, exclude:Set<string>): Candidate | null`
  - `placeTrip(origin:LatLon, candidates:Candidate[], minDist:number, maxDist:number, minRadian:number, maxRadian:number, exclude:Set<string>, rand?:()=>number): Candidate | null`
- `selectCandidate`/`placeTrip` return only candidates whose distance from `origin` is within `[minDist, maxDist]` (the structural floor), excluding any `osmID` in `exclude`, choosing the one nearest to `target`; `null` if none qualify.

- [ ] **Step 1: Write failing tests (including the floor property test)**

Append to `utils/placement.test.ts`:

```ts
import { selectCandidate, placeTrip, projectPoint } from "./placement";
import type { Candidate, LatLon } from "./placement";

const ORIGIN: LatLon = { lat: 59.9, lon: 10.7 };

/** Build a candidate at a given meters/bearing from origin. */
function candidateAt(id: string, meters: number, bearingRad: number): Candidate {
  const p = projectPoint(ORIGIN, meters, bearingRad);
  return { osmID: id, lat: p.lat, lon: p.lon };
}

describe("selectCandidate — floor enforcement", () => {
  it("never returns a candidate closer than minDist to origin", () => {
    const cands = [
      candidateAt("N1", 24, 0), // under a 100m floor — must be rejected
      candidateAt("N2", 150, 0),
      candidateAt("N3", 300, 1),
    ];
    const target = projectPoint(ORIGIN, 150, 0);
    const picked = selectCandidate(ORIGIN, cands, target, 100, 500, new Set());
    expect(picked).not.toBeNull();
    expect(picked!.osmID).not.toBe("N1");
  });

  it("returns null when every candidate is under the floor", () => {
    const cands = [candidateAt("N1", 10, 0), candidateAt("N2", 24, 1)];
    const picked = selectCandidate(
      ORIGIN,
      cands,
      ORIGIN,
      100,
      500,
      new Set(),
    );
    expect(picked).toBeNull();
  });

  it("excludes banned/used osmIDs", () => {
    const cands = [candidateAt("N1", 150, 0), candidateAt("N2", 160, 0)];
    const target = projectPoint(ORIGIN, 150, 0);
    const picked = selectCandidate(
      ORIGIN,
      cands,
      target,
      100,
      500,
      new Set(["N1"]),
    );
    expect(picked!.osmID).toBe("N2");
  });

  it("picks the candidate nearest the target among eligible", () => {
    const cands = [candidateAt("N1", 200, 0), candidateAt("N2", 480, 0)];
    const target = projectPoint(ORIGIN, 470, 0);
    const picked = selectCandidate(ORIGIN, cands, target, 100, 500, new Set());
    expect(picked!.osmID).toBe("N2");
  });
});

describe("placeTrip — floor property test", () => {
  it("every non-null placement is within [minDist,maxDist] of origin over many runs", () => {
    // A field of candidates from 0..600m in all directions.
    const cands: Candidate[] = [];
    for (let i = 0; i < 400; i++) {
      const meters = (i % 60) * 10; // 0,10,...,590
      const bearing = (i / 400) * 2 * Math.PI;
      cands.push(candidateAt("N" + i, meters, bearing));
    }
    const minDist = 100;
    const maxDist = 500;
    for (let run = 0; run < 500; run++) {
      const placed = placeTrip(
        ORIGIN,
        cands,
        minDist,
        maxDist,
        0,
        2 * Math.PI,
        new Set(),
      );
      if (placed) {
        const d = metersBetween(ORIGIN, { lat: placed.lat, lon: placed.lon });
        expect(d).toBeGreaterThanOrEqual(minDist - 0.001);
        expect(d).toBeLessThanOrEqual(maxDist + 0.001);
      }
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest placement`
Expected: FAIL — `selectCandidate` / `placeTrip` not exported.

- [ ] **Step 3: Implement the placement functions**

Append to `utils/placement.ts`:

```ts
/**
 * Annulus radius in meters within [minDist, maxDist], non-uniform (sqrt) so the
 * distribution favors the outer edge — matching the original generator.
 */
export function annulusRadius(
  minDist: number,
  maxDist: number,
  rand: () => number = Math.random,
): number {
  return (maxDist - minDist) * Math.sqrt(rand()) + minDist;
}

/** Project a point `r` meters from origin at bearing `theta` (radians). */
export function projectPoint(origin: LatLon, r: number, theta: number): LatLon {
  const dy = r * Math.sin(theta);
  const dx = r * Math.cos(theta);
  return {
    lat: origin.lat + dy / METERS_PER_DEGREE,
    lon: origin.lon + dx / (METERS_PER_DEGREE * Math.cos(deg2rad(origin.lat))),
  };
}

/**
 * Choose the candidate nearest to `target` whose distance FROM ORIGIN is within
 * [minDist, maxDist] meters — this is where the minimum-distance floor is
 * enforced structurally (sub-floor nodes are never eligible). Skips any osmID in
 * `exclude` (banned, or already-used when uniqueness is required). Returns null
 * if none qualify.
 */
export function selectCandidate(
  origin: LatLon,
  candidates: Candidate[],
  target: LatLon,
  minDist: number,
  maxDist: number,
  exclude: Set<string>,
): Candidate | null {
  let best: Candidate | null = null;
  let bestTargetDist = Infinity;
  for (const c of candidates) {
    if (exclude.has(c.osmID)) continue;
    const fromOrigin = metersBetween(origin, { lat: c.lat, lon: c.lon });
    if (fromOrigin < minDist || fromOrigin > maxDist) continue;
    const toTarget = metersBetween(target, { lat: c.lat, lon: c.lon });
    if (toTarget < bestTargetDist) {
      bestTargetDist = toTarget;
      best = c;
    }
  }
  return best;
}

/**
 * Full local placement for one trip: sample a bearing + annulus radius, project
 * a target point, and snap to the nearest eligible candidate. Returns null if no
 * candidate satisfies the annulus.
 */
export function placeTrip(
  origin: LatLon,
  candidates: Candidate[],
  minDist: number,
  maxDist: number,
  minRadian: number,
  maxRadian: number,
  exclude: Set<string>,
  rand: () => number = Math.random,
): Candidate | null {
  const theta = calculateTheta(minRadian, maxRadian, rand);
  const r = annulusRadius(minDist, maxDist, rand);
  const target = projectPoint(origin, r, theta);
  return selectCandidate(origin, candidates, target, minDist, maxDist, exclude);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx jest placement`
Expected: PASS — floor property test and all `selectCandidate` cases green.

- [ ] **Step 5: Verify tsc + lint**

Run: `npx tsc --noEmit 2>&1 | grep -v node_modules | grep -c "error TS" && ESLINT_USE_FLAT_CONFIG=false npx eslint utils/placement.ts`
Expected: tsc `9`; eslint 0 errors.

- [ ] **Step 6: Commit**

```bash
git add utils/placement.ts utils/placement.test.ts
git commit -m "feat(generation): annulus placement + selectCandidate floor enforcement (property-tested)"
```

---

### Task 4: `fetchRoadCandidates` area query

**Files:**
- Modify: `utils/getLocations.ts`

**Interfaces:**
- Consumes: `computeBbox` from `placement.ts`; `OVERPASS_ENDPOINTS`, `OVERPASS_TIMEOUT_MS` (existing in `getLocations.ts`).
- Produces: `export async function fetchRoadCandidates(origin: LatLon, maxDistanceMeters: number, bannedOsmIDs: Set<string>): Promise<Candidate[] | null>` — returns the road-node candidate list for the area, or `null` when the area is too large (`maxDistanceMeters > AREA_QUERY_MAX_DISTANCE_M`) or all endpoints fail (signals the caller to fall back to per-location generation). Also `export const AREA_QUERY_MAX_DISTANCE_M = 10000;`.

- [ ] **Step 1: Add imports and the area-query constant**

At the top of `utils/getLocations.ts`, extend the `placement` import to include `computeBbox` and the `Candidate`/`LatLon` types, and add the threshold constant near `OVERPASS_TIMEOUT_MS`:

```ts
import {
  deg2rad,
  getDistanceFromLatLonInKm,
  calculateTheta,
  computeBbox,
} from "./placement";
import type { Candidate, LatLon } from "./placement";
```

```ts
/** Above this max distance the single-area query is skipped in favor of the
 *  per-location fallback (avoids an enormous bbox / oversized Overpass query). */
export const AREA_QUERY_MAX_DISTANCE_M = 10000;
```

- [ ] **Step 2: Implement `fetchRoadCandidates`**

Add to `utils/getLocations.ts` (reusing the existing highway/tracktype filter set and endpoint-fallback pattern from `fetchOverpassInfo`):

```ts
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
```

- [ ] **Step 3: Verify tsc + lint**

Run: `npx tsc --noEmit 2>&1 | grep -v node_modules | grep -c "error TS" && ESLINT_USE_FLAT_CONFIG=false npx eslint utils/getLocations.ts`
Expected: tsc `9`; eslint 0 errors. (`fetchRoadCandidates` is unused until Task 6 — it is an exported function, so no unused-var error.)

- [ ] **Step 4: Commit**

```bash
git add utils/getLocations.ts
git commit -m "feat(generation): fetchRoadCandidates single area-wide Overpass query"
```

---

### Task 5: `getLocations` uses candidates + floor-fixed per-location fallback

**Files:**
- Modify: `utils/getLocations.ts`

**Interfaces:**
- Consumes: `placeTrip`, `selectCandidate` from `placement.ts`; `Candidate` type.
- Produces: `getLocations(initialCords, maximum_distance, minimum_distance, speed_requirement, trip, useNearZoom, maxRadian, minRadian, bannedOsmIDs, candidates?: Candidate[] | null)` — when `candidates` is a non-empty array, places locally via `placeTrip`; otherwise falls back to the existing per-location Overpass path, now filtered to nodes within `[minDist, maxDist]` of the origin (floor fix). Return shape unchanged: `{ lat, lon, osmID, duplicate: false }`, with `osmID: "0"` when nothing qualifies.

- [ ] **Step 1: Import placement functions**

Extend the `placement` import in `utils/getLocations.ts`:

```ts
import {
  deg2rad,
  getDistanceFromLatLonInKm,
  calculateTheta,
  computeBbox,
  placeTrip,
  selectCandidate,
} from "./placement";
```

- [ ] **Step 2: Compute the annulus bounds once (shared helper)**

Add this helper in `utils/getLocations.ts` (it captures the existing tier-scaling + clamp logic verbatim, so near/far variation is preserved):

```ts
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
```

- [ ] **Step 3: Apply the floor fix to the per-location fallback**

In `generateLocationOverpass`, replace the node-selection line that currently takes the first non-banned node:

```ts
    const coords = res.find(
      (node) => !bannedOsmIDs.has(node.type[0].toUpperCase() + node.id),
    );
```

with selection that also enforces the floor. NO signature change is needed — `generateLocationOverpass(latitude, longitude, max, theta, zoom, bannedOsmIDs, min = 0)` already receives the origin (`latitude`, `longitude`) and the annulus bounds (`min`, `max`). Use them directly:

```ts
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
```

(`latitude`, `longitude`, `min`, `max`, and `bannedOsmIDs` are all already parameters of `generateLocationOverpass` — nothing new to thread in.)

- [ ] **Step 4: Rewrite `getLocations` to branch on candidates**

Replace the body of the exported `getLocations` with:

```ts
export default async function getLocations(
  initialCords: LocationObjectCoords,
  maximum_distance: number,
  minimum_distance: number,
  speed_requirement: number,
  trip: { distance_tier: number; key_needed: number; speed_tier: number },
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
    return { lat: placed.lat, lon: placed.lon, osmID: placed.osmID, duplicate: false };
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
```

Inside `getLocationCoordinates`, delete the now-dead min/max re-roll block — the `calculatedResult` computation and the `if ((calculatedResult < minimum_distance || calculatedResult > maximum_distance) && loop_count > 5) { ... }` branch that recurses with `correction`/`loop_count` (the floor is now enforced by the Step 3 node filter). KEEP the Overpass-unavailable retry (the `if (res.osmID === "0") { ... fail_count ... }` branch that re-rolls up to `MAX_GENERATION_RETRIES`). The `correction` and `loop_count` parameters become unused after this; leaving them in the signature is fine (unused params are not an eslint error here) — do not spend effort removing them. `generateLocationOverpass` is already called with `minDist` as its `min` argument, so Step 3's filter already has what it needs — nothing new to thread.

- [ ] **Step 5: Verify tsc + lint + existing tests**

Run: `npx tsc --noEmit 2>&1 | grep -v node_modules | grep -c "error TS" && ESLINT_USE_FLAT_CONFIG=false npx eslint utils/getLocations.ts && npx jest`
Expected: tsc `9`; eslint 0 errors; jest still green (placement tests unaffected).

- [ ] **Step 6: Commit**

```bash
git add utils/getLocations.ts
git commit -m "feat(generation): getLocations places from candidates; floor-fixed per-location fallback"
```

---

### Task 6: MapScreen integration — fetch once, cache, thread through generation + reroll

**Files:**
- Modify: `screens/MapScreen.tsx`

**Interfaces:**
- Consumes: `fetchRoadCandidates` from `utils/getLocations`; `getLocations`' new optional `candidates` parameter; `Candidate` type; `save`/`load` (`sessionName + "_candidates"`).

- [ ] **Step 1: Import the area query + type**

In `screens/MapScreen.tsx`, extend the `getLocations` import area:

```ts
import getLocations, { fetchRoadCandidates } from "../utils/getLocations";
import type { Candidate } from "../utils/placement";
```

- [ ] **Step 2: Fetch + cache candidates in `getCoordinatesForLocations`**

In `getCoordinatesForLocations`, after `bannedOsmIDs` is computed and before the generation loop, add:

```ts
    let candidates: Candidate[] | null = await load(
      sessionName + "_candidates",
      STORAGE_TYPES.OBJECT,
    );
    if (!candidates) {
      setGeneratingStatus("Loading roads for the area...");
      candidates = await fetchRoadCandidates(
        { lat: loc.latitude, lon: loc.longitude },
        parseInt(JSON.stringify(data.maximum_distance), 10),
        bannedOsmIDs,
      );
      if (candidates && sessionName && sessionName !== "") {
        await save(
          candidates,
          sessionName + "_candidates",
          STORAGE_TYPES.OBJECT,
        );
      }
    }
```

Then pass `candidates` as the last argument to BOTH `getLocations(...)` calls inside `getCoordinatesForLocations` (the main generation `while` loop and the `osmID === "0"` re-roll pass). `candidates` being `null` makes `getLocations` use the per-location fallback automatically.

- [ ] **Step 3: Use candidates in `rerollSelectedLocation`**

In `rerollSelectedLocation`, after `bannedOsmIDs` is computed, load (or fetch) the candidates and pass them to `getLocations`:

```ts
      let candidates: Candidate[] | null = await load(
        sessionName + "_candidates",
        STORAGE_TYPES.OBJECT,
      );
      if (!candidates) {
        candidates = await fetchRoadCandidates(
          { lat: loc.latitude, lon: loc.longitude },
          parseInt(JSON.stringify(slotData.current?.maximum_distance), 10),
          bannedOsmIDs,
        );
        if (candidates && sessionName && sessionName !== "") {
          await save(
            candidates,
            sessionName + "_candidates",
            STORAGE_TYPES.OBJECT,
          );
        }
      }
```

Then add `candidates` as the last argument to the `getLocations(...)` call in `rerollSelectedLocation`.

- [ ] **Step 4: Verify tsc + lint + tests**

Run: `npx tsc --noEmit 2>&1 | grep -v node_modules | grep -c "error TS" && ESLINT_USE_FLAT_CONFIG=false npx eslint screens/MapScreen.tsx && npx jest`
Expected: tsc `9`; eslint 0 errors on `MapScreen.tsx`; jest green.

- [ ] **Step 5: Commit**

```bash
git add screens/MapScreen.tsx
git commit -m "feat(generation): fetch road candidates once per session, thread into generation + reroll"
```

- [ ] **Step 6: Human on-device gate (record, do not attempt in-agent)**

On device/emulator with a real slot: generate a full session and confirm (a) generation issues ONE area request, not one-per-location (watch the logs), (b) every check is ≥ the slot's `minimum_distance` from the start (the 24 m bug is gone), (c) low-tier/key-gated checks still cluster near the start, (d) reroll is instant, (e) a very large `maximum_distance` (> 10 km) or a forced network failure falls back to per-location and still generates. Then delete the session's `_candidates` cache once to confirm a clean re-fetch.

---

## Self-Review notes

- **Spec coverage:** area query (Task 4); local candidate index + per-trip placement with structural floor (Tasks 3, 5, 6); `distance_tier` preservation via `annulusBounds` (Task 5); delete dead correction machinery (Task 5); reroll reuses cached candidates (Task 6); fallback path for oversized/failed queries (Tasks 4, 5); candidate cache persisted per session (Task 6). Deferred filters explicitly out of scope.
- **Floor proof:** `selectCandidate` only returns nodes within `[minDist, maxDist]` of origin; the property test in Task 3 asserts this over 500 runs — the min-distance fix is durably verified.
- **Backward compat:** `getDistanceFromLatLonInKm` re-exported from `getLocations.ts` (Task 2) so `LocationInfoPopup`/`deathLink` imports are untouched; `getLocations` keeps its return shape and `osmID:"0"` sentinel so `MapScreen`'s dedupe/retry logic is unchanged.
- **Types:** `Candidate`/`LatLon` defined in `placement.ts` and imported as `import type` where used; `getLocations`' new `candidates` param is optional so no caller breaks mid-migration.
- **jest isolation:** jest is scoped to `utils/*.test.ts` and `placement.ts` imports nothing RN/Expo, so the runner never transforms native modules.
