import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  Modal,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=500&auto=format&fit=crop&q=80";

function getDistanceInKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function SearchScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  
  const initialCategory = route.params?.category || "all";
  
  const dynamicTabs = React.useMemo(() => {
    let middleTab = "barber";
    if (initialCategory && initialCategory !== "all" && initialCategory !== "home_service") {
      middleTab = initialCategory;
    }
    return ["all", middleTab, "home_service"];
  }, [initialCategory]);
  
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Filter states
  const [category, setCategory] = useState(initialCategory);
  const [city, setCity] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  
  // Filter Modal
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  // Temp states for modal before applying
  const [tempCity, setTempCity] = useState(city);
  const [tempMaxPrice, setTempMaxPrice] = useState(maxPrice);

  const { user } = useAuth();
  const userLat = user?.address?.lat;
  const userLng = user?.address?.lng;

  const load = useCallback(async () => {
    try {
      const params = {};
      if (initialCategory && initialCategory !== "all") {
        params.businessContext = initialCategory;
      }
      if (category && category !== "all") {
        if (category !== initialCategory) {
          params.category = category;
        }
      }
      if (city) params.city = city;
      if (maxPrice) params.maxPrice = maxPrice;
      
      if (userLat && userLng) {
        params.lat = userLat;
        params.lng = userLng;
      }

      const res = await api.get("/barbers", { params });
      let loadedBarbers = res.data.barbers || [];

      if (userLat && userLng) {
        // Calculate/fill distance and filter within 15 km
        loadedBarbers = loadedBarbers
          .map((item) => {
            let dist = item.distance;
            if (
              (dist === undefined || dist === Infinity || dist === null) &&
              item.address?.lat &&
              item.address?.lng
            ) {
              dist = getDistanceInKm(userLat, userLng, item.address.lat, item.address.lng);
            }
            return { ...item, distance: dist };
          })
          .filter((item) => {
            return item.distance !== undefined && item.distance !== null && item.distance !== Infinity
              ? item.distance <= 15
              : true;
          });

        // Sort by closest first
        loadedBarbers.sort((a, b) => {
          const distA = a.distance !== undefined && a.distance !== null ? a.distance : 9999;
          const distB = b.distance !== undefined && b.distance !== null ? b.distance : 9999;
          return distA - distB;
        });
      }

      setItems(loadedBarbers);
    } catch (err) {
      console.error(err);
    }
  }, [category, city, maxPrice, userLat, userLng]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const applyFilters = () => {
    setCity(tempCity);
    setMaxPrice(tempMaxPrice);
    setFilterModalVisible(false);
  };
  
  const clearFilters = () => {
    setTempCity("");
    setTempMaxPrice("");
    setCity("");
    setMaxPrice("");
    setFilterModalVisible(false);
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </Pressable>
        <Text style={styles.headerTitle}>Explore Shops</Text>
        <View style={{ width: 44 }} /> 
      </View>

      {/* Category Tabs */}
      <View style={styles.categoryScroll}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
          {dynamicTabs.map((c) => {
            let label = c.charAt(0).toUpperCase() + c.slice(1);
            if (c === "all") label = "All Services";
            else if (c === "home_service") label = "Home Services";
            else if (c === "barber") label = "Service";
            else if (c === "beauty_parlor") label = "Beauty Parlor";
            else if (c === "stitching") label = "Tailor";

            return (
              <Pressable
                key={c}
                style={[styles.catPill, category === c && styles.catPillActive]}
                onPress={() => setCategory(c)}
              >
                <Text style={[styles.catPillText, category === c && styles.catPillTextActive]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      
      <View style={styles.filterRow}>
        <View style={styles.activeFilters}>
          {city ? (
            <View style={styles.activeFilterChip}>
              <Ionicons name="location" size={12} color="#6d28d9" />
              <Text style={styles.activeFilterText}>{city}</Text>
              <Pressable onPress={() => { setCity(""); setTempCity(""); }}><Ionicons name="close" size={14} color="#6d28d9" /></Pressable>
            </View>
          ) : null}
          {maxPrice ? (
            <View style={styles.activeFilterChip}>
              <Ionicons name="pricetag" size={12} color="#6d28d9" />
              <Text style={styles.activeFilterText}>Up to ₹{maxPrice}</Text>
              <Pressable onPress={() => { setMaxPrice(""); setTempMaxPrice(""); }}><Ionicons name="close" size={14} color="#6d28d9" /></Pressable>
            </View>
          ) : null}
        </View>

        <Pressable style={styles.filterBtn} onPress={() => setFilterModalVisible(true)}>
          <Ionicons name="options" size={20} color="#0f172a" />
          <Text style={styles.filterBtnText}>Filters</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 10) }]}>
      {renderHeader()}
      
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#6d28d9" size="large" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6d28d9" />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <Pressable
              style={styles.card}
              onPress={() => navigation.navigate("BarberDetail", { barberId: item.id, shopName: item.shopName })}
            >
              <Image source={{ uri: item.shopPosterUrl || (item.gallery && item.gallery.length > 0 && item.gallery[0]) || FALLBACK_IMAGE }} style={styles.poster} />
              
              <View style={styles.cardInfo}>
                <View style={styles.cardTopRow}>
                  <Text style={styles.shopName} numberOfLines={1}>{item.shopName}</Text>
                  <View style={[styles.statusBadge, item.isShopOpen ? styles.statusOpen : styles.statusClosed]}>
                    <Text style={[styles.statusText, item.isShopOpen ? styles.statusTextOpen : styles.statusTextClosed]}>
                      {item.isShopOpen ? "OPEN" : "CLOSED"}
                    </Text>
                  </View>
                </View>
                
                <Text style={styles.categoryName} numberOfLines={1}>{item.businessCategory || "Premium Services"}</Text>

                <View style={styles.cardFooter}>
                  <View style={styles.locRow}>
                    <Ionicons name="location-sharp" size={14} color="#94a3b8" />
                    <Text style={styles.address} numberOfLines={1}>
                      {item.address?.city || "Nearby"}
                      {item.distance !== undefined && item.distance !== null && item.distance !== Infinity
                        ? ` • ${item.distance.toFixed(1)} km`
                        : ""}
                    </Text>
                  </View>
                  <View style={styles.priceRow}>
                    {item.minPrice > 0 && <Text style={styles.priceLabel}>From </Text>}
                    <Text style={styles.priceValue}>{item.minPrice > 0 ? `₹${item.minPrice}` : "Prices NA"}</Text>
                  </View>
                </View>
              </View>

              {/* Shop Gallery or Service Images */}
              {((item.gallery && item.gallery.length > 0) || (item.serviceImages && item.serviceImages.length > 0)) && (
                <View style={styles.rowMiniGallery}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {(item.gallery?.length > 0 ? item.gallery : item.serviceImages).map((imgUrl, i) => (
                      <Image key={i} source={{ uri: imgUrl }} style={styles.miniGalleryImg} />
                    ))}
                  </ScrollView>
                </View>
              )}
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="search" size={40} color="#cbd5e1" />
              </View>
              <Text style={styles.emptyTitle}>No shops found</Text>
              <Text style={styles.emptyText}>Try adjusting your filters or location.</Text>
            </View>
          }
        />
      )}

      {/* FILTER MODAL */}
      <Modal visible={filterModalVisible} transparent animationType="slide" onRequestClose={() => setFilterModalVisible(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Results</Text>
              <Pressable onPress={() => setFilterModalVisible(false)}>
                <Ionicons name="close-circle" size={26} color="#cbd5e1" />
              </Pressable>
            </View>
            
            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>City / Location</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="location" size={20} color="#94a3b8" style={styles.inputIcon} />
                <TextInput 
                  style={styles.inputField} 
                  placeholder="e.g. Mumbai" 
                  value={tempCity}
                  onChangeText={setTempCity}
                />
              </View>

              <Text style={styles.inputLabel}>Maximum Price (₹)</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="cash" size={20} color="#94a3b8" style={styles.inputIcon} />
                <TextInput 
                  style={styles.inputField} 
                  placeholder="e.g. 500" 
                  keyboardType="numeric"
                  value={tempMaxPrice}
                  onChangeText={setTempMaxPrice}
                />
              </View>
            </View>
            
            <View style={styles.modalFooter}>
              <Pressable style={styles.clearBtn} onPress={clearFilters}>
                <Text style={styles.clearBtnText}>Clear All</Text>
              </Pressable>
              <Pressable style={styles.applyBtn} onPress={applyFilters}>
                <Text style={styles.applyBtnText}>Apply Filters</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  
  header: { paddingBottom: 10, backgroundColor: "#f8fafc" },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 16 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#ffffff", justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  headerTitle: { fontSize: 20, fontWeight: "900", color: "#0f172a" },
  
  categoryScroll: { marginBottom: 16 },
  catPill: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 100, backgroundColor: "#ffffff", marginRight: 12, borderWidth: 1, borderColor: "#e2e8f0" },
  catPillActive: { backgroundColor: "#0f172a", borderColor: "#0f172a" },
  catPillText: { fontSize: 13, fontWeight: "600", color: "#64748b" },
  catPillTextActive: { color: "#ffffff" },

  filterRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20 },
  activeFilters: { flexDirection: "row", flex: 1, flexWrap: "wrap", gap: 8 },
  activeFilterChip: { flexDirection: "row", alignItems: "center", backgroundColor: "#f3e8ff", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, gap: 6 },
  activeFilterText: { fontSize: 12, fontWeight: "600", color: "#6d28d9" },
  filterBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#ffffff", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  filterBtnText: { fontSize: 13, fontWeight: "700", color: "#0f172a", marginLeft: 6 },
  
  listContent: { paddingHorizontal: 20, paddingBottom: 100, paddingTop: 10 },
  card: { backgroundColor: "#ffffff", borderRadius: 20, marginBottom: 16, padding: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 2, borderWidth: 1, borderColor: "#f1f5f9" },
  poster: { width: "100%", height: 160, borderRadius: 16, backgroundColor: "#f1f5f9", marginBottom: 12 },
  cardInfo: { paddingHorizontal: 4 },
  cardTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  shopName: { fontSize: 18, fontWeight: "800", color: "#0f172a", flex: 1, marginRight: 8, lineHeight: 24 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusOpen: { backgroundColor: "#dcfce7" },
  statusClosed: { backgroundColor: "#f1f5f9" },
  statusText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  statusTextOpen: { color: "#16a34a" },
  statusTextClosed: { color: "#94a3b8" },
  categoryName: { fontSize: 13, color: "#6d28d9", fontWeight: "600", marginTop: 2 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 12, borderTopWidth: 1, borderTopColor: "#f1f5f9", paddingTop: 12 },
  locRow: { flexDirection: "row", alignItems: "center", flex: 1 },
  address: { fontSize: 13, color: "#64748b", marginLeft: 4, fontWeight: "500", flexShrink: 1 },
  priceRow: { flexDirection: "row", alignItems: "baseline" },
  priceLabel: { fontSize: 11, color: "#94a3b8", fontWeight: "600" },
  priceValue: { fontSize: 15, fontWeight: "700", color: "#6d28d9" },
  rowMiniGallery: { marginTop: 12, borderTopWidth: 1, borderTopColor: "#f1f5f9", paddingTop: 12, paddingHorizontal: 12, paddingBottom: 12 },
  miniGalleryImg: { width: 60, height: 60, borderRadius: 10, marginRight: 8, backgroundColor: "#f1f5f9" },

  emptyContainer: { alignItems: "center", justifyContent: "center", marginTop: 60, paddingHorizontal: 32 },
  emptyIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#ffffff", justifyContent: "center", alignItems: "center", marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: "#334155", textAlign: "center" },
  emptyText: { fontSize: 14, color: "#64748b", marginTop: 8, textAlign: "center", lineHeight: 22 },

  // MODAL
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#ffffff", borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingBottom: 30 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 24, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  modalBody: { padding: 24 },
  inputLabel: { fontSize: 14, fontWeight: "700", color: "#475569", marginBottom: 8, marginLeft: 4 },
  inputWrapper: { flexDirection: "row", alignItems: "center", backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 16, paddingHorizontal: 16, height: 56, marginBottom: 20 },
  inputIcon: { marginRight: 12 },
  inputField: { flex: 1, fontSize: 16, color: "#0f172a", fontWeight: "500" },
  
  modalFooter: { flexDirection: "row", paddingHorizontal: 24, gap: 12 },
  clearBtn: { flex: 1, height: 56, borderRadius: 16, backgroundColor: "#f1f5f9", justifyContent: "center", alignItems: "center" },
  clearBtnText: { fontSize: 16, fontWeight: "700", color: "#475569" },
  applyBtn: { flex: 1, height: 56, borderRadius: 16, backgroundColor: "#6d28d9", justifyContent: "center", alignItems: "center" },
  applyBtnText: { fontSize: 16, fontWeight: "700", color: "#ffffff" },
});
