import {
  GeoJSONSource,
  Layer,
  Marker,
} from "@maplibre/maplibre-react-native";
import React, { memo, useContext, useEffect, useMemo, useState } from "react";
import { Image } from "react-native";

import { trip } from "./MapScreen";
import { SettingsContext } from "../components/SettingsContext";
import { circlePolygon } from "../utils/mapHelpers";

const getMarker = (canCheck: boolean, hinted: boolean) => {
  if (canCheck && hinted) return require("../assets/APMarker_Hint.png");
  else if (canCheck) return require("../assets/APMarker_blue.png");
  else if (hinted) return require("../assets/APMarker_Hint_gray.png");
  else return require("../assets/APMarker_gray.png");
};

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
      <Image
        source={getMarker(canCheck, hinted)}
        style={{ width: 50, height: 50 }}
        resizeMode="center"
        resizeMethod="resize"
      />
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
            "fill-color": "#4285F4",
            "fill-opacity": 0.31,
            "fill-outline-color": "#4285F4",
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
