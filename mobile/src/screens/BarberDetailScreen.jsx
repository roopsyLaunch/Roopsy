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
  Switch,
  Dimensions,
  RefreshControl,
  Modal,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../api/client";
import { getSocket } from "../api/socket";
import { useAuth } from "../context/AuthContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getCurrentGPSLocation } from "../services/locationService";

const SALON_FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=800&auto=format&fit=crop&q=80",
];

function formatDateLabel(isoDate) {
  const d = new Date(isoDate + "T12:00:00");
  const weekday = d.toLocaleDateString(undefined, { weekday: "short" });
  const day = d.toLocaleDateString(undefined, { day: "numeric" });
  return { weekday, day };
}

export function BarberDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { user, favorites, toggleFavorite } = useAuth();
  const isBarber = user?.role === "barber";
  const { barberId, shopName } = route.params || {};
  
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Selection States
  const [selectedServiceIds, setSelectedServiceIds] = useState([]);
  const [selectedStaffId, setSelectedStaffId] = useState(null);
  const [dateStr, setDateStr] = useState("");
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [isHomeServiceSelected, setIsHomeServiceSelected] = useState(false);
  const [homeAddress, setHomeAddress] = useState(user?.address?.line1 ? `${user.address.line1}, ${user.address.city}` : "");
  const [homeLocation, setHomeLocation] = useState(null);
  const [fetchingLocation, setFetchingLocation] = useState(false);
  
  const [slots, setSlots] = useState([]);
  const [allSlots, setAllSlots] = useState([]);
  const [slotStats, setSlotStats] = useState({ total: 0, booked: 0 });
  const [alternatives, setAlternatives] = useState(null);
  
  const [altModalVisible, setAltModalVisible] = useState(false);
  const [altModalLoading, setAltModalLoading] = useState(false);
  const [slotAlternatives, setSlotAlternatives] = useState([]);
  const [selectedBookedSlotTime, setSelectedBookedSlotTime] = useState(null);

  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [selectedETA, setSelectedETA] = useState(null);
  const [selectedChairIndex, setSelectedChairIndex] = useState(null);

  const [activeSlide, setActiveSlide] = useState(0);
  const [liveSeats, setLiveSeats] = useState([]);
  
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [expandedCategories, setExpandedCategories] = useState({});
  const toggleCategory = (catName) => {
    setExpandedCategories(prev => ({ ...prev, [catName]: !prev[catName] }));
  };

  const [zoomModalVisible, setZoomModalVisible] = useState(false);
  const [zoomImagesList, setZoomImagesList] = useState([]);
  const [zoomImageIndex, setZoomImageIndex] = useState(0);
  const zoomScrollRef = useRef(null);

  useEffect(() => {
    if (zoomModalVisible && zoomScrollRef.current) {
      setTimeout(() => {
        zoomScrollRef.current?.scrollTo({
          x: zoomImageIndex * Dimensions.get("window").width,
          animated: false,
        });
      }, 50);
    }
  }, [zoomModalVisible, zoomImageIndex]);

  // Hide default header for custom full-bleed UI
  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const [refreshing, setRefreshing] = useState(false);

  const loadBarber = useCallback(async () => {
    try {
      const res = await api.get(`/barbers/${barberId}?t=${Date.now()}`);
      setDetail(res.data);
      if (res.data?.barber?.seats) {
        setLiveSeats(res.data.barber.seats);
      }
      const first = res.data.services?.[0];
      if (first && selectedServiceIds.length === 0) {
        setSelectedServiceIds([first.id]);
        setIsHomeServiceSelected(!!first.isHomeService);
      }
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.error || e.message);
    }
  }, [barberId, selectedServiceIds.length]);

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
    
    // Setup Socket.io
    const socket = getSocket();
    socket.emit("joinBarberRoom", barberId);
    
    const handleSlotsUpdated = (data) => {
      if (data && data.seats) {
        setLiveSeats(data.seats);
      }
      setRefreshTrigger(prev => prev + 1);
    };
    socket.on("slotsUpdated", handleSlotsUpdated);
    
    return () => {
      socket.emit("leaveBarberRoom", barberId);
      socket.off("slotsUpdated", handleSlotsUpdated);
    };
  }, [barberId]);

  const nextDates = useMemo(() => {
    const out = [];
    const today = new Date();
    let daysToShow = detail?.maxAdvanceBookingDays || 1;
    if (isHomeServiceSelected && daysToShow < 14) {
      daysToShow = 14; // Legacy fallback for home service if maxAdvanceBookingDays is not set
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

  useEffect(() => {
    if (nextDates.length) {
      if (!dateStr || !nextDates.includes(dateStr)) {
        setDateStr(nextDates[0]);
      }
    }
  }, [nextDates, dateStr]);

  // Reset selected slot when date or service changes
  useEffect(() => {
    setSelectedSlot(null);
  }, [dateStr, selectedServiceIds]);

  // Clear selected services when switching between Home/Shop modes
  useEffect(() => {
    setSelectedServiceIds([]);
  }, [isHomeServiceSelected]);

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
            booked: res.data.bookedSlotsForDay || 0 
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
    return () => { cancelled = true; };
  }, [barberId, selectedServiceIds.join(","), dateStr, refreshTrigger]);

  const autoFetchHomeServiceLocation = async () => {
    setFetchingLocation(true);
    try {
      const gps = await getCurrentGPSLocation();
      if (gps && gps.lat && gps.lng) {
        setHomeLocation({ lat: gps.lat, lng: gps.lng });
        if (gps.displayName) {
          setHomeAddress(gps.displayName);
        }
      }
    } catch (error) {
      console.warn("Failed to auto-fetch GPS location:", error);
    } finally {
      setFetchingLocation(false);
    }
  };

  function handleBookIntent() {
    if (selectedServiceIds.length === 0) return;
    setConfirmModalVisible(true);
    if (isHomeServiceSelected) {
      autoFetchHomeServiceLocation();
    }
  }

  async function executeBooking() {
    if (selectedServiceIds.length === 0) return;
    if (!isHomeServiceSelected && liveSeats.length > 0 && selectedChairIndex === null) {
      Alert.alert("Chair Selection Required", "Please select your preferred styling chair to complete your booking.");
      return;
    }
    setBookingBusy(true);
    
    // Calculate start time based on ETA
    const etaMinutes = selectedETA || 0;
    const startTimeIso = isHomeServiceSelected && selectedSlot 
      ? selectedSlot 
      : new Date(Date.now() + etaMinutes * 60000).toISOString();

    if (isHomeServiceSelected && !homeLocation) {
      Alert.alert(
        "Location Access Required",
        "Please enable GPS/location permissions so our stylist can navigate to your delivery address."
      );
      setBookingBusy(false);
      return;
    }

    try {
      await api.post("/bookings", {
        barberId,
        serviceIds: selectedServiceIds,
        staffId: selectedStaffId,
        startTime: startTimeIso,
        notes: "",
        isHomeService: isHomeServiceSelected,
        homeServiceAddress: isHomeServiceSelected ? homeAddress : undefined,
        homeServiceLocation: isHomeServiceSelected ? homeLocation : undefined,
        customerETA: !isHomeServiceSelected && selectedETA !== null ? selectedETA : undefined,
        seatIndex: !isHomeServiceSelected && selectedChairIndex !== null ? selectedChairIndex : undefined,
      });
      setConfirmModalVisible(false);
      Alert.alert("Booking Confirmed 🎉", "Your appointment has been successfully scheduled! You can review details in the bookings panel.", [
        { text: "View Bookings", onPress: () => navigation.getParent()?.navigate("MyBookings") },
      ]);
    } catch (e) {
      const err = e?.response?.data?.error;
      if (e?.response?.status === 409) {
        setConfirmModalVisible(false);
        Alert.alert(
          "Time Slot Unavailable", 
          (typeof err === "string" ? err : "This time slot is no longer available.") + "\n\nLet's check alternative options for you.",
          [{ text: "View Alternatives", onPress: () => handleBookedSlotPress(selectedSlot) }]
        );
      } else {
        Alert.alert("Booking Request Failed", typeof err === "string" ? err : "An error occurred while confirming your appointment. Please try again.");
      }
    } finally {
      setBookingBusy(false);
    }
  }

  async function handleSelectSlot(iso) {
    setSelectedSlot(iso);
    try {
      await api.post("/bookings/lock-slot", { barberId, time: iso });
    } catch (e) {
      const err = e?.response?.data?.error;
      if (e?.response?.status === 409) {
        Alert.alert("Time Slot Locked", err || "This time slot is temporarily held by another customer. Please select another slot.");
        setSelectedSlot(null);
      }
    }
  }

  async function handleBookedSlotPress(iso) {
    setSelectedBookedSlotTime(iso);
    setAltModalVisible(true);
    setAltModalLoading(true);
    try {
      const res = await api.get("/bookings/slot-alternatives", {
        params: { barberId, serviceIds: selectedServiceIds.join(","), time: iso }
      });
      setSlotAlternatives(res.data.recommendations || []);
    } catch (e) {
      console.error(e);
      setSlotAlternatives([]);
    } finally {
      setAltModalLoading(false);
    }
  }

  const services = useMemo(() => {
    return (detail?.services || []).map(s => {
      let mappedCat = s.category;
      if (s.category === "haircut") mappedCat = "💇 Hair";
      else if (s.category === "beard") mappedCat = "🧔 Beard";
      else if (s.category === "facial") mappedCat = "💆 Face";
      else if (s.category === "massage") mappedCat = "💆 Massage";
      return { 
        ...s, 
        category: mappedCat,
        originalPrice: s.originalPrice || s.price || 0,
        discountAmount: s.discountAmount || 0
      };
    });
  }, [detail?.services]);
  
  const { shopCategorizedServices, homeCategorizedServices } = useMemo(() => {
    const shopGroups = {};
    const homeGroups = {};
    services.forEach(s => {
      if (s.isActive === false) return;
      const cat = s.category || "other";
      if (s.isHomeService) {
        if (!homeGroups[cat]) homeGroups[cat] = [];
        homeGroups[cat].push(s);
      } else {
        if (!shopGroups[cat]) shopGroups[cat] = [];
        shopGroups[cat].push(s);
      }
    });
    return { shopCategorizedServices: shopGroups, homeCategorizedServices: homeGroups };
  }, [services]);

  if (loading || !detail) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#6d28d9" size="large" />
      </View>
    );
  }

  const selectedServices = services.filter(s => selectedServiceIds.includes(s.id));
  const totalDuration = selectedServices.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
  const totalPrice = selectedServices.reduce((sum, s) => sum + (s.price || 0), 0);

  const toggleService = (service) => {
    if (!!service.isHomeService !== isHomeServiceSelected) {
       setIsHomeServiceSelected(!!service.isHomeService);
       setSelectedServiceIds([service.id]);
       return;
    }
    setSelectedServiceIds(prev => {
      if (prev.includes(service.id)) return prev.filter(sid => sid !== service.id);
      return [...prev, service.id];
    });
  };

  const b = detail.barber || {};
  const addr = b.address || {};
  const loc = b.location;

  function openMap() {
    if (loc?.lat != null && loc?.lng != null) {
      const q = `${loc.lat},${loc.lng}`;
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`);
    }
  }

  const heroImages = [];
  if (b.shopPosterUrl) heroImages.push(b.shopPosterUrl);
  if (b.gallery && b.gallery.length > 0) heroImages.push(...b.gallery);
  if (heroImages.length === 0) heroImages.push(SALON_FALLBACK_IMAGES[0]);

  const screenWidth = Dimensions.get("window").width;

  return (
    <View style={styles.mainWrapper}>
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.scrollContent} 
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6d28d9" />}
      >
        
        {/* Parallax Hero Header */}
        <View style={styles.heroContainer}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => {
              const slide = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
              setActiveSlide(slide);
            }}
            scrollEventThrottle={16}
          >
            {heroImages.map((img, i) => (
              <Pressable key={i} onPress={() => { setZoomImagesList(heroImages); setZoomImageIndex(i); setZoomModalVisible(true); }}>
                <Image 
                  source={{ uri: img }} 
                  style={[styles.heroImage, { width: screenWidth }]} 
                  resizeMode="contain"
                />
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.heroOverlay} pointerEvents="none" />
          
          {/* Pagination Dots */}
          {heroImages.length > 1 && (
            <View style={styles.paginationContainer} pointerEvents="none">
              {heroImages.map((_, i) => (
                <View key={i} style={[styles.dot, activeSlide === i ? styles.activeDot : null]} />
              ))}
            </View>
          )}
          
          {/* Hero Image Watermarks */}
          <View style={styles.heroWatermarkContainer} pointerEvents="none">
            <Text style={styles.heroWatermarkLeft}>Tap to zoom</Text>
            <Text style={styles.heroWatermarkRight}>Roopsy</Text>
          </View>
          
          {/* Custom Nav Bar */}
          <View style={[styles.navBar, { top: Math.max(insets.top, 20) }]}>
            <Pressable style={styles.navBtn} onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate("MainTabs", { screen: "Home" });
              }
            }}>
              <Ionicons name="arrow-back" size={24} color="#0f172a" />
            </Pressable>
            <Pressable style={styles.navBtn} onPress={() => toggleFavorite(barberId)}>
              <Ionicons name={favorites.includes(barberId) ? "heart" : "heart-outline"} size={24} color={favorites.includes(barberId) ? "#ef4444" : "#0f172a"} />
            </Pressable>
          </View>
        </View>

        {/* Info Card (Pulls up over the image) */}
        <View style={styles.infoSheet}>
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.shopTitle}>{b.shopName || shopName || "Premium Salon"}</Text>
              <Text style={styles.shopCategory}>{b.businessCategory || "Hair & Beauty Services"}</Text>
            </View>
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={14} color="#fbbf24" />
              <Text style={styles.ratingText}>
                {b.ratingCount && b.ratingCount > 0 ? (
                  `${b.averageRating || (b.ratingSum / b.ratingCount).toFixed(1)} (${b.ratingCount})`
                ) : (
                  "New"
                )}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.metaInfoRow}>
            <View style={styles.metaItem}>
              <Ionicons name="time" size={20} color="#6d28d9" />
              <View style={styles.metaTextCol}>
                <Text style={styles.metaLabel}>Status</Text>
                <Text style={[styles.metaValue, { color: b.isShopOpen ? "#16a34a" : "#ef4444" }]}>
                  {b.isShopOpen ? "Open Now" : "Closed"}
                </Text>
              </View>
            </View>
            
            {b.user && (
              <View style={styles.metaItem}>
                <Ionicons name="person" size={20} color="#6d28d9" />
                <View style={styles.metaTextCol}>
                  <Text style={styles.metaLabel}>Stylist</Text>
                  <Text style={styles.metaValue}>{b.user.name}</Text>
                </View>
              </View>
            )}
          </View>

          {(addr.line1 || addr.city) && (
            <Pressable onPress={openMap} style={styles.locationBox}>
              <View style={styles.locIconWrap}>
                <Ionicons name="location" size={20} color="#3b82f6" />
              </View>
              <View style={styles.locTextWrap}>
                <Text style={styles.locTitle}>Shop Location</Text>
                <Text style={styles.locAddress}>{[addr.line1, addr.city, addr.pincode].filter(Boolean).join(", ")}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
            </Pressable>
          )}

          {/* Live Shop Status */}
          {liveSeats.length > 0 && (
            <View style={styles.liveSection}>
              <View style={styles.liveHeaderRow}>
                <Text style={styles.sectionTitle}>Live Chairs Status</Text>
                <View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveText}>LIVE</Text></View>
              </View>
              <View style={styles.liveGrid}>
                {liveSeats.map(seat => {
                  let status = "Available";
                  let color = "#16a34a";
                  let bg = "#dcfce7";
                  if (!seat.isAvailable) {
                    if (seat.occupiedUntil) {
                      const untilDate = new Date(seat.occupiedUntil);
                      if (untilDate > new Date()) {
                        const diffMins = Math.round((untilDate - new Date()) / 60000);
                        status = `In ${diffMins}m`;
                        color = "#f59e0b";
                        bg = "#fef3c7";
                      } else {
                        status = "Occupied";
                        color = "#ef4444";
                        bg = "#fee2e2";
                      }
                    } else {
                      status = "Occupied";
                      color = "#ef4444";
                      bg = "#fee2e2";
                    }
                  }
                  return (
                    <View key={seat.index} style={[styles.liveSeatCard, { backgroundColor: bg, borderColor: color }]}>
                      <Ionicons name="person" size={20} color={color} style={{ opacity: seat.isAvailable ? 0.2 : 1 }} />
                      <Text style={[styles.liveSeatTitle, { color }]}>{seat.label || `Chair ${seat.index + 1}`}</Text>
                      <Text style={[styles.liveSeatStatus, { color }]}>{status}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Services Selection */}
          <View style={styles.servicesSection}>
            {Object.keys(shopCategorizedServices).length > 0 && (
              <>
                <View style={[styles.shopServiceBox, { marginBottom: 10 }, !b.isShopOpen && { backgroundColor: "#fee2e2" }]}>
                  <View style={styles.shopServiceInfo}>
                    <View style={styles.shopServiceHeaderRow}>
                      <Ionicons name="storefront" size={20} color={b.isShopOpen ? "#0284c7" : "#ef4444"} />
                      <Text style={[styles.shopServiceTitle, !b.isShopOpen && { color: "#b91c1c" }]}>Shop Services</Text>
                    </View>
                    <Text style={[styles.shopServiceSub, !b.isShopOpen && { color: "#ef4444" }]}>
                      {b.isShopOpen ? "Visit the shop for these services" : "Shop bookings closed"}
                    </Text>
                  </View>
                </View>
                {b.isShopOpen && Object.entries(shopCategorizedServices).map(([catName, catservices]) => (
                  <View key={catName} style={styles.accordionContainer}>
                    <Pressable style={styles.accordionHeader} onPress={() => toggleCategory(catName)}>
                      <Text style={styles.accordionTitle}>
                        {catName.includes("💇") || catName.includes("🧔") || catName.includes("💆") ? catName : (catName.charAt(0).toUpperCase() + catName.slice(1))}
                      </Text>
                      <Ionicons name={expandedCategories[catName] ? "chevron-up" : "chevron-down"} size={20} color="#6d28d9" />
                    </Pressable>
                    
                    {expandedCategories[catName] && (
                      <View style={styles.accordionContent}>
                        {catservices.map((s) => (
                          <Pressable
                            key={s.id}
                            style={[styles.serviceCard, selectedServiceIds.includes(s.id) && styles.serviceCardActive]}
                            onPress={() => toggleService(s)}
                          >
                            <View style={styles.serviceMainRow}>
                              <View style={styles.svcIconBox}>
                                {catName.includes("💇") || catName.includes("🧔") || catName.includes("💆") ? (
                                  <Text style={{ fontSize: 20 }}>{catName.split(" ")[0]}</Text>
                                ) : (
                                  <Ionicons name={s.isPackage ? "gift" : (catName.toLowerCase().includes('makeup') ? 'color-palette' : 'cut')} size={20} color={selectedServiceIds.includes(s.id) ? "#6d28d9" : "#64748b"} />
                                )}
                              </View>
                              <View style={styles.svcInfo}>
                                <Text style={[styles.svcName, selectedServiceIds.includes(s.id) && styles.svcNameActive]}>{s.name}</Text>
                                <View style={styles.minTimeBadge}>
                                  <Ionicons name="time" size={12} color="#ea580c" style={{ marginRight: 4 }} />
                                  <Text style={styles.minTimeText}>{s.durationMinutes} min minimum</Text>
                                </View>
                                {s.subcategory ? <Text style={styles.svcMeta}>{s.subcategory}</Text> : null}
                              </View>
                              <View style={styles.svcPriceBox}>
                                <View style={{ alignItems: "flex-end", marginRight: 10 }}>
                                  {s.originalPrice > s.price ? (
                                    <>
                                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                        <Text style={{ fontSize: 12, color: "#94a3b8", textDecorationLine: "line-through" }}>₹{s.originalPrice}</Text>
                                        <View style={{ backgroundColor: "#fee2e2", paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 }}>
                                          <Text style={{ fontSize: 9, color: "#ef4444", fontWeight: "700" }}>{Math.round(((s.originalPrice - s.price) / s.originalPrice) * 100)}% OFF</Text>
                                        </View>
                                      </View>
                                      <Text style={[styles.svcPrice, selectedServiceIds.includes(s.id) && styles.svcPriceActive, { color: "#16a34a", fontWeight: "800" }]}>₹{s.price}</Text>
                                    </>
                                  ) : (
                                    <Text style={[styles.svcPrice, selectedServiceIds.includes(s.id) && styles.svcPriceActive]}>₹{s.price}</Text>
                                  )}
                                </View>
                                <View style={[styles.radioCircle, selectedServiceIds.includes(s.id) && styles.radioCircleActive]}>
                                  {selectedServiceIds.includes(s.id) && <View style={styles.radioDot} />}
                                </View>
                              </View>
                            </View>
                            {s.images && s.images.length > 0 && (
                              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.svcImagesScroll}>
                                {s.images.map((imgUrl, i) => (
                                  <Pressable key={i} onPress={() => { setZoomImagesList(s.images); setZoomImageIndex(i); setZoomModalVisible(true); }}>
                                    <Image source={{ uri: imgUrl }} style={styles.svcImageThumb} resizeMode="cover" />
                                  </Pressable>
                                ))}
                              </ScrollView>
                            )}
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
              </>
            )}

            {Object.keys(homeCategorizedServices).length > 0 && (
              <>
                <View style={[styles.homeServiceBox, { marginBottom: 10, marginTop: Object.keys(shopCategorizedServices).length > 0 ? 10 : 0 }, !b.offersHomeService && { backgroundColor: "#fee2e2" }]}>
                  <View style={styles.homeServiceInfo}>
                    <View style={styles.homeServiceHeaderRow}>
                      <Ionicons name="home" size={20} color={b.offersHomeService ? "#6d28d9" : "#ef4444"} />
                      <Text style={[styles.homeServiceTitle, !b.offersHomeService && { color: "#b91c1c" }]}>Home Services</Text>
                    </View>
                    <Text style={[styles.homeServiceSub, !b.offersHomeService && { color: "#ef4444" }]}>
                      {b.offersHomeService 
                        ? `Barber will visit your location (+₹${b.homeServiceFee || 0})`
                        : "Home service off"
                      }
                    </Text>
                  </View>
                </View>

                {b.offersHomeService && Object.entries(homeCategorizedServices).map(([catName, catservices]) => (
                  <View key={`home_${catName}`} style={styles.accordionContainer}>
                    <Pressable style={styles.accordionHeader} onPress={() => toggleCategory(`home_${catName}`)}>
                      <Text style={styles.accordionTitle}>
                        {catName.includes("💇") || catName.includes("🧔") || catName.includes("💆") ? catName : (catName.charAt(0).toUpperCase() + catName.slice(1))}
                      </Text>
                      <Ionicons name={expandedCategories[`home_${catName}`] ? "chevron-up" : "chevron-down"} size={20} color="#6d28d9" />
                    </Pressable>
                    
                    {expandedCategories[`home_${catName}`] && (
                      <View style={styles.accordionContent}>
                        {catservices.map((s) => (
                          <Pressable
                            key={s.id}
                            style={[styles.serviceCard, selectedServiceIds.includes(s.id) && styles.serviceCardActive]}
                            onPress={() => toggleService(s)}
                          >
                            <View style={styles.serviceMainRow}>
                              <View style={styles.svcIconBox}>
                                {catName.includes("💇") || catName.includes("🧔") || catName.includes("💆") ? (
                                  <Text style={{ fontSize: 20 }}>{catName.split(" ")[0]}</Text>
                                ) : (
                                  <Ionicons name={s.isPackage ? "gift" : (catName.toLowerCase().includes('makeup') ? 'color-palette' : 'cut')} size={20} color={selectedServiceIds.includes(s.id) ? "#6d28d9" : "#64748b"} />
                                )}
                              </View>
                              <View style={styles.svcInfo}>
                                <Text style={[styles.svcName, selectedServiceIds.includes(s.id) && styles.svcNameActive]}>{s.name}</Text>
                                <View style={styles.minTimeBadge}>
                                  <Ionicons name="time" size={12} color="#ea580c" style={{ marginRight: 4 }} />
                                  <Text style={styles.minTimeText}>{s.durationMinutes} min minimum</Text>
                                </View>
                                {s.subcategory ? <Text style={styles.svcMeta}>{s.subcategory}</Text> : null}
                              </View>
                              <View style={styles.svcPriceBox}>
                                <View style={{ alignItems: "flex-end", marginRight: 10 }}>
                                  {s.originalPrice > s.price ? (
                                    <>
                                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                        <Text style={{ fontSize: 12, color: "#94a3b8", textDecorationLine: "line-through" }}>₹{s.originalPrice}</Text>
                                        <View style={{ backgroundColor: "#fee2e2", paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 }}>
                                          <Text style={{ fontSize: 9, color: "#ef4444", fontWeight: "700" }}>{Math.round(((s.originalPrice - s.price) / s.originalPrice) * 100)}% OFF</Text>
                                        </View>
                                      </View>
                                      <Text style={[styles.svcPrice, selectedServiceIds.includes(s.id) && styles.svcPriceActive, { color: "#16a34a", fontWeight: "800" }]}>₹{s.price}</Text>
                                    </>
                                  ) : (
                                    <Text style={[styles.svcPrice, selectedServiceIds.includes(s.id) && styles.svcPriceActive]}>₹{s.price}</Text>
                                  )}
                                </View>
                                <View style={[styles.radioCircle, selectedServiceIds.includes(s.id) && styles.radioCircleActive]}>
                                  {selectedServiceIds.includes(s.id) && <View style={styles.radioDot} />}
                                </View>
                              </View>
                            </View>
                            {s.images && s.images.length > 0 && (
                              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.svcImagesScroll}>
                                {s.images.map((imgUrl, i) => (
                                  <Image key={i} source={{ uri: imgUrl }} style={styles.svcImageThumb} />
                                ))}
                              </ScrollView>
                            )}
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
              </>
            )}
            
            {Object.keys(shopCategorizedServices).length === 0 && Object.keys(homeCategorizedServices).length === 0 && (
              <View style={styles.warningBox}>
                <Ionicons name="alert-circle" size={20} color="#b45309" />
                <Text style={styles.warningText}>No services available.</Text>
              </View>
            )}
          </View>

          {b.bio && (
            <View style={styles.aboutSection}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.bioText}>{b.bio}</Text>
            </View>
          )}

          {/* Working Hours */}
          {b.workingHours && (
            <View style={styles.workingHoursSection}>
              <Text style={styles.sectionTitle}>Working Hours</Text>
              <View style={styles.workingHoursCard}>
                {["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map(day => {
                  const dayData = b.workingHours[day];
                  if (!dayData) return null;
                  const dayName = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" }[day];
                  
                  // Helper function for 12-hour AM/PM format
                  const formatTime = (timeStr) => {
                    if (!timeStr) return "";
                    const [h, m] = timeStr.split(":");
                    const hour = parseInt(h, 10);
                    const ampm = hour >= 12 ? "PM" : "AM";
                    const formattedHour = hour % 12 || 12;
                    return `${formattedHour}:${m} ${ampm}`;
                  };

                  return (
                    <View key={day} style={styles.whRow}>
                      <Text style={styles.whDay}>{dayName}</Text>
                      <Text style={[styles.whTime, dayData.isClosed && styles.whClosed]}>
                        {dayData.isClosed ? "Closed" : `${formatTime(dayData.open)} - ${formatTime(dayData.close)}`}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Staff Selection */}
          {b.staff && b.staff.length > 0 && (
            <View style={styles.servicesSection}>
              <Text style={styles.sectionTitle}>Select Stylist (Optional)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                {b.staff.map((st) => (
                  <Pressable
                    key={st._id}
                    style={[styles.staffCard, selectedStaffId === st._id && styles.staffCardActive]}
                    onPress={() => setSelectedStaffId(prev => prev === st._id ? null : st._id)}
                  >
                    <Ionicons name="person-circle" size={40} color={selectedStaffId === st._id ? "#6d28d9" : "#94a3b8"} />
                    <Text style={[styles.staffName, selectedStaffId === st._id && styles.staffNameActive]}>{st.name}</Text>
                    <Text style={styles.staffRole}>{st.role || "Stylist"}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}




        </View>
      </ScrollView>

      {/* Alternatives Modal */}
      <Modal visible={altModalVisible} transparent={true} animationType="slide" onRequestClose={() => setAltModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Slot Unavailable</Text>
              <Pressable onPress={() => setAltModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </Pressable>
            </View>
            
            <Text style={styles.modalDesc}>
              This slot ({selectedBookedSlotTime && new Date(selectedBookedSlotTime).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}) is fully booked here. But good news! Here are some intelligent alternatives for you:
            </Text>

            {altModalLoading ? (
              <ActivityIndicator color="#6d28d9" style={{ marginVertical: 30 }} />
            ) : slotAlternatives.length === 0 ? (
              <Text style={styles.modalEmpty}>No alternatives found nearby for this time.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 300, marginTop: 10 }}>
                {slotAlternatives.map((rec, idx) => (
                  <Pressable 
                    key={idx}
                    style={styles.altShopCard}
                    onPress={() => {
                      setAltModalVisible(false);
                      if (rec.isSameShop) {
                        setDateStr(rec.time.split('T')[0]);
                      } else {
                        const bObj = rec.barber || {};
                        const cat = (bObj.businessCategory || "").toLowerCase();
                        const bId = bObj.id || bObj._id;
                        const sName = bObj.shopName || "";
                        if (cat.includes("tailor") || cat.includes("stitching") || cat.includes("center")) {
                          navigation.push("TailorDetail", { tailorId: bId, shopName: sName });
                        } else if (cat.includes("beauty") || cat.includes("parlor") || cat.includes("parlour")) {
                          navigation.push("BeautyParlorDetail", { barberId: bId, shopName: sName });
                        } else {
                          navigation.push("BarberDetail", { barberId: bId, shopName: sName });
                        }
                      }
                    }}
                  >
                    <Image 
                      source={{ uri: rec.barber.shopPosterUrl || SALON_FALLBACK_IMAGES[0] }} 
                      style={styles.altShopImg} 
                    />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.altShopName}>{rec.isSameShop ? "This Shop" : rec.barber.shopName}</Text>
                        {rec.score >= 100 && <Text style={{marginLeft: 8, fontSize: 10, color: '#10b981', fontWeight: 'bold', backgroundColor: '#ecfdf5', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4}}>Best Match</Text>}
                      </View>
                      <Text style={{ fontSize: 13, color: '#334155', marginTop: 2 }}>
                        {rec.isExactTime ? "Same Time" : `${new Date(rec.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                      </Text>
                      {!rec.isSameShop && rec.barber.distance !== Infinity && (
                        <Text style={styles.altShopDist}>{rec.barber.distance.toFixed(1)} km away</Text>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Premium Confirm Booking Modal */}
      <Modal visible={confirmModalVisible} transparent={true} animationType="slide" onRequestClose={() => setConfirmModalVisible(false)}>
        <View style={styles.modalOverlayPremium}>
          <View style={styles.modalContentPremium}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeaderRowPremium}>
              <View>
                <Text style={styles.modalTitlePremium}>Finalize Booking</Text>
                <Text style={styles.modalSubTitlePremium}>{selectedServiceIds.length} Services • {totalDuration} mins</Text>
              </View>
              <Pressable onPress={() => setConfirmModalVisible(false)} style={styles.closeBtnPremium}>
                <Ionicons name="close" size={20} color="#64748b" />
              </Pressable>
            </View>
            
            {(() => {
              if (isHomeServiceSelected) {
                return (
                  <ScrollView style={{ maxHeight: 400 }}>
                    <View style={styles.premiumSection}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <Text style={styles.premiumSectionTitle}>Service Address</Text>
                        {fetchingLocation && (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                            <ActivityIndicator color="#6d28d9" size="small" />
                            <Text style={{ fontSize: 11, color: "#6d28d9", fontWeight: "600" }}>Detecting location...</Text>
                          </View>
                        )}
                      </View>
                      
                      <View style={{ position: 'relative' }}>
                        <TextInput
                          style={[styles.addressInput, { paddingRight: 40 }]}
                          placeholder="Enter your full address"
                          value={homeAddress}
                          onChangeText={setHomeAddress}
                          multiline
                        />
                        <Pressable 
                          style={{ position: 'absolute', right: 10, top: 12, padding: 4 }} 
                          onPress={autoFetchHomeServiceLocation}
                          disabled={fetchingLocation}
                        >
                          <Ionicons name="location" size={20} color={fetchingLocation ? "#cbd5e1" : "#6d28d9"} />
                        </Pressable>
                      </View>
                      <Text style={{ fontSize: 11, color: "#64748b", marginTop: 6 }}>
                        GPS location will help the barber navigate to you. You can edit the address manually above.
                      </Text>
                    </View>
                  </ScrollView>
                );
              }
              
              const selectedSeat = selectedChairIndex !== null ? liveSeats.find(s => s.index === selectedChairIndex) : null;
              const hideETA = selectedSeat && !selectedSeat.isAvailable;

              if (hideETA) {
                return (
                  <View style={[styles.premiumSection, { backgroundColor: "#f8fafc", padding: 16, borderRadius: 16, borderWidth: 1, borderColor: "#e2e8f0" }]}>
                    <Text style={{fontSize: 14, fontWeight: "700", color: "#334155", textAlign: "center", lineHeight: 20}}>
                      Your appointment will automatically start as soon as this chair becomes free.
                    </Text>
                  </View>
                );
              }

              return (
                <View style={styles.premiumSection}>
                  <Text style={styles.premiumSectionTitle}>ETA (Arrival Time)</Text>
                  <View style={styles.etaGridPremium}>
                    {[5, 10, 15, 30].map(mins => {
                      const isActive = selectedETA === mins;
                      return (
                        <Pressable
                          key={mins}
                          style={[styles.etaCardPremium, isActive && styles.etaCardActivePremium]}
                          onPress={() => setSelectedETA(mins)}
                        >
                          <Ionicons name={isActive ? "time" : "time-outline"} size={20} color={isActive ? "#fff" : "#64748b"} />
                          <Text style={[styles.etaCardTextPremium, isActive && styles.etaCardTextActivePremium]}>
                            {mins} mins
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })()}

            {!isHomeServiceSelected && liveSeats.length > 0 && (
              <View style={styles.premiumSection}>
                <Text style={styles.premiumSectionTitle}>Select Chair (Mandatory)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chairScrollPremium}>
                  {liveSeats.map(seat => {
                    const isActive = selectedChairIndex === seat.index;
                    const isAvailable = seat.isAvailable;
                    
                    let subtext = isAvailable ? "Instant Allocation" : "Join Queue";
                    if (!isAvailable && seat.occupiedUntil) {
                      const minsLeft = Math.ceil((new Date(seat.occupiedUntil) - new Date()) / 60000);
                      if (minsLeft > 0) {
                        subtext = `Free in ~${minsLeft} mins`;
                      } else {
                        subtext = "Available soon";
                      }
                    }

                    return (
                      <Pressable
                        key={seat.index}
                        style={[
                          styles.chairCardPremium,
                          isActive && styles.chairCardActivePremium,
                          !isAvailable && !isActive && styles.chairCardBookedPremium
                        ]}
                        onPress={() => setSelectedChairIndex(prev => prev === seat.index ? null : seat.index)}
                      >
                        <View style={styles.chairCardHeader}>
                          <View style={[styles.statusDot, { backgroundColor: isAvailable ? "#10b981" : "#ef4444" }]} />
                          <Text style={[styles.chairCardStatus, { color: isAvailable ? "#10b981" : "#ef4444" }]}>
                            {isAvailable ? "Available" : "Occupied"}
                          </Text>
                        </View>
                        <Text style={[styles.chairCardTitlePremium, isActive && styles.chairCardTitleActivePremium]}>
                          {seat.label || `Chair ${seat.index + 1}`}
                        </Text>
                        <Text style={[styles.chairCardSubPremium, isActive && styles.chairCardSubActivePremium]}>
                          {subtext}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            <View style={styles.modalFooterPremium}>
              <View style={styles.footerPriceCol}>
                <Text style={styles.footerPriceLabel}>Total Price</Text>
                <Text style={styles.footerPriceValue}>₹{totalPrice + (isHomeServiceSelected ? (b.homeServiceFee || 0) : 0)}</Text>
              </View>
              <Pressable
                style={[styles.bookBtnPremium, (bookingBusy || (!isHomeServiceSelected && liveSeats.length > 0 && selectedChairIndex === null)) && { opacity: 0.7 }]}
                onPress={executeBooking}
                disabled={bookingBusy || (!isHomeServiceSelected && liveSeats.length > 0 && selectedChairIndex === null)}
              >
                {bookingBusy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.bookBtnTextPremium}>Confirm</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 6 }} />
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Floating Bottom Bar for Booking */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <View style={styles.bottomSummary}>
          {selectedServiceIds.length > 0 ? (
            <View>
              <Text style={styles.summaryLabel}>{selectedServiceIds.length} Services Selected</Text>
              <Text style={{fontSize: 12, color: "#475569", fontWeight: "600", marginTop: 2}}>Total Duration: {totalDuration} mins</Text>
              <Text style={[styles.summaryPrice, { fontSize: 18 }]}>
                Total Price: ₹{totalPrice + (isHomeServiceSelected ? (b.homeServiceFee || 0) : 0)}
              </Text>
            </View>
          ) : (
            <View>
              <Text style={styles.summaryLabel}>0 Services Selected</Text>
              <Text style={styles.summaryPrice}>₹0</Text>
            </View>
          )}
        </View>
        <Pressable 
          style={[styles.bookBtn, (selectedServiceIds.length === 0 || bookingBusy) && styles.bookBtnDisabled]}
          disabled={selectedServiceIds.length === 0 || bookingBusy}
          onPress={handleBookIntent}
        >
          {bookingBusy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.bookBtnText}>Book Appointment</Text>
          )}
        </Pressable>
      </View>

      {/* Zoomable Image Viewer Modal */}
      <Modal
        visible={zoomModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setZoomModalVisible(false)}
      >
        <View style={styles.zoomModalBg}>
          <Pressable style={styles.zoomCloseBtn} onPress={() => setZoomModalVisible(false)}>
            <Ionicons name="close" size={28} color="#ffffff" />
          </Pressable>
          <ScrollView
            ref={zoomScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={{ width: "100%", height: "100%" }}
          >
            {zoomImagesList.map((imgUrl, idx) => (
              <View key={idx} style={{ width: Dimensions.get("window").width, height: "100%", justifyContent: "center", alignItems: "center" }}>
                <View style={styles.zoomImageWrapper}>
                  <ScrollView
                    minimumZoomScale={1}
                    maximumZoomScale={5}
                    showsHorizontalScrollIndicator={false}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.zoomScrollContent}
                  >
                    <Image source={{ uri: imgUrl }} style={styles.zoomImage} resizeMode="contain" />
                  </ScrollView>
                  
                  {/* Watermarks Container directly on the image box */}
                  <View style={styles.watermarkContainer}>
                    <Text style={styles.watermarkLeft}>Tap to zoom</Text>
                    <Text style={styles.watermarkRight}>Roopsy</Text>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  mainWrapper: { flex: 1, backgroundColor: "#ffffff" },
  container: { flex: 1, backgroundColor: "#ffffff" },
  scrollContent: { paddingBottom: 120 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#ffffff" },
  
  heroContainer: { width: "100%", height: 320, position: "relative", backgroundColor: "#0f172a" },
  heroImage: { width: "100%", height: "100%", resizeMode: "contain" },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.15)" },
  zoomModalBg: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  zoomCloseBtn: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 999,
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 25,
  },
  zoomScrollContent: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100%",
  },
  zoomImage: {
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height * 0.75,
  },
  zoomImageWrapper: {
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height * 0.75,
    position: "relative",
    justifyContent: "center",
  },
  watermarkContainer: {
    position: "absolute",
    bottom: 12,
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 999,
  },
  watermarkLeft: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.45)",
    textTransform: "uppercase",
    letterSpacing: 1,
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  watermarkRight: {
    fontSize: 12,
    fontWeight: "800",
    color: "rgba(255, 255, 255, 0.6)",
    letterSpacing: 1,
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  paginationContainer: {
    position: "absolute",
    bottom: 40,
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
  },
  activeDot: {
    width: 20,
    backgroundColor: "#ffffff",
  },
  heroWatermarkContainer: {
    position: "absolute",
    bottom: 54,
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 10,
  },
  heroWatermarkLeft: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255, 255, 255, 0.7)",
    textTransform: "uppercase",
    letterSpacing: 1,
    textShadowColor: "rgba(0, 0, 0, 0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  heroWatermarkRight: {
    fontSize: 12,
    fontWeight: "900",
    color: "rgba(255, 255, 255, 0.8)",
    letterSpacing: 1.5,
    textShadowColor: "rgba(0, 0, 0, 0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  
  navBar: {
    position: "absolute",
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  navBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.9)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },

  infoSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -40,
    paddingHorizontal: 24,
    paddingTop: 30,
  },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  shopTitle: { fontSize: 26, fontWeight: "900", color: "#0f172a", marginBottom: 4 },
  shopCategory: { fontSize: 14, fontWeight: "600", color: "#6d28d9" },
  ratingBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "#fef3c7", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  ratingText: { fontSize: 14, fontWeight: "800", color: "#92400e", marginLeft: 4 },

  divider: { height: 1, backgroundColor: "#f1f5f9", marginVertical: 20 },

  metaInfoRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  metaItem: { flexDirection: "row", alignItems: "center", flex: 1 },
  metaTextCol: { marginLeft: 10 },
  metaLabel: { fontSize: 12, color: "#64748b", fontWeight: "600" },
  metaValue: { fontSize: 14, color: "#0f172a", fontWeight: "700", marginTop: 2 },

  locationBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#f8fafc", padding: 16, borderRadius: 20, marginBottom: 24, borderWidth: 1, borderColor: "#f1f5f9" },
  locIconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#e0f2fe", justifyContent: "center", alignItems: "center" },
  locTextWrap: { flex: 1, marginHorizontal: 12 },
  locTitle: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  locAddress: { fontSize: 13, color: "#64748b", marginTop: 2, lineHeight: 18 },

  aboutSection: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: "#0f172a", marginBottom: 16 },
  bioText: { fontSize: 14, color: "#475569", lineHeight: 22 },

  workingHoursSection: { marginBottom: 24 },
  workingHoursCard: { backgroundColor: "#f8fafc", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#f1f5f9" },
  whRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  whDay: { fontSize: 14, color: "#334155", fontWeight: "600", textTransform: "capitalize" },
  whTime: { fontSize: 14, color: "#0f172a", fontWeight: "700" },
  whClosed: { color: "#ef4444" },

  liveSection: { marginBottom: 24 },
  liveHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  liveBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "#fee2e2", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#ef4444", marginRight: 4 },
  liveText: { fontSize: 10, fontWeight: "800", color: "#ef4444" },
  liveGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  liveSeatCard: { width: "31%", padding: 10, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  liveSeatTitle: { fontSize: 12, fontWeight: "800", marginTop: 4 },
  liveSeatStatus: { fontSize: 10, fontWeight: "700", marginTop: 2 },

  servicesSection: { marginBottom: 24 },
  serviceCard: { padding: 16, borderRadius: 20, backgroundColor: "#ffffff", borderWidth: 2, borderColor: "#f1f5f9", marginBottom: 12 },
  serviceCardActive: { borderColor: "#6d28d9", backgroundColor: "#fcfaff" },
  serviceMainRow: { flexDirection: "row", alignItems: "center" },
  svcIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#f1f5f9", justifyContent: "center", alignItems: "center" },
  svcInfo: { flex: 1, marginLeft: 12 },
  svcName: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  svcNameActive: { color: "#6d28d9" },
  svcMeta: { fontSize: 13, color: "#64748b", marginTop: 4 },
  minTimeBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "#ffedd5", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginTop: 6, alignSelf: "flex-start" },
  minTimeText: { fontSize: 11, fontWeight: "700", color: "#ea580c" },
  svcPriceBox: { alignItems: "flex-end" },
  svcPrice: { fontSize: 16, fontWeight: "800", color: "#0f172a", marginBottom: 6 },
  svcPriceActive: { color: "#6d28d9" },
  radioCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: "#cbd5e1", justifyContent: "center", alignItems: "center" },
  radioCircleActive: { borderColor: "#6d28d9" },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#6d28d9" },
  svcImagesScroll: { marginTop: 12, paddingBottom: 4 },
  svcImageThumb: { width: 80, height: 80, borderRadius: 12, marginRight: 8, backgroundColor: "#f1f5f9" },
  subSectionTitle: { fontSize: 16, fontWeight: "700", color: "#334155", marginBottom: 12 },

  accordionContainer: { marginBottom: 12, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 16, overflow: "hidden" },
  accordionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, backgroundColor: "#f8fafc" },
  accordionTitle: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  accordionContent: { padding: 16, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#e2e8f0" },

  dateSection: { marginBottom: 24 },
  dateScroll: { paddingRight: 20 },
  dateCard: { width: 70, height: 85, borderRadius: 20, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", justifyContent: "center", alignItems: "center", marginRight: 12 },
  dateCardActive: { backgroundColor: "#0f172a", borderColor: "#0f172a", shadowColor: "#0f172a", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
  dateWeekday: { fontSize: 12, fontWeight: "600", color: "#64748b", marginBottom: 4 },
  dateDay: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  dateTextActive: { color: "#ffffff" },

  slotSection: { marginBottom: 40 },
  slotGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  slotCard: { width: "31%", height: 48, borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#ffffff", justifyContent: "center", alignItems: "center" },
  slotCardActive: { borderColor: "#6d28d9", backgroundColor: "#6d28d9" },
  slotCardBooked: { backgroundColor: "#f1f5f9", borderColor: "#f1f5f9" },
  slotTimeText: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  slotTimeTextActive: { color: "#ffffff" },
  slotTimeTextBooked: { color: "#94a3b8", textDecorationLine: "line-through" },
  
  nextAvailableBanner: { flexDirection: "row", alignItems: "center", backgroundColor: "#f3e8ff", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginBottom: 16, alignSelf: "flex-start" },
  nextAvailableText: { fontSize: 13, fontWeight: "700", color: "#6d28d9", marginLeft: 6 },
  
  emptySlotsBox: { alignItems: "center", paddingVertical: 20 },
  emptySlotsMsg: { fontSize: 16, fontWeight: "700", color: "#334155", marginTop: 14 },
  emptySlotsSub: { fontSize: 13, color: "#64748b", marginTop: 4 },
  
  altBox: { backgroundColor: "#f8fafc", padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: "#f1f5f9" },
  altTitle: { fontSize: 14, fontWeight: "800", color: "#0f172a", marginBottom: 8 },
  altBtn: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#ede9fe", padding: 12, borderRadius: 10 },
  altBtnText: { fontSize: 14, fontWeight: "700", color: "#6d28d9" },
  altShopCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#ffffff", padding: 12, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: "#f1f5f9" },
  altShopImg: { width: 40, height: 40, borderRadius: 8 },
  altShopName: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  altShopDist: { fontSize: 12, color: "#64748b" },

  warningBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#fef3c7", padding: 16, borderRadius: 16 },
  warningText: { fontSize: 13, color: "#92400e", flex: 1, marginLeft: 10, lineHeight: 20 },

  bottomBar: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 10,
  },
  bottomSummary: { flex: 1 },
  summaryLabel: { fontSize: 12, color: "#64748b", fontWeight: "600" },
  summaryPrice: { fontSize: 22, fontWeight: "900", color: "#0f172a", marginTop: 2 },
  
  bookBtn: { flex: 1.5, backgroundColor: "#0f172a", height: 56, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  bookBtnDisabled: { backgroundColor: "#cbd5e1" },
  bookBtnText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },

  staffCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    backgroundColor: "#fff",
    minWidth: 100,
  },
  staffCardActive: {
    borderColor: "#6d28d9",
    backgroundColor: "#f5f3ff",
  },
  staffName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
    marginTop: 8,
  },
  staffNameActive: {
    color: "#6d28d9",
  },
  staffRole: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  
  homeServiceBox: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#f3e8ff", padding: 16, borderRadius: 16, marginTop: 10, marginBottom: 20 },
  homeServiceInfo: { flex: 1, paddingRight: 10 },
  homeServiceHeaderRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  homeServiceTitle: { fontSize: 15, fontWeight: "800", color: "#4c1d95", marginLeft: 8 },
  homeServiceSub: { fontSize: 13, color: "#6d28d9", fontWeight: "600" },

  shopServiceBox: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#e0f2fe", padding: 16, borderRadius: 16, marginTop: 10, marginBottom: 20 },
  shopServiceInfo: { flex: 1, paddingRight: 10 },
  shopServiceHeaderRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  shopServiceTitle: { fontSize: 15, fontWeight: "800", color: "#0369a1", marginLeft: 8 },
  shopServiceSub: { fontSize: 13, color: "#0284c7", fontWeight: "600" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "#ffffff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  modalDesc: { fontSize: 14, color: "#475569", lineHeight: 22 },
  modalEmpty: { fontSize: 14, color: "#ef4444", marginTop: 20, textAlign: "center", fontWeight: "600" },

  etaChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#e2e8f0" },
  etaChipActive: { backgroundColor: "#6d28d9", borderColor: "#6d28d9" },
  etaChipText: { fontSize: 14, fontWeight: "600", color: "#475569" },
  etaChipTextActive: { color: "#ffffff" },

  chairChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#e2e8f0" },
  chairChipActive: { backgroundColor: "#6d28d9", borderColor: "#6d28d9" },
  chairChipDisabled: { opacity: 0.5 },
  chairChipText: { fontSize: 14, fontWeight: "600", color: "#475569" },
  chairChipTextActive: { color: "#ffffff" },

  // Premium Modal Styles
  modalOverlayPremium: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.6)", justifyContent: "flex-end" },
  modalContentPremium: { backgroundColor: "#ffffff", borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 24, paddingBottom: 40, paddingTop: 12, shadowColor: "#000", shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 15 },
  modalHandle: { width: 40, height: 5, backgroundColor: "#cbd5e1", borderRadius: 3, alignSelf: "center", marginBottom: 20 },
  modalHeaderRowPremium: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  modalTitlePremium: { fontSize: 24, fontWeight: "900", color: "#0f172a" },
  modalSubTitlePremium: { fontSize: 13, color: "#64748b", fontWeight: "600", marginTop: 4 },
  closeBtnPremium: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#f1f5f9", justifyContent: "center", alignItems: "center" },
  
  premiumSection: { marginBottom: 24 },
  premiumSectionTitle: { fontSize: 15, fontWeight: "800", color: "#334155", marginBottom: 12 },
  addressInput: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 12, padding: 12, fontSize: 14, color: "#0f172a", minHeight: 80, textAlignVertical: "top" },
  
  etaGridPremium: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 12 },
  etaCardPremium: { width: "47%", flexDirection: "row", alignItems: "center", backgroundColor: "#f8fafc", padding: 14, borderRadius: 16, borderWidth: 1, borderColor: "#e2e8f0" },
  etaCardActivePremium: { backgroundColor: "#0f172a", borderColor: "#0f172a", shadowColor: "#0f172a", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
  etaCardTextPremium: { fontSize: 15, fontWeight: "700", color: "#475569", marginLeft: 8 },
  etaCardTextActivePremium: { color: "#ffffff" },
  
  chairScrollPremium: { gap: 12 },
  chairCardPremium: { width: 140, padding: 16, borderRadius: 20, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#e2e8f0" },
  chairCardActivePremium: { backgroundColor: "#6d28d9", borderColor: "#6d28d9", shadowColor: "#6d28d9", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 5 },
  chairCardBookedPremium: { backgroundColor: "#fafaf9", borderColor: "#f5f5f4" },
  chairCardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  chairCardStatus: { fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  chairCardTitlePremium: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  chairCardTitleActivePremium: { color: "#ffffff" },
  chairCardSubPremium: { fontSize: 11, color: "#64748b", marginTop: 4, fontWeight: "600" },
  chairCardSubActivePremium: { color: "#ddd6fe" },

  modalFooterPremium: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8, paddingTop: 20, borderTopWidth: 1, borderTopColor: "#f1f5f9" },
  footerPriceCol: { flex: 1 },
  footerPriceLabel: { fontSize: 12, color: "#64748b", fontWeight: "600" },
  footerPriceValue: { fontSize: 24, fontWeight: "900", color: "#0f172a", marginTop: 2 },
  bookBtnPremium: { flexDirection: "row", backgroundColor: "#6d28d9", paddingHorizontal: 32, height: 56, borderRadius: 28, justifyContent: "center", alignItems: "center", shadowColor: "#6d28d9", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 8 },
  bookBtnTextPremium: { color: "#ffffff", fontSize: 16, fontWeight: "800" }
});
