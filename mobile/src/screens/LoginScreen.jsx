import React, { useState, useRef, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { getApiBaseUrl } from "../config";

// Enable LayoutAnimation for Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

function getErrorMessage(err) {
  const data = err?.response?.data;
  if (typeof data?.error === "string") return data.error;
  if (data?.error && typeof data.error === "object") return JSON.stringify(data.error);
  if (err?.code === "ERR_NETWORK" || err?.message?.includes("Network Error")) {
    return `Server se connect nahi ho pa raha: ${getApiBaseUrl()}\n\nKripya check karein ki phone aur PC dono ek hi Wi-Fi network par hain.`;
  }
  return err?.message || "Action failed";
}

const PetalBackground = () => (
  <View style={styles.petalContainer}>
    <View style={[styles.petal, { transform: [{ rotate: "15deg" }] }]} />
    <View style={[styles.petal, { transform: [{ rotate: "45deg" }], opacity: 0.12 }]} />
    <View style={[styles.petal, { transform: [{ rotate: "75deg" }], opacity: 0.08 }]} />
  </View>
);

function AuthScreenComponent({ initialTab, navigation }) {
  const { login, register } = useAuth();
  const [activeTab, setActiveTab] = useState(initialTab || "login"); // 'login' | 'register'
  
  // Tab Underline Animation
  const [tabContainerWidth, setTabContainerWidth] = useState(0);
  const tabAnimatedValue = useRef(new Animated.Value(initialTab === "register" ? 1 : 0)).current;

  // Input states
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Login specific state
  const [identifier, setIdentifier] = useState("");

  // Register specific state
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [requestId, setRequestId] = useState("");
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [verificationError, setVerificationError] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);

  // Busy/Loading states
  const [busy, setBusy] = useState(false);

  // Input focus states
  const [isIdFocused, setIsIdFocused] = useState(false);
  const [isPassFocused, setIsPassFocused] = useState(false);
  const [isNameFocused, setIsNameFocused] = useState(false);
  const [isPhoneFocused, setIsPhoneFocused] = useState(false);
  const [isOtpFocused, setIsOtpFocused] = useState(false);

  // Refs
  const identifierInputRef = useRef(null);
  const passwordInputRef = useRef(null);
  const nameInputRef = useRef(null);
  const phoneInputRef = useRef(null);
  const otpInputRef = useRef(null);

  // Sync animation with tab toggle
  useEffect(() => {
    Animated.spring(tabAnimatedValue, {
      toValue: activeTab === "login" ? 0 : 1,
      useNativeDriver: true,
      tension: 60,
      friction: 10,
    }).start();
  }, [activeTab]);

  const handleToggleTab = (tab) => {
    if (tab === activeTab || busy || sendingOtp) return;
    
    // Clear validations and errors on switch
    setVerificationError("");
    setIsOtpVerified(false);
    setOtpSent(false);
    setOtp("");

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(tab);
  };

  // Sign In submit
  async function handleLoginSubmit() {
    if (!identifier.trim() || !password) {
      Alert.alert("Credentials Required", "Please enter both your email/phone and password to log in.");
      return;
    }
    setBusy(true);
    try {
      await login(identifier.trim(), password);
    } catch (e) {
      Alert.alert("Login Failed", getErrorMessage(e) || "Invalid email/phone or password. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  // Send Verification Code
  async function handleSendOtp() {
    if (!name.trim()) {
      Alert.alert("Name Required", "Please enter your full name.");
      return;
    }
    if (!phone.trim() || phone.trim().length !== 10) {
      Alert.alert("Phone Required", "Please enter a valid 10-digit mobile number.");
      return;
    }
    if (!password || password.length < 6) {
      Alert.alert("Password Required", "Please choose a password containing at least 6 characters.");
      return;
    }

    setSendingOtp(true);
    setVerificationError("");
    try {
      const response = await fetch("https://control.msg91.com/api/v5/widget/sendOtp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "authkey": "563311AlTNjGVdvD6a89a4ccP1",
        },
        body: JSON.stringify({
          widgetId: "3668766c5145323235363431",
          identifier: "91" + phone.trim(),
        }),
      });
      const data = await response.json();
      console.log("[Mobile Client] MSG91 Send response:", data);

      if (data.type === "success" && (data.request_id || data.message)) {
        setRequestId(data.request_id || data.message);
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setOtpSent(true);
        Alert.alert("Verification Code Sent 📲", "A 4-digit code has been sent to your mobile number.");
        setTimeout(() => otpInputRef.current?.focus(), 150);
        return;
      }

      // Mock fallback
      console.warn("[Mobile Client] MSG91 widget send failed, falling back to server mock mode:", data.message);
      await api.post("/auth/send-otp", { phone: phone.trim() });
      setRequestId("");
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setOtpSent(true);
      Alert.alert("Mock OTP Generated 📲", "Check your backend server terminal console log for the verification code.");
      setTimeout(() => otpInputRef.current?.focus(), 150);
    } catch (e) {
      try {
        console.warn("[Mobile Client] Network error calling MSG91 widget, falling back to server mock mode:", e.message);
        await api.post("/auth/send-otp", { phone: phone.trim() });
        setRequestId("");
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setOtpSent(true);
        Alert.alert("Mock OTP Generated 📲", "Check your backend server terminal console log for the verification code.");
        setTimeout(() => otpInputRef.current?.focus(), 150);
      } catch (err) {
        Alert.alert("Failed to Send OTP", getErrorMessage(err) || "We couldn't dispatch the verification code. Please try again.");
      }
    } finally {
      setSendingOtp(false);
    }
  }

  // Auto verify OTP on 4 digits
  async function autoVerifyOtp(code) {
    if (!code || code.trim().length !== 4) return;
    if (verifyingOtp || isOtpVerified || busy) return;
    setVerifyingOtp(true);
    setVerificationError("");
    try {
      const payload = {
        name: name.trim(),
        phone: phone.trim(),
        otp: code.trim(),
        requestId: requestId || undefined,
        password,
        role: "customer",
      };
      await register(payload);
      setIsOtpVerified(true);
    } catch (err) {
      console.error("[OTP Verify Error]", err);
      setIsOtpVerified(false);
      const errMsg = err?.response?.data?.error || getErrorMessage(err);
      setVerificationError(errMsg);
    } finally {
      setVerifyingOtp(false);
    }
  }

  const handleEditPhone = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOtpSent(false);
    setIsOtpVerified(false);
    setOtp("");
    setTimeout(() => phoneInputRef.current?.focus(), 150);
  };

  const tabWidth = tabContainerWidth / 2;

  const activeUnderlineStyle = {
    position: "absolute",
    bottom: -1,
    left: 0,
    height: 2.5,
    backgroundColor: "#7c3aed",
    borderRadius: 2,
    width: tabWidth || "50%",
    transform: [
      {
        translateX: tabAnimatedValue.interpolate({
          inputRange: [0, 1],
          outputRange: [0, tabWidth || (SCREEN_WIDTH - 96) / 2],
        }),
      },
    ],
  };

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
          {/* Decorative shapes */}
          <PetalBackground />

          {/* Welcome Header */}
          <View style={styles.welcomeHeader}>
            <Text style={styles.welcomeTitle}>
              Welcome to <Text style={styles.purpleText}>ROOPSY</Text>
            </Text>
            <Text style={styles.welcomeSubtitle}>Sign in or create your account</Text>
          </View>

          {/* Card Container */}
          <View style={styles.card}>
            {/* Smooth Tab Bar */}
            <View 
              style={styles.tabContainer}
              onLayout={(e) => setTabContainerWidth(e.nativeEvent.layout.width)}
            >
              <Pressable style={styles.tab} onPress={() => handleToggleTab("login")}>
                <Text style={[styles.tabText, activeTab === "login" && styles.activeTabText]}>Sign In</Text>
              </Pressable>
              <Pressable style={styles.tab} onPress={() => handleToggleTab("register")}>
                <Text style={[styles.tabText, activeTab === "register" && styles.activeTabText]}>Create Account</Text>
              </Pressable>
              {/* Sliding Underline */}
              <Animated.View style={activeUnderlineStyle} />
            </View>

            {/* Logo details inside Card */}
            <View style={styles.introContainer}>
              <View style={styles.logoContainer}>
                <View style={styles.logoBadge}>
                  <Image source={require("../../assets/logo.jpeg")} style={styles.logoImage} />
                </View>
              </View>
              <Text style={styles.introTitle}>ROOPSY</Text>
              <Text style={styles.introSubtitle}>
                Find the perfect salon, beauty parlor & tailor near you
              </Text>
            </View>

            {/* Render inputs dynamically with LayoutAnimation transitions */}
            {activeTab === "login" ? (
              // SIGN IN LAYOUT
              <View key="login-form">
                <Text style={styles.inputLabel}>Email or Mobile Number</Text>
                <Pressable 
                  style={[styles.inputContainer, isIdFocused && styles.inputContainerFocused]}
                  onPress={() => identifierInputRef.current?.focus()}
                >
                  <Ionicons 
                    name="mail-outline" 
                    size={20} 
                    color={isIdFocused ? "#7c3aed" : "#94a3b8"} 
                    style={styles.inputIcon} 
                  />
                  <TextInput
                    ref={identifierInputRef}
                    style={styles.inputField}
                    placeholder="Enter email or 10-digit mobile"
                    placeholderTextColor="#94a3b8"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    value={identifier}
                    onChangeText={setIdentifier}
                    onFocus={() => setIsIdFocused(true)}
                    onBlur={() => setIsIdFocused(false)}
                    returnKeyType="next"
                    onSubmitEditing={() => passwordInputRef.current?.focus()}
                    editable={!busy}
                  />
                </Pressable>

                <Text style={styles.inputLabel}>Password</Text>
                <Pressable 
                  style={[styles.inputContainer, isPassFocused && styles.inputContainerFocused]}
                  onPress={() => passwordInputRef.current?.focus()}
                >
                  <Ionicons 
                    name="lock-closed-outline" 
                    size={20} 
                    color={isPassFocused ? "#7c3aed" : "#94a3b8"} 
                    style={styles.inputIcon} 
                  />
                  <TextInput
                    ref={passwordInputRef}
                    style={styles.inputField}
                    placeholder="Enter your password"
                    placeholderTextColor="#94a3b8"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                    onFocus={() => setIsPassFocused(true)}
                    onBlur={() => setIsPassFocused(false)}
                    returnKeyType="done"
                    onSubmitEditing={handleLoginSubmit}
                    editable={!busy}
                  />
                  <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.toggleBtn} disabled={busy}>
                    <Ionicons
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={20}
                      color="#64748b"
                    />
                  </Pressable>
                </Pressable>

                {/* Forgot Password Link */}
                <Pressable 
                  onPress={() => navigation.navigate("ForgotPassword")}
                  style={styles.forgotBtn}
                  disabled={busy}
                >
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </Pressable>

                {/* Action button */}
                <Pressable
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                    busy && styles.btnDisabled,
                  ]}
                  onPress={handleLoginSubmit}
                  disabled={busy}
                >
                  {busy ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Sign In</Text>
                  )}
                </Pressable>
              </View>
            ) : (
              // CREATE ACCOUNT LAYOUT
              <View key="register-form">
                <Text style={styles.inputLabel}>Full Name</Text>
                <Pressable 
                  style={[styles.inputContainer, isNameFocused && styles.inputContainerFocused]}
                  onPress={() => nameInputRef.current?.focus()}
                >
                  <Ionicons 
                    name="person-outline" 
                    size={20} 
                    color={isNameFocused ? "#7c3aed" : "#94a3b8"} 
                    style={styles.inputIcon} 
                  />
                  <TextInput
                    ref={nameInputRef}
                    style={styles.inputField}
                    placeholder="Enter your full name"
                    placeholderTextColor="#94a3b8"
                    value={name}
                    onChangeText={setName}
                    onFocus={() => setIsNameFocused(true)}
                    onBlur={() => setIsNameFocused(false)}
                    returnKeyType="next"
                    onSubmitEditing={() => phoneInputRef.current?.focus()}
                    editable={!otpSent && !busy}
                  />
                </Pressable>

                <Text style={styles.inputLabel}>Mobile Number</Text>
                <Pressable 
                  style={[styles.inputContainer, isPhoneFocused && styles.inputContainerFocused]}
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
                    placeholder="10-digit mobile number"
                    placeholderTextColor="#94a3b8"
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={(val) => {
                      setPhone(val);
                      if (otpSent) {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        setOtpSent(false);
                        setIsOtpVerified(false);
                        setOtp("");
                      }
                    }}
                    onFocus={() => setIsPhoneFocused(true)}
                    onBlur={() => setIsPhoneFocused(false)}
                    maxLength={10}
                    returnKeyType="next"
                    onSubmitEditing={() => passwordInputRef.current?.focus()}
                    editable={!otpSent && !busy}
                  />
                  {otpSent && !busy && (
                    <Pressable 
                      onPress={handleEditPhone} 
                      style={{ padding: 6, flexDirection: "row", alignItems: "center", gap: 4 }}
                    >
                      <Ionicons
                        name="pencil"
                        size={16}
                        color="#7c3aed"
                      />
                      <Text style={{ color: "#7c3aed", fontWeight: "700", fontSize: 13 }}>Edit</Text>
                    </Pressable>
                  )}
                </Pressable>

                <Text style={styles.inputLabel}>Choose Password</Text>
                <Pressable 
                  style={[styles.inputContainer, isPassFocused && styles.inputContainerFocused]}
                  onPress={() => passwordInputRef.current?.focus()}
                >
                  <Ionicons 
                    name="lock-closed-outline" 
                    size={20} 
                    color={isPassFocused ? "#7c3aed" : "#94a3b8"} 
                    style={styles.inputIcon} 
                  />
                  <TextInput
                    ref={passwordInputRef}
                    style={styles.inputField}
                    placeholder="Choose a strong password"
                    placeholderTextColor="#94a3b8"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                    onFocus={() => setIsPassFocused(true)}
                    onBlur={() => setIsPassFocused(false)}
                    returnKeyType="done"
                    editable={!otpSent && !busy}
                  />
                  <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.toggleBtn} disabled={otpSent || busy}>
                    <Ionicons
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={20}
                      color="#64748b"
                    />
                  </Pressable>
                </Pressable>

                {otpSent && (
                  <View key="otp-view">
                    <Text style={styles.inputLabel}>Enter 4-Digit OTP</Text>
                    <Pressable 
                      style={[styles.inputContainer, isOtpFocused && styles.inputContainerFocused]}
                      onPress={() => otpInputRef.current?.focus()}
                    >
                      <Ionicons 
                        name="shield-checkmark-outline" 
                        size={20} 
                        color={isOtpFocused ? "#7c3aed" : "#94a3b8"} 
                        style={styles.inputIcon} 
                      />
                      <TextInput
                        ref={otpInputRef}
                        style={styles.inputField}
                        placeholder="Enter 4-digit code"
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
                        editable={!busy}
                      />
                    </Pressable>
                    {verifyingOtp && (
                      <ActivityIndicator size="small" color="#7c3aed" style={{ alignSelf: "flex-start", marginTop: -12, marginBottom: 16, marginLeft: 4 }} />
                    )}
                    {isOtpVerified && (
                      <View style={styles.successBadge}>
                        <Ionicons name="checkmark-circle-outline" size={16} color="#059669" />
                        <Text style={styles.successText}>OTP Verified successfully</Text>
                      </View>
                    )}
                    {!!verificationError && (
                      <View style={styles.errorBadge}>
                        <Ionicons name="alert-circle-outline" size={16} color="#dc2626" />
                        <Text style={styles.errorText}>{verificationError}</Text>
                      </View>
                    )}
                    <Pressable onPress={handleSendOtp} style={{ alignSelf: "flex-end", marginTop: -10, marginBottom: 16 }} disabled={sendingOtp || busy}>
                      <Text style={{ color: "#7c3aed", fontWeight: "700", fontSize: 13 }}>Resend OTP code?</Text>
                    </Pressable>
                  </View>
                )}

                {/* Register Action button */}
                {!otpSent ? (
                  <Pressable
                    style={({ pressed }) => [
                      styles.primaryBtn,
                      pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                      (sendingOtp || busy) && styles.btnDisabled,
                    ]}
                    onPress={handleSendOtp}
                    disabled={sendingOtp || busy}
                  >
                    {sendingOtp ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <Text style={styles.primaryBtnText}>Send Verification OTP 📲</Text>
                    )}
                  </Pressable>
                ) : (
                  <View style={styles.waitingContainer}>
                    {busy || verifyingOtp ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <ActivityIndicator color="#7c3aed" />
                        <Text style={styles.waitingText}>
                          {verifyingOtp ? "Verifying OTP & creating account..." : "Logging in..."}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.waitingText}>Please enter the OTP to complete registration.</Text>
                    )}
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Footer toggle text */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {activeTab === "login" ? "Don't have an account? " : "Already have an account? "}
            </Text>
            <Pressable onPress={() => handleToggleTab(activeTab === "login" ? "register" : "login")} disabled={busy}>
              <Text style={styles.footerLink}>
                {activeTab === "login" ? "Create Account" : "Sign In"}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function LoginScreen({ navigation }) {
  return <AuthScreenComponent initialTab="login" navigation={navigation} />;
}

export function RegisterScreen({ navigation }) {
  return <AuthScreenComponent initialTab="register" navigation={navigation} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#fbfbfe" },
  scrollContent: { flexGrow: 1 },
  container: { padding: 20, justifyContent: "center", paddingTop: 60, paddingBottom: 30, position: "relative" },

  // Background petals
  petalContainer: {
    position: "absolute",
    top: -60,
    right: -60,
    width: 250,
    height: 250,
    alignItems: "center",
    justifyContent: "center",
    zIndex: -1,
  },
  petal: {
    position: "absolute",
    width: 90,
    height: 180,
    borderRadius: 45,
    backgroundColor: "#c084fc",
    opacity: 0.18,
  },

  welcomeHeader: {
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1e1b4b",
    letterSpacing: -0.5,
  },
  purpleText: {
    color: "#7c3aed",
    fontWeight: "900",
  },
  welcomeSubtitle: {
    fontSize: 15,
    color: "#64748b",
    marginTop: 4,
    fontWeight: "500",
  },

  card: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#7c3aed",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#f3e8ff",
    marginBottom: 24,
  },

  // Tabs
  tabContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#f3e8ff",
    marginBottom: 24,
    marginTop: -8,
    position: "relative",
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  tabText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#94a3b8",
  },
  activeTabText: {
    color: "#7c3aed",
  },

  introContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  logoContainer: {
    padding: 3,
    borderRadius: 24,
    backgroundColor: "#f5f3ff",
    shadowColor: "#7c3aed",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 14,
  },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
  },
  logoImage: {
    width: "100%",
    height: "100%",
  },
  introTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: "#1e1b4b",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  introSubtitle: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    maxWidth: 240,
    lineHeight: 18,
    fontWeight: "500",
  },

  inputLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#475569",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.75,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fdfdfd",
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
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  inputIcon: {
    marginRight: 12,
  },
  inputField: {
    flex: 1,
    fontSize: 15,
    color: "#1e1b4b",
    fontWeight: "600",
    height: "100%",
  },
  toggleBtn: {
    padding: 6,
  },

  forgotBtn: {
    alignSelf: "flex-end",
    marginBottom: 20,
    marginTop: -8,
  },
  forgotText: {
    color: "#7c3aed",
    fontSize: 14,
    fontWeight: "700",
  },

  primaryBtn: {
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
  primaryBtnText: { color: "#ffffff", fontWeight: "800", fontSize: 16, letterSpacing: 0.5 },

  waitingContainer: {
    backgroundColor: "#faf5ff",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#f3e8ff",
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  waitingText: {
    color: "#7c3aed",
    fontWeight: "700",
    fontSize: 14,
    textAlign: "center",
  },

  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  footerText: {
    color: "#64748b",
    fontSize: 14,
    fontWeight: "500",
  },
  footerLink: {
    color: "#7c3aed",
    fontSize: 14,
    fontWeight: "800",
  },

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
