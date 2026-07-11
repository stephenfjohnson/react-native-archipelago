import { type StyleSpecification } from "@maplibre/maplibre-react-native";

/**
 * Coordinate object in the shape react-native-maps used, kept so saved
 * home locations keep working after the MapLibre migration.
 */
export type LatLng = {
  latitude: number;
  longitude: number;
};

/**
 * MapLibre style that renders raster tiles based on OpenStreetMap data,
 * so the map needs no API key or Google Play Services. The dark CARTO
 * basemap is used to match the app's dark glass theme; swap the tile URLs
 * for https://tile.openstreetmap.org/{z}/{x}/{y}.png for a light map.
 */
export const OSM_RASTER_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: "© OpenStreetMap contributors © CARTO",
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster",
      source: "osm",
    },
  ],
};

/**
 * Creates a GeoJSON polygon approximating a circle, since MapLibre layers
 * have no way to draw a circle with a radius in meters.
 */
export function circlePolygon(
  latitude: number,
  longitude: number,
  radiusInMeters: number,
  points = 48,
): GeoJSON.Feature<GeoJSON.Polygon> {
  // 1° of latitude/longitude in meters
  const latitudeDegree = 110574;
  const longitudeDegree = 111320 * Math.cos((latitude * Math.PI) / 180);

  const coordinates: [number, number][] = [];
  for (let i = 0; i <= points; i++) {
    const theta = (i / points) * 2 * Math.PI;
    coordinates.push([
      longitude + (Math.cos(theta) * radiusInMeters) / longitudeDegree,
      latitude + (Math.sin(theta) * radiusInMeters) / latitudeDegree,
    ]);
  }
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [coordinates],
    },
  };
}
