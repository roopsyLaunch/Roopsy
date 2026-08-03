import React, { useCallback, useState, useEffect } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

const CATEGORIES = [
  { key: "all",      label: "All",             bg: "#111827", color: "#ffffff" },
  { key: "haircut",  label: "Men's Haircut",   bg: "#f8fafc", color: "#64748b" },
  { key: "beard",    label: "Beard",           bg: "#f8fafc", color: "#64748b" },
  { key: "shaving",  label: "Shaving",         bg: "#f8fafc", color: "#64748b" },
];

const FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=400&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1605497746444-ac9dedd777a8?w=400&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=400&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1562322140-8baeececf3df?w=400&auto=format&fit=crop&q=80",
];

export function ExploreScreen({ navigation, route }) {
  const { favorites, toggleFavorite } = useAuth();
  const insets = useSafeAreaInsets();
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(
    route?.params?.category || "all"
  );

  // Sync category from parent navigation params (when coming from middle tab modal)
  React.useEffect(() => {
    if (route?.params?.category) {
      setSelectedCategory(route.params.category);
    }
  }, [route?.params?.category, route?.params?.timestamp]);

  const load = useCallback(async () => {
    try {
      // Using a dummy location (e.g. Mumbai) for demonstration of proximity features
      const dummyLocation = { lat: 19.076, lng: 72.8777 };
      const res = await api.get("/barbers", {
        params: { lat: dummyLocation.lat, lng: dummyLocation.lng }
      });
      setShops(res.data.barbers || []);
    } catch (err) {
      console.error("ExploreScreen load error:", err);
    }
  }, []);

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      try { await load(); } finally { setLoading(false); }
    })();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }

  const filtered = React.useMemo(() => {
    return shops.filter((shop) => {
      const name = shop.shopName?.toLowerCase() || "";
      const city = shop.address?.city?.toLowerCase() || "";
      const bio  = shop.bio?.toLowerCase() || "";
      const q    = searchQuery.toLowerCase();

      const matchesSearch = !q || name.includes(q) || city.includes(q) || bio.includes(q);

      if (selectedCategory === "all") return matchesSearch;
      if (selectedCategory === "barber") return matchesSearch;
      if (selectedCategory === "beauty")
        return matchesSearch && (name.includes("beauty") || name.includes("parlor") || name.includes("salon") || bio.includes("beauty") || bio.includes("beauty parlor"));
      if (selectedCategory === "stitching")
        return matchesSearch && (name.includes("stitch") || name.includes("tailor") || name.includes("design") || bio.includes("stitching"));
      if (selectedCategory === "other")
        return matchesSearch && (name.includes("spa") || name.includes("nail") || name.includes("massage") || bio.includes("other services") || bio.includes("spa"));
      return matchesSearch;
    });
  }, [shops, searchQuery, selectedCategory]);

  const getFallback = (i) => FALLBACK_IMAGES[i % FALLBACK_IMAGES.length];

  const activeCat = CATEGORIES.find((c) => c.key === selectedCategory) || CATEGORIES[0];

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 12) }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </Pressable>
        <Text style={styles.headerTitle}>Barber</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* ── Search bar ── */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color="#94a3b8" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, city…"
          placeholderTextColor="#94a3b8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery("")}>
            <Ionicons name="close-circle" size={18} color="#94a3b8" />
          </Pressable>
        )}
      </View>

      {/* ── Category chips (horizontal scroll) ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryRow}
      >
        {CATEGORIES.map((cat) => {
          const active = selectedCategory === cat.key;
          return (
            <Pressable
              key={cat.key}
              style={[
                styles.categoryChip,
                active
                  ? { backgroundColor: "#111827", borderColor: "#111827" }
                  : { backgroundColor: "#ffffff", borderColor: "#e2e8f0" },
              ]}
              onPress={() => setSelectedCategory(cat.key)}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  { color: active ? "#ffffff" : "#64748b" },
                ]}
              >
                {cat.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* ── Results count ── */}
      <Text style={styles.resultsLabel}>
        {loading ? "Loading…" : `${filtered.length} shop${filtered.length !== 1 ? "s" : ""} found`}
      </Text>

      {/* ── Shop list ── */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#6d28d9" size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6d28d9" />
          }
          renderItem={({ item, index }) => (
            <Pressable
              style={styles.card}
              onPress={() => navigation.navigate("BarberDetail", { barberId: item.id, shopName: item.shopName })}
            >
              <Image source={{ uri: item.shopPosterUrl || getFallback(index) }} style={styles.cardImage} />
              
              <View style={styles.cardBody}>
                <View style={styles.cardTopRow}>
                  <Text style={styles.shopName} numberOfLines={1}>{item.shopName || "Premium Salon"}</Text>
                  <Pressable 
                    onPress={(e) => { e.stopPropagation(); toggleFavorite(item.id); }} 
                    style={{ padding: 4, marginRight: -4 }}
                  >
                    <Ionicons 
                      name={favorites.includes(item.id) ? "heart" : "heart-outline"} 
                      size={20} 
                      color={favorites.includes(item.id) ? "#ef4444" : "#cbd5e1"} 
                    />
                  </Pressable>
                </View>

                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={12} color="#f59e0b" />
                  <Text style={styles.ratingText}>
                    {item.averageRating || "0.0"} <Text style={styles.ratingCount}>({item.ratingCount || 0})</Text>
                  </Text>
                </View>

                {item.address?.city ? (
                  <Text style={styles.locationText} numberOfLines={1}>
                    {item.address.line1 ? `${item.address.line1}, ` : ""}{item.address.city}
                    {item.distance && item.distance !== Infinity && (
                      <Text style={{color: "#6d28d9", fontWeight: "600"}}>  •  {item.distance.toFixed(1)} km away</Text>
                    )}
                  </Text>
                ) : null}

                <View style={styles.metaRow}>
                  <Text style={styles.metaText}>
                    {item.minPrice > 0 ? `₹${item.minPrice} onwards` : "Prices not set"}
                  </Text>
                  {item.availableSeats !== undefined && (
                    <Text style={[
                      styles.metaText, 
                      { marginLeft: 12, fontWeight: "700", color: item.availableSeats > 0 ? "#16a34a" : "#ef4444" }
                    ]}>
                      • {item.availableSeats > 0 ? `${item.availableSeats} chair(s) available` : "Fully booked"}
                    </Text>
                  )}
                </View>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="search-outline" size={56} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No Shops Found</Text>
              <Text style={styles.emptySub}>
                Try a different category or search term.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
  },
  headerSub: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  headerIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    marginHorizontal: 20,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0f172a",
    paddingVertical: 0,
  },
  categoryRow: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    gap: 8,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    marginRight: 8,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  resultsLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 14,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    overflow: "hidden",
    flexDirection: "row",
    padding: 12,
    marginBottom: 16,
  },
  cardImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginRight: 14,
  },
  cardBody: {
    flex: 1,
    justifyContent: "center",
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  shopName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    flex: 1,
    marginRight: 8,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f172a",
    marginLeft: 4,
  },
  ratingCount: {
    color: "#94a3b8",
    fontWeight: "400",
  },
  locationText: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  metaText: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "500",
  },
  emptyWrap: {
    alignItems: "center",
    paddingVertical: 70,
    paddingHorizontal: 30,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#334155",
    marginTop: 14,
  },
  emptySub: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
    marginTop: 6,
  },
});
