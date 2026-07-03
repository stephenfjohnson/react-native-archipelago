// components/glass/GlassMarker.tsx
import React from "react";
import Svg, {
  Circle,
  Defs,
  Polygon,
  RadialGradient,
  Stop,
} from "react-native-svg";

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
  active: Theme.accentBright, // reachable — electric purple
  activeHinted: Colors.progUseful, // reachable + hinted — gold
  hinted: Colors.playerOther, // hinted but locked — amber
  locked: Theme.textTertiary, // locked — muted
};

export default function GlassMarker({
  status,
  size = 46,
}: Readonly<{ status: MarkerStatus; size?: number }>) {
  const c = size / 2;
  const color = COLOR[status];
  const dim = status === "locked";
  // hexagon points around center
  const R = size * 0.3;
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
      <Circle
        cx={c}
        cy={c}
        r={size * 0.07}
        fill={Theme.textPrimary}
        opacity={dim ? 0.5 : 1}
      />
    </Svg>
  );
}
