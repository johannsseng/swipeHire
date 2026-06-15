import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Pressable,
  Linking,
  useWindowDimensions,
} from "react-native";
import RenderHTML from "react-native-render-html";
import { api, type JobDetail, type ReviewsResponse } from "../lib/api";
import { OutreachModal } from "./OutreachModal";
import { Avatar } from "./Avatar";
import { useTheme, space, radius, font, shadow, type Palette } from "../theme";

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  const { colors } = useTheme();
  return (
    <Text style={{ fontSize: size, color: colors.star, letterSpacing: 1 }}>
      {"★★★★★".slice(0, value)}
      <Text style={{ color: colors.separator }}>{"★★★★★".slice(value)}</Text>
    </Text>
  );
}

export function JobDetailModal({
  jobId,
  visible,
  onClose,
}: {
  jobId: string | null;
  visible: boolean;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const htmlTagStyles = useMemo(() => makeHtmlTagStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [reviews, setReviews] = useState<ReviewsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [outreachOpen, setOutreachOpen] = useState(false);

  // Review compose
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadReviews = useCallback(async () => {
    if (!jobId) return;
    try {
      setReviews(await api.getReviews(jobId));
    } catch (err: any) {
      console.warn("reviews load failed", err.message);
    }
  }, [jobId]);

  useEffect(() => {
    if (!visible || !jobId) return;
    setJob(null);
    setReviews(null);
    setRating(0);
    setTitle("");
    setBody("");
    setLoading(true);
    (async () => {
      try {
        const [j] = await Promise.all([api.getJob(jobId), loadReviews()]);
        setJob(j);
      } catch (err: any) {
        Alert.alert("Couldn't load job", err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [visible, jobId, loadReviews]);

  async function submitReview() {
    if (!jobId || rating === 0) {
      Alert.alert("Pick a rating", "Tap a star to rate this company first.");
      return;
    }
    setSubmitting(true);
    try {
      await api.submitReview(jobId, {
        rating,
        title: title.trim() || undefined,
        body: body.trim() || undefined,
      });
      setTitle("");
      setBody("");
      setRating(0);
      await loadReviews();
    } catch (err: any) {
      Alert.alert("Couldn't submit review", err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const recruiter = job?.recruiter;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.container}>
        <View style={s.headerRow}>
          <TouchableOpacity onPress={onClose} hitSlop={16} style={s.closeBtn}>
            <Text style={s.close}>✕ Close</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle} numberOfLines={1}>
            {job ? job.company : "Job details"}
          </Text>
        </View>

        {loading || !job ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.scroll}>
            {/* Title block */}
            <View style={s.titleRow}>
              <Avatar name={job.company} logoUrl={job.companyLogoUrl} size={52} />
              <Text style={s.company}>{job.company}</Text>
            </View>
            <Text style={s.title}>{job.title}</Text>
            {job.location ? <Text style={s.meta}>📍 {job.location}</Text> : null}
            <View style={s.chipRow}>
              {job.employmentType ? (
                <Text style={s.chip}>{job.employmentType.replace("_", " ")}</Text>
              ) : null}
              {job.remote ? <Text style={s.chip}>Remote</Text> : null}
            </View>

            {/* Salary */}
            <View style={s.salaryCard}>
              <Text style={s.salaryLabel}>Salary</Text>
              <Text style={s.salaryValue}>{job.salary ?? "Not disclosed"}</Text>
            </View>

            <TouchableOpacity
              style={s.applyButton}
              onPress={() => Linking.openURL(job.applyUrl)}
            >
              <Text style={s.applyButtonText}>Apply on company site →</Text>
            </TouchableOpacity>

            {/* Recruiter */}
            <Text style={s.sectionTitle}>Recruiter</Text>
            <View style={s.recruiterCard}>
              {recruiter?.email ? (
                <>
                  <Text style={s.recruiterName}>
                    {recruiter.name ?? "Recruiting team"}
                    {recruiter.title ? ` · ${recruiter.title}` : ""}
                  </Text>
                  <Text style={s.recruiterEmail}>{recruiter.email}</Text>
                </>
              ) : (
                <Text style={s.recruiterEmpty}>No recruiter contact on file yet.</Text>
              )}
              <TouchableOpacity
                style={[s.reachBtn, !recruiter?.email && s.reachBtnMuted]}
                onPress={() => setOutreachOpen(true)}
              >
                <Text style={s.reachBtnText}>Reach out</Text>
              </TouchableOpacity>
            </View>

            {/* Description */}
            <Text style={s.sectionTitle}>Description</Text>
            <View style={s.descCard}>
              {job.descriptionHtml ? (
                <RenderHTML
                  contentWidth={width - 64}
                  source={{ html: job.descriptionHtml }}
                  baseStyle={s.descText}
                  tagsStyles={htmlTagStyles}
                />
              ) : (
                <Text style={s.recruiterEmpty}>No description provided.</Text>
              )}
            </View>

            {/* Reviews */}
            <Text style={s.sectionTitle}>
              Reviews
              {reviews && reviews.summary.count > 0
                ? `  ·  ${reviews.summary.averageRating?.toFixed(1)} (${reviews.summary.count})`
                : ""}
            </Text>

            <View style={s.composeCard}>
              <Text style={s.composeTitle}>Rate this company</Text>
              <View style={s.starsPickerRow}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable key={n} onPress={() => setRating(n)} hitSlop={6}>
                    <Text style={[s.pickStar, n <= rating && s.pickStarOn]}>★</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                style={s.input}
                placeholder="Title (optional)"
                placeholderTextColor={colors.tertiary}
                value={title}
                onChangeText={setTitle}
                maxLength={120}
              />
              <TextInput
                style={[s.input, s.inputMultiline]}
                placeholder="Share your experience (optional)"
                placeholderTextColor={colors.tertiary}
                value={body}
                onChangeText={setBody}
                multiline
                maxLength={4000}
              />
              <TouchableOpacity
                style={[s.submitBtn, submitting && s.btnDisabled]}
                onPress={submitReview}
                disabled={submitting}
              >
                <Text style={s.submitBtnText}>
                  {submitting ? "Submitting…" : "Submit review"}
                </Text>
              </TouchableOpacity>
            </View>

            {reviews?.reviews.length === 0 && (
              <Text style={s.empty}>No reviews yet. Be the first!</Text>
            )}
            {reviews?.reviews.map((r) => (
              <View key={r.id} style={s.reviewCard}>
                <View style={s.reviewHead}>
                  <Stars value={r.rating} />
                  <Text style={s.badge}>
                    {r.source === "glassdoor" ? "Glassdoor" : r.isMine ? "You" : "SwipeHire"}
                  </Text>
                </View>
                {r.title ? <Text style={s.reviewTitle}>{r.title}</Text> : null}
                {r.authorTitle ? <Text style={s.reviewAuthor}>{r.authorTitle}</Text> : null}
                {r.body ? <Text style={s.reviewBody}>{r.body}</Text> : null}
                {r.pros ? <Text style={s.pros}>＋ {r.pros}</Text> : null}
                {r.cons ? <Text style={s.cons}>－ {r.cons}</Text> : null}
              </View>
            ))}

            <View style={{ height: 40 }} />
          </ScrollView>
        )}

        <OutreachModal
          jobId={outreachOpen ? jobId : null}
          visible={outreachOpen}
          onClose={() => setOutreachOpen(false)}
        />
      </View>
    </Modal>
  );
}

const makeHtmlTagStyles = (colors: Palette) => ({
  p: { marginBottom: 10, fontSize: 15, lineHeight: 22, color: colors.secondary },
  li: { marginBottom: 6, fontSize: 15, lineHeight: 22, color: colors.secondary },
  strong: { fontWeight: "600" as const, color: colors.label },
  b: { fontWeight: "600" as const, color: colors.label },
  h1: { fontSize: 18, fontWeight: "700" as const, marginVertical: 8, color: colors.label },
  h2: { fontSize: 16, fontWeight: "700" as const, marginVertical: 8, color: colors.label },
  h3: { fontSize: 15, fontWeight: "700" as const, marginVertical: 6, color: colors.label },
  a: { color: colors.accent },
});

const makeStyles = (colors: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingTop: 56,
    paddingBottom: space.md,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  headerTitle: { ...font.headline, flex: 1, color: colors.label },
  closeBtn: { paddingVertical: 6, paddingRight: 6 },
  close: { ...font.body, color: colors.accent, fontWeight: "600" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll: { padding: space.lg },

  titleRow: { flexDirection: "row", alignItems: "center", gap: space.md, marginBottom: space.md },
  company: { ...font.footnote, fontWeight: "700", color: colors.accent, textTransform: "uppercase", letterSpacing: 0.6, flex: 1 },
  title: { ...font.title1, color: colors.label, marginTop: space.xs, marginBottom: space.sm },
  meta: { ...font.subhead, color: colors.secondary, marginBottom: space.md },
  chipRow: { flexDirection: "row", gap: space.sm, marginBottom: space.lg, flexWrap: "wrap" },
  chip: {
    ...font.caption, fontWeight: "600", color: colors.secondary, backgroundColor: colors.background,
    paddingHorizontal: space.md, paddingVertical: 5, borderRadius: radius.pill, textTransform: "capitalize",
    overflow: "hidden",
  },

  salaryCard: {
    backgroundColor: colors.successSoft, borderRadius: radius.md, padding: space.lg, marginBottom: space.md,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  salaryLabel: { ...font.subhead, fontWeight: "600", color: colors.success },
  salaryValue: { ...font.headline, color: "#1E7A3D", flexShrink: 1, textAlign: "right" },

  applyButton: { backgroundColor: colors.accent, paddingVertical: 14, borderRadius: radius.md, alignItems: "center" },
  applyButtonText: { ...font.headline, color: colors.inverse },

  sectionTitle: { ...font.title3, color: colors.label, marginTop: space.xxl, marginBottom: space.md },

  recruiterCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: space.lg, gap: space.xs, ...shadow.card },
  recruiterName: { ...font.callout, fontWeight: "600", color: colors.label },
  recruiterEmail: { ...font.subhead, color: colors.accent },
  recruiterEmpty: { ...font.subhead, color: colors.tertiary },
  reachBtn: { backgroundColor: colors.accentSoft, paddingVertical: 12, borderRadius: radius.sm, alignItems: "center", marginTop: space.md },
  reachBtnMuted: { backgroundColor: colors.background },
  reachBtnText: { ...font.subhead, color: colors.accent, fontWeight: "600" },

  descCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: space.lg, ...shadow.card },
  descText: { ...font.subhead, lineHeight: 22, color: colors.secondary },

  composeCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: space.lg, gap: space.md, ...shadow.card },
  composeTitle: { ...font.headline, color: colors.label },
  starsPickerRow: { flexDirection: "row", gap: space.sm },
  pickStar: { fontSize: 36, color: colors.separator },
  pickStarOn: { color: colors.star },
  input: {
    backgroundColor: colors.background, borderRadius: radius.sm, paddingHorizontal: space.md, paddingVertical: 12,
    fontSize: 15, color: colors.label,
  },
  inputMultiline: { minHeight: 90, textAlignVertical: "top" },
  submitBtn: { backgroundColor: colors.accent, paddingVertical: 13, borderRadius: radius.sm, alignItems: "center" },
  submitBtnText: { ...font.subhead, color: colors.inverse, fontWeight: "600" },
  btnDisabled: { opacity: 0.5 },

  empty: { ...font.subhead, textAlign: "center", color: colors.tertiary, marginTop: space.lg },
  reviewCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: space.lg, gap: space.sm, marginTop: space.md, ...shadow.card },
  reviewHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  badge: { ...font.caption, color: colors.tertiary, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  reviewTitle: { ...font.callout, fontWeight: "600", color: colors.label },
  reviewAuthor: { ...font.caption, color: colors.tertiary },
  reviewBody: { ...font.subhead, color: colors.secondary, lineHeight: 22 },
  pros: { ...font.footnote, color: colors.success },
  cons: { ...font.footnote, color: colors.danger },
});
