import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";

export function PendingBarberScreen() {
  const { refreshMe, barber } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Ionicons name="time-outline" size={40} color="#6d28d9" />
        </View>
        <Text style={styles.title}>Verification Pending</Text>
        <Text style={styles.body}>
          Your shop application for <Text style={styles.bold}>{barber?.shopName || "your shop"}</Text> is currently being reviewed by our administrators.
        </Text>
        <Text style={styles.sub}>
          Once your KYC and bank details are verified, you will gain full access to the salon dashboard and booking calendar.
        </Text>
        <Pressable style={styles.btn} onPress={refreshMe}>
          <Text style={styles.btnText}>Refresh Status</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
    padding: 24,
    justifyContent: "center",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#f1f5f9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#ede9fe",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 12,
  },
  body: {
    color: "#475569",
    lineHeight: 22,
    fontSize: 14,
    textAlign: "center",
    marginBottom: 10,
  },
  sub: {
    color: "#64748b",
    lineHeight: 18,
    fontSize: 12,
    textAlign: "center",
    marginBottom: 24,
  },
  bold: {
    color: "#6d28d9",
    fontWeight: "700",
  },
  btn: {
    backgroundColor: "#6d28d9",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
  },
  btnText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
});
