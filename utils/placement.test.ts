import {
  getDistanceFromLatLonInKm,
  metersBetween,
  computeBbox,
  selectCandidate,
  placeTrip,
  projectPoint,
} from "./placement";
import type { Candidate, LatLon } from "./placement";

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

const ORIGIN: LatLon = { lat: 59.9, lon: 10.7 };

/** Build a candidate at a given meters/bearing from origin. */
function candidateAt(
  id: string,
  meters: number,
  bearingRad: number,
): Candidate {
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
    const picked = selectCandidate(ORIGIN, cands, ORIGIN, 100, 500, new Set());
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
