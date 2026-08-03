import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Mock Fabric Database for the Customer App
const MOCK_FABRICS = [
  { id: "f1", name: "Premium Italian Cotton", category: "Cotton", pricePerMeter: 800, color: "Navy Blue", image: "https://images.unsplash.com/photo-1605600659873-d808a13e4d2a?w=400&q=80" },
  { id: "f2", name: "Classic Linen", category: "Linen", pricePerMeter: 1200, color: "Beige", image: "https://images.unsplash.com/photo-1598522325754-046dd13ac1c0?w=400&q=80" },
  { id: "f3", name: "Pure Silk", category: "Silk", pricePerMeter: 2500, color: "Emerald Green", image: "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=400&q=80" },
  { id: "f4", name: "Wool Blend Suit Fabric", category: "Wool", pricePerMeter: 1500, color: "Charcoal Grey", image: "https://images.unsplash.com/photo-1582737632616-9818816c87db?w=400&q=80" },
];

export function TailorFabricScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { 
    tailor, 
    services,
    isHomeService,
    homeServiceAddress,
    visitDate,
    visitFee
  } = route.params;

  const [fabricSource, setFabricSource] = useState("customer"); // "customer" or "shop"
  const [selectedFabric, setSelectedFabric] = useState(null);
  
  // Basic meter calculation: 1 service = 3 meters for demonstration purposes
  const metersNeeded = services.length * 3;

  const handleNext = () => {
    let fabricDetails = null;
    if (fabricSource === "shop") {
      if (!selectedFabric) {
        alert("Please select a fabric from the shop.");
        return;
      }
      fabricDetails = {
        name: selectedFabric.name,
        color: selectedFabric.color,
        pricePerMeter: selectedFabric.pricePerMeter,
        metersNeeded: metersNeeded,
        totalFabricCost: selectedFabric.pricePerMeter * metersNeeded
      };
    }

    navigation.navigate("TailorDesign", { 
      tailor, 
      services,
      isHomeService,
      homeServiceAddress,
      visitDate,
      visitFee, 
      fabricSource, 
      fabricDetails 
    });
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color="#0f172a" />
      </Pressable>
      <View>
        <Text style={styles.headerTitle}>Step 1 of 3</Text>
        <Text style={styles.headerSubtitle}>Fabric Selection</Text>
      </View>
      <View style={{ width: 44 }} />
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 20) }]}>
      {renderHeader()}
      
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Where will the fabric come from?</Text>

        {/* Option 1: Customer Fabric */}
        <Pressable 
          style={[styles.sourceCard, fabricSource === "customer" && styles.sourceCardActive]} 
          onPress={() => setFabricSource("customer")}
        >
          <View style={styles.sourceIconBox}>
            <Ionicons name="bag-handle" size={24} color={fabricSource === "customer" ? "#0d9488" : "#64748b"} />
          </View>
          <View style={styles.sourceInfo}>
            <Text style={[styles.sourceTitle, fabricSource === "customer" && styles.sourceTitleActive]}>I will provide my own</Text>
            <Text style={styles.sourceDesc}>Hand over the fabric to the tailor during the visit.</Text>
          </View>
          <View style={[styles.radioCircle, fabricSource === "customer" && styles.radioCircleActive]}>
            {fabricSource === "customer" && <View style={styles.radioDot} />}
          </View>
        </Pressable>

        {/* Option 2: Shop Fabric */}
        <Pressable 
          style={[styles.sourceCard, fabricSource === "shop" && styles.sourceCardActive]} 
          onPress={() => setFabricSource("shop")}
        >
          <View style={styles.sourceIconBox}>
            <Ionicons name="storefront" size={24} color={fabricSource === "shop" ? "#0d9488" : "#64748b"} />
          </View>
          <View style={styles.sourceInfo}>
            <Text style={[styles.sourceTitle, fabricSource === "shop" && styles.sourceTitleActive]}>Buy from the Tailor</Text>
            <Text style={styles.sourceDesc}>Choose from the tailor's premium collection.</Text>
          </View>
          <View style={[styles.radioCircle, fabricSource === "shop" && styles.radioCircleActive]}>
            {fabricSource === "shop" && <View style={styles.radioDot} />}
          </View>
        </Pressable>

        {/* Fabric Catalog (Visible if Shop is selected) */}
        {fabricSource === "shop" && (
          <View style={styles.catalogSection}>
            <View style={styles.meterBox}>
              <Ionicons name="information-circle" size={20} color="#0d9488" />
              <Text style={styles.meterText}>
                Estimated <Text style={{fontWeight: "800"}}>{metersNeeded} meters</Text> required for your selected services.
              </Text>
            </View>

            <Text style={styles.sectionTitle}>Available Fabrics</Text>
            {MOCK_FABRICS.map(fabric => {
              const isSelected = selectedFabric?.id === fabric.id;
              return (
                <Pressable 
                  key={fabric.id} 
                  style={[styles.fabricCard, isSelected && styles.fabricCardActive]}
                  onPress={() => setSelectedFabric(fabric)}
                >
                  <Image source={{ uri: fabric.image }} style={styles.fabricImg} />
                  <View style={styles.fabricInfo}>
                    <Text style={styles.fabricName}>{fabric.name}</Text>
                    <Text style={styles.fabricCat}>{fabric.category} • {fabric.color}</Text>
                    <Text style={styles.fabricPrice}>₹{fabric.pricePerMeter} <Text style={styles.perMeter}>/ meter</Text></Text>
                  </View>
                  <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                    {isSelected && <View style={styles.radioDot} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <Pressable style={styles.nextBtn} onPress={handleNext}>
          <Text style={styles.nextBtnText}>Continue to Design</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
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
  sectionTitle: { fontSize: 16, fontWeight: "800", color: "#0f172a", marginBottom: 16, marginTop: 10 },
  
  sourceCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#ffffff", padding: 16, borderRadius: 16, marginBottom: 16, borderWidth: 2, borderColor: "#f1f5f9" },
  sourceCardActive: { borderColor: "#0d9488", backgroundColor: "#f0fdf4" },
  sourceIconBox: { width: 48, height: 48, borderRadius: 12, backgroundColor: "#f1f5f9", justifyContent: "center", alignItems: "center", marginRight: 16 },
  sourceInfo: { flex: 1 },
  sourceTitle: { fontSize: 16, fontWeight: "700", color: "#334155" },
  sourceTitleActive: { color: "#0d9488" },
  sourceDesc: { fontSize: 13, color: "#64748b", marginTop: 4, lineHeight: 18 },
  
  radioCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: "#cbd5e1", justifyContent: "center", alignItems: "center" },
  radioCircleActive: { borderColor: "#0d9488" },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#0d9488" },

  catalogSection: { marginTop: 16, borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingTop: 16 },
  meterBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#e6f7f2", padding: 16, borderRadius: 12, marginBottom: 20 },
  meterText: { fontSize: 14, color: "#0d9488", marginLeft: 10, flex: 1 },

  fabricCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#ffffff", padding: 12, borderRadius: 16, marginBottom: 12, borderWidth: 2, borderColor: "#f1f5f9" },
  fabricCardActive: { borderColor: "#0d9488", backgroundColor: "#f0fdf4" },
  fabricImg: { width: 64, height: 64, borderRadius: 12, backgroundColor: "#e2e8f0", marginRight: 12 },
  fabricInfo: { flex: 1 },
  fabricName: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  fabricCat: { fontSize: 12, color: "#64748b", marginTop: 2, marginBottom: 6 },
  fabricPrice: { fontSize: 15, fontWeight: "800", color: "#0f172a" },
  perMeter: { fontSize: 12, fontWeight: "600", color: "#64748b" },

  bottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#ffffff", paddingHorizontal: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: "#f1f5f9", shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 10 },
  nextBtn: { backgroundColor: "#0d9488", height: 56, borderRadius: 16, flexDirection: "row", justifyContent: "center", alignItems: "center" },
  nextBtnText: { color: "#ffffff", fontSize: 16, fontWeight: "700", marginRight: 8 }
});
