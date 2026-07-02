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
