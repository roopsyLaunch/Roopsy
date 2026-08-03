import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Alert, TouchableOpacity } from "react-native";
import LocationPickerModal from "../../components/LocationPickerModal";
import { getCurrentGPSLocation } from "../../services/locationService";

export function PartnerBasicInfoScreen({ navigation, route }) {
  const category = route.params?.registrationData?.category || "Barber Shop";
  const isParlor = category === "Beauty Parlor";
  const isStitching = category === "Tailor" || category === "Stitching Center";

  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [fetchingGps, setFetchingGps] = useState(false);

  const [data, setData] = useState({
    shopName: route.params?.registrationData?.shopName || "",
    ownerName: route.params?.registrationData?.ownerName || "",
    mobileNumber: route.params?.registrationData?.mobileNumber || "",
    addressLine: route.params?.registrationData?.addressLine || "",
    city: route.params?.registrationData?.city || "",
    pincode: route.params?.registrationData?.pincode || "",
    seatCount: route.params?.registrationData?.seatCount || "1",
    lat: route.params?.registrationData?.lat || null,
    lng: route.params?.registrationData?.lng || null,
  });

  const onChange = (key, value) => setData(prev => ({ ...prev, [key]: value }));

  const handleSelectLocation = (loc) => {
    setData((prev) => ({
      ...prev,
      addressLine: loc.line1 || loc.shortName || prev.addressLine,
      city: loc.city || loc.shortName || prev.city,
      pincode: loc.pincode || prev.pincode,
      lat: loc.lat,
      lng: loc.lng,
    }));
  };

  const handleFetchGPS = async () => {
    setFetchingGps(true);
    try {
      const loc = await getCurrentGPSLocation();
      handleSelectLocation(loc);
    } catch (e) {
      Alert.alert("GPS Access", "Could not fetch GPS location. Please check device location permissions.");
    } finally {
      setFetchingGps(false);
    }
  };

  const onContinue = () => {
    navigation.navigate("PartnerServices", {
      registrationData: { ...(route.params?.registrationData || {}), ...data }
    });
  };

  const StepIndicator = () => (
    <View style={styles.stepContainer}>
      {[1,2,3,4,5,6].map(step => (
        <React.Fragment key={step}>
          <View style={[styles.stepCircle, step === 1 && styles.stepActive]}>
            <Text style={[styles.stepText, step === 1 && styles.stepTextActive]}>{step}</Text>
          </View>
          {step < 6 && <View style={styles.stepLine} />}
        </React.Fragment>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </Pressable>
        <Text style={styles.headerTitle}>Basic Information</Text>
        <View style={{ width: 40 }} />
      </View>
      <StepIndicator />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container}>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              {isParlor ? "Beauty Parlor Name" : isStitching ? "Tailor Shop Name" : "Shop / Business Name"}
            </Text>
            <TextInput style={styles.input} placeholder={isParlor ? "Enter parlor name" : isStitching ? "Enter tailor shop name" : "Enter shop name"} value={data.shopName} onChangeText={t => onChange("shopName", t)} />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Owner Name</Text>
            <TextInput style={styles.input} placeholder="Enter owner name" value={data.ownerName} onChangeText={t => onChange("ownerName", t)} />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Mobile Number</Text>
            <TextInput style={styles.input} placeholder="Enter mobile number" keyboardType="phone-pad" value={data.mobileNumber} onChangeText={t => onChange("mobileNumber", t)} />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Total Seats / Chairs</Text>
            <TextInput style={styles.input} placeholder="Enter total seats" keyboardType="number-pad" value={String(data.seatCount)} onChangeText={t => onChange("seatCount", t)} />
          </View>

          {/* Address Section Card Group */}
          <View style={styles.addressCardGroup}>
            <View style={styles.addressCardHeader}>
              <Text style={styles.addressCardTitle}>Shop Address</Text>
              <Pressable style={styles.mapTriggerBtn} onPress={() => setLocationModalVisible(true)}>
                <Ionicons name="location-sharp" size={14} color="#7c3aed" />
                <Text style={styles.mapTriggerText}>Pick on Map</Text>
              </Pressable>
            </View>

            {/* Quick 1-Tap GPS Auto-Detect Button */}
            <TouchableOpacity
              style={styles.directGpsBtn}
              onPress={handleFetchGPS}
              disabled={fetchingGps}
              activeOpacity={0.7}
            >
              {fetchingGps ? (
                <ActivityIndicator size="small" color="#6d28d9" />
              ) : (
                <Ionicons name="navigate-circle" size={22} color="#6d28d9" style={{ marginRight: 6 }} />
              )}
              <Text style={styles.directGpsText}>
                {fetchingGps ? "Detecting GPS Position..." : "📍 Auto-Detect My Current GPS Location"}
              </Text>
            </TouchableOpacity>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Address</Text>
              <TextInput 
                style={styles.input} 
                placeholder="e.g. Shop 12, Main Market" 
                value={data.addressLine} 
                onChangeText={t => onChange("addressLine", t)} 
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 12 }]}>
                <Text style={styles.label}>City</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder="e.g. Lucknow" 
                  value={data.city} 
                  onChangeText={t => onChange("city", t)} 
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Pincode</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder="e.g. 226001" 
                  keyboardType="number-pad" 
                  value={data.pincode} 
                  onChangeText={t => onChange("pincode", t)} 
                />
              </View>
            </View>
          </View>

          <Pressable style={styles.btn} onPress={onContinue}>
            <Text style={styles.btnText}>Continue</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Leaflet & OpenStreetMap Location Picker Modal */}
      <LocationPickerModal
        visible={locationModalVisible}
        onClose={() => setLocationModalVisible(false)}
        onSelectLocation={handleSelectLocation}
        initialCity={data.city || "Lucknow"}
        initialAddress={data.addressLine || ""}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#ffffff" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 16, fontWeight: "700" },
  stepContainer: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16 },
  stepCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#f1f5f9", justifyContent: "center", alignItems: "center" },
  stepActive: { backgroundColor: "#6d28d9" },
  stepText: { fontSize: 12, color: "#94a3b8", fontWeight: "600" },
  stepTextActive: { color: "#fff" },
  stepLine: { width: 20, height: 2, backgroundColor: "#e2e8f0", marginHorizontal: 4 },
  container: { padding: 24, paddingBottom: 40 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: "700", color: "#64748b", marginBottom: 6 },
  input: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, padding: 14, fontSize: 14, color: "#0f172a", backgroundColor: "#f8fafc" },
  row: { flexDirection: "row" },
  addressCardGroup: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  addressCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  addressCardTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a",
  },
  mapTriggerBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3e8ff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  mapTriggerText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#7c3aed",
    marginLeft: 4,
  },
  directGpsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3e8ff",
    borderWidth: 1.5,
    borderColor: "#c4b5fd",
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  directGpsText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#6d28d9",
  },
  btn: { backgroundColor: "#6d28d9", padding: 16, borderRadius: 12, alignItems: "center", marginTop: 10 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
