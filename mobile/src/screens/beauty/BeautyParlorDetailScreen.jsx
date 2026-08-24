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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../api/client";
import { getSocket } from "../../api/socket";
import { useAuth } from "../../context/AuthContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const SALON_FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&auto=format&fit=crop&q=80",
];

function formatDateLabel(isoDate) {
  const d = new Date(isoDate + "T12:00:00");
  const weekday = d.toLocaleDateString(undefined, { weekday: "short" });
  const day = d.toLocaleDateString(undefined, { day: "numeric" });
  return { weekday, day };
}

export function BeautyParlorDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { user, favorites, toggleFavorite } = useAuth();
  const { barberId, shopName } = route.params || {};

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  // Top Tabs: Shop Visit vs Home Service
  const [isHomeServiceSelected, setIsHomeServiceSelected] = useState(false);

  // Selection States
  const [selectedServiceIds, setSelectedServiceIds] = useState([]);
  const [selectedStaffId, setSelectedStaffId] = useState(null);
  const [dateStr, setDateStr] = useState("");
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [homeAddress, setHomeAddress] = useState(user?.address?.line1 ? `${user.address.line1}, ${user.address.city}` : "");

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
  const [customETA, setCustomETA] = useState("");
  const [selectedChairIndex, setSelectedChairIndex] = useState(null);

  const [liveSeats, setLiveSeats] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const [expandedCategories, setExpandedCategories] = useState({});
  const toggleCategory = (catName) => {
    setExpandedCategories(prev => ({ ...prev, [catName]: !prev[catName] }));
  };

  const [activeSlide, setActiveSlide] = useState(0);
  const [zoomModalVisible, setZoomModalVisible] = useState(false);
  const [zoomImagesList, setZoomImagesList] = useState([]);
  const [zoomImageIndex, setZoomImageIndex] = useState(0);
  const zoomScrollRef = useRef(null);

  const b = detail?.barber || {};
  const services = detail?.services || [];
  const selectedServices = services.filter(s => selectedServiceIds.includes(s.id));
  const totalDuration = selectedServices.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
  const totalPrice = selectedServices.reduce((sum, s) => sum + (s.price || 0), 0);
  const homeServiceFee = isHomeServiceSelected ? (b.homeServiceFee || 0) : 0;
  
  const heroImages = [];
  if (b.shopPosterUrl) heroImages.push(b.shopPosterUrl);
  if (b.gallery && b.gallery.length > 0) heroImages.push(...b.gallery);
  if (heroImages.length === 0) heroImages.push(SALON_FALLBACK_IMAGES[0]);

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

  const loc = b.location;
  function openMap() {
    if (loc?.lat != null && loc?.lng != null) {
      const q = `${loc.lat},${loc.lng}`;
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
      // Select first home service if home is active, else first shop service
      // We will handle default service selection manually when switching tabs
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
    if(socket) {
      socket.emit("joinBarberRoom", barberId);
      const handleSlotsUpdated = (data) => {
        if (data && data.seats) setLiveSeats(data.seats);
        setRefreshTrigger(prev => prev + 1);
      };
      socket.on("slotsUpdated", handleSlotsUpdated);
      return () => {
        socket.emit("leaveBarberRoom", barberId);
        socket.off("slotsUpdated", handleSlotsUpdated);
      };
    }
  }, [barberId]);

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

  useEffect(() => {
    if (nextDates.length) {
      if (!dateStr || !nextDates.includes(dateStr)) setDateStr(nextDates[0]);
    }
  }, [nextDates, dateStr]);

  useEffect(() => { setSelectedSlot(null); }, [dateStr, selectedServiceIds]);
  
  // Clear selected services when switching tabs
  useEffect(() => { setSelectedServiceIds([]); }, [isHomeServiceSelected]);

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
          setSlotStats({ total: res.data.totalSlotsForDay || 0, booked: res.data.bookedSlotsForDay || 0 });
          setAlternatives(res.data.recommendations || null);
        }
      } catch (e) {
        if (!cancelled) {
          setSlots([]); setAllSlots([]); setSlotStats({ total: 0, booked: 0 }); setAlternatives(null);
        }
      } finally {
        if (!cancelled) setSlotsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [barberId, selectedServiceIds.join(","), dateStr, refreshTrigger]);

  function handleBookIntent() {
    if (selectedServiceIds.length === 0) return;
    setConfirmModalVisible(true);
  }

  async function executeBooking() {
    if (selectedServiceIds.length === 0) return;
    if (!isHomeServiceSelected && liveSeats.length > 0 && selectedChairIndex === null) {
      Alert.alert("Chair Selection Required", "Please select your preferred styling chair to complete your booking.");
      return;
    }
    if (isHomeServiceSelected && !b.offersHomeService) {
       Alert.alert("Home Service Unavailable", "Home Service is currently disabled by this salon. Please schedule a shop visit.");
       return;
    }
    if (!isHomeServiceSelected && selectedETA === null) {
       Alert.alert("Estimated Arrival Required", "Please select your estimated arrival time (ETA) to complete the booking.");
       return;
    }
    setBookingBusy(true);

    const etaMinutes = selectedETA || 0;
    const startTimeIso = isHomeServiceSelected
      ? new Date().toISOString()
      : new Date(Date.now() + etaMinutes * 60000).toISOString();
      
    try {
      await api.post("/bookings", {
        barberId,
        serviceIds: selectedServiceIds,
        staffId: selectedStaffId,
        startTime: startTimeIso,
        notes: "",
        isHomeService: isHomeServiceSelected,
        homeServiceAddress: isHomeServiceSelected ? homeAddress : undefined,
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

  const toggleService = (service) => {
    setSelectedServiceIds(prev => {
      if (prev.includes(service.id)) return prev.filter(sid => sid !== service.id);
      return [...prev, service.id];
    });
  };

  if (loading || !detail) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#be185d" size="large" />
      </View>
    );
  }

  // UI renderers
  const renderHeaderRow = () => (
    <View style={[styles.headerRow, { top: Math.max(insets.top, 10) }]}>
      <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn}>
        <Ionicons name="arrow-back" size={24} color="#0f172a" />
      </Pressable>
      <View style={styles.headerRight}>
        <Pressable style={[styles.iconBtn, { marginRight: 10 }]}>
          <Ionicons name="share-social-outline" size={22} color="#0f172a" />
        </Pressable>
        <Pressable onPress={() => toggleFavorite(barberId)} style={styles.iconBtn}>
          <Ionicons name={favorites.includes(barberId) ? "heart" : "heart-outline"} size={22} color={favorites.includes(barberId) ? "#ef4444" : "#0f172a"} />
        </Pressable>
      </View>
    </View>
  );

  const renderTopInfo = () => (
    <View style={styles.topInfoContainer}>
      <View style={styles.imageAndDetailsRow}>
        <Image source={{ uri: heroImage }} style={styles.shopImage} />
        <View style={styles.detailsCol}>
          <Text style={styles.shopTitle} numberOfLines={2}>{b.shopName || shopName}</Text>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={14} color="#fbbf24" />
            <Text style={styles.ratingText}>
              {b.ratingCount && b.ratingCount > 0 ? (
                <>
                  {b.averageRating || (b.ratingSum / b.ratingCount).toFixed(1)}{" "}
                  <Text style={styles.ratingCount}>({b.ratingCount} Reviews)</Text>
                </>
              ) : (
                <Text style={styles.ratingCount}>New</Text>
              )}
            </Text>
          </View>
          <Text style={styles.categoryText}>{b.businessCategory || "Beauty Parlour"}</Text>
          <View style={styles.statusStylistRow}>
            <View style={styles.statusCol}>
              <View style={styles.statusDotWrapper}>
                 <Ionicons name="time" size={12} color={b.isShopOpen ? "#16a34a" : "#ef4444"} />
              </View>
              <View>
                 <Text style={[styles.openText, { color: b.isShopOpen ? "#16a34a" : "#ef4444" }]}>{b.isShopOpen ? "Open Now" : "Closed"}</Text>
                 <Text style={styles.closeTimeText}>Closes 11:00 PM</Text>
              </View>
            </View>
            {b.user && (
              <View style={styles.stylistCol}>
                 <Ionicons name="person" size={14} color="#be185d" style={{marginRight: 4}} />
                 <View>
                    <Text style={styles.stylistLabel}>Stylist</Text>
                    <Text style={styles.stylistName}>{b.user.name}</Text>
                 </View>
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );

  const renderTabs = () => (
    <View style={styles.tabContainer}>
      <Pressable 
        style={[styles.tabBtn, !isHomeServiceSelected && styles.tabBtnActive]} 
        onPress={() => setIsHomeServiceSelected(false)}
      >
        <Ionicons name="storefront-outline" size={20} color={!isHomeServiceSelected ? "#fff" : "#0f172a"} />
        <Text style={[styles.tabText, !isHomeServiceSelected && styles.tabTextActive]}>Shop Visit</Text>
      </Pressable>
      <Pressable 
        style={[styles.tabBtn, isHomeServiceSelected && styles.tabBtnActive]} 
        onPress={() => setIsHomeServiceSelected(true)}
      >
        <Ionicons name="home-outline" size={20} color={isHomeServiceSelected ? "#fff" : "#0f172a"} />
        <Text style={[styles.tabText, isHomeServiceSelected && styles.tabTextActive]}>Home Service</Text>
      </Pressable>
    </View>
  );

  const renderServiceItem = ({ item }) => {
    const isSelected = selectedServiceIds.includes(item.id);
    return (
      <View style={styles.serviceCard}>
        {item.images && item.images.length > 0 ? (
           <Image source={{ uri: item.images[0] }} style={styles.serviceImg} />
        ) : (
           <View style={styles.serviceImgFallback}><Ionicons name="color-wand" size={24} color="#94a3b8" /></View>
        )}
        <View style={styles.serviceDetails}>
          <Text style={styles.serviceName}>{item.name}</Text>
          <View style={styles.serviceDurationRow}>
             <Ionicons name="time-outline" size={12} color="#64748b" />
             <Text style={styles.serviceDurationText}>{item.durationMinutes} Min</Text>
          </View>
        </View>
        <View style={styles.serviceAction}>
           <Text style={styles.servicePrice}>₹{item.price}</Text>
           <Pressable style={[styles.addBtn, isSelected && styles.addBtnSelected]} onPress={() => toggleService(item)}>
              <Ionicons name={isSelected ? "checkmark" : "add"} size={18} color="#fff" />
           </Pressable>
        </View>
      </View>
    );
  };

  const renderShopVisit = () => (
    <View style={styles.tabContent}>
      {/* Banner */}
      <View style={styles.promoBanner}>
        <View style={{flex: 1}}>
          <Text style={styles.promoTitle}>Visit our salon and enjoy our premium services</Text>
        </View>
        <Ionicons name="business" size={40} color="#be185d" />
      </View>

      {/* Live Chairs */}
      {liveSeats.length > 0 && (
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
             <Text style={styles.sectionTitle}>Live Chairs Status</Text>
             <View style={styles.liveBadge}><View style={styles.liveDot}/><Text style={styles.liveBadgeText}>LIVE</Text></View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chairsScroll}>
            {liveSeats.map(seat => {
               const available = seat.isAvailable;
               return (
                 <View key={seat.index} style={[styles.chairBox, available ? styles.chairAvailable : styles.chairOccupied]}>
                    <Ionicons name="person" size={20} color={available ? "#16a34a" : "#ef4444"} />
                    <Text style={[styles.chairLabel, {color: available ? "#16a34a" : "#ef4444"}]}>Chair {seat.index + 1}</Text>
                    <Text style={[styles.chairStatusText, {color: available ? "#16a34a" : "#ef4444"}]}>{available ? "Available" : "Occupied"}</Text>
                 </View>
               );
            })}
          </ScrollView>
        </View>
      )}

      {/* Shop Services */}
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeader}>
           <View style={styles.rowCenter}><Ionicons name="storefront-outline" size={18} color="#be185d"/><Text style={[styles.sectionTitle, {marginLeft: 6}]}>Shop Services</Text></View>
           <Text style={styles.viewAllText}>View All</Text>
        </View>
        <Text style={styles.sectionSub}>Visit the shop for these services</Text>
        <View style={styles.serviceListContainer}>
          {Object.keys(shopCategorizedServices).length > 0 ? Object.entries(shopCategorizedServices).map(([catName, catservices]) => (
            <View key={catName} style={styles.accordionContainer}>
              <Pressable style={styles.accordionHeader} onPress={() => toggleCategory(catName)}>
                <Text style={[styles.accordionTitle, { textTransform: 'capitalize' }]}>{catName}</Text>
                <Ionicons name={expandedCategories[catName] ? "chevron-up" : "chevron-down"} size={20} color="#be185d" />
              </Pressable>
              
              {expandedCategories[catName] && (
                <View style={styles.accordionContent}>
                  {catservices.map((s) => (
                    <React.Fragment key={s.id}>{renderServiceItem({item: s})}</React.Fragment>
                  ))}
                </View>
              )}
            </View>
          )) : <Text style={styles.emptyText}>No services available</Text>}
        </View>
      </View>

      {/* Working Hours */}
      {b.workingHours && (
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
             <View style={styles.rowCenter}><Ionicons name="time-outline" size={18} color="#be185d"/><Text style={[styles.sectionTitle, {marginLeft: 6}]}>Working Hours</Text></View>
             <Text style={styles.viewAllText}>View All</Text>
          </View>
          <View style={styles.hoursCard}>
             <View style={styles.hoursRow}><Text style={styles.hoursDay}>Mon - Sat</Text><Text style={styles.hoursTime}>9:00 AM - 11:00 PM</Text></View>
             <View style={[styles.hoursRow, {borderBottomWidth: 0}]}><Text style={styles.hoursDay}>Sunday</Text><Text style={styles.hoursTime}>10:00 AM - 11:00 PM</Text></View>
          </View>
        </View>
      )}
    </View>
  );

  const renderHomeService = () => (
    <View style={styles.tabContent}>
      {/* Banner */}
      <View style={styles.promoBannerHome}>
        <View style={{flex: 1}}>
          <Text style={styles.promoTitleHome}>Get our services at your home</Text>
          <Text style={styles.promoSubHome}>Comfort • Safety • Premium</Text>
        </View>
        <Ionicons name="home" size={40} color="#be185d" style={{opacity: 0.8}} />
      </View>

      {/* Address */}
      <View style={styles.sectionBlock}>
         <View style={styles.sectionHeader}>
            <View style={styles.rowCenter}><Ionicons name="location-outline" size={18} color="#be185d"/><Text style={[styles.sectionTitle, {marginLeft: 6}]}>Select Address</Text></View>
            <Text style={styles.viewAllText}>Change</Text>
         </View>
         <View style={styles.addressCard}>
            <Ionicons name="home-outline" size={20} color="#64748b" style={{marginTop: 2}} />
            <View style={{marginLeft: 12, flex: 1}}>
               <Text style={styles.addressTitle}>Home</Text>
               <Text style={styles.addressText}>{homeAddress || "Please add an address"}</Text>
            </View>
         </View>
      </View>

      {/* Beautician */}
      {b.staff && b.staff.length > 0 && (
        <View style={styles.sectionBlock}>
           <View style={styles.sectionHeader}>
              <View style={styles.rowCenter}><Ionicons name="people-outline" size={18} color="#be185d"/><Text style={[styles.sectionTitle, {marginLeft: 6}]}>Select Beautician <Text style={{fontSize: 12, color: "#94a3b8"}}>(Optional)</Text></Text></View>
              <Text style={styles.viewAllText}>View All</Text>
           </View>
           {b.staff.map(st => (
             <Pressable key={st._id} style={styles.staffRow} onPress={() => setSelectedStaffId(st._id)}>
               <View style={styles.staffAvatar}><Ionicons name="person" size={24} color="#94a3b8" /></View>
               <View style={styles.staffDetails}>
                  <Text style={styles.staffNameText}>{st.name}</Text>
                  <Text style={styles.staffExpText}>5+ Years Exp. • 256 Services</Text>
               </View>
               <View style={[styles.radioCircle, selectedStaffId === st._id && styles.radioCircleActive]}>
                  {selectedStaffId === st._id && <View style={styles.radioDot} />}
               </View>
             </Pressable>
           ))}
        </View>
      )}

      {/* Home Service Charges */}
      <View style={styles.sectionBlock}>
         <View style={styles.chargeRow}>
            <View style={styles.rowCenter}>
               <Ionicons name="shield-checkmark-outline" size={18} color="#10b981" />
               <Text style={[styles.sectionTitle, {marginLeft: 6, color: "#0f172a"}]}>Home Service Charges</Text>
            </View>
            <Text style={styles.chargePrice}>₹{homeServiceFee}</Text>
         </View>
         <Text style={styles.chargeSub}>This charge will be added to your final bill</Text>
      </View>

      {/* Home Services List */}
      <View style={[styles.sectionBlock, {marginBottom: 100}]}>
         <View style={styles.sectionHeader}>
            <View style={styles.rowCenter}><Ionicons name="color-palette-outline" size={18} color="#be185d"/><Text style={[styles.sectionTitle, {marginLeft: 6}]}>Home Services</Text></View>
            <Text style={styles.viewAllText}>View All</Text>
         </View>
         <View style={styles.serviceListContainer}>
          {Object.keys(homeCategorizedServices).length > 0 ? Object.entries(homeCategorizedServices).map(([catName, catservices]) => (
            <View key={`home_${catName}`} style={styles.accordionContainer}>
              <Pressable style={styles.accordionHeader} onPress={() => toggleCategory(`home_${catName}`)}>
                <Text style={[styles.accordionTitle, { textTransform: 'capitalize' }]}>{catName}</Text>
                <Ionicons name={expandedCategories[`home_${catName}`] ? "chevron-up" : "chevron-down"} size={20} color="#be185d" />
              </Pressable>
              
              {expandedCategories[`home_${catName}`] && (
                <View style={styles.accordionContent}>
                  {catservices.map((s) => (
                    <React.Fragment key={s.id}>{renderServiceItem({item: s})}</React.Fragment>
                  ))}
                </View>
              )}
            </View>
          )) : <Text style={styles.emptyText}>No home services available</Text>}
         </View>
      </View>
    </View>
  );

  const screenWidth = Dimensions.get("window").width;

  return (
    <View style={styles.wrapper}>
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={{paddingBottom: 150}} 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#be185d" />}
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
              <Text style={styles.shopTitle}>{b.shopName || shopName || "Premium Parlour"}</Text>
              <Text style={styles.shopCategory}>{b.businessCategory || "Beauty & Makeup Services"}</Text>
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
              <Ionicons name="time" size={20} color="#be185d" />
              <View style={styles.metaTextCol}>
                <Text style={styles.metaLabel}>Status</Text>
                <Text style={[styles.metaValue, { color: b.isShopOpen ? "#16a34a" : "#ef4444" }]}>
                  {b.isShopOpen ? "Open Now" : "Closed"}
                </Text>
              </View>
            </View>
            
            {b.user && (
              <View style={styles.metaItem}>
                <Ionicons name="person" size={20} color="#be185d" />
                <View style={styles.metaTextCol}>
                  <Text style={styles.metaLabel}>Beautician</Text>
                  <Text style={styles.metaValue}>{b.user.name}</Text>
                </View>
              </View>
            )}
          </View>

          {(b.address?.line1 || b.address?.city) && (
            <Pressable onPress={openMap} style={styles.locationBox}>
              <View style={styles.locIconWrap}>
                <Ionicons name="location" size={20} color="#3b82f6" />
              </View>
              <View style={styles.locTextWrap}>
                <Text style={styles.locTitle}>Shop Location</Text>
                <Text style={styles.locAddress}>{[b.address.line1, b.address.city, b.address.pincode].filter(Boolean).join(", ")}</Text>
              </View>
              <Ionicons name="arrow-forward" size={16} color="#94a3b8" />
            </Pressable>
          )}
        </View>

        {renderTabs()}
        {isHomeServiceSelected ? renderHomeService() : renderShopVisit()}
      </ScrollView>

      {/* Floating Footer */}
      <View style={styles.floatingFooter}>
         <View style={styles.footerInfo}>
            <View style={styles.cartIconBadge}>
               <Ionicons name="cart" size={20} color="#be185d" />
               <View style={styles.badge}><Text style={styles.badgeText}>{selectedServiceIds.length}</Text></View>
            </View>
            <View style={{marginLeft: 12}}>
               <Text style={styles.selectedCountText}>{selectedServiceIds.length} Services Selected</Text>
               <Text style={styles.totalTimeText}>Total Duration: {totalDuration} mins</Text>
               <Text style={styles.totalPriceText}>Total Price</Text>
               <Text style={styles.totalPriceValue}>₹{totalPrice + homeServiceFee}</Text>
            </View>
         </View>
         <Pressable 
           style={[styles.bookBtnAction, (selectedServiceIds.length === 0 || bookingBusy || (isHomeServiceSelected && !b.offersHomeService)) && {opacity: 0.5}]}
           onPress={handleBookIntent}
           disabled={selectedServiceIds.length === 0 || bookingBusy || (isHomeServiceSelected && !b.offersHomeService)}
         >
           {bookingBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.bookBtnActionText}>
              {isHomeServiceSelected && !b.offersHomeService ? "Currently Unavailable" : "Book Appointment"}
           </Text>}
         </Pressable>
      </View>

      {/* Premium Confirm Modal */}
      <Modal visible={confirmModalVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Confirm Booking</Text>
              <Pressable onPress={() => setConfirmModalVisible(false)}><Ionicons name="close" size={24} color="#64748b" /></Pressable>
            </View>
            {!isHomeServiceSelected && liveSeats.length > 0 && (
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Select Chair</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {liveSeats.map(seat => (
                    <Pressable 
                      key={seat.index} 
                      style={[styles.modalChairBtn, selectedChairIndex === seat.index && styles.modalChairBtnActive]}
                      onPress={() => setSelectedChairIndex(seat.index)}
                    >
                      <Text style={[styles.modalChairBtnText, selectedChairIndex === seat.index && styles.modalChairBtnTextActive]}>Chair {seat.index + 1}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
            
            {!isHomeServiceSelected && (
              <View style={styles.modalSection}>
                 <Text style={styles.modalSectionTitle}>ETA (Arrival Time)</Text>
                 <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
                   {[5, 10, 15, 30].map(mins => {
                     const isActive = selectedETA === mins;
                     return (
                       <Pressable
                         key={mins}
                         style={[styles.modalChairBtn, isActive && styles.modalChairBtnActive, { flex: 1, minWidth: "40%", alignItems: "center" }]}
                         onPress={() => {
                           setSelectedETA(mins);
                           setCustomETA("");
                         }}
                       >
                         <Text style={[styles.modalChairBtnText, isActive && styles.modalChairBtnTextActive]}>{mins} mins</Text>
                       </Pressable>
                     );
                   })}
                 </View>

                 <View style={{ marginTop: 16 }}>
                    <Text style={{ fontSize: 13, color: "#64748b", marginBottom: 6, fontWeight: "600" }}>Or enter custom time (minutes):</Text>
                    <TextInput 
                       style={{ borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, padding: 12, fontSize: 15, color: "#0f172a", backgroundColor: "#fdf2f8" }}
                       placeholder="e.g. 45"
                       keyboardType="number-pad"
                       value={customETA}
                       onChangeText={(val) => {
                          setCustomETA(val);
                          const parsed = parseInt(val, 10);
                          if (!isNaN(parsed) && parsed >= 0) {
                             setSelectedETA(parsed);
                          } else if (val === "") {
                             setSelectedETA(null);
                          }
                       }}
                    />
                 </View>
              </View>
            )}
            <Pressable style={styles.confirmSubmitBtn} onPress={executeBooking} disabled={bookingBusy}>
              <Text style={styles.confirmSubmitBtnText}>Confirm & Book</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

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
                  
                  {/* Watermarks Container */}
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
  wrapper: { flex: 1, backgroundColor: "#fdf2f8" },
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  
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
    top: 40,
    right: 20,
    zIndex: 100,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  zoomImageWrapper: {
    width: "100%",
    height: "80%",
    position: "relative",
  },
  zoomScrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  zoomImage: {
    width: Dimensions.get("window").width,
    height: "100%",
  },
  watermarkContainer: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 10,
  },
  watermarkLeft: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(255,255,255,0.6)",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  watermarkRight: {
    fontSize: 11,
    fontWeight: "900",
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 1.5,
  },

  paginationContainer: {
    position: "absolute",
    bottom: 24,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: "#ffffff",
    width: 20,
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
    marginTop: -24,
    paddingTop: 30,
    paddingHorizontal: 24,
    paddingBottom: 24,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 10,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  shopTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#0f172a",
  },
  shopCategory: {
    fontSize: 14,
    color: "#be185d",
    fontWeight: "700",
    marginTop: 4,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fffdf5",
    borderWidth: 1,
    borderColor: "#fef3c7",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#d97706",
    marginLeft: 4,
  },
  divider: {
    height: 1,
    backgroundColor: "#f1f5f9",
    marginVertical: 16,
  },
  metaInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  metaTextCol: {
    marginLeft: 12,
  },
  metaLabel: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  metaValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
    marginTop: 2,
  },
  locationBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  locIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#eff6ff",
    justifyContent: "center",
    alignItems: "center",
  },
  locTextWrap: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  locTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1e293b",
  },
  locAddress: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
    fontWeight: "500",
  },

  tabContainer: { flexDirection: "row", marginHorizontal: 16, marginTop: 16, backgroundColor: "#fff", borderRadius: 12, padding: 4 },
  tabBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: 8 },
  tabBtnActive: { backgroundColor: "#be185d" },
  tabText: { fontSize: 14, fontWeight: "700", color: "#0f172a", marginLeft: 8 },
  tabTextActive: { color: "#fff" },

  tabContent: { paddingHorizontal: 16, paddingTop: 20 },
  
  promoBanner: { flexDirection: "row", backgroundColor: "#fce7f3", padding: 16, borderRadius: 16, alignItems: "center", marginBottom: 20 },
  promoTitle: { fontSize: 15, fontWeight: "700", color: "#831843", lineHeight: 22 },
  
  promoBannerHome: { flexDirection: "row", backgroundColor: "#fce7f3", padding: 16, borderRadius: 16, alignItems: "center", marginBottom: 20 },
  promoTitleHome: { fontSize: 16, fontWeight: "800", color: "#831843" },
  promoSubHome: { fontSize: 12, color: "#be185d", marginTop: 4, fontWeight: "600" },

  sectionBlock: { marginBottom: 24, backgroundColor: "#fff", padding: 16, borderRadius: 16 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  sectionSub: { fontSize: 13, color: "#64748b", marginBottom: 12 },
  rowCenter: { flexDirection: "row", alignItems: "center" },
  viewAllText: { fontSize: 13, fontWeight: "700", color: "#be185d" },

  liveBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "#fee2e2", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#ef4444", marginRight: 4 },
  liveBadgeText: { fontSize: 10, fontWeight: "800", color: "#ef4444" },
  chairsScroll: { gap: 10 },
  chairBox: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, alignItems: "center", marginRight: 10, minWidth: 90 },
  chairAvailable: { backgroundColor: "#dcfce7" },
  chairOccupied: { backgroundColor: "#fee2e2" },
  chairLabel: { fontSize: 13, fontWeight: "700", marginTop: 4 },
  chairStatusText: { fontSize: 11, fontWeight: "600", marginTop: 2 },

  hoursCard: { backgroundColor: "#fdf2f8", borderRadius: 12, padding: 12 },
  hoursRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  hoursDay: { fontSize: 14, color: "#475569" },
  hoursTime: { fontSize: 14, fontWeight: "700", color: "#0f172a" },

  filterScroll: { gap: 10, marginBottom: 16 },
  filterPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: "#f1f5f9" },
  filterPillActive: { backgroundColor: "#be185d" },
  filterPillText: { fontSize: 13, fontWeight: "600", color: "#475569" },
  filterPillTextActive: { color: "#fff" },

  accordionContainer: { marginBottom: 12, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 16, overflow: "hidden" },
  accordionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, backgroundColor: "#fdf2f8" },
  accordionTitle: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  accordionContent: { padding: 16, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#e2e8f0", gap: 12 },

  serviceListContainer: { gap: 16 },
  serviceCard: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  serviceImg: { width: 60, height: 60, borderRadius: 12 },
  serviceImgFallback: { width: 60, height: 60, borderRadius: 12, backgroundColor: "#f1f5f9", justifyContent: "center", alignItems: "center" },
  serviceDetails: { flex: 1, marginLeft: 12 },
  serviceName: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  serviceDurationRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  serviceDurationText: { fontSize: 12, color: "#64748b", marginLeft: 4 },
  serviceAction: { alignItems: "flex-end" },
  servicePrice: { fontSize: 16, fontWeight: "800", color: "#0f172a", marginBottom: 8 },
  addBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#be185d", justifyContent: "center", alignItems: "center" },
  addBtnSelected: { backgroundColor: "#10b981" },

  addressCard: { flexDirection: "row", backgroundColor: "#fdf2f8", padding: 12, borderRadius: 12 },
  addressTitle: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  addressText: { fontSize: 13, color: "#64748b", marginTop: 2 },

  dateScroll: { gap: 12 },
  dateCard: { width: 64, height: 80, borderRadius: 16, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", justifyContent: "center", alignItems: "center", marginRight: 10 },
  dateCardActive: { backgroundColor: "#be185d", borderColor: "#be185d" },
  dateDayName: { fontSize: 12, color: "#64748b", fontWeight: "600" },
  dateDayNum: { fontSize: 20, fontWeight: "800", color: "#0f172a", marginVertical: 2 },
  dateMonth: { fontSize: 12, color: "#64748b", fontWeight: "600" },
  dateTextActive: { color: "#fff" },

  slotGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  slotItem: { width: "30%", height: 40, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", justifyContent: "center", alignItems: "center" },
  slotItemActive: { backgroundColor: "#be185d", borderColor: "#be185d" },
  slotItemBooked: { backgroundColor: "#f1f5f9", borderColor: "#f1f5f9" },
  slotItemText: { fontSize: 13, fontWeight: "700", color: "#0f172a" },
  slotItemTextActive: { color: "#fff" },
  slotItemTextBooked: { color: "#94a3b8", textDecorationLine: "line-through" },
  emptyText: { fontSize: 14, color: "#64748b", textAlign: "center" },

  staffRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", padding: 12, borderRadius: 12, marginBottom: 10 },
  staffAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#f1f5f9", justifyContent: "center", alignItems: "center" },
  staffDetails: { flex: 1, marginLeft: 12 },
  staffNameText: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  staffExpText: { fontSize: 12, color: "#64748b", marginTop: 2 },
  radioCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: "#cbd5e1", justifyContent: "center", alignItems: "center" },
  radioCircleActive: { borderColor: "#be185d" },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#be185d" },

  chargeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  chargePrice: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  chargeSub: { fontSize: 12, color: "#64748b", marginTop: 4 },

  floatingFooter: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#fff", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24, shadowColor: "#000", shadowOffset: {width: 0, height: -4}, shadowOpacity: 0.1, shadowRadius: 10, elevation: 15, flexDirection: "row", alignItems: "center" },
  footerInfo: { flex: 1, flexDirection: "row", alignItems: "center" },
  cartIconBadge: { position: "relative", width: 44, height: 44, borderRadius: 22, backgroundColor: "#fce7f3", justifyContent: "center", alignItems: "center" },
  badge: { position: "absolute", top: -4, right: -4, backgroundColor: "#ef4444", width: 18, height: 18, borderRadius: 9, justifyContent: "center", alignItems: "center" },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  selectedCountText: { fontSize: 10, color: "#64748b", fontWeight: "600" },
  totalTimeText: { fontSize: 10, color: "#64748b" },
  totalPriceText: { fontSize: 14, fontWeight: "700", color: "#0f172a", marginTop: 2 },
  totalPriceValue: { fontSize: 20, fontWeight: "900", color: "#0f172a" },
  bookBtnAction: { backgroundColor: "#be185d", height: 50, borderRadius: 12, justifyContent: "center", alignItems: "center", paddingHorizontal: 20, marginLeft: 16 },
  bookBtnActionText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  modalSection: { marginBottom: 20 },
  modalSectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 10 },
  modalChairBtn: { padding: 12, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, marginRight: 10 },
  modalChairBtnActive: { backgroundColor: "#be185d", borderColor: "#be185d" },
  modalChairBtnText: { color: "#0f172a" },
  modalChairBtnTextActive: { color: "#fff" },
  confirmSubmitBtn: { backgroundColor: "#be185d", height: 50, borderRadius: 12, justifyContent: "center", alignItems: "center", marginTop: 10 },
  confirmSubmitBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" }
});
