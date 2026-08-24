import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_PREFIX, getApiBaseUrl } from "../config";

const TOKEN_KEY = "barber_app_token";
const SESSION_KEY = "barber_app_session_data";

export const api = axios.create({
  baseURL: `${getApiBaseUrl()}${API_PREFIX}`,
  headers: { 
    "Content-Type": "application/json",
    "Bypass-Tunnel-Reminder": "true"
  },
  timeout: 15000,
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let onUnauthorizedCallback = null;

export function registerUnauthorizedCallback(callback) {
  onUnauthorizedCallback = callback;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response ? error.response.status : null;
    if (status === 401) {
      if (onUnauthorizedCallback) {
        try {
          await onUnauthorizedCallback();
        } catch (err) {
          console.log("Error in unauthorized callback:", err);
        }
      }
    }
    return Promise.reject(error);
  }
);

export async function setStoredToken(token) {
  if (token) {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } else {
    await AsyncStorage.removeItem(TOKEN_KEY);
  }
}

export async function getStoredToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setStoredSession(session) {
  if (session) {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    await AsyncStorage.removeItem(SESSION_KEY);
  }
}

export async function getStoredSession() {
  try {
    const session = await AsyncStorage.getItem(SESSION_KEY);
    return session ? JSON.parse(session) : null;
  } catch (err) {
    console.log("Error parsing stored session", err);
    return null;
  }
}

