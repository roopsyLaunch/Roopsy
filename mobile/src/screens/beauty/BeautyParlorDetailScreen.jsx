import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
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
import { api } from "../../api/client";
import { getSocket } from "../../api/socket";
import { useAuth } from "../../context/AuthContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getCurrentGPSLocation } from "../../services/locationService";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Dynamic categories are derived from actual partner services at runtime

function getServiceImage(service) {
  if (service.images && service.images.length > 0 && service.images[0]) {
    return service.images[0];
  }
  return null;
}

function getServiceDescription(service) {
  if (service.subcategory) return service.subcategory;
  if (service.description) return service.description;
  const n = (service.name || "").toLowerCase();
  if (n.includes("bridal")) return "Complete bridal makeup with hair styling and accessories";
  if (n.includes("party")) return "Glowy & stylish makeup for parties and special events";
  if (n.includes("hair")) return "Professional hair styling, wash & nourishing treatment";
  if (n.includes("facial")) return "Deep cleansing, instant glow & soothing herbal facial";
  if (n.includes("nail")) return "Premium nail care, shaping & trendy polish application";
  return "Premium customized salon service with verified safety standards";
}

function formatDateLabel(isoDate) {
  const d = new Date(isoDate + "T12:00:00");
  const weekday = d.toLocaleDateString(undefined, { weekday: "short" });
  const day = d.toLocaleDateString(undefined, { day: "numeric" });
  return { weekday, day };
}

export function BeautyParlorDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { user, barber: myBarber, favorites, toggleFavorite } = useAuth();
  const { barberId, shopName } = route.params || {};

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  // "all" = show all services; any other value = filter by that category label
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Top Tabs: Shop Visit vs Home Service
  const [isHomeServiceSelected, setIsHomeServiceSelected] = useState(false);

  // Selection States
  const [selectedServiceIds, setSelectedServiceIds] = useState([]);
  const [selectedStaffId, setSelectedStaffId] = useState(null);
  const [dateStr, setDateStr] = useState("");
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [homeAddress, setHomeAddress] = useState(
    user?.address?.line1 ? `${user.address.line1}, ${user.address.city || ""}` : ""
  );
  const [homeLocation, setHomeLocation] = useState(
    user?.address?.lat && user?.address?.lng ? { lat: user.address.lat, lng: user.address.lng } : null
  );

  const [slots, setSlots] = useState([]);
  const [allSlots, setAllSlots] = useState([]);
  const [slotStats, setSlotStats] = useState({ total: 0, booked: 0 });
  const [alternatives, setAlternatives] = useState(null);

  const [altModalVisible, setAltModalVisible] = useState(false);
  const [altModalLoading, setAltModalLoading] = useState(false);
  const [slotAlternatives, setSlotAlternatives] = useState([]);
  const [selectedBookedSlotTime, setSelectedBookedSlotTime] = useState(null);

  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [selectedETA, setSelectedETA] = useState(15);
  const [customETA, setCustomETA] = useState("");
  const [selectedChairIndex, setSelectedChairIndex] = useState(null);

  const [liveSeats, setLiveSeats] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchingLocation, setFetchingLocation] = useState(false);

  const autoFetchHomeServiceLocation = async () => {
    setFetchingLocation(true);
    try {
      const gps = await getCurrentGPSLocation();
      if (gps && gps.lat && gps.lng) {
        setHomeLocation({ lat: gps.lat, lng: gps.lng });
      }
      if (gps && gps.displayName) {
        setHomeAddress(gps.displayName);
      } else {
        Alert.alert("GPS Error", "Failed to retrieve address details for your location.");
      }
    } catch (error) {
      console.warn("Failed to auto-fetch GPS location:", error);
      Alert.alert(
        "Location Access",
        "Could not access your location. Please check if device GPS and location permissions are enabled."
      );
    } finally {
      setFetchingLocation(false);
    }
  };

  const [expandedCategories, setExpandedCategories] = useState({});
  const toggleCategory = (catName) => {
    setExpandedCategories((prev) => ({ ...prev, [catName]: !prev[catName] }));
  };

  const [activeSlide, setActiveSlide] = useState(0);
  const [zoomModalVisible, setZoomModalVisible] = useState(false);
  const [zoomImagesList, setZoomImagesList] = useState([]);
  const [zoomImageIndex, setZoomImageIndex] = useState(0);
  const zoomScrollRef = useRef(null);

  const b = detail?.barber || {};
  const isFollowing = (favorites || []).includes(barberId);
  const rawServices = detail?.services || [];
  const services = useMemo(() => {
    return rawServices.map((s) => ({
      ...s,
      originalPrice: s.originalPrice || s.price || 0,
      discountAmount: s.discountAmount || 0,
    }));
  }, [rawServices]);

  const selectedServices = useMemo(
    () => services.filter((s) => selectedServiceIds.includes(s.id)),
    [services, selectedServiceIds]
  );
  const totalDuration = selectedServices.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
  const totalPrice = selectedServices.reduce((sum, s) => sum + (s.price || 0), 0);
  const homeServiceFee = isHomeServiceSelected ? b.homeServiceFee || 0 : 0;

  const heroImages = useMemo(() => {
    const list = [];
    if (b.shopPosterUrl) list.push(b.shopPosterUrl);
    if (b.gallery && b.gallery.length > 0) list.push(...b.gallery);
    if (list.length === 0) {
      list.push("https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&auto=format&fit=crop&q=80");
    }
    return list;
  }, [b.shopPosterUrl, b.gallery]);

  const shopAvatar = useMemo(() => {
    if (b.shopPosterUrl) return b.shopPosterUrl;
    if (b.gallery && b.gallery.length > 0) return b.gallery[0];
    return "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400&auto=format&fit=crop&q=80";
  }, [b.shopPosterUrl, b.gallery]);

  // Build active services list (filter by home/shop mode)
  const activeServices = useMemo(() => {
    const hasDedicatedHomeServices = services.some((s) => s.isHomeService);
    return services.filter((s) => {
      if (s.isActive === false) return false;
      if (isHomeServiceSelected) {
        if (!b.offersHomeService) return false;
        if (hasDedicatedHomeServices) return Boolean(s.isHomeService);
        return true;
      } else {
        if (s.isHomeService && hasDedicatedHomeServices && !s.offersShopService) {
          return false;
        }
        return true;
      }
    });
  }, [services, isHomeServiceSelected, b.offersHomeService]);

  // Build dynamic category tabs from actual partner services
  // Each unique category label from the services becomes a tab
  const dynamicCategories = useMemo(() => {
    const seen = new Set();
    const cats = [];
    activeServices.forEach((s) => {
      const label = (s.category && s.category.trim()) || "Other";
      if (!seen.has(label)) {
        seen.add(label);
        cats.push(label);
      }
    });
    return cats;
  }, [activeServices]);

  // Current filtered services for display
  const currentDisplayServices = useMemo(() => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return activeServices.filter(
        (s) =>
          (s.name && s.name.toLowerCase().includes(q)) ||
          (s.category && s.category.toLowerCase().includes(q)) ||
          (s.subcategory && s.subcategory.toLowerCase().includes(q))
      );
    }
    if (selectedCategory === "all" || dynamicCategories.length === 0) {
      return activeServices;
    }
    return activeServices.filter(
      (s) => (s.category && s.category.trim()) === selectedCategory
    );
  }, [activeServices, selectedCategory, dynamicCategories, searchQuery]);

  // Section header label for current view
  const currentSectionTitle = useMemo(() => {
    if (searchQuery.trim()) return "Search Results";
    if (selectedCategory === "all") return "All Services";
    return selectedCategory;
  }, [selectedCategory, searchQuery]);

  const loc = b.location;
  function openMap() {
    if (loc?.lat != null && loc?.lng != null) {
      const q = `${loc.lat},${loc.lng}`;
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`);
    } else if (b.address?.line1 || b.address?.city) {
      const q = [b.address.line1, b.address.city, b.address.pincode].filter(Boolean).join(", ");
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`);
    }
  }

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const loadBarber = useCallback(async () => {
    try {
      const res = await api.get(`/barbers/${barberId}?t=${Date.now()}`);
      setDetail(res.data);
      if (res.data?.barber?.seats) {
        setLiveSeats(res.data.barber.seats);
      }
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.error || e.message);
    }
  }, [barberId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadBarber();
    setRefreshing(false);
  }, [loadBarber]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadBarber();
      setLoading(false);
    })();

    const socket = getSocket();
    if (socket) {
      socket.emit("joinBarberRoom", barberId);
      const handleSlotsUpdated = (data) => {
        if (data && data.seats) setLiveSeats(data.seats);
        setRefreshTrigger((prev) => prev + 1);
      };
      socket.on("slotsUpdated", handleSlotsUpdated);
      return () => {
        socket.emit("leaveBarberRoom", barberId);
        socket.off("slotsUpdated", handleSlotsUpdated);
      };
    }
  }, [barberId, loadBarber]);

  const nextDates = useMemo(() => {
    const out = [];
    const today = new Date();
    let daysToShow = detail?.maxAdvanceBookingDays || 1;
    if (isHomeServiceSelected && daysToShow < 14) {
      daysToShow = 14;
    }
    for (let i = 0; i < daysToShow; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      out.push(`${y}-${m}-${day}`);
    }
    return out;
  }, [isHomeServiceSelected, detail?.maxAdvanceBookingDays]);

  const isToday = useMemo(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    return dateStr === `${y}-${m}-${d}`;
  }, [dateStr]);

  const todayWorkingHoursText = useMemo(() => {
    const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const fullDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const now = new Date();
    const todayKey = days[now.getDay()];
    const fullKey = fullDays[now.getDay()];
    const wh = b?.workingHours ? (b.workingHours[todayKey] || b.workingHours[fullKey]) : null;
    if (!wh) {
      return `${b?.dailyOpenTime || "09:00 AM"} - ${b?.dailyCloseTime || "09:00 PM"}`;
    }
    if (wh.isClosed || wh.open === false) {
      return "Closed Today (Weekly Off)";
    }
    const open = (typeof wh.open === "string" ? wh.open : wh.start) || b?.dailyOpenTime || "09:00 AM";
    const close = (typeof wh.close === "string" ? wh.close : wh.end) || b?.dailyCloseTime || "09:00 PM";
    return `${open} - ${close}`;
  }, [b]);

  useEffect(() => {
    if (nextDates.length) {
      if (!dateStr || !nextDates.includes(dateStr)) setDateStr(nextDates[0]);
    }
  }, [nextDates, dateStr]);

  useEffect(() => {
    setSelectedSlot(null);
  }, [dateStr, selectedServiceIds]);

  // Fetch slots availability
  useEffect(() => {
    if (!barberId || selectedServiceIds.length === 0 || !dateStr) return;
    let cancelled = false;
    (async () => {
      setSlotsLoading(true);
      try {
        const res = await api.get("/bookings/availability", {
          params: { barberId, serviceIds: selectedServiceIds.join(","), date: dateStr },
        });
        if (!cancelled) {
          setSlots(res.data.slots || []);
          setAllSlots(res.data.allSlots || []);
          setSlotStats({
            total: res.data.totalSlotsForDay || 0,
            booked: res.data.bookedSlotsForDay || 0,
          });
          setAlternatives(res.data.recommendations || null);
        }
      } catch (e) {
        if (!cancelled) {
          setSlots([]);
          setAllSlots([]);
          setSlotStats({ total: 0, booked: 0 });
          setAlternatives(null);
        }
      } finally {
        if (!cancelled) setSlotsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [barberId, selectedServiceIds, dateStr, refreshTrigger]);

  const isOwnShop = useMemo(() => {
    const myId = (user?._id || user?.id)?.toString();
    const ownerUserId = (b.userId || b.user?.id || (typeof b.userId === "object" ? b.userId?._id : null))?.toString();
    const isOwnerUser = Boolean(myId && ownerUserId && myId === ownerUserId);
    const isOwnerBarber = Boolean(myBarber?._id && barberId && myBarber._id.toString() === barberId.toString());
    return isOwnerUser || isOwnerBarber;
  }, [b, user, myBarber, barberId]);

  function handleBookIntent(service) {
    if (isOwnShop) {
      return Alert.alert(
        "Action Not Allowed",
        "You cannot book an appointment at your own parlor. You can explore and book services from other parlors."
      );
    }
    if (b?.isShopOpen === false) {
      return Alert.alert(
        "Shop Currently Closed",
        "This beauty parlor is currently closed. Bookings are only accepted when the shop is open."
      );
    }
    if (service && !selectedServiceIds.includes(service.id)) {
      setSelectedServiceIds([service.id]);
    }
    if (!selectedETA) {
      setSelectedETA(15);
    }
    if (!isHomeServiceSelected && isToday) {
      setSelectedSlot(null);
    }
    setConfirmModalVisible(true);
    if (isHomeServiceSelected && !homeAddress) {
      autoFetchHomeServiceLocation();
    }
  }

  function toggleService(service) {
    setSelectedServiceIds((prev) => {
      if (prev.includes(service.id)) return prev.filter((sid) => sid !== service.id);
      return [...prev, service.id];
    });
  }

  async function executeBooking() {
    if (isOwnShop) {
      Alert.alert(
        "Action Not Allowed",
        "You cannot book an appointment at your own parlor. You can explore and book services from other parlors."
      );
      return;
    }
    if (b?.isShopOpen === false) {
      Alert.alert(
        "Shop Currently Closed",
        "This beauty parlor is currently closed. Bookings are only accepted when the shop is open."
      );
      return;
    }
    if (selectedServiceIds.length === 0) return;
    if (isHomeServiceSelected && !homeAddress?.trim() && !homeLocation) {
      Alert.alert("Address Required", "Please enter your home address or tap 'Auto Address' so our stylist can navigate to your location.");
      return;
    }
    if (!isHomeServiceSelected && liveSeats.length > 0 && selectedChairIndex === null) {
      Alert.alert("Chair Selection Required", "Please select your preferred styling chair to complete your booking.");
      return;
    }
    if (isHomeServiceSelected && !b.offersHomeService) {
      Alert.alert(
        "Home Service Unavailable",
        "Home Service is currently disabled by this salon. Please schedule a shop visit."
      );
      return;
    }

    const chosenChair = liveSeats.find((s) => s.index === selectedChairIndex);
    const isChairOccupied = !isHomeServiceSelected && isToday && chosenChair && !chosenChair.isAvailable;

    if (!isToday && !selectedSlot) {
      Alert.alert("Time Slot Required", "Please select an available time slot for the selected booking date.");
      return;
    }

    if (isToday && !selectedSlot && selectedETA === null && !isHomeServiceSelected && !isChairOccupied) {
      Alert.alert("Time Selection Required", "Please select your estimated arrival time (ETA).");
      return;
    }

    let startTimeIso;
    if (isChairOccupied) {
      // Chair is occupied: start time is automatically when this chair becomes free!
      startTimeIso = chosenChair.nextAvailableAt || chosenChair.occupiedUntil || new Date(Date.now() + (chosenChair.freeInMinutes || 15) * 60000).toISOString();
    } else if (selectedSlot) {
      startTimeIso = selectedSlot;
    } else if (isToday && selectedETA !== null && !isHomeServiceSelected) {
      startTimeIso = new Date(Date.now() + selectedETA * 60000).toISOString();
    } else if (slots.length > 0) {
      startTimeIso = slots[0];
    } else {
      startTimeIso = new Date(Date.now() + 15 * 60000).toISOString();
    }

    setBookingBusy(true);

    try {
      const bookingPayload = {
        barberId,
        serviceIds: selectedServiceIds,
        staffId: selectedStaffId,
        startTime: startTimeIso,
        notes: "",
        isHomeService: isHomeServiceSelected,
        homeServiceAddress: (homeAddress || "").trim() || undefined,
        homeServiceLocation: homeLocation || undefined,
        customerETA: !isHomeServiceSelected && !isChairOccupied && selectedETA !== null ? selectedETA : undefined,
        seatIndex: !isHomeServiceSelected && selectedChairIndex !== null ? selectedChairIndex : undefined,
      };

      try {
        await api.post("/bookings", bookingPayload);
      } catch (postErr) {
        const errMsg = String(postErr?.response?.data?.error || "");
        if (errMsg.toLowerCase().includes("outside working hours")) {
          // Fallback: If connecting to legacy UTC server, shift +5.5 hours to align with server UTC evaluation
          const istShiftedIso = new Date(new Date(startTimeIso).getTime() + (5.5 * 3600000)).toISOString();
          await api.post("/bookings", {
            ...bookingPayload,
            startTime: istShiftedIso,
          });
        } else {
          throw postErr;
        }
      }

      setConfirmModalVisible(false);
      const turnTimeFormatted = new Date(startTimeIso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
      Alert.alert(
        "Booking Confirmed 🎉",
        isChairOccupied
          ? `Your appointment for Chair ${selectedChairIndex + 1} has been booked! Your turn will start around ${turnTimeFormatted}.`
          : "Your appointment has been successfully scheduled! You can review details in the bookings panel.",
        [
          {
            text: "View Bookings",
            onPress: () => navigation.getParent()?.navigate("MyBookings"),
          },
        ]
      );
    } catch (e) {
      const err = e?.response?.data?.error;
      if (e?.response?.status === 409) {
        setConfirmModalVisible(false);
        Alert.alert(
          "Time Slot Unavailable",
          (typeof err === "string" ? err : "This time slot is no longer available.") +
            "\n\nLet's check alternative options for you.",
          [{ text: "View Alternatives", onPress: () => handleBookedSlotPress(selectedSlot) }]
        );
      } else {
        Alert.alert(
          "Booking Request Failed",
          typeof err === "string" ? err : "An error occurred while confirming your appointment. Please try again."
        );
      }
    } finally {
      setBookingBusy(false);
    }
  }

  async function handleBookedSlotPress(iso) {
    setSelectedBookedSlotTime(iso);
    setAltModalVisible(true);
    setAltModalLoading(true);
    try {
      const res = await api.get("/bookings/slot-alternatives", {
        params: { barberId, serviceIds: selectedServiceIds.join(","), time: iso },
      });
      setSlotAlternatives(res.data.recommendations || []);
    } catch (e) {
      setSlotAlternatives([]);
    } finally {
      setAltModalLoading(false);
    }
  }

  if (loading || !detail) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#db2777" size="large" />
      </View>
    );
  }

  const addressDisplay = [b.address?.line1, b.address?.city].filter(Boolean).join(", ") || "Main Market, Jamunaha";

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
            {b.shopName || shopName || "Glow Beauty Salon"}
          </Text>

          <View style={styles.verifiedRow}>
            <Ionicons name="checkmark-circle" size={14} color="#16a34a" />
            <Text style={styles.verifiedText}>Verified Partner</Text>
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
          onPress={() => toggleFavorite(barberId)}
        >
          <Ionicons name={isFollowing ? "heart" : "heart-outline"} size={16} color={isFollowing ? "#ffffff" : "#e11d48"} style={{ marginRight: 5 }} />
          <Text style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>
            {isFollowing ? "Favourited" : "Favourite"}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={{ paddingBottom: selectedServiceIds.length > 0 ? 140 : 60 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#db2777" />}
      >
        {/* ================= SERVICE DELIVERY MODE TOGGLE (SHOP VISIT VS HOME SERVICE) ================= */}
        <View style={styles.serviceModeToggleCard}>
          <View style={styles.serviceModeHeaderRow}>
            <View style={styles.serviceModeTitleRow}>
              <Ionicons name="sparkles" size={15} color="#db2777" style={{ marginRight: 6 }} />
              <Text style={styles.serviceModeTitle}>Service Delivery Mode</Text>
            </View>
            <View style={[styles.serviceModeStatusBadge, !b.offersHomeService && styles.serviceModeStatusBadgeShopOnly]}>
              <Text style={[styles.serviceModeStatusText, !b.offersHomeService && styles.serviceModeStatusTextShopOnly]}>
                {b.offersHomeService ? "2 Modes Available" : "Shop Visit Only"}
              </Text>
            </View>
          </View>

          <View style={styles.serviceModePillRow}>
            {/* Shop Visit Pill */}
            <Pressable
              style={[
                styles.serviceModePill,
                !isHomeServiceSelected && styles.serviceModePillActive
              ]}
              onPress={() => setIsHomeServiceSelected(false)}
            >
              <Ionicons
                name="storefront-outline"
                size={18}
                color={!isHomeServiceSelected ? "#ffffff" : "#475569"}
                style={{ marginRight: 8 }}
              />
              <View>
                <Text style={[styles.serviceModePillText, !isHomeServiceSelected && styles.serviceModePillTextActive]}>
                  Shop Visit
                </Text>
                <Text style={[styles.serviceModePillSub, !isHomeServiceSelected && styles.serviceModePillSubActive]}>
                  Visit Parlor
                </Text>
              </View>
            </Pressable>

            {/* Home Service Pill */}
            <Pressable
              style={[
                styles.serviceModePill,
                isHomeServiceSelected && styles.serviceModePillActive,
                !b.offersHomeService && styles.serviceModePillDisabled
              ]}
              onPress={() => {
                if (!b.offersHomeService) {
                  return Alert.alert(
                    "Home Service Unavailable",
                    "This beauty parlor currently only accepts bookings at the shop. Doorstep home visits are not offered."
                  );
                }
                setIsHomeServiceSelected(true);
              }}
            >
              <Ionicons
                name="home-outline"
                size={18}
                color={isHomeServiceSelected ? "#ffffff" : b.offersHomeService ? "#475569" : "#94a3b8"}
                style={{ marginRight: 8 }}
              />
              <View>
                <Text style={[
                  styles.serviceModePillText,
                  isHomeServiceSelected && styles.serviceModePillTextActive,
                  !b.offersHomeService && { color: "#94a3b8" }
                ]}>
                  Home Service
                </Text>
                <Text style={[
                  styles.serviceModePillSub,
                  isHomeServiceSelected && styles.serviceModePillSubActive,
                  !b.offersHomeService && { color: "#cbd5e1" }
                ]}>
                  {b.offersHomeService ? (Number(b.homeServiceFee) > 0 ? `+₹${b.homeServiceFee} Visit Fee` : "Free Visit") : "Not Offered"}
                </Text>
              </View>
            </Pressable>
          </View>

          {/* Mode explanation banner */}
          <View style={[styles.modeInfoBanner, isHomeServiceSelected ? styles.modeInfoBannerHome : styles.modeInfoBannerShop]}>
            <Ionicons
              name={isHomeServiceSelected ? "home" : "storefront"}
              size={14}
              color={isHomeServiceSelected ? "#db2777" : "#2563eb"}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.modeInfoBannerText, { color: isHomeServiceSelected ? "#9d174d" : "#1e40af" }]}>
              {isHomeServiceSelected
                ? `🏡 Home Service Mode: Beautician visits your address${Number(b.homeServiceFee) > 0 ? ` (+₹${b.homeServiceFee} visit fee)` : ""}`
                : "🏪 Shop Visit Mode: You will visit the parlor for your scheduled appointment"}
            </Text>
          </View>
        </View>

        {/* ================= SEARCH & FILTER BAR ================= */}
        <View style={styles.searchBarWrapper}>
          <View style={styles.searchInputCard}>
            <Ionicons name="search-outline" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search services..."
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
                "Filter Options",
                "Select service mode or sorting",
                [
                  { text: "Shop Visit", onPress: () => setIsHomeServiceSelected(false) },
                  { text: "Home Service", onPress: () => setIsHomeServiceSelected(true) },
                  { text: "Clear Filter", style: "cancel" },
                ]
              );
            }}
          >
            <Ionicons name="options-outline" size={20} color="#0f172a" />
          </Pressable>
        </View>

        {/* ================= DYNAMIC CATEGORY TABS ================= */}
        {(dynamicCategories.length > 1 || (dynamicCategories.length === 1 && activeServices.length > 0)) && (
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
                  color={selectedCategory === "all" ? "#db2777" : "#0f172a"}
                />
              </View>
              <Text style={[styles.categoryLabel, selectedCategory === "all" && styles.categoryLabelSelected]}>
                All
              </Text>
            </Pressable>

            {/* Dynamic tabs from partner's actual service categories */}
            {dynamicCategories.map((catLabel) => {
              const isSelected = selectedCategory === catLabel;
              return (
                <Pressable
                  key={catLabel}
                  style={[styles.categoryCard, isSelected && styles.categoryCardSelected]}
                  onPress={() => {
                    setSelectedCategory(catLabel);
                    setSearchQuery("");
                  }}
                >
                  <View style={styles.categoryIconWrap}>
                    <Ionicons
                      name="sparkles-outline"
                      size={22}
                      color={isSelected ? "#db2777" : "#0f172a"}
                    />
                  </View>
                  <Text style={[styles.categoryLabel, isSelected && styles.categoryLabelSelected]}>
                    {catLabel}
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
              <Text style={styles.specialOfferText}>✨ Special Offer</Text>
            </View>
            <Text style={styles.bannerHeading}>Get Glammed for Your Special Moments</Text>
            <Text style={styles.bannerSubheading}>Professional Makeup & Beauty Services</Text>

            <Pressable
              style={styles.bannerActionBtn}
              onPress={() => {
                if (currentDisplayServices.length > 0) {
                  handleBookIntent(currentDisplayServices[0]);
                } else {
                  setConfirmModalVisible(true);
                }
              }}
            >
              <Text style={styles.bannerActionBtnText}>Book Now →</Text>
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
            <View style={styles.sectionIconWrap}>
              <Ionicons name="sparkles-outline" size={20} color="#db2777" />
            </View>
            <Text style={styles.sectionMainTitle}>{currentSectionTitle}</Text>
          </View>

          {selectedCategory !== "all" && activeServices.length > currentDisplayServices.length && (
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
            <Ionicons name="sparkles-outline" size={36} color="#e2afd4" />
            <Text style={styles.noServicesTitle}>
              {searchQuery.trim() ? "No services found" : "No services added yet"}
            </Text>
            <Text style={styles.noServicesSub}>
              {searchQuery.trim()
                ? "Try searching with a different keyword"
                : "This salon hasn't added services in this category yet"}
            </Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalServicesScroll}
          >
            {currentDisplayServices.map((service, idx) => {
              const isSelected = selectedServiceIds.includes(service.id);
              const badgeLabel = idx === 0 ? "🔥 Popular" : idx === 1 ? "⭐ Trending" : "✨ Recommended";
              const badgeColor = idx === 0 ? "#db2777" : idx === 1 ? "#7c3aed" : "#0284c7";

              return (
                <Pressable
                  key={service.id}
                  style={[styles.serviceItemCard, isSelected && styles.serviceItemCardSelected]}
                  onPress={() => toggleService(service)}
                  activeOpacity={0.9}
                >
                  {/* Service Image with Badges */}
                  <View style={styles.serviceImageContainer}>
                    {(() => {
                      const imgUri = getServiceImage(service);
                      return imgUri ? (
                        <Image
                          source={{ uri: imgUri }}
                          style={styles.serviceImage}
                        />
                      ) : (
                        <View style={[styles.serviceImage, styles.emptyServiceImagePlaceholder]}>
                          <Ionicons name="sparkles-outline" size={32} color="#c4b5fd" />
                          <Text style={styles.emptyServiceImageText}>{service.name || "Service"}</Text>
                        </View>
                      );
                    })()}

                    {/* Top Left Pill Badge */}
                    <View style={[styles.popularBadge, { backgroundColor: badgeColor }]}>
                      <Text style={styles.popularBadgeText}>{badgeLabel}</Text>
                    </View>

                    {/* Top Right Heart / Checkmark Favorite */}
                    <Pressable
                      style={[styles.cardHeartBtn, isSelected && styles.cardHeartBtnSelected]}
                      onPress={() => toggleService(service)}
                    >
                      <Ionicons
                        name={isSelected ? "checkmark-circle" : "checkmark-circle-outline"}
                        size={22}
                        color={isSelected ? "#db2777" : "#ffffff"}
                      />
                    </Pressable>
                  </View>

                  {/* Service Details */}
                  <View style={styles.serviceBody}>
                    <Text style={styles.serviceNameText} numberOfLines={1}>
                      {service.name}
                    </Text>
                    <Text style={styles.serviceDescText} numberOfLines={2}>
                      {getServiceDescription(service)}
                    </Text>

                    {/* Price, Duration & Book Now */}
                    <View style={styles.serviceFooterRow}>
                      <View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text style={styles.servicePriceText}>₹{service.price}</Text>
                          {service.originalPrice > service.price && (
                            <Text style={styles.originalPriceStrike}>₹{service.originalPrice}</Text>
                          )}
                          {service.originalPrice > service.price && (
                            <View style={{ backgroundColor: "#fce7f3", paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                              <Text style={{ fontSize: 10, color: "#db2777", fontWeight: "700" }}>
                                {Math.round(((service.originalPrice - service.price) / service.originalPrice) * 100)}% OFF
                              </Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.durationRow}>
                          <Ionicons name="time-outline" size={13} color="#64748b" style={{ marginRight: 3 }} />
                          <Text style={styles.durationText}>{service.durationMinutes} mins</Text>
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 }}>
                          <View style={[styles.serviceCardModeBadge, isHomeServiceSelected ? styles.serviceCardModeBadgeHome : styles.serviceCardModeBadgeShop]}>
                            <Ionicons
                              name={isHomeServiceSelected ? "home" : "storefront"}
                              size={10}
                              color={isHomeServiceSelected ? "#db2777" : "#2563eb"}
                              style={{ marginRight: 2 }}
                            />
                            <Text style={[styles.serviceCardModeBadgeText, { color: isHomeServiceSelected ? "#db2777" : "#2563eb" }]}>
                              {isHomeServiceSelected ? "Home Service" : "Shop Visit"}
                            </Text>
                          </View>
                          {b.offersHomeService && !isHomeServiceSelected && (
                            <View style={styles.serviceCardHomeEligible}>
                              <Text style={styles.serviceCardHomeEligibleText}>🏡 Home Avail.</Text>
                            </View>
                          )}
                        </View>
                      </View>

                      <Pressable
                        style={[styles.bookNowBtn, isSelected && styles.bookNowBtnSelected]}
                        onPress={() => toggleService(service)}
                      >
                        <Text style={styles.bookNowBtnText}>{isSelected ? "Selected ✓" : "Select"}</Text>
                      </Pressable>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* ================= LIVE CHAIRS STATUS ================= */}
        {liveSeats.length > 0 && !isHomeServiceSelected && (
          <View style={styles.liveSeatsCard}>
            <View style={styles.liveSeatsHeader}>
              <Text style={styles.liveSeatsTitle}>Live Styling Chairs</Text>
              <View style={styles.liveBadgeIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveBadgeText}>LIVE</Text>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 6 }}>
              {liveSeats.map((seat) => {
                const available = seat.isAvailable !== false;
                const isChosen = selectedChairIndex === seat.index;
                const freeInMins = seat.freeInMinutes || 0;
                const nextTimeStr = seat.nextAvailableAt
                  ? new Date(seat.nextAvailableAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
                  : "";
                return (
                  <Pressable
                    key={seat.index}
                    onPress={() => setSelectedChairIndex(seat.index)}
                    style={[
                      styles.chairBox,
                      available ? styles.chairAvailable : styles.chairOccupied,
                      isChosen && styles.chairChosen,
                    ]}
                  >
                    <Ionicons name="person" size={20} color={available ? "#16a34a" : "#ea580c"} />
                    <Text style={[styles.chairLabel, { color: available ? "#16a34a" : "#ea580c" }]}>
                      Chair {seat.index + 1}
                    </Text>
                    <Text style={[styles.chairStatusText, { color: available ? "#16a34a" : "#ea580c" }]}>
                      {available ? "Available" : `Free in ${freeInMins}m`}
                    </Text>
                    {!available && nextTimeStr ? (
                      <Text style={styles.chairFreeAtSubText}>
                        at {nextTimeStr}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ================= SHOP HOURS & LOCATION ================= */}
        <View style={styles.metaCardsContainer}>
          <Pressable onPress={openMap} style={styles.locationMetaCard}>
            <View style={styles.metaIconWrap}>
              <Ionicons name="location" size={20} color="#db2777" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.metaCardTitle}>Shop Location</Text>
              <Text style={styles.metaCardSub} numberOfLines={1}>
                {addressDisplay}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
          </Pressable>

          <View style={styles.hoursMetaCard}>
            <View style={styles.metaIconWrap}>
              <Ionicons name="time" size={20} color="#16a34a" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.metaCardTitle}>Shop Status</Text>
              <Text style={[styles.metaCardSub, { color: b.isShopOpen ? "#16a34a" : "#ef4444", fontWeight: "600" }]}>
                {b.isShopOpen ? "Open for Bookings" : "Closed Now"}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ================= FLOATING FOOTER SUMMARY BAR ================= */}
      {selectedServiceIds.length > 0 && (
        <View style={[styles.floatingFooter, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          <View style={styles.footerLeft}>
            <View style={styles.footerCartBadge}>
              <Ionicons name="bag-check" size={20} color="#db2777" />
              <View style={styles.badgeNumber}>
                <Text style={styles.badgeNumberText}>{selectedServiceIds.length}</Text>
              </View>
            </View>
            <View style={{ marginLeft: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={styles.footerCountText}>{selectedServiceIds.length} Service Selected</Text>
                <View style={[styles.footerModeTag, isHomeServiceSelected ? styles.footerModeTagHome : styles.footerModeTagShop]}>
                  <Ionicons name={isHomeServiceSelected ? "home" : "storefront"} size={10} color={isHomeServiceSelected ? "#db2777" : "#2563eb"} />
                  <Text style={[styles.footerModeTagText, { color: isHomeServiceSelected ? "#db2777" : "#2563eb" }]}>
                    {isHomeServiceSelected ? "Home" : "Shop"}
                  </Text>
                </View>
              </View>
              <Text style={styles.footerPriceText}>
                ₹{totalPrice + homeServiceFee}
                {isHomeServiceSelected && homeServiceFee > 0 ? (
                  <Text style={{ fontSize: 11, fontWeight: "500", color: "#64748b" }}> (incl. ₹{homeServiceFee} visit fee)</Text>
                ) : null}
              </Text>
            </View>
          </View>

          <Pressable
            style={[styles.floatingBookBtn, (bookingBusy || isOwnShop) && { opacity: 0.85, backgroundColor: isOwnShop ? "#64748b" : "#db2777" }]}
            onPress={() => {
              if (isOwnShop) {
                return Alert.alert(
                  "Action Not Allowed",
                  "You cannot book an appointment at your own parlor. You can explore and book services from other parlors."
                );
              }
              if (b?.isShopOpen === false) {
                return Alert.alert(
                  "Shop Currently Closed",
                  "This beauty parlor is currently closed. Bookings are only accepted when the shop is open."
                );
              }
              if (!selectedETA) setSelectedETA(15);
              if (!isHomeServiceSelected && isToday) setSelectedSlot(null);
              if (!isHomeServiceSelected && liveSeats.length > 0 && selectedChairIndex === null) {
                const firstAvail = liveSeats.find((s) => s.isAvailable !== false);
                setSelectedChairIndex(firstAvail ? firstAvail.index : liveSeats[0].index);
              }
              setConfirmModalVisible(true);
            }}
            disabled={bookingBusy}
          >
            {bookingBusy ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.floatingBookBtnText}>
                {isOwnShop ? "Your Own Parlor" : "Book Appointment →"}
              </Text>
            )}
          </Pressable>
        </View>
      )}

      {/* ================= BOOKING & SLOT SELECTION MODAL ================= */}
      <Modal visible={confirmModalVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalHeaderTitle}>Schedule Appointment</Text>
                <Text style={styles.modalHeaderSub}>
                  {b.shopName || shopName} • {selectedServiceIds.length} Service(s)
                </Text>
              </View>
              <Pressable onPress={() => setConfirmModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color="#475569" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              {/* Prominent Service Delivery Mode Banner */}
              <View style={[styles.modalModeBanner, isHomeServiceSelected ? styles.modalModeBannerHome : styles.modalModeBannerShop]}>
                <Ionicons
                  name={isHomeServiceSelected ? "home" : "storefront"}
                  size={20}
                  color={isHomeServiceSelected ? "#db2777" : "#2563eb"}
                  style={{ marginRight: 10 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalModeBannerTitle, { color: isHomeServiceSelected ? "#9d174d" : "#1e40af" }]}>
                    {isHomeServiceSelected ? "🏡 Home Service Booking (Doorstep Visit)" : "🏪 Shop Visit Booking (At Parlor)"}
                  </Text>
                  <Text style={[styles.modalModeBannerSub, { color: isHomeServiceSelected ? "#be185d" : "#3b82f6" }]}>
                    {isHomeServiceSelected
                      ? `Beautician will visit your home • ${homeServiceFee > 0 ? `+₹${homeServiceFee} visit fee` : "Doorstep service"}`
                      : "You will visit the beauty parlor at your scheduled time"}
                  </Text>
                </View>
              </View>

              {/* Date Selection */}
              <Text style={styles.modalSectionLabel}>Select Date</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {nextDates.map((iso) => {
                  const isSelected = dateStr === iso;
                  const { weekday, day } = formatDateLabel(iso);
                  return (
                    <Pressable
                      key={iso}
                      style={[styles.datePill, isSelected && styles.datePillActive]}
                      onPress={() => setDateStr(iso)}
                    >
                      <Text style={[styles.dateWeekday, isSelected && styles.dateTextActive]}>{weekday}</Text>
                      <Text style={[styles.dateDay, isSelected && styles.dateTextActive]}>{day}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* Chair selection - Placed right after date */}
              {!isHomeServiceSelected && liveSeats.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={styles.modalSectionLabel}>Choose Styling Chair</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 4 }}>
                    {liveSeats.map((seat) => {
                      const isChosen = selectedChairIndex === seat.index;
                      const isAvail = seat.isAvailable !== false;
                      const freeInMins = seat.freeInMinutes || 0;
                      return (
                        <Pressable
                          key={seat.index}
                          style={[
                            styles.modalChairOption,
                            isChosen && styles.modalChairOptionActive,
                            !isAvail && !isChosen && { borderColor: "#fdba74", backgroundColor: "#fff7ed" }
                          ]}
                          onPress={() => setSelectedChairIndex(seat.index)}
                        >
                          <Ionicons
                            name="person"
                            size={16}
                            color={isChosen ? "#ffffff" : isAvail ? "#16a34a" : "#ea580c"}
                          />
                          <View style={{ marginLeft: 6 }}>
                            <Text style={[styles.modalChairOptionText, isChosen && { color: "#ffffff" }]}>
                              Chair {seat.index + 1}
                            </Text>
                            <Text style={[
                              styles.modalChairTag,
                              isChosen ? { color: "#fce7f3" } : isAvail ? { color: "#16a34a" } : { color: "#ea580c" }
                            ]}>
                              {isAvail ? "Vacant" : `Free in ${freeInMins}m`}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* Arrival ETA selection for Shop Visit on today - ONLY if chair is available */}
              {!isHomeServiceSelected && isToday && (() => {
                const modalChosenChair = liveSeats.find((s) => s.index === selectedChairIndex);
                const isOccupied = modalChosenChair && modalChosenChair.isAvailable === false;
                if (isOccupied) {
                  const freeTimeFormatted = modalChosenChair.nextAvailableAt || modalChosenChair.occupiedUntil
                    ? new Date(modalChosenChair.nextAvailableAt || modalChosenChair.occupiedUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
                    : "";
                  return (
                    <View style={styles.chairQueueNoticeBox}>
                      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                        <Ionicons name="time" size={20} color="#ea580c" style={{ marginRight: 8 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.chairQueueNoticeTitle}>
                            Chair {modalChosenChair.index + 1} is currently booked
                          </Text>
                          <Text style={styles.chairQueueNoticeSub}>
                            Next turn in ~{modalChosenChair.freeInMinutes || 15} mins {freeTimeFormatted ? `(around ${freeTimeFormatted})` : ""}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.chairQueueBadge}>
                        <Ionicons name="checkmark-circle" size={14} color="#16a34a" style={{ marginRight: 4 }} />
                        <Text style={styles.chairQueueBadgeText}>
                          Your turn will automatically start when the chair is free. No arrival ETA needed!
                        </Text>
                      </View>
                    </View>
                  );
                }
                return (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={styles.modalSectionLabel}>Immediate Walk-in (ETA)</Text>
                    <View style={styles.etaOptionsRow}>
                      {[5, 10, 15, 30].map((mins) => {
                        const isActive = selectedETA === mins;
                        return (
                          <Pressable
                            key={mins}
                            style={[styles.etaBtn, isActive && styles.etaBtnActive]}
                            onPress={() => {
                              setSelectedETA(mins);
                              setSelectedSlot(null);
                              setCustomETA("");
                            }}
                          >
                            <Text style={[styles.etaBtnText, isActive && styles.etaBtnTextActive]}>{mins} mins</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                );
              })()}

              {/* Time Slots Section (Only for Home Service or non-today dates) */}
              {(isHomeServiceSelected || !isToday) && (
                <View style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <Text style={styles.modalSectionLabel}>Available Time Slots</Text>
                    {slotsLoading && <ActivityIndicator size="small" color="#db2777" />}
                  </View>

                  {slotsLoading ? (
                    <View style={{ paddingVertical: 12, alignItems: "center" }}>
                      <ActivityIndicator size="small" color="#db2777" />
                      <Text style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Checking available slots...</Text>
                    </View>
                  ) : slots.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: "row" }}>
                      {slots.map((sIso) => {
                        const isSel = selectedSlot === sIso;
                        const timeStr = new Date(sIso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                        return (
                          <Pressable
                            key={sIso}
                            style={[
                              styles.slotPill,
                              isSel && styles.slotPillActive
                            ]}
                            onPress={() => {
                              setSelectedSlot(sIso);
                              setSelectedETA(null);
                            }}
                          >
                            <Ionicons name="time-outline" size={13} color={isSel ? "#ffffff" : "#db2777"} style={{ marginRight: 4 }} />
                            <Text style={[styles.slotPillText, isSel && styles.slotPillTextActive]}>{timeStr}</Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  ) : (
                    <View style={styles.noSlotsBox}>
                      <Ionicons name="alert-circle-outline" size={18} color="#e11d48" style={{ marginRight: 6 }} />
                      <Text style={styles.noSlotsText}>
                        No slots available on this date. Shop may be closed or fully booked.
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Customer Address Input & Auto Address (GPS) Option */}
              <View style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <Text style={styles.modalSectionLabel}>
                    {isHomeServiceSelected ? "Service Address (Required)" : "Your Address / Location (Optional)"}
                  </Text>
                  <Pressable
                    onPress={autoFetchHomeServiceLocation}
                    style={({ pressed }) => [
                      {
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: "#fdf2f8",
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: "#fbcfe8",
                      },
                      pressed && { opacity: 0.7 }
                    ]}
                    disabled={fetchingLocation}
                  >
                    {fetchingLocation ? (
                      <ActivityIndicator size="small" color="#db2777" style={{ marginRight: 4 }} />
                    ) : (
                      <Ionicons name="locate" size={14} color="#db2777" style={{ marginRight: 4 }} />
                    )}
                    <Text style={{ fontSize: 12, color: "#db2777", fontWeight: "700" }}>
                      {fetchingLocation ? "Locating..." : "Auto Address"}
                    </Text>
                  </Pressable>
                </View>
                <TextInput
                  style={styles.addressInput}
                  placeholder={isHomeServiceSelected ? "Enter your complete home address..." : "Enter your address or tap Auto Address..."}
                  placeholderTextColor="#94a3b8"
                  value={homeAddress}
                  onChangeText={setHomeAddress}
                  multiline
                />
              </View>

              {/* Pricing Summary */}
              <View style={styles.billSummaryBox}>
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Service(s) Total</Text>
                  <Text style={styles.billVal}>₹{totalPrice}</Text>
                </View>
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>
                    {isHomeServiceSelected ? "🏡 Home Visit Fee" : "🏪 Shop Visit Fee"}
                  </Text>
                  <Text style={[styles.billVal, !isHomeServiceSelected && { color: "#16a34a" }]}>
                    {isHomeServiceSelected ? `₹${homeServiceFee}` : "₹0 (At Shop)"}
                  </Text>
                </View>
                <View style={[styles.billRow, styles.billTotalRow]}>
                  <Text style={styles.billTotalLabel}>Grand Total</Text>
                  <Text style={styles.billTotalVal}>₹{totalPrice + homeServiceFee}</Text>
                </View>
              </View>

              {/* Confirm Button */}
              <Pressable
                style={[styles.confirmBookingBtn, bookingBusy && { opacity: 0.7 }]}
                onPress={executeBooking}
                disabled={bookingBusy}
              >
                {bookingBusy ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.confirmBookingBtnText}>Confirm Appointment 🎉</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

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
    borderColor: "#fce7f3",
    backgroundColor: "#fdf2f8",
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
    borderColor: "#e11d48",
    backgroundColor: "#fff1f2",
  },
  followingBtn: {
    backgroundColor: "#e11d48",
    borderColor: "#e11d48",
  },
  followBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#e11d48",
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
    width: 72,
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
    backgroundColor: "#fdf2f8",
    borderColor: "#f472b6",
    borderWidth: 1.5,
  },
  categoryIconWrap: {
    marginBottom: 4,
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "#334155",
  },
  categoryLabelSelected: {
    color: "#db2777",
    fontWeight: "700",
  },

  /* Hero Banner */
  bannerContainer: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 20,
    backgroundColor: "#e11d48",
    height: 180,
    flexDirection: "row",
    overflow: "hidden",
    position: "relative",
    shadowColor: "#e11d48",
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
    color: "#db2777",
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
    backgroundColor: "#fdf2f8",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#fbcfe8",
    alignItems: "center",
    justifyContent: "center",
  },
  noServicesTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#be185d",
    marginTop: 10,
  },
  noServicesSub: {
    fontSize: 12,
    color: "#9d174d",
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
  serviceItemCardSelected: {
    borderColor: "#db2777",
    borderWidth: 2,
    backgroundColor: "#fff1f2",
    shadowColor: "#db2777",
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 5,
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
    backgroundColor: "#f5f3ff",
    justifyContent: "center",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#ede9fe",
  },
  emptyServiceImageText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#a78bfa",
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
  cardHeartBtnSelected: {
    backgroundColor: "#ffffff",
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
    backgroundColor: "#db2777",
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

  /* Service Delivery Mode Toggle */
  serviceModeToggleCard: {
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 8,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "#fce7f3",
    shadowColor: "#db2777",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  serviceModeHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  serviceModeTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  serviceModeTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a",
  },
  serviceModeStatusBadge: {
    backgroundColor: "#fdf2f8",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fbcfe8",
  },
  serviceModeStatusBadgeShopOnly: {
    backgroundColor: "#f1f5f9",
    borderColor: "#e2e8f0",
  },
  serviceModeStatusText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#db2777",
  },
  serviceModeStatusTextShopOnly: {
    color: "#64748b",
  },
  serviceModePillRow: {
    flexDirection: "row",
    gap: 10,
  },
  serviceModePill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
  },
  serviceModePillActive: {
    backgroundColor: "#db2777",
    borderColor: "#db2777",
  },
  serviceModePillDisabled: {
    opacity: 0.65,
    backgroundColor: "#f1f5f9",
    borderColor: "#e2e8f0",
  },
  serviceModePillText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
  },
  serviceModePillTextActive: {
    color: "#ffffff",
  },
  serviceModePillSub: {
    fontSize: 10,
    fontWeight: "500",
    color: "#64748b",
    marginTop: 1,
  },
  serviceModePillSubActive: {
    color: "rgba(255,255,255,0.9)",
  },
  modeInfoBanner: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  modeInfoBannerHome: {
    backgroundColor: "#fdf2f8",
    borderWidth: 1,
    borderColor: "#fce7f3",
  },
  modeInfoBannerShop: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#dbeafe",
  },
  modeInfoBannerText: {
    fontSize: 11,
    fontWeight: "600",
    flex: 1,
  },

  /* Service Card Badges */
  serviceCardModeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  serviceCardModeBadgeHome: {
    backgroundColor: "#fdf2f8",
    borderWidth: 1,
    borderColor: "#fbcfe8",
  },
  serviceCardModeBadgeShop: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#dbeafe",
  },
  serviceCardModeBadgeText: {
    fontSize: 9,
    fontWeight: "700",
  },
  serviceCardHomeEligible: {
    backgroundColor: "#faf5ff",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#e9d5ff",
  },
  serviceCardHomeEligibleText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#7e22ce",
  },

  /* Floating Footer Mode Tag */
  footerModeTag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    gap: 2,
  },
  footerModeTagHome: {
    backgroundColor: "#fce7f3",
  },
  footerModeTagShop: {
    backgroundColor: "#eff6ff",
  },
  footerModeTagText: {
    fontSize: 10,
    fontWeight: "700",
  },

  /* Modal Mode Banner */
  modalModeBanner: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 0,
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  modalModeBannerHome: {
    backgroundColor: "#fdf2f8",
    borderColor: "#fbcfe8",
  },
  modalModeBannerShop: {
    backgroundColor: "#eff6ff",
    borderColor: "#dbeafe",
  },
  modalModeBannerTitle: {
    fontSize: 13,
    fontWeight: "800",
  },
  modalModeBannerSub: {
    fontSize: 11,
    marginTop: 2,
  },

  /* Live Seats */
  liveSeatsCard: {
    marginHorizontal: 16,
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  liveSeatsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  liveSeatsTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  liveBadgeIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#dcfce7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#16a34a",
    marginRight: 4,
  },
  liveBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#16a34a",
  },
  chairBox: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    marginRight: 10,
    minWidth: 74,
  },
  chairAvailable: {
    backgroundColor: "#f0fdf4",
    borderColor: "#86efac",
  },
  chairOccupied: {
    backgroundColor: "#fef2f2",
    borderColor: "#fca5a5",
  },
  chairChosen: {
    borderWidth: 2,
    borderColor: "#16a34a",
  },
  chairLabel: {
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  chairStatusText: {
    fontSize: 10,
    fontWeight: "500",
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
    backgroundColor: "#fdf2f8",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  badgeNumber: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: "#db2777",
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
    backgroundColor: "#db2777",
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  floatingBookBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "85%",
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
  },
  modalHeaderSub: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalSectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 8,
  },
  datePill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    marginRight: 8,
    minWidth: 54,
  },
  datePillActive: {
    backgroundColor: "#db2777",
    borderColor: "#db2777",
  },
  dateWeekday: {
    fontSize: 11,
    color: "#64748b",
  },
  dateDay: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
    marginTop: 2,
  },
  dateTextActive: {
    color: "#ffffff",
  },
  etaOptionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  etaBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
  },
  etaBtnActive: {
    backgroundColor: "#db2777",
    borderColor: "#db2777",
  },
  etaBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  etaBtnTextActive: {
    color: "#ffffff",
  },
  slotPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginRight: 8,
  },
  slotPillActive: {
    backgroundColor: "#db2777",
    borderColor: "#db2777",
  },
  slotPillText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  slotPillTextActive: {
    color: "#ffffff",
  },
  noSlotsBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff1f2",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#fecdd3",
  },
  noSlotsText: {
    fontSize: 12,
    color: "#e11d48",
    flex: 1,
    fontWeight: "500",
  },
  modalChairOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginRight: 8,
  },
  modalChairOptionActive: {
    backgroundColor: "#db2777",
    borderColor: "#db2777",
  },
  modalChairOptionText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
    marginLeft: 6,
  },
  modalChairTag: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 1,
  },
  chairFreeAtSubText: {
    fontSize: 9,
    fontWeight: "600",
    color: "#ea580c",
    marginTop: 1,
  },
  chairQueueNoticeBox: {
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fed7aa",
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  chairQueueNoticeTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#9a3412",
  },
  chairQueueNoticeSub: {
    fontSize: 11,
    color: "#c2410c",
    marginTop: 2,
    fontWeight: "500",
  },
  chairQueueBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 8,
  },
  chairQueueBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#065f46",
    flex: 1,
  },
  addressInput: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: "#0f172a",
    backgroundColor: "#f8fafc",
    minHeight: 60,
  },
  billSummaryBox: {
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    padding: 14,
    marginTop: 6,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  billRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  billLabel: {
    fontSize: 12,
    color: "#64748b",
  },
  billVal: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0f172a",
  },
  billTotalRow: {
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 8,
    marginTop: 4,
    marginBottom: 0,
  },
  billTotalLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a",
  },
  billTotalVal: {
    fontSize: 16,
    fontWeight: "800",
    color: "#db2777",
  },
  confirmBookingBtn: {
    backgroundColor: "#db2777",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  confirmBookingBtnText: {
    color: "#ffffff",
    fontSize: 14,
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
});
