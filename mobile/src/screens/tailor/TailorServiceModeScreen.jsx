import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Alert, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../api/client";
import { getCurrentGPSLocation } from "../../services/locationService";
import { useAuth } from "../../context/AuthContext";

export function TailorServiceModeScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { tailor, services } = route.params;
  const { user, tailor: myTailor } = useAuth();

  const [currentTailor, setCurrentTailor] = useState(tailor);
  const [serviceMode, setServiceMode] = useState("shop"); // "shop", "home", "premium"
  
  const defaultAddr = user?.address?.line1 ? `${user.address.line1}, ${user.address.city || ""}` : "";
  const [address, setAddress] = useState(defaultAddr);
  const [homeLocation, setHomeLocation] = useState(
    user?.address?.lat && user?.address?.lng ? { lat: user.address.lat, lng: user.address.lng } : null
  );
  const [submitting, setSubmitting] = useState(false);
  const [fetchingGps, setFetchingGps] = useState(false);

  // Fetch freshest tailor details for exact partner configured fees
  React.useEffect(() => {
    const tId = tailor?._id || tailor?.id;
    if (tId) {
      api.get(`/tailors/${tId}`)
        .then((res) => {
          if (res.data?.tailor) setCurrentTailor(res.data.tailor);
        })
        .catch(() => {});
    }
  }, [tailor?._id, tailor?.id]);

  const isShopAllowed = currentTailor?.offersShopService !== false;
  const isHomeAllowed = currentTailor?.offersHomeService !== false;

  const homeFee = Math.max(0, Number(currentTailor?.homeServiceFee ?? currentTailor?.visitFee) || 0);

  const activeFee = serviceMode === "home" ? homeFee : 0;
  const servicesTotal = services.reduce((acc, s) => acc + (s.price || 0) * (s.quantity || 1), 0);
  const totalPieces = services.reduce((acc, s) => acc + (s.quantity || 1), 0);
  const grandTotal = servicesTotal + activeFee;

  const handleFetchGPS = async () => {
    setFetchingGps(true);
    try {
      const loc = await getCurrentGPSLocation();
      if (loc && loc.lat && loc.lng) {
        setHomeLocation({ lat: loc.lat, lng: loc.lng });
      }
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

  const handleSelectMode = (mode) => {
    if (mode === "shop" && !isShopAllowed) {
      return Alert.alert("Service Unavailable", "Shop service is currently turned off by the tailor.");
    }
    if (mode === "home" && !isHomeAllowed) {
      return Alert.alert("Service Unavailable", "Home service is currently turned off by the tailor.");
    }
    setServiceMode(mode);
  };

  const handlePlaceOrder = async () => {
    const myId = (user?._id || user?.id)?.toString();
    const ownerId = (currentTailor?.userId?._id || currentTailor?.userId || tailor?.userId?._id || tailor?.userId)?.toString();
    const targetTailorId = (currentTailor?._id || tailor?._id)?.toString();
    const isOwnTailor = Boolean(
      (myId && ownerId && myId === ownerId) ||
      (myTailor?._id && targetTailorId && myTailor._id.toString() === targetTailorId)
    );
    if (isOwnTailor) {
      return Alert.alert(
        "Action Not Allowed",
        "You cannot place an order at your own tailor shop. You can explore and book services from other tailor studios."
      );
    }
    if (currentTailor?.isShopOpen === false || tailor?.isShopOpen === false) {
      return Alert.alert("Shop Currently Closed", "This tailor studio is currently closed and not accepting new orders. Please try again when the shop opens.");
    }
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
    }

    const premiumSvc = (services || []).find(s => s.serviceMode === "premium" || s.isPremium || (s.name && /premium|vip/i.test(s.name)));
    const hasPremiumService = Boolean(premiumSvc);
    const premiumCompTime = premiumSvc?.completionTime || (hasPremiumService ? "12 Hours" : "");
    const premiumEstDays = hasPremiumService ? (premiumSvc?.estimatedDays || 1) : undefined;

    setSubmitting(true);
    try {
      const response = await api.post("/tailors/orders", {
        tailorId: currentTailor._id || tailor._id,
        services: services.map(s => ({ 
          serviceId: s._id || s.id, 
          name: s.name, 
          price: s.price, 
          quantity: s.quantity || 1,
          serviceMode: s.serviceMode || (hasPremiumService ? "premium" : "shop"),
          completionTime: s.completionTime || (hasPremiumService ? premiumCompTime : "")
        })),
        totalAmount: grandTotal,
        isHomeService: serviceMode === "home",
        isPremiumService: hasPremiumService,
        completionTime: hasPremiumService ? premiumCompTime : undefined,
        estimatedDays: hasPremiumService ? premiumEstDays : undefined,
        homeServiceAddress: address.trim() || "",
        homeServiceLocation: homeLocation || undefined,
        visitDate: null,
        visitFee: activeFee
      });

      Alert.alert(
        "Booking Request Sent! ✂️",
        `Your booking request has been sent to ${currentTailor?.shopName || tailor?.shopName || "the tailor"}.\n\n⏳ Pending Tailor Confirmation: Your verification OTP will be generated as soon as the tailor partner confirms your booking.`,
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
        
        {/* Selected Services & Stitching Quantity Breakdown */}
        <View style={{ backgroundColor: "#ffffff", padding: 14, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: "#e2e8f0" }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10, borderBottomWidth: 1, borderBottomColor: "#f1f5f9", paddingBottom: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="receipt-outline" size={16} color="#0d9488" />
              <Text style={{ fontSize: 13, fontWeight: "800", color: "#0f172a" }}>Selected Stitching Services</Text>
            </View>
            <View style={{ backgroundColor: "#ccfbf1", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
              <Text style={{ fontSize: 11, fontWeight: "800", color: "#0f766e" }}>{totalPieces} Pcs Total</Text>
            </View>
          </View>
          {services.map((s, idx) => {
            const qty = s.quantity || 1;
            return (
              <View key={idx} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginVertical: 4 }}>
                <Text style={{ fontSize: 13, color: "#334155", fontWeight: "600", flex: 1 }} numberOfLines={1}>
                  • {s.name} <Text style={{ color: "#0d9488", fontWeight: "800" }}>× {qty} pcs</Text>
                </Text>
                <Text style={{ fontSize: 13, color: "#0f172a", fontWeight: "700" }}>
                  ₹{(s.price || 0) * qty}
                </Text>
              </View>
            );
          })}
        </View>

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
              {homeFee > 0 ? (
                <Text style={styles.feeText}>+₹{homeFee} Visit Charge</Text>
              ) : (
                <Text style={styles.feeTextFree}>Free (No extra charges)</Text>
              )}
            </View>
            <View style={[styles.radioCircle, serviceMode === "home" && styles.radioCircleActive]}>
              {serviceMode === "home" && <View style={styles.radioDot} />}
            </View>
          </Pressable>
        )}

        {/* Address & Auto Address (GPS) Details */}
        <View style={styles.homeDetailsContainer}>
          <View style={styles.addressHeaderRow}>
            <View style={styles.addressLabelWrap}>
              <Ionicons name="location-outline" size={16} color="#0d9488" style={{ marginRight: 5 }} />
              <Text style={styles.label} numberOfLines={1} ellipsizeMode="tail">
                {serviceMode === "home" ? "Doorstep Address (Required)" : "Delivery Location (Optional)"}
              </Text>
            </View>
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
                <Ionicons name="locate" size={13} color="#0d9488" style={{ marginRight: 4 }} />
              )}
              <Text style={styles.gpsAutofillText}>
                {fetchingGps ? "Locating..." : "Auto Address"}
              </Text>
            </Pressable>
          </View>
          <TextInput 
            style={styles.textArea} 
            multiline 
            numberOfLines={3}
            placeholder={serviceMode === "home" ? "Enter your complete home address with landmark..." : "Enter your address or tap Auto Address..."}
            placeholderTextColor="#94a3b8"
            value={address}
            onChangeText={setAddress}
          />
        </View>

      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.totalRow}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.totalLabel}>Total Payable</Text>
            {activeFee > 0 ? (
              <Text style={{ fontSize: 11, color: "#64748b", fontWeight: "600", marginTop: 2 }}>
                Includes ₹{activeFee} doorstep visit charge
              </Text>
            ) : (
              <Text style={{ fontSize: 11, color: "#16a34a", fontWeight: "600", marginTop: 2 }}>
                No extra charges
              </Text>
            )}
          </View>
          <Text style={styles.totalValue}>₹{grandTotal}</Text>
        </View>
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
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, backgroundColor: "#f8fafc" },
  backBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#ffffff", justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  headerTitle: { fontSize: 12, fontWeight: "700", color: "#0d9488", textAlign: "center", textTransform: "uppercase", letterSpacing: 1 },
  headerSubtitle: { fontSize: 17, fontWeight: "900", color: "#0f172a", textAlign: "center" },
  
  scrollContent: { padding: 16, paddingBottom: 160 },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: "#0f172a", marginBottom: 14 },
  
  card: { flexDirection: "row", alignItems: "center", backgroundColor: "#ffffff", padding: 14, borderRadius: 16, marginBottom: 14, borderWidth: 1.5, borderColor: "#e2e8f0" },
  cardActive: { borderColor: "#0d9488", backgroundColor: "#f0fdf4" },
  iconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#f1f5f9", justifyContent: "center", alignItems: "center", marginRight: 12 },
  cardInfo: { flex: 1, marginRight: 8 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#334155" },
  cardTitleActive: { color: "#0d9488" },
  cardDesc: { fontSize: 12, color: "#64748b", marginTop: 4, lineHeight: 17 },
  feeTextFree: { fontSize: 11.5, fontWeight: "700", color: "#22c55e", marginTop: 5 },
  feeText: { fontSize: 11.5, fontWeight: "700", color: "#f59e0b", marginTop: 5 },
  
  radioCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: "#cbd5e1", justifyContent: "center", alignItems: "center" },
  radioCircleActive: { borderColor: "#0d9488" },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#0d9488" },

  homeDetailsContainer: { marginTop: 8, padding: 14, backgroundColor: "#ffffff", borderRadius: 16, borderWidth: 1, borderColor: "#e2e8f0" },
  addressHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 8,
  },
  addressLabelWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
    marginRight: 6,
  },
  label: { 
    fontSize: 12.5, 
    fontWeight: "700", 
    color: "#334155", 
    flex: 1,
    flexShrink: 1,
  },
  textArea: { backgroundColor: "#f8fafc", borderRadius: 12, padding: 12, fontSize: 14, color: "#0f172a", minHeight: 75, textAlignVertical: "top", borderWidth: 1, borderColor: "#e2e8f0" },
  gpsAutofillBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ccfbf1",
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#99f6e4",
    flexShrink: 0,
    alignSelf: "center",
  },
  gpsAutofillText: {
    fontSize: 11.5,
    fontWeight: "800",
    color: "#0d9488",
    marginLeft: 2,
  },
  
  dateSelector: { flexDirection: "row", alignItems: "center", backgroundColor: "#f8fafc", borderRadius: 12, paddingHorizontal: 16, height: 50, borderWidth: 1, borderColor: "#e2e8f0" },
  dateTextPlaceholder: { fontSize: 14, color: "#94a3b8" },
  dateTextSelected: { fontSize: 14, color: "#0f172a", fontWeight: "600" },

  bottomBar: { 
    position: "absolute", 
    bottom: 0, 
    left: 0, 
    right: 0, 
    backgroundColor: "#ffffff", 
    paddingHorizontal: 18, 
    paddingTop: 14, 
    borderTopWidth: 1, 
    borderTopColor: "#e2e8f0", 
    shadowColor: "#000", 
    shadowOffset: { width: 0, height: -4 }, 
    shadowOpacity: 0.08, 
    shadowRadius: 8, 
    elevation: 8 
  },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  totalLabel: { fontSize: 13.5, fontWeight: "700", color: "#64748b" },
  totalValue: { fontSize: 18, fontWeight: "900", color: "#0f172a" },
  nextBtn: { backgroundColor: "#0d9488", height: 50, borderRadius: 14, flexDirection: "row", justifyContent: "center", alignItems: "center" },
  nextBtnText: { color: "#ffffff", fontSize: 15, fontWeight: "800", marginRight: 8 },
  cardActivePremium: { borderColor: "#7c3aed", backgroundColor: "#faf5ff" },
  cardTitleActivePremium: { color: "#7c3aed" },
  feeTextPremium: { fontSize: 11.5, fontWeight: "700", color: "#7c3aed", marginTop: 5 },
  radioCircleActivePremium: { borderColor: "#7c3aed" }
});
