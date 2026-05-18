import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from "react-native";
import {
  api,
  setTokens,
  clearTokens,
  getAccessToken,
  type User,
} from "./lib/api";

export default function App() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await getAccessToken();
      if (token) {
        try {
          const u = await api.me();
          setUser(u);
        } catch {
          await clearTokens();
        }
      }
      setLoading(false);
    })();
  }, []);

  async function handleSubmit() {
    try {
      setLoading(true);
      const res =
        mode === "register"
          ? await api.register(email, password)
          : await api.login(email, password);
      await setTokens(res.accessToken, res.refreshToken);
      setUser(res.user);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await clearTokens();
    setUser(null);
    setEmail("");
    setPassword("");
  }

  if (loading) {
    return (
      <SafeAreaView style={s.center}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (user) {
    return (
      <SafeAreaView style={s.container}>
        <Text style={s.title}>Welcome!</Text>
        <Text style={s.subtitle}>{user.email}</Text>
        <Text style={s.meta}>Tier: {user.verifiedTier}</Text>
        <View style={s.spacer} />
        <Button title="Log out" onPress={handleLogout} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <Text style={s.title}>{mode === "register" ? "Sign up" : "Log in"}</Text>
      <TextInput
        style={s.input}
        placeholder="email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={s.input}
        placeholder="password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Button
        title={mode === "register" ? "Create account" : "Log in"}
        onPress={handleSubmit}
      />
      <View style={s.spacer} />
      <Button
        title={
          mode === "register"
            ? "Have an account? Log in"
            : "Need an account? Sign up"
        }
        onPress={() => setMode(mode === "register" ? "login" : "register")}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#fff",
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 32, fontWeight: "bold", marginBottom: 8 },
  subtitle: { fontSize: 18 },
  meta: { fontSize: 14, color: "#666" },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  spacer: { height: 16 },
});