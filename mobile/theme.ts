// SwipeHire design system — a small, Apple-flavored token set.
// One source of truth for color, spacing, radius, type, and elevation so every
// screen feels like the same, deliberately-designed app.

export const colors = {
  // Surfaces
  background: "#F2F2F7", // iOS systemGroupedBackground
  surface: "#FFFFFF",
  surfaceAlt: "#FBFBFD",

  // Text
  label: "#1C1C1E",
  secondary: "#6E6E73",
  tertiary: "#A1A1A6",
  inverse: "#FFFFFF",

  // Brand / accents
  accent: "#0A84FF",
  accentSoft: "#EAF3FF",
  success: "#34C759",
  successSoft: "#E7F8ED",
  danger: "#FF3B30",
  dangerSoft: "#FFECEB",
  warning: "#FF9F0A",
  warningSoft: "#FFF4E2",
  star: "#FFB100",

  // Lines
  separator: "#E5E5EA",
  hairline: "#EDEDF0",
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const font = {
  largeTitle: { fontSize: 34, fontWeight: "700" as const, letterSpacing: 0.37 },
  title1: { fontSize: 28, fontWeight: "700" as const, letterSpacing: 0.36 },
  title2: { fontSize: 22, fontWeight: "700" as const },
  title3: { fontSize: 18, fontWeight: "600" as const },
  headline: { fontSize: 17, fontWeight: "600" as const },
  body: { fontSize: 17, fontWeight: "400" as const },
  callout: { fontSize: 16, fontWeight: "400" as const },
  subhead: { fontSize: 15, fontWeight: "400" as const },
  footnote: { fontSize: 13, fontWeight: "400" as const },
  caption: { fontSize: 12, fontWeight: "400" as const },
} as const;

// Soft, low-contrast elevation — closer to iOS than a hard drop shadow.
export const shadow = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  floating: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },
} as const;
