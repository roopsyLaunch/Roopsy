import { Platform } from "react-native";
import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra;
const LIVE_PRODUCTION_URL = "https://roopsy.onrender.com";

function getHostIp() {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest2?.extra?.expoGo?.developer?.manifest?.debuggerHost ||
    Constants.manifest?.debuggerHost;
  if (hostUri) {
    return hostUri.split(":")[0];
  }
  return null;
}

/**
 * Android emulator: 10.0.2.2 = host machine.
 * Physical device: dynamically resolves from Expo hostUri or EXPO_PUBLIC_API_URL.
 * Production / Release builds: ALWAYS uses the live production Render server.
 */
export function getApiBaseUrl() {
  // 1. In standalone / production builds (Play Store APK/AAB), ALWAYS enforce live production server
  if (typeof __DEV__ !== "undefined" && !__DEV__) {
    return LIVE_PRODUCTION_URL;
  }

  // 2. In development, check process.env or Expo extra config
  let url = process.env.EXPO_PUBLIC_API_URL || Constants.expoConfig?.extra?.apiUrl;

  // 3. If running in dev on physical device without set URL, attempt host IP detection
  if (!url) {
    const hostIp = getHostIp();
    url = hostIp ? `http://${hostIp}:5000` : LIVE_PRODUCTION_URL;
  }

  // Clean whitespace and remove trailing slash if present
  if (url && typeof url === "string") {
    url = url.trim().replace(/^http:\/\/\s+/, "http://").replace(/^https:\/\/\s+/, "https://");
    if (url.endsWith("/")) {
      url = url.slice(0, -1);
    }
  }

  return url || LIVE_PRODUCTION_URL;
}

export const API_PREFIX = "/api";
