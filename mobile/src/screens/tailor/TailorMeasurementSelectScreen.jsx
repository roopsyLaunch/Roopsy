import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../../api/client";

export function TailorMeasurementSelectScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { 
    tailor, 
    services, 
    isHomeService,
    homeServiceAddress,
    visitDate,
    visitFee,
    fabricSource, 
    fabricDetails, 
    designPreferences 
  } = route.params;

  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // "shop" means I will visit shop. otherwise it's the profile ID.
  const [selectedProfileId, setSelectedProfileId] = useState("shop"); 

  const fetchProfiles = useCallback(async () => {
    try {
      const res = await api.get("/measurements");
      setProfiles(res.data.profiles || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchProfiles();
    }, [fetchProfiles])
  );

  const handleNext = () => {
    let measurementProfileId = null;
    let selectedProfileName = "Will visit shop";
    
    if (selectedProfileId !== "shop") {
      measurementProfileId = selectedProfileId;
      const prof = profiles.find(p => p._id === selectedProfileId);
      if (prof) selectedProfileName = prof.profileName;
    }

    navigation.navigate("TailorOrder", { 
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
    });
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color="#0f172a" />
      </Pressable>
      <View>
        <Text style={styles.headerTitle}>Step 3 of 3</Text>
        <Text style={styles.headerSubtitle}>Measurements</Text>
      </View>
      <View style={{ width: 44 }} />
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 20) }]}>
      {renderHeader()}
      
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <Text style={styles.sectionTitle}>How will you provide measurements?</Text>
        <Text style={styles.sectionDesc}>Select a saved profile or visit the shop for accurate sizing.</Text>

        {/* Visit Option */}
        <Pressable 
          style={[styles.card, selectedProfileId === "shop" && styles.cardActive]} 
          onPress={() => setSelectedProfileId("shop")}
        >
          <View style={styles.iconBox}>
            <Ionicons name={isHomeService ? "home" : "walk"} size={24} color={selectedProfileId === "shop" ? "#0d9488" : "#64748b"} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={[styles.cardTitle, selectedProfileId === "shop" && styles.cardTitleActive]}>
              {isHomeService ? "Tailor will take measurements" : "I'll visit the shop"}
            </Text>
            <Text style={styles.cardDesc}>
              {isHomeService ? "The tailor will measure you during the home visit." : "Get measured accurately by the tailor at their shop."}
            </Text>
          </View>
          <View style={[styles.radioCircle, selectedProfileId === "shop" && styles.radioCircleActive]}>
            {selectedProfileId === "shop" && <View style={styles.radioDot} />}
          </View>
        </Pressable>

        <View style={styles.divider}>
          <Text style={styles.dividerText}>OR SELECT SAVED PROFILE</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#0d9488" style={{ marginTop: 20 }} />
        ) : (
          <>
            {profiles.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="body-outline" size={40} color="#cbd5e1" style={{ marginBottom: 10 }} />
                <Text style={styles.emptyText}>No saved measurement profiles found.</Text>
                <Pressable style={styles.addBtn} onPress={() => navigation.navigate("MeasurementForm")}>
                  <Text style={styles.addBtnText}>Create Profile</Text>
                </Pressable>
              </View>
            ) : (
              profiles.map(profile => {
                const isSelected = selectedProfileId === profile._id;
                return (
                  <Pressable 
                    key={profile._id} 
                    style={[styles.card, isSelected && styles.cardActive]} 
                    onPress={() => setSelectedProfileId(profile._id)}
                  >
                    <View style={styles.iconBox}>
                      <Ionicons name="person" size={24} color={isSelected ? "#0d9488" : "#64748b"} />
                    </View>
                    <View style={styles.cardInfo}>
                      <Text style={[styles.cardTitle, isSelected && styles.cardTitleActive]}>{profile.profileName}</Text>
                      <Text style={styles.cardDesc}>
                        {profile.measurementType === "standard" ? `Size: ${profile.standardSize}` : `Custom (${profile.unit})`} • {profile.gender}
                      </Text>
                    </View>
                    <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                      {isSelected && <View style={styles.radioDot} />}
                    </View>
                  </Pressable>
                );
              })
            )}
          </>
        )}

      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <Pressable style={styles.nextBtn} onPress={handleNext}>
          <Text style={styles.nextBtnText}>Review & Checkout</Text>
          <Ionicons name="cart" size={20} color="#fff" />
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
  sectionTitle: { fontSize: 18, fontWeight: "800", color: "#0f172a", marginBottom: 6 },
  sectionDesc: { fontSize: 14, color: "#64748b", marginBottom: 24 },
  
  card: { flexDirection: "row", alignItems: "center", backgroundColor: "#ffffff", padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 2, borderColor: "#f1f5f9" },
  cardActive: { borderColor: "#0d9488", backgroundColor: "#f0fdf4" },
  iconBox: { width: 48, height: 48, borderRadius: 12, backgroundColor: "#f1f5f9", justifyContent: "center", alignItems: "center", marginRight: 16 },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#334155" },
  cardTitleActive: { color: "#0d9488" },
  cardDesc: { fontSize: 13, color: "#64748b", marginTop: 4 },
  
  radioCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: "#cbd5e1", justifyContent: "center", alignItems: "center" },
  radioCircleActive: { borderColor: "#0d9488" },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#0d9488" },

  divider: { marginVertical: 20, alignItems: "center" },
  dividerText: { fontSize: 11, fontWeight: "800", color: "#94a3b8", letterSpacing: 1 },

  emptyBox: { backgroundColor: "#ffffff", padding: 30, borderRadius: 16, alignItems: "center", borderWidth: 1, borderColor: "#e2e8f0", borderStyle: "dashed" },
  emptyText: { fontSize: 14, color: "#64748b", marginBottom: 16, textAlign: "center" },
  addBtn: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: "#e6f7f2", borderRadius: 8 },
  addBtnText: { fontSize: 14, fontWeight: "700", color: "#0d9488" },

  bottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#ffffff", paddingHorizontal: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: "#f1f5f9", shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 10 },
  nextBtn: { backgroundColor: "#0d9488", height: 56, borderRadius: 16, flexDirection: "row", justifyContent: "center", alignItems: "center" },
  nextBtnText: { color: "#ffffff", fontSize: 16, fontWeight: "700", marginRight: 8 }
});
