import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";

export function RegisterScreen({ navigation }) {
  const { saveToken } = useAuth();
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit() {
    if (!name.trim() || !email.trim() || password.length < 6) {
      Alert.alert("Registration", "Kripya name, email aur minimum 6 characters ka password fill karein.");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
        role: "customer", // Unified registration: everyone starts as a customer
      };

      const res = await api.post("/auth/register", payload);
      await saveToken(res.data.token);
    } catch (e) {
      Alert.alert("Registration Failed", e?.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.container}>
        
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Image 
              source={require("../../assets/logo.jpeg")} 
              style={styles.logoImage} 
            />
          </View>
          <Text style={styles.brandTitle}>Create Account</Text>
          <Text style={styles.brandSubtitle}>Join ROOPSY and discover high-end styles.</Text>
        </View>

        {/* Form Fields */}
        <View style={styles.form}>
          <Text style={styles.inputLabel}>Full Name</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
            <TextInput
              style={styles.inputField}
              placeholder="e.g. Rahul Sharma"
              placeholderTextColor="#94a3b8"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </View>

          <Text style={styles.inputLabel}>Email Address</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
            <TextInput
              style={styles.inputField}
              placeholder="e.g. rahul@example.com"
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <Text style={styles.inputLabel}>Phone Number</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="phone-portrait-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
            <TextInput
              style={styles.inputField}
              placeholder="e.g. 9876543210 (optional)"
              placeholderTextColor="#94a3b8"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          </View>

          <Text style={styles.inputLabel}>Password</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
            <TextInput
              style={styles.inputField}
              placeholder="Minimum 6 characters"
              placeholderTextColor="#94a3b8"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.toggleBtn}>
              <Ionicons 
                name={showPassword ? "eye-off-outline" : "eye-outline"} 
                size={20} 
                color="#64748b" 
              />
            </Pressable>
          </View>

          {/* Action Button */}
          <Pressable 
            style={[styles.signUpBtn, busy && styles.btnDisabled]} 
            onPress={onSubmit} 
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.signUpBtnText}>Sign Up</Text>
            )}
          </Pressable>
        </View>

        {/* Footer Navigation */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Pressable onPress={() => navigation.navigate("Login")}>
            <Text style={styles.signInLink}>Sign In</Text>
          </Pressable>
        </View>

      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f8fafc" },
  container: { padding: 24, justifyContent: "flex-start", paddingTop: 50 },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#ede9fe",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#6d28d9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
    overflow: "hidden",
  },
  logoImage: {
    width: "100%",
    height: "100%",
    borderRadius: 20,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#0f172a",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  brandSubtitle: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    maxWidth: 260,
    lineHeight: 20,
  },
  form: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    paddingHorizontal: 16,
    marginBottom: 14,
    height: 50,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  inputIcon: {
    marginRight: 12,
  },
  inputField: {
    flex: 1,
    fontSize: 15,
    color: "#0f172a",
    height: "100%",
  },
  toggleBtn: {
    padding: 4,
  },
  signUpBtn: {
    backgroundColor: "#6d28d9",
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 8,
    shadowColor: "#6d28d9",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 5,
  },
  btnDisabled: { opacity: 0.7 },
  signUpBtnText: { color: "#ffffff", fontWeight: "800", fontSize: 16 },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 10,
  },
  footerText: {
    color: "#64748b",
    fontSize: 14,
  },
  signInLink: {
    color: "#6d28d9",
    fontSize: 14,
    fontWeight: "800",
  },
});
