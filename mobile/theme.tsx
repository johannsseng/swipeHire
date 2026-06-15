// SwipeHire design system — Apple-flavored tokens with light + dark palettes.
//
// Colors come from `useTheme()` so the whole app switches with the chosen
// appearance (light / dark / system). Spacing, radius, type, and elevation are
// scheme-independent and exported as plain tokens.

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";
import { storageGet, storageSet } from "./lib/storage";

export const lightColors = {
  background: "#F2F2F7",
  surface: "#FFFFFF",
  surfaceAlt: "#FBFBFD",
  label: "#1C1C1E",
  secondary: "#6E6E73",
  tertiary: "#A1A1A6",
  inverse: "#FFFFFF",
  accent: "#0A84FF",
  accentSoft: "#EAF3FF",
  success: "#34C759",
  successSoft: "#E7F8ED",
  danger: "#FF3B30",
  dangerSoft: "#FFECEB",
  warning: "#FF9F0A",
  warningSoft: "#FFF4E2",
  star: "#FFB100",
  separator: "#E5E5EA",
  hairline: "#EDEDF0",
};

export type Palette = typeof lightColors;

export const darkColors: Palette = {
  background: "#000000",
  surface: "#1C1C1E",
  surfaceAlt: "#2C2C2E",
  label: "#FFFFFF",
  secondary: "#AEAEB2",
  tertiary: "#8E8E93",
  inverse: "#FFFFFF",
  accent: "#0A84FF",
  accentSoft: "#0B2A45",
  success: "#30D158",
  successSoft: "#16321F",
  danger: "#FF453A",
  dangerSoft: "#3A1714",
  warning: "#FF9F0A",
  warningSoft: "#3A2A12",
  star: "#FFD426",
  separator: "#38383A",
  hairline: "#2C2C2E",
};

// Back-compat default (light). Components should use useTheme().colors instead.
export const colors = lightColors;

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

export type ThemeMode = "light" | "dark" | "system";

type ThemeContextValue = {
  colors: Palette;
  scheme: "light" | "dark";
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  colors: lightColors,
  scheme: "light",
  mode: "system",
  setMode: () => {},
});

const MODE_KEY = "swipehire_theme_mode";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme(); // "light" | "dark" | null
  const [mode, setModeState] = useState<ThemeMode>("system");

  // Load the saved preference once.
  useEffect(() => {
    storageGet(MODE_KEY).then((saved) => {
      if (saved === "light" || saved === "dark" || saved === "system") {
        setModeState(saved);
      }
    });
  }, []);

  function setMode(m: ThemeMode) {
    setModeState(m);
    storageSet(MODE_KEY, m);
  }

  const scheme: "light" | "dark" =
    mode === "system" ? (system === "dark" ? "dark" : "light") : mode;

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors: scheme === "dark" ? darkColors : lightColors,
      scheme,
      mode,
      setMode,
    }),
    [scheme, mode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
