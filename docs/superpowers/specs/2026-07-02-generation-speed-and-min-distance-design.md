# Generation — Speed Rewrite + Minimum-Distance Floor

**Date:** 2026-07-02
**Status:** Draft — pending review (Unix for gameplay-intent bits, Stephen as repo owner)
**App:** Archipela-Go! (Expo managed, React Native 0.81, React 19)

## Goal

Two coupled changes to the location-generation path (`utils/getLocations.ts` and its
callers in `screens/MapScreen.tsx`):

1. **Fix the minimum-distance bug.** A check can currently generate closer to the
   origin than the slot's `minimum_distance` (observed: a 24 m check with a 100 m
   minimum). Enforce the floor.
2. **Make generation fast**, the way the web client is fast: replace the current
   *one-Overpass-request-per-location* loop with a **single area-wide query** feeding a
   **local road-node index**, and place every trip locally against that index.

The road-network **filters** (Most Roads / Closest Roads) are explicitly **out of
scope here** — see the deferred phase at the end.

## Confirmed decisions

- **`minimum_distance` is a hard floor** every check must respect. Near-start /
  key-gated checks are made near by a **low `distance_tier`** (small max radius), but
  still sit at or above the floor. (Confirmed by Unix.)
- **Intentional placement must be preserved.** Some checks are *deliberately* placed
  near the start (e.g. a key-gated "Area 2" check) so the player backtracks toward home
  once they have the keys. The `distance_tier` → distance scaling drives this and must
  not be flattened. (Confirmed by Unix — see `memory/generation-design-intent.md`.)
- **Single-area-query rewrite, with a fallback** to the current per-location method
  when the area query is oversized or fails, so generation still works for very large
  play areas. (Author's judgment, Unix authorized proceeding.)
- **No WASM.** The web client uses a Rust/WASM graph; here the equivalent work is plain
  TypeScript. Node counts (hundreds–low thousands within `maximum_distance`) are small
  enough that a flat array + linear scan (optionally grid-bucketed) is sufficient.

## Root cause of the min-distance bug

In `getLocationCoordinates` (`utils/getLocations.ts`), the block that validates the
result against `[minimum_distance, maximum_distance]` and re-rolls/corrects is gated by
`loop_count > 5`. But `loop_count` starts at `0` and is **only incremented inside that
same block**, so the guard is never true — the block is dead code and the floor is never
enforced. Additionally, `generateLocationOverpass` selects a road via
`way(around:200, sampledPoint)` and takes the first non-banned node, which can lie up to
200 m from the sampled point *in any direction* — including back toward the origin, well
under the floor. The correction machinery was meant to catch this but never runs.

## New generation model

### 1. One area query (`fetchOverpassArea`)
Before generating trips, compute a bounding box from the origin and `maximum_distance`
(padded slightly). Fire a **single** Overpass query over that bbox, reusing the existing
highway/tracktype filter set, `out skel qt;`, the existing endpoint-fallback list, the
`OVERPASS_TIMEOUT_MS` abort, and the IPv6 caveat comment. Adopt the web client's cost
hints: inject `[timeout:…][maxsize:…]` estimated from the area
(`~ maximum_distance² · π`) so Overpass schedules the job well.

Returns the full set of candidate road **nodes** `{ osmID, lat, lon }` in the play area.

### 2. Local candidate index (cached per session)
- Filter out banned OSM IDs once, here.
- Persist the candidate set per session (e.g. `sessionName + "_candidates"`) so
  reconnect/resume/reroll do **not** re-query Overpass.
- Structure: flat array is fine; if profiling shows it matters for large sets, bucket by
  a coarse lat/lon grid for nearest-neighbour lookups. No external dependency.

### 3. Per-trip local placement
For each trip (same ordering/`key_needed` grouping as today):
- `maxDist = (maximum_distance / 10) * distance_tier`; `minDist = minimum_distance`;
  keep the existing clamp so `maxDist ≥ minDist` (thin annulus at the floor for low
  tiers — this is what preserves near-start placement).
- Sample a random annulus point at a random `theta` within `[MIN_RADIAN, MAX_RADIAN]`
  (reuse `calculateTheta`).
- **Select the nearest candidate node to the sampled point whose great-circle distance
  *from the origin* is within `[minDist, maxDist]`.** Filtering to the annulus *first*
  makes the minimum floor structural — a sub-min node is never eligible, so the 24 m bug
  cannot recur.
- Respect `NEAR_ZOOM` (allow multiple checks on the same road / node reuse), duplicate
  detection across already-placed trips, banned avoidance, and `LOCATION_RETRIES` for
  uniqueness — all re-expressed against the local index instead of network re-rolls.
- If no candidate satisfies the annulus for a trip (sparse road area), fall back to the
  nearest candidate ≥ `minDist` (never below the floor); if none exists at all, surface
  the existing "could not generate" result (`osmID: "0"`).

### 4. Delete dead machinery
Remove the `correction` / `loop_count` / `fail_count` recursion in
`getLocationCoordinates` and the per-location `fetchOverpassInfo`/`around:200` path once
the area query replaces them. Keep `getDistanceFromLatLonInKm`, `deg2rad`,
`calculateTheta`.

### 5. Reroll becomes instant
`rerollSelectedLocation` re-runs step 3 against the cached candidate set — no network
call — so rerolls are immediate.

### 6. Fallback path
If `fetchOverpassArea` fails (all endpoints down / IPv6 issue) **or** the estimated area
is above a size threshold, fall back to the existing per-location generator for that
session (kept as `generateLocationPerLocation`, the current code path, min-floor fix
applied there too by filtering the `around` results to `≥ minDist` from origin). This
guarantees no regression for huge play areas or degraded networks.

## Files touched
- `utils/getLocations.ts` — new `fetchOverpassArea`, local index + placement, min-floor
  enforcement, delete dead correction code, keep a fallback per-location path.
- `screens/MapScreen.tsx` — call the area query once per session before the trip loop;
  thread the cached candidate set into `getCoordinatesForLocations` and
  `rerollSelectedLocation`; persist/load the candidate set with the other session data.
- `utils/storageHandler.ts` — (only if a new storage key/type is needed) candidate cache.

## Testing / verification
- **Min floor:** with a slot `minimum_distance = 100`, generate a full set and assert
  every trip's origin-distance ≥ 100 (minus rounding leniency). No trip < min.
- **Tier variation preserved:** low-`distance_tier` trips cluster near the floor; high
  tiers spread toward `maximum_distance`. Near-start key-gated checks still appear.
- **Speed:** one Overpass round-trip for a full session (was N); rerolls do zero network.
- **Fallback:** simulate area-query failure → per-location path still generates and still
  respects the floor.
- **Regression:** banned locations, NEAR_ZOOM, duplicates, offline resume, reroll cooldown
  all still behave.

## Deferred — Most Roads / Closest Roads filters (separate future spec)
Once the local candidate set exists, build a road-network **graph** (adjacency from the
`out skel` way geometry) and trim candidates *before* placement:
- **Most Roads** = keep only the largest strongly-connected component (drop unreachable
  stubs).
- **Closest Roads** = Dijkstra from the snapped home node, keep only nodes walkable
  within `maximum_distance` along the network.
Both need a new **segmented setting control** (built in the DeathLink spec) with values
No Limits (default) / Most Roads / Closest Roads. This is the graph-heavy part and gets
its own spec + plan.
