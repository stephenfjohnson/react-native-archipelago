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
