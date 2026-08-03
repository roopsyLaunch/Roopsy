import React, { useState, useCallback, useEffect } from "react";
import { View, Text, FlatList, Image, Pressable, StyleSheet, ActivityIndicator, RefreshControl, TextInput, ScrollView, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../api/client";

import { Alert } from "react-native";
import { getCurrentGPSLocation } from "../../services/locationService";

const { width } = Dimensions.get("window");
const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1598522325754-046dd13ac1c0?w=500&auto=format&fit=crop&q=80";
const BANNER_IMAGE = "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=500&auto=format&fit=crop&q=80";

export function TailorListScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Shops");

  const [gpsCoords, setGpsCoords] = useState(null);
  const [gpsActive, setGpsActive] = useState(false);
  const [locationDetecting, setLocationDetecting] = useState(false);

  const CATEGORIES = [
    { label: "All Shops", icon: "grid-outline" },
    { label: "Top Rated", icon: "star-outline" },
    { label: "Open Now", icon: "time-outline" },
    { label: "Filter", icon: "options-outline" }
  ];

  const load = useCallback(async () => {
    try {
      const params = {};
      if (gpsCoords) {
        params.lat = gpsCoords.lat;
        params.lng = gpsCoords.lng;
      }
      const res = await api.get("/tailors", { params });
      setItems(res.data.tailors || []);
    } catch (err) {
      console.error("TailorListScreen load error:", err);
    }
  }, [gpsCoords]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleNearMePress = async () => {
    if (gpsActive) {
      setGpsActive(false);
      setGpsCoords(null);
      setSearchQuery("");
      return;
    }
    setLocationDetecting(true);
    try {
      const loc = await getCurrentGPSLocation();
      setGpsCoords({ lat: loc.lat, lng: loc.lng });
      setGpsActive(true);
      setSearchQuery(loc.shortName || loc.city || "");
    } catch (err) {
      Alert.alert("Location Error", "Failed to detect current location. Please verify GPS permission.");
    } finally {
      setLocationDetecting(false);
    }
  };

  const filteredTailors = items.filter(tailor => {
    const matchesSearch = tailor.shopName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          tailor.address?.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          tailor.address?.line1?.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesCategory = true;
    if (selectedCategory === "Open Now") {
      matchesCategory = tailor.isShopOpen;
    }
    // Add logic for Top Rated, etc. if needed later

    return matchesSearch && matchesCategory;
  });

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </Pressable>
        <View style={styles.headerTitleContainer}>
          <View style={styles.iconCircle}>
            <Ionicons name="cut-outline" size={20} color="#0d9488" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Tailor Shops</Text>
            <Text style={styles.headerSubtitle}>Find & book the best tailor near you</Text>
          </View>
        </View>
        <Pressable style={styles.notifBtn}>
          <Ionicons name="notifications-outline" size={24} color="#0f172a" />
          <View style={styles.notifBadge} />
        </Pressable>
      </View>
    </View>
  );

  const renderFilters = () => (
    <View style={styles.filterContainer}>
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color="#94a3b8" />
          <TextInput 
            style={styles.searchInput}
            placeholder="Search tailor shops near you..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={20} color="#94a3b8" />
            </Pressable>
          )}
        </View>
        <Pressable 
          style={[styles.nearMeBtn, gpsActive && styles.nearMeBtnActive]} 
          onPress={handleNearMePress}
          disabled={locationDetecting}
        >
          {locationDetecting ? (
            <ActivityIndicator size="small" color="#6d28d9" />
          ) : (
            <>
              <Ionicons name="location" size={16} color={gpsActive ? "#ffffff" : "#475569"} />
              <Text style={[styles.nearMeText, gpsActive && styles.nearMeTextActive]}>Near me</Text>
            </>
          )}
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillScroll}>
        {CATEGORIES.map(cat => {
          const isActive = selectedCategory === cat.label;
          return (
            <Pressable 
              key={cat.label} 
              style={[styles.pill, isActive && styles.pillActive]}
              onPress={() => setSelectedCategory(cat.label)}
            >
              <Ionicons name={cat.icon} size={16} color={isActive ? "#0d9488" : "#64748b"} style={{ marginRight: 6 }} />
              <Text style={[styles.pillText, isActive && styles.pillTextActive]}>{cat.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderBanner = () => (
    <View style={styles.bannerContainer}>
      <Image source={{ uri: BANNER_IMAGE }} style={styles.bannerImage} />
      <View style={styles.bannerOverlay}>
        <Text style={styles.bannerTitle}>Expert Tailoring</Text>
        <Text style={styles.bannerSubtitle}>Perfect Fit. Every Time.</Text>
        <Text style={styles.bannerDesc}>Book trusted tailors for stitching, alterations & custom designs.</Text>
        <Pressable style={styles.bannerBtn}>
          <Text style={styles.bannerBtnText}>Book Now</Text>
          <Ionicons name="arrow-forward" size={16} color="#fff" />
        </Pressable>
      </View>
    </View>
  );

  const renderSectionTitle = () => (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>Top Tailor Shops Near You</Text>
      <Pressable>
        <Text style={styles.viewAll}>View all</Text>
      </Pressable>
    </View>
  );

  const renderTrustIcons = () => (
    <View style={styles.trustContainer}>
      <View style={styles.trustItem}>
        <View style={styles.trustIconCircle}>
          <Ionicons name="shield-checkmark-outline" size={24} color="#0d9488" />
        </View>
        <Text style={styles.trustTitle}>Verified Shops</Text>
        <Text style={styles.trustDesc}>Trusted & verified tailor shops</Text>
      </View>
      <View style={styles.trustItem}>
        <View style={styles.trustIconCircle}>
          <Ionicons name="cut-outline" size={24} color="#0d9488" />
        </View>
        <Text style={styles.trustTitle}>Perfect Fit</Text>
        <Text style={styles.trustDesc}>Professional measurements</Text>
      </View>
      <View style={styles.trustItem}>
        <View style={styles.trustIconCircle}>
          <Ionicons name="time-outline" size={24} color="#0d9488" />
        </View>
        <Text style={styles.trustTitle}>On-time Delivery</Text>
        <Text style={styles.trustDesc}>Punctual & reliable service</Text>
      </View>
      <View style={styles.trustItem}>
        <View style={styles.trustIconCircle}>
          <Ionicons name="headset-outline" size={24} color="#0d9488" />
        </View>
        <Text style={styles.trustTitle}>24/7 Support</Text>
        <Text style={styles.trustDesc}>We're here to help you</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {renderHeader()}
      {renderFilters()}
      
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#0d9488" size="large" />
        </View>
      ) : (
        <FlatList
          data={filteredTailors}
          keyExtractor={(item) => item._id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0d9488" />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              {renderBanner()}
              {renderSectionTitle()}
            </>
          }
          ListFooterComponent={renderTrustIcons()}
          renderItem={({ item, index }) => {
            const services = item.specialties || ["Blouse", "Saree", "Alteration", "Suit"];
            const displayServices = services.slice(0, 3);
            const extraServicesCount = services.length > 3 ? services.length - 3 : 0;

            return (
              <Pressable
                style={styles.card}
                onPress={() => navigation.navigate("TailorDetail", { tailorId: item._id, shopName: item.shopName })}
              >
                <Image source={{ uri: item.shopPosterUrl || (item.gallery && item.gallery.length > 0 && item.gallery[0]) || FALLBACK_IMAGE }} style={styles.cardImage} />
                
                <View style={styles.cardInfo}>
                  <View style={styles.cardHeader}>
                    <View style={styles.shopNameRow}>
                      <Text style={styles.shopName} numberOfLines={1}>{item.shopName}</Text>
                      <Ionicons name="checkmark-circle" size={16} color="#0d9488" style={{ marginLeft: 4 }} />
                    </View>
                    <Text style={[styles.openText, !item.isShopOpen && styles.closedText]}>
                      {item.isShopOpen ? "Open Now" : "Closed"}
                    </Text>
                  </View>
                  
                  <Text style={styles.specialtyText} numberOfLines={1}>
                    {item.businessCategory || "Women's Wear Specialist"}
                  </Text>
                  
                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={14} color="#f59e0b" />
                    <Text style={styles.ratingText}>
                      {item.rating || "4.8"} <Text style={styles.ratingCount}>({item.ratingCount || "124"})</Text>
                    </Text>
                    <Text style={styles.dot}>•</Text>
                    <Text style={styles.distanceText}>
                      {item.distance !== undefined && item.distance !== null && item.distance !== Infinity
                        ? `${item.distance.toFixed(1)} km`
                        : "Nearby"}
                    </Text>
                  </View>

                  <View style={styles.cardFooter}>
                    <View style={styles.serviceTags}>
                      {displayServices.map((srv, idx) => (
                        <View key={idx} style={styles.serviceTag}>
                          <Text style={styles.serviceTagText}>{srv}</Text>
                        </View>
                      ))}
                      {extraServicesCount > 0 && (
                        <View style={styles.serviceTagExtra}>
                          <Text style={styles.serviceTagTextExtra}>+{extraServicesCount}</Text>
                        </View>
                      )}
                    </View>

                    <Pressable 
                      style={styles.bookBtn}
                      onPress={() => navigation.navigate("TailorDetail", { tailorId: item._id, shopName: item.shopName })}
                    >
                      <Text style={styles.bookBtnText}>Book Now</Text>
                    </Pressable>
                  </View>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="shirt-outline" size={40} color="#cbd5e1" />
              </View>
              <Text style={styles.emptyTitle}>No tailors found</Text>
              <Text style={styles.emptyText}>There are no tailors available in your area matching your criteria.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff", paddingTop: 40 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  
  header: { paddingBottom: 10, backgroundColor: "#ffffff" },
  topRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, marginBottom: 16 },
  backBtn: { padding: 8, marginLeft: -8 },
  headerTitleContainer: { flex: 1, flexDirection: "row", alignItems: "center", marginLeft: 8 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#e6f7f2", justifyContent: "center", alignItems: "center", marginRight: 12 },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#0f172a" },
  headerSubtitle: { fontSize: 12, color: "#64748b", marginTop: 2 },
  notifBtn: { position: "relative", padding: 8 },
  notifBadge: { position: "absolute", top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: "#ef4444", borderWidth: 1, borderColor: "#fff" },
  
  filterContainer: { backgroundColor: "#ffffff", paddingBottom: 16 },
  searchRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, marginBottom: 16 },
  searchBox: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#f8fafc", paddingHorizontal: 16, height: 50, borderRadius: 12, borderWidth: 1, borderColor: "#f1f5f9" },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 14, color: "#0f172a" },
  nearMeBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#ffffff", height: 50, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0", marginLeft: 12 },
  nearMeBtnActive: { backgroundColor: "#6d28d9", borderColor: "#6d28d9" },
  nearMeText: { fontSize: 13, fontWeight: "600", color: "#475569", marginLeft: 6 },
  nearMeTextActive: { color: "#ffffff" },
  
  pillScroll: { paddingHorizontal: 20, gap: 10 },
  pill: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#e2e8f0" },
  pillActive: { backgroundColor: "#e6f7f2", borderColor: "#99f6e4" },
  pillText: { fontSize: 13, fontWeight: "600", color: "#64748b" },
  pillTextActive: { color: "#0d9488" },
  
  listContent: { paddingBottom: 100 },
  
  bannerContainer: { marginHorizontal: 20, marginBottom: 24, borderRadius: 16, overflow: "hidden", height: 160 },
  bannerImage: { width: "100%", height: "100%" },
  bannerOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(13, 148, 136, 0.85)", padding: 20, justifyContent: "center" },
  bannerTitle: { fontSize: 20, fontWeight: "800", color: "#ffffff", marginBottom: 4 },
  bannerSubtitle: { fontSize: 14, fontWeight: "700", color: "#ffffff", marginBottom: 8 },
  bannerDesc: { fontSize: 12, color: "rgba(255,255,255,0.9)", width: "70%", marginBottom: 12, lineHeight: 18 },
  bannerBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#0f766e", alignSelf: "flex-start", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  bannerBtnText: { color: "#ffffff", fontSize: 13, fontWeight: "700", marginRight: 6 },
  
  sectionTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  viewAll: { fontSize: 13, fontWeight: "600", color: "#0d9488" },

  card: { flexDirection: "row", marginHorizontal: 20, backgroundColor: "#ffffff", borderRadius: 16, marginBottom: 16, padding: 12, borderWidth: 1, borderColor: "#f1f5f9", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1 },
  cardImage: { width: 100, height: 120, borderRadius: 12, backgroundColor: "#f1f5f9" },
  cardInfo: { flex: 1, marginLeft: 16, justifyContent: "space-between" },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  shopNameRow: { flexDirection: "row", alignItems: "center", flex: 1, marginRight: 8 },
  shopName: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  openText: { fontSize: 11, fontWeight: "700", color: "#16a34a" },
  closedText: { color: "#ef4444" },
  specialtyText: { fontSize: 13, color: "#475569", marginTop: 4 },
  
  ratingRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  ratingText: { fontSize: 13, fontWeight: "700", color: "#0f172a", marginLeft: 4 },
  ratingCount: { color: "#64748b", fontWeight: "400" },
  dot: { color: "#cbd5e1", marginHorizontal: 8 },
  distanceText: { fontSize: 13, color: "#64748b" },

  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 12 },
  serviceTags: { flexDirection: "row", flex: 1, flexWrap: "wrap", gap: 6, paddingRight: 8 },
  serviceTag: { backgroundColor: "#f0fdf4", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: "#ccfbf1" },
  serviceTagText: { fontSize: 10, color: "#0d9488", fontWeight: "600" },
  serviceTagExtra: { backgroundColor: "#f1f5f9", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  serviceTagTextExtra: { fontSize: 10, color: "#64748b", fontWeight: "600" },
  
  bookBtn: { backgroundColor: "#0d9488", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  bookBtnText: { color: "#ffffff", fontSize: 12, fontWeight: "700" },

  trustContainer: { flexDirection: "row", flexWrap: "wrap", backgroundColor: "#f8fafc", padding: 20, marginTop: 10, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  trustItem: { width: "50%", alignItems: "center", padding: 12 },
  trustIconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#ffffff", justifyContent: "center", alignItems: "center", marginBottom: 12, shadowColor: "#0d9488", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 2 },
  trustTitle: { fontSize: 13, fontWeight: "800", color: "#0f172a", marginBottom: 4, textAlign: "center" },
  trustDesc: { fontSize: 11, color: "#64748b", textAlign: "center", lineHeight: 16, paddingHorizontal: 8 },

  emptyContainer: { alignItems: "center", justifyContent: "center", marginTop: 60, paddingHorizontal: 32 },
  emptyIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#f8fafc", justifyContent: "center", alignItems: "center", marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: "#0f172a", textAlign: "center" },
  emptyText: { fontSize: 14, color: "#64748b", marginTop: 8, textAlign: "center", lineHeight: 22 },
});
