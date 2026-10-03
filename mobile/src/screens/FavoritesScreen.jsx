import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api/client";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";

export function FavoritesScreen({ navigation }) {
  const { toggleFavorite } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadFavorites = useCallback(async () => {
    try {
      const res = await api.get("/auth/favorites");
      setItems(res.data.favorites || []);
    } catch (e) {
      console.error("Failed to load favorites", e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        setLoading(true);
        try {
          await loadFavorites();
        } finally {
          setLoading(false);
        }
      })();
    }, [loadFavorites])
  );

  async function onRefresh() {
    setRefreshing(true);
    try {
      await loadFavorites();
    } finally {
      setRefreshing(false);
    }
  }

  async function removeFavorite(id) {
    try {
      await toggleFavorite(id);
      // Remove locally immediately for instant feedback
      setItems((prev) => prev.filter((item) => (item.id || item._id) !== id));
      await loadFavorites();
    } catch (e) {
      console.error(e);
    }
  }

  const navigateToShop = (item) => {
    const cat = (item.businessCategory || "").toLowerCase();
    const sName = (item.shopName || "").toLowerCase();
    const shopId = item.id || item._id;

    if (cat.includes("tailor") || cat.includes("stitching") || cat.includes("center")) {
      navigation.navigate("TailorDetail", { tailorId: shopId, shopName: item.shopName });
    } else if (
      cat.includes("beauty") ||
      cat.includes("parlor") ||
      cat.includes("parlour") ||
      cat.includes("salon") ||
      sName.includes("beauty") ||
      sName.includes("salon") ||
      sName.includes("parlor")
    ) {
      navigation.navigate("BeautyParlorDetail", { barberId: shopId, shopName: item.shopName });
    } else {
      navigation.navigate("BarberDetail", { barberId: shopId, shopName: item.shopName });
    }
  };

  const getCategoryLabel = (item) => {
    const cat = (item.businessCategory || "").toLowerCase();
    const sName = (item.shopName || "").toLowerCase();
    if (cat.includes("tailor") || cat.includes("stitching")) return "Tailor & Stitching";
    if (cat.includes("beauty") || cat.includes("parlor") || sName.includes("beauty") || sName.includes("parlor")) return "Beauty Parlour";
    return "Barber & Salon";
  };

  const canGoBack = navigation.canGoBack();

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {canGoBack && (
            <Pressable
              style={styles.backBtn}
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={22} color="#0f172a" />
            </Pressable>
          )}
          <View>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={styles.headerTitle}>Favourite Shops</Text>
              <Ionicons name="heart" size={20} color="#ef4444" style={{ marginLeft: 6 }} />
            </View>
            <Text style={styles.headerSubtitle}>
              {items.length > 0
                ? `${items.length} saved shop${items.length > 1 ? "s" : ""} • 1-click direct booking`
                : "Saved shops for instant booking"}
            </Text>
          </View>
        </View>

        {items.length > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{items.length}</Text>
          </View>
        )}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#6d28d9" />
          <Text style={{ marginTop: 12, color: "#64748b", fontSize: 13, fontWeight: "600" }}>Loading favourites...</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => (item.id || item._id).toString()}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6d28d9" />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const catLabel = getCategoryLabel(item);
            const rating = item.averageRating || item.rating || "4.8";

            return (
              <Pressable
                style={styles.card}
                onPress={() => navigateToShop(item)}
              >
                {/* Poster / Shop Image */}
                <View style={styles.posterContainer}>
                  {item.shopPosterUrl ? (
                    <Image source={{ uri: item.shopPosterUrl }} style={styles.poster} />
                  ) : (
                    <View style={styles.posterFallback}>
                      <Ionicons name="storefront-outline" size={44} color="#94a3b8" />
                      <Text style={{ fontSize: 12, color: "#94a3b8", marginTop: 4, fontWeight: "600" }}>{catLabel}</Text>
                    </View>
                  )}

                  {/* Category Chip */}
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>{catLabel}</Text>
                  </View>

                  {/* Rating Badge */}
                  <View style={styles.ratingBadge}>
                    <Ionicons name="star" size={12} color="#eab308" style={{ marginRight: 3 }} />
                    <Text style={styles.ratingText}>{rating}</Text>
                  </View>
                </View>

                {/* Info Container */}
                <View style={styles.infoContainer}>
                  <View style={styles.rowTop}>
                    <Text style={styles.shopName} numberOfLines={1}>
                      {item.shopName || "Premium Salon"}
                    </Text>

                    {/* Unfavourite Heart Button */}
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        removeFavorite(item.id || item._id);
                      }}
                      style={styles.favBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="heart" size={24} color="#ef4444" />
                    </Pressable>
                  </View>

                  {item.ownerName || (item.user && item.user.name) ? (
                    <Text style={styles.ownerName} numberOfLines={1}>
                      By {item.ownerName || item.user.name}
                    </Text>
                  ) : null}

                  {item.address?.line1 || item.address?.city ? (
                    <View style={styles.locRow}>
                      <Ionicons name="location-sharp" size={14} color="#6d28d9" />
                      <Text style={styles.locText} numberOfLines={1}>
                        {item.address.line1 ? `${item.address.line1}, ` : ""}
                        {item.address.city || "Lucknow"}
                      </Text>
                    </View>
                  ) : null}

                  {/* Status & Action Row */}
                  <View style={styles.actionRow}>
                    <View style={[styles.statusBadge, item.isShopOpen ? styles.statusOpen : styles.statusClosed]}>
                      <View style={[styles.statusDot, item.isShopOpen ? styles.statusDotOpen : styles.statusDotClosed]} />
                      <Text style={[styles.statusText, item.isShopOpen ? styles.statusTextOpen : styles.statusTextClosed]}>
                        {item.isShopOpen ? "Open Now" : "Closed"}
                      </Text>
                    </View>

                    {/* Direct Booking Button */}
                    <Pressable
                      style={styles.bookBtn}
                      onPress={(e) => {
                        e.stopPropagation();
                        navigateToShop(item);
                      }}
                    >
                      <Ionicons name="calendar" size={14} color="#ffffff" style={{ marginRight: 6 }} />
                      <Text style={styles.bookBtnText}>Book Appointment</Text>
                      <Ionicons name="chevron-forward" size={14} color="#ffffff" style={{ marginLeft: 2 }} />
                    </Pressable>
                  </View>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="heart-outline" size={54} color="#ef4444" />
              </View>
              <Text style={styles.emptyTitle}>No Favourite Shops Yet</Text>
              <Text style={styles.emptySub}>
                Kisi bhi salon ya tailor shop ke page par jaakar top right me "Favourite" (❤️) par click karein.
                Wah yahan save ho jayegi aur aap bina dhundhe 1-click me booking kar sakenge!
              </Text>

              <Pressable
                style={styles.exploreBtn}
                onPress={() => {
                  try {
                    navigation.navigate("Home");
                  } catch (e) {
                    console.log(e);
                  }
                }}
              >
                <Ionicons name="compass-outline" size={18} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.exploreBtnText}>Explore Shops Now</Text>
              </Pressable>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    backgroundColor: "#ffffff",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  countBadge: {
    backgroundColor: "#fee2e2",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#ef4444",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
    backgroundColor: "#f8fafc",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    marginBottom: 16,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  posterContainer: {
    position: "relative",
    width: "100%",
    height: 160,
    backgroundColor: "#f1f5f9",
  },
  poster: {
    width: "100%",
    height: "100%",
  },
  posterFallback: {
    width: "100%",
    height: "100%",
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  categoryBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  categoryBadgeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
  },
  ratingBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "#ffffff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0f172a",
  },
  infoContainer: {
    padding: 16,
  },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  shopName: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
    flex: 1,
    marginRight: 8,
  },
  favBtn: {
    padding: 4,
    backgroundColor: "#fff1f2",
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  ownerName: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
    fontWeight: "500",
  },
  locRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  locText: {
    fontSize: 12.5,
    color: "#475569",
    marginLeft: 4,
    flex: 1,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  statusOpen: {
    backgroundColor: "#dcfce7",
  },
  statusClosed: {
    backgroundColor: "#fee2e2",
  },
  statusDotOpen: {
    backgroundColor: "#16a34a",
  },
  statusDotClosed: {
    backgroundColor: "#dc2626",
  },
  statusText: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  statusTextOpen: {
    color: "#15803d",
  },
  statusTextClosed: {
    color: "#b91c1c",
  },
  bookBtn: {
    backgroundColor: "#6d28d9",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: "#6d28d9",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  bookBtnText: {
    color: "#ffffff",
    fontSize: 12.5,
    fontWeight: "800",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 28,
  },
  emptyIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#fee2e2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: "900",
    color: "#0f172a",
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 13.5,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  exploreBtn: {
    backgroundColor: "#6d28d9",
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#6d28d9",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  exploreBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
});
