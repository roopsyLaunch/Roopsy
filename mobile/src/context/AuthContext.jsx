import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { api, getStoredToken, setStoredToken, getStoredSession, setStoredSession, registerUnauthorizedCallback } from "../api/client";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function registerForPushNotificationsAsync() {
  let token;
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== "granted") {
        console.log("Failed to get push token for push notification!");
        return null;
      }

      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ??
        Constants?.easConfig?.projectId;

      token = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined
      );
    } else {
      console.log("Must use physical device for Push Notifications");
    }
  } catch (e) {
    console.log("Push notifications skipped (Expo Go limitation or unconfigured EAS Project ID):", e?.message || e);
    return null;
  }
  return token?.data;
}

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [barber, setBarber] = useState(null);
  const [tailor, setTailor] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  const applySession = useCallback((payload) => {
    setUser(payload.user ?? null);
    setBarber(payload.barber ?? null);
    setTailor(payload.tailor ?? null);
    setFavorites(payload.user?.favoriteShops ?? []);
    setStoredSession(payload).catch((err) =>
      console.log("Failed to save session data in AsyncStorage", err)
    );
  }, []);

  const refreshMe = useCallback(async () => {
    const t = await getStoredToken();
    if (!t) {
      setToken(null);
      setUser(null);
      setBarber(null);
      setTailor(null);
      setFavorites([]);
      await setStoredSession(null);
      return;
    }
    setToken(t);
    const res = await api.get("/auth/me");
    applySession(res.data);
  }, [applySession]);

  const updatePushToken = useCallback(async () => {
    try {
      const expoPushToken = await registerForPushNotificationsAsync();
      if (expoPushToken) {
        await api.patch("/auth/push-token", { token: expoPushToken });
      }
    } catch (err) {
      console.log("Error updating push token", err);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      let hasCachedSession = false;
      try {
        const storedToken = await getStoredToken();
        const storedSession = await getStoredSession();
        if (active && storedToken && storedSession) {
          setToken(storedToken);
          setUser(storedSession.user ?? null);
          setBarber(storedSession.barber ?? null);
          setTailor(storedSession.tailor ?? null);
          setFavorites(storedSession.user?.favoriteShops ?? []);
          hasCachedSession = true;
        }
      } catch (err) {
        console.log("Error loading cached session", err);
      }

      if (active && hasCachedSession) {
        setLoading(false);
      }

      try {
        await refreshMe();
      } catch (err) {
        const isAuthError = err.response && err.response.status === 401;
        if (isAuthError) {
          if (active) {
            await logout();
          }
        } else {
          console.log("Background profile refresh failed (network or server error), keeping session:", err.message || err);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [refreshMe, logout]);

  useEffect(() => {
    registerUnauthorizedCallback(logout);
    return () => {
      registerUnauthorizedCallback(null);
    };
  }, [logout]);

  useEffect(() => {
    if (token && user) {
      updatePushToken();
    }
  }, [token, user, updatePushToken]);

  const login = useCallback(
    async (email, password) => {
      const res = await api.post("/auth/login", { email, password });
      await setStoredToken(res.data.token);
      setToken(res.data.token);
      applySession(res.data);
    },
    [applySession]
  );

  const loginWithOtp = useCallback(
    async (phone, otp) => {
      const res = await api.post("/auth/verify-otp-login", { phone, otp });
      await setStoredToken(res.data.token);
      setToken(res.data.token);
      applySession(res.data);
    },
    [applySession]
  );

  const register = useCallback(
    async (payload) => {
      const res = await api.post("/auth/register", payload);
      await setStoredToken(res.data.token);
      setToken(res.data.token);
      applySession(res.data);
    },
    [applySession]
  );

  const toggleFavorite = useCallback(async (barberId) => {
    try {
      // Optimistic update
      setFavorites((prev) =>
        prev.includes(barberId)
          ? prev.filter((id) => id !== barberId)
          : [...prev, barberId]
      );
      const res = await api.post("/auth/favorites/toggle", { barberId });
      setFavorites(res.data.favoriteShops);
      try {
        const storedSession = await getStoredSession();
        if (storedSession && storedSession.user) {
          storedSession.user.favoriteShops = res.data.favoriteShops;
          await setStoredSession(storedSession);
        }
      } catch (e) {
        console.log("Failed to update favorites in stored session", e);
      }
    } catch (err) {
      console.error(err);
      // Revert if failed
      refreshMe();
    }
  }, [refreshMe]);

  const upgradeToPartner = useCallback(
    async (category) => {
      const res = await api.post("/barbers/upgrade", { category });
      await setStoredToken(res.data.token);
      setToken(res.data.token);
      applySession(res.data);
      return res.data;
    },
    [applySession]
  );

  const upgradeToTailor = useCallback(
    async (payload) => {
      // payload will have shopName, category, ownerName, mobileNumber, address, workingHours, gallery, seatCount
      const res = await api.post("/tailors/register", payload);
      // Wait! I also need the new token, because role changed to tailor.
      // Wait, `/tailors/register` does not return a token. I need to make sure I update the token or refreshMe!
      await refreshMe();
      return res.data;
    },
    [refreshMe]
  );

  const logout = useCallback(async () => {
    await setStoredToken(null);
    await setStoredSession(null);
    setToken(null);
    setUser(null);
    setBarber(null);
    setTailor(null);
    setFavorites([]);
  }, []);

  const value = useMemo(
    () => ({
      token,
      user,
      barber,
      tailor,
      favorites,
      loading,
      login,
      loginWithOtp,
      register,
      logout,
      refreshMe,
      toggleFavorite,
      saveToken: async (t) => {
        await setStoredToken(t);
        setToken(t);
        await refreshMe();
      },
      upgradeToPartner,
      upgradeToTailor,
    }),
    [token, user, barber, tailor, favorites, loading, login, loginWithOtp, register, logout, refreshMe, toggleFavorite, upgradeToPartner, upgradeToTailor]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
