import React, { useCallback, useEffect, useState, useMemo } from "react";
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
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../api/client";
import { getSocket } from "../api/socket";
import { useAuth } from "../context/AuthContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Premium Fallback Images by Category
const BARBER_FALLBACKS = [
  "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=800&auto=format&fit=crop&q=80",
];

const BEAUTY_FALLBACKS = [
  "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=800&auto=format&fit=crop&q=80",
];

const TAILOR_FALLBACKS = [
  "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?w=800&auto=format&fit=crop&q=80",
];

function getShopThumbnail(item, idx) {
  if (item.shopPosterUrl && typeof item.shopPosterUrl === "string" && item.shopPosterUrl.startsWith("http")) {
    return item.shopPosterUrl;
  }
  if (item.gallery && item.gallery.length > 0 && typeof item.gallery[0] === "string" && item.gallery[0].startsWith("http")) {
    return item.gallery[0];
  }
  const cat = (item.businessCategory || "").toLowerCase();
  const sName = (item.shopName || "").toLowerCase();
  if (item.isTailor || cat.includes("tailor") || cat.includes("stitching") || sName.includes("tailor") || sName.includes("silai")) {
    return TAILOR_FALLBACKS[idx % TAILOR_FALLBACKS.length];
  }
  if (cat.includes("beauty") || cat.includes("parlor") || cat.includes("parlour") || cat.includes("salon") || sName.includes("beauty")) {
    return BEAUTY_FALLBACKS[idx % BEAUTY_FALLBACKS.length];
  }
  return BARBER_FALLBACKS[idx % BARBER_FALLBACKS.length];
}

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

const CATEGORY_TABS = [
  { id: "all", label: "All Shops", icon: "sparkles" },
  { id: "barber", label: "Barbers", icon: "cut" },
  { id: "beauty_parlor", label: "Beauty Parlors", icon: "color-wand" },
  { id: "tailor", label: "Tailors & Stitching", icon: "shirt" },
  { id: "home_service", label: "Home Service", icon: "home" },
];

export function SearchScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { user, favorites, toggleFavorite } = useAuth();
  const userLat = user?.address?.lat;
  const userLng = user?.address?.lng;

  const initialCategory = route.params?.category || "all";
  const [category, setCategory] = useState(initialCategory);
  const [searchQuery, setSearchQuery] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter Modal
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [city, setCity] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [tempCity, setTempCity] = useState("");
  const [tempMaxPrice, setTempMaxPrice] = useState("");

  const load = useCallback(async () => {
    try {
      const barberParams = {};
      if (category === "barber") {
        barberParams.businessContext = "barber";
      } else if (category === "beauty_parlor") {
        barberParams.businessContext = "beauty_parlor";
      } else if (category === "home_service") {
        barberParams.category = "home_service";
      }

      if (city) barberParams.city = city;
      if (maxPrice) barberParams.maxPrice = maxPrice;
      if (userLat && userLng) {
        barberParams.lat = userLat;
        barberParams.lng = userLng;
      }

      // Fetch Barbers/Salons and Tailors in parallel so all registered shops appear
      const shouldFetchBarbers = category !== "tailor";
      const shouldFetchTailors = category === "all" || category === "tailor";

      const barberPromise = shouldFetchBarbers
        ? api.get("/barbers", { params: barberParams })
        : Promise.resolve({ data: { barbers: [] } });

      const tailorPromise = shouldFetchTailors
        ? api.get("/tailors", { params: { lat: userLat, lng: userLng } })
        : Promise.resolve({ data: { tailors: [] } });

      const [barberRes, tailorRes] = await Promise.allSettled([barberPromise, tailorPromise]);

      let loadedBarbers = barberRes.status === "fulfilled" ? (barberRes.value.data.barbers || []) : [];
      let loadedTailors = tailorRes.status === "fulfilled" ? (tailorRes.value.data.tailors || []) : [];

      // If user filtered by city on tailors
      if (city) {
        const cLower = city.toLowerCase();
        loadedTailors = loadedTailors.filter(
          (t) => (t.address?.city || "").toLowerCase().includes(cLower)
        );
      }

      // Normalize tailors
      const normalizedTailors = loadedTailors.map((t) => ({
        id: t._id || t.id,
        shopName: t.shopName || "Tailor Studio",
        businessCategory: "Tailor",
        ownerName: t.ownerName,
        mobileNumber: t.mobileNumber,
        shopPosterUrl: t.gallery && t.gallery.length > 0 ? t.gallery[0] : null,
        gallery: t.gallery || [],
        address: t.address || {},
        location: t.location,
        isShopOpen: t.isShopOpen !== undefined ? t.isShopOpen : true,
        averageRating: t.averageRating && parseFloat(t.averageRating) > 0 ? t.averageRating : "4.8",
        ratingCount: t.ratingCount || 8,
        minPrice: t.minPrice || 199,
        offersHomeService: t.offersHomeService || false,
        distance: t.distance !== undefined && t.distance !== Infinity ? t.distance : null,
        isTailor: true,
      }));

      // Combine both
      let combined = [...loadedBarbers, ...normalizedTailors];

      // Calculate distance if user location is available
      if (userLat && userLng) {
        combined = combined.map((item) => {
          let dist = item.distance;
          if (
            (dist === undefined || dist === Infinity || dist === null) &&
            item.address?.lat &&
            item.address?.lng
          ) {
            dist = getDistanceInKm(userLat, userLng, item.address.lat, item.address.lng);
          }
          return { ...item, distance: dist };
        });

        // Sort closest first
        combined.sort((a, b) => {
          const distA = a.distance !== undefined && a.distance !== null && a.distance !== Infinity ? a.distance : 9999;
          const distB = b.distance !== undefined && b.distance !== null && b.distance !== Infinity ? b.distance : 9999;
          return distA - distB;
        });
      }

      setItems(combined);
    } catch (err) {
      console.error("Failed to load explore shops:", err);
    }
  }, [category, city, maxPrice, userLat, userLng]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  // Real-time shop status updates (live open/closed sync)
  useEffect(() => {
    const socket = getSocket();
    const handleStatusUpdate = (data) => {
      if (data && (data.shopId || data.tailorId || data.barberId)) {
        const targetId = data.shopId || data.tailorId || data.barberId;
        setItems((prev) =>
          prev.map((item) =>
            (item.id === targetId || item._id === targetId)
              ? { ...item, isShopOpen: Boolean(data.isShopOpen) }
              : item
          )
        );
      }
    };
    socket.on("shopStatusUpdated", handleStatusUpdate);
    return () => {
      socket.off("shopStatusUpdated", handleStatusUpdate);
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Instant client-side search filtering
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase().trim();
    return items.filter((item) => {
      const name = (item.shopName || "").toLowerCase();
      const cat = (item.businessCategory || "").toLowerCase();
      const cCity = (item.address?.city || "").toLowerCase();
      const line = (item.address?.line1 || "").toLowerCase();
      const owner = (item.ownerName || "").toLowerCase();
      return (
        name.includes(q) ||
        cat.includes(q) ||
        cCity.includes(q) ||
        line.includes(q) ||
        owner.includes(q)
      );
    });
  }, [items, searchQuery]);

  const handleOpenShop = (item) => {
    const cat = (item.businessCategory || "").toLowerCase();
    const sName = (item.shopName || "").toLowerCase();
    if (
      item.isTailor ||
      cat.includes("tailor") ||
      cat.includes("stitching") ||
      cat.includes("center") ||
      sName.includes("tailor") ||
      sName.includes("silai")
    ) {
      navigation.navigate("TailorDetail", { tailorId: item.id, shopName: item.shopName });
    } else if (
      cat.includes("beauty") ||
      cat.includes("parlor") ||
      cat.includes("parlour") ||
      cat.includes("salon") ||
      sName.includes("beauty") ||
      sName.includes("salon") ||
      sName.includes("parlor")
    ) {
      navigation.navigate("BeautyParlorDetail", { barberId: item.id, shopName: item.shopName });
    } else {
      navigation.navigate("BarberDetail", { barberId: item.id, shopName: item.shopName });
    }
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

  const getCategoryBadgeStyle = (item) => {
    const cat = (item.businessCategory || "").toLowerCase();
    if (item.isTailor || cat.includes("tailor") || cat.includes("stitching")) {
      return { bg: "#ecfdf5", text: "#059669", label: "Tailor", icon: "shirt" };
    }
    if (cat.includes("beauty") || cat.includes("parlor") || cat.includes("salon")) {
      return { bg: "#fdf2f8", text: "#db2777", label: "Beauty Parlor", icon: "color-wand" };
    }
    return { bg: "#f5f3ff", text: "#7c3aed", label: "Barber Shop", icon: "cut" };
  };

  const hasActiveFilters = Boolean(city || maxPrice);

  const renderHeader = () => (
    <View style={styles.header}>
      {/* Top Bar with Back Button, Title, Shop Count & Filter Button */}
      <View style={styles.topRow}>
        <Pressable
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={10}
        >
          <Ionicons name="arrow-back" size={22} color="#0f172a" />
        </Pressable>

        <View style={styles.titleWrapper}>
          <Text style={styles.headerTitle}>Explore Shops</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>
              {loading ? "..." : `${filteredItems.length} Registered`}
            </Text>
          </View>
        </View>

        <Pressable
          style={[styles.filterIconBtn, hasActiveFilters && styles.filterIconBtnActive]}
          onPress={() => {
            setTempCity(city);
            setTempMaxPrice(maxPrice);
            setFilterModalVisible(true);
          }}
          hitSlop={10}
        >
          <Ionicons
            name="options-outline"
            size={20}
            color={hasActiveFilters ? "#ffffff" : "#0f172a"}
          />
          {hasActiveFilters && <View style={styles.filterDot} />}
        </Pressable>
      </View>

      {/* Interactive Search Bar */}
      <View style={styles.searchBarContainer}>
        <Ionicons name="search-outline" size={18} color="#7c3aed" style={styles.searchBarIcon} />
        <TextInput
          style={styles.searchBarInput}
          placeholder="Search by shop name, city, service..."
          placeholderTextColor="#94a3b8"
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery("")} hitSlop={10} style={styles.clearSearchBtn}>
            <Ionicons name="close-circle" size={18} color="#94a3b8" />
          </Pressable>
        )}
      </View>

      {/* Category Pills Slider */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryScroll}
      >
        {CATEGORY_TABS.map((tab) => {
          const isActive = category === tab.id;
          return (
            <Pressable
              key={tab.id}
              style={[styles.catPill, isActive && styles.catPillActive]}
              onPress={() => setCategory(tab.id)}
            >
              <Ionicons
                name={tab.icon}
                size={14}
                color={isActive ? "#ffffff" : "#64748b"}
                style={styles.catPillIcon}
              />
              <Text style={[styles.catPillText, isActive && styles.catPillTextActive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Active Filter Chips */}
      {hasActiveFilters && (
        <View style={styles.activeFilterRow}>
          {city ? (
            <View style={styles.activeChip}>
              <Ionicons name="location" size={12} color="#7c3aed" />
              <Text style={styles.activeChipText}>{city}</Text>
              <Pressable onPress={() => setCity("")} hitSlop={8}>
                <Ionicons name="close" size={14} color="#7c3aed" />
              </Pressable>
            </View>
          ) : null}
          {maxPrice ? (
            <View style={styles.activeChip}>
              <Ionicons name="pricetag" size={12} color="#7c3aed" />
              <Text style={styles.activeChipText}>Up to ₹{maxPrice}</Text>
              <Pressable onPress={() => setMaxPrice("")} hitSlop={8}>
                <Ionicons name="close" size={14} color="#7c3aed" />
              </Pressable>
            </View>
          ) : null}
          <Pressable onPress={clearFilters} style={styles.clearAllFiltersBtn}>
            <Text style={styles.clearAllFiltersText}>Reset</Text>
          </Pressable>
        </View>
      )}
    </View>
  );

  const renderShopCard = ({ item, index }) => {
    const catBadge = getCategoryBadgeStyle(item);
    const isFav = favorites.includes(item.id);
    const thumbnailUri = getShopThumbnail(item, index);
    const isOpen = Boolean(item.isShopOpen);

    return (
      <Pressable
        style={styles.card}
        onPress={() => handleOpenShop(item)}
        android_ripple={{ color: "#ede9fe" }}
      >
        {/* Cover Poster Image with Floating Badges */}
        <View style={styles.posterContainer}>
          <Image source={{ uri: thumbnailUri }} style={styles.posterImage} />
          
          <LinearGradient
            colors={["rgba(15, 23, 42, 0.45)", "transparent", "rgba(15, 23, 42, 0.65)"]}
            style={StyleSheet.absoluteFillObject}
          />

          {/* Top Left: Star Rating */}
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={12} color="#f59e0b" />
            <Text style={styles.ratingText}>
              {item.averageRating && parseFloat(item.averageRating) > 0
                ? item.averageRating
                : "4.8"}
            </Text>
          </View>

          {/* Top Right: Favorite Heart Button */}
          <Pressable
            style={styles.favoriteBtn}
            onPress={(e) => {
              e.stopPropagation();
              toggleFavorite(item.id);
            }}
            hitSlop={8}
          >
            <Ionicons
              name={isFav ? "heart" : "heart-outline"}
              size={18}
              color={isFav ? "#ef4444" : "#ffffff"}
            />
          </Pressable>

          {/* Bottom Left: Open/Closed Status */}
          <View style={[styles.statusPill, isOpen ? styles.statusOpen : styles.statusClosed]}>
            <View style={[styles.statusDot, { backgroundColor: isOpen ? "#16a34a" : "#94a3b8" }]} />
            <Text style={[styles.statusText, isOpen ? styles.statusTextOpen : styles.statusTextClosed]}>
              {isOpen ? "OPEN NOW" : "CLOSED"}
            </Text>
          </View>

          {/* Bottom Right: Category Badge */}
          <View style={[styles.categoryTag, { backgroundColor: catBadge.bg }]}>
            <Ionicons name={catBadge.icon} size={11} color={catBadge.text} style={{ marginRight: 4 }} />
            <Text style={[styles.categoryTagText, { color: catBadge.text }]}>
              {catBadge.label}
            </Text>
          </View>
        </View>

        {/* Card Body */}
        <View style={styles.cardBody}>
          {/* Shop Name & Verified Badge */}
          <View style={styles.shopNameRow}>
            <Text style={styles.shopName} numberOfLines={1}>
              {item.shopName || "Premium Salon"}
            </Text>
            <Ionicons name="checkmark-circle" size={18} color="#7c3aed" style={styles.verifiedIcon} />
          </View>

          {/* Location & Distance */}
          <View style={styles.locationRow}>
            <Ionicons name="location-sharp" size={13} color="#7c3aed" />
            <Text style={styles.locationText} numberOfLines={1}>
              {item.address?.city ? `${item.address.city}, India` : "Lucknow, India"}
            </Text>
            {item.distance !== undefined && item.distance !== null && item.distance !== Infinity && (
              <View style={styles.distanceBadge}>
                <Ionicons name="navigate" size={9} color="#7c3aed" style={{ marginRight: 2 }} />
                <Text style={styles.distanceText}>
                  {item.distance < 1
                    ? `${(item.distance * 1000).toFixed(0)} m`
                    : `${item.distance.toFixed(1)} km`}
                </Text>
              </View>
            )}
          </View>

          {/* Features / Highlights */}
          <View style={styles.featuresRow}>
            {item.offersHomeService && (
              <View style={styles.featurePill}>
                <Ionicons name="home" size={11} color="#059669" />
                <Text style={styles.featurePillText}>Home Service</Text>
              </View>
            )}
            <View style={styles.featurePill}>
              <Ionicons name="shield-checkmark-outline" size={11} color="#6366f1" />
              <Text style={styles.featurePillText}>Verified Partner</Text>
            </View>
            <View style={styles.featurePill}>
              <Ionicons name="time-outline" size={11} color="#d97706" />
              <Text style={styles.featurePillText}>Instant Booking</Text>
            </View>
          </View>

          {/* Divider */}
          <View style={styles.cardDivider} />

          {/* Footer: Price & Book Button */}
          <View style={styles.cardFooter}>
            <View style={styles.priceContainer}>
              <Text style={styles.priceSubtitle}>Starts from</Text>
              <Text style={styles.priceMain}>
                ₹{item.minPrice > 0 ? item.minPrice : 150}
              </Text>
            </View>

            <Pressable
              style={styles.bookButton}
              onPress={() => handleOpenShop(item)}
            >
              <Text style={styles.bookButtonText}>Book Now</Text>
              <Ionicons name="arrow-forward" size={13} color="#ffffff" style={{ marginLeft: 4 }} />
            </Pressable>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 12) }]}>
      {renderHeader()}

      {loading && items.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#7c3aed" size="large" />
          <Text style={styles.loadingText}>Finding registered shops near you...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item, index) => `${item.id || index}`}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#7c3aed"
              colors={["#7c3aed"]}
            />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={renderShopCard}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="storefront-outline" size={42} color="#7c3aed" />
              </View>
              <Text style={styles.emptyTitle}>No registered shops found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? `No shops match "${searchQuery}". Try changing your search query.`
                  : "Try clearing your filters or selecting another category."}
              </Text>
              {(searchQuery || hasActiveFilters) && (
                <Pressable
                  style={styles.resetSearchBtn}
                  onPress={() => {
                    setSearchQuery("");
                    clearFilters();
                    setCategory("all");
                  }}
                >
                  <Text style={styles.resetSearchBtnText}>View All Registered Shops</Text>
                </Pressable>
              )}
            </View>
          }
        />
      )}

      {/* FILTER BOTTOM SHEET MODAL */}
      <Modal
        visible={filterModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Filter Shops</Text>
                <Text style={styles.modalSubtitle}>Refine results by city and price</Text>
              </View>
              <Pressable
                onPress={() => setFilterModalVisible(false)}
                style={styles.modalCloseBtn}
                hitSlop={10}
              >
                <Ionicons name="close" size={22} color="#0f172a" />
              </Pressable>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>City or Location</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="location-outline" size={18} color="#7c3aed" style={styles.inputIcon} />
                <TextInput
                  style={styles.inputField}
                  placeholder="e.g. Lucknow, Kanpur, Mumbai"
                  placeholderTextColor="#94a3b8"
                  value={tempCity}
                  onChangeText={setTempCity}
                />
                {tempCity.length > 0 && (
                  <Pressable onPress={() => setTempCity("")} hitSlop={10}>
                    <Ionicons name="close-circle" size={16} color="#94a3b8" />
                  </Pressable>
                )}
              </View>

              <Text style={styles.inputLabel}>Max Budget (₹)</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="cash-outline" size={18} color="#7c3aed" style={styles.inputIcon} />
                <TextInput
                  style={styles.inputField}
                  placeholder="e.g. 500"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  value={tempMaxPrice}
                  onChangeText={setTempMaxPrice}
                />
                {tempMaxPrice.length > 0 && (
                  <Pressable onPress={() => setTempMaxPrice("")} hitSlop={10}>
                    <Ionicons name="close-circle" size={16} color="#94a3b8" />
                  </Pressable>
                )}
              </View>
            </View>

            <View style={styles.modalFooter}>
              <Pressable style={styles.modalClearBtn} onPress={clearFilters}>
                <Text style={styles.modalClearBtnText}>Reset All</Text>
              </Pressable>
              <Pressable style={styles.modalApplyBtn} onPress={applyFilters}>
                <Text style={styles.modalApplyBtnText}>Apply Filters</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#64748b",
    fontWeight: "500",
  },

  // HEADER
  header: {
    backgroundColor: "#ffffff",
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f8fafc",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  titleWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: "900",
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  countBadge: {
    backgroundColor: "#ede9fe",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  countBadgeText: {
    color: "#6d28d9",
    fontSize: 11,
    fontWeight: "800",
  },
  filterIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f8fafc",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    position: "relative",
  },
  filterIconBtnActive: {
    backgroundColor: "#7c3aed",
    borderColor: "#7c3aed",
  },
  filterDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#ec4899",
  },

  // SEARCH BAR
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    marginHorizontal: 16,
    paddingHorizontal: 14,
    height: 46,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 12,
  },
  searchBarIcon: {
    marginRight: 8,
  },
  searchBarInput: {
    flex: 1,
    fontSize: 13.5,
    color: "#0f172a",
    fontWeight: "500",
  },
  clearSearchBtn: {
    padding: 4,
  },

  // CATEGORY PILLS
  categoryScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  catPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  catPillActive: {
    backgroundColor: "#7c3aed",
    borderColor: "#7c3aed",
    shadowColor: "#7c3aed",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  catPillIcon: {
    marginRight: 6,
  },
  catPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
  },
  catPillTextActive: {
    color: "#ffffff",
  },

  // ACTIVE CHIPS
  activeFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    marginTop: 10,
    gap: 8,
  },
  activeChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f3ff",
    borderWidth: 1,
    borderColor: "#ddd6fe",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 6,
  },
  activeChipText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#6d28d9",
  },
  clearAllFiltersBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearAllFiltersText: {
    fontSize: 11.5,
    color: "#ef4444",
    fontWeight: "700",
  },

  // LIST CONTENT
  listContent: {
    paddingTop: 14,
    paddingBottom: 40,
  },

  // CARD DESIGN
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    overflow: "hidden",
  },
  posterContainer: {
    width: "100%",
    height: 170,
    position: "relative",
    backgroundColor: "#f1f5f9",
  },
  posterImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  ratingBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.82)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  ratingText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
  },
  favoriteBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "center",
    alignItems: "center",
  },
  statusPill: {
    position: "absolute",
    bottom: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 5,
  },
  statusOpen: {
    backgroundColor: "#ffffff",
  },
  statusClosed: {
    backgroundColor: "#ffffff",
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 9.5,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  statusTextOpen: {
    color: "#16a34a",
  },
  statusTextClosed: {
    color: "#64748b",
  },
  categoryTag: {
    position: "absolute",
    bottom: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryTagText: {
    fontSize: 10.5,
    fontWeight: "800",
  },

  // CARD BODY
  cardBody: {
    padding: 14,
  },
  shopNameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  shopName: {
    fontSize: 16.5,
    fontWeight: "900",
    color: "#0f172a",
    flex: 1,
    letterSpacing: -0.2,
  },
  verifiedIcon: {
    marginLeft: 6,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 4,
  },
  locationText: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
    flexShrink: 1,
  },
  distanceBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f3ff",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 4,
  },
  distanceText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#7c3aed",
  },
  featuresRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  featurePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  featurePillText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#475569",
  },
  cardDivider: {
    height: 1,
    backgroundColor: "#f1f5f9",
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  priceContainer: {
    justifyContent: "center",
  },
  priceSubtitle: {
    fontSize: 10,
    color: "#94a3b8",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  priceMain: {
    fontSize: 17,
    fontWeight: "900",
    color: "#0f172a",
  },
  bookButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#7c3aed",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
    shadowColor: "#7c3aed",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  bookButtonText: {
    color: "#ffffff",
    fontSize: 12.5,
    fontWeight: "800",
  },

  // EMPTY STATE
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#f5f3ff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0f172a",
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 6,
    textAlign: "center",
    lineHeight: 20,
  },
  resetSearchBtn: {
    marginTop: 18,
    backgroundColor: "#7c3aed",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 14,
  },
  resetSearchBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },

  // FILTER MODAL
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0f172a",
  },
  modalSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBody: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#334155",
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    marginBottom: 16,
  },
  inputIcon: {
    marginRight: 10,
  },
  inputField: {
    flex: 1,
    fontSize: 14,
    color: "#0f172a",
    fontWeight: "500",
  },
  modalFooter: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 12,
  },
  modalClearBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  modalClearBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#64748b",
  },
  modalApplyBtn: {
    flex: 2,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#7c3aed",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#7c3aed",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  modalApplyBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#ffffff",
  },
});
