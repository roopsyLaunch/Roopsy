import { Platform } from "react-native";
import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra;

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

/** Android emulator: 10.0.2.2 = host machine. Physical device: dynamically resolves from Expo hostUri or EXPO_PUBLIC_API_URL */
export function getApiBaseUrl() {
  // 1. Check process.env directly
  let url = process.env.EXPO_PUBLIC_API_URL;
  
  // 2. Check Expo Constants extra config
  if (!url) {
    url = Constants.expoConfig?.extra?.apiUrl;
  }
  
  // 3. Fallback to live production server
  if (!url) {
    url = "https://roopsy.onrender.com";
  }

  // Remove trailing slash if present
  if (url && typeof url === "string" && url.endsWith("/")) {
    url = url.slice(0, -1);
  }
  
  console.log("[Mobile Config] Resolved API URL:", url);
  return url;
}

export const API_PREFIX = "/api";
