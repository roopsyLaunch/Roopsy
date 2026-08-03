import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Alert, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { api } from "../../api/client";
import { getCurrentGPSLocation } from "../../services/locationService";

export function TailorServiceModeScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { tailor, services } = route.params;

  const [serviceMode, setServiceMode] = useState("shop"); // "shop" or "home"
  
  const [address, setAddress] = useState("");
  const [visitDate, setVisitDate] = useState(null);
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fetchingGps, setFetchingGps] = useState(false);

  const VISIT_FEE = 150; // Fixed visit fee for Doorstep Tailoring
  const PREMIUM_FEE = 250; // Fixed premium VIP service fee

  const handleConfirmDate = (date) => {
    setVisitDate(date);
    setDatePickerVisibility(false);
  };

  const handleFetchGPS = async () => {
    setFetchingGps(true);
    try {
      const loc = await getCurrentGPSLocation();
      if (loc && loc.displayName) {
        setAddress(loc.displayName);
      } else {
        Alert.alert("GPS Error", "Failed to retrieve address details for your location.");
      }
    } catch (err) {
      console.error(err);
      Alert.alert(
        "Location Permission Required",
        "Could not access your location. Please check if location permissions are enabled for this app in settings."
      );
    } finally {
      setFetchingGps(false);
    }
  };

  const isShopAllowed = tailor?.offersShopService !== false;
  const isHomeAllowed = tailor?.offersHomeService !== false;
  const isPremiumAllowed = tailor?.offersPremiumService !== false;

  const handleSelectMode = (mode) => {
    if (mode === "shop" && !isShopAllowed) {
      return Alert.alert("Service Unavailable", "Shop service is currently turned off by the tailor.");
    }
    if (mode === "home" && !isHomeAllowed) {
      return Alert.alert("Service Unavailable", "Home service is currently turned off by the tailor.");
    }
    if (mode === "premium" && !isPremiumAllowed) {
      return Alert.alert("Service Unavailable", "Premium service is currently turned off by the tailor.");
    }
    setServiceMode(mode);
  };

  const handlePlaceOrder = async () => {
    if (serviceMode === "shop" && !isShopAllowed) {
      return Alert.alert("Service Unavailable", "Shop service is currently turned off by the tailor.");
    }
    if (serviceMode === "home" && !isHomeAllowed) {
      return Alert.alert("Service Unavailable", "Home service is currently turned off by the tailor.");
    }

    if (serviceMode === "home") {
      if (!address.trim()) {
        return Alert.alert("Required", "Please provide your full address for doorstep visit.");
      }
      if (!visitDate) {
        return Alert.alert("Required", "Please select a date and time for doorstep visit.");
      }
    }

    const fee = serviceMode === "home" ? VISIT_FEE : (serviceMode === "premium" ? PREMIUM_FEE : 0);
    const servicesTotal = services.reduce((acc, s) => acc + (s.price || 0), 0);
    const grandTotal = servicesTotal + fee;

    setSubmitting(true);
    try {
      const response = await api.post("/tailors/orders", {
        tailorId: tailor._id,
        services: services.map(s => ({ serviceId: s._id, name: s.name, price: s.price, quantity: 1 })),
        totalAmount: grandTotal,
        isHomeService: serviceMode === "home",
        isPremiumService: serviceMode === "premium",
        homeServiceAddress: serviceMode === "home" ? address : "",
        visitDate: serviceMode === "home" ? visitDate.toISOString() : null,
        visitFee: fee
      });

      Alert.alert(
        "Booking Request Sent! ✂️",
        `Your booking request has been sent to ${tailor.shopName || "the tailor"}.\n\n⏳ Pending Tailor Confirmation: Your verification OTP will be generated as soon as the tailor partner confirms your booking.`,
        [
          {
            text: "View My Bookings",
            onPress: () => {
              navigation.navigate("MyBookings");
            }
          }
        ]
      );
    } catch (err) {
      console.error(err);
      const errMsg = err?.response?.data?.error || "Could not place booking request.";
      Alert.alert("Error", errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color="#0f172a" />
      </Pressable>
      <View>
        <Text style={styles.headerTitle}>Tailor Booking</Text>
        <Text style={styles.headerSubtitle}>Select Service Mode</Text>
      </View>
      <View style={{ width: 44 }} />
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 20) }]}>
      {renderHeader()}
      
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <Text style={styles.sectionTitle}>Select Booking Option</Text>

        {/* Option 1: Shop Service */}
        <Pressable 
          style={[styles.card, serviceMode === "shop" && styles.cardActive, !isShopAllowed && { opacity: 0.5 }]} 
          onPress={() => handleSelectMode("shop")}
        >
          <View style={styles.iconBox}>
            <Ionicons name="storefront" size={24} color={serviceMode === "shop" ? "#6d28d9" : "#64748b"} />
          </View>
          <View style={styles.cardInfo}>
            <View style={{flexDirection: "row", alignItems: "center", justifyContent: "space-between"}}>
              <Text style={[styles.cardTitle, serviceMode === "shop" && styles.cardTitleActive]}>🏪 Shop Service (Visit Shop)</Text>
              {!isShopAllowed && <Text style={{fontSize: 10, fontWeight: "800", color: "#ef4444", backgroundColor: "#fee2e2", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4}}>OFF</Text>}
            </View>
            <Text style={styles.cardDesc}>
              {isShopAllowed ? "Customer shop par jayega (Visit tailor shop for service & measurements)" : "Currently turned off by tailor"}
            </Text>
            <Text style={styles.feeTextFree}>No extra charges</Text>
          </View>
          <View style={[styles.radioCircle, serviceMode === "shop" && styles.radioCircleActive]}>
            {serviceMode === "shop" && <View style={styles.radioDot} />}
          </View>
        </Pressable>

        {/* Option 2: Home Service (Only shown if Tailor has Home Service ON) */}
        {isHomeAllowed && (
          <Pressable 
            style={[styles.card, serviceMode === "home" && styles.cardActive]} 
            onPress={() => handleSelectMode("home")}
          >
            <View style={styles.iconBox}>
              <Ionicons name="home" size={24} color={serviceMode === "home" ? "#6d28d9" : "#64748b"} />
            </View>
            <View style={styles.cardInfo}>
              <Text style={[styles.cardTitle, serviceMode === "home" && styles.cardTitleActive]}>🏡 Home Service (Doorstep Measurement Visit)</Text>
              <Text style={styles.cardDesc}>
                Tailor visits customer's home for doorstep measurements & trial fitting.
              </Text>
              <Text style={styles.feeText}>+₹{VISIT_FEE} Visit Fee</Text>
            </View>
            <View style={[styles.radioCircle, serviceMode === "home" && styles.radioCircleActive]}>
              {serviceMode === "home" && <View style={styles.radioDot} />}
            </View>
          </Pressable>
        )}

        {/* Option 3: Premium VIP Service */}
        {isPremiumAllowed && (
          <Pressable 
            style={[styles.card, serviceMode === "premium" && styles.cardActivePremium]} 
            onPress={() => handleSelectMode("premium")}
          >
            <View style={styles.iconBox}>
              <Ionicons name="ribbon" size={24} color={serviceMode === "premium" ? "#7c3aed" : "#64748b"} />
            </View>
            <View style={styles.cardInfo}>
              <Text style={[styles.cardTitle, serviceMode === "premium" && styles.cardTitleActivePremium]}>👑 Premium VIP Service (Priority Stitching)</Text>
              <Text style={styles.cardDesc}>
                Express priority stitching, premium fabric care, custom designer details & fast delivery.
              </Text>
              <Text style={styles.feeTextPremium}>+₹{PREMIUM_FEE} Premium Fee</Text>
            </View>
            <View style={[styles.radioCircle, serviceMode === "premium" && styles.radioCircleActivePremium]}>
              {serviceMode === "premium" && <View style={[styles.radioDot, { backgroundColor: "#7c3aed" }]} />}
            </View>
          </Pressable>
        )}

        {/* Home Visit Details (Only when Home Service is selected) */}
        {serviceMode === "home" && (
          <View style={styles.homeDetailsContainer}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <Text style={[styles.label, { marginBottom: 0 }]}>Full Delivery / Doorstep Address</Text>
              <Pressable 
                style={({ pressed }) => [
                  styles.gpsAutofillBtn,
                  pressed && { opacity: 0.7 }
                ]}
                onPress={handleFetchGPS}
                disabled={fetchingGps}
              >
                {fetchingGps ? (
                  <ActivityIndicator size="small" color="#0d9488" style={{ marginRight: 4 }} />
                ) : (
                  <Ionicons name="location" size={14} color="#0d9488" style={{ marginRight: 4 }} />
                )}
                <Text style={styles.gpsAutofillText}>
                  {fetchingGps ? "Locating..." : "Auto Fill"}
                </Text>
              </Pressable>
            </View>
            <TextInput 
              style={styles.textArea} 
              multiline 
              numberOfLines={3}
              placeholder="Enter your complete home address with landmark..."
              value={address}
              onChangeText={setAddress}
            />

            <Text style={styles.label}>Preferred Visit Time</Text>
            <Pressable style={styles.dateSelector} onPress={() => setDatePickerVisibility(true)}>
              <Ionicons name="calendar-outline" size={20} color="#475569" style={{ marginRight: 10 }} />
              <Text style={visitDate ? styles.dateTextSelected : styles.dateTextPlaceholder}>
                {visitDate ? visitDate.toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "Select Date & Time"}
              </Text>
            </Pressable>
          </View>
        )}

      </ScrollView>

      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="datetime"
        onConfirm={handleConfirmDate}
        onCancel={() => setDatePickerVisibility(false)}
        minimumDate={new Date()}
      />

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <Pressable style={[styles.nextBtn, submitting && { opacity: 0.7 }]} onPress={handlePlaceOrder} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.nextBtnText}>Place Booking Order</Text>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 16, backgroundColor: "#f8fafc" },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#ffffff", justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  headerTitle: { fontSize: 13, fontWeight: "700", color: "#0d9488", textAlign: "center", textTransform: "uppercase", letterSpacing: 1 },
  headerSubtitle: { fontSize: 18, fontWeight: "900", color: "#0f172a", textAlign: "center" },
  
  scrollContent: { padding: 20, paddingBottom: 120 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: "#0f172a", marginBottom: 16 },
  
  card: { flexDirection: "row", alignItems: "center", backgroundColor: "#ffffff", padding: 16, borderRadius: 16, marginBottom: 16, borderWidth: 2, borderColor: "#f1f5f9" },
  cardActive: { borderColor: "#0d9488", backgroundColor: "#f0fdf4" },
  iconBox: { width: 48, height: 48, borderRadius: 12, backgroundColor: "#f1f5f9", justifyContent: "center", alignItems: "center", marginRight: 16 },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#334155" },
  cardTitleActive: { color: "#0d9488" },
  cardDesc: { fontSize: 13, color: "#64748b", marginTop: 4, lineHeight: 18 },
  feeTextFree: { fontSize: 12, fontWeight: "700", color: "#22c55e", marginTop: 6 },
  feeText: { fontSize: 12, fontWeight: "700", color: "#f59e0b", marginTop: 6 },
  
  radioCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: "#cbd5e1", justifyContent: "center", alignItems: "center" },
  radioCircleActive: { borderColor: "#0d9488" },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#0d9488" },

  homeDetailsContainer: { marginTop: 10, padding: 16, backgroundColor: "#ffffff", borderRadius: 16, borderWidth: 1, borderColor: "#e2e8f0" },
  label: { fontSize: 13, fontWeight: "700", color: "#475569", marginBottom: 8, marginTop: 4 },
  textArea: { backgroundColor: "#f8fafc", borderRadius: 12, padding: 12, fontSize: 15, color: "#0f172a", minHeight: 80, textAlignVertical: "top", borderWidth: 1, borderColor: "#e2e8f0", marginBottom: 16 },
  gpsAutofillBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ccfbf1",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#99f6e4",
  },
  gpsAutofillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0d9488",
  },
  
  dateSelector: { flexDirection: "row", alignItems: "center", backgroundColor: "#f8fafc", borderRadius: 12, paddingHorizontal: 16, height: 50, borderWidth: 1, borderColor: "#e2e8f0" },
  dateTextPlaceholder: { fontSize: 15, color: "#94a3b8" },
  dateTextSelected: { fontSize: 15, color: "#0f172a", fontWeight: "600" },

  bottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#ffffff", paddingHorizontal: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: "#f1f5f9", shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 10 },
  nextBtn: { backgroundColor: "#0d9488", height: 56, borderRadius: 16, flexDirection: "row", justifyContent: "center", alignItems: "center" },
  nextBtnText: { color: "#ffffff", fontSize: 16, fontWeight: "700", marginRight: 8 },
  cardActivePremium: { borderColor: "#7c3aed", backgroundColor: "#faf5ff" },
  cardTitleActivePremium: { color: "#7c3aed" },
  feeTextPremium: { fontSize: 12, fontWeight: "700", color: "#7c3aed", marginTop: 6 },
  radioCircleActivePremium: { borderColor: "#7c3aed" }
});
