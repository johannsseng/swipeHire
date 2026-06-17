import { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import * as Location from "expo-location";
import { api, type Job } from "../lib/api";
import { JobDetailModal } from "../components/JobDetailModal";
import { useTheme, space, radius, font, shadow, type Palette } from "../theme";

export default function SearchScreen() {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [nearMeEnabled, setNearMeEnabled] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  async function toggleNearMe() {
    try {
      if (nearMeEnabled) {
        setNearMeEnabled(false);
        setLocation("");
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        Alert.alert("Location permission needed", "Please allow location access.");
        return;
      }

      const pos = await Location.getCurrentPositionAsync({});
      const places = await Location.reverseGeocodeAsync(pos.coords);
      const city = places[0]?.city;

      if (!city) {
        Alert.alert("Location Error", "Could not detect your city.");
        return;
      }

      setNearMeEnabled(true);
      setLocation(city);
    } catch (err: any) {
      Alert.alert("Location Error", err.message ?? "Could not get location.");
    }
  }

  async function handleSearch() {
    try {
      setLoading(true);

      let allJobs: Job[] = [];
      let cursor: string | undefined = undefined;

      for (let i = 0; i < 10; i++) {
        const res = await api.getFeed(cursor);
        allJobs = [...allJobs, ...res.items];

        if (!res.nextCursor) break;
        cursor = res.nextCursor;
      }

      const filteredJobs = allJobs.filter((job) => {
  const normalizedTitle = title.toLowerCase().trim();

  const normalizedSearchLocation = location
    .toLowerCase()
    .replace(",", "")
    .trim();

  const normalizedJobLocation = job.location
    ?.toLowerCase()
    .replace(",", "")
    .trim();

  const titleMatch =
    normalizedTitle === "" ||
    job.title.toLowerCase().includes(normalizedTitle);

  const locationMatch =
    normalizedSearchLocation === "" ||
    normalizedJobLocation?.includes(normalizedSearchLocation) ||
    normalizedSearchLocation.includes(normalizedJobLocation ?? "");

  return titleMatch && locationMatch;
});

      setJobs(filteredJobs);
    } catch (err: any) {
      console.warn("Search failed:", err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={s.container}>
      <Text style={s.header}>Search Jobs</Text>

      <TextInput
        style={s.input}
        placeholder="Job title"
        placeholderTextColor={colors.tertiary}
        value={title}
        onChangeText={setTitle}
      />

      <TextInput
        style={s.input}
        placeholder="City, state, or remote"
        placeholderTextColor={colors.tertiary}
        value={location}
        onChangeText={(text) => {
          setLocation(text);
          if (nearMeEnabled) setNearMeEnabled(false);
        }}
      />

      <TouchableOpacity
        style={[
          s.nearMeButton,
          nearMeEnabled && { backgroundColor: colors.accentSoft },
        ]}
        onPress={toggleNearMe}
      >
        <Text style={s.nearMeButtonText}>
          {nearMeEnabled ? `📍 Near Me ON (${location})` : "📍 Near Me OFF"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.searchButton} onPress={handleSearch}>
        <Text style={s.searchButtonText}>
          {loading ? "Searching..." : "Search"}
        </Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator
          ListEmptyComponent={
            <Text style={s.emptyText}>
              Search for jobs by title and location.
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.jobCard}
              onPress={() => setSelectedJobId(item.id)}
            >
              <Text style={s.jobTitle}>{item.title}</Text>
              <Text style={s.company}>{item.company}</Text>

              {item.location ? <Text style={s.location}>{item.location}</Text> : null}
              {item.remote ? <Text style={s.remote}>Remote</Text> : null}
            </TouchableOpacity>
          )}
        />
      )}

      <JobDetailModal
        jobId={selectedJobId}
        visible={selectedJobId !== null}
        onClose={() => setSelectedJobId(null)}
      />
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: space.lg,
    },
    header: {
      ...font.title1,
      color: colors.label,
      marginBottom: space.lg,
    },
    input: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      paddingHorizontal: space.lg,
      paddingVertical: space.md,
      color: colors.label,
      marginBottom: space.md,
      ...shadow.floating,
    },
    nearMeButton: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      paddingVertical: space.md,
      alignItems: "center",
      marginBottom: space.md,
      ...shadow.floating,
    },
    nearMeButtonText: {
      color: colors.accent,
      fontWeight: "700",
    },
    searchButton: {
      backgroundColor: colors.accent,
      borderRadius: radius.md,
      paddingVertical: space.md,
      alignItems: "center",
      marginBottom: space.lg,
    },
    searchButtonText: {
      color: "white",
      fontWeight: "700",
      fontSize: 16,
    },
    list: {
      paddingBottom: 100,
    },
    emptyText: {
      textAlign: "center",
      marginTop: 40,
      color: colors.secondary,
      ...font.subhead,
    },
    jobCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: space.lg,
      marginBottom: space.md,
      ...shadow.card,
    },
    jobTitle: {
      ...font.title3,
      color: colors.label,
      marginBottom: 4,
    },
    company: {
      ...font.subhead,
      color: colors.accent,
      fontWeight: "700",
    },
    location: {
      ...font.subhead,
      color: colors.secondary,
      marginTop: 4,
    },
    remote: {
      ...font.caption,
      color: colors.success,
      fontWeight: "700",
      marginTop: 6,
    },
  });