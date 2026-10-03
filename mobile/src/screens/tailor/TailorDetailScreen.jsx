import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Dimensions,
  RefreshControl,
  Modal,
  TextInput,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../../api/client";
import { getSocket } from "../../api/socket";
import { useAuth } from "../../context/AuthContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { isTailorShopOpen } from "../../services/shopStatusService";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

function getServiceImage(service) {
  if (service.images && service.images.length > 0 && service.images[0]) {
    return service.images[0];
  }
  return null;
}

function isVipService(service) {
  if (!service) return false;
  return Boolean(
    service.serviceMode === "premium" ||
    service.isPremium ||
    (typeof service.category === "string" && /premium|vip/i.test(service.category)) ||
    (typeof service.name === "string" && /premium|vip/i.test(service.name))
  );
}

function getServiceDescription(service) {
  if (service.description) return service.description;
  if (service.subcategory) return service.subcategory;
  const n = (service.name || "").toLowerCase();
  if (n.includes("shirt")) return "Custom fit shirt stitching with collar & cuff styling";
  if (n.includes("pant") || n.includes("trouser")) return "Tailored fit trousers with custom waistband & pocket design";
  if (n.includes("suit") || n.includes("blazer")) return "Bespoke formal 2-piece / 3-piece suit crafting with lining";
  if (n.includes("kurta") || n.includes("pajama")) return "Traditional ethnic kurta pajama with fine seam stitching";
  if (n.includes("blouse")) return "Designer blouse stitching with custom neck & sleeve patterns";
  if (isVipService(service)) return "Express VIP stitching with priority turnaround & trial guarantee";
  return "Expert bespoke stitching with precise measurements & trial fitting";
}

function getTailorCategoryIcon(catLabel) {
  const l = (catLabel || "").toLowerCase();
  if (l.includes("shirt")) return "shirt-outline";
  if (l.includes("pant") || l.includes("trouser")) return "cut-outline";
  if (l.includes("suit") || l.includes("blazer") || l.includes("premium") || l.includes("vip")) return "ribbon-outline";
  if (l.includes("kurta") || l.includes("dress") || l.includes("blouse") || l.includes("ethnic")) return "sparkles-outline";
  return "cut-outline";
}

export function TailorDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { user, tailor: myTailor, favorites, toggleFavorite } = useAuth();
  const { tailorId, shopName } = route.params || {};

  const [tailor, setTailor] = useState(null);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedServices, setSelectedServices] = useState([]);

  const [zoomModalVisible, setZoomModalVisible] = useState(false);
  const [zoomImagesList, setZoomImagesList] = useState([]);
  const [zoomImageIndex, setZoomImageIndex] = useState(0);

  const isFollowing = (favorites || []).includes(tailorId);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const loadTailor = useCallback(async () => {
    try {
      const [tailorRes, servicesRes] = await Promise.all([
        api.get(`/tailors/${tailorId}`),
        api.get(`/tailors/${tailorId}/services`),
      ]);
      const rawTailor = tailorRes.data.tailor;
      setTailor(rawTailor ? { ...rawTailor, isShopOpen: isTailorShopOpen(rawTailor) } : rawTailor);
      const loadedServices = (servicesRes.data.services || []).map((s) => ({
        ...s,
        originalPrice: s.originalPrice || s.price || 0,
        discountAmount: s.discountAmount || 0,
      }));
      setServices(loadedServices);
    } catch (err) {
      console.error(err);
      Alert.alert("Error", err?.response?.data?.error || "Failed to load tailor details");
    }
  }, [tailorId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadTailor();
      setLoading(false);
    })();
  }, [loadTailor]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTailor();
    setRefreshing(false);
  }, [loadTailor]);

  useFocusEffect(
    useCallback(() => {
      loadTailor();
    }, [loadTailor])
  );

  // Real-time shop status updates from tailor partner
  useEffect(() => {
    const socket = getSocket();
    const handleStatusUpdate = (data) => {
      const matchId = String(data?.tailorId || data?.shopId || "");
      const currentId = String(tailorId || tailor?._id || tailor?.id || "");
      if (matchId && currentId && matchId === currentId) {
        setTailor((prev) => (prev ? { ...prev, isShopOpen: Boolean(data.isShopOpen) } : prev));
      }
    };
    socket.on("shopStatusUpdated", handleStatusUpdate);
    return () => {
      socket.off("shopStatusUpdated", handleStatusUpdate);
    };
  }, [tailorId, tailor?._id, tailor?.id]);

  const todayWorkingHoursText = useMemo(() => {
    const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const fullDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const now = new Date();
    const todayKey = days[now.getDay()];
    const fullKey = fullDays[now.getDay()];
    const wh = tailor?.workingHours ? (tailor.workingHours[todayKey] || tailor.workingHours[fullKey]) : null;
    if (!wh) {
      return "09:30 AM - 08:30 PM";
    }
    if (wh.isClosed || wh.open === false) {
      return "Closed Today (Weekly Off)";
    }
    const open = (typeof wh.open === "string" ? wh.open : wh.start) || "09:30 AM";
    const close = (typeof wh.close === "string" ? wh.close : wh.end) || "08:30 PM";
    return `${open} - ${close}`;
  }, [tailor]);

  const toggleService = (svc) => {
    if (!svc) return;
    const svcId = svc._id || svc.id;
    const isAlreadySelected = selectedServices.some((s) => (s._id || s.id) === svcId);

    // If already selected, deselect it
    if (isAlreadySelected) {
      setSelectedServices((prev) => prev.filter((s) => (s._id || s.id) !== svcId));
      return;
    }

    const tappedIsVIP = isVipService(svc);
    const currentlySelectedVIP = selectedServices.find((s) => isVipService(s));

    // Case 1: Customer tapped a VIP service
    if (tappedIsVIP) {
      // If a VIP service is already selected, ask to switch
      if (currentlySelectedVIP) {
        Alert.alert(
          "VIP Service Exclusive",
          `VIP services operate on a dedicated priority turnaround schedule and can only be booked one at a time.\n\nWould you like to switch your selection to "${svc.name}"?`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Switch to This VIP",
              onPress: () => setSelectedServices([svc]),
            },
          ]
        );
        return;
      }

      // If normal services are already selected, ask before replacing with VIP
      if (selectedServices.length > 0) {
        Alert.alert(
          "VIP Service Exclusive",
          `VIP services feature a dedicated delivery timeline and cannot be combined with regular services.\n\nWould you like to clear the selected regular services and book "${svc.name}" as VIP?`,
          [
            { text: "Keep Regular Services", style: "cancel" },
            {
              text: "Select VIP Only 👑",
              onPress: () => setSelectedServices([svc]),
            },
          ]
        );
        return;
      }

      // No services selected yet, select VIP directly
      setSelectedServices([svc]);
      return;
    }

    // Case 2: Customer tapped a NORMAL service
    if (currentlySelectedVIP) {
      // Customer has a VIP service selected and tapped a normal service
      Alert.alert(
        "VIP Service Selected",
        `You currently have a VIP service selected with a dedicated turnaround time. VIP services cannot be combined with regular services.\n\nWould you like to replace the VIP service with "${svc.name}"? (You can select multiple regular services together).`,
        [
          { text: "Keep VIP Service", style: "cancel" },
          {
            text: "Select Regular Service",
            onPress: () => setSelectedServices([svc]),
          },
        ]
      );
      return;
    }

    // Normal service and no VIP currently selected: can select as many normal services as desired!
    setSelectedServices((prev) => [...prev, svc]);
  };

  const isOwnShop = useMemo(() => {
    const myId = (user?._id || user?.id)?.toString();
    const ownerUserId = (tailor?.userId?._id || tailor?.userId)?.toString();
    const isOwnerUser = Boolean(myId && ownerUserId && myId === ownerUserId);
    const isOwnerTailor = Boolean(myTailor?._id && tailorId && myTailor._id.toString() === tailorId.toString());
    return isOwnerUser || isOwnerTailor;
  }, [tailor, user, myTailor, tailorId]);

  const handleProceed = () => {
    if (isOwnShop) {
      return Alert.alert(
        "Action Not Allowed",
        "You cannot place an order at your own tailor shop. You can explore and book services from other tailor studios."
      );
    }
    if (tailor && !isTailorShopOpen(tailor)) {
      return Alert.alert(
        "Shop Currently Closed",
        "This tailor studio is currently closed and not accepting new orders right now. Please check their operating hours or try again when the shop opens."
      );
    }
    const hasVip = selectedServices.some((s) => isVipService(s));
    if (hasVip && selectedServices.length > 1) {
      return Alert.alert(
        "Invalid Selection",
        "VIP services have a dedicated delivery timeline and cannot be combined with regular services. Please select either one VIP service or multiple regular services."
      );
    }
    navigation.navigate("TailorServiceMode", {
      tailor,
      services: selectedServices,
    });
  };

  const heroImages = useMemo(() => {
    const list = [];
    if (tailor?.shopPosterUrl) list.push(tailor.shopPosterUrl);
    if (tailor?.gallery && tailor.gallery.length > 0) list.push(...tailor.gallery);
    if (list.length === 0) {
      list.push("https://images.unsplash.com/photo-1598522325754-046dd13ac1c0?w=800&q=80");
    }
    return list;
  }, [tailor?.shopPosterUrl, tailor?.gallery]);

  const shopAvatar = useMemo(() => {
    if (tailor?.shopPosterUrl) return tailor.shopPosterUrl;
    if (tailor?.gallery && tailor.gallery.length > 0) return tailor.gallery[0];
    return "https://images.unsplash.com/photo-1598522325754-046dd13ac1c0?w=400&q=80";
  }, [tailor?.shopPosterUrl, tailor?.gallery]);

  const dynamicCategories = useMemo(() => {
    const seen = new Set();
    const cats = [];
    services.forEach((s) => {
      let label = isVipService(s) ? "Premium VIP" : (s.category && s.category.trim()) || "General";
      if (!seen.has(label)) {
        seen.add(label);
        cats.push(label);
      }
    });
    // Put "Premium VIP" category right after "All" if shop offers VIP services
    if (seen.has("Premium VIP")) {
      return ["Premium VIP", ...cats.filter((c) => c !== "Premium VIP")];
    }
    return cats;
  }, [services]);

  const currentDisplayServices = useMemo(() => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return services.filter(
        (s) =>
          (s.name && s.name.toLowerCase().includes(q)) ||
          (s.category && s.category.toLowerCase().includes(q)) ||
          (s.subcategory && s.subcategory.toLowerCase().includes(q))
      );
    }
    if (selectedCategory === "all" || dynamicCategories.length === 0) {
      // Sort VIP services first so customers see them prominently at the top of All Tailoring Services
      return [...services].sort((a, b) => {
        const aVIP = isVipService(a);
        const bVIP = isVipService(b);
        if (aVIP && !bVIP) return -1;
        if (!aVIP && bVIP) return 1;
        return 0;
      });
    }
    if (selectedCategory === "Premium VIP") {
      return services.filter((s) => isVipService(s));
    }
    return services.filter(
      (s) => (s.category && s.category.trim()) === selectedCategory
    );
  }, [services, selectedCategory, dynamicCategories, searchQuery]);

  const currentSectionTitle = useMemo(() => {
    if (searchQuery.trim()) return "Search Results";
    if (selectedCategory === "all") return "All Tailoring Services";
    return selectedCategory;
  }, [selectedCategory, searchQuery]);

  const addr = tailor?.address || {};
  const addressDisplay = [addr.line1, addr.city, addr.pincode].filter(Boolean).join(", ") || "Main Market, Jamunaha";

  function openMap() {
    if (tailor?.location?.lat != null && tailor?.location?.lng != null) {
      const q = `${tailor.location.lat},${tailor.location.lng}`;
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`);
    } else if (addr.line1 || addr.city) {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressDisplay)}`);
    }
  }

  const totalPrice = useMemo(() => {
    return selectedServices.reduce((acc, s) => acc + (s.price || 0), 0);
  }, [selectedServices]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0d9488" />
      </View>
    );
  }

  if (!tailor) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle" size={48} color="#94a3b8" />
        <Text style={styles.errorText}>Tailor not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* ================= TOP HEADER BAR ================= */}
      <View style={[styles.topHeader, { paddingTop: Math.max(insets.top, 12) }]}>
        <Pressable
          onPress={() => {
            if (navigation.canGoBack()) navigation.goBack();
            else navigation.navigate("MainTabs", { screen: "Home" });
          }}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </Pressable>

        {/* Circular Avatar */}
        <Pressable
          onPress={() => {
            setZoomImagesList(heroImages);
            setZoomImageIndex(0);
            setZoomModalVisible(true);
          }}
          style={styles.avatarWrapper}
        >
          <Image source={{ uri: shopAvatar }} style={styles.shopAvatar} />
        </Pressable>

        {/* Title & Badges */}
        <View style={styles.headerInfoCol}>
          <Text style={styles.headerShopName} numberOfLines={1}>
            {tailor.shopName || shopName || "Master Tailors"}
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2, marginBottom: 2 }}>
            <View style={styles.verifiedRow}>
              <Ionicons name="checkmark-circle" size={13} color="#16a34a" />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>

            {/* LIVE OPEN / CLOSED BADGE */}
            {(() => {
              const isOpen = isTailorShopOpen(tailor);
              return (
                <View style={[styles.statusPill, isOpen ? styles.statusPillOpen : styles.statusPillClosed]}>
                  <View style={[styles.statusDot, { backgroundColor: isOpen ? "#16a34a" : "#ef4444" }]} />
                  <Text style={[styles.statusPillText, { color: isOpen ? "#15803d" : "#b91c1c" }]}>
                    {isOpen ? "OPEN NOW" : "CLOSED"}
                  </Text>
                </View>
              );
            })()}
          </View>

          <Pressable onPress={openMap} style={styles.locationRow}>
            <Ionicons name="location-sharp" size={13} color="#475569" />
            <Text style={styles.locationText} numberOfLines={1}>
              {addressDisplay}
            </Text>
          </Pressable>
        </View>

        {/* Favourite Button */}
        <Pressable
          style={[styles.followBtn, isFollowing && styles.followingBtn]}
          onPress={() => toggleFavorite(tailorId)}
        >
          <Ionicons name={isFollowing ? "heart" : "heart-outline"} size={16} color={isFollowing ? "#ffffff" : "#ef4444"} style={{ marginRight: 5 }} />
          <Text style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>
            {isFollowing ? "Favourited" : "Favourite"}
          </Text>
        </Pressable>
      </View>

      {/* Real-time Closed Banner if studio is closed right now */}
      {!tailor.isShopOpen && (
        <View style={styles.closedTopBanner}>
          <Ionicons name="alert-circle" size={18} color="#b91c1c" style={{ marginRight: 8 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.closedTopBannerTitle}>Studio Closed Right Now</Text>
            <Text style={styles.closedTopBannerSub}>
              This tailor shop is currently closed. New orders will be accepted when the shop reopens.
            </Text>
          </View>
        </View>
      )}

      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={{ paddingBottom: selectedServices.length > 0 ? 140 : 60 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0d9488" />}
      >
        {/* ================= SEARCH & FILTER BAR ================= */}
        <View style={styles.searchBarWrapper}>
          <View style={styles.searchInputCard}>
            <Ionicons name="search-outline" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search shirts, trousers, suits, kurta..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery("")} style={{ padding: 4 }}>
                <Ionicons name="close-circle" size={18} color="#94a3b8" />
              </Pressable>
            )}
          </View>

          <Pressable
            style={styles.filterBtn}
            onPress={() => {
              Alert.alert(
                "Filter Services",
                "Select a category filter",
                [
                  { text: "All Services", onPress: () => setSelectedCategory("all") },
                  { text: "Premium VIP", onPress: () => setSelectedCategory("Premium VIP") },
                  { text: "Cancel", style: "cancel" },
                ]
              );
            }}
          >
            <Ionicons name="options-outline" size={20} color="#0f172a" />
          </Pressable>
        </View>

        {/* ================= DYNAMIC CATEGORY TABS ================= */}
        {(dynamicCategories.length > 1 || (dynamicCategories.length === 1 && services.length > 0)) && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesScroll}
          >
            {/* "All" tab always first */}
            <Pressable
              key="all"
              style={[styles.categoryCard, selectedCategory === "all" && styles.categoryCardSelected]}
              onPress={() => {
                setSelectedCategory("all");
                setSearchQuery("");
              }}
            >
              <View style={styles.categoryIconWrap}>
                <Ionicons
                  name="grid-outline"
                  size={22}
                  color={selectedCategory === "all" ? "#0d9488" : "#0f172a"}
                />
              </View>
              <Text style={[styles.categoryLabel, selectedCategory === "all" && styles.categoryLabelSelected]}>
                All
              </Text>
            </Pressable>

            {/* Dynamic tabs from categories */}
            {dynamicCategories.map((catLabel) => {
              const isSelected = selectedCategory === catLabel;
              const isVIPTab = catLabel === "Premium VIP";
              return (
                <Pressable
                  key={catLabel}
                  style={[
                    styles.categoryCard,
                    isVIPTab && styles.vipCategoryCard,
                    isSelected && (isVIPTab ? styles.vipCategoryCardSelected : styles.categoryCardSelected)
                  ]}
                  onPress={() => {
                    setSelectedCategory(catLabel);
                    setSearchQuery("");
                  }}
                >
                  <View style={styles.categoryIconWrap}>
                    <Ionicons
                      name={isVIPTab ? "ribbon" : getTailorCategoryIcon(catLabel)}
                      size={22}
                      color={isSelected ? (isVIPTab ? "#ffffff" : "#0d9488") : (isVIPTab ? "#7c3aed" : "#0f172a")}
                    />
                  </View>
                  <Text style={[
                    styles.categoryLabel,
                    isVIPTab && styles.vipCategoryLabel,
                    isSelected && (isVIPTab ? styles.vipCategoryLabelSelected : styles.categoryLabelSelected)
                  ]}>
                    {isVIPTab ? "👑 VIP" : catLabel}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* ================= HERO SPECIAL OFFER BANNER ================= */}
        <View style={styles.bannerContainer}>
          <View style={styles.bannerContentLeft}>
            <View style={styles.specialOfferBadge}>
              <Text style={styles.specialOfferText}>✂️ Bespoke Tailoring</Text>
            </View>
            <Text style={styles.bannerHeading}>Perfect Fit, Crafted for You</Text>
            <Text style={styles.bannerSubheading}>Custom Tailoring & Express VIP Stitching</Text>

            <Pressable
              style={styles.bannerActionBtn}
              onPress={() => {
                if (currentDisplayServices.length > 0) {
                  toggleService(currentDisplayServices[0]);
                }
              }}
            >
              <Text style={styles.bannerActionBtnText}>Select Services →</Text>
            </Pressable>
          </View>

          <View style={styles.bannerImageWrapper}>
            <Image
              source={{ uri: heroImages[0] }}
              style={styles.bannerImage}
              resizeMode="cover"
            />
          </View>

          {/* Dots Indicator */}
          <View style={styles.bannerDotsRow}>
            <View style={[styles.bannerDot, styles.bannerDotActive]} />
            <View style={styles.bannerDot} />
            <View style={styles.bannerDot} />
          </View>
        </View>

        {/* ================= SECTION HEADER ================= */}
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeaderLeft}>
            <View style={[styles.sectionIconWrap, selectedCategory === "Premium VIP" && { backgroundColor: "#ede9fe" }]}>
              <Ionicons
                name={selectedCategory === "Premium VIP" ? "ribbon" : "cut-outline"}
                size={20}
                color={selectedCategory === "Premium VIP" ? "#7c3aed" : "#0d9488"}
              />
            </View>
            <Text style={styles.sectionMainTitle}>{currentSectionTitle}</Text>
            {selectedCategory === "all" && services.some(isVipService) && (
              <View style={styles.vipHeaderNoticeBadge}>
                <Text style={styles.vipHeaderNoticeBadgeText}>👑 VIP Services Available</Text>
              </View>
            )}
          </View>

          {selectedCategory !== "all" && services.length > currentDisplayServices.length && (
            <Pressable onPress={() => { setSelectedCategory("all"); setSearchQuery(""); }}>
              <Text style={styles.viewAllBtnText}>View All &gt;</Text>
            </Pressable>
          )}
        </View>
        <Text style={styles.sectionSubTitleText}>
          {currentDisplayServices.length} service{currentDisplayServices.length !== 1 ? "s" : ""} available
        </Text>

        {/* ================= HORIZONTAL SERVICES CARDS ================= */}
        {currentDisplayServices.length === 0 ? (
          <View style={styles.noServicesBox}>
            <Ionicons name="cut-outline" size={36} color="#99f6e4" />
            <Text style={styles.noServicesTitle}>
              {searchQuery.trim() ? "No services found" : "No tailoring services added yet"}
            </Text>
            <Text style={styles.noServicesSub}>
              {searchQuery.trim()
                ? "Try searching with a different keyword"
                : "This tailor hasn't added services in this category yet"}
            </Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalServicesScroll}
          >
            {currentDisplayServices.map((service, idx) => {
              const svcId = service._id || service.id;
              const isSelected = !!selectedServices.find((s) => (s._id || s.id) === svcId);
              const isVIP = isVipService(service);
              const timeHighlight = isVIP && service.completionTime ? `⚡ Ready in ${service.completionTime}` : null;
              const badgeLabel = timeHighlight
                ? timeHighlight
                : isVIP
                ? "👑 VIP Express"
                : idx === 0
                ? "🔥 Popular"
                : idx === 1
                ? "⭐ Trending"
                : "✨ Bespoke";
              const badgeColor = isVIP ? "#7c3aed" : idx === 0 ? "#0d9488" : idx === 1 ? "#0284c7" : "#059669";

              return (
                <View key={svcId} style={[styles.serviceItemCard, isVIP && styles.serviceItemCardVIP]}>
                  {/* VIP Top Highlight Ribbon */}
                  {isVIP && (
                    <View style={styles.vipTopRibbon}>
                      <Ionicons name="sparkles" size={11} color="#fef08a" />
                      <Text style={styles.vipTopRibbonText}>👑 PREMIUM VIP SERVICE</Text>
                      <Ionicons name="flash" size={11} color="#fef08a" />
                    </View>
                  )}

                  {/* Service Image with Badges */}
                  <View style={styles.serviceImageContainer}>
                    {(() => {
                      const imgUri = getServiceImage(service);
                      return imgUri ? (
                        <Image source={{ uri: imgUri }} style={styles.serviceImage} />
                      ) : (
                        <View style={[styles.serviceImage, styles.emptyServiceImagePlaceholder, isVIP && { backgroundColor: "#faf5ff" }]}>
                          <Ionicons name={isVIP ? "ribbon-outline" : "cut-outline"} size={32} color={isVIP ? "#a855f7" : "#5eead4"} />
                          <Text style={[styles.emptyServiceImageText, isVIP && { color: "#7c3aed" }]}>{service.name || "Stitching"}</Text>
                        </View>
                      );
                    })()}

                    {/* Top Left Pill Badge */}
                    <View style={[styles.popularBadge, isVIP ? styles.vipPopularBadge : { backgroundColor: badgeColor }]}>
                      <Text style={styles.popularBadgeText}>{badgeLabel}</Text>
                    </View>

                    {/* Top Right Heart / Select */}
                    <Pressable
                      style={[styles.cardHeartBtn, isVIP && styles.cardHeartBtnVIP]}
                      onPress={() => toggleService(service)}
                    >
                      <Ionicons
                        name={isSelected ? "checkmark-circle" : "checkmark-circle-outline"}
                        size={22}
                        color={isSelected ? (isVIP ? "#a855f7" : "#0d9488") : "#ffffff"}
                      />
                    </Pressable>
                  </View>

                  {/* Service Details */}
                  <View style={[styles.serviceBody, isVIP && styles.serviceBodyVIP]}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                      <Text style={[styles.serviceNameText, isVIP && styles.vipServiceNameText]} numberOfLines={1}>
                        {service.name}
                      </Text>
                      {isVIP && (
                        <View style={styles.vipCrownBadge}>
                          <Text style={styles.vipCrownBadgeText}>VIP 👑</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.serviceDescText, isVIP && styles.vipServiceDescText]} numberOfLines={2}>
                      {getServiceDescription(service)}
                    </Text>

                    {/* VIP Highlight Features Strip */}
                    {isVIP && (
                      <View style={styles.vipHighlightStrip}>
                        <Ionicons name="flash" size={11} color="#7c3aed" />
                        <Text style={styles.vipHighlightStripText}>
                          Priority Stitching • {service.completionTime ? `⚡ ${service.completionTime}` : "Express Turnaround"}
                        </Text>
                      </View>
                    )}

                    {/* Price, Mode & Select Button */}
                    <View style={styles.serviceFooterRow}>
                      <View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text style={[styles.servicePriceText, isVIP && styles.vipPriceText]}>₹{service.price}</Text>
                          {service.originalPrice > service.price && (
                            <Text style={styles.originalPriceStrike}>₹{service.originalPrice}</Text>
                          )}
                          {service.originalPrice > service.price && (
                            <View style={[styles.discountPill, isVIP && { backgroundColor: "#f3e8ff" }]}>
                              <Text style={[styles.discountPillText, isVIP && { color: "#7c3aed" }]}>
                                {Math.round(((service.originalPrice - service.price) / service.originalPrice) * 100)}% OFF
                              </Text>
                            </View>
                          )}
                        </View>

                        {/* Delivery Time Highlight for Premium VIP Services */}
                        {isVIP && (service.completionTime || service.estimatedDays) ? (
                          <View style={styles.vipDeliveryTag}>
                            <Ionicons name="time" size={11} color="#7c3aed" style={{ marginRight: 3 }} />
                            <Text style={styles.vipDeliveryTagText}>
                              Ready in {service.completionTime || `${service.estimatedDays} Days`}
                            </Text>
                          </View>
                        ) : (
                          <View style={styles.durationRow}>
                            <Ionicons name="cut-outline" size={13} color="#64748b" style={{ marginRight: 3 }} />
                            <Text style={styles.durationText}>Custom fit</Text>
                          </View>
                        )}
                      </View>

                      <Pressable
                        style={[
                          styles.bookNowBtn,
                          isVIP && styles.bookNowBtnVIP,
                          isSelected && (isVIP ? styles.bookNowBtnVIPSelected : styles.bookNowBtnSelected)
                        ]}
                        onPress={() => toggleService(service)}
                      >
                        <Text style={styles.bookNowBtnText}>
                          {isSelected ? "Selected ✓" : isVIP ? "Select VIP 👑" : "Select"}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* ================= TAILOR PROFILE & ABOUT ================= */}
        <View style={styles.metaCardsContainer}>
          {/* Master Tailor / Owner Info */}
          <View style={styles.hoursMetaCard}>
            <View style={styles.metaIconWrap}>
              <Ionicons name="person" size={20} color="#0d9488" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.metaCardTitle}>Master Tailor</Text>
              <Text style={styles.metaCardSub}>
                {tailor.ownerName || "Expert Bespoke Tailor"} • {tailor.specialties?.join(", ") || "Custom Stitching"}
              </Text>
            </View>
          </View>

          {/* Location Card */}
          <Pressable onPress={openMap} style={styles.locationMetaCard}>
            <View style={styles.metaIconWrap}>
              <Ionicons name="location" size={20} color="#0d9488" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.metaCardTitle}>Shop Location</Text>
              <Text style={styles.metaCardSub} numberOfLines={1}>
                {addressDisplay}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
          </Pressable>

          {/* Working Hours Card */}
          <View style={styles.hoursMetaCard}>
            <View style={styles.metaIconWrap}>
              <Ionicons name="time" size={20} color="#16a34a" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.metaCardTitle}>Shop Status</Text>
              <Text style={[styles.metaCardSub, { color: tailor.isShopOpen ? "#16a34a" : "#ef4444", fontWeight: "600" }]}>
                {tailor.isShopOpen ? "Open for Bookings" : "Closed Now"}
              </Text>
            </View>
          </View>

          {/* Bio if exists */}
          {tailor.bio ? (
            <View style={styles.bioCard}>
              <Text style={styles.bioCardTitle}>About Studio</Text>
              <Text style={styles.bioCardText}>{tailor.bio}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* ================= FLOATING FOOTER SUMMARY BAR ================= */}
      {selectedServices.length > 0 && (
        <View style={[styles.floatingFooter, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          <View style={styles.footerLeft}>
            <View style={[styles.footerCartBadge, selectedServices.some(isVipService) && { backgroundColor: "#f3e8ff" }]}>
              <Ionicons
                name={selectedServices.some(isVipService) ? "ribbon" : "bag-check"}
                size={20}
                color={selectedServices.some(isVipService) ? "#7c3aed" : "#0d9488"}
              />
              <View style={[styles.badgeNumber, selectedServices.some(isVipService) && { backgroundColor: "#7c3aed" }]}>
                <Text style={styles.badgeNumberText}>{selectedServices.length}</Text>
              </View>
            </View>
            <View style={{ marginLeft: 12 }}>
              <Text style={[styles.footerCountText, selectedServices.some(isVipService) && { color: "#7c3aed", fontWeight: "700" }]}>
                {selectedServices.some(isVipService)
                  ? "👑 1 VIP Service (Dedicated Timeline)"
                  : `${selectedServices.length} Item(s) Selected`}
              </Text>
              <Text style={styles.footerPriceText}>₹{totalPrice}</Text>
            </View>
          </View>

          <Pressable
            style={[
              styles.floatingBookBtn,
              selectedServices.some(isVipService) && { backgroundColor: "#7c3aed" },
              isOwnShop ? { backgroundColor: "#64748b" } : !tailor.isShopOpen && { backgroundColor: "#ef4444" }
            ]}
            onPress={handleProceed}
          >
            <Text style={styles.floatingBookBtnText}>
              {isOwnShop
                ? "Your Own Shop"
                : tailor.isShopOpen
                ? selectedServices.some(isVipService)
                  ? "Book VIP Express →"
                  : "Place Order →"
                : "Shop Closed"}
            </Text>
          </Pressable>
        </View>
      )}

      {/* ================= ZOOM IMAGE MODAL ================= */}
      <Modal visible={zoomModalVisible} transparent animationType="fade">
        <View style={styles.zoomModalBg}>
          <Pressable style={styles.zoomCloseBtn} onPress={() => setZoomModalVisible(false)}>
            <Ionicons name="close" size={28} color="#ffffff" />
          </Pressable>
          <Image
            source={{ uri: zoomImagesList[zoomImageIndex] || shopAvatar }}
            style={styles.fullscreenImage}
            resizeMode="contain"
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  errorText: {
    fontSize: 16,
    color: "#64748b",
    marginTop: 8,
  },
  mainScroll: {
    flex: 1,
  },

  /* Top Header */
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  backBtn: {
    padding: 4,
    marginRight: 10,
  },
  avatarWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#ccfbf1",
    backgroundColor: "#f0fdfa",
  },
  shopAvatar: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  headerInfoCol: {
    flex: 1,
    marginLeft: 10,
  },
  headerShopName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  verifiedRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#16a34a",
    marginLeft: 3,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  locationText: {
    fontSize: 11,
    color: "#475569",
    marginLeft: 3,
    maxWidth: 160,
  },
  followBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#ef4444",
    backgroundColor: "#fff5f5",
  },
  followingBtn: {
    backgroundColor: "#ef4444",
    borderColor: "#ef4444",
  },
  followBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ef4444",
  },
  followingBtnText: {
    color: "#ffffff",
  },

  /* Search & Filter */
  searchBarWrapper: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 14,
  },
  searchInputCard: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0f172a",
    paddingVertical: 0,
  },
  filterBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },

  /* Categories */
  categoriesScroll: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  categoryCard: {
    width: 76,
    height: 80,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  categoryCardSelected: {
    backgroundColor: "#f0fdfa",
    borderColor: "#2dd4bf",
    borderWidth: 1.5,
  },
  categoryIconWrap: {
    marginBottom: 4,
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: "#334155",
    textAlign: "center",
    paddingHorizontal: 4,
  },
  categoryLabelSelected: {
    color: "#0d9488",
    fontWeight: "700",
  },

  /* Hero Banner */
  bannerContainer: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 20,
    backgroundColor: "#0f766e",
    height: 180,
    flexDirection: "row",
    overflow: "hidden",
    position: "relative",
    shadowColor: "#0f766e",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  bannerContentLeft: {
    flex: 1.1,
    padding: 16,
    justifyContent: "center",
    zIndex: 2,
  },
  specialOfferBadge: {
    backgroundColor: "rgba(255,255,255,0.22)",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  specialOfferText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#ffffff",
  },
  bannerHeading: {
    fontSize: 16,
    fontWeight: "800",
    color: "#ffffff",
    lineHeight: 20,
  },
  bannerSubheading: {
    fontSize: 11,
    color: "rgba(255,255,255,0.9)",
    marginTop: 4,
  },
  bannerActionBtn: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    alignSelf: "flex-start",
    marginTop: 10,
  },
  bannerActionBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0f172a",
  },
  bannerImageWrapper: {
    flex: 0.9,
    height: "100%",
  },
  bannerImage: {
    width: "100%",
    height: "100%",
  },
  bannerDotsRow: {
    position: "absolute",
    bottom: 8,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  bannerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.4)",
    marginLeft: 4,
  },
  bannerDotActive: {
    backgroundColor: "#ffffff",
    width: 14,
  },

  /* Section Header */
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginTop: 20,
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionIconWrap: {
    marginRight: 8,
  },
  sectionMainTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
  },
  viewAllBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0d9488",
  },
  sectionSubTitleText: {
    fontSize: 12,
    color: "#64748b",
    paddingHorizontal: 16,
    marginTop: 2,
    marginBottom: 12,
  },

  /* Horizontal Service Cards */
  noServicesBox: {
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 32,
    backgroundColor: "#f0fdfa",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#99f6e4",
    alignItems: "center",
    justifyContent: "center",
  },
  noServicesTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f766e",
    marginTop: 10,
  },
  noServicesSub: {
    fontSize: 12,
    color: "#115e59",
    marginTop: 4,
    textAlign: "center",
    paddingHorizontal: 20,
    lineHeight: 17,
  },
  horizontalServicesScroll: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  serviceItemCard: {
    width: SCREEN_WIDTH * 0.58,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginRight: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  serviceImageContainer: {
    height: 140,
    width: "100%",
    position: "relative",
  },
  serviceImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  emptyServiceImagePlaceholder: {
    backgroundColor: "#f0fdfa",
    justifyContent: "center",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#ccfbf1",
  },
  emptyServiceImageText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#14b8a6",
    marginTop: 6,
    textTransform: "capitalize",
  },
  popularBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  popularBadgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "700",
  },
  cardHeartBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  serviceBody: {
    padding: 12,
  },
  serviceNameText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  serviceDescText: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 4,
    lineHeight: 15,
    height: 30,
  },
  serviceFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  servicePriceText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
  },
  originalPriceStrike: {
    fontSize: 12,
    color: "#94a3b8",
    textDecorationLine: "line-through",
    fontWeight: "600",
  },
  durationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  durationText: {
    fontSize: 11,
    color: "#64748b",
  },
  bookNowBtn: {
    backgroundColor: "#0d9488",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
  },
  bookNowBtnSelected: {
    backgroundColor: "#16a34a",
  },
  bookNowBtnText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
  },

  /* Meta Cards */
  metaCardsContainer: {
    paddingHorizontal: 16,
    marginTop: 14,
    gap: 10,
  },
  locationMetaCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  hoursMetaCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  bioCard: {
    padding: 14,
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  bioCardTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },
  bioCardText: {
    fontSize: 12,
    color: "#475569",
    lineHeight: 18,
  },
  metaIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  metaCardTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  metaCardSub: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 1,
  },

  /* Floating Footer */
  floatingFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingHorizontal: 16,
    paddingTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 8,
  },
  footerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  footerCartBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f0fdfa",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  badgeNumber: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: "#0d9488",
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeNumberText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
  },
  footerCountText: {
    fontSize: 12,
    color: "#64748b",
  },
  footerPriceText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
  },
  floatingBookBtn: {
    backgroundColor: "#0d9488",
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  floatingBookBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },

  /* Zoom Modal */
  zoomModalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  zoomCloseBtn: {
    position: "absolute",
    top: 40,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  fullscreenImage: {
    width: "100%",
    height: "80%",
  },

  /* Live Open/Closed Status Badges & Banners */
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusPillOpen: {
    backgroundColor: "#dcfce7",
  },
  statusPillClosed: {
    backgroundColor: "#fee2e2",
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  closedTopBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    borderBottomWidth: 1,
    borderBottomColor: "#fecaca",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  closedTopBannerTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#991b1b",
  },
  closedTopBannerSub: {
    fontSize: 11,
    color: "#b91c1c",
    marginTop: 1,
  },

  /* VIP Styling & Highlights */
  serviceItemCardVIP: {
    borderColor: "#a855f7",
    borderWidth: 2,
    backgroundColor: "#fdfbfe",
    shadowColor: "#7c3aed",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 6,
  },
  vipTopRibbon: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#7c3aed",
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  vipTopRibbonText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: 0.6,
  },
  vipPopularBadge: {
    backgroundColor: "#7c3aed",
    borderWidth: 1,
    borderColor: "#c084fc",
  },
  cardHeartBtnVIP: {
    backgroundColor: "rgba(124, 58, 237, 0.6)",
  },
  serviceBodyVIP: {
    backgroundColor: "#fdfbfe",
  },
  vipServiceNameText: {
    color: "#4c1d95",
    fontWeight: "800",
    flex: 1,
  },
  vipCrownBadge: {
    backgroundColor: "#ede9fe",
    borderWidth: 1,
    borderColor: "#c084fc",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  vipCrownBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#7c3aed",
  },
  vipServiceDescText: {
    color: "#6b21a8",
  },
  vipHighlightStrip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3e8ff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 6,
    gap: 4,
    borderWidth: 0.5,
    borderColor: "#d8b4fe",
  },
  vipHighlightStripText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#6b21a8",
    flex: 1,
  },
  vipPriceText: {
    color: "#7c3aed",
    fontWeight: "900",
  },
  discountPill: {
    backgroundColor: "#ccfbf1",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  discountPillText: {
    fontSize: 10,
    color: "#0d9488",
    fontWeight: "700",
  },
  vipDeliveryTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3e8ff",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#d8b4fe",
  },
  vipDeliveryTagText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#6b21a8",
  },
  bookNowBtnVIP: {
    backgroundColor: "#7c3aed",
  },
  bookNowBtnVIPSelected: {
    backgroundColor: "#059669",
  },
  vipCategoryCard: {
    borderColor: "#d8b4fe",
    backgroundColor: "#faf5ff",
  },
  vipCategoryCardSelected: {
    backgroundColor: "#7c3aed",
    borderColor: "#7c3aed",
    borderWidth: 1.5,
  },
  vipCategoryLabel: {
    color: "#7c3aed",
    fontWeight: "700",
  },
  vipCategoryLabelSelected: {
    color: "#ffffff",
    fontWeight: "800",
  },
  vipHeaderNoticeBadge: {
    backgroundColor: "#ede9fe",
    borderWidth: 1,
    borderColor: "#c084fc",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginLeft: 8,
  },
  vipHeaderNoticeBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#6b21a8",
  },
});
