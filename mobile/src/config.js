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
  if (extra?.apiUrl) {
    return String(extra.apiUrl).replace(/\/$/, "");
  }
  if (process.env.EXPO_PUBLIC_API_URL) {
    return String(process.env.EXPO_PUBLIC_API_URL).replace(/\/$/, "");
  }

  const hostIp = getHostIp();
  if (hostIp && hostIp !== "localhost" && hostIp !== "127.0.0.1") {
    return `http://${hostIp}:5000`;
  }

  if (Platform.OS === "android") {
    //return "http://10.128.8.5:5000";
    return "https://roopsy.onrender.com";
  }
  //return "http://localhost:5000";
  return "https://roopsy.onrender.com"
}

export const API_PREFIX = "/api";
