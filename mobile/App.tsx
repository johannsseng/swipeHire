import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import {
  api,
  setTokens,
  clearTokens,
  getAccessToken,
  setUnauthorizedHandler,
  type User,
} from "./lib/api";
import { DiscoverScreen } from "./screens/DiscoverScreen";
import { SavedScreen } from "./screens/SavedScreen";
import { AdminScreen } from "./screens/AdminScreen";
import { SettingsModal } from "./components/SettingsModal";
import { colors, space, radius, font } from "./theme";

const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, string> = {
  Discover: "🧭",
  Saved: "🔖",
  Admin: "⚙️",
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    // If a refresh ultimately fails mid-session, drop back to the login screen.
    setUnauthorizedHandler(() => {
      setUser(null);
      setEmail("");
      setPassword("");
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    (async () => {
      const token = await getAccessToken();
      if (token) {
        try {
          setUser(await api.me());
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
      Alert.alert("Something went wrong", err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    setSettingsOpen(false);
    await clearTokens();
    setUser(null);
    setEmail("");
    setPassword("");
  }

  if (loading) {
    return (
      <SafeAreaView style={s.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </SafeAreaView>
    );
  }

  if (user) {
    return (
      <>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            tabBarActiveTintColor: colors.accent,
            tabBarInactiveTintColor: colors.tertiary,
            tabBarStyle: {
              backgroundColor: colors.surface,
              borderTopColor: colors.separator,
              paddingTop: 6,
            },
            tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
            tabBarIcon: ({ focused }) => (
              <Text style={{ fontSize: 17, opacity: focused ? 1 : 0.35 }}>
                {TAB_ICONS[route.name] ?? "•"}
              </Text>
            ),
            headerStyle: { backgroundColor: colors.surface, shadowColor: "transparent" },
            headerTitleStyle: { ...font.title3, color: colors.label },
            headerShadowVisible: false,
          })}
        >
          <Tab.Screen
            name="Discover"
            options={{
              headerRight: () => (
                <Text style={s.headerLogout} onPress={() => setSettingsOpen(true)}>
                  Account
                </Text>
              ),
            }}
          >
            {() => <DiscoverScreen user={user} />}
          </Tab.Screen>
          <Tab.Screen name="Saved" component={SavedScreen} options={{ headerShown: false }} />
          {user.role === "admin" && (
            <Tab.Screen
              name="Admin"
              component={AdminScreen}
              options={{ headerShown: false }}
            />
          )}
        </Tab.Navigator>
      </NavigationContainer>
      <SettingsModal
        visible={settingsOpen}
        email={user.email}
        onClose={() => setSettingsOpen(false)}
        onEmailChanged={(u) => setUser(u)}
        onSignOut={handleLogout}
      />
      </>
    );
  }

  const isRegister = mode === "register";

  return (
    <SafeAreaView style={s.authContainer}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={s.authInner}
      >
        <View style={s.brand}>
          <Text style={s.brandMark}>SwipeHire</Text>
          <Text style={s.brandTagline}>Swipe your way to your next role.</Text>
        </View>

        <View style={s.formCard}>
          <TextInput
            style={s.input}
            placeholder="Email"
            placeholderTextColor={colors.tertiary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />
          <View style={s.inputDivider} />
          <TextInput
            style={s.input}
            placeholder="Password"
            placeholderTextColor={colors.tertiary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        <TouchableOpacity style={s.primaryBtn} onPress={handleSubmit} activeOpacity={0.85}>
          <Text style={s.primaryBtnText}>
            {isRegister ? "Create account" : "Log in"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.linkBtn}
          onPress={() => setMode(isRegister ? "login" : "register")}
        >
          <Text style={s.linkText}>
            {isRegister ? "Have an account? " : "New here? "}
            <Text style={s.linkTextStrong}>{isRegister ? "Log in" : "Sign up"}</Text>
          </Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background },
  headerLogout: { ...font.subhead, color: colors.accent, fontWeight: "600", marginRight: space.lg },

  authContainer: { flex: 1, backgroundColor: colors.background },
  authInner: { flex: 1, justifyContent: "center", paddingHorizontal: space.xxl, gap: space.xl },
  brand: { alignItems: "center", marginBottom: space.sm },
  brandMark: { ...font.largeTitle, color: colors.label },
  brandTagline: { ...font.subhead, color: colors.secondary, marginTop: space.xs },

  formCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    overflow: "hidden",
  },
  input: { ...font.body, color: colors.label, paddingHorizontal: space.lg, paddingVertical: 15 },
  inputDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.separator, marginLeft: space.lg },

  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: "center",
  },
  primaryBtnText: { ...font.headline, color: colors.inverse },

  linkBtn: { alignItems: "center", paddingVertical: space.sm },
  linkText: { ...font.subhead, color: colors.secondary },
  linkTextStrong: { color: colors.accent, fontWeight: "600" },
});
