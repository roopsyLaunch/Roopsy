import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../api/client";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function TailorOrderScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  
  // Params from previous step
  const { 
    tailor, 
    services, 
    isHomeService,
    homeServiceAddress,
    visitDate,
    visitFee,
    fabricSource, 
    fabricDetails, 
    designPreferences, 
    measurementProfileId, 
    selectedProfileName 
  } = route.params;

  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const servicesTotal = services.reduce((acc, s) => acc + s.price, 0);
  const fabricTotal = fabricDetails ? fabricDetails.totalFabricCost : 0;
  const visitTotal = visitFee || 0;
  const grandTotal = servicesTotal + fabricTotal + visitTotal;

  const handleSubmit = async () => {
    setBusy(true);
    try {
      await api.post("/tailors/orders", {
        tailorId: tailor._id,
        services: services.map(s => ({ serviceId: s._id, name: s.name, price: s.price, quantity: 1 })),
        totalAmount: grandTotal,
        fabricSource,
        fabricDetails,
        designPreferences,
        isHomeService,
        homeServiceAddress,
        visitDate,
        visitFee,
        measurementProfileId,
        notes,
      });
      
      Alert.alert("Order Placed!", "Your tailoring order has been placed successfully.", [
        { text: "View Bookings", onPress: () => navigation.navigate("MyBookings") }
      ]);
    } catch (err) {
      console.error(err);
      Alert.alert("Error", err?.response?.data?.error || "Failed to place order");
    } finally {
      setBusy(false);
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color="#0f172a" />
      </Pressable>
      <View>
        <Text style={styles.headerTitle}>Review</Text>
        <Text style={styles.headerSubtitle}>Order Summary</Text>
      </View>
      <View style={{ width: 44 }} />
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 20) }]}>
      {renderHeader()}

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Services & Cost Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.sectionTitleDark}>Cost Breakdown</Text>
          
          <Text style={styles.subheadingDark}>Stitching Services</Text>
          {services.map(svc => (
            <View key={svc._id} style={styles.row}>
              <Text style={styles.rowLabelDark}>{svc.name}</Text>
              <Text style={styles.rowValueDark}>₹{svc.price}</Text>
            </View>
          ))}
          
          {fabricSource === "shop" && fabricDetails && (
            <>
              <Text style={[styles.subheadingDark, { marginTop: 12 }]}>Fabric (From Shop)</Text>
              <View style={styles.row}>
                <Text style={styles.rowLabelDark}>{fabricDetails.name} ({fabricDetails.metersNeeded}m)</Text>
                <Text style={styles.rowValueDark}>₹{fabricDetails.totalFabricCost}</Text>
              </View>
            </>
          )}

          {isHomeService && (
            <>
              <Text style={[styles.subheadingDark, { marginTop: 12 }]}>Logistics</Text>
              <View style={styles.row}>
                <Text style={styles.rowLabelDark}>At-Home Visit Fee</Text>
                <Text style={styles.rowValueDark}>₹{visitFee}</Text>
              </View>
            </>
          )}

          <View style={styles.dividerDark} />
          
          <View style={styles.row}>
            <Text style={styles.totalText}>Grand Total</Text>
            <Text style={styles.totalPrice}>₹{grandTotal}</Text>
          </View>
        </View>

        {/* Selected Details */}
        <View style={styles.detailsCard}>
          
          <View style={styles.detailItem}>
            <Ionicons name="color-palette" size={20} color="#6d28d9" style={styles.detailIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.detailLabel}>Fabric Source</Text>
              <Text style={styles.detailValue}>
                {fabricSource === "customer" ? "I will provide my own fabric" : `${fabricDetails.name} (${fabricDetails.color})`}
              </Text>
            </View>
          </View>

          <View style={styles.dividerLight} />

          <View style={styles.detailItem}>
            <Ionicons name="shirt" size={20} color="#6d28d9" style={styles.detailIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.detailLabel}>Design Preferences</Text>
              <Text style={styles.detailValue}>Fit: {designPreferences.fit}</Text>
              <Text style={styles.detailValue}>Collar: {designPreferences.collar}</Text>
              <Text style={styles.detailValue}>Sleeves: {designPreferences.sleeves}</Text>
              <Text style={styles.detailValue}>Pockets: {designPreferences.pockets}</Text>
              {designPreferences.referenceImageUrl && <Text style={styles.detailValueInfo}>+ Reference Image Uploaded</Text>}
            </View>
          </View>

          <View style={styles.dividerLight} />

          <View style={styles.detailItem}>
            <Ionicons name="body" size={20} color="#6d28d9" style={styles.detailIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.detailLabel}>Measurements</Text>
              <Text style={styles.detailValue}>{selectedProfileName}</Text>
            </View>
          </View>

        </View>

        {/* Selected Details */}
        <View style={styles.detailsCard}>
          <View style={styles.detailItem}>
            <Ionicons name="location" size={20} color="#6d28d9" style={styles.detailIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.detailLabel}>Delivery & Service</Text>
              {isHomeService ? (
                <>
                  <Text style={styles.detailValue}>At-Home Tailoring</Text>
                  <Text style={styles.detailValueInfo}>{homeServiceAddress}</Text>
                  <Text style={styles.detailValueInfo}>
                    {new Date(visitDate).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                  </Text>
                </>
              ) : (
                <Text style={styles.detailValue}>Visit Tailor Shop</Text>
              )}
            </View>
          </View>
        </View>

        {/* Special Notes */}
        <View style={styles.detailsCard}>
          <Text style={styles.detailLabel}>Special Instructions (Optional)</Text>
          <TextInput 
            style={styles.textArea} 
            multiline 
            numberOfLines={3}
            placeholder="Any extra instructions for the tailor..."
            value={notes}
            onChangeText={setNotes}
          />
        </View>

      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <Pressable style={styles.btn} onPress={handleSubmit} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Confirm Order (₹{grandTotal})</Text>}
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
  
  summaryCard: { backgroundColor: "#0f172a", padding: 20, borderRadius: 20, marginBottom: 16 },
  sectionTitleDark: { fontSize: 18, fontWeight: "800", color: "#ffffff", marginBottom: 16 },
  subheadingDark: { fontSize: 12, fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", marginBottom: 8, letterSpacing: 0.5 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  rowLabelDark: { color: "#cbd5e1", fontSize: 14, flex: 1 },
  rowValueDark: { color: "#ffffff", fontSize: 14, fontWeight: "600" },
  dividerDark: { height: 1, backgroundColor: "#334155", marginVertical: 16 },
  totalText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
  totalPrice: { color: "#2dd4bf", fontSize: 20, fontWeight: "900" },

  detailsCard: { backgroundColor: "#ffffff", padding: 20, borderRadius: 20, marginBottom: 16, borderWidth: 1, borderColor: "#e2e8f0" },
  detailItem: { flexDirection: "row" },
  detailIcon: { marginRight: 12, marginTop: 2 },
  detailLabel: { fontSize: 13, fontWeight: "700", color: "#64748b", marginBottom: 4, textTransform: "uppercase" },
  detailValue: { fontSize: 15, fontWeight: "600", color: "#0f172a", marginBottom: 2 },
  detailValueInfo: { fontSize: 13, fontWeight: "600", color: "#22c55e", marginTop: 4 },
  dividerLight: { height: 1, backgroundColor: "#f1f5f9", marginVertical: 16 },

  textArea: { backgroundColor: "#f8fafc", borderRadius: 12, padding: 12, fontSize: 15, color: "#0f172a", marginTop: 8, minHeight: 80, textAlignVertical: "top", borderWidth: 1, borderColor: "#e2e8f0" },

  bottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#ffffff", paddingHorizontal: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: "#f1f5f9", shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 10 },
  btn: { backgroundColor: "#0d9488", height: 56, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  btnText: { color: "#ffffff", fontSize: 16, fontWeight: "800" }
});
