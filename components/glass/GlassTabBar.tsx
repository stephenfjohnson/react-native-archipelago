import Ionicons from "@expo/vector-icons/Ionicons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import GlassSurface from "./GlassSurface";
import Theme from "../../styles/Theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

// [inactive outline, active filled] per route — the native iOS tab pattern.
const ICONS: Record<string, [IconName, IconName]> = {
  Connect: ["link-outline", "link"],
  "Saved Connections": ["bookmark-outline", "bookmark"],
  Settings: ["settings-outline", "settings"],
  Chat: ["chatbubbles-outline", "chatbubbles"],
  Map: ["map-outline", "map"],
  Hints: ["bulb-outline", "bulb"],
};

const LABELS: Record<string, string> = {
  "Saved Connections": "Saved",
};

function TabButton({
  routeName,
  focused,
  onPress,
  onLongPress,
}: Readonly<{
  routeName: string;
  focused: boolean;
  onPress: () => void;
  onLongPress: () => void;
}>) {
  const [inactive, active] = ICONS[routeName] ?? ["ellipse-outline", "ellipse"];
  const label = LABELS[routeName] ?? routeName;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.tab}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
    >
      <View style={[styles.capsule, focused && styles.capsuleActive]}>
        <Ionicons
          name={focused ? active : inactive}
          size={22}
          color={focused ? Theme.accentBright : Theme.textTertiary}
        />
        <Text
          numberOfLines={1}
          style={[styles.label, focused ? styles.labelActive : styles.labelInactive]}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

export default function GlassTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <GlassSurface radius={30} intensity={Theme.blurIntensity + 25} style={styles.pill}>
        <View style={styles.row}>
          {state.routes.map((route, index) => {
            const focused = state.index === index;
            const onPress = () => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };
            const onLongPress = () =>
              navigation.emit({ type: "tabLongPress", target: route.key });
            return (
              <TabButton
                key={route.key}
                routeName={route.name}
                focused={focused}
                onPress={onPress}
                onLongPress={onLongPress}
              />
            );
          })}
        </View>
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "transparent",
    paddingHorizontal: 14,
    paddingTop: 6,
  },
  pill: {
    ...Theme.glow(Theme.accentGlow),
    shadowOpacity: 0.35,
    shadowRadius: 18,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 9,
    paddingHorizontal: 6,
  },
  tab: {
    flex: 1,
    alignItems: "center",
  },
  capsule: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Theme.radius.pill,
    borderWidth: 1,
    borderColor: "transparent",
  },
  capsuleActive: {
    backgroundColor: "rgba(176,38,255,0.16)",
    borderColor: "rgba(199,125,255,0.45)",
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  labelActive: {
    color: Theme.accentBright,
    // only show the label on the active tab (pill-with-label iOS style)
  },
  labelInactive: {
    display: "none",
  },
});
