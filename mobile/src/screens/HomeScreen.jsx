import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
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

// Fallback high-quality salon images to show if shopPosterUrl is empty
const SALON_FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=500&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1605497746444-ac9dedd777a8?w=500&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=500&auto=format&fit=crop&q=80"
];

// Banner model image fallback
const BANNER_MODEL_IMAGE = "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=500&auto=format&fit=crop&q=80";

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

  const load = useCallback(async () => {
    try {
      const params = { businessContext: "barber" };
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

  const renderHeader = () => (
    <View style={styles.headerSection}>
      {/* Top Header: Greeting + Location + Notification */}
      <View style={styles.topBar}>
        <View style={styles.userInfoTop}>
          <Text style={styles.greetSubtitle}>{getDynamicGreeting()}</Text>
          <Text style={styles.greetTitle}>
            {user?.name ? user.name.split(" ")[0] : "Stylish"} 👋
          </Text>
        </View>
        
        <View style={styles.topActions}>
          {/* Location Button */}
          <Pressable style={styles.locationSelector} onPress={() => setLocationModalVisible(true)}>
            <Ionicons name="location" size={16} color="#7c3aed" />
            <Text style={styles.locationText} numberOfLines={1}>
              {user?.address?.city ? `${user.address.city}, India` : "Lucknow, India"}
            </Text>
            <Ionicons name="chevron-down" size={14} color="#334155" style={styles.chevron} />
          </Pressable>
          
          {/* Notification Button */}
          <Pressable style={styles.iconButton} onPress={openNotifModal}>
            <Ionicons name="notifications-outline" size={20} color="#1e293b" />
            {unreadCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* Search Input Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color="#7c3aed" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search for salons, services..."
          placeholderTextColor="#94a3b8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery("")}>
            <Ionicons name="close-circle" size={18} color="#94a3b8" style={styles.clearIcon} />
          </Pressable>
        )}
      </View>

      {/* Quick Filter Pills Row */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRowContainer}
      >
        <Pressable 
          style={[styles.filterPill, selectedFilter === "Nearby" && styles.filterPillActive]}
          onPress={() => setSelectedFilter("Nearby")}
        >
          <Ionicons name="location" size={14} color="#7c3aed" />
          <Text style={[styles.filterPillText, selectedFilter === "Nearby" && styles.filterPillTextActive]}>Nearby</Text>
          <Ionicons name="chevron-down" size={12} color="#64748b" />
        </Pressable>

        <Pressable 
          style={[styles.filterPill, selectedFilter === "Popular" && styles.filterPillActive]}
          onPress={() => setSelectedFilter("Popular")}
        >
          <Ionicons name="bookmarks-outline" size={14} color="#a855f7" />
          <Text style={[styles.filterPillText, selectedFilter === "Popular" && styles.filterPillTextActive]}>Popular</Text>
        </Pressable>

        <Pressable 
          style={[styles.filterPill, selectedFilter === "Offers" && styles.filterPillActive]}
          onPress={() => setSelectedFilter("Offers")}
        >
          <Ionicons name="pricetag-outline" size={14} color="#ec4899" />
          <Text style={[styles.filterPillText, selectedFilter === "Offers" && styles.filterPillTextActive]}>Offers</Text>
        </Pressable>

        <Pressable 
          style={[styles.filterPill, selectedFilter === "Top Rated" && styles.filterPillActive]}
          onPress={() => setSelectedFilter("Top Rated")}
        >
          <Ionicons name="star" size={14} color="#eab308" />
          <Text style={[styles.filterPillText, selectedFilter === "Top Rated" && styles.filterPillTextActive]}>Top Rated</Text>
        </Pressable>
      </ScrollView>

      {/* Promo Banner Card */}
      <View style={styles.bannerContainer}>
        <View style={styles.bannerTextSection}>
          <Text style={styles.bannerTitle}>Look Good.</Text>
          <Text style={styles.bannerTitle}>Feel Great.</Text>
          <Text style={styles.bannerSubtitle}>
            Book trusted experts near you at the{" "}
            <Text style={styles.bannerHighlight}>best prices</Text>.
          </Text>
          
          <Pressable 
            style={styles.exploreBtn}
            onPress={() => navigation.navigate("UserGuide")}
          >
            <Text style={styles.exploreBtnText}>Explore Now 📘</Text>
            <Ionicons name="arrow-forward" size={14} color="#ffffff" style={{ marginLeft: 4 }} />
          </Pressable>
        </View>

        <View style={styles.bannerImageSection}>
          <Image 
            source={{ uri: BANNER_MODEL_IMAGE }}
            style={styles.bannerModelImage} 
          />
          {/* Floating Decorative Badges matching exact UI screenshot */}
          <View style={[styles.floatingBadgeCircle, { top: 12, left: -10, backgroundColor: "#f3e8ff" }]}>
            <Ionicons name="cut" size={14} color="#7c3aed" />
          </View>
          <View style={[styles.floatingBadgeCircle, { top: 44, right: 6, backgroundColor: "#fce8f3" }]}>
            <Ionicons name="ribbon" size={14} color="#ec4899" />
          </View>
          <View style={[styles.floatingBadgeCircle, { bottom: 10, left: 10, backgroundColor: "#f1f5f9" }]}>
            <Ionicons name="sparkles" size={14} color="#0284c7" />
          </View>
        </View>
      </View>

      {/* Categories Grid (2x2 Cards matching exact UI layout) */}
      <View style={styles.categoriesGrid}>
        {/* Barber Card */}
        <Pressable 
          style={[styles.categoryCard, styles.barberCard]}
          onPress={() => navigation.navigate("BarberList")}
        >
          <View style={styles.categoryInfo}>
            <Text style={styles.categoryTitle}>Barber</Text>
            <Text style={[styles.categoryDesc, { color: "#475569" }]}>Sharp look,{"\n"}every time</Text>
          </View>
          <View style={[styles.categoryArrowCircle, { backgroundColor: "#818cf8" }]}>
            <Ionicons name="arrow-forward" size={14} color="#ffffff" />
          </View>
          <Image 
            source={require("../../assets/virat.png")} 
            style={[styles.categoryImage, { width: 110, height: 130, right: -12, bottom: -5 }]} 
          />
        </Pressable>

        {/* Beauty Parlor Card */}
        <Pressable 
          style={[styles.categoryCard, styles.beautyCard]}
          onPress={() => navigation.navigate("BeautyParlourList")}
        >
          <View style={styles.categoryInfo}>
            <Text style={styles.categoryTitle}>Beauty{"\n"}Parlour</Text>
            <Text style={[styles.categoryDesc, { color: "#475569" }]}>Enhance your{"\n"}natural beauty</Text>
          </View>
          <View style={[styles.categoryArrowCircle, { backgroundColor: "#f472b6" }]}>
            <Ionicons name="arrow-forward" size={14} color="#ffffff" />
          </View>
          <Image 
            source={require("../../assets/beauty parlor.png")} 
            style={[styles.categoryImage, { width: 130, height: 145, right: -15, bottom: -15, resizeMode: "contain" }]} 
          />
        </Pressable>

        {/* Tailor Card */}
        <Pressable 
          style={[styles.categoryCard, styles.stitchingCard]}
          onPress={() => navigation.navigate("TailorList")}
        >
          <View style={styles.categoryInfo}>
            <Text style={styles.categoryTitle}>Tailor</Text>
            <Text style={[styles.categoryDesc, { color: "#475569" }]}>Perfect stitching{"\n"}just for you</Text>
          </View>
          <View style={[styles.categoryArrowCircle, { backgroundColor: "#34d399" }]}>
            <Ionicons name="arrow-forward" size={14} color="#ffffff" />
          </View>
          <Image 
            source={require("../../assets/tailor.png")} 
            style={[styles.categoryImage, { width: 110, height: 110, right: -8, bottom: -8, resizeMode: "contain" }]} 
          />
        </Pressable>

        {/* More Services Card */}
        <Pressable 
          style={[styles.categoryCard, styles.moreCard]}
          onPress={() => navigation.navigate("ComingSoon")}
        >
          <View style={styles.categoryInfo}>
            <Text style={[styles.categoryTitle, { color: "#1e1b4b" }]}>More{"\n"}Services</Text>
            <Text style={[styles.categoryDesc, { color: "#475569" }]}>Upcoming{"\n"}features</Text>
          </View>
          <View style={[styles.categoryArrowCircle, { backgroundColor: "#a78bfa" }]}>
            <Ionicons name="arrow-forward" size={14} color="#ffffff" />
          </View>
          <View style={styles.categoryGridIconContainer}>
            <Ionicons name="sparkles-outline" size={26} color="#7c3aed" />
          </View>
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
        {items.slice(0, 5).map((item, idx) => (
          <Pressable 
            key={`feat-${item.id}`} 
            style={styles.carouselCard}
            onPress={() => navigation.navigate("BarberDetail", { barberId: item.id, shopName: item.shopName })}
          >
            <View style={styles.carouselImageWrapper}>
              <Image 
                source={{ uri: getShopThumbnail(item, idx) }} 
                style={styles.carouselImage} 
              />
              
              {/* Discount Tag */}
              <View style={styles.discountBadge}>
                <Text style={styles.discountBadgeText}>20% OFF</Text>
              </View>

              {/* Rating Badge */}
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={12} color="#f59e0b" />
                <Text style={styles.ratingText}>{item.averageRating || "4.8"}</Text>
              </View>
            </View>

            <View style={styles.carouselInfo}>
              <Text style={styles.carouselShopName} numberOfLines={1}>
                {item.shopName || (idx === 0 ? "The Men's Zone" : idx === 1 ? "Glow Beauty Studio" : "Stitch & Style")}
              </Text>
              
              <Text style={styles.carouselServicesText} numberOfLines={1}>
                {item.businessCategory === "tailor" ? "Tailoring • Alteration" : item.businessCategory === "beauty" ? "Makeup • Hair • Skin" : "Hair Cut • Beard • Styling"}
              </Text>
              
              <View style={styles.locationRow}>
                <Ionicons name="location-sharp" size={13} color="#7c3aed" />
                <Text style={styles.carouselLocText} numberOfLines={1}>
                  {item.address?.line1 ? `${item.address.line1}, ` : ""}{item.address?.city || (idx === 0 ? "Gomti Nagar, Lucknow" : idx === 1 ? "Hazratganj, Lucknow" : "Aliganj, Lucknow")}
                </Text>
              </View>

              <View style={styles.carouselCardFooter}>
                <Pressable 
                  style={styles.bookBtn}
                  onPress={() => navigation.navigate("BarberDetail", { barberId: item.id, shopName: item.shopName })}
                >
                  <Text style={styles.bookBtnText}>Book Now</Text>
                </Pressable>

                <Pressable 
                  style={styles.heartBtnCircle}
                  onPress={(e) => { e.stopPropagation(); toggleFavorite(item.id); }}
                >
                  <Ionicons 
                    name={favorites.includes(item.id) ? "heart" : "heart-outline"} 
                    size={18} 
                    color={favorites.includes(item.id) ? "#ef4444" : "#64748b"} 
                  />
                </Pressable>
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      {/* Feature Badges Footer Banner */}
      <View style={styles.featureBanner}>
        <View style={styles.featureItem}>
          <View style={[styles.featureIconBox, { backgroundColor: "#f3e8ff" }]}>
            <Ionicons name="calendar-outline" size={16} color="#7c3aed" />
          </View>
          <View style={styles.featureTexts}>
            <Text style={styles.featureTitle}>Easy Booking</Text>
            <Text style={styles.featureSub}>Quick & hassle free</Text>
          </View>
        </View>

        <View style={styles.featureItem}>
          <View style={[styles.featureIconBox, { backgroundColor: "#e0e7ff" }]}>
            <Ionicons name="shield-checkmark-outline" size={16} color="#4f46e5" />
          </View>
          <View style={styles.featureTexts}>
            <Text style={styles.featureTitle}>Verified Experts</Text>
            <Text style={styles.featureSub}>Trusted & skilled</Text>
          </View>
        </View>

        <View style={styles.featureItem}>
          <View style={[styles.featureIconBox, { backgroundColor: "#fce8f3" }]}>
            <Ionicons name="pricetag-outline" size={16} color="#ec4899" />
          </View>
          <View style={styles.featureTexts}>
            <Text style={styles.featureTitle}>Best Prices</Text>
            <Text style={styles.featureSub}>Affordable deals</Text>
          </View>
        </View>

        <View style={styles.featureItem}>
          <View style={[styles.featureIconBox, { backgroundColor: "#f3e8ff" }]}>
            <Ionicons name="lock-closed-outline" size={16} color="#7c3aed" />
          </View>
          <View style={styles.featureTexts}>
            <Text style={styles.featureTitle}>Secure Payments</Text>
            <Text style={styles.featureSub}>Safe & reliable</Text>
          </View>
        </View>
      </View>

      {/* All Salons Header */}
      <View style={[styles.sectionHeader, { marginTop: 12, marginBottom: 12 }]}>
        <Text style={styles.sectionTitle}>
          {selectedFilter === "Popular"
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

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 10) }]}>
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7c3aed" />}
        ListHeaderComponent={renderHeader()}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => (
          <Pressable
            style={styles.salonRowCard}
            onPress={() =>
              navigation.navigate("BarberDetail", { barberId: item.id, shopName: item.shopName })
            }
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
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="notifications" size={22} color="#7c3aed" style={{ marginRight: 8 }} />
                <Text style={styles.modalSheetTitle}>Notifications 🔔</Text>
              </View>
              <Pressable onPress={() => setNotifModalVisible(false)}>
                <Ionicons name="close-circle" size={26} color="#94a3b8" />
              </Pressable>
            </View>

            {unreadCount > 0 && (
              <Pressable style={{ paddingHorizontal: 18, paddingVertical: 8, alignSelf: "flex-end" }} onPress={markAllRead}>
                <Text style={{ fontSize: 12, fontWeight: "800", color: "#7c3aed" }}>Mark all as read ✓</Text>
              </Pressable>
            )}

            <ScrollView style={{ maxHeight: 400, paddingHorizontal: 18 }} showsVerticalScrollIndicator={false}>
              {loadingNotifs ? (
                <ActivityIndicator color="#7c3aed" style={{ marginVertical: 30 }} />
              ) : notifications.length === 0 ? (
                <View style={{ alignItems: "center", paddingVertical: 40 }}>
                  <Ionicons name="notifications-off-outline" size={48} color="#cbd5e1" />
                  <Text style={{ fontSize: 15, fontWeight: "800", color: "#334155", marginTop: 12 }}>No Notifications Yet</Text>
                  <Text style={{ fontSize: 12, color: "#64748b", textAlign: "center", marginTop: 4, lineHeight: 18 }}>You will receive updates here when your bookings or orders progress!</Text>
                </View>
              ) : (
                notifications.map((item) => (
                  <View 
                    key={item._id} 
                    style={{ 
                      backgroundColor: item.isRead ? "#f8fafc" : "#f3e8ff", 
                      padding: 14, 
                      borderRadius: 14, 
                      marginBottom: 10, 
                      borderWidth: 1, 
                      borderColor: item.isRead ? "#e2e8f0" : "#d8b4fe" 
                    }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <Text style={{ fontSize: 13, fontWeight: "800", color: "#0f172a", flex: 1 }}>{item.title}</Text>
                      <Text style={{ fontSize: 10, color: "#94a3b8", fontWeight: "600" }}>
                        {new Date(item.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 12, color: "#475569", lineHeight: 17 }}>{item.body}</Text>
                  </View>
                ))
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
  container: { flex: 1, backgroundColor: "#fafafc" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fafafc" },
  listContent: { paddingBottom: 100 },
  headerSection: { paddingTop: 4 },
  
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  userInfoTop: { flex: 1 },
  greetSubtitle: { fontSize: 13, color: "#64748b", fontWeight: "500" },
  greetTitle: { fontSize: 24, fontWeight: "800", color: "#0f172a", marginTop: 2 },
  topActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  
  locationSelector: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3e8ff",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  locationText: { fontSize: 12, fontWeight: "700", color: "#1e1b4b", marginHorizontal: 4, maxWidth: 95 },
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
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  notificationBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#ef4444",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  notificationBadgeText: { color: "#ffffff", fontSize: 10, fontWeight: "800" },

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 18,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    height: 52,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, height: "100%", fontSize: 14, fontWeight: "500", color: "#0f172a" },
  clearIcon: { padding: 4 },
  filterIcon: { paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: "#e2e8f0" },

  filterRowContainer: { paddingLeft: 20, paddingRight: 8, paddingBottom: 16, gap: 10 },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  filterPillActive: { borderColor: "#7c3aed", backgroundColor: "#f3e8ff" },
  filterPillText: { fontSize: 13, fontWeight: "600", color: "#334155" },
  filterPillTextActive: { color: "#7c3aed", fontWeight: "700" },

  bannerContainer: {
    flexDirection: "row",
    backgroundColor: "#f4e8ff",
    borderRadius: 24,
    marginHorizontal: 20,
    marginBottom: 24,
    paddingHorizontal: 20,
    paddingVertical: 18,
    height: 160,
    overflow: "hidden",
    alignItems: "center",
  },
  bannerTextSection: { flex: 1, zIndex: 2, justifyContent: "center" },
  bannerTitle: { fontSize: 22, fontWeight: "900", color: "#0f172a", lineHeight: 26 },
  bannerSubtitle: { fontSize: 11, color: "#475569", marginTop: 6, lineHeight: 15, fontWeight: "500" },
  bannerHighlight: { color: "#7c3aed", fontWeight: "800" },
  exploreBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#7c3aed",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    alignSelf: "flex-start",
    marginTop: 12,
  },
  exploreBtnText: { color: "#ffffff", fontSize: 12, fontWeight: "700" },
  
  bannerImageSection: { width: 120, height: 160, justifyContent: "center", alignItems: "center", position: "relative" },
  bannerModelImage: { width: 110, height: 140, borderRadius: 20, resizeMode: "cover" },
  floatingBadgeCircle: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  categoriesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  categoryCard: {
    width: "48%",
    height: 140,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    position: "relative",
    overflow: "hidden",
  },
  barberCard: { backgroundColor: "#ebf3fe" },
  beautyCard: { backgroundColor: "#fce8f3" },
  stitchingCard: { backgroundColor: "#e6f7f2" },
  moreCard: { backgroundColor: "#f3e8ff" },
  categoryInfo: { zIndex: 2, maxWidth: "60%" },
  categoryTitle: { fontSize: 16, fontWeight: "800", color: "#0f172a", lineHeight: 20 },
  categoryDesc: { fontSize: 11, fontWeight: "500", lineHeight: 15, marginTop: 4 },
  categoryArrowCircle: {
    position: "absolute",
    bottom: 14,
    left: 14,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 3,
  },
  categoryImage: { position: "absolute" },
  categoryGridIconContainer: {
    position: "absolute",
    bottom: 14,
    right: 14,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#7c3aed",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 19, fontWeight: "800", color: "#0f172a" },
  viewAllText: { fontSize: 13, fontWeight: "700", color: "#7c3aed" },

  carouselContainer: { paddingLeft: 20, paddingRight: 8, paddingBottom: 24 },
  carouselCard: {
    width: 250,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    marginRight: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    overflow: "hidden",
  },
  carouselImageWrapper: { width: "100%", height: 140, position: "relative" },
  carouselImage: { width: "100%", height: "100%", backgroundColor: "#f1f5f9" },
  discountBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: "#7c3aed",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  discountBadgeText: { color: "#ffffff", fontSize: 10, fontWeight: "800" },
  ratingBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  ratingText: { fontSize: 11, fontWeight: "800", color: "#0f172a", marginLeft: 3 },
  
  carouselInfo: { padding: 14 },
  carouselShopName: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  carouselServicesText: { fontSize: 12, color: "#64748b", marginTop: 2, fontWeight: "500" },
  locationRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  carouselLocText: { fontSize: 11, fontWeight: "500", color: "#64748b", marginLeft: 4, flex: 1 },
  
  carouselCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  bookBtn: {
    backgroundColor: "#7c3aed",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
    flex: 1,
    marginRight: 10,
    alignItems: "center",
  },
  bookBtnText: { color: "#ffffff", fontSize: 12, fontWeight: "700" },
  heartBtnCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f8fafc",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },

  featureBanner: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 24,
    paddingVertical: 16,
    paddingHorizontal: 16,
    justifyContent: "space-between",
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
    gap: 8, 
    width: "47%", 
    marginVertical: 6,
  },
  featureIconBox: { width: 28, height: 28, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  featureTexts: { flex: 1 },
  featureTitle: { fontSize: 11, fontWeight: "800", color: "#0f172a" },
  featureSub: { fontSize: 9, color: "#64748b", fontWeight: "500", marginTop: 1 },

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
