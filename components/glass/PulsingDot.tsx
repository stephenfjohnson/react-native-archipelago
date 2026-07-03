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

  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1.6],
  });
  const opacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 0.25],
  });

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
