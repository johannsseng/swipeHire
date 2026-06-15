import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

// Token storage that works on both native and web.
//   • Native  → expo-secure-store (device keychain)
//   • Web     → localStorage (SecureStore isn't available in a browser)
// Native behavior is unchanged; only the web branch is new.

export async function storageSet(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* private mode / storage disabled — ignore */
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function storageGet(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

export async function storageDelete(key: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
