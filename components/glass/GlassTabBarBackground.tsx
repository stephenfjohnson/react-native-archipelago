// components/glass/GlassTabBarBackground.tsx
import React from "react";
import { StyleSheet } from "react-native";
import type { BottomTabNavigationOptions } from "@react-navigation/bottom-tabs";

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
