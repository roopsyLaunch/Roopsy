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
import { getApiBaseUrl } from "../config";

function getErrorMessage(err) {
  const data = err?.response?.data;
  if (typeof data?.error === "string") return data.error;
  if (data?.error && typeof data.error === "object") return JSON.stringify(data.error);
  if (err?.code === "ERR_NETWORK" || err?.message?.includes("Network Error")) {
    return `Server se connect nahi ho pa raha: ${getApiBaseUrl()}\n\nKripya check karein ki phone aur PC dono ek hi Wi-Fi network par hain.`;
  }
  return err?.message || "Login failed";
}

export function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit() {
    if (!email.trim() || !password) {
      Alert.alert("Login", "Kripya email aur password dono fill karein.");
      return;
    }
    setBusy(true);
    try {
      await login(email.trim(), password);
    } catch (e) {
      Alert.alert("Login Failed", getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.container}>
        
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Image 
              source={require("../../assets/logo.jpeg")} 
              style={styles.logoImage} 
            />
          </View>
          <Text style={styles.brandTitle}>ROOPSY</Text>
          <Text style={styles.brandSubtitle}>Find the perfect salon, beauty parlor & tailor near you.</Text>
        </View>

        {/* Input Fields */}
        <View style={styles.form}>
          <Text style={styles.inputLabel}>Email Address</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
            <TextInput
              style={styles.inputField}
              placeholder="Enter your email"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <Text style={styles.inputLabel}>Password</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
            <TextInput
              style={styles.inputField}
              placeholder="Enter your password"
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
            style={[styles.loginBtn, busy && styles.btnDisabled]} 
            onPress={onSubmit} 
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.loginBtnText}>Sign In</Text>
            )}
          </Pressable>
        </View>

        {/* Footer Navigation */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>New to ROOPSY? </Text>
          <Pressable onPress={() => navigation.navigate("Register")}>
            <Text style={styles.signUpLink}>Create Account</Text>
          </Pressable>
        </View>

      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f8fafc" },
  container: { padding: 24, justifyContent: "flex-start", paddingTop: 70 },
  header: {
    alignItems: "center",
    marginBottom: 36,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#ede9fe",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
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
    marginBottom: 6,
  },
  brandSubtitle: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    maxWidth: 240,
    lineHeight: 20,
  },
  form: {
    marginBottom: 20,
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
    marginBottom: 18,
    height: 52,
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
  loginBtn: {
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
  loginBtnText: { color: "#ffffff", fontWeight: "800", fontSize: 16 },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 12,
  },
  footerText: {
    color: "#64748b",
    fontSize: 14,
  },
  signUpLink: {
    color: "#6d28d9",
    fontSize: 14,
    fontWeight: "800",
  },
});
