import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";

export function PartnerRegistrationScreen({ route, navigation }) {
  const { category } = route.params || {};
  const { upgradeToPartner, refreshMe } = useAuth();
  const [busy, setBusy] = useState(false);

  const [shopName, setShopName] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");

  async function onSubmit() {
    if (!shopName.trim() || !city.trim()) {
      Alert.alert("Information Required", "Please enter your business / shop name and city to proceed.");
      return;
    }

    setBusy(true);
    try {
      // 1. Upgrade the user to a partner role
      await upgradeToPartner(category || "Partner");

      await api.patch("/barbers/me", {
        shopName: shopName.trim(),
        address: {
          line1: addressLine.trim(),
          city: city.trim(),
          state: state.trim(),
          pincode: pincode.trim(),
        },
        bio: `${category || "Service"}. Welcome to our shop!`,
        businessCategory: category || "Barber",
      });

      await refreshMe();

      Alert.alert("Profile Created 🎉", "Your business profile has been successfully created and configured.", [
        {
          text: "Go to Dashboard",
          onPress: () => navigation.navigate("Partners"),
        },
      ]);
    } catch (e) {
      Alert.alert("Registration Failed", e?.response?.data?.error || "Unable to register your business profile. Please verify your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView 
      style={styles.flex} 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Ionicons name="storefront" size={32} color="#6d28d9" />
          </View>
          <Text style={styles.title}>Set Up Your Business</Text>
          <Text style={styles.subtitle}>
            You selected <Text style={{ fontWeight: "700", color: "#6d28d9" }}>{category}</Text>. Please provide your business details below.
          </Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Business Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Royal Cuts Barbershop"
            value={shopName}
            onChangeText={setShopName}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Street Address</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 123 Main Street"
            value={addressLine}
            onChangeText={setAddressLine}
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.formGroup, { flex: 1, marginRight: 12 }]}>
            <Text style={styles.label}>City</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Mumbai"
              value={city}
              onChangeText={setCity}
            />
          </View>
          <View style={[styles.formGroup, { flex: 1 }]}>
            <Text style={styles.label}>PIN Code</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 400001"
              keyboardType="number-pad"
              value={pincode}
              onChangeText={setPincode}
            />
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>State</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Maharashtra"
            value={state}
            onChangeText={setState}
          />
        </View>

        <Pressable style={[styles.btn, busy && styles.btnDisabled]} onPress={onSubmit} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Complete Setup</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f8fafc" },
  container: { padding: 24, paddingBottom: 48, paddingTop: 32 },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#ede9fe",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  formGroup: {
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    color: "#0f172a",
  },
  btn: {
    backgroundColor: "#6d28d9",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 24,
    shadowColor: "#6d28d9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: "#ffffff", fontWeight: "700", fontSize: 15 },
});
