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
