import {
  Client,
  Hint,
  JSONRecord,
  RoomUpdatePacket,
  clientStatuses,
  permissions,
} from "archipelago.js";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import React, {
  ReactNode,
  RefObject,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Pressable,
  Text,
  View,
} from "react-native";
import MapView, { Camera, LatLng, Marker } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import APMarkers from "./APMarkers";
import AsyncAlert from "../components/AsyncAlert";
import { ClientContext } from "../components/ClientContext";
import LocationInfoPopup, {
  REROLL_TIME,
} from "../components/LocationInfoPopup";
import { findSetting, SettingsContext } from "../components/SettingsContext";
import mapStyles from "../styles/MapStyles";
import {
  DEATH_LINK_MODES,
  DeathLinkMode,
  pickRandomTrap,
  metersBetween,
} from "../utils/deathLink";
import getLocations, { fetchRoadCandidates } from "../utils/getLocations";
import { metersBetween as candidateDistanceMeters } from "../utils/placement";
import type { Candidate } from "../utils/placement";
import handleItems, { GOAL_MAP, MAP_ID_TO_ITEM } from "../utils/handleItems";
import { STORAGE_TYPES, load, save } from "../utils/storageHandler";
import { FontAwesome, MaterialCommunityIcons } from "@expo/vector-icons";
import Ionicons from "@expo/vector-icons/Ionicons";
import { getBannedLocations } from "./BannedLocations";
import Colors from "../styles/Colors";
import commonStyles from "../styles/CommonStyles";
import APInfoPopup from "../components/APInfoPopup";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import mapDarkStyle from "../styles/mapDarkStyle";
import Theme from "../styles/Theme";

/**
 * This class is used to send location ids from the geofencing to the react code
 */
class LocationsEmitter {
  events: Record<string, ((data: any) => void)[]>;

  constructor() {
    this.events = {};
  }

  on(event: string, listener: (data?: any) => void) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    if (!this.events[event]?.includes(this.events[event][0]))
      this.events[event]?.push(listener);
  }

  emit(event: string, data: any) {
    const listeners = this.events[event];
    if (listeners) {
      listeners.forEach((listener) => listener(data));
    }
  }
  off(event: string) {
    if (this.events[event] != undefined) {
      this.events[event] = [];
    }
  }
}

function MemoizedMap({
  children,
  location,
  USE_HOME_LOCATION,
  HOME_LOCATION,
}: Readonly<{
  children: ReactNode;
  location: Location.LocationObject | null;
  USE_HOME_LOCATION: boolean;
  HOME_LOCATION: LatLng;
}>) {
  const mapRef = useRef<MapView | null>(null);

  const onMapReady = () => {
    let camera: Camera | null = null;

    if (USE_HOME_LOCATION) {
      camera = {
        altitude: 3,
        center: {
          latitude: HOME_LOCATION.latitude,
          longitude: HOME_LOCATION.longitude,
        },
        heading: 0,
        pitch: 0,
        zoom: 15,
      };
    } else if (location)
      camera = {
        altitude: 3,
        center: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        },
        heading: 0,
        pitch: 0,
        zoom: 15,
      };
    if (camera !== null && mapRef.current !== null) {
      mapRef?.current.setCamera(camera);
    }
  };
  return (
    <MapView
      ref={mapRef}
      // Force the legacy Google Maps renderer. The new "Phoenix" renderer
      // (com.google.android.gms.policy_maps_core) crashes with
      // "The specified child already has a parent" when a Callout's info-window
      // view is moved between markers (e.g. tapping a second marker while one
      // callout is open). Selected once at map-creation time.
      googleRenderer="LEGACY"
      style={mapStyles.map}
      userLocationUpdateInterval={1000}
      showsUserLocation
      onMapReady={onMapReady}
      customMapStyle={mapDarkStyle}
      userInterfaceStyle="dark"
    >
      {children}
    </MapView>
  );
}

const sendGoal = async (client: Client) => {
  client.updateStatus(clientStatuses.goal);
  if (
    client.room.permissions.release === permissions.enabled ||
    client.room.permissions.release === permissions.goal
  ) {
    await AsyncAlert(
      "Goal Achieved",
      "Do you want to send the remaining items from your world? (Runs the !release command)",
      [
        {
          text: "Cancel",
          onPress: () => null,
          style: "cancel",
        },
        {
          text: "YES",
          onPress: () => {
            client.messages.say("!release");
          },
        },
      ],
    );
  }
  if (
    client.room.permissions.collect === permissions.enabled ||
    client.room.permissions.collect === permissions.goal
  ) {
    await AsyncAlert(
      "Goal Achieved",
      "Do you want to collect the remaining items from your world? (Runs the !collect command)",
      [
        {
          text: "Cancel",
          onPress: () => null,
          style: "cancel",
        },
        {
          text: "YES",
          onPress: () => {
            client.messages.say("!collect");
          },
        },
      ],
    );
  }
};

const geofenceLocations = async (
  trips: trip[],
  client: Client,
  receivedKeys: number,
  receivedReductions: number,
  MARKER_RADIUS: number,
  locationEmitter: LocationsEmitter,
) => {
  const AUTOMATIC_SENDING = (await findSetting("AUTOMATIC_SENDING")) as boolean;
  if (!AUTOMATIC_SENDING) {
    return;
  }
  console.log("MARKER_RADIUS in geofenceLocations", MARKER_RADIUS);
  const geofenceArr = trips.map((trip) => {
    if (receivedKeys >= trip.trip.key_needed) {
      return {
        identifier: trip.id.toString(),
        latitude: trip.coords.lat,
        longitude: trip.coords.lon,
        radius: MARKER_RADIUS,
      };
    }
  });
  const filteredGeofenceArr = geofenceArr.filter((_) => _ !== undefined);

  if (!TaskManager.isTaskDefined("apgo-geofencing")) {
    TaskManager.defineTask(
      "apgo-geofencing",
      async ({
        data: { eventType, region },
        error,
      }: {
        data: {
          eventType: Location.GeofencingEventType;
          region: Location.LocationRegion;
        };
        error: TaskManager.TaskManagerError | null;
      }) => {
        if (error) {
          console.log(error);
          return;
        }
        if (eventType === Location.GeofencingEventType.Enter) {
          if (region.identifier !== undefined) {
            const id = parseInt(region.identifier, 10);
            locationEmitter.emit("locationEntered", id);
          }
        }
      },
    );
  }
  if (await Location.hasStartedGeofencingAsync("apgo-geofencing")) {
    await Location.stopGeofencingAsync("apgo-geofencing");
    console.log("apgo-geofencing is defined");
  }

  await Location.startGeofencingAsync("apgo-geofencing", filteredGeofenceArr);
};

const removeGeofencing = async () => {
  if (await Location.hasStartedGeofencingAsync("apgo-geofencing")) {
    await Location.stopGeofencingAsync("apgo-geofencing");
    console.log("apgo-geofencing is defined");
  }
};
/**
 * Remove the given array of ids from the given array of trips
 */
const removeCheckedLocations = (
  trips: trip[],
  checkedLocations: number[] | readonly number[],
) => {
  return trips.filter((trip) => {
    return !checkedLocations.includes(trip.id);
  });
};

export type trip = {
  coords: {
    lat: number;
    lon: number;
    osmID: string;
    duplicate: boolean;
  };
  trip: {
    amount: number;
    distance_tier: number;
    key_needed: number;
    speed_tier: number;
  };
  name: string;
  id: number;
};

export default function MapScreen({
  sessionName,
  isDisconnecting,
}: Readonly<{
  sessionName: string;
  isDisconnecting: RefObject<boolean>;
}>) {
  const { client } = useContext(ClientContext);
  const { getSetting } = useContext(SettingsContext);
  const NEAR_ZOOM = getSetting("NEAR_ZOOM", "boolean");
  const MARKER_RADIUS = getSetting("MARKER_RADIUS", "number");
  const RESPAWN_RADIUS = MARKER_RADIUS;
  const LOCATION_RETRIES = getSetting("LOCATION_RETRIES", "number");
  const MAX_RADIAN = getSetting("MAX_RADIAN", "number");
  const MIN_RADIAN = getSetting("MIN_RADIAN", "number");
  const HOME_LOCATION = getSetting("HOME_LOCATION", "object") as LatLng;
  const USE_HOME_LOCATION = getSetting("USE_HOME_LOCATION", "boolean");
  const DEATH_LINK_MODE = getSetting(
    "DEATH_LINK_MODE",
    "string",
  ) as DeathLinkMode;

  const [showPopup, setShowPopup] = useState(false);
  const [showAPPopup, setShowAPPopup] = useState(false);

  const [selectedLocation, setSelectedLocation] = useState<null | trip>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(
    null,
  );
  const [trips, setTrips] = useState<any[] | trip[]>(["placeholder"]);
  const [checkedLocations, setCheckedLocations] = useState<readonly number[]>(
    [],
  );
  const [receivedKeys, setReceivedKeys] = useState<number>(0);
  const [receivedReductions, setReceivedReductions] = useState<number>(0);
  const [macguffinString, setMacguffinString] =
    useState<string>("Archipela-Go!");
  const [goalAchieved, setGoalAchieved] = useState<boolean>(false);
  const goalAchievedRef = useRef(goalAchieved);
  goalAchievedRef.current = goalAchieved;
  const [respawning, setRespawning] = useState(false);
  const [hintedProgTrips, setHintedProgTrips] = useState<number[]>([0]);
  const [refresh, setRefresh] = useState<boolean>(false);
  const [generating, setGenerating] = useState(true);
  const [generatingStatus, setGeneratingStatus] = useState(
    "Checking for saved info...",
  );

  const rerollAllowedRef = useRef<boolean>(true);
  const rerollTime = useRef<Date>(new Date());
  const rerollTimer = useRef<NodeJS.Timeout | null>(null);
  const slotData = useRef<JSONRecord | null>(null);
  const appState = useRef(AppState.currentState);
  const locationEmitter = useRef(new LocationsEmitter());
  const deathLinkModeRef = useRef<DeathLinkMode>(DEATH_LINK_MODE);
  deathLinkModeRef.current = DEATH_LINK_MODE;
  const respawningRef = useRef(false);
  respawningRef.current = respawning;
  const respawnWatch = useRef<Location.LocationSubscription | null>(null);

  const handleShowPopup = (trip: trip) => {
    setSelectedLocation(trip);
    setShowPopup(true);
  };
  const closePopup = () => {
    setShowPopup(false);
    setSelectedLocation(null);
  };

  const handleReroll = () => {
    console.log(new Date().getTime(), rerollTime.current.getTime());
    if (
      (new Date().getTime() - rerollTime.current.getTime()) / 1000 >
      REROLL_TIME
    ) {
      rerollAllowedRef.current = true;
    }
  };

  const handleGeofenceEnter = (id: number) => {
    if (respawningRef.current) {
      console.log("Ignoring geofence enter while respawning", id);
      return;
    }
    console.log("handleGeofenceEnter id", id);
    setCheckedLocations((prev) => [...prev, id]);
  };

  // Load cached road candidates, but treat the cache as STALE and refetch when
  // none of its nodes fall within maxDistanceMeters of the current origin — the
  // sign it was fetched around a different home. The cache is keyed by session
  // only, so without this a home move (or a device change) silently reused the
  // old location's candidates and every trip failed placement, stranding checks
  // at (0,0)/Null Island until the cache was manually cleared.
  const loadOrFetchCandidates = async (
    origin: { lat: number; lon: number },
    maxDistanceMeters: number,
    bannedOsmIDs: Set<string>,
  ): Promise<Candidate[] | null> => {
    const cached: Candidate[] | null = await load(
      sessionName + "_candidates",
      STORAGE_TYPES.OBJECT,
    );
    const usable =
      !!cached &&
      cached.length > 0 &&
      cached.some(
        (c) =>
          candidateDistanceMeters(origin, { lat: c.lat, lon: c.lon }) <=
          maxDistanceMeters,
      );
    if (usable) return cached;
    const fetched = await fetchRoadCandidates(
      origin,
      maxDistanceMeters,
      bannedOsmIDs,
    );
    if (fetched && fetched.length > 0 && sessionName && sessionName !== "") {
      await save(fetched, sessionName + "_candidates", STORAGE_TYPES.OBJECT);
    }
    return fetched;
  };

  const rerollSelectedLocation = async (
    id: number,
    name: string,
    loops = 0,
    free = false,
  ) => {
    if (slotData.current?.trips !== null && location !== null) {
      if (loops === 0) setGeneratingStatus("Rerolling location");
      setGenerating(true);
      let loc = location.coords;
      if (USE_HOME_LOCATION) {
        loc.latitude = HOME_LOCATION.latitude;
        loc.longitude = HOME_LOCATION.longitude;
      }
      const bannedLocations = await getBannedLocations();
      const bannedOsmIDs = new Set(
        bannedLocations
          .map((location) => location.osmID)
          .filter((osmID) => osmID.startsWith("N")),
      );
      const candidates = await loadOrFetchCandidates(
        { lat: loc.latitude, lon: loc.longitude },
        parseInt(JSON.stringify(slotData.current?.maximum_distance), 10),
        bannedOsmIDs,
      );
      // A free reroll (recovering an invalid 0,0 placement) must not go on
      // cooldown — leave rerollAllowedRef untouched so it stays allowed.
      if (!free) rerollAllowedRef.current = false;
      const oldTrip: trip = trips.find((trip: trip) => trip.id === id);
      const filteredTrips = removeCheckedLocations(trips, [id]);
      const trip = slotData.current?.trips[name];
      // Exclude the road nodes the other (retained) trips already occupy so a
      // reroll can't drop this location on top of an existing one.
      const rerollUsedOsmIDs = new Set<string>(
        filteredTrips
          .map((t) => t.coords.osmID)
          .filter((osmID) => osmID && osmID !== "0"),
      );
      const coords = await getLocations(
        loc,
        parseInt(JSON.stringify(slotData.current?.maximum_distance), 10),
        parseInt(JSON.stringify(slotData.current?.minimum_distance), 10),
        parseInt(JSON.stringify(slotData.current?.speed_requirement), 10),
        trip,
        NEAR_ZOOM,
        MAX_RADIAN,
        MIN_RADIAN,
        bannedOsmIDs,
        candidates,
        rerollUsedOsmIDs,
      );
      const isDuplicate = trips.some(
        (value) =>
          value.coords.lat === coords.lat && value.coords.lon === coords.lon,
      );
      coords.duplicate = isDuplicate;

      if (oldTrip.coords !== coords) {
        filteredTrips.push({ coords, trip, name, id });
        setTrips(filteredTrips);
        await save(filteredTrips, sessionName + "_trips", STORAGE_TYPES.OBJECT);
        if (!free) {
          // Normal reroll: arm the cooldown. A free reroll skips this entirely
          // so the player can keep rerolling an unplaceable location.
          rerollTime.current = new Date();
          rerollTimer.current = setTimeout(() => {
            console.log("reroll is allowed again");
            handleReroll();
          }, REROLL_TIME * 1000);
        }
        setRefresh((prevState) => !prevState);
        setGenerating(false);
      } else if (loops > 5) {
        setGenerating(false);
        Alert.alert(
          "Reroll failed",
          "After 5 tries, the location could not be rerolled.\nLocation has not been changed and reroll is not on cooldown.",
          [
            {
              text: "OK",
              onPress: () => (rerollAllowedRef.current = true),
              style: "default",
            },
          ],
          { onDismiss: () => (rerollAllowedRef.current = true) },
        );
      } else {
        setGeneratingStatus(
          "Failed to reroll.\nRetrying. Attempt " + loops + " of " + 5,
        );
        rerollSelectedLocation(id, name, loops + 1, free);
      }
    }
  };

  const handleCheckedLocation = async (checkedLocations: readonly number[]) => {
    console.log("new checked locations", checkedLocations);
    if (checkedLocations !== null && checkedLocations.length > 0) {
      try {
        client.check([...checkedLocations]);
      } catch (e) {
        console.log("could not check locations");
      }
      const filteredTrips = removeCheckedLocations(trips, checkedLocations);
      if (!goalAchieved) handleGoal(client, filteredTrips, macguffinString);
      setTrips(filteredTrips);
      console.log("saving filtered trips...");
      if (sessionName && sessionName !== "") {
        await save(
          [...new Set(checkedLocations)],
          sessionName + "_checked",
          STORAGE_TYPES.OBJECT,
        );
      }
    }
  };

  const handleGoal = (
    client: Client,
    remainingTrips: trip[],
    macguffinString = "Archipela-Go!",
  ) => {
    const goal: number = parseInt(JSON.stringify(slotData.current?.goal), 10);
    switch (goal) {
      case GOAL_MAP.ALLSANITY:
        if (remainingTrips.length === 0) {
          sendGoal(client);
          setGoalAchieved(true);
        }
        break;
      case GOAL_MAP.SHORT_MACGUFFIN:
      case GOAL_MAP.LONG_MACGUFFIN:
        if (macguffinString.length === 0) {
          sendGoal(client);
          setGoalAchieved(true);
        }
        break;
      default:
        console.log("Goal not reached");
        break;
    }
  };

  const handleOfflineChecks = async () => {
    if (sessionName && sessionName !== "") {
      const loadedChecks = await load(
        sessionName + "_checked",
        STORAGE_TYPES.OBJECT,
      );
      if (loadedChecks !== null) {
        setCheckedLocations((prev) => [...new Set([...prev, ...loadedChecks])]);
      }
    }
  };

  const getCoordinatesForLocations = async () => {
    if (trips[0] !== "placeholder" || goalAchieved) {
      console.log("Trips found. Exiting coordinate loading...");
      return;
    }
    setGenerating(true);
    const location = await Location.getCurrentPositionAsync();
    const data =
      slotData.current ?? (await client.players.self.fetchSlotData());
    slotData.current = data;

    const loadedTrips: trip[] = await load(
      sessionName + "_trips",
      STORAGE_TYPES.OBJECT,
    );
    let filteredTrips: trip[];

    let loc = location.coords;
    if (USE_HOME_LOCATION) {
      loc.latitude = HOME_LOCATION.latitude;
      loc.longitude = HOME_LOCATION.longitude;
    }
    // Persist the generation origin ONCE per session so Respawn always anchors
    // to where the trips were generated — not to wherever the app was later
    // reopened. On a brand-new session this runs during first generation (loc is
    // the true origin); on later launches _origin already exists and is kept.
    if (sessionName && sessionName !== "") {
      const existingOrigin = await load(
        sessionName + "_origin",
        STORAGE_TYPES.OBJECT,
      );
      if (!existingOrigin) {
        await save(
          { latitude: loc.latitude, longitude: loc.longitude },
          sessionName + "_origin",
          STORAGE_TYPES.OBJECT,
        );
      }
    }
    const bannedLocations = await getBannedLocations();
    const bannedOsmIDs = new Set(
      bannedLocations
        .map((location) => location.osmID)
        .filter((osmID) => osmID.startsWith("N")),
    );
    setGeneratingStatus("Loading roads for the area...");
    const candidates = await loadOrFetchCandidates(
      { lat: loc.latitude, lon: loc.longitude },
      parseInt(JSON.stringify(data.maximum_distance), 10),
      bannedOsmIDs,
    );
    if (loadedTrips === null && data.trips != null) {
      let index = 0;
      const tripAmount = Object.entries(data.trips).length;
      setGeneratingStatus("No saved locations found. Starting generation...");
      const partialGeneration: trip[] = await load(
        sessionName + "_tempTrips",
        STORAGE_TYPES.OBJECT,
      );
      const tempTrips: trip[] = partialGeneration ?? [];
      // Road nodes already committed to a trip this session. Threaded into
      // getLocations so no two checks are placed on the same candidate. Seeded
      // from any resumed partial trips so a resume can't re-collide.
      const usedOsmIDs = new Set<string>(
        tempTrips
          .map((t) => t.coords.osmID)
          .filter((osmID) => osmID && osmID !== "0"),
      );
      const tracker = { tripGroup: 0, theta: Math.random() * 2 * Math.PI };
      for (const [name, trip] of Object.entries(data?.trips).sort(
        (a, b) => a[1].key_needed - b[1].key_needed,
      )) {
        index++;
        setGeneratingStatus(`Generating location ${index} of ${tripAmount}`);
        //Makes the slot data into an array that is sorted by key_needed...
        const id =
          client.package.findPackage("Archipela-Go!")?.locationTable[name];
        if (id == null) {
          // Only skip when the name has NO datapackage id at all (absent from
          // locationTable). Previously this was `if (!id)`, which also dropped a
          // location whose id is 0 — a valid AP id — silently removing one
          // reachable check and making the game uncompletable. `id == null`
          // keeps id 0; genuinely-unresolvable names are still surfaced here so
          // a slot-data/datapackage name mismatch can't hide.
          console.log(
            `[gen-drop] "${name}" skipped: no locationTable id (key_needed=${trip.key_needed})`,
          );
          continue;
        }
        if (client.room.checkedLocations.includes(id)) continue;
        if (
          partialGeneration !== null &&
          partialGeneration.findIndex((trip) => trip.id === id) !== -1
        )
          continue;
        if (trip.key_needed !== tracker.tripGroup) {
          tracker.tripGroup = trip.key_needed;
          tracker.theta = Math.random() * 2 * Math.PI; // .. so the theta can be changed when key_needed changes.
        }
        let generatingCoords = true;
        let coords = { lat: 0, lon: 0, osmID: "0", duplicate: false };
        let loopCount = 0;

        while (generatingCoords && !isDisconnecting.current) {
          if (!client.socket.connected) generatingCoords = false;

          coords = await getLocations(
            loc,
            parseInt(JSON.stringify(data.maximum_distance), 10),
            parseInt(JSON.stringify(data.minimum_distance), 10),
            parseInt(JSON.stringify(data.speed_requirement), 10),
            trip,
            NEAR_ZOOM,
            MAX_RADIAN,
            MIN_RADIAN,
            bannedOsmIDs,
            candidates,
            usedOsmIDs,
          );
          generatingCoords = tempTrips.some(
            (value) =>
              value.coords.lat === coords.lat &&
              value.coords.lon === coords.lon,
          );
          coords.duplicate = generatingCoords;
          console.log("Generated unique coordinates?", !generatingCoords);
          if (loopCount === LOCATION_RETRIES) generatingCoords = false;
          loopCount++;
        }

        if (coords.osmID === "0") {
          // [gen-place-fail] getLocations could not place this trip within its
          // annulus (no candidate in a thin near-start ring, or Overpass gave
          // up). It is pushed anyway at (0,0)/osmID "0" — an unreachable marker.
          console.log(
            `[gen-place-fail] "${name}" (id ${id}, key_needed ${trip.key_needed}) stuck at osmID "0"/(0,0) after ${loopCount} attempt(s)`,
          );
        }
        tempTrips.push({ coords, trip, name, id });
        if (coords.osmID && coords.osmID !== "0") usedOsmIDs.add(coords.osmID);
        await save(tempTrips, sessionName + "_tempTrips", STORAGE_TYPES.OBJECT);
        if (isDisconnecting.current) break;
      }
      setGeneratingStatus(
        "Locations generated. Filtering checked locations...",
      );
      filteredTrips = removeCheckedLocations(
        tempTrips,
        client.room.checkedLocations,
      );
    } else {
      setGeneratingStatus("Locations loaded. Filtering checked locations...");
      filteredTrips = removeCheckedLocations(
        loadedTrips,
        client.room.checkedLocations,
      );
    }
    if (isDisconnecting.current) return;

    // Await the re-rolls of any locations that failed to generate before we
    // publish the trips below. A forEach(async ...) here would be
    // fire-and-forget, so setTrips/geofenceLocations would run with the failed
    // (0,0 / osmID "0") coordinates still in place.
    // Track nodes already in use so recovery placements don't collide either.
    const recoveryUsedOsmIDs = new Set<string>(
      filteredTrips
        .map((t) => t.coords.osmID)
        .filter((osmID) => osmID && osmID !== "0"),
    );
    for (const trip of filteredTrips) {
      if (trip.coords.osmID === "0") {
        const newCoords = await getLocations(
          loc,
          parseInt(JSON.stringify(data.maximum_distance), 10),
          parseInt(JSON.stringify(data.minimum_distance), 10),
          parseInt(JSON.stringify(data.speed_requirement), 10),
          trip.trip,
          NEAR_ZOOM,
          MAX_RADIAN,
          MIN_RADIAN,
          bannedOsmIDs,
          candidates,
          recoveryUsedOsmIDs,
        );
        if (newCoords.osmID && newCoords.osmID !== "0")
          recoveryUsedOsmIDs.add(newCoords.osmID);
        newCoords.duplicate = filteredTrips.some(
          (value) =>
            value.coords.lat === newCoords.lat &&
            value.coords.lon === newCoords.lon,
        );
        trip.coords = newCoords;
      }
    }
    // [gen-summary] Quantifies "one less check location": how many trips slot
    // data defined vs how many we are actually publishing, and which (if any)
    // are stuck unreachable at osmID "0". Compare data.trips count against
    // published + already-checked to spot a silently-dropped location.
    const stuckTrips = filteredTrips.filter((t) => t.coords.osmID === "0");
    console.log(
      `[gen-summary] data.trips=${Object.keys(data.trips ?? {}).length}, ` +
        `published=${filteredTrips.length}, ` +
        `alreadyChecked=${client.room.checkedLocations.length}, ` +
        `stuckAtZero=${stuckTrips.length}`,
      stuckTrips.map((t) => t.name),
    );
    const keyAmount = client.items.received.map(
      (item) => item.id === MAP_ID_TO_ITEM.KEY,
    ).length;
    setTrips(filteredTrips);
    geofenceLocations(
      filteredTrips,
      client,
      keyAmount,
      receivedReductions,
      MARKER_RADIUS,
      locationEmitter.current,
    );
    if (sessionName && sessionName !== "") {
      setGeneratingStatus("Saving generated locations...");
      await save(filteredTrips, sessionName + "_trips", STORAGE_TYPES.OBJECT);
    }
    setGenerating(false);
    setTimeout(() => {
      setRefresh((prevState) => !prevState);
    }, 3000);
  };

  const roomUpdateListener = (packet: RoomUpdatePacket) => {
    if (packet.checked_locations !== undefined) {
      const roomCheckedLocations = packet.checked_locations; //Stops typescript from yelling at me
      setCheckedLocations((prev) => [
        ...new Set([...prev, ...roomCheckedLocations]),
      ]);
    }
  };

  const receivedItemsListener = async () => {
    console.log("starting message listener...");
    let index = -1;
    try {
      index = await load(sessionName + "_itemIndex", STORAGE_TYPES.NUMBER);
      console.log("loaded index", index);
    } catch {
      console.log("failed to load index");
    }
    const goal: number = parseInt(JSON.stringify(slotData.current?.goal), 10);

    console.log(
      "handling items, with ",
      client.items.received.length,
      "received and loaded index at",
      index,
    );
    const { keyAmount, distanceReductions, macguffinString } =
      await handleItems(client.items.received, client, goal, index);
    if (sessionName && sessionName !== "") {
      await save(
        client.items.count,
        sessionName + "_itemIndex",
        STORAGE_TYPES.NUMBER,
      );
    }
    setReceivedKeys(keyAmount);
    setReceivedReductions(distanceReductions);
    setMacguffinString(macguffinString);
  };

  const hintsReceivedListener = async (hint: Hint) => {
    if (hint.item.useful || hint.item.progression)
      setHintedProgTrips((prevState) => [...prevState, hint.item.locationId]);
  };

  const handleRefresh = () => {
    handleReconnect();
    setRefresh((prevState) => !prevState);
  };

  const applyDeathLinkTag = () => {
    if (!client.authenticated) return;
    if (deathLinkModeRef.current === DEATH_LINK_MODES.OFF) {
      client.deathLink.disableDeathLink();
    } else {
      client.deathLink.enableDeathLink();
    }
  };

  const startRespawnWatch = async () => {
    if (respawnWatch.current) return;
    const origin: { latitude: number; longitude: number } | null = await load(
      sessionName + "_origin",
      STORAGE_TYPES.OBJECT,
    );
    if (!origin) {
      console.log("No saved origin; cannot anchor respawn.");
      return;
    }
    respawnWatch.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 5 },
      (pos) => {
        if (metersBetween(pos.coords, origin) <= RESPAWN_RADIUS) {
          void clearRespawn();
        }
      },
    );
  };

  const clearRespawn = async () => {
    respawnWatch.current?.remove();
    respawnWatch.current = null;
    setRespawning(false);
    if (sessionName && sessionName !== "") {
      await save(
        { respawning: false },
        sessionName + "_respawning",
        STORAGE_TYPES.OBJECT,
      );
    }
    // Re-arming geofencing is handled by the [receivedKeys, trips, respawning]
    // effect once setRespawning(false) above takes effect (with fresh values).
    // Calling geofenceLocations() here would use stale mount-time closures.
  };

  const triggerRespawn = async (source: string, cause?: string) => {
    if (respawningRef.current) return;
    setRespawning(true);
    if (sessionName && sessionName !== "") {
      await save(
        { respawning: true },
        sessionName + "_respawning",
        STORAGE_TYPES.OBJECT,
      );
    }
    await removeGeofencing();
    await startRespawnWatch();
    const who = cause && cause.trim() ? cause.trim() : `${source} died.`;
    Alert.alert("DeathLink!", `${who}\n\nWalk back home to respawn.`);
  };

  const handleDeathReceived = (
    source: string,
    _time: number,
    cause?: string,
  ) => {
    const mode = deathLinkModeRef.current;
    if (mode === DEATH_LINK_MODES.OFF) return;
    if (goalAchievedRef.current) return;
    if (mode === DEATH_LINK_MODES.TRAP) {
      const trap = pickRandomTrap();
      const who = cause && cause.trim() ? cause.trim() : `${source} died.`;
      Alert.alert("DeathLink!", `${who}\n\nTrap received: ${trap}`);
      return;
    }
    if (mode === DEATH_LINK_MODES.RESPAWN) {
      triggerRespawn(source, cause);
    }
  };

  const handleReconnect = async () => {
    handleReroll();

    if (trips[0] !== "placeholder") {
      geofenceLocations(
        trips,
        client,
        receivedKeys,
        receivedReductions,
        MARKER_RADIUS,
        locationEmitter.current,
      );
    }
    await getCoordinatesForLocations();
    await handleOfflineChecks();
    await receivedItemsListener();

    const hints = client.items.hints;
    const hintedProgressionLocations = hints
      .filter(
        (hint) =>
          (hint.item.sender.slot === client.players.self.slot &&
            hint.item.progression) ||
          hint.item.useful,
      )
      .map((hint) => hint.item.locationId);
    setHintedProgTrips(hintedProgressionLocations);
    //handleOfflineItems(client.items.received, sessionName, client.items.count);
    if (!goalAchieved) handleGoal(client, trips, macguffinString);
  };

  const keepAwake = async () => {
    console.log("activated keep awake");
    await activateKeepAwakeAsync("generating");
  };

  const stopKeepAwake = async () => {
    console.log("deactivating keep awake");
    await deactivateKeepAwake("generating");
  };
  useEffect(() => {
    Location.getCurrentPositionAsync()
      .then((location) => setLocation(location))
      .catch((e) => console.log(e));

    client.players.self
      .fetchSlotData()
      .then((data) => {
        slotData.current = data;
      })
      .catch((e) => console.log(e));

    handleReconnect();
    client.socket.on("connected", handleReconnect);
    client.socket.on("roomUpdate", roomUpdateListener);
    client.socket.on("receivedItems", receivedItemsListener);
    client.items.on("hintReceived", hintsReceivedListener);
    locationEmitter.current.on("locationEntered", handleGeofenceEnter);
    client.socket.on("connected", applyDeathLinkTag);
    applyDeathLinkTag();
    client.deathLink.on("deathReceived", handleDeathReceived);

    load(sessionName + "_respawning", STORAGE_TYPES.OBJECT)
      .then((saved) => {
        if (saved?.respawning) {
          setRespawning(true);
          void startRespawnWatch();
        }
      })
      .catch((e) => console.log(e));

    console.log(
      "client.items.received.length",
      client.items.received.length,
      client.items.count,
    );

    const subscription = AppState.addEventListener("change", (nextAppState) => {
      console.log("app state changed. Next state is", nextAppState);
      if (nextAppState === "active") {
        handleReroll();
        const keyAmount = client.items.received.map(
          (item) => item.id === MAP_ID_TO_ITEM.KEY,
        ).length;
        geofenceLocations(
          trips,
          client,
          keyAmount,
          receivedReductions,
          MARKER_RADIUS,
          locationEmitter.current,
        );
      }
      appState.current = nextAppState;
    });
    return () => {
      subscription.remove();
      removeGeofencing();
      client.socket.off("connected", handleReconnect);
      client.socket.off("roomUpdate", roomUpdateListener);
      client.socket.off("receivedItems", receivedItemsListener);
      client.socket.off("connected", applyDeathLinkTag);
      client.deathLink.off("deathReceived", handleDeathReceived);
      if (rerollTimer.current != null) clearTimeout(rerollTimer.current);
      respawnWatch.current?.remove();
    };
  }, []);

  useEffect(() => {
    console.log("checkedLocations changed");
    handleCheckedLocation(checkedLocations);
  }, [checkedLocations]);

  useEffect(() => {
    if (trips.length === 0) {
      // don't do anything on first render
    } else {
      //TODO make this change geofencing
      //removeGeofencing();
    }
  }, [receivedReductions]);

  useEffect(() => {
    if (trips[0] === "placeholder" || respawning) {
      // don't arm geofencing on first render or while respawning
    } else {
      geofenceLocations(
        trips,
        client,
        receivedKeys,
        receivedReductions,
        MARKER_RADIUS,
        locationEmitter.current,
      );
    }
  }, [receivedKeys, trips, respawning]);

  useEffect(() => {
    setRefresh((prevState) => !prevState);
  }, [trips]);

  useEffect(() => {
    console.log("macguffinString changed to", macguffinString);
    if (!goalAchieved) handleGoal(client, trips, macguffinString);
  }, [macguffinString]);

  useEffect(() => {
    applyDeathLinkTag();
  }, [DEATH_LINK_MODE]);

  useEffect(() => {
    if (generating) keepAwake();
    else stopKeepAwake();
  }, [generating]);

  const insets = useSafeAreaInsets();
  return (
    <View style={mapStyles.container}>
      {respawning && (
        <View
          style={{
            position: "absolute",
            top: insets.top + 10,
            left: 0,
            right: 0,
            alignItems: "center",
            zIndex: 1200,
          }}
        >
          <View
            style={{
              backgroundColor: Theme.surface,
              borderWidth: 1,
              borderColor: Theme.danger,
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 6,
            }}
          >
            <Text style={{ color: Theme.textPrimary }}>
              You died — walk back home to respawn.
            </Text>
          </View>
        </View>
      )}
      <Pressable
        style={[mapStyles.refreshButton, { top: insets.top + 10 }]}
        onPress={() => {
          handleRefresh();
        }}
        disabled={generating}
      >
        <View>
          <FontAwesome name="refresh" size={24} color={Theme.accentBright} />
        </View>
      </Pressable>
      <Pressable
        style={[mapStyles.apButton, { top: insets.top + 10 }]}
        onPress={() => {
          setShowAPPopup(true);
        }}
        disabled={generating}
      >
        <Ionicons name="planet" size={22} color={Theme.accentBright} />
      </Pressable>
      {__DEV__ && (
        <Pressable
          style={[mapStyles.refreshButton, { top: insets.top + 60 }]}
          onPress={() => {
            // BROADCAST a DeathLink to every other DeathLink-enabled player so
            // we can verify cross-device death on a second phone. The previous
            // handler only replayed the *receive* path locally, so nothing ever
            // left this client. sendDeathLink silently no-ops unless the tag is
            // set, so enable it first — the mode (OFF/RESPAWN/TRAP) only governs
            // what we do when RECEIVING, not whether we can send.
            const self = client.players.self.alias;
            client.deathLink.enableDeathLink();
            client.deathLink.sendDeathLink(self, `${self} was hit by a car.`);
            console.log(`[deathlink-dev] sent DeathLink as "${self}"`);
          }}
        >
          <MaterialCommunityIcons name="skull" size={22} color={Theme.danger} />
        </Pressable>
      )}
      <LocationInfoPopup
        visible={showPopup}
        closePopup={closePopup}
        location={selectedLocation}
        client={client}
        receivedKeys={receivedKeys}
        rerollSelectedLocation={rerollSelectedLocation}
        rerollAllowed={rerollAllowedRef}
        rerollTime={rerollTime}
        setLocationAsFound={handleGeofenceEnter}
        respawning={respawning}
      />
      <APInfoPopup
        visible={showAPPopup}
        closePopup={() => setShowAPPopup(false)}
        goalMode={parseInt(JSON.stringify(slotData.current?.goal), 10)}
        goalString={macguffinString}
        amountOfKeys={receivedKeys}
        remainingTrips={trips.length}
      />

      {generating && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1100,
            backgroundColor: "#00000050",
          }}
        >
          <View
            style={{
              ...commonStyles.modalView,
              zIndex: 1000,
            }}
          >
            <ActivityIndicator size="large" />
            <Text style={{ marginTop: 10, color: Theme.textPrimary }}>
              {generatingStatus}
            </Text>
          </View>
        </View>
      )}
      <MemoizedMap
        location={location}
        USE_HOME_LOCATION={USE_HOME_LOCATION}
        HOME_LOCATION={HOME_LOCATION}
      >
        <APMarkers
          trips={trips}
          receivedKeys={receivedKeys}
          handleShowPopup={handleShowPopup}
          hintedProgTrips={hintedProgTrips}
          refresh={refresh}
        />
        {USE_HOME_LOCATION && (
          <Marker coordinate={HOME_LOCATION} tracksViewChanges={false}>
            <MaterialCommunityIcons
              color={Colors.playerSelf}
              name="map-marker-account"
              size={50}
            />
          </Marker>
        )}
      </MemoizedMap>
    </View>
  );
}
