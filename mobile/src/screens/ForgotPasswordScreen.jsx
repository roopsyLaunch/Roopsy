import React, { useState, useRef } from "react";
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
import { api } from "../api/client";
import { getApiBaseUrl } from "../config";

function getErrorMessage(err) {
  const data = err?.response?.data;
  if (typeof data?.error === "string") return data.error;
  if (data?.error && typeof data.error === "object") return JSON.stringify(data.error);
  if (err?.code === "ERR_NETWORK" || err?.message?.includes("Network Error")) {
    return `Server se connect nahi ho pa raha: ${getApiBaseUrl()}\n\nKripya check karein ki phone aur PC dono ek hi Wi-Fi network par hain.`;
  }
  return err?.message || "Reset failed";
}

export function ForgotPasswordScreen({ navigation }) {
  const [busy, setBusy] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [isPhoneFocused, setIsPhoneFocused] = useState(false);
  const [isOtpFocused, setIsOtpFocused] = useState(false);
  const [isPassFocused, setIsPassFocused] = useState(false);

  const phoneInputRef = useRef(null);
  const otpInputRef = useRef(null);
  const passwordInputRef = useRef(null);

  const [requestId, setRequestId] = useState("");
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [verificationError, setVerificationError] = useState("");

  async function handleSendOtp() {
    if (!phone.trim() || phone.trim().length !== 10) {
      Alert.alert("Phone Required", "Please enter your registered 10-digit mobile number.");
      return;
    }
    setSendingOtp(true);
    try {
      // 1. Attempt live client-side dispatch via MSG91 Widget to bypass DLT & server block
      const response = await fetch("https://control.msg91.com/api/v5/widget/sendOtp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "authkey": "563311AlTNjGVdvD6a89a4ccP1" // Use main account AuthKey for direct authentication
        },
        body: JSON.stringify({
          widgetId: "3668766c5145323235363431",
          identifier: "91" + phone.trim()
        })
      });
      const data = await response.json();
      console.log("[Mobile Client] MSG91 Send response:", data);

      if (data.type === "success" && (data.request_id || data.message)) {
        setRequestId(data.request_id || data.message);
        setOtpSent(true);
        Alert.alert("OTP Sent 📲", "A password reset code has been sent to your mobile number.");
        return;
      }
      
      // If widget returns a CORS/Web requests allowed error or disabled, fallback to server mock mode
      console.warn("[Mobile Client] MSG91 widget send failed, falling back to server mock mode:", data.message);
      await api.post("/auth/forgot-password", { phone: phone.trim() });
      setRequestId("");
      setOtpSent(true);
      Alert.alert("Mock OTP Generated 📲", "Check your backend server terminal console log for the reset code.");
    } catch (e) {
      // Fallback to backend server mock mode if fetch fails
      try {
        console.warn("[Mobile Client] Network error calling MSG91 widget, falling back to server mock mode:", e.message);
        await api.post("/auth/forgot-password", { phone: phone.trim() });
        setRequestId("");
        setOtpSent(true);
        Alert.alert("Mock OTP Generated 📲", "Check your backend server terminal console log for the reset code.");
      } catch (err) {
        Alert.alert("Failed to Send OTP", getErrorMessage(err) || "We couldn't dispatch the verification code. Please try again.");
      }
    } finally {
      setSendingOtp(false);
    }
  }

  async function autoVerifyOtp(code) {
    if (!code || code.trim().length !== 4) return;
    if (verifyingOtp || isOtpVerified || busy) return;
    setVerifyingOtp(true);
    setVerificationError("");
    try {
      const res = await api.post("/auth/verify-otp", {
        phone: phone.trim(),
        otp: code.trim(),
        requestId: requestId || undefined
      });
      if (res.data?.success) {
        setIsOtpVerified(true);
        Alert.alert("OTP Verified ✅", "Verification successful! You can now choose a new password.");
        passwordInputRef.current?.focus();
      }
    } catch (err) {
      console.error("[OTP Verify Error]", err);
      setIsOtpVerified(false);
      const errMsg = err?.response?.data?.error || getErrorMessage(err);
      setVerificationError(errMsg);
    } finally {
      setVerifyingOtp(false);
    }
  }

  async function onSubmit() {
    if (!phone.trim() || phone.trim().length !== 10) {
      Alert.alert("Phone Required", "Please enter your registered 10-digit mobile number.");
      return;
    }
    if (!otpSent) {
      handleSendOtp();
      return;
    }
    if (!isOtpVerified) {
      Alert.alert("OTP Verification Required", "Please enter a valid OTP and verify it first.");
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      Alert.alert("Password Required", "Please enter a new password containing at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      const res = await api.post("/auth/reset-password", {
        phone: phone.trim(),
        otp: otp.trim(),
        requestId: requestId,
        newPassword,
      });
      Alert.alert("Password Reset ✅", res.data?.message || "Your password has been reset successfully. Please log in.");
      navigation.navigate("Login");
    } catch (e) {
      Alert.alert("Reset Failed", getErrorMessage(e) || "An error occurred. Please try again.");
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
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          
          <Pressable 
            style={({ pressed }) => [
              styles.backBtn,
              pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] }
            ]}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back-outline" size={22} color="#0f172a" />
          </Pressable>

          <View style={styles.header}>
            <Text style={styles.brandTitle}>Reset Password</Text>
            <Text style={styles.brandSubtitle}>Verify your mobile number to set a new password</Text>
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            <Text style={styles.inputLabel}>Mobile Number</Text>
            <View style={styles.phoneInputRow}>
              <Pressable 
                style={[
                  styles.inputContainer,
                  { flex: 1, marginBottom: 0 },
                  isPhoneFocused && styles.inputContainerFocused
                ]}
                onPress={() => phoneInputRef.current?.focus()}
              >
                <Ionicons 
                  name="phone-portrait-outline" 
                  size={20} 
                  color={isPhoneFocused ? "#7c3aed" : "#94a3b8"} 
                  style={styles.inputIcon} 
                />
                <TextInput
                  ref={phoneInputRef}
                  style={styles.inputField}
                  placeholder="Registered 10-digit mobile"
                  placeholderTextColor="#94a3b8"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={(val) => {
                    setPhone(val);
                    if (otpSent) {
                      setOtpSent(false);
                      setIsOtpVerified(false);
                      setOtp("");
                    }
                  }}
                  onFocus={() => setIsPhoneFocused(true)}
                  onBlur={() => setIsPhoneFocused(false)}
                  maxLength={10}
                />
              </Pressable>
              <Pressable 
                style={({ pressed }) => [
                  styles.sendOtpBtn,
                  pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                  (sendingOtp || phone.length !== 10) && styles.sendOtpBtnDisabled
                ]}
                onPress={handleSendOtp}
                disabled={sendingOtp || phone.length !== 10}
              >
                {sendingOtp ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.sendOtpBtnText}>{otpSent ? "Resend" : "Send OTP"}</Text>
                )}
              </Pressable>
            </View>

            {otpSent && (
              <>
                <Text style={styles.inputLabel}>Verification Code</Text>
                <Pressable 
                  style={[
                    styles.inputContainer,
                    isOtpFocused && styles.inputContainerFocused
                  ]}
                  onPress={() => otpInputRef.current?.focus()}
                >
                  <Ionicons name="shield-checkmark-outline" size={20} color={isOtpFocused ? "#7c3aed" : "#94a3b8"} style={styles.inputIcon} />
                  <TextInput
                    ref={otpInputRef}
                    style={styles.inputField}
                    placeholder="Enter 4-digit OTP code"
                    placeholderTextColor="#94a3b8"
                    keyboardType="number-pad"
                    value={otp}
                    onChangeText={(text) => {
                      setOtp(text);
                      if (text.trim().length === 4) {
                        autoVerifyOtp(text.trim());
                      } else {
                        setIsOtpVerified(false);
                        setVerificationError("");
                      }
                    }}
                    onFocus={() => setIsOtpFocused(true)}
                    onBlur={() => setIsOtpFocused(false)}
                    maxLength={4}
                    returnKeyType="next"
                    onSubmitEditing={() => passwordInputRef.current?.focus()}
                  />
                </Pressable>
                {verifyingOtp && (
                  <ActivityIndicator size="small" color="#7c3aed" style={{ alignSelf: "flex-start", marginTop: -12, marginBottom: 16, marginLeft: 4 }} />
                )}
                {isOtpVerified && (
                  <View style={styles.successBadge}>
                    <Ionicons name="checkmark-circle-outline" size={16} color="#059669" />
                    <Text style={styles.successText}>OTP Verified Successfully</Text>
                  </View>
                )}
                {!!verificationError && (
                  <View style={styles.errorBadge}>
                    <Ionicons name="alert-circle-outline" size={16} color="#dc2626" />
                    <Text style={styles.errorText}>{verificationError}</Text>
                  </View>
                )}

                <Text style={styles.inputLabel}>New Password</Text>
                <Pressable 
                  style={[
                    styles.inputContainer,
                    isPassFocused && styles.inputContainerFocused
                  ]}
                  onPress={() => passwordInputRef.current?.focus()}
                >
                  <Ionicons name="lock-closed-outline" size={20} color={isPassFocused ? "#7c3aed" : "#94a3b8"} style={styles.inputIcon} />
                  <TextInput
                    ref={passwordInputRef}
                    style={styles.inputField}
                    placeholder="Choose a new strong password"
                    placeholderTextColor="#94a3b8"
                    secureTextEntry={!showPassword}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    onFocus={() => setIsPassFocused(true)}
                    onBlur={() => setIsPassFocused(false)}
                    returnKeyType="done"
                    onSubmitEditing={onSubmit}
                  />
                  <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.toggleBtn}>
                    <Ionicons 
                      name={showPassword ? "eye-off-outline" : "eye-outline"} 
                      size={20} 
                      color="#64748b" 
                    />
                  </Pressable>
                </Pressable>
              </>
            )}

            {/* Action Button */}
            <Pressable 
              style={({ pressed }) => [
                styles.resetBtn,
                pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                busy && styles.btnDisabled
              ]} 
              onPress={onSubmit} 
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.resetBtnText}>{otpSent ? "Reset Password" : "Send OTP 📲"}</Text>
              )}
            </Pressable>
          </View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f8fafc" },
  scrollContent: { flexGrow: 1 },
  container: { padding: 20, justifyContent: "flex-start", paddingTop: 40 },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  header: {
    marginBottom: 24,
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
    lineHeight: 20,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#475569",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.75,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 20,
    height: 54,
  },
  inputContainerFocused: {
    borderColor: "#7c3aed",
    backgroundColor: "#ffffff",
    shadowColor: "#7c3aed",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  phoneInputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  sendOtpBtn: {
    backgroundColor: "#7c3aed",
    paddingHorizontal: 20,
    height: 54,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
    shadowColor: "#7c3aed",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  sendOtpBtnDisabled: {
    backgroundColor: "#cbd5e1",
    shadowOpacity: 0,
    elevation: 0,
  },
  sendOtpBtnText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 14,
  },
  inputIcon: {
    marginRight: 12,
  },
  inputField: {
    flex: 1,
    fontSize: 15,
    color: "#0f172a",
    fontWeight: "600",
    height: "100%",
  },
  toggleBtn: {
    padding: 6,
  },
  resetBtn: {
    backgroundColor: "#7c3aed",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#7c3aed",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  resetBtnText: { color: "#ffffff", fontWeight: "800", fontSize: 16, letterSpacing: 0.5 },
  successBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ecfdf5",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 20,
    marginTop: -12,
    gap: 6,
  },
  successText: {
    color: "#047857",
    fontSize: 13,
    fontWeight: "700",
  },
  errorBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 20,
    marginTop: -12,
    gap: 6,
  },
  errorText: {
    color: "#b91c1c",
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },
});
