# DeathLink Support (Off / Respawn / Trap)

**Date:** 2026-07-02
**Status:** Draft — pending review (Unix for gameplay-intent bits, Stephen as repo owner)
**App:** Archipela-Go! (Expo managed, React Native 0.81, React 19)

## Goal

Add DeathLink support to the mobile client. DeathLink is an Archipelago cross-game
feature: clients that opt in add the `"DeathLink"` tag; when any opted-in player "dies",
the server broadcasts it (Bounce/Bounced) and every other opted-in client reacts.

The app offers three modes: **Off**, **Respawn**, **Trap**.

## Confirmed decisions (all from Unix)

- **Receive-only.** A GPS walking game has no detectable "death" to broadcast, so the app
  never *sends* DeathLinks — it only reacts to incoming ones.
- **No "Follow Slot".** The `apgo` apworld (0.7.0) does **not** put `death_link` in
  slot_data (only `goal`, `minimum_distance`, `maximum_distance`, `speed_requirement`,
  `trips`), so the app can't read the slot's DeathLink toggle. DeathLink is a purely
  **client-side** setting. The missing slot_data key is simply ignored.
- **Trap = announce only.** All 8 trap items are honor-system (even the nominally
  "app-based" Shuffle/Silence/Fog traps have no implementation — `handleTrap()` is an
  empty stub). Trap mode picks a random trap and **shows an alert naming it**; it does not
  implement any trap effect.
- **Respawn anchors to the generation origin** (see below), not to the Home Location
  setting alone.
- Protocol is already handled by `archipelago.js` v2.0.4's `DeathLinkManager`
  (`client.deathLink`): `enableDeathLink()` / `disableDeathLink()` (manage the tag via
  `ConnectUpdate`), `on("deathReceived", (source, time, cause) => …)`.

## Setting + a new segmented control

- New setting **`DEATH_LINK_MODE`** with values **Off** (default) / **Respawn** / **Trap**.
- The settings screen (`screens/Settings.tsx` → `SettingItem`) currently infers its
  control purely from the value type (string → text field, number → numeric, boolean →
  switch). An enum needs a new control. Add an optional **`options?: { label: string;
  value: string }[]`** field to the `Settings` type (`components/SettingsContext.tsx`);
  when present, `SettingItem` renders a **segmented picker** instead of a text field.
- This segmented control is deliberately generic — the deferred Most Roads / Closest Roads
  gen-filter setting will reuse it.

## Behavior

### Tag management
- On connect and whenever `DEATH_LINK_MODE` changes while connected:
  `mode !== "Off"` → `client.deathLink.enableDeathLink()`; else `disableDeathLink()`.
- Re-apply on every reconnect — `client.login()` rebuilds the tag list, so the tag must be
  set again after each successful (re)connection (hook into the existing
  `client.socket.on("connected", …)` in `MapScreen`/`Connected`).

### Receiving a death
`client.deathLink.on("deathReceived", handler)` (the manager de-duplicates by timestamp).
Ignore incoming deaths when `mode === "Off"` (belt-and-suspenders; the tag also won't be
set). Ignore if the goal is already achieved.

### Respawn mode
- On death → enter a **persisted "respawning" state** (`sessionName + "_respawning"`), so
  it survives app restart.
- While respawning:
  - Stop geofencing (`removeGeofencing`) and skip re-arming it.
  - Block collection: the `LocationInfoPopup` "Check location" button is disabled/hidden,
    **including** the `CAN_ALWAYS_SEND_LOCATION` cheat path, and auto-send is suppressed.
  - Show a banner on the map ("You died — walk back home to respawn").
- **Generation origin** = the origin used when this session's trips were generated: the
  GPS position at generation time, or `HOME_LOCATION` when `USE_HOME_LOCATION` is on.
  Capture it in `getCoordinatesForLocations` and persist as `sessionName + "_origin"`.
  Home Location, when set, overrides.
- **Clearing:** using the position the app already watches, when the player comes within
  **`RESPAWN_RADIUS`** of the origin, clear the respawning state, re-enable collection, and
  re-arm geofencing. `RESPAWN_RADIUS` defaults to `MARKER_RADIUS` for now (a dedicated
  setting can be added later if desired).
- Deaths received while already respawning are ignored (no stacking).

### Trap mode
- On death → pick one of the 8 traps uniformly at random and show an `Alert` naming it,
  e.g. *"DeathLink! Trap received: Push-Up Trap."* Use the trap item names
  (`Shuffle/Silence/Fog Of War/Push Up/Socializing/Sit Up/Jumping Jack/Touch Grass Trap`).
  Reuse the name table in `utils/handleItems.ts`. No state change, no lock.

### Off mode
- Don't set the tag; ignore any deaths.

## Files touched
- `components/SettingsContext.tsx` — add `DEATH_LINK_MODE` default; add `options` to the
  `Settings` type; ensure enum load/save works (value is a string).
- `screens/Settings.tsx` — render a segmented control when `setting.options` is present.
- `screens/MapScreen.tsx` — DeathLink wiring: enable/disable tag on connect + setting
  change; `deathReceived` handler; respawning state (persist/load, banner, block
  geofencing + collection, origin capture + proximity clear).
- `components/LocationInfoPopup.tsx` — disable the check/send buttons while respawning.
- (Maybe) `utils/handleItems.ts` — export a trap-name list / helper for Trap mode.

## Testing / verification
- **Tag:** selecting Respawn/Trap while connected adds `"DeathLink"` (verify via
  `client.arguments.tags` / server); switching to Off removes it; tag re-applies after a
  reconnect.
- **Respawn:** simulate `deathReceived` → checks lock, collection disabled (incl. cheat),
  banner shows, state persists across an app restart; walking within `RESPAWN_RADIUS` of the
  persisted origin clears it and re-enables everything.
- **Trap:** simulate `deathReceived` → an alert names a random trap; no lock; repeated
  deaths keep announcing.
- **Off:** no tag set; simulated deaths do nothing.
- **Edge:** death after goal achieved → ignored; death while disconnected → n/a (deaths
  only arrive while connected).

## Out of scope
- Sending DeathLinks. Trap *effects* (Shuffle/Silence/Fog implementations). Reading the
  slot's DeathLink setting / "Follow Slot" (blocked until the apworld forwards
  `death_link` in slot_data).
