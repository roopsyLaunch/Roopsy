import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_PREFIX, getApiBaseUrl } from "../config";

const TOKEN_KEY = "barber_app_token";

export const api = axios.create({
  baseURL: `${getApiBaseUrl()}${API_PREFIX}`,
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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
