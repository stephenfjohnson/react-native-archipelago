# Deep Glass Dark Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the Archipela-Go! app to a deep, moody iOS "liquid glass" dark theme — near-black surfaces, frosted-glass panels, electric-purple accents, ambient pulsing purple dots, floating bottom glass tab bars, and custom sci-fi map markers.

**Architecture:** Introduce one UI-token module (`styles/Theme.tsx`) that every surface/text/accent color flows from. Build three reusable glass/dot primitives (`GlassSurface`, `PulsingDot`, `AmbientDots`) plus an SVG sci-fi map marker (`GlassMarker`). Convert both top-tab navigators to bottom glass tab bars. Then sweep the existing StyleSheet files and inline styles to consume the tokens.

**Tech Stack:** Expo SDK 54, React Native 0.81, React 19, TypeScript, `@react-navigation/*`, `expo-blur` (new), `@react-navigation/bottom-tabs` (new), `react-native-svg` (existing), `Animated` (RN built-in).

## Global Constraints

- **Dark only.** No light-mode branch. The app becomes single-theme dark.
- **No behavior changes.** Gameplay, networking, connection, permissions, and data-model logic must not change — this is visual only.
- **All UI colors come from `styles/Theme.tsx`.** No new hardcoded `#fff`/`white`/`black`/`rgba(51,51,51,1)` in touched files. `styles/Colors.tsx` remains the semantic *game* palette (player/item colors).
- **Keep attribution images** in `components/APLicense.tsx` (`color-icon.png`, `archipela-go-logo_full.png`, `APMarker_blue.png`) — legal credit. Do not remove them.
- **Verification model:** This is a visual redesign with no existing test harness; adding one for styling is out of scope (YAGNI). Each task's gate is: (a) `npx tsc --noEmit` passes, and (b) a stated visual check in the iOS simulator. Where a task has real logic (marker color selection), it includes a pure-function check runnable via `node`.
- **Commit after every task.** Use the existing branch `apgo/overpass-migration`.

---

### Task 1: Theme token module + game-color audit

**Files:**
- Create: `styles/Theme.tsx`
- Modify: `styles/Colors.tsx:1-36`

**Interfaces:**
- Produces: `Theme` default export — an object with these exact keys used by every later task:
  `bg, bgElevated, surface, glassFill, glassBorder, glassHighlight, textPrimary, textSecondary, textTertiary, accent, accentBright, accentDim, accentGlow, success, danger, warning, overlay` (all `string`), plus
  `radius: { sm, md, lg, pill }` (numbers), `space: { xs, sm, md, lg, xl }` (numbers), `blurIntensity` (number), and `glow: (color?: string) => { shadowColor, shadowOpacity, shadowRadius, shadowOffset, elevation }`.

- [ ] **Step 1: Create `styles/Theme.tsx`**

```tsx
// styles/Theme.tsx
// Single source of truth for UI (surface/text/accent) tokens. Dark-only.
const Theme = {
  // Surfaces
  bg: "#08080C",
  bgElevated: "#12121A",
  surface: "#16151F",
  glassFill: "rgba(255,255,255,0.06)",
  glassBorder: "rgba(255,255,255,0.12)",
  glassHighlight: "rgba(255,255,255,0.18)",

  // Text
  textPrimary: "#F5F3FF",
  textSecondary: "rgba(245,243,255,0.66)",
  textTertiary: "rgba(245,243,255,0.40)",

  // Purple accent ramp
  accent: "#B026FF",
  accentBright: "#C77DFF",
  accentDim: "#7B2CBF",
  accentGlow: "#B026FF",

  // Status (dark-tuned)
  success: "#2FE6A0",
  danger: "#FF5C77",
  warning: "#FFB020",

  overlay: "rgba(0,0,0,0.6)",

  radius: { sm: 10, md: 16, lg: 24, pill: 999 },
  space: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  blurIntensity: 40,

  // Reusable purple glow shadow preset
  glow: (color: string = "#B026FF") => ({
    shadowColor: color,
    shadowOpacity: 0.8,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  }),
};

export default Theme;
```

- [ ] **Step 2: Recolor the game palette in `styles/Colors.tsx` for dark surfaces**

Collapse the dead `false ? {...} : {...}` ternary to a single object, and change the two values that were used as UI text/foreground on white (`black`, `white`) so they read on near-black. Game/semantic colors stay. Replace the whole file body:

```tsx
// styles/Colors.tsx
// Semantic GAME colors (players/items/locations). UI surface/text tokens live in Theme.tsx.
const Colors = {
  black: "#F5F3FF", // was "#000000"; used as default text color — now light for dark UI
  red: "#FF5C77",
  green: "#2FE6A0", // typically a location
  playerOther: "#E0B341", // typically other slots/players
  blue: "#7FB0FF", // typically extra info (such as entrance)
  playerSelf: "#EE55EE", // typically your slot/player
  filler: "#22C7C7", // typically regular item
  useful: "#8AA6FF", // typically useful item
  progression: "#B99CFF", // typically progression item
  trap: "#FF7A6B", // typically trap item
  white: "#FFFFFF",
  progUseful: "#F0D33A",
  progTrap: "#FFAC1C",
  usefulTrap: "#B06BD6",
  progUsefulTrap: "#80FF80",
};
export default Colors;
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (no errors introduced by the two files).

- [ ] **Step 4: Commit**

```bash
git add styles/Theme.tsx styles/Colors.tsx
git commit -m "Add dark-glass Theme tokens; recolor game palette for dark UI"
```

---

### Task 2: `expo-blur` dependency + `GlassSurface` primitive

**Files:**
- Modify: `package.json` (add `expo-blur`)
- Create: `components/glass/GlassSurface.tsx`

**Interfaces:**
- Consumes: `Theme` from Task 1.
- Produces: `GlassSurface` default export — `({ children, style?, radius?, intensity?, bordered?, glassColor? }: { children?: ReactNode; style?: StyleProp<ViewStyle>; radius?: number; intensity?: number; bordered?: boolean; glassColor?: string }) => JSX.Element`. Renders a dark `BlurView` with a tint/border/rounded overlay.

- [ ] **Step 1: Install `expo-blur`**

Run: `npx expo install expo-blur`
Expected: `expo-blur` added to `package.json` dependencies.

> NOTE: `expo-blur` is a native module. Because this project has a prebuilt `ios/` directory, after this task the iOS app must be rebuilt (`npx expo prebuild` if needed, then `npx expo run:ios` / pod install). The dev server alone will not pick up the native module.

- [ ] **Step 2: Create `components/glass/GlassSurface.tsx`**

```tsx
// components/glass/GlassSurface.tsx
import { BlurView } from "expo-blur";
import React, { ReactNode } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";

import Theme from "../../styles/Theme";

export default function GlassSurface({
  children,
  style,
  radius = Theme.radius.md,
  intensity = Theme.blurIntensity,
  bordered = true,
  glassColor = Theme.glassFill,
}: Readonly<{
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  intensity?: number;
  bordered?: boolean;
  glassColor?: string;
}>) {
  return (
    <View style={[{ borderRadius: radius, overflow: "hidden" }, style]}>
      <BlurView
        intensity={intensity}
        tint="dark"
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: glassColor,
            borderRadius: radius,
            borderWidth: bordered ? StyleSheet.hairlineWidth : 0,
            borderColor: Theme.glassBorder,
          },
        ]}
      />
      <View>{children}</View>
    </View>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Visual check**

Temporarily render `<GlassSurface style={{ padding: 20 }}><Text style={{color:'#fff'}}>glass</Text></GlassSurface>` over the map or any screen in the simulator; confirm a frosted translucent rounded panel with a faint border. Remove the temporary render before committing.

- [ ] **Step 5: Commit**

```bash
git add package.json components/glass/GlassSurface.tsx
git commit -m "Add expo-blur and GlassSurface frosted-panel primitive"
```

---

### Task 3: `PulsingDot` + `AmbientDots` primitives

**Files:**
- Create: `components/glass/PulsingDot.tsx`
- Create: `components/glass/AmbientDots.tsx`

**Interfaces:**
- Consumes: `Theme` from Task 1.
- Produces:
  - `PulsingDot` default export — `({ size?, color?, duration?, delay?, style? }: { size?: number; color?: string; duration?: number; delay?: number; style?: StyleProp<ViewStyle> }) => JSX.Element`.
  - `AmbientDots` default export — `({ count?, opacity? }: { count?: number; opacity?: number }) => JSX.Element`. Absolutely-positioned, non-interactive background layer.

- [ ] **Step 1: Create `components/glass/PulsingDot.tsx`**

```tsx
// components/glass/PulsingDot.tsx
import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleProp, ViewStyle } from "react-native";

import Theme from "../../styles/Theme";

export default function PulsingDot({
  size = 8,
  color = Theme.accent,
  duration = 1600,
  delay = 0,
  style,
}: Readonly<{
  size?: number;
  color?: string;
  duration?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}>) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration,
          delay,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, duration, delay]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.6] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0.25] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          transform: [{ scale }],
          opacity,
          shadowColor: color,
          shadowOpacity: 0.9,
          shadowRadius: size,
          shadowOffset: { width: 0, height: 0 },
        },
        style,
      ]}
    />
  );
}
```

- [ ] **Step 2: Create `components/glass/AmbientDots.tsx`**

Fixed (deterministic — no `Math.random()` at module scope) scatter positions as percentages, varied sizes and delays.

```tsx
// components/glass/AmbientDots.tsx
import React from "react";
import { StyleSheet, View } from "react-native";

import Theme from "../../styles/Theme";
import PulsingDot from "./PulsingDot";

const SPOTS = [
  { top: "8%", left: "12%", size: 6, delay: 0 },
  { top: "18%", left: "82%", size: 10, delay: 400 },
  { top: "34%", left: "26%", size: 4, delay: 900 },
  { top: "52%", left: "70%", size: 7, delay: 200 },
  { top: "66%", left: "16%", size: 5, delay: 1100 },
  { top: "78%", left: "88%", size: 8, delay: 600 },
  { top: "88%", left: "40%", size: 4, delay: 300 },
];

export default function AmbientDots({
  count = SPOTS.length,
  opacity = 0.5,
}: Readonly<{ count?: number; opacity?: number }>) {
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { opacity }]}
    >
      {SPOTS.slice(0, count).map((s, i) => (
        <PulsingDot
          key={i}
          size={s.size}
          delay={s.delay}
          color={i % 2 === 0 ? Theme.accent : Theme.accentBright}
          style={{ position: "absolute", top: s.top as any, left: s.left as any }}
        />
      ))}
    </View>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Visual check**

Temporarily drop `<AmbientDots />` inside a screen's root `View` (e.g. Connect) in the simulator; confirm several purple dots gently pulse in the background behind content and do not block taps. Remove the temporary render before committing (real placement happens in Task 8).

- [ ] **Step 5: Commit**

```bash
git add components/glass/PulsingDot.tsx components/glass/AmbientDots.tsx
git commit -m "Add PulsingDot and AmbientDots ambient-motif primitives"
```

---

### Task 4: Bottom glass tab bars + app-level dark theme

**Files:**
- Modify: `package.json` (add `@react-navigation/bottom-tabs`)
- Create: `components/glass/GlassTabBarBackground.tsx`
- Modify: `screens/ConnectTabs.tsx` (full rewrite, ~28 lines)
- Modify: `screens/Connected.tsx:1-4,31,340-345,413` (navigator only — leave all handler logic untouched)
- Modify: `App.tsx:6,37,38` (StatusBar + NavigationContainer theme)

**Interfaces:**
- Consumes: `GlassSurface` (Task 2), `Theme` (Task 1).
- Produces: `GlassTabBarBackground` default export — `() => JSX.Element` for use as `tabBarBackground`.

- [ ] **Step 1: Install bottom-tabs**

Run: `npx expo install @react-navigation/bottom-tabs`
Expected: added to `package.json`. (JS-only — no rebuild needed.)

- [ ] **Step 2: Create `components/glass/GlassTabBarBackground.tsx`**

```tsx
// components/glass/GlassTabBarBackground.tsx
import React from "react";
import { StyleSheet } from "react-native";

import GlassSurface from "./GlassSurface";
import Theme from "../../styles/Theme";

export default function GlassTabBarBackground() {
  return (
    <GlassSurface
      radius={0}
      intensity={Theme.blurIntensity + 20}
      bordered={false}
      style={StyleSheet.absoluteFill}
    />
  );
}
```

- [ ] **Step 3: Create a shared bottom-tab screenOptions helper**

Add to the SAME `GlassTabBarBackground.tsx` file a named export so both navigators share one config:

```tsx
// append to components/glass/GlassTabBarBackground.tsx
import type { BottomTabNavigationOptions } from "@react-navigation/bottom-tabs";

export const glassTabScreenOptions: BottomTabNavigationOptions = {
  headerShown: false,
  tabBarBackground: () => <GlassTabBarBackground />,
  tabBarActiveTintColor: Theme.accentBright,
  tabBarInactiveTintColor: Theme.textTertiary,
  tabBarStyle: {
    position: "absolute",
    backgroundColor: "transparent",
    borderTopWidth: 0,
    elevation: 0,
  },
  tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
  sceneStyle: { backgroundColor: Theme.bg },
};
```

- [ ] **Step 4: Rewrite `screens/ConnectTabs.tsx` to bottom tabs**

```tsx
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";

import Connect from "./Connect";
import SavedInfo from "./SavedInfo";
import Settings from "./Settings";
import {
  glassTabScreenOptions,
} from "../components/glass/GlassTabBarBackground";

const Tab = createBottomTabNavigator();

export default function ConnectTabs() {
  return (
    <Tab.Navigator initialRouteName="Connect" screenOptions={glassTabScreenOptions}>
      <Tab.Screen
        name="Connect"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="link" color={color} size={size} />
          ),
        }}
      >
        {(props) => <Connect {...props} />}
      </Tab.Screen>
      <Tab.Screen
        name="Saved Connections"
        component={SavedInfo}
        options={{
          tabBarLabel: "Saved",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bookmark" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-sharp" color={color} size={size} />
          ),
        }}
      >
        {(props) => <Settings {...props} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
```

- [ ] **Step 5: Convert `screens/Connected.tsx` navigator to bottom tabs**

Change the import at line 1-4 from:

```tsx
import {
  createMaterialTopTabNavigator,
  MaterialTopTabBarProps,
} from "@react-navigation/material-top-tabs";
```

to:

```tsx
import {
  createBottomTabNavigator,
  BottomTabNavigationProp,
} from "@react-navigation/bottom-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";
import { glassTabScreenOptions } from "../components/glass/GlassTabBarBackground";
```

Change line 31 `const Tab = createMaterialTopTabNavigator();` to `const Tab = createBottomTabNavigator();`

Change the `navigation` prop type on line 40 from `MaterialTopTabBarProps["navigation"]` to `BottomTabNavigationProp<any>`.

Replace the navigator opening tag (lines 340-345) — remove `useSafeAreaInsets` reliance and top padding, merge options:

```tsx
    <Tab.Navigator
      initialRouteName="Chat"
      screenOptions={{ ...glassTabScreenOptions, tabBarHideOnKeyboard: true }}
    >
```

Add `tabBarIcon` options to each `<Tab.Screen>`. For the Chat screen tag (line 346), add before the closing `>`:

```tsx
      <Tab.Screen
        name="Chat"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-ellipses" color={color} size={size} />
          ),
        }}
      >
```

For Map (line 375) add:

```tsx
        <Tab.Screen
          name="Map"
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="map" color={color} size={size} />
            ),
          }}
        >
```

For Hints (line 412) replace with:

```tsx
      <Tab.Screen
        name="Hints"
        component={HintsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bulb" color={color} size={size} />
          ),
        }}
      />
```

The `insets`/`useSafeAreaInsets` usage that fed `paddingTop` is now unused for the navigator; leave the `useSafeAreaInsets` import/line only if still referenced elsewhere in the file — otherwise remove the now-unused `insets` variable to keep `tsc` clean. (Bottom tabs handle safe-area insets automatically.)

- [ ] **Step 6: App-level dark theme in `App.tsx`**

Change line 6 to also import the dark navigation theme:

```tsx
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
```

Add the Theme import near the other imports:

```tsx
import Theme from "./styles/Theme";
```

Change line 37 `<StatusBar style="dark" />` to `<StatusBar style="light" />`.

Change line 38 `<NavigationContainer>` to:

```tsx
              <NavigationContainer
                theme={{
                  ...DarkTheme,
                  colors: {
                    ...DarkTheme.colors,
                    background: Theme.bg,
                    card: Theme.bg,
                    text: Theme.textPrimary,
                    primary: Theme.accent,
                    border: Theme.glassBorder,
                  },
                }}
              >
```

Also change the root `<View style={{ flex: 15 }}>` (line 36) to `<View style={{ flex: 15, backgroundColor: Theme.bg }}>` so there is no white flash before the navigator paints.

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS. If it flags an unused `insets`/`useSafeAreaInsets` in `Connected.tsx`, remove those lines.

- [ ] **Step 8: Visual check (requires the native rebuild from Task 2)**

Run: `npx expo run:ios`
Expected: App boots dark. A floating frosted tab bar sits at the BOTTOM on the connect screen (Connect / Saved / Settings) and, after connecting, on the session screen (Chat / Map / Hints). Active tab icon+label are bright purple; inactive are muted. No white flashes on navigation.

- [ ] **Step 9: Commit**

```bash
git add package.json components/glass/GlassTabBarBackground.tsx screens/ConnectTabs.tsx screens/Connected.tsx App.tsx
git commit -m "Move both navigators to floating bottom glass tab bars; app-level dark theme"
```

---

### Task 5: Core shared styles — containers, inputs, buttons, popups

**Files:**
- Modify: `styles/MainStyles.tsx` (full)
- Modify: `styles/CommonStyles.tsx` (full)
- Modify: `components/Popup.tsx:28-31`
- Modify: `components/Button.tsx:34-39` (glass press color)

**Interfaces:**
- Consumes: `Theme` (Task 1), `GlassSurface` (Task 2).

- [ ] **Step 1: Rewrite `styles/MainStyles.tsx`**

```tsx
import { StyleSheet } from "react-native";

import Theme from "./Theme";

const mainStyles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: Theme.bg,
    alignItems: "center",
    height: "100%",
  },
  connectionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderColor: Theme.glassBorder,
  },
});
export default mainStyles;
```

- [ ] **Step 2: Rewrite `styles/CommonStyles.tsx`** (dark glass fields, purple button, dark modal)

```tsx
import { StyleSheet } from "react-native";

import Theme from "./Theme";

const commonStyles = StyleSheet.create({
  textInput: {
    minWidth: "50%",
    height: 44,
    margin: 12,
    borderWidth: 1,
    borderColor: Theme.glassBorder,
    borderRadius: Theme.radius.sm,
    padding: 12,
    backgroundColor: Theme.glassFill,
    color: Theme.textPrimary,
  },
  inputLabel: {
    fontSize: 20,
    color: Theme.textPrimary,
  },
  touchableHighlightButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: Theme.radius.sm,
    borderWidth: 1,
    borderColor: Theme.accent,
    backgroundColor: Theme.accentDim,
    ...Theme.glow(Theme.accentGlow),
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  touchableHighlightButtonText: {
    fontSize: 13,
    lineHeight: 21,
    fontWeight: "bold",
    letterSpacing: 0.25,
    color: Theme.textPrimary,
  },
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 22,
    backgroundColor: Theme.overlay,
  },
  modalView: {
    margin: 20,
    backgroundColor: Theme.surface,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: Theme.glassBorder,
    padding: 28,
    alignItems: "center",
    alignContent: "center",
    ...Theme.glow(Theme.accentGlow),
  },
  modalText: {
    marginBottom: 15,
    textAlign: "center",
    color: Theme.textPrimary,
  },
  modalButtonContainer: {
    flexDirection: "row",
    justifyContent: "center",
  },
});
export default commonStyles;
```

> Note: `centeredView` now dims the backdrop (`Theme.overlay`); this is the full-screen modal wrapper, so the whole screen behind the popup darkens — matching the glass aesthetic.

- [ ] **Step 3: Make `Popup.tsx` use a `GlassSurface` panel**

Replace the inner content view (lines 28-31) so the modal card is frosted glass. Change:

```tsx
      <View style={commonStyles.centeredView}>
        <View style={{ ...commonStyles.modalView, ...popupStyle }}>
          {children}
        </View>
      </View>
```

to:

```tsx
      <View style={commonStyles.centeredView}>
        <GlassSurface
          radius={Theme.radius.lg}
          style={[{ margin: 20, ...Theme.glow(Theme.accentGlow) }, popupStyle]}
        >
          <View style={{ padding: 28, alignItems: "center" }}>{children}</View>
        </GlassSurface>
      </View>
```

Add imports at top of `Popup.tsx`:

```tsx
import GlassSurface from "./glass/GlassSurface";
import Theme from "../styles/Theme";
```

- [ ] **Step 4: Set glass press color on `Button.tsx`**

Change the `<TouchableHighlight>` opening (line 35-39) to add an `underlayColor`:

```tsx
    <TouchableHighlight
      style={{ ...commonStyles.touchableHighlightButton, ...buttonStyle }}
      underlayColor={"#8E24C9"}
      onPress={onPress}
      {...buttonProps}
    >
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Visual check**

Simulator: Connect screen shows dark bg, dark glass input fields with light text, a glowing purple "Connect" button. Open the save-connection popup — it is a frosted glass card over a dimmed backdrop.

- [ ] **Step 7: Commit**

```bash
git add styles/MainStyles.tsx styles/CommonStyles.tsx components/Popup.tsx components/Button.tsx
git commit -m "Restyle containers, inputs, buttons, and popups to dark glass"
```

---

### Task 6: Remaining style files + inline-style sweep

**Files:**
- Modify: `styles/ChatStyles.tsx`, `styles/ErrorStyles.tsx`, `styles/settingsStyles.tsx` (repoint backgrounds/text to Theme)
- Modify: local `StyleSheet.create` in `screens/Settings.tsx`, `components/APInfoPopup.tsx`, `components/APLicense.tsx`
- Modify inline styles in: `screens/BannedLocations.tsx` (~22), `screens/HintsScreen.tsx` (~7, incl. `darkgreen`/`darkred` at ~:169), `components/LocationInfoPopup.tsx` (~10, incl. color at ~:410), `screens/SavedInfo.tsx` (~4), `screens/Connected.tsx:393` (`Colors.white` lost-connection banner)

**Interfaces:**
- Consumes: `Theme` (Task 1).

- [ ] **Step 1: Sweep the three style files**

For each of `styles/ChatStyles.tsx`, `styles/ErrorStyles.tsx`, `styles/settingsStyles.tsx`: add `import Theme from "./Theme";` and replace every literal `"#fff"`, `"white"`, `"#ffffff"`, `"black"`, `"#000"`, `"#000000"` used as a `backgroundColor` with `Theme.bg` (screen) or `Theme.surface` (card), and every such literal used as text `color` with `Theme.textPrimary`. For the error banner in `ErrorStyles.tsx` keep the red intent but use `Theme.danger` for text and `Theme.surface` for its background.

- [ ] **Step 2: Sweep the local StyleSheets**

In `screens/Settings.tsx`, `components/APInfoPopup.tsx`, `components/APLicense.tsx`: add `import Theme from "../styles/Theme";` and apply the same mapping (background whites → `Theme.bg`/`Theme.surface`, text blacks → `Theme.textPrimary`, any separators/borders → `Theme.glassBorder`).

- [ ] **Step 3: Sweep inline color literals**

In `BannedLocations.tsx`, `HintsScreen.tsx`, `LocationInfoPopup.tsx`, `SavedInfo.tsx`: add `import Theme from "../styles/Theme";` (adjust depth for `components/`) and replace inline color literals:
- `backgroundColor: "white"`/`"#fff"` → `Theme.surface`
- text `color: "black"`/default → `Theme.textPrimary`
- `"darkgreen"` → `Theme.success`
- `"darkred"` → `Theme.danger`
- separators/borders → `Theme.glassBorder`

Leave gameplay/semantic colors sourced from `Colors` untouched.

- [ ] **Step 4: Fix the lost-connection banner in `Connected.tsx:390-399`**

Change `backgroundColor: Colors.white` to `backgroundColor: Theme.surface`, add `borderWidth: 1, borderColor: Theme.glassBorder`, and set the inner `<Text>` to `style={{ color: Theme.textPrimary }}`. Add `import Theme from "../styles/Theme";` if not already present.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Visual check**

Simulator: Settings, Saved Connections, Hints, and Banned Locations screens all render on dark backgrounds with light text; no white cards or black-on-dark text remain. Hint status text uses green/red that reads on dark.

- [ ] **Step 7: Commit**

```bash
git add styles/ChatStyles.tsx styles/ErrorStyles.tsx styles/settingsStyles.tsx screens/Settings.tsx screens/BannedLocations.tsx screens/HintsScreen.tsx screens/SavedInfo.tsx screens/Connected.tsx components/APInfoPopup.tsx components/APLicense.tsx components/LocationInfoPopup.tsx
git commit -m "Sweep remaining style files and inline colors to dark-glass theme"
```

---

### Task 7: Sci-fi map markers + dark map + de-logo the map button

**Files:**
- Create: `components/glass/GlassMarker.tsx`
- Create: `styles/mapDarkStyle.ts`
- Modify: `screens/APMarkers.tsx:10-15,87-92` (replace PNG `Image` with `GlassMarker`, replace `getMarker` with a status selector)
- Modify: `screens/MapScreen.tsx` (add `customMapStyle` + `userInterfaceStyle="dark"` to the `<MapView>`; replace the `black-icon.png` AP button image with a glass icon)
- Modify: `styles/MapStyles.tsx` (dark glass buttons)

**Interfaces:**
- Consumes: `Theme` (Task 1), `Colors` (Task 1).
- Produces: `GlassMarker` default export — `({ status, size? }: { status: "active" | "hinted" | "activeHinted" | "locked"; size?: number }) => JSX.Element` (SVG energy-node marker), and `markerStatus(canCheck: boolean, hinted: boolean) => MarkerStatus` helper exported from the same file.

- [ ] **Step 1: Create `components/glass/GlassMarker.tsx`**

```tsx
// components/glass/GlassMarker.tsx
import React from "react";
import Svg, { Circle, Defs, Polygon, RadialGradient, Stop } from "react-native-svg";

import Colors from "../../styles/Colors";
import Theme from "../../styles/Theme";

export type MarkerStatus = "active" | "hinted" | "activeHinted" | "locked";

export function markerStatus(canCheck: boolean, hinted: boolean): MarkerStatus {
  if (canCheck && hinted) return "activeHinted";
  if (canCheck) return "active";
  if (hinted) return "hinted";
  return "locked";
}

const COLOR: Record<MarkerStatus, string> = {
  active: Theme.accentBright,   // reachable — electric purple
  activeHinted: Colors.progUseful, // reachable + hinted — gold
  hinted: Colors.playerOther,   // hinted but locked — amber
  locked: Theme.textTertiary,   // locked — muted
};

export default function GlassMarker({
  status,
  size = 46,
}: Readonly<{ status: MarkerStatus; size?: number }>) {
  const c = size / 2;
  const color = COLOR[status];
  const dim = status === "locked";
  // hexagon points around center
  const R = size * 0.30;
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    return `${c + R * Math.cos(a)},${c + R * Math.sin(a)}`;
  }).join(" ");

  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={color} stopOpacity={dim ? 0.35 : 0.75} />
          <Stop offset="100%" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {/* outer glow halo */}
      <Circle cx={c} cy={c} r={size * 0.46} fill="url(#glow)" />
      {/* neon rim ring */}
      <Circle
        cx={c}
        cy={c}
        r={size * 0.34}
        stroke={color}
        strokeWidth={dim ? 1.5 : 2.5}
        fill="rgba(8,8,12,0.55)"
      />
      {/* hex core */}
      <Polygon
        points={pts}
        fill={dim ? "rgba(245,243,255,0.15)" : color}
        stroke={color}
        strokeWidth={1.5}
        opacity={dim ? 0.7 : 1}
      />
      {/* bright center dot */}
      <Circle cx={c} cy={c} r={size * 0.07} fill={Theme.textPrimary} opacity={dim ? 0.5 : 1} />
    </Svg>
  );
}
```

- [ ] **Step 2: Verify the status selector logic (pure function)**

Create a throwaway check (do not commit it):

Run:
```bash
node -e "const f=(cc,h)=>cc&&h?'activeHinted':cc?'active':h?'hinted':'locked'; console.log(f(true,true),f(true,false),f(false,true),f(false,false))"
```
Expected: `activeHinted active hinted locked`

- [ ] **Step 3: Replace the PNG marker in `APMarkers.tsx`**

Remove the `getMarker` function (lines 10-15) and the `Image` import. Add:

```tsx
import GlassMarker, { markerStatus } from "../components/glass/GlassMarker";
```

Replace the `<Image ... />` block (lines 87-92) with:

```tsx
        <GlassMarker status={markerStatus(canCheck, hinted)} />
```

Also update the `Callout` lock icon color (line 102) `color="black"` → `color={"#F5F3FF"}` so it reads (the callout bubble is native/light; keep readable — or leave black if the callout stays white). Update the `Circle` overlay stroke/fill (lines 77-78) to purple to match: `strokeColor="#B026FF"` and `fillColor="#B026FF33"`.

- [ ] **Step 4: Create `styles/mapDarkStyle.ts`** (Google-maps dark style array)

```ts
// styles/mapDarkStyle.ts — dark theme for react-native-maps (Google provider)
const mapDarkStyle = [
  { elementType: "geometry", stylers: [{ color: "#0b0b12" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a86a3" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0b0b12" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1a1926" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#2a2740" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#05050a" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#151322" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#10201a" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#1a1926" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#2a2740" }] },
];
export default mapDarkStyle;
```

- [ ] **Step 5: Apply dark map + de-logo AP button in `MapScreen.tsx`**

Find the `<MapView` element and add these props:

```tsx
        customMapStyle={mapDarkStyle}
        userInterfaceStyle="dark"
```

Add imports:

```tsx
import mapDarkStyle from "../styles/mapDarkStyle";
import Ionicons from "@expo/vector-icons/Ionicons";
import Theme from "../styles/Theme";
```

Replace the AP button image (around `MapScreen.tsx:841-843`):

```tsx
        <Image style={mapStyles.apLogo} source={require("../assets/black-icon.png")} />
```

with:

```tsx
        <Ionicons name="planet" size={22} color={Theme.accentBright} />
```

- [ ] **Step 6: Dark glass map buttons in `styles/MapStyles.tsx`**

Replace the two `backgroundColor: "white"` (lines 16, 28) with `backgroundColor: Theme.glassFill`, add `borderWidth: 1, borderColor: Theme.glassBorder`, raise `borderRadius` to `Theme.radius.md`, and set `opacity: 0.95`. Add `import Theme from "./Theme";`. The `apLogo` style can stay (now unused) or be removed.

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 8: Visual check**

Simulator (Map tab): the map renders dark. Location markers are glowing hexagonal energy nodes — purple when reachable, amber/gold when hinted, muted when locked. The old AP logo button is now a purple glass "planet" icon button. No PNG map logos remain.

- [ ] **Step 9: Commit**

```bash
git add components/glass/GlassMarker.tsx styles/mapDarkStyle.ts screens/APMarkers.tsx screens/MapScreen.tsx styles/MapStyles.tsx
git commit -m "Sci-fi SVG map markers, dark map style, glass map buttons"
```

---

### Task 8: Ambient dots placement + logo-removal audit + final verification

**Files:**
- Modify: `screens/Connect.tsx`, `screens/SavedInfo.tsx`, `screens/Settings.tsx` (drop `<AmbientDots />` behind content)
- Audit-only: grep for remaining logo `require`s and stray white/black literals

**Interfaces:**
- Consumes: `AmbientDots` (Task 3).

- [ ] **Step 1: Add ambient dots to the three connect-group screens**

In each of `Connect.tsx`, `SavedInfo.tsx`, `Settings.tsx`, import and render `AmbientDots` as the FIRST child of the screen's root container (so it sits behind content; it is `pointerEvents="none"`):

```tsx
import AmbientDots from "../components/glass/AmbientDots";
// ...
// inside the root <View>:
      <AmbientDots />
```

Ensure the root container has `backgroundColor: Theme.bg` (from Task 5's `mainStyles.mainContainer`) so the dots glow against dark.

- [ ] **Step 2: Logo-removal audit**

Run:
```bash
grep -rn "require(\"../assets/" screens components | grep -iE "logo|icon" | grep -v APLicense
```
Expected: no results EXCEPT map marker PNGs that are no longer referenced. Confirm `black-icon.png` is no longer referenced by `MapScreen.tsx`:
```bash
grep -rn "black-icon" screens
```
Expected: no results. (APLicense attribution images intentionally remain — do not touch.)

- [ ] **Step 3: Stray-color audit on touched files**

Run:
```bash
grep -rnE "\"(white|#fff|#ffffff|black|#000|#000000)\"" styles screens components | grep -iv "colors.tsx"
```
Review results: each remaining hit should be either inside `Colors.tsx` (game palette) or an intentional non-UI use (e.g. an SVG fill already themed). Fix any genuine stray UI white/black backgrounds/text to `Theme` tokens.

- [ ] **Step 4: Full type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS (lint may warn; no new errors).

- [ ] **Step 5: Full-app visual walkthrough (iOS simulator)**

Run: `npx expo run:ios`
Walk every screen and confirm against the spec's verification list: Connect, Saved, Settings (with pulsing ambient dots), Chat, Map (dark + sci-fi markers + glass buttons), Hints, Banned Locations, and each popup. Confirm: dark surfaces throughout, frosted glass on nav bars/cards/popups, purple accents, bottom tab bars on both navigators, no generic logos except the license screen, StatusBar light/readable.

- [ ] **Step 6: Commit**

```bash
git add screens/Connect.tsx screens/SavedInfo.tsx screens/Settings.tsx
git commit -m "Add ambient pulsing dots to connect-group screens; final theme audit"
```

---

## Self-Review

**Spec coverage:**
- Deep/moody dark theme → Task 1 (tokens), Tasks 5-6 (sweep). ✓
- Heavy frosted glass → Task 2 (`GlassSurface`), Task 4 (tab bars), Task 5 (popups). ✓
- Electric purple highlights → Task 1 accent ramp, applied throughout. ✓
- Ambient pulsing dots → Task 3 (primitives), Task 8 (placement). ✓
- Bottom glass tab bars, both navigators → Task 4. ✓
- Remove logos, keep attributions → Task 7 (map button), Task 8 (audit); APLicense preserved per Global Constraints. ✓
- Sci-fi map markers → Task 7. ✓
- Dark map → Task 7. ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases"; every code step shows concrete code. ✓

**Type consistency:** `Theme` key set is defined once (Task 1) and consumed with those exact names. `markerStatus`/`MarkerStatus` and `GlassMarker` props defined in Task 7 and used within the same task. `glassTabScreenOptions`/`GlassTabBarBackground` defined in Task 4 and consumed by both navigators in Task 4. ✓

**Deviation note:** Strict red-green TDD is not applied because this is a visual redesign with no test harness and styling is not unit-testable; per Global Constraints the gate is `tsc --noEmit` + a concrete simulator visual check each task, with a pure-function `node` check for the one piece of real logic (marker status). This is intentional, not an omission.
