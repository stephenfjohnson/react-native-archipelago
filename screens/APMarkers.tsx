import { GeoJSONSource, Layer, Marker } from "@maplibre/maplibre-react-native";
import React, { memo, useContext, useEffect, useMemo, useState } from "react";

import { trip } from "./MapScreen";
import GlassMarker, { markerStatus } from "../components/glass/GlassMarker";
import { SettingsContext } from "../components/SettingsContext";
import { circlePolygon } from "../utils/mapHelpers";

const MemoizedMarker = memo(function APMarker({
  trip,
  receivedKeys,
  handleShowPopup,
  hinted,
}: Readonly<{
  trip: trip;
  receivedKeys: number;
  handleShowPopup: (item: trip) => void;
  hinted: boolean;
}>) {
  const canCheck = receivedKeys >= trip.trip.key_needed;
  // Duplicate locations get a small random offset, so their markers do not
  // fully cover each other. useMemo keeps the offset stable across renders.
  const coordinates = useMemo<[number, number]>(
    () => [
      trip.coords.duplicate
        ? trip.coords.lon + (Math.random() - 0.5) / 8300
        : trip.coords.lon,
      trip.coords.duplicate
        ? trip.coords.lat + (Math.random() - 0.5) / 8300
        : trip.coords.lat,
    ],
    [trip],
  );

  return (
    <Marker
      id={`${trip.id}`}
      lngLat={coordinates}
      onPress={() => handleShowPopup(trip)}
    >
      <GlassMarker status={markerStatus(canCheck, hinted)} />
    </Marker>
  );
});

export default function APMarkers({
  trips,
  receivedKeys,
  handleShowPopup,
  hintedProgTrips,
}: Readonly<{
  trips: any[] | trip[];
  receivedKeys: number;
  handleShowPopup: (item: trip) => void;
  hintedProgTrips: number[];
}>) {
  const { getSetting } = useContext(SettingsContext);

  const MARKER_RADIUS = getSetting("MARKER_RADIUS", "number");
  const [hintedTrips, setHintedTrips] = useState(hintedProgTrips);
  useEffect(() => {
    setHintedTrips(hintedProgTrips);
  }, [hintedProgTrips]);

  const tripList = trips.filter((t): t is trip => typeof t !== "string");
  const radiusCircles: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: tripList.map((t) =>
      circlePolygon(t.coords.lat, t.coords.lon, MARKER_RADIUS - 1),
    ),
  };
  return (
    <>
      <GeoJSONSource id="marker-radius" data={radiusCircles}>
        <Layer
          type="fill"
          id="marker-radius-fill"
          paint={{
            "fill-color": "#B026FF",
            "fill-opacity": 0.2,
            "fill-outline-color": "#B026FF",
          }}
        />
      </GeoJSONSource>
      {tripList.map((t) => {
        return (
          <MemoizedMarker
            trip={t}
            key={`${t.name}`}
            receivedKeys={receivedKeys}
            handleShowPopup={handleShowPopup}
            hinted={hintedTrips.includes(t.id)}
          />
        );
      })}
    </>
  );
}
