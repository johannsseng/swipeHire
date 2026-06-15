import { useState, useCallback, useMemo } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, type SavedJob, type TrackStatus } from "../lib/api";
import { OutreachModal } from "../components/OutreachModal";
import { JobDetailModal } from "../components/JobDetailModal";
import { Avatar } from "../components/Avatar";
import { useTheme, space, radius, font, shadow, type Palette } from "../theme";

const STATUS_ORDER: TrackStatus[] = [
  "saved",
  "applied",
  "screening",
  "interview",
  "accepted",
  "rejected",
];

type StatusMeta = Record<TrackStatus, { label: string; bg: string; fg: string }>;

// Pipeline badge colors, theme-aware.
const makeStatusMeta = (colors: Palette, scheme: "light" | "dark"): StatusMeta => ({
  saved: { label: "Saved", bg: colors.surfaceAlt, fg: colors.secondary },
  applied: { label: "Applied", bg: colors.accentSoft, fg: colors.accent },
  screening: { label: "Screening", bg: colors.warningSoft, fg: scheme === "dark" ? colors.warning : "#9A6200" },
  interview:
    scheme === "dark"
      ? { label: "Interview", bg: "#211F3A", fg: "#A5A1FF" }
      : { label: "Interview", bg: "#EEEDFD", fg: "#5E5CE6" },
  accepted: { label: "Accepted", bg: colors.successSoft, fg: colors.success },
  rejected: { label: "Rejected", bg: colors.dangerSoft, fg: colors.danger },
});

export function SavedScreen() {
  const { colors, scheme } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const STATUS_META = useMemo(() => makeStatusMeta(colors, scheme), [colors, scheme]);

  const [items, setItems] = useState<SavedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detailJobId, setDetailJobId] = useState<string | null>(null);
  const [outreachJobId, setOutreachJobId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.getSaved();
      setItems(res.items);
    } catch (err) {
      console.warn("Failed to load saved jobs:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  function onRefresh() {
    setRefreshing(true);
    load();
  }

  function setStatus(jobId: string, status: TrackStatus) {
    setItems((prev) => prev.map((j) => (j.id === jobId ? { ...j, trackStatus: status } : j)));
    api.setTrackStatus(jobId, status).catch((err: any) => {
      Alert.alert("Couldn't update status", err.message);
      load();
    });
  }

  function openStatusPicker(item: SavedJob) {
    Alert.alert("Application status", item.title, [
      ...STATUS_ORDER.map((st) => ({
        text: (st === item.trackStatus ? "✓ " : "") + STATUS_META[st].label,
        onPress: () => setStatus(item.id, st),
      })),
      { text: "Cancel", style: "cancel" as const },
    ]);
  }

  function handleUnsave(jobId: string) {
    Alert.alert("Remove saved job?", "This job will no longer appear in your saved list.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          setItems((prev) => prev.filter((j) => j.id !== jobId));
          try {
            await api.unsave(jobId);
          } catch (err: any) {
            Alert.alert("Couldn't unsave", err.message);
            load();
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <SafeAreaView style={s.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </SafeAreaView>
    );
  }

  if (items.length === 0) {
    return (
      <SafeAreaView style={s.center}>
        <Text style={s.emptyEmoji}>🔖</Text>
        <Text style={s.emptyTitle}>No saved jobs yet</Text>
        <Text style={s.emptySubtitle}>
          Swipe right on roles you like in Discover and they'll appear here.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        ListHeaderComponent={
          <View style={s.headerBlock}>
            <Text style={s.header}>Saved</Text>
            <Text style={s.headerCount}>{items.length} role{items.length === 1 ? "" : "s"}</Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        renderItem={({ item }) => {
          const meta = STATUS_META[item.trackStatus] ?? STATUS_META.saved;
          return (
            <Pressable style={s.card} onPress={() => setDetailJobId(item.id)}>
              <View style={s.cardHeaderRow}>
                <Avatar name={item.company} logoUrl={item.companyLogoUrl} size={40} />
                <View style={s.cardHeaderText}>
                  <Text style={s.cardCompany}>{item.company}</Text>
                  {item.companyRating != null && item.companyReviewCount > 0 ? (
                    <Text style={s.cardRating}>
                      <Text style={s.cardRatingStar}>★ </Text>
                      {item.companyRating.toFixed(1)} · {item.companyReviewCount}
                    </Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  style={[s.statusBadge, { backgroundColor: meta.bg }]}
                  onPress={(e) => {
                    e.stopPropagation();
                    openStatusPicker(item);
                  }}
                  hitSlop={6}
                >
                  <Text style={[s.statusBadgeText, { color: meta.fg }]}>{meta.label}</Text>
                </TouchableOpacity>
              </View>
              <Text style={s.cardTitle}>{item.title}</Text>
              <View style={s.metaRow}>
                {item.location ? <Text style={s.cardLocation}>{item.location}</Text> : null}
                {item.salary ? <Text style={s.cardSalary}>{item.salary}</Text> : null}
              </View>

              <Text style={s.expandHint}>Tap for details, reviews & salary</Text>

              <TouchableOpacity
                style={s.applyButton}
                activeOpacity={0.85}
                onPress={(e) => {
                  e.stopPropagation();
                  Linking.openURL(item.applyUrl);
                  if (item.trackStatus === "saved") setStatus(item.id, "applied");
                }}
              >
                <Text style={s.applyButtonText}>Apply on company site</Text>
              </TouchableOpacity>

              <View style={s.secondaryRow}>
                <TouchableOpacity
                  style={s.secondaryBtn}
                  onPress={(e) => {
                    e.stopPropagation();
                    setOutreachJobId(item.id);
                  }}
                >
                  <Text style={s.secondaryBtnText}>Reach out</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.secondaryBtn, s.unsaveBtn]}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleUnsave(item.id);
                  }}
                >
                  <Text style={[s.secondaryBtnText, s.unsaveText]}>Unsave</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          );
        }}
      />

      <OutreachModal
        jobId={outreachJobId}
        visible={outreachJobId !== null}
        onClose={() => setOutreachJobId(null)}
      />
      <JobDetailModal
        jobId={detailJobId}
        visible={detailJobId !== null}
        onClose={() => setDetailJobId(null)}
      />
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: "center", alignItems: "center", padding: space.xxl, backgroundColor: colors.background },
    emptyEmoji: { fontSize: 44, marginBottom: space.md },
    list: { paddingHorizontal: space.lg, paddingBottom: space.xxl },
    headerBlock: { paddingTop: space.sm, paddingBottom: space.lg },
    header: { ...font.largeTitle, color: colors.label },
    headerCount: { ...font.subhead, color: colors.secondary, marginTop: 2 },
    card: {
      backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, marginBottom: space.md,
      ...shadow.card,
    },
    cardHeaderRow: { flexDirection: "row", alignItems: "center", gap: space.md, marginBottom: space.md },
    cardHeaderText: { flex: 1, gap: 1 },
    cardCompany: { ...font.caption, fontWeight: "700", color: colors.accent, textTransform: "uppercase", letterSpacing: 0.6 },
    cardRating: { ...font.caption, color: colors.secondary, fontWeight: "600" },
    cardRatingStar: { color: colors.star },
    statusBadge: { paddingHorizontal: space.md, paddingVertical: 5, borderRadius: radius.pill },
    statusBadgeText: { ...font.caption, fontWeight: "700" },
    cardTitle: { ...font.title3, color: colors.label, marginBottom: space.sm },
    metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: space.md, marginBottom: space.md },
    cardLocation: { ...font.footnote, color: colors.secondary },
    cardSalary: { ...font.footnote, color: colors.success, fontWeight: "600" },
    expandHint: { ...font.caption, color: colors.tertiary, marginBottom: space.md },
    applyButton: { backgroundColor: colors.accent, paddingVertical: 12, borderRadius: radius.sm, alignItems: "center" },
    applyButtonText: { ...font.subhead, color: colors.inverse, fontWeight: "600" },
    secondaryRow: { flexDirection: "row", gap: space.sm, marginTop: space.sm },
    secondaryBtn: {
      flex: 1, paddingVertical: 11, borderRadius: radius.sm, alignItems: "center",
      backgroundColor: colors.accentSoft,
    },
    secondaryBtnText: { ...font.footnote, color: colors.accent, fontWeight: "600" },
    unsaveBtn: { backgroundColor: colors.dangerSoft },
    unsaveText: { color: colors.danger },
    emptyTitle: { ...font.title2, color: colors.label, marginBottom: space.xs },
    emptySubtitle: { ...font.subhead, color: colors.secondary, textAlign: "center", lineHeight: 21 },
  });
