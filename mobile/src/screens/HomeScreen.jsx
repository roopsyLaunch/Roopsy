import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Keyboard,
  Modal,
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
import LocationPickerModal from "../components/LocationPickerModal";
import { getCurrentGPSLocation } from "../services/locationService";
import { LinearGradient } from "expo-linear-gradient";

// Fallback high-quality salon images to show if shopPosterUrl is empty
const SALON_FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=500&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1605497746444-ac9dedd777a8?w=500&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=500&auto=format&fit=crop&q=80"
];

// Banner model image fallback
const BANNER_MODEL_IMAGE = "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=500&auto=format&fit=crop&q=80";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CAROUSEL_CARD_WIDTH = (SCREEN_WIDTH - 40 - 12) / 2;

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

export function HomeScreen({ navigation, route }) {
  const { user, favorites, toggleFavorite, refreshMe } = useAuth();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("Nearby");
  const isSearching = searchQuery.trim().length > 0;

  const [locationModalVisible, setLocationModalVisible] = useState(false);

  const userLat = user?.address?.lat;
  const userLng = user?.address?.lng;

  const handleSelectLocation = async (loc) => {
    try {
      await api.patch("/auth/me", {
        address: {
          line1: loc.line1 || loc.shortName || "",
          city: loc.city || loc.shortName || "Lucknow",
          pincode: loc.pincode || "",
          lat: loc.lat,
          lng: loc.lng,
        },
      });
      if (refreshMe) await refreshMe();
    } catch (e) {
      console.error("Failed to update user location", e);
    }
  };

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifModalVisible, setNotifModalVisible] = useState(false);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [selectedNotifIds, setSelectedNotifIds] = useState([]);
  const [selectionMode, setSelectionMode] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get("/auth/notifications");
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unreadCount || 0);
    } catch (err) {
      console.error("fetchNotifications error", err);
    }
  }, []);

  const openNotifModal = async () => {
    setSelectionMode(false);
    setSelectedNotifIds([]);
    setNotifModalVisible(true);
    setLoadingNotifs(true);
    try {
      await fetchNotifications();
    } finally {
      setLoadingNotifs(false);
    }
  };

  const markAllRead = async () => {
    try {
      await api.patch("/auth/notifications/read-all");
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      console.error(err);
    }
  };

  const toggleSelectNotification = (notifId) => {
    setSelectedNotifIds((prev) => {
      if (prev.includes(notifId)) {
        const next = prev.filter((id) => id !== notifId);
        if (next.length === 0) setSelectionMode(false);
        return next;
      } else {
        return [...prev, notifId];
      }
    });
  };

  const startSelectionMode = (notifId) => {
    setSelectionMode(true);
    setSelectedNotifIds([notifId]);
  };

  const toggleSelectAll = () => {
    if (selectedNotifIds.length === notifications.length) {
      setSelectedNotifIds([]);
      setSelectionMode(false);
    } else {
      setSelectedNotifIds(notifications.map((n) => n._id));
      setSelectionMode(true);
    }
  };

  const confirmDeleteNotification = (notifId) => {
    Alert.alert(
      "Delete Notification",
      "Are you sure you want to remove this notification?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/auth/notifications/${notifId}`);
              setNotifications((prev) => prev.filter((n) => n._id !== notifId));
              setUnreadCount((prev) => {
                const isUnread = notifications.find((n) => n._id === notifId && !n.isRead);
                return isUnread ? Math.max(0, prev - 1) : prev;
              });
            } catch (err) {
              console.error(err);
            }
          }
        }
      ]
    );
  };

  const deleteSelectedNotifications = () => {
    if (selectedNotifIds.length === 0) return;
    Alert.alert(
      "Delete Selected",
      `Are you sure you want to delete ${selectedNotifIds.length} selected notifications?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await api.post("/auth/notifications/delete-bulk", { ids: selectedNotifIds });
              setNotifications((prev) => prev.filter((n) => !selectedNotifIds.includes(n._id)));
              setUnreadCount((prev) => {
                const unreadSelectedCount = notifications.filter(
                  (n) => selectedNotifIds.includes(n._id) && !n.isRead
                ).length;
                return Math.max(0, prev - unreadSelectedCount);
              });
              setSelectedNotifIds([]);
              setSelectionMode(false);
            } catch (err) {
              console.error("Bulk delete failed", err);
            }
          }
        }
      ]
    );
  };

  const load = useCallback(async () => {
    try {
      const params = { businessContext: "all" };
      if (userLat && userLng) {
        params.lat = userLat;
        params.lng = userLng;
      }
      const res = await api.get("/barbers", { params });
      let loadedBarbers = res.data.barbers || [];
      if (userLat && userLng) {
        loadedBarbers = loadedBarbers.map((item) => {
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
      }
      setItems(loadedBarbers);
    } catch (err) {
      console.error(err);
    }
  }, [userLat, userLng]);

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await Promise.all([load(), fetchNotifications()]);
      } finally {
        setLoading(false);
      }
    })();
  }, [load, fetchNotifications]);

  React.useEffect(() => {
    (async () => {
      if (!userLat || !userLng) {
        try {
          const loc = await getCurrentGPSLocation();
          if (loc && loc.lat && loc.lng) {
            await handleSelectLocation(loc);
          }
        } catch (err) {
          console.log("Auto GPS location detection skipped/failed: ", err.message);
        }
      }
    })();
  }, [userLat, userLng]);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([load(), fetchNotifications()]);
    } finally {
      setRefreshing(false);
    }
  }

  // Filter and sort items based on search query & selectedFilter pill
  const filteredItems = React.useMemo(() => {
    let list = [...items];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((item) => {
        return (
          item.shopName?.toLowerCase().includes(q) ||
          item.address?.city?.toLowerCase().includes(q) ||
          item.address?.line1?.toLowerCase().includes(q) ||
          item.bio?.toLowerCase().includes(q)
        );
      });
    }

    if (selectedFilter === "Popular") {
      list.sort((a, b) => (b.ratingCount || 0) - (a.ratingCount || 0));
    } else if (selectedFilter === "Offers") {
      list.sort((a, b) => {
        const priceA = a.minPrice > 0 ? a.minPrice : 99999;
        const priceB = b.minPrice > 0 ? b.minPrice : 99999;
        return priceA - priceB;
      });
    } else if (selectedFilter === "Top Rated") {
      list.sort((a, b) => (parseFloat(b.averageRating) || 0) - (parseFloat(a.averageRating) || 0));
    } else if (selectedFilter === "Nearby") {
      // 10-15 km radius filtering when user coordinates are set
      if (userLat && userLng) {
        const radiusFiltered = list.filter((item) => {
          return item.distance !== undefined && item.distance !== null && item.distance !== Infinity
            ? item.distance <= 15
            : true;
        });
        if (radiusFiltered.length > 0) {
          list = radiusFiltered;
        }
      }
      list.sort((a, b) => {
        const distA = a.distance !== undefined && a.distance !== Infinity && a.distance !== null ? a.distance : 9999;
        const distB = b.distance !== undefined && b.distance !== Infinity && b.distance !== null ? b.distance : 9999;
        return distA - distB;
      });
    }

    return list;
  }, [items, searchQuery, selectedFilter, userLat, userLng]);

  const getShopThumbnail = (item, index) => {
    if (item.shopPosterUrl) {
      return item.shopPosterUrl;
    }
    if (item.gallery && item.gallery.length > 0 && item.gallery[0]) {
      return item.gallery[0];
    }
    return SALON_FALLBACK_IMAGES[index % SALON_FALLBACK_IMAGES.length];
  };

  if (loading && items.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#7c3aed" size="large" />
      </View>
    );
  }

  const getDynamicGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) {
      return "Good Morning 🌅,";
    } else if (hour < 17) {
      return "Good Afternoon ☀️,";
    } else {
      return "Good Evening 🌙,";
    }
  };

  const getCardAccentColor = (idx) => {
    const colors = ["#7c3aed", "#ec4899", "#10b981", "#f97316", "#3b82f6"];
    return colors[idx % colors.length];
  };

  const renderHeader = () => {
    return (
      <View style={styles.headerSection}>
        {/* Top Header: Greeting + Location + Notification */}
        <View style={styles.topBar}>
        <View style={styles.leftHeader}>
          <View style={styles.userInfoTop}>
            <Text style={styles.greetTitle}>
              Mr. {user?.name ? user.name.split(" ")[0] : "Hridesh"}
            </Text>
          </View>
        </View>
        
        <View style={styles.topActions}>
          {/* Location Button */}
          <Pressable style={styles.locationSelector} onPress={() => setLocationModalVisible(true)}>
            <Ionicons name="location" size={15} color="#7c3aed" />
            <Text style={styles.locationText} numberOfLines={1}>
              {user?.address?.city ? `${user.address.city}, India` : "Lucknow, India"}
            </Text>
            <Ionicons name="chevron-down" size={13} color="#7c3aed" style={styles.chevron} />
          </Pressable>
          
          {/* Notification Button */}
          <Pressable style={styles.iconButton} onPress={openNotifModal}>
            <Ionicons name="notifications-outline" size={22} color="#0f172a" />
            {unreadCount > 0 && (
              <View style={[styles.notificationBadge, { backgroundColor: "#7c3aed" }]}>
                <Text style={styles.notificationBadgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* Search Input Bar with Search Button */}
      <View style={styles.searchRow}>
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#94a3b8" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for salons, services..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            onSubmitEditing={() => Keyboard.dismiss()}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={18} color="#94a3b8" style={styles.clearIcon} />
            </Pressable>
          )}
        </View>
        <Pressable style={styles.searchSubmitButton} onPress={() => Keyboard.dismiss()}>
          <Ionicons name="search" size={20} color="#ffffff" />
        </Pressable>
      </View>

      {!isSearching && (
        <>
          {/* Promo Banner Card */}
      <Pressable 
        style={styles.bannerContainer}
        onPress={() => navigation.navigate("UserGuide")}
      >
        <Image 
          source={{ uri: BANNER_MODEL_IMAGE }}
          style={styles.bannerBackgroundImage} 
        />
        <LinearGradient
          colors={["rgba(109, 40, 217, 0.85)", "rgba(15, 23, 42, 0.45)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFillObject}
        />
        
        <View style={styles.bannerTextSection}>
          <Text style={styles.bannerTitle}>Look Good. Feel Great.</Text>
          <Text style={styles.bannerSubtitle}>
            Book trusted experts near you at the best prices.
          </Text>
        </View>

        <View style={styles.exploreBtn}>
          <Text style={styles.exploreBtnText}>Explore</Text>
          <Ionicons name="arrow-forward" size={11} color="#7c3aed" style={{ marginLeft: 4 }} />
        </View>
      </Pressable>

      {/* Categories Grid (3 columns side by side) */}
      <View style={styles.categoriesGrid}>
        {/* Barber Card */}
        <Pressable 
          style={[styles.categoryCard, styles.barberCard]}
          onPress={() => navigation.navigate("BarberList")}
        >
          <View style={[styles.categoryIconCircle, { backgroundColor: "#ede9fe" }]}>
            <Ionicons name="cut" size={18} color="#7c3aed" />
          </View>
          <Text style={styles.categoryTitle}>Barber</Text>
          <Text style={styles.categoryDesc} numberOfLines={2}>Sharp look, every time</Text>
          <View style={[styles.categoryArrowCircle, { backgroundColor: "#7c3aed" }]}>
            <Ionicons name="arrow-forward" size={12} color="#ffffff" />
          </View>
          <Image 
            source={require("../../assets/virat.png")} 
            style={[styles.categoryImage, { width: 75, height: 85, right: -8, bottom: -6 }]} 
          />
        </Pressable>

        {/* Beauty Parlor Card */}
        <Pressable 
          style={[styles.categoryCard, styles.beautyCard]}
          onPress={() => navigation.navigate("BeautyParlorList")}
        >
          <View style={[styles.categoryIconCircle, { backgroundColor: "#fce8f3" }]}>
            <Ionicons name="woman" size={18} color="#ec4899" />
          </View>
          <Text style={styles.categoryTitle}>Beauty{"\n"}Parlour</Text>
          <Text style={styles.categoryDesc} numberOfLines={2}>Enhance natural beauty</Text>
          <View style={[styles.categoryArrowCircle, { backgroundColor: "#ec4899" }]}>
            <Ionicons name="arrow-forward" size={12} color="#ffffff" />
          </View>
          <Image 
            source={require("../../assets/beauty parlor.png")} 
            style={[styles.categoryImage, { width: 85, height: 95, right: -10, bottom: -10, resizeMode: "contain" }]} 
          />
        </Pressable>

        {/* Tailor Card */}
        <Pressable 
          style={[styles.categoryCard, styles.stitchingCard]}
          onPress={() => navigation.navigate("TailorList")}
        >
          <View style={[styles.categoryIconCircle, { backgroundColor: "#e6f7f2" }]}>
            <Ionicons name="shirt" size={18} color="#10b981" />
          </View>
          <Text style={styles.categoryTitle}>Tailor</Text>
          <Text style={styles.categoryDesc} numberOfLines={2}>Perfect stitching for you</Text>
          <View style={[styles.categoryArrowCircle, { backgroundColor: "#10b981" }]}>
            <Ionicons name="arrow-forward" size={12} color="#ffffff" />
          </View>
          <Image 
            source={require("../../assets/tailor.png")} 
            style={[styles.categoryImage, { width: 80, height: 80, right: -8, bottom: -8, resizeMode: "contain" }]} 
          />
        </Pressable>
      </View>

      {/* Top Rated Near You Carousel */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Top Rated Near You</Text>
        <Pressable onPress={() => navigation.navigate("Search", { category: "all" })}>
          <Text style={styles.viewAllText}>See all</Text>
        </Pressable>
      </View>

      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        contentContainerStyle={styles.carouselContainer}
      >
        {items.slice(0, 5).map((item, idx) => {
          const accentColor = getCardAccentColor(idx);
          return (
            <Pressable 
              key={`feat-${item.id}`} 
              style={styles.carouselCard}
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
              <View style={styles.carouselImageWrapper}>
                <Image 
                  source={{ uri: getShopThumbnail(item, idx) }} 
                  style={styles.carouselImage} 
                />
                
                {/* Rating Badge */}
                <View style={[styles.ratingBadge, { backgroundColor: accentColor }]}>
                  <Ionicons name="star" size={10} color="#ffffff" />
                  <Text style={styles.ratingText}>{item.averageRating && parseFloat(item.averageRating) > 0 ? item.averageRating : "4.8"}</Text>
                </View>

                {/* Heart Button */}
                <Pressable 
                  style={styles.carouselHeartBtn}
                  onPress={(e) => { e.stopPropagation(); toggleFavorite(item.id); }}
                >
                  <Ionicons 
                    name={favorites.includes(item.id) ? "heart" : "heart-outline"} 
                    size={16} 
                    color={favorites.includes(item.id) ? "#ef4444" : "#ffffff"} 
                  />
                </Pressable>
              </View>

              <View style={styles.carouselInfo}>
                <Text style={styles.carouselShopName} numberOfLines={1}>
                  {item.shopName || "Premium Salon"}
                </Text>
                
                <Text style={styles.carouselServicesText} numberOfLines={1}>
                  {item.businessCategory === "tailor" ? "Tailoring & Custom" : item.businessCategory === "beauty" ? "Beauty Parlour" : "Barber Shop"}
                </Text>
                
                <View style={styles.locationRow}>
                  <Ionicons name="location-sharp" size={11} color={accentColor} />
                  <Text style={styles.carouselLocText} numberOfLines={1}>
                    {item.address?.line1 ? `${item.address.line1}, ` : ""}{item.address?.city || "Lucknow"}
                  </Text>
                </View>

                <Pressable 
                  style={[styles.bookBtn, { backgroundColor: accentColor }]}
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
                  <Text style={styles.bookBtnText}>Book Now</Text>
                </Pressable>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Feature Badges Footer Banner */}
      <View style={styles.featureBanner}>
        <View style={styles.featureItem}>
          <View style={[styles.featureIconBox, { backgroundColor: "#f3e8ff" }]}>
            <Ionicons name="calendar-outline" size={12} color="#7c3aed" />
          </View>
          <View style={styles.featureTexts}>
            <Text style={styles.featureTitle}>Easy Booking</Text>
            <Text style={styles.featureSub}>Quick & hassle free</Text>
          </View>
        </View>

        <View style={styles.featureItem}>
          <View style={[styles.featureIconBox, { backgroundColor: "#e0e7ff" }]}>
            <Ionicons name="shield-checkmark-outline" size={12} color="#4f46e5" />
          </View>
          <View style={styles.featureTexts}>
            <Text style={styles.featureTitle}>Verified Experts</Text>
            <Text style={styles.featureSub}>Trusted & skilled</Text>
          </View>
        </View>

        <View style={styles.featureItem}>
          <View style={[styles.featureIconBox, { backgroundColor: "#fce8f3" }]}>
            <Ionicons name="pricetag-outline" size={12} color="#ec4899" />
          </View>
          <View style={styles.featureTexts}>
            <Text style={styles.featureTitle}>Best Prices</Text>
            <Text style={styles.featureSub}>Affordable deals</Text>
          </View>
        </View>
      </View>
      </>
      )}

      {/* All Salons Header */}
      <View style={[styles.sectionHeader, { marginTop: 12, marginBottom: 12 }]}>
        <Text style={styles.sectionTitle}>
          {isSearching
            ? "🔍 Search Results"
            : selectedFilter === "Popular"
            ? "🔥 Most Popular Shops"
            : selectedFilter === "Offers"
            ? "🏷️ Best Offers & Prices"
            : selectedFilter === "Top Rated"
            ? "⭐ Top Rated Shops"
            : "📍 Nearby Salons & Parlors"}
        </Text>
      </View>
    </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 10) }]}>
      <FlatList
        data={filteredItems}
        extraData={selectedFilter}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7c3aed" />}
        ListHeaderComponent={renderHeader()}
        ListEmptyComponent={
          isSearching ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="search-outline" size={40} color="#cbd5e1" />
              </View>
              <Text style={styles.emptyTitle}>No salons found</Text>
              <Text style={styles.emptyText}>We couldn't find any salons matching "{searchQuery}"</Text>
            </View>
          ) : null
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => (
          <Pressable
            style={styles.salonRowCard}
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
            <View style={styles.rowMainContent}>
              <Image 
                source={{ uri: getShopThumbnail(item, index + 3) }} 
                style={styles.rowPoster} 
              />
              <View style={styles.rowInfo}>
                <View style={styles.rowTopHeader}>
                  <Text style={styles.rowShopName} numberOfLines={1}>{item.shopName || "Premium Salon"}</Text>
                  
                  <Pressable 
                    onPress={(e) => { e.stopPropagation(); toggleFavorite(item.id); }} 
                    style={{ padding: 4 }}
                  >
                    <Ionicons 
                      name={favorites.includes(item.id) ? "heart" : "heart-outline"} 
                      size={20} 
                      color={favorites.includes(item.id) ? "#ef4444" : "#94a3b8"} 
                    />
                  </Pressable>

                  <View style={[styles.statusBadge, item.isShopOpen ? styles.statusOpen : styles.statusClosed, { marginLeft: 6 }]}>
                    <Text style={[styles.statusText, item.isShopOpen ? styles.statusTextOpen : styles.statusTextClosed]}>
                      {item.isShopOpen ? "OPEN" : "CLOSED"}
                    </Text>
                  </View>
                </View>
                
                <Text style={styles.rowCategory} numberOfLines={1}>
                  {item.businessCategory || "Hair & Beauty Services"}
                </Text>

                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Ionicons name="star" size={12} color="#f59e0b" style={{ marginRight: 2 }} />
                    {item.ratingCount && item.ratingCount > 0 ? (
                      <>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: "#334155" }}>
                          {item.averageRating || (item.ratingSum / item.ratingCount).toFixed(1)}
                        </Text>
                        <Text style={{ fontSize: 10, color: "#64748b", marginLeft: 2 }}>
                          ({item.ratingCount})
                        </Text>
                      </>
                    ) : (
                      <Text style={{ fontSize: 11, fontWeight: "700", color: "#64748b" }}>
                        New
                      </Text>
                    )}
                  </View>
                  <Text style={{ fontSize: 11, fontWeight: "800", color: "#0f172a" }}>
                    • Starts from ₹{item.minPrice || 120}
                  </Text>
                </View>

                <View style={styles.rowFooter}>
                  <View style={styles.rowLocationContainer}>
                    <Ionicons name="location-sharp" size={13} color="#7c3aed" />
                    <Text style={styles.rowAddress} numberOfLines={1}>
                      {item.address?.city || "Nearby"}
                      {item.distance !== undefined && item.distance !== null && item.distance !== Infinity
                        ? ` • ${item.distance.toFixed(1)} km away`
                        : ""}
                    </Text>
                  </View>
                  <View style={styles.rowBookBtn}>
                    <Text style={styles.rowBookText}>Book Now</Text>
                  </View>
                </View>
              </View>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="search" size={40} color="#cbd5e1" />
            </View>
            <Text style={styles.emptyTitle}>No salons found</Text>
            <Text style={styles.emptyText}>Try adjusting your filters or search query.</Text>
          </View>
        }
      />



      {/* Notifications Modal */}
      <Modal visible={notifModalVisible} transparent animationType="slide" onRequestClose={() => setNotifModalVisible(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <View style={styles.modalSheetHeader}>
              {selectionMode ? (
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Pressable onPress={() => { setSelectionMode(false); setSelectedNotifIds([]); }} style={{ padding: 4, marginRight: 10 }}>
                      <Ionicons name="close" size={24} color="#334155" />
                    </Pressable>
                    <Text style={[styles.modalSheetTitle, { fontSize: 16 }]}>{selectedNotifIds.length} Selected</Text>
                  </View>
                  
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                    <Pressable onPress={toggleSelectAll} style={{ paddingVertical: 4, paddingHorizontal: 8, backgroundColor: "#f1f5f9", borderRadius: 8 }}>
                      <Text style={{ fontSize: 11, fontWeight: "800", color: "#475569" }}>
                        {selectedNotifIds.length === notifications.length ? "Deselect All" : "Select All"}
                      </Text>
                    </Pressable>

                    <Pressable onPress={deleteSelectedNotifications} style={{ padding: 4 }}>
                      <Ionicons name="trash" size={22} color="#ef4444" />
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Ionicons name="notifications" size={22} color="#7c3aed" style={{ marginRight: 8 }} />
                    <Text style={styles.modalSheetTitle}>Notifications 🔔</Text>
                  </View>
                  <Pressable onPress={() => setNotifModalVisible(false)}>
                    <Ionicons name="close-circle" size={26} color="#94a3b8" />
                  </Pressable>
                </View>
              )}
            </View>

            {!selectionMode && unreadCount > 0 && (
              <Pressable style={{ paddingHorizontal: 18, paddingVertical: 8, alignSelf: "flex-end" }} onPress={markAllRead}>
                <Text style={{ fontSize: 12, fontWeight: "800", color: "#7c3aed" }}>Mark all as read ✓</Text>
              </Pressable>
            )}

            <ScrollView style={{ maxHeight: 400, paddingHorizontal: 18, marginTop: selectionMode ? 10 : 0 }} showsVerticalScrollIndicator={false}>
              {loadingNotifs ? (
                <ActivityIndicator color="#7c3aed" style={{ marginVertical: 30 }} />
              ) : notifications.length === 0 ? (
                <View style={{ alignItems: "center", paddingVertical: 40 }}>
                  <Ionicons name="notifications-off-outline" size={48} color="#cbd5e1" />
                  <Text style={{ fontSize: 15, fontWeight: "800", color: "#334155", marginTop: 12 }}>No Notifications Yet</Text>
                  <Text style={{ fontSize: 12, color: "#64748b", textAlign: "center", marginTop: 4, lineHeight: 18 }}>You will receive updates here when your bookings or orders progress!</Text>
                </View>
              ) : (
                notifications.map((item) => {
                  const isSelected = selectedNotifIds.includes(item._id);
                  return (
                    <Pressable 
                      key={item._id} 
                      onPress={() => {
                        if (selectionMode) {
                          toggleSelectNotification(item._id);
                        } else {
                          confirmDeleteNotification(item._id);
                        }
                      }}
                      onLongPress={() => {
                        if (!selectionMode) {
                          startSelectionMode(item._id);
                        }
                      }}
                      style={({ pressed }) => ({ 
                        backgroundColor: isSelected ? "#e0e7ff" : (item.isRead ? "#f8fafc" : "#f3e8ff"), 
                        padding: 14, 
                        borderRadius: 14, 
                        marginBottom: 10, 
                        borderWidth: 1, 
                        borderColor: isSelected ? "#4f46e5" : (item.isRead ? "#e2e8f0" : "#d8b4fe"),
                        flexDirection: "row",
                        alignItems: "center",
                        opacity: pressed ? 0.7 : 1
                      })}
                    >
                      {selectionMode && (
                        <View style={{ marginRight: 12 }}>
                          {isSelected ? (
                            <Ionicons name="checkbox" size={20} color="#7c3aed" />
                          ) : (
                            <Ionicons name="square-outline" size={20} color="#94a3b8" />
                          )}
                        </View>
                      )}
                      
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                          <Text style={{ fontSize: 13, fontWeight: "800", color: "#0f172a", flex: 1 }}>{item.title}</Text>
                          <Text style={{ fontSize: 10, color: "#94a3b8", fontWeight: "600" }}>
                            {new Date(item.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 12, color: "#475569", lineHeight: 17 }}>{item.body}</Text>
                      </View>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>

            <Pressable 
              style={{ margin: 18, backgroundColor: "#f1f5f9", paddingVertical: 12, borderRadius: 14, alignItems: "center" }}
              onPress={() => setNotifModalVisible(false)}
            >
              <Text style={{ fontWeight: "800", color: "#475569", fontSize: 13.5 }}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Leaflet & OpenStreetMap Location Picker Modal */}
      <LocationPickerModal
        visible={locationModalVisible}
        onClose={() => setLocationModalVisible(false)}
        onSelectLocation={handleSelectLocation}
        initialCity={user?.address?.city || "Lucknow"}
        initialAddress={user?.address?.line1 || ""}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#ffffff" },
  listContent: { paddingBottom: 160 },
  headerSection: { paddingTop: 4 },
  
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  leftHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
  },
  menuBtn: {
    padding: 4,
  },
  userInfoTop: { 
    justifyContent: "center",
  },
  greetSubtitle: { fontSize: 11.5, color: "#64748b", fontWeight: "500" },
  greetTitle: { fontSize: 19, fontWeight: "900", color: "#0f172a", marginTop: 0 },
  topActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  
  locationSelector: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f3ff",
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 20,
  },
  locationText: { fontSize: 12, fontWeight: "700", color: "#1e1b4b", marginHorizontal: 3, maxWidth: 80 },
  chevron: { marginTop: 1 },
  
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    position: "relative",
  },
  notificationBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  notificationBadgeText: { color: "#ffffff", fontSize: 10, fontWeight: "800" },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 12,
    gap: 12,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 18,
    paddingHorizontal: 16,
    flex: 1,
    height: 48,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, height: "100%", fontSize: 14, fontWeight: "500", color: "#0f172a" },
  clearIcon: { padding: 4 },
  searchSubmitButton: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: "#7c3aed",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#7c3aed",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },

  bannerContainer: {
    position: "relative",
    flexDirection: "row",
    borderRadius: 20,
    marginHorizontal: 20,
    marginBottom: 24,
    paddingHorizontal: 16,
    height: 105,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bannerBackgroundImage: {
    ...StyleSheet.absoluteFillObject,
    resizeMode: "cover",
  },
  bannerTextSection: { flex: 1, marginRight: 16, zIndex: 2, justifyContent: "center" },
  bannerTitle: { fontSize: 18, fontWeight: "900", color: "#ffffff", lineHeight: 22 },
  bannerSubtitle: { fontSize: 10.5, color: "rgba(255, 255, 255, 0.9)", marginTop: 4, lineHeight: 14, fontWeight: "600" },
  exploreBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    zIndex: 2,
  },
  exploreBtnText: { color: "#7c3aed", fontSize: 11, fontWeight: "800" },

  categoriesGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 24,
    width: "100%",
  },
  categoryCard: {
    width: "31.3%",
    height: 175,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingTop: 4,
    paddingBottom: 10,
    position: "relative",
    overflow: "hidden",
  },
  barberCard: { backgroundColor: "#f3f0ff" },
  beautyCard: { backgroundColor: "#fdf2f8" },
  stitchingCard: { backgroundColor: "#ecfdf5" },
  categoryIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 0,
  },
  categoryTitle: { fontSize: 16, fontWeight: "900", color: "#0f172a", lineHeight: 19 },
  categoryDesc: { fontSize: 10.5, fontWeight: "500", color: "#64748b", marginTop: 0, lineHeight: 14 },
  categoryArrowCircle: {
    position: "absolute",
    bottom: 12,
    left: 12,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 3,
  },
  categoryImage: { position: "absolute" },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 19, fontWeight: "900", color: "#0f172a" },
  viewAllText: { fontSize: 13, fontWeight: "700", color: "#7c3aed" },

  carouselContainer: { paddingLeft: 20, paddingRight: 20, paddingBottom: 24 },
  carouselCard: {
    width: CAROUSEL_CARD_WIDTH,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    marginRight: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    overflow: "hidden",
    paddingBottom: 10,
  },
  carouselImageWrapper: { width: "100%", height: 120, position: "relative" },
  carouselImage: { width: "100%", height: "100%", backgroundColor: "#f1f5f9" },
  carouselHeartBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  ratingBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  ratingText: { fontSize: 9, fontWeight: "800", color: "#ffffff", marginLeft: 2 },
  
  carouselInfo: { paddingHorizontal: 10, paddingTop: 6 },
  carouselShopName: { fontSize: 14.5, fontWeight: "800", color: "#0f172a" },
  carouselServicesText: { fontSize: 11, color: "#64748b", marginTop: 1, fontWeight: "600" },
  locationRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  carouselLocText: { fontSize: 10, fontWeight: "500", color: "#64748b", marginLeft: 3, flex: 1 },
  bookBtn: {
    paddingVertical: 7,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 8,
    width: "100%",
  },
  bookBtnText: { color: "#ffffff", fontSize: 12, fontWeight: "800" },

  featureBanner: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 6,
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#f1f5f9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  featureItem: { 
    flexDirection: "row", 
    alignItems: "center", 
    width: "33.3%",
    paddingHorizontal: 2,
    justifyContent: "center",
  },
  featureIconBox: { 
    width: 24, 
    height: 24, 
    borderRadius: 12, 
    justifyContent: "center", 
    alignItems: "center",
  },
  featureTexts: { 
    marginLeft: 6,
    flex: 1,
  },
  featureTitle: { fontSize: 11, fontWeight: "800", color: "#0f172a" },
  featureSub: { fontSize: 8.5, color: "#64748b", fontWeight: "500", marginTop: 2 },

  salonRowCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    marginHorizontal: 20,
    marginBottom: 14,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  rowMainContent: { flexDirection: "row" },
  rowPoster: { width: 90, height: 90, borderRadius: 14, backgroundColor: "#f1f5f9" },
  rowInfo: { flex: 1, marginLeft: 14, justifyContent: "space-between" },
  rowTopHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  rowShopName: { fontSize: 15, fontWeight: "800", color: "#0f172a", flex: 1, marginRight: 6 },
  
  statusBadge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  statusOpen: { backgroundColor: "#dcfce7" },
  statusClosed: { backgroundColor: "#f1f5f9" },
  statusText: { fontSize: 8, fontWeight: "800", letterSpacing: 0.5 },
  statusTextOpen: { color: "#16a34a" },
  statusTextClosed: { color: "#94a3b8" },

  rowCategory: { fontSize: 11, color: "#7c3aed", fontWeight: "600", marginTop: 2 },
  
  rowFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  rowLocationContainer: { flexDirection: "row", alignItems: "center", flex: 1, marginRight: 8 },
  rowAddress: { fontSize: 11, color: "#64748b", marginLeft: 4, fontWeight: "500", flexShrink: 1 },
  
  rowBookBtn: {
    backgroundColor: "#7c3aed",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  rowBookText: { color: "#ffffff", fontSize: 11, fontWeight: "700" },

  emptyContainer: { alignItems: "center", paddingVertical: 60, paddingHorizontal: 32 },
  emptyIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#f1f5f9", justifyContent: "center", alignItems: "center", marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: "#334155", textAlign: "center" },
  emptyText: { fontSize: 14, color: "#64748b", marginTop: 8, textAlign: "center", lineHeight: 22 },

  offerBanner: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: "#ede9fe",
    borderRadius: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: "#c084fc",
    borderStyle: "dashed",
    shadowColor: "#7c3aed",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  offerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
  },
  offerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  offerTexts: {
    flex: 1,
  },
  offerTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: "#5b21b6",
  },
  offerSubtitle: {
    fontSize: 9,
    color: "#6d28d9",
    fontWeight: "600",
    marginTop: 1,
  },
  claimBtn: {
    backgroundColor: "#7c3aed",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  claimBtnText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
  },

  modalBg: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "80%",
    paddingBottom: 20,
  },
  modalSheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  modalSheetTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
  },
});
