import React, { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";

import Theme from "../../styles/Theme";

// An "energy node": a glowing purple core emitting expanding rings — the same
// visual language as the sci-fi map markers, used as the app's brand mark.
function Ring({ size, delay }: Readonly<{ size: number; delay: number }>) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(t, {
        toValue: 1,
        duration: 2600,
        delay,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [t, delay]);

  const scale = t.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });
  const opacity = t.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.55, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1.5,
        borderColor: Theme.accentBright,
        transform: [{ scale }],
        opacity,
      }}
    />
  );
}

export default function BrandMark({
  size = 76,
}: Readonly<{ size?: number }>) {
  const core = size * 0.24;
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const coreScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.12] });

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Ring size={size} delay={0} />
      <Ring size={size} delay={1300} />
      {/* soft halo */}
      <View
        style={{
          position: "absolute",
          width: size * 0.6,
          height: size * 0.6,
          borderRadius: size,
          backgroundColor: Theme.accent,
          opacity: 0.18,
        }}
      />
      {/* glowing core */}
      <Animated.View
        style={{
          width: core,
          height: core,
          borderRadius: core / 2,
          backgroundColor: Theme.accentBright,
          transform: [{ scale: coreScale }],
          shadowColor: Theme.accentGlow,
          shadowOpacity: 1,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 0 },
        }}
      />
    </View>
  );
}
