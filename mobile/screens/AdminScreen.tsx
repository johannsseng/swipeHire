import { useState, useEffect, useCallback, useMemo } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, type AdminCompany } from "../lib/api";
import { useTheme, space, radius, font, shadow, type Palette } from "../theme";

export function AdminScreen() {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [items, setItems] = useState<AdminCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<AdminCompany | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.adminListCompanies();
      setItems(res.items);
    } catch (err: any) {
      Alert.alert("Couldn't load companies", err.message);
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

  function onSaved(updated: AdminCompany) {
    setItems((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    setEditing(null);
  }

  if (loading) {
    return (
      <SafeAreaView style={s.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <Text style={s.header}>Companies ({items.length})</Text>
      <Text style={s.sub}>
        Set a website so outreach can reach <Text style={s.mono}>careers@domain</Text>, or set a
        specific inbox.
      </Text>
      <FlatList
        data={items}
        keyExtractor={(c) => c.id}
        contentContainerStyle={s.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={s.card} onPress={() => setEditing(item)}>
            <View style={s.cardTop}>
              <Text style={s.cardName}>{item.name}</Text>
              <View
                style={[s.badge, item.inbox.email ? s.badgeOk : s.badgeMissing]}
              >
                <Text style={[s.badgeText, item.inbox.email ? s.badgeTextOk : s.badgeTextMissing]}>
                  {item.inbox.kind === "manual"
                    ? "Inbox set"
                    : item.inbox.kind === "careers"
                    ? "Careers"
                    : "Needs setup"}
                </Text>
              </View>
            </View>
            <Text style={s.cardInbox}>
              {item.inbox.email ?? "No domain or inbox — tap to add"}
            </Text>
            {item.website ? <Text style={s.cardWebsite}>{item.website}</Text> : null}
          </TouchableOpacity>
        )}
      />

      <EditModal company={editing} onClose={() => setEditing(null)} onSaved={onSaved} />
    </SafeAreaView>
  );
}

function EditModal({
  company,
  onClose,
  onSaved,
}: {
  company: AdminCompany | null;
  onClose: () => void;
  onSaved: (c: AdminCompany) => void;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [website, setWebsite] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset fields whenever a different company opens.
  useEffect(() => {
    setWebsite(company?.website ?? "");
    setEmail(company?.recruiterEmail ?? "");
  }, [company?.id]);

  async function save() {
    if (!company) return;
    const payload: { website?: string; email?: string } = {};
    if (website.trim()) payload.website = normalizeUrl(website.trim());
    if (email.trim()) payload.email = email.trim();
    if (!payload.website && !payload.email) {
      Alert.alert("Add something", "Enter a website/domain and/or a specific inbox email.");
      return;
    }
    setSaving(true);
    try {
      const res = await api.adminSetCompany(company.id, payload);
      onSaved(res.company);
    } catch (err: any) {
      Alert.alert("Couldn't save", err.message);
    } finally {
      setSaving(false);
    }
  }

  const previewInbox = email.trim()
    ? email.trim()
    : website.trim()
    ? `careers@${domainOf(website.trim()) ?? "…"}`
    : "—";

  return (
    <Modal visible={company !== null} animationType="slide" onRequestClose={onClose}>
      <View style={s.container}>
        <View style={s.modalHeader}>
          <TouchableOpacity onPress={onClose} hitSlop={16}>
            <Text style={s.close}>✕ Cancel</Text>
          </TouchableOpacity>
          <Text style={s.modalTitle} numberOfLines={1}>
            {company?.name}
          </Text>
        </View>

        <ScrollView contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
          <Text style={s.label}>Company website / domain</Text>
          <TextInput
            style={s.input}
            placeholder="https://stripe.com"
            placeholderTextColor={colors.tertiary}
            value={website}
            onChangeText={setWebsite}
            autoCapitalize="none"
            keyboardType="url"
            autoCorrect={false}
          />

          <Text style={s.label}>Specific inbox (optional)</Text>
          <TextInput
            style={s.input}
            placeholder="talent@stripe.com"
            placeholderTextColor={colors.tertiary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
          />

          <View style={s.previewBox}>
            <Text style={s.previewLabel}>Outreach will go to</Text>
            <Text style={s.previewValue}>{previewInbox}</Text>
          </View>

          <TouchableOpacity
            style={[s.saveBtn, saving && s.saveBtnDisabled]}
            onPress={save}
            disabled={saving}
          >
            <Text style={s.saveBtnText}>{saving ? "Saving…" : "Save"}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

function domainOf(input: string): string | null {
  let s = input.toLowerCase();
  if (!/^https?:\/\//.test(s)) s = `https://${s}`;
  try {
    return new URL(s).hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

function normalizeUrl(input: string): string {
  return /^https?:\/\//.test(input) ? input : `https://${input}`;
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background },
  header: { ...font.largeTitle, color: colors.label, paddingHorizontal: space.xl, paddingTop: space.lg },
  sub: { ...font.footnote, color: colors.secondary, paddingHorizontal: space.xl, paddingTop: space.xs, paddingBottom: space.md, lineHeight: 18 },
  mono: { fontFamily: "Courier", color: colors.label },
  list: { paddingHorizontal: space.lg, paddingBottom: space.xxl },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.md, padding: space.lg, marginBottom: space.md,
    ...shadow.card,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.sm },
  cardName: { ...font.headline, color: colors.label, flex: 1 },
  badge: { paddingHorizontal: space.md, paddingVertical: 4, borderRadius: radius.pill },
  badgeOk: { backgroundColor: colors.successSoft },
  badgeMissing: { backgroundColor: colors.dangerSoft },
  badgeText: { ...font.caption, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  badgeTextOk: { color: colors.success },
  badgeTextMissing: { color: colors.danger },
  cardInbox: { ...font.subhead, color: colors.accent, marginTop: space.sm },
  cardWebsite: { ...font.caption, color: colors.tertiary, marginTop: 2 },
  modalHeader: {
    flexDirection: "row", alignItems: "center", gap: space.md,
    paddingHorizontal: space.xl, paddingTop: 56, paddingBottom: space.md, backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator,
  },
  modalTitle: { ...font.title3, color: colors.label, flex: 1 },
  close: { ...font.body, color: colors.accent, fontWeight: "600" },
  form: { padding: space.lg, gap: space.sm },
  label: { ...font.footnote, fontWeight: "600", color: colors.secondary, marginTop: space.md, marginBottom: space.xs },
  input: {
    backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.separator,
    borderRadius: radius.sm, padding: space.md, fontSize: 15, color: colors.label,
  },
  previewBox: { backgroundColor: colors.accentSoft, borderRadius: radius.md, padding: space.lg, marginTop: space.lg },
  previewLabel: { ...font.caption, color: colors.accent, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  previewValue: { ...font.headline, color: "#0856C9", marginTop: space.xs },
  saveBtn: { backgroundColor: colors.accent, paddingVertical: 15, borderRadius: radius.md, alignItems: "center", marginTop: space.xl },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { ...font.headline, color: colors.inverse },
});
