# Deep Glass — Dark Mode Redesign

**Date:** 2026-07-02
**Status:** Approved (direction), pending spec review
**App:** Archipela-Go! (Expo managed, React Native 0.81, React 19)

## Goal

Redesign the app's visual identity to match the latest iOS "liquid glass" aesthetic:
a **deep & moody dark theme** with **near-black surfaces**, **heavy frosted glass**
panels, and **electric purple** highlights. Remove decorative logos and introduce a
recurring motif of **pulsing purple dots**. Move navigation from top tabs to **floating
bottom glass tab bars**. Replace the generic PNG map markers with **custom sci-fi
glowing "energy node" markers**.

This is a visual redesign only — no gameplay, networking, or data-model changes.

## Confirmed decisions

- **Feel:** Deep & moody — near-black backgrounds, heavy frosted blur, vivid electric purple.
- **Pulsing dots:** Ambient accent — a recurring decorative motif across screens.
- **Bottom tabs:** Both navigators (Connect/Saved/Settings and Chat/Map/Hints) move to bottom glass tab bars.
- **Glass:** Add `expo-blur` for authentic frosted glass. Requires a native rebuild.
- **Logos:** Remove/replace in-app decorative logos; **keep** the `APLicense` attribution images (legal credit to the Archipelago project). App icon & splash left unchanged for now.
- **Map markers:** Replace PNG markers with custom SVG sci-fi markers.

## Design tokens

New file `styles/Theme.tsx` — single source of truth for UI (surface/text/accent) tokens.
`styles/Colors.tsx` (semantic *game* colors — player colors, item classification) stays,
with the few values used as UI text/background re-pointed to read on dark.

Token groups (final hex values chosen during implementation, in this range):

- **Surfaces:** `bg` near-black (~`#08080C`), `bgElevated` (~`#111018`), `glassFill` (`rgba(255,255,255,0.06)`), `glassBorder` (`rgba(255,255,255,0.12)`).
- **Text:** `textPrimary` (~`#F5F3FF`), `textSecondary` (~`rgba(245,243,255,0.66)`), `textTertiary` (~`rgba(245,243,255,0.40)`).
- **Purple accent ramp:** `accent` electric (~`#B026FF`/`#A855F7`), `accentDim`, `accentGlow` (shadow/glow color).
- **Status (dark-tuned):** success/green, danger/red, warning/amber — replacing inline `darkgreen`/`darkred`.
- **Scale constants:** radii (card/pill/field), spacing, blur intensity, glow shadow presets.

## New components

Under `components/glass/`:

- **`GlassSurface.tsx`** — the reusable frosted panel. Wraps `expo-blur` `BlurView`
  (`tint="dark"`, high intensity) with an overlay `View` for tint fill, border, and
  radius. Props: `intensity?`, `style?`, `radius?`, `bordered?`. Used by nav bars,
  cards, popups, and input fields.
- **`PulsingDot.tsx`** — a single purple dot that pulses (scale + opacity loop via RN's
  built-in `Animated`, `useNativeDriver: true`, soft glow via shadow). Props: `size?`,
  `color?`, `duration?`, `delay?`.
- **`AmbientDots.tsx`** — an absolutely-positioned background layer scattering several
  `PulsingDot`s at varied sizes/positions/delays, low opacity, behind content. The
  recurring motif; dropped into key screens.
- **`GlassMarker.tsx`** — SVG sci-fi map marker (react-native-svg). A glowing glass core
  with a concentric neon rim in the marker's status color, an outer glow halo, and a
  pulsing ring on active/hint markers. Replaces the PNG markers in `APMarkers.tsx`.

Existing `components/Button.tsx` restyled to a glass/purple button (or wrapping
`GlassSurface`).

## Navigation

Add `@react-navigation/bottom-tabs` (JS-only, no native rebuild). Replace both
`createMaterialTopTabNavigator` usages:

- `screens/ConnectTabs.tsx` → bottom tabs: Connect / Saved / Settings.
- `screens/Connected.tsx` → bottom tabs: Chat / Map / Hints.

Tab bar: transparent bar with `tabBarBackground` = `GlassSurface`/`BlurView`, floating
pill look (bottom margin + radius + glow), purple active icon+label with glow, muted
inactive, vector icons from `@expo/vector-icons` (Connect: link, Saved: bookmark,
Settings: gear, Chat: message, Map: map, Hints: bulb).

`App.tsx`: `NavigationContainer` gets a dark theme (near-black background — no white
flashes on transitions); `StatusBar` changed from `"dark"` to `"light"`.

Trade-off noted: bottom tabs remove the top-tab swipe gesture between Chat/Map/Hints.
Acceptable — matches native iOS behavior.

## Screen restyle sweep

Repoint every hardcoded `#fff` / `white` / `black` / `rgba(51,51,51,1)` and inline color
to `Theme` tokens:

- Style files: `MainStyles`, `CommonStyles`, `MapStyles`, `settingsStyles`, `ChatStyles`, `ErrorStyles`.
- Local `StyleSheet.create` blocks in `Settings.tsx`, `APInfoPopup.tsx`, `APLicense.tsx`.
- Heavy inline blocks: `BannedLocations.tsx` (~22), `HintsScreen.tsx` (~7), `LocationInfoPopup.tsx` (~10), `SavedInfo.tsx` (~4). Replace inline `darkgreen`/`darkred` with theme status colors.
- Inputs → dark glass fields; buttons → purple/glass; modals/popups (`Popup`, `APInfoPopup`, `LocationInfoPopup`, `APConnectionInfo`, `APLicense`) → `GlassSurface`.
- **Map:** apply a dark `customMapStyle` to `react-native-maps` so the map matches the theme; gameplay markers become `GlassMarker`s.

## Logo removal

- `MapScreen.tsx` AP button (`black-icon.png` `Image`) → glass round button (icon or dot), function preserved.
- Decorative brand logos in the UI removed/replaced with glass or dot treatments.
- **Keep** `APLicense` attribution images (`color-icon.png`, `archipela-go-logo_full.png`, `APMarker_blue.png`) — legal attribution.
- App icon and splash left unchanged (out of scope unless requested later).

## Dependencies & build impact

- **`expo-blur`** — native module. Requires `npx expo prebuild` + `pod install` and a native rebuild of the iOS app.
- **`@react-navigation/bottom-tabs`** — JS only, no rebuild.
- `react-native-svg` — already installed (used for markers).

## Testing / verification

Visual redesign; no existing test suite covers styling. Verification is by building and
running the iOS simulator, navigating each screen, and screenshotting: Connect, Saved,
Settings, Chat, Map (markers + dark map), Hints, BannedLocations, and each popup. Confirm:
dark surfaces, glass blur on nav/cards/popups, purple accents, pulsing ambient dots,
bottom tab bars, sci-fi markers, and no remaining generic logos (except attributions).

## Out of scope

- Gameplay, networking, connection, or data-model changes.
- App icon / splash asset replacement.
- New features beyond the visual redesign.
- Light-mode support (app becomes dark-only).
