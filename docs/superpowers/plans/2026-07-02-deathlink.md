# DeathLink Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add receive-only DeathLink support with three client-side modes — Off, Respawn, Trap — to the Archipela-Go! mobile client.

**Architecture:** A new segmented setting (`DEATH_LINK_MODE`) drives whether the `"DeathLink"` tag is set on the archipelago.js client. `MapScreen` listens for `client.deathLink`'s `deathReceived` event. Trap mode announces a random honor-system trap; Respawn mode locks all checks + collection and persists that state until the player walks back within range of the session's generation origin. Pure helpers live in `utils/deathLink.ts`.

**Tech Stack:** Expo (managed) / React Native 0.81 / React 19 / TypeScript, `archipelago.js` 2.0.4 (`DeathLinkManager`), `expo-location`, `@react-native-async-storage/async-storage` (via `utils/storageHandler.ts`).

## Global Constraints

- **Receive-only.** Never call `client.deathLink.sendDeathLink(...)`. The app only reacts to incoming deaths.
- **No "Follow Slot".** `DEATH_LINK_MODE` is purely client-side; do not read `death_link` from slot_data (apgo 0.7.0 doesn't send it).
- **Trap = announce only.** Show an alert naming a random trap; implement no trap effect.
- **Preserve existing behavior.** Do not change generation, existing settings, or the collection flow except where this plan specifies.
- **No test framework in this repo.** Verify each task with `npx tsc --noEmit`, `npm run lint`, and manual on-device checks. There are no jest/unit tests to write.
- **Respawn anchors to the generation origin**, persisted per session; the Home Location setting (when `USE_HOME_LOCATION`) is that origin.
- **Modes are the string constants** `"OFF"` / `"RESPAWN"` / `"TRAP"` (default `"OFF"`).

## Manual verification harness

- **Dev trigger (built in Task 3):** a `__DEV__`-only button on the map that calls the death handler with fake data — lets you exercise Trap/Respawn without a real sender.
- **Real sender (Unix):** a second test world (e.g. Balatro) that can send real deaths, to confirm the true Bounce/Bounced path and the `"DeathLink"` tag end-to-end.

## File Structure

- **Create** `utils/deathLink.ts` — pure helpers: mode constants/type, trap-name list, `pickRandomTrap()`, `metersBetween()`.
- **Modify** `components/SettingsContext.tsx` — add `options?` to the `Settings` type; add the `DEATH_LINK_MODE` default setting.
- **Modify** `screens/Settings.tsx` — render a segmented control when a setting has `options`.
- **Modify** `screens/MapScreen.tsx` — tag management, `deathReceived` handler, Trap alert, dev trigger, Respawn state/lock/banner/origin capture/proximity clear.
- **Modify** `components/LocationInfoPopup.tsx` — disable the check button while respawning.

---

### Task 1: Segmented setting control + `DEATH_LINK_MODE`

**Files:**
- Modify: `components/SettingsContext.tsx`
- Modify: `screens/Settings.tsx`

**Interfaces:**
- Produces: a new setting `DEATH_LINK_MODE` (string, default `"OFF"`) readable via `getSetting("DEATH_LINK_MODE", "string")`; the `Settings` type gains `options?: { label: string; value: string }[]`.

- [ ] **Step 1: Add `options` to the `Settings` type**

In `components/SettingsContext.tsx`, add a field to the `Settings` type (after `minValue`):

```ts
  /**
   * Only used for enum settings. When present, the setting renders as a
   * segmented control choosing between these options (value is a string).
   */
  options?: { label: string; value: string }[];
```

- [ ] **Step 2: Add the `DEATH_LINK_MODE` default setting**

In `components/SettingsContext.tsx`, add this entry to the `defaultSettings` array (place it after `AUTOMATIC_SENDING`):

```ts
  {
    name: "DEATH_LINK_MODE",
    displayName: "DeathLink",
    description:
      "How the app reacts when another player in a DeathLink game dies." +
      "\nOff: DeathLink is disabled." +
      "\nRespawn: all checks lock and collection is disabled until you walk back to where your locations were generated." +
      "\nTrap: a random trap is announced (honor system)." +
      "\nDefault: Off",
    value: "OFF",
    options: [
      { label: "Off", value: "OFF" },
      { label: "Respawn", value: "RESPAWN" },
      { label: "Trap", value: "TRAP" },
    ],
  },
```

- [ ] **Step 3: Render a segmented control for enum settings**

In `screens/Settings.tsx`, inside `SettingItem`, add this branch **before** the `typeof setting.value === "string"` branch:

```tsx
  if (setting.options) {
    return (
      <View style={styles.segment}>
        {setting.options.map((opt) => {
          const selected = settingState === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => {
                setSettingState(opt.value);
                onChange(opt.value, setting.name);
              }}
              style={[styles.segmentItem, selected && styles.segmentItemActive]}
            >
              <Text
                style={[
                  styles.segmentText,
                  selected && styles.segmentTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }
```

Then add these keys to the `StyleSheet.create({...})` at the bottom of `screens/Settings.tsx`:

```ts
  segment: {
    flexDirection: "row",
    borderRadius: Theme.radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Theme.glassBorder,
    backgroundColor: Theme.glassFill,
    overflow: "hidden",
  },
  segmentItem: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  segmentItemActive: {
    backgroundColor: Theme.accent,
  },
  segmentText: {
    fontSize: 14,
    color: Theme.textSecondary,
  },
  segmentTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
```

`Pressable` and `View` and `Text` are already imported in `screens/Settings.tsx`.

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors related to `SettingsContext.tsx` or `Settings.tsx`.

- [ ] **Step 5: Manual verification**

Run the app (`npm run android` or `npm run ios`), open Settings → Preferences. Expected: a "DeathLink" row with a 3-way **Off / Respawn / Trap** segmented control, defaulting to Off. Tap Respawn, force-quit and reopen the app, reopen Settings → it still shows Respawn (persisted). Set it back to Off.

- [ ] **Step 6: Commit**

```bash
git add components/SettingsContext.tsx screens/Settings.tsx
git commit -m "feat(deathlink): add DEATH_LINK_MODE setting + segmented control"
```

---

### Task 2: DeathLink helpers + tag management

**Files:**
- Create: `utils/deathLink.ts`
- Modify: `screens/MapScreen.tsx`

**Interfaces:**
- Produces: `utils/deathLink.ts` exporting `DEATH_LINK_MODES`, `DeathLinkMode`, `TRAP_NAMES`, `pickRandomTrap(): string`, `metersBetween(a, b): number`.
- Consumes: `client.deathLink.enableDeathLink()` / `disableDeathLink()` (archipelago.js), `client.authenticated`, `getSetting("DEATH_LINK_MODE", "string")`.

- [ ] **Step 1: Create `utils/deathLink.ts`**

```ts
import { getDistanceFromLatLonInKm } from "./getLocations";

export const DEATH_LINK_MODES = {
  OFF: "OFF",
  RESPAWN: "RESPAWN",
  TRAP: "TRAP",
} as const;

export type DeathLinkMode =
  (typeof DEATH_LINK_MODES)[keyof typeof DEATH_LINK_MODES];

/** Display names of the 8 Archipela-Go! trap items (all honor-system). */
export const TRAP_NAMES = [
  "Shuffle Trap",
  "Silence Trap",
  "Fog Of War Trap",
  "Push Up Trap",
  "Socializing Trap",
  "Sit Up Trap",
  "Jumping Jack Trap",
  "Touch Grass Trap",
] as const;

/** Pick a random trap display name to announce on a DeathLink (Trap mode). */
export function pickRandomTrap(): string {
  return TRAP_NAMES[Math.floor(Math.random() * TRAP_NAMES.length)];
}

/** Great-circle distance in meters between two lat/lon points. */
export function metersBetween(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  return (
    getDistanceFromLatLonInKm(
      a.latitude,
      a.longitude,
      b.latitude,
      b.longitude,
    ) * 1000
  );
}
```

- [ ] **Step 2: Read the mode and keep a fresh ref in `MapScreen`**

In `screens/MapScreen.tsx`, add the import near the other util imports:

```ts
import {
  DEATH_LINK_MODES,
  DeathLinkMode,
  pickRandomTrap,
  metersBetween,
} from "../utils/deathLink";
```

Inside `MapScreen`, next to the other `getSetting` calls (after `USE_HOME_LOCATION`):

```ts
  const DEATH_LINK_MODE = getSetting(
    "DEATH_LINK_MODE",
    "string",
  ) as DeathLinkMode;
```

Then, next to the other `useRef` declarations (near `slotData`), add a ref that tracks the current mode so long-lived listeners never read a stale value:

```ts
  const deathLinkModeRef = useRef<DeathLinkMode>(DEATH_LINK_MODE);
  deathLinkModeRef.current = DEATH_LINK_MODE;
```

- [ ] **Step 3: Add the tag-apply function and wire it to connect + mode changes**

In `screens/MapScreen.tsx`, add this function inside `MapScreen` (near `handleReconnect`):

```ts
  const applyDeathLinkTag = () => {
    if (!client.authenticated) return;
    if (deathLinkModeRef.current === DEATH_LINK_MODES.OFF) {
      client.deathLink.disableDeathLink();
    } else {
      client.deathLink.enableDeathLink();
    }
  };
```

In the mount `useEffect` (the one that registers `client.socket.on("connected", handleReconnect)`), add a listener and an initial apply. Add next to the other `client.socket.on(...)` calls:

```ts
    client.socket.on("connected", applyDeathLinkTag);
    applyDeathLinkTag();
```

In that same `useEffect`'s cleanup `return () => { ... }`, add:

```ts
      client.socket.off("connected", applyDeathLinkTag);
```

Then add a separate `useEffect` (near the other small effects, e.g. after the `[macguffinString]` effect) so changing the mode mid-session re-applies the tag:

```ts
  useEffect(() => {
    applyDeathLinkTag();
  }, [DEATH_LINK_MODE]);
```

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors. (`pickRandomTrap`/`metersBetween` are unused until Task 3–4; if `npm run lint` flags them as unused, that's expected and resolved in the next tasks — do not delete them.)

- [ ] **Step 5: Manual verification**

Set DeathLink to **Trap** in Settings, connect to a server. In the JS debugger console, run `client.arguments.tags` (or add a temporary `console.log(client.arguments.tags)` in `applyDeathLinkTag`). Expected: the array includes `"DeathLink"`. Set the mode to **Off** and reconnect → `"DeathLink"` is absent. If you have the Balatro test world connected, its DeathLink player list should now show/hide this slot accordingly.

- [ ] **Step 6: Commit**

```bash
git add utils/deathLink.ts screens/MapScreen.tsx
git commit -m "feat(deathlink): helpers + set/clear DeathLink tag on connect and mode change"
```

---

### Task 3: Receive deaths, Trap mode, and the dev trigger

**Files:**
- Modify: `screens/MapScreen.tsx`

**Interfaces:**
- Consumes: `client.deathLink.on("deathReceived", handler)` / `.off(...)`; handler signature `(source: string, time: number, cause?: string) => void`; `pickRandomTrap()`; `goalAchieved` state.
- Produces: `handleDeathReceived(source, time, cause)` used by the real event and the dev trigger; a placeholder `triggerRespawn(source, cause)` that Task 4 fills in.

- [ ] **Step 1: Add a fresh ref for `goalAchieved`**

In `screens/MapScreen.tsx`, right after the `goalAchieved` state declaration, add:

```ts
  const goalAchievedRef = useRef(goalAchieved);
  goalAchievedRef.current = goalAchieved;
```

- [ ] **Step 2: Add the death handler (with a Respawn placeholder)**

In `screens/MapScreen.tsx`, add inside `MapScreen`:

```ts
  // Filled in by Task 4. Kept as a no-op stub so Trap mode ships independently.
  const triggerRespawn = (_source: string, _cause?: string) => {
    console.log("Respawn mode not yet implemented");
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
```

- [ ] **Step 3: Register/unregister the death listener**

In the mount `useEffect`, next to the other listener registrations, add:

```ts
    client.deathLink.on("deathReceived", handleDeathReceived);
```

In that effect's cleanup, add:

```ts
      client.deathLink.off("deathReceived", handleDeathReceived);
```

- [ ] **Step 4: Add the `__DEV__` dev-trigger button**

In `screens/MapScreen.tsx`'s returned JSX, next to the existing `apButton` `Pressable`, add:

```tsx
      {__DEV__ && (
        <Pressable
          style={[mapStyles.refreshButton, { top: insets.top + 60 }]}
          onPress={() =>
            handleDeathReceived("TEST", Date.now(), "Test death (dev trigger)")
          }
        >
          <MaterialCommunityIcons
            name="skull"
            size={22}
            color={Theme.danger}
          />
        </Pressable>
      )}
```

`MaterialCommunityIcons` and `Pressable` are already imported in `screens/MapScreen.tsx`.

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors. (`metersBetween` may still lint as unused until Task 4 — expected.)

- [ ] **Step 6: Manual verification**

Run the app, set DeathLink to **Trap**, connect, open the Map tab. Tap the dev skull button. Expected: an "DeathLink!" alert naming a random trap (e.g. "Trap received: Sit Up Trap"). Tap it several times → the trap name varies. Set mode to **Off**, tap the skull → no alert. If the Balatro world is available, send a real death from it → the same Trap alert appears.

- [ ] **Step 7: Commit**

```bash
git add screens/MapScreen.tsx
git commit -m "feat(deathlink): receive deaths, Trap-mode announcement, dev trigger"
```

---

### Task 4: Respawn mode — lock, origin capture, proximity clear

**Files:**
- Modify: `screens/MapScreen.tsx`
- Modify: `components/LocationInfoPopup.tsx`

**Interfaces:**
- Consumes: `metersBetween()`; `Location.watchPositionAsync`; `save`/`load` with keys `sessionName + "_origin"` and `sessionName + "_respawning"`; `removeGeofencing()`, `geofenceLocations(...)`, `handleGeofenceEnter`.
- Produces: real `triggerRespawn`; `respawning` state passed to `LocationInfoPopup` as `respawning: boolean`.

- [ ] **Step 1: Add respawn state + refs**

In `screens/MapScreen.tsx`, add near the other `useState` calls:

```ts
  const [respawning, setRespawning] = useState(false);
```

Add near the other refs:

```ts
  const respawningRef = useRef(false);
  respawningRef.current = respawning;
  const respawnWatch = useRef<Location.LocationSubscription | null>(null);
```

Add a radius constant near where `MARKER_RADIUS` is read (reuse the marker radius):

```ts
  const RESPAWN_RADIUS = MARKER_RADIUS;
```

- [ ] **Step 2: Persist the generation origin**

In `getCoordinatesForLocations`, immediately after the block that computes `loc` (right after the `if (USE_HOME_LOCATION) { ... }` that sets `loc.latitude/longitude`), add:

```ts
    if (sessionName && sessionName !== "") {
      await save(
        { latitude: loc.latitude, longitude: loc.longitude },
        sessionName + "_origin",
        STORAGE_TYPES.OBJECT,
      );
    }
```

- [ ] **Step 3: Implement the respawn watch + clear**

In `screens/MapScreen.tsx`, add these functions inside `MapScreen`:

```ts
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
    geofenceLocations(
      trips,
      client,
      receivedKeys,
      receivedReductions,
      MARKER_RADIUS,
      locationEmitter.current,
    );
  };
```

- [ ] **Step 4: Fill in `triggerRespawn` (replace the Task 3 stub)**

Replace the placeholder `triggerRespawn` from Task 3 with:

```ts
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
```

Because `triggerRespawn` is now `async`, no caller needs to await it (fire-and-forget from `handleDeathReceived` is fine).

- [ ] **Step 5: Block collection while respawning**

In `screens/MapScreen.tsx`, guard the geofence-enter handler — change `handleGeofenceEnter` to:

```ts
  const handleGeofenceEnter = (id: number) => {
    if (respawningRef.current) {
      console.log("Ignoring geofence enter while respawning", id);
      return;
    }
    console.log("handleGeofenceEnter id", id);
    setCheckedLocations((prev) => [...prev, id]);
  };
```

Guard the geofence-arming effect so it does not re-arm while respawning — change the `useEffect` with deps `[receivedKeys, trips]` so its body only arms when `!respawning`:

```ts
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
```

Pass `respawning` into the popup — update the `<LocationInfoPopup ... />` JSX to add the prop:

```tsx
        respawning={respawning}
```

- [ ] **Step 6: Restore respawn state on mount + clean up the watch**

In the mount `useEffect`, after the listener registrations, add a restore call:

```ts
    load(sessionName + "_respawning", STORAGE_TYPES.OBJECT)
      .then((saved) => {
        if (saved?.respawning) {
          setRespawning(true);
          void startRespawnWatch();
        }
      })
      .catch((e) => console.log(e));
```

In that effect's cleanup `return () => { ... }`, add:

```ts
      respawnWatch.current?.remove();
```

- [ ] **Step 7: Add the respawn banner**

In `screens/MapScreen.tsx`'s returned JSX, add just inside the outer `<View style={mapStyles.container}>` (near the top, before the refresh button) :

```tsx
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
```

- [ ] **Step 8: Block the manual check button in the popup**

In `components/LocationInfoPopup.tsx`, add `respawning` to the component props type and destructure it:

```ts
  respawning,
```

and in the `Readonly<{ ... }>` prop type add:

```ts
  respawning: boolean;
```

At the top of `handleCheckLocation`, add an early guard:

```ts
    if (respawning) {
      Alert.alert("You died", "Walk back home to respawn before collecting.");
      return;
    }
```

Wrap the "Check location" button so it's hidden while respawning — change its render condition from:

```tsx
          {(getSetting("CAN_ALWAYS_SEND_LOCATION", "boolean") ||
            receivedKeys >= locationInfo.keysNeeded) && (
```

to:

```tsx
          {!respawning &&
            (getSetting("CAN_ALWAYS_SEND_LOCATION", "boolean") ||
              receivedKeys >= locationInfo.keysNeeded) && (
```

- [ ] **Step 9: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors, and no remaining "unused" warnings for `metersBetween`.

- [ ] **Step 10: Manual verification**

Run the app, set DeathLink to **Respawn**, connect, and let locations generate (this saves the origin). Tap the dev skull button. Expected:
1. A "DeathLink!" alert, then a persistent "You died — walk back home to respawn" banner.
2. The map markers stop auto-collecting; opening a location popup shows **no** "Check location" button (and the cheat send is blocked).
3. Force-quit and reopen the app → still respawning (banner persists).
4. Physically move within `MARKER_RADIUS` of the generation origin (or, on emulator, set a mock location at the origin) → the banner clears, geofencing re-arms, and collection works again.

Then confirm with the Balatro world: send a real death → same Respawn lock; walking home clears it.

- [ ] **Step 11: Commit**

```bash
git add screens/MapScreen.tsx components/LocationInfoPopup.tsx
git commit -m "feat(deathlink): Respawn mode — lock checks/collection until back at origin"
```

---

## Self-Review notes

- **Spec coverage:** setting + segmented control (Task 1); tag set/clear on connect + change, receive-only (Task 2); receive handler + Trap announce + dev trigger (Task 3); Respawn lock/collection-block/origin-capture/proximity-clear/persistence/banner + popup block (Task 4). All spec sections mapped.
- **Stale-closure safety:** long-lived listeners read `deathLinkModeRef` / `goalAchievedRef` / `respawningRef`, not captured render values.
- **Known repo quirk:** `handleSettingChange` mutates the settings array in place (same reference), so a mid-session mode change may not re-render `MapScreen` immediately; the `[DEATH_LINK_MODE]` effect and the per-render ref update cover the common flow, and the tag is always re-applied on (re)connect. Not worth changing the shared settings mechanism in this plan.
- **Types:** `DeathLinkMode` used consistently; `metersBetween`/`pickRandomTrap` signatures match their call sites; origin persisted/loaded as `{ latitude, longitude }`.
