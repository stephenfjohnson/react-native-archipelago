import { BlurView } from "expo-blur";
import React, { ReactNode } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";

import Theme from "../../styles/Theme";

// The native expo-blur view is not always registered (stale binary / New
// Architecture codegen gaps), which otherwise surfaces as a red "Unimplemented
// component" box. This boundary swallows that and lets the tint/border layers
// below stand in as a graceful frosted-glass fallback.
class BlurBoundary extends React.Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function GlassSurface({
  children,
  style,
  radius = Theme.radius.md,
  intensity = Theme.blurIntensity,
  bordered = true,
  glassColor = Theme.glassFill,
  sheen = true,
}: Readonly<{
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  intensity?: number;
  bordered?: boolean;
  glassColor?: string;
  sheen?: boolean;
}>) {
  return (
    <View style={[{ borderRadius: radius, overflow: "hidden" }, style]}>
      <BlurBoundary>
        <BlurView
          intensity={intensity}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
      </BlurBoundary>
      {/* translucent fill — reads as glass with or without live blur */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: glassColor, borderRadius: radius },
        ]}
      />
      {/* top sheen: the bright edge that sells a glass surface */}
      {sheen && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: radius * 0.5,
            right: radius * 0.5,
            height: 1,
            backgroundColor: Theme.glassHighlight,
          }}
        />
      )}
      {/* hairline border */}
      {bordered && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: radius,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: Theme.glassBorder,
            },
          ]}
        />
      )}
      <View>{children}</View>
    </View>
  );
}
