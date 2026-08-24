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
  // 1. Check Expo Constants extra config
  let url = Constants.expoConfig?.extra?.apiUrl;
  
  // 2. Check process.env directly
  if (!url) {
    url = process.env.EXPO_PUBLIC_API_URL;
  }
  
  // 3. Dynamic Host IP fallback
  if (!url) {
    const hostIp = getHostIp();
    if (hostIp) {
      url = `http://${hostIp}:5000`;
    }
  }
  
  // 4. Final static fallback
  if (!url) {
    url = "http://10.35.125.5:5000";
  }
  
  console.log("[Mobile Config] Resolved API URL:", url);
  return url;
}

export const API_PREFIX = "/api";
