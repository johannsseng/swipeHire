import { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Swiper from "react-native-deck-swiper";
import RenderHTML from "react-native-render-html";
import { api, type User, type Job } from "../lib/api";
import { JobDetailModal } from "../components/JobDetailModal";
import { Avatar } from "../components/Avatar";
import { useTheme, space, radius, font, shadow, type Palette } from "../theme";

export function DiscoverScreen({ user }: { user: User }) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const overlayLabels = useMemo(() => makeOverlayLabels(colors), [colors]);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [undoCount, setUndoCount] = useState(0);
  const [detailJobId, setDetailJobId] = useState<string | null>(null);
  const [deckKey, setDeckKey] = useState(0);
  const swiperRef = useRef<Swiper<Job>>(null);
  const undoingRef = useRef(false);
  const canUndo = undoCount > 0;

  useEffect(() => {
    loadFeed();
  }, []);

  async function loadFeed(cur?: string) {
    try {
      setLoading(true);
      const res = await api.getFeed(cur);
      if (res.items.length === 0 && !cur) {
        setEmpty(true);
      } else {
        setJobs((prev) => (cur ? [...prev, ...res.items] : res.items));
        setCursor(res.nextCursor);
      }
    } catch (err: any) {
      Alert.alert("Error loading jobs", err.message);
    } finally {
      setLoading(false);
    }
  }

  // Pull a fresh batch of listings from the top and reset the deck.
  async function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const res = await api.getFeed();
      setJobs(res.items);
      setCursor(res.nextCursor);
      setUndoCount(0);
      setEmpty(res.items.length === 0);
      setDeckKey((k) => k + 1); // remount the swiper so it starts at the top
    } catch (err: any) {
      Alert.alert("Couldn't refresh", err.message);
    } finally {
      setRefreshing(false);
    }
  }
 

  function handleSwipe(jobIndex: number, direction: "left" | "right") {
    const job = jobs[jobIndex];
    if (!job) return;
    setUndoCount((c) => c + 1);
    api.swipe(job.id, direction).catch((err) => {
      console.warn("Swipe failed:", err.message);
    });
  }

  // Swipe up opens the full detail page, then restores the card.
  function handleSwipedTop(jobIndex: number) {
    const job = jobs[jobIndex];
    swiperRef.current?.swipeBack();
    if (job) setDetailJobId(job.id);
  }

  async function handleUndo() {
    if (undoCount === 0 || undoingRef.current) return;
    undoingRef.current = true;
    swiperRef.current?.swipeBack();
    setUndoCount((c) => Math.max(0, c - 1));
    try {
      await api.undoSwipe();
    } catch (err: any) {
      console.warn("Undo failed:", err.message);
    }
    setTimeout(() => {
      undoingRef.current = false;
    }, 350);
  }

  if (loading && jobs.length === 0) {
    return (
      <SafeAreaView style={s.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </SafeAreaView>
    );
  }

  if (empty) {
    return (
      <SafeAreaView style={s.center}>
        <Text style={s.emptyEmoji}>🎉</Text>
        <Text style={s.emptyTitle}>You're all caught up</Text>
        <Text style={s.emptySubtitle}>Check back later for fresh roles.</Text>
        <TouchableOpacity style={s.emptyRefresh} onPress={handleRefresh} disabled={refreshing}>
          <Text style={s.emptyRefreshText}>{refreshing ? "Refreshing…" : "↻ Refresh listings"}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.deckContainer} edges={["left", "right", "bottom"]}>
      <View style={s.topBar}>
        <TouchableOpacity
          style={[s.pillBtn, !canUndo && s.pillBtnDisabled]}
          onPress={handleUndo}
          disabled={!canUndo}
          hitSlop={8}
        >
          <Text style={[s.pillText, !canUndo && s.pillTextDisabled]}>
            ↺ Undo{undoCount > 1 ? ` (${undoCount})` : ""}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.pillBtn, refreshing && s.pillBtnDisabled]}
          onPress={handleRefresh}
          disabled={refreshing}
          hitSlop={8}
        >
          <Text style={s.pillText}>{refreshing ? "↻ …" : "↻ Refresh"}</Text>
        </TouchableOpacity>

      </View>

      <View style={s.deck}>
        <Swiper
          key={deckKey}
          ref={swiperRef}
          cards={jobs}
          renderCard={(job) =>
            job ? (
              <JobCard job={job} onDetails={() => setDetailJobId(job.id)} />
            ) : (
              <View style={s.card} />
            )
          }
          onSwipedLeft={(i) => handleSwipe(i, "left")}
          onSwipedRight={(i) => handleSwipe(i, "right")}
          onSwipedTop={(i) => handleSwipedTop(i)}
          onSwipedAll={() => {
            if (cursor) loadFeed(cursor);
            else setEmpty(true);
          }}
          cardIndex={0}
          backgroundColor="transparent"
          stackSize={3}
          stackSeparation={12}
          animateCardOpacity
          animateOverlayLabelsOpacity
          overlayLabels={overlayLabels}
          verticalSwipe
          disableBottomSwipe
        />
      </View>

      <JobDetailModal
        jobId={detailJobId}
        visible={detailJobId !== null}
        onClose={() => setDetailJobId(null)}
      />
    </SafeAreaView>
  );
}

function JobCard({ job, onDetails }: { job: Job; onDetails: () => void }) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const htmlTagStyles = useMemo(() => makeHtmlTagStyles(colors), [colors]);
  const { width } = useWindowDimensions();

  return (
    <View style={s.card}>
      <View style={s.cardHeaderRow}>
        <Avatar name={job.company} logoUrl={job.companyLogoUrl} size={46} />
        <View style={s.cardHeaderText}>
          <Text style={s.cardCompany}>{job.company}</Text>
          {job.companyRating != null && job.companyReviewCount > 0 ? (
            <Text style={s.cardRating}>
              <Text style={s.cardRatingStar}>★ </Text>
              {job.companyRating.toFixed(1)} · {job.companyReviewCount} review
              {job.companyReviewCount === 1 ? "" : "s"}
            </Text>
          ) : null}
        </View>
      </View>
      <Text style={s.cardTitle}>{job.title}</Text>
      <View style={s.cardMetaRow}>
        {job.location ? <Text style={s.cardLocation}>{job.location}</Text> : null}
        {job.remote ? (
          <View style={s.remotePill}>
            <Text style={s.remotePillText}>Remote</Text>
          </View>
        ) : null}
      </View>

      <View style={s.descriptionContainer} pointerEvents="none">
        {job.descriptionText ? (
          <RenderHTML
            contentWidth={width - 80}
            source={{ html: job.descriptionText }}
            baseStyle={s.cardDescription}
            tagsStyles={htmlTagStyles}
            defaultTextProps={{ selectable: false }}
          />
        ) : null}
        <View style={s.fade} pointerEvents="none" />
      </View>

      <TouchableOpacity style={s.actionBtn} onPress={onDetails} activeOpacity={0.7}>
        <Text style={s.actionBtnText}>View details, reviews & salary</Text>
      </TouchableOpacity>

      <Text style={s.cardHint}>Swipe ← pass   ·   save → right   ·   ↑ up for details</Text>
    </View>
  );
}

// Tinder-style stamps that fade in as you drag the card (scheme-independent bg).
const stampBase = {
  fontSize: 30,
  fontWeight: "800" as const,
  borderWidth: 3,
  borderRadius: 12,
  paddingHorizontal: 14,
  paddingVertical: 4,
  overflow: "hidden" as const,
  backgroundColor: "rgba(255,255,255,0.92)",
};

const makeOverlayLabels = (colors: Palette) => ({
  left: {
    title: "PASS",
    style: {
      label: { ...stampBase, color: colors.danger, borderColor: colors.danger, transform: [{ rotate: "8deg" }] },
      wrapper: {
        flexDirection: "column" as const,
        alignItems: "flex-end" as const,
        justifyContent: "flex-start" as const,
        marginTop: 36,
        marginLeft: -36,
      },
    },
  },
  right: {
    title: "SAVE",
    style: {
      label: { ...stampBase, color: colors.success, borderColor: colors.success, transform: [{ rotate: "-8deg" }] },
      wrapper: {
        flexDirection: "column" as const,
        alignItems: "flex-start" as const,
        justifyContent: "flex-start" as const,
        marginTop: 36,
        marginLeft: 36,
      },
    },
  },
  top: {
    title: "DETAILS",
    style: {
      label: { ...stampBase, color: colors.accent, borderColor: colors.accent },
      wrapper: {
        flexDirection: "column" as const,
        alignItems: "center" as const,
        justifyContent: "center" as const,
      },
    },
  },
});

const makeHtmlTagStyles = (colors: Palette) => ({
  p: { marginBottom: 8, fontSize: 15, lineHeight: 22, color: colors.secondary },
  li: { marginBottom: 4, fontSize: 15, lineHeight: 22, color: colors.secondary },
  strong: { fontWeight: "600" as const, color: colors.label },
  b: { fontWeight: "600" as const, color: colors.label },
  h1: { fontSize: 16, fontWeight: "700" as const, marginVertical: 6, color: colors.label },
  h2: { fontSize: 15, fontWeight: "700" as const, marginVertical: 6, color: colors.label },
  h3: { fontSize: 14, fontWeight: "700" as const, marginVertical: 4, color: colors.label },
  a: { color: colors.accent },
  div: { marginBottom: 4 },
});

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    deckContainer: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background, padding: space.xxl },
    emptyEmoji: { fontSize: 44, marginBottom: space.md },
    emptyTitle: { ...font.title2, color: colors.label, marginBottom: space.xs },
    emptySubtitle: { ...font.subhead, color: colors.secondary, textAlign: "center" },
    emptyRefresh: { marginTop: space.xl, backgroundColor: colors.accentSoft, paddingHorizontal: space.xl, paddingVertical: space.md, borderRadius: radius.pill },
    emptyRefreshText: { ...font.subhead, color: colors.accent, fontWeight: "600" },

    deck: { flex: 1 },
    card: {
      height: "86%",
      borderRadius: radius.xl,
      backgroundColor: colors.surface,
      padding: space.xxl,
      ...shadow.card,
    },
    cardHeaderRow: { flexDirection: "row", alignItems: "center", gap: space.md, marginBottom: space.lg },
    cardHeaderText: { flex: 1, gap: 2 },
    cardCompany: {
      ...font.footnote,
      fontWeight: "700",
      color: colors.accent,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    cardRating: { ...font.footnote, color: colors.secondary, fontWeight: "600" },
    cardRatingStar: { color: colors.star },
    cardTitle: { ...font.title1, color: colors.label, marginBottom: space.md },
    cardMetaRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginBottom: space.lg },
    cardLocation: { ...font.subhead, color: colors.secondary },
    remotePill: { backgroundColor: colors.successSoft, paddingHorizontal: space.md, paddingVertical: 3, borderRadius: radius.pill },
    remotePillText: { ...font.caption, fontWeight: "600", color: colors.success },
    descriptionContainer: { flex: 1, overflow: "hidden" },
    cardDescription: { ...font.subhead, color: colors.secondary, lineHeight: 22 },
    fade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 48 },
    actionBtn: {
      backgroundColor: colors.accentSoft,
      paddingVertical: 13,
      borderRadius: radius.md,
      alignItems: "center",
      marginTop: space.lg,
    },
    actionBtnText: { ...font.subhead, color: colors.accent, fontWeight: "600" },
    cardHint: { ...font.caption, color: colors.tertiary, textAlign: "center", marginTop: space.md },

    topBar: {
      position: "absolute", top: space.sm, left: space.lg, right: space.lg, zIndex: 10,
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    },
    pillBtn: {
      flexDirection: "row", alignItems: "center",
      backgroundColor: colors.surface,
      paddingHorizontal: space.lg, paddingVertical: space.sm,
      borderRadius: radius.pill,
      ...shadow.floating,
    },
    pillBtnDisabled: { opacity: 0.35 },
    pillText: { ...font.subhead, fontWeight: "700", color: colors.accent },
    pillTextDisabled: { color: colors.tertiary },
  });
