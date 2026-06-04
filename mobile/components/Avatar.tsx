import { View, Text, Image, StyleSheet } from "react-native";
import { colors } from "../theme";

// Company avatar: shows the real logo when we have one, otherwise a clean
// monogram circle with a deterministic color derived from the company name.

const PALETTE = [
  "#0A84FF", // blue
  "#5E5CE6", // indigo
  "#AF52DE", // purple
  "#FF2D55", // pink
  "#FF9F0A", // orange
  "#34C759", // green
  "#00C7BE", // teal
  "#FF6482", // rose
];

function colorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function Avatar({
  name,
  logoUrl,
  size = 44,
}: {
  name: string;
  logoUrl?: string | null;
  size?: number;
}) {
  const radius = size * 0.28;

  if (logoUrl) {
    return (
      <Image
        source={{ uri: logoUrl }}
        style={[s.logo, { width: size, height: size, borderRadius: radius }]}
      />
    );
  }

  return (
    <View
      style={[
        s.monogram,
        { width: size, height: size, borderRadius: radius, backgroundColor: colorFor(name) },
      ]}
    >
      <Text style={[s.initial, { fontSize: size * 0.42 }]}>
        {name.trim().charAt(0).toUpperCase() || "?"}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  logo: { backgroundColor: colors.surface },
  monogram: { alignItems: "center", justifyContent: "center" },
  initial: { color: "#fff", fontWeight: "700" },
});
