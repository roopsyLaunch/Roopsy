import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAuth } from "../context/AuthContext";

export function RejectedBarberScreen() {
  const { barber } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Application not approved</Text>
      <Text style={styles.body}>
        Reason: {barber?.rejectionReason || "Please contact support with updated documents."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f10", padding: 20, justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "700", color: "#fecaca", marginBottom: 12 },
  body: { color: "#a3a3a3", lineHeight: 22 },
});
