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
      await loadFavorites();
    } catch (e) {
      console.error(e);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#0f172a" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0f172a" />}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => {
              const cat = (item.businessCategory || "").toLowerCase();
              if (cat.includes("tailor") || cat.includes("stitching") || cat.includes("center")) {
                navigation.navigate("TailorDetail", { tailorId: item.id, shopName: item.shopName });
              } else if (cat.includes("beauty") || cat.includes("parlor") || cat.includes("parlour")) {
                navigation.navigate("BeautyParlorDetail", { barberId: item.id, shopName: item.shopName });
              } else {
                navigation.navigate("BarberDetail", { barberId: item.id, shopName: item.shopName });
              }
            }}
          >
            {item.shopPosterUrl ? (
              <Image source={{ uri: item.shopPosterUrl }} style={styles.poster} />
            ) : (
              <View style={styles.posterFallback}>
                <Ionicons name="image-outline" size={40} color="#94a3b8" />
              </View>
            )}
            
            <View style={styles.infoContainer}>
              <View style={styles.rowTop}>
                <Text style={styles.shopName} numberOfLines={1}>{item.shopName || "Salon"}</Text>
                <Pressable onPress={() => removeFavorite(item.id)} style={styles.favBtn}>
                  <Ionicons name="heart" size={22} color="#ef4444" />
                </Pressable>
              </View>
              
              {item.user ? (
                <Text style={styles.ownerName} numberOfLines={1}>By {item.user.name}</Text>
              ) : null}
              
              {item.address?.city ? (
                <View style={styles.locRow}>
                  <Ionicons name="location-outline" size={14} color="#64748b" />
                  <Text style={styles.locText} numberOfLines={1}>
                    {item.address.line1 ? `${item.address.line1}, ` : ""}{item.address.city}
                  </Text>
                </View>
              ) : null}

              <View style={styles.footerRow}>
                <View style={[styles.badge, item.isShopOpen ? styles.badgeOpen : styles.badgeClosed]}>
                  <Text style={[styles.badgeText, item.isShopOpen ? styles.badgeTextOpen : styles.badgeTextClosed]}>
                    {item.isShopOpen ? "Open" : "Closed"}
                  </Text>
                </View>
                {item.bio ? (
                  <Text style={styles.bioText} numberOfLines={1}>{item.bio}</Text>
                ) : null}
              </View>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="heart-dislike-outline" size={60} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>No Favorites Yet</Text>
            <Text style={styles.emptySub}>Tap the heart icon on any salon details page to add it to your favorites list.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  poster: {
    width: "100%",
    height: 150,
    backgroundColor: "#f1f5f9",
  },
  posterFallback: {
    width: "100%",
    height: 150,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
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
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    flex: 1,
  },
  favBtn: {
    padding: 4,
  },
  ownerName: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
  },
  locRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  locText: {
    fontSize: 13,
    color: "#64748b",
    marginLeft: 4,
    flex: 1,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 10,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeOpen: {
    backgroundColor: "#dcfce7",
  },
  badgeClosed: {
    backgroundColor: "#fee2e2",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  badgeTextOpen: {
    color: "#15803d",
  },
  badgeTextClosed: {
    color: "#b91c1c",
  },
  bioText: {
    fontSize: 12,
    color: "#94a3b8",
    marginLeft: 10,
    flex: 1,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#334155",
    marginTop: 16,
  },
  emptySub: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
});
