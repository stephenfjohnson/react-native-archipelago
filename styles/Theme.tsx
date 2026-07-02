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
