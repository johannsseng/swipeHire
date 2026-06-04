import { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from "react-native";
import { api, type User } from "../lib/api";
import { colors, space, radius, font, shadow } from "../theme";

export function SettingsModal({
  visible,
  email,
  onClose,
  onEmailChanged,
  onSignOut,
}: {
  visible: boolean;
  email: string;
  onClose: () => void;
  onEmailChanged: (user: User) => void;
  onSignOut: () => void | Promise<void>;
}) {
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [resumeText, setResumeText] = useState("");
  const [resumeStatus, setResumeStatus] = useState<string | null>(null);
  const [savingResume, setSavingResume] = useState(false);

  useEffect(() => {
    if (visible) {
      setNewEmail("");
      setEmailPassword("");
      setCurrentPw("");
      setNewPw("");
      setResumeText("");
      api
        .getResume()
        .then((r) =>
          setResumeStatus(
            r.hasResume ? `Resume on file · ${r.keywordCount} keywords` : null
          )
        )
        .catch(() => setResumeStatus(null));
    }
  }, [visible]);

  async function saveResume() {
    if (resumeText.trim().length < 50) {
      Alert.alert("Resume too short", "Paste your full resume text (at least 50 characters).");
      return;
    }
    setSavingResume(true);
    try {
      const res = await api.saveResume(resumeText.trim());
      setResumeStatus(`Resume on file · ${res.keywordCount} keywords`);
      setResumeText("");
      Alert.alert(
        "Resume scanned",
        `Extracted ${res.keywordCount} keywords. Your feed is now matched against your resume.`
      );
    } catch (err: any) {
      Alert.alert("Couldn't save resume", err.message);
    } finally {
      setSavingResume(false);
    }
  }

  async function saveEmail() {
    if (!newEmail.trim() || !emailPassword) {
      Alert.alert("Missing info", "Enter your new email and current password.");
      return;
    }
    setSavingEmail(true);
    try {
      const res = await api.updateEmail(emailPassword, newEmail.trim());
      onEmailChanged(res.user);
      setNewEmail("");
      setEmailPassword("");
      Alert.alert("Email updated", "Your email has been changed.");
    } catch (err: any) {
      Alert.alert("Couldn't update email", err.message);
    } finally {
      setSavingEmail(false);
    }
  }

  async function savePassword() {
    if (!currentPw || newPw.length < 8) {
      Alert.alert("Check your input", "New password must be at least 8 characters.");
      return;
    }
    setSavingPw(true);
    try {
      await api.updatePassword(currentPw, newPw);
      setCurrentPw("");
      setNewPw("");
      Alert.alert("Password changed", "Use your new password next time you log in.");
    } catch (err: any) {
      Alert.alert("Couldn't change password", err.message);
    } finally {
      setSavingPw(false);
    }
  }

  function confirmDelete() {
    Alert.alert(
      "Delete account?",
      "This permanently deletes your account, saved jobs, and reviews. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await api.deleteAccount();
            } catch (err: any) {
              Alert.alert("Couldn't delete account", err.message);
              return;
            }
            await onSignOut();
          },
        },
      ]
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} hitSlop={16}>
            <Text style={s.close}>✕ Close</Text>
          </TouchableOpacity>
          <Text style={s.title}>Account</Text>
        </View>

        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <Text style={s.signedInLabel}>Signed in as</Text>
          <Text style={s.signedInEmail}>{email}</Text>

          {/* Resume (powers SmartFeed's scanner layer) */}
          <Text style={s.section}>Resume</Text>
          <View style={s.card}>
            {resumeStatus ? <Text style={s.resumeStatus}>✓ {resumeStatus}</Text> : (
              <Text style={s.resumeHint}>
                Paste your resume and we'll match jobs against it. Your swipes refine it from there.
              </Text>
            )}
            <TextInput
              style={[s.input, s.resumeInput]}
              placeholder="Paste your resume text here…"
              placeholderTextColor={colors.tertiary}
              value={resumeText}
              onChangeText={setResumeText}
              multiline
            />
            <TouchableOpacity
              style={[s.primaryBtn, savingResume && s.btnDisabled]}
              onPress={saveResume}
              disabled={savingResume}
            >
              <Text style={s.primaryBtnText}>
                {savingResume ? "Scanning…" : resumeStatus ? "Replace resume" : "Scan resume"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Email */}
          <Text style={s.section}>Change email</Text>
          <View style={s.card}>
            <TextInput
              style={s.input}
              placeholder="New email"
              placeholderTextColor={colors.tertiary}
              value={newEmail}
              onChangeText={setNewEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
            <TextInput
              style={s.input}
              placeholder="Current password"
              placeholderTextColor={colors.tertiary}
              value={emailPassword}
              onChangeText={setEmailPassword}
              secureTextEntry
            />
            <TouchableOpacity
              style={[s.primaryBtn, savingEmail && s.btnDisabled]}
              onPress={saveEmail}
              disabled={savingEmail}
            >
              <Text style={s.primaryBtnText}>{savingEmail ? "Updating…" : "Update email"}</Text>
            </TouchableOpacity>
          </View>

          {/* Password */}
          <Text style={s.section}>Change password</Text>
          <View style={s.card}>
            <TextInput
              style={s.input}
              placeholder="Current password"
              placeholderTextColor={colors.tertiary}
              value={currentPw}
              onChangeText={setCurrentPw}
              secureTextEntry
            />
            <TextInput
              style={s.input}
              placeholder="New password (min 8 characters)"
              placeholderTextColor={colors.tertiary}
              value={newPw}
              onChangeText={setNewPw}
              secureTextEntry
            />
            <TouchableOpacity
              style={[s.primaryBtn, savingPw && s.btnDisabled]}
              onPress={savePassword}
              disabled={savingPw}
            >
              <Text style={s.primaryBtnText}>{savingPw ? "Saving…" : "Change password"}</Text>
            </TouchableOpacity>
          </View>

          {/* Session */}
          <TouchableOpacity style={s.logoutBtn} onPress={() => onSignOut()}>
            <Text style={s.logoutText}>Log out</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.deleteBtn} onPress={confirmDelete}>
            <Text style={s.deleteText}>Delete account</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
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
  title: { ...font.title3, color: colors.label, flex: 1 },
  close: { ...font.body, color: colors.accent, fontWeight: "600" },
  scroll: { padding: space.lg },
  signedInLabel: { ...font.caption, color: colors.tertiary, textTransform: "uppercase", fontWeight: "700", letterSpacing: 0.4 },
  signedInEmail: { ...font.headline, color: colors.label, marginTop: 2 },
  section: { ...font.footnote, fontWeight: "600", color: colors.secondary, textTransform: "uppercase", letterSpacing: 0.4, marginTop: space.xxl, marginBottom: space.sm },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: space.lg, gap: space.sm, ...shadow.card },
  resumeStatus: { ...font.footnote, color: colors.success, fontWeight: "600" },
  resumeHint: { ...font.footnote, color: colors.secondary, lineHeight: 18 },
  resumeInput: { minHeight: 120, textAlignVertical: "top" },
  input: {
    backgroundColor: colors.background, borderRadius: radius.sm,
    paddingHorizontal: space.md, paddingVertical: 12, fontSize: 15, color: colors.label,
  },
  primaryBtn: { backgroundColor: colors.accent, paddingVertical: 13, borderRadius: radius.sm, alignItems: "center", marginTop: space.xs },
  primaryBtnText: { ...font.subhead, color: colors.inverse, fontWeight: "600" },
  btnDisabled: { opacity: 0.5 },
  logoutBtn: { backgroundColor: colors.surface, paddingVertical: 14, borderRadius: radius.md, alignItems: "center", marginTop: space.xxl, ...shadow.card },
  logoutText: { ...font.headline, color: colors.accent },
  deleteBtn: { paddingVertical: 14, alignItems: "center", marginTop: space.sm },
  deleteText: { ...font.subhead, color: colors.danger, fontWeight: "600" },
});
