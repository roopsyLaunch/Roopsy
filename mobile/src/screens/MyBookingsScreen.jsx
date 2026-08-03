import React, { useCallback, useState, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Platform, Linking
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api/client";
import { getSocket } from "../api/socket";
import { useAuth } from "../context/AuthContext";

function formatDateLabel(isoDate) {
  const d = new Date(isoDate);
  return `${d.toLocaleDateString(undefined, { day: "numeric", month: "short" })}, ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function formatTime(isoDate) {
  return new Date(isoDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateOnly(isoDate) {
  return new Date(isoDate).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

const LiveCountdown = ({ targetDate }) => {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const update = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("Late");
        return;
      }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${m}m ${s < 10 ? '0' : ''}${s}s`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (!timeLeft) return null;

  return (
    <View style={styles.countdownBadge}>
      <Text style={styles.countdownText}>
        {timeLeft === "Late" ? "Overdue" : `In ${timeLeft}`}
      </Text>
    </View>
  );
};

export function MyBookingsScreen({ navigation }) {
  const { user } = useAuth();
  const isPartner = user?.role === "barber" || user?.role === "admin";
  
  const [viewMode, setViewMode] = useState(isPartner ? "Shop Queue" : "My Appointments"); // My Appointments, Shop Queue
  const [queueSegment, setQueueSegment] = useState("Upcoming"); // Upcoming, Completed, Cancelled
  
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  
  // Custom OTP Modal State
  const [otpModalVisible, setOtpModalVisible] = useState(false);
  const [otpInput, setOtpInput] = useState("");
  const [activeBookingId, setActiveBookingId] = useState(null);
  const [verifying, setVerifying] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  
  // History Modal
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [customerHistory, setCustomerHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Walk-in Modal
  const [walkInModalVisible, setWalkInModalVisible] = useState(false);
  const [walkInName, setWalkInName] = useState("");
  const [shopServices, setShopServices] = useState([]);
  const [selectedWalkInServices, setSelectedWalkInServices] = useState([]);
  const [submittingWalkIn, setSubmittingWalkIn] = useState(false);

  // Review Modal
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewBookingId, setReviewBookingId] = useState(null);
  const [reviewBarberId, setReviewBarberId] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  // Tailor Rating Modal State
  const [tailorRatingModalVisible, setTailorRatingModalVisible] = useState(false);
  const [tailorRatingOrder, setTailorRatingOrder] = useState(null);
  const [tailorRating, setTailorRating] = useState(5);
  const [tailorComment, setTailorComment] = useState("");
  const [submittingTailorRating, setSubmittingTailorRating] = useState(false);

  const openTailorRatingModal = (order) => {
    setTailorRatingOrder(order);
    setTailorRating(order?.rating || 5);
    setTailorComment(order?.reviewComment || "");
    setTailorRatingModalVisible(true);
  };

  const handleSubmittingTailorRating = async () => {
    if (!tailorRatingOrder) return;
    setSubmittingTailorRating(true);
    try {
      const orderId = tailorRatingOrder._id || tailorRatingOrder.id;
      await api.post(`/tailors/orders/${orderId}/rate`, {
        rating: tailorRating,
        comment: tailorComment
      });
      Alert.alert("Thank You! ⭐️", "Your tailor rating & review has been saved successfully.");
      setTailorRatingModalVisible(false);
      setTailorRatingOrder(null);
      await load();
    } catch (err) {
      console.error(err);
      Alert.alert("Error", err?.response?.data?.error || "Failed to submit rating");
    } finally {
      setSubmittingTailorRating(false);
    }
  };

  const [confirmHomeModalVisible, setConfirmHomeModalVisible] = useState(false);
  const [confirmETA, setConfirmETA] = useState("");
  const [confirmingBookingId, setConfirmingBookingId] = useState(null);

  // Customer Section Filter States
  const [customerTab, setCustomerTab] = useState("all"); // "all", "pending", "active", "history"
  const [serviceTypeFilter, setServiceTypeFilter] = useState("all"); // "all", "tailor", "barber"

  const load = useCallback(async () => {
    try {
      if (viewMode === "My Appointments") {
        const [barberRes, tailorRes] = await Promise.all([
          api.get("/bookings/me").catch(() => ({ data: { bookings: [] } })),
          api.get("/tailors/me/orders/customer").catch(() => ({ data: { orders: [] } }))
        ]);
        const barberBookings = (barberRes.data?.bookings || []).map(b => ({ ...b, isTailorOrder: false }));
        const tailorOrders = (tailorRes.data?.orders || []).map(o => ({ ...o, isTailorOrder: true }));
        const combined = [...barberBookings, ...tailorOrders].sort((a, b) => {
          const dateA = new Date(a.startTime || a.createdAt).getTime();
          const dateB = new Date(b.startTime || b.createdAt).getTime();
          return dateB - dateA;
        });
        setItems(combined);
      } else if (isPartner) {
        const res = await api.get("/bookings/barber");
        setItems(res.data.bookings || []);
        
        const svcRes = await api.get("/barbers/me");
        if (svcRes.data?.services) {
          setShopServices(svcRes.data.services);
        }
      }
    } catch (err) {
      console.error(err);
    }
  }, [viewMode, isPartner]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      (async () => {
        if (items.length === 0) setLoading(true);
        try {
          if (isActive) await load();
        } finally {
          if (isActive) setLoading(false);
        }
      })();
      
      const socket = getSocket();
      if (user?.id) {
        socket.emit("joinUserRoom", user.id);
      }
      
      const handleBookingUpdated = (data) => {
        if (isActive) {
          load();
          if (data && (data.isOtpVerified || data.message === "OTP Verified ✅")) {
            Alert.alert("OTP Verified! ✅", "Your OTP was verified by the barber partner. Haircut service is now in progress!");
          }
          if (data && data.requestRating && data.orderId) {
            api.get(`/tailors/orders/${data.orderId}`).then(res => {
              if (res.data?.order) {
                openTailorRatingModal(res.data.order);
              }
            }).catch(() => {});
          }
        }
      };

      const handleTailorOrderCompleted = (data) => {
        if (isActive) {
          load();
          if (data && data.orderId) {
            api.get(`/tailors/orders/${data.orderId}`).then(res => {
              if (res.data?.order) {
                openTailorRatingModal(res.data.order);
              }
            }).catch(() => {});
          }
        }
      };
      
      socket.on("bookingUpdated", handleBookingUpdated);
      socket.on("tailorOrderCompleted", handleTailorOrderCompleted);
      
      return () => { 
        isActive = false; 
        if (user?.id) socket.emit("leaveUserRoom", user.id);
        socket.off("bookingUpdated", handleBookingUpdated);
        socket.off("tailorOrderCompleted", handleTailorOrderCompleted);
      };
    }, [load, user?.id])
  );

  async function onRefresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  async function setStatus(id, status, startTime = null, isHomeService = false) {
    if (status === "confirmed" && isHomeService) {
      setConfirmingBookingId(id);
      setConfirmETA("");
      setConfirmHomeModalVisible(true);
      return;
    }
    
    let confirmMsg = `Are you sure you want to mark this booking as ${status}?`;
    if (status === "confirmed" && startTime) {
      confirmMsg = `Confirm this booking for arrival at ${formatTime(startTime)}?`;
    } else if (status === "cancelled" && viewMode === "My Appointments") {
      confirmMsg = "Are you sure you want to cancel this booking?";
    }
    
    Alert.alert("Confirm Action", confirmMsg, [
      { text: "No", style: "cancel" },
      {
        text: "Yes",
        style: status === "cancelled" ? "destructive" : "default",
        onPress: async () => {
          try {
            await api.patch(`/bookings/${id}`, { status });
            await load();
          } catch (e) {
            const err = e?.response?.data?.error;
            Alert.alert("Error", typeof err === "string" ? err : JSON.stringify(err || e.message));
          }
        },
      },
    ]);
  }

  const promptVerifyOtp = (bookingId) => {
    setActiveBookingId(bookingId);
    setOtpInput("");
    setOtpModalVisible(true);
  };

  const submitOtp = async () => {
    if (!otpInput || otpInput.length !== 4) {
      Alert.alert("Error", "Please enter a valid 4-digit OTP");
      return;
    }
    setVerifying(true);
    try {
      await api.post("/bookings/verify-otp", { bookingId: activeBookingId, otp: otpInput });
      setOtpModalVisible(false);
      Alert.alert("Success", "Customer verified and haircut started. A vacant slot has been occupied.");
      await load();
    } catch (e) {
      const err = e?.response?.data?.error;
      Alert.alert("Verification Failed", typeof err === "string" ? err : JSON.stringify(err || e.message));
    } finally {
      setVerifying(false);
    }
  };

  const openHistory = async (phone) => {
    if (!phone) return Alert.alert("Error", "No phone number available for this customer");
    setHistoryModalVisible(true);
    setLoadingHistory(true);
    try {
      const res = await api.get(`/barbers/customer-history/${phone}`);
      setCustomerHistory(res.data.history || []);
    } catch (e) {
      Alert.alert("Error", "Failed to load history");
    } finally {
      setLoadingHistory(false);
    }
  };

  const submitWalkIn = async () => {
    if (selectedWalkInServices.length === 0) return Alert.alert("Error", "Select at least one service");
    setSubmittingWalkIn(true);
    try {
      await api.post("/bookings/walk-in", {
        customerName: walkInName,
        serviceIds: selectedWalkInServices,
        startTime: new Date().toISOString()
      });
      setWalkInModalVisible(false);
      setWalkInName("");
      setSelectedWalkInServices([]);
      Alert.alert("Success", "Walk-in customer added to queue");
      await load();
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.error || e.message);
    } finally {
      setSubmittingWalkIn(false);
    }
  };

  const submitReview = async () => {
    if (rating < 1 || rating > 5) return Alert.alert("Error", "Please provide a valid rating between 1 and 5");
    setSubmittingReview(true);
    try {
      await api.post("/reviews", {
        barberId: reviewBarberId,
        bookingId: reviewBookingId,
        rating,
        comment
      });
      setReviewModalVisible(false);
      setRating(5);
      setComment("");
      Alert.alert("Success", "Thank you for your review!");
      await load();
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.error || e.message);
    } finally {
      setSubmittingReview(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case "confirmed":
      case "approved":
        return { bg: "#dcfce7", text: "#15803d", icon: "checkmark-circle" };
      case "in-progress":
        return { bg: "#dbeafe", text: "#1d4ed8", icon: "time" };
      case "completed":
        return { bg: "#f3e8ff", text: "#7e22ce", icon: "checkmark-done-circle" };
      case "pending":
        return { bg: "#fef3c7", text: "#b45309", icon: "time" };
      case "cancelled":
      case "declined":
      case "rejected":
      case "expired":
        return { bg: "#fee2e2", text: "#ef4444", icon: "close-circle" };
      default:
        return { bg: "#f1f5f9", text: "#475569", icon: "information-circle" };
    }
  };

  const getInitials = (name) => {
    if (!name) return "S";
    const parts = name.split(" ");
    if (parts.length > 1) return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    return parts[0].charAt(0).toUpperCase();
  };

  const getBookingType = useCallback((item) => {
    if (item.isTailorOrder) return "tailor";
    const cat = (item.barber?.businessCategory || "").toLowerCase();
    const pref = (item.barber?.genderPreference || "").toLowerCase();
    const svcs = (item.services || []).map(s => ((s.category || "") + " " + (s.name || "")).toLowerCase()).join(" ");
    
    if (
      cat.includes("beauty") || cat.includes("parlor") || 
      pref === "women_only" || 
      svcs.includes("beauty") || svcs.includes("parlor") || 
      svcs.includes("facial") || svcs.includes("makeup") || 
      svcs.includes("waxing") || svcs.includes("thread") || 
      svcs.includes("manicure") || svcs.includes("pedicure")
    ) {
      return "beauty";
    }
    return "barber";
  }, []);

  const customerCounts = React.useMemo(() => {
    let base = items;
    if (serviceTypeFilter !== "all") {
      base = items.filter(i => getBookingType(i) === serviceTypeFilter);
    }

    const all = base.length;
    const pending = base.filter(i => (i.status || "").toLowerCase() === "pending").length;
    const active = base.filter(i => ["accepted", "confirmed", "stitching", "ready", "in-progress", "measuring", "trial", "dispatched"].includes((i.status || "").toLowerCase())).length;
    const history = base.filter(i => ["completed", "cancelled", "declined", "rejected", "expired"].includes((i.status || "").toLowerCase())).length;

    return { all, pending, active, history };
  }, [items, serviceTypeFilter, getBookingType]);

  const activeOtpBooking = React.useMemo(() => {
    return items.find(i => i.isTailorOrder && (
      (i.status === "accepted" && i.otp && !i.isOtpVerified) ||
      (i.deliveryOtp && !i.isDeliveryOtpVerified)
    ));
  }, [items]);

  const filteredItems = React.useMemo(() => {
    let list = items;
    if (viewMode === "Shop Queue") {
      list = items.filter((item) => {
        const status = item.status?.toLowerCase();
        if (queueSegment === "Upcoming") return status === "pending" || status === "confirmed" || status === "approved" || status === "in-progress";
        if (queueSegment === "Completed") return status === "completed";
        if (queueSegment === "Cancelled") return status === "cancelled" || status === "declined" || status === "rejected" || status === "expired";
        return true;
      });
    } else {
      // Customer View ("My Appointments")
      if (serviceTypeFilter !== "all") {
        list = list.filter(i => getBookingType(i) === serviceTypeFilter);
      }

      if (customerTab === "pending") {
        list = list.filter(i => (i.status || "").toLowerCase() === "pending");
      } else if (customerTab === "active") {
        list = list.filter(i => ["accepted", "confirmed", "stitching", "ready", "in-progress", "measuring", "trial", "dispatched"].includes((i.status || "").toLowerCase()));
      } else if (customerTab === "history") {
        list = list.filter(i => ["completed", "cancelled", "declined", "rejected", "expired"].includes((i.status || "").toLowerCase()));
      }
    }

    if (searchQuery) {
      list = list.filter(item => {
        const name = item.customer?.name || item.barber?.shopName || item.tailorId?.shopName || "";
        const phone = item.customer?.phone || "";
        const svcs = (item.services || []).map(s => s.name).join(" ");
        return name.toLowerCase().includes(searchQuery.toLowerCase()) || phone.includes(searchQuery) || svcs.toLowerCase().includes(searchQuery.toLowerCase());
      });
    }
    
    if (viewMode === "Shop Queue" && queueSegment === "Upcoming") {
      list.sort((a, b) => {
        if (a.status === "in-progress" && b.status !== "in-progress") return -1;
        if (b.status === "in-progress" && a.status !== "in-progress") return 1;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
    }
    
    return list;
  }, [items, viewMode, queueSegment, customerTab, serviceTypeFilter, searchQuery]);

  const getCheckInTimes = (item) => {
    const timeToUse = (item.isHomeService && item.barberArrivalTime) ? item.barberArrivalTime : (item.arrivalTime || item.startTime);
    const start = item.checkInStart ? new Date(item.checkInStart) : new Date(new Date(timeToUse).getTime() - 30 * 60000);
    const end = item.checkInEnd ? new Date(item.checkInEnd) : new Date(new Date(timeToUse).getTime() + (item.isHomeService ? 120 * 60000 : 15 * 60000));
    return { start, end };
  };

  const renderCustomerCard = (item) => {
    const statusStyle = getStatusBadge(item.status);
    const isBeauty = getBookingType(item) === "beauty";
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={[styles.avatarCircle, { backgroundColor: isBeauty ? "#fce7f3" : "#e0e7ff", borderColor: isBeauty ? "#fbcfe8" : "#c7d2fe" }]}>
              <Text style={[styles.avatarText, { color: isBeauty ? "#be185d" : "#4f46e5" }]}>{isBeauty ? "💄" : getInitials(item.barber?.shopName)}</Text>
            </View>
            <View style={styles.cardHeaderInfo}>
              <Text style={styles.shopName} numberOfLines={1}>{item.barber?.shopName || (isBeauty ? "Beauty Parlor" : "Barber Shop")}</Text>
              <Text style={styles.bookingIdText}>{isBeauty ? "💄 BEAUTY • " : "💈 SALON • "}ID: {item.id.slice(-6).toUpperCase()}</Text>
            </View>
          </View>
          <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
            <Ionicons name={statusStyle.icon} size={12} color={statusStyle.text} style={{ marginRight: 4 }} />
            <Text style={[styles.badgeText, { color: statusStyle.text }]}>{item.status}</Text>
          </View>
        </View>

        <View style={styles.cardDivider} />

        {/* Live Queue Position & Delay */}
        {["pending", "confirmed", "arrived"].includes(item.status) && item.queuePosition > 0 && (
          <View style={{ backgroundColor: "#ffedd5", padding: 12, borderRadius: 12, marginBottom: 16, flexDirection: "row", alignItems: "center" }}>
             <Ionicons name="people" size={20} color="#ea580c" style={{marginRight: 8}}/>
             <View>
               <Text style={{color: "#c2410c", fontWeight: "700", fontSize: 14}}>Queue Position: #{item.queuePosition}</Text>
               <Text style={{color: "#ea580c", fontSize: 12}}>Customers ahead of you: {item.queuePosition - 1}</Text>
             </View>
          </View>
        )}
        
        {item.delayMinutes > 0 && (
          <View style={{ backgroundColor: "#fee2e2", padding: 12, borderRadius: 12, marginBottom: 16, flexDirection: "row", alignItems: "center" }}>
             <Ionicons name="warning" size={20} color="#ef4444" style={{marginRight: 8}}/>
             <View>
               <Text style={{color: "#b91c1c", fontWeight: "700", fontSize: 14}}>Service Delayed</Text>
               <Text style={{color: "#ef4444", fontSize: 12}}>Estimated delay: {item.delayMinutes} mins</Text>
             </View>
          </View>
        )}

        <View style={styles.detailsGrid}>
          <View style={styles.detailBlock}>
            <Text style={styles.detailLabel}>Date</Text>
            <Text style={styles.detailValue}>{formatDateOnly(item.arrivalTime || item.startTime)}</Text>
          </View>
          <View style={styles.detailBlock}>
            <Text style={styles.detailLabel}>Time</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={styles.detailValue}>{formatTime(item.arrivalTime || item.startTime)}</Text>
              {!item.isHomeService && (item.status === 'pending' || item.status === 'confirmed') && (
                <LiveCountdown targetDate={item.arrivalTime || item.startTime} />
              )}
            </View>
          </View>
          {item.isHomeService && item.status === 'confirmed' && item.barberArrivalTime && (
            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>Barber Arrival</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={styles.detailValue}>{formatTime(item.barberArrivalTime)}</Text>
                <LiveCountdown targetDate={item.barberArrivalTime} />
              </View>
            </View>
          )}
        </View>

        {item.seatLabel && (
          <View style={styles.seatHighlightBox}>
            <Ionicons name="person" size={16} color="#854d0e" />
            <Text style={styles.seatHighlightLabel}>Assigned Chair:</Text>
            <Text style={styles.seatHighlightValue}>{item.seatLabel}</Text>
          </View>
        )}

        {item.services?.length ? (
          <View style={styles.svcContainer}>
            <Text style={styles.svcTitle}>Services Requested:</Text>
            <View style={styles.svcTags}>
              {item.services.map((s, i) => (
                <View key={i} style={styles.svcTag}>
                  <Text style={styles.svcTagText}>{s.name} - ₹{s.price || 0}</Text>
                </View>
              ))}
            </View>
            <Text style={{fontSize: 13, fontWeight: "700", color: "#334155", marginTop: 8}}>Total: ₹{item.services.reduce((sum, s) => sum + (s.price || 0), 0)}</Text>
          </View>
        ) : null}

        {item.isHomeService && (
          <View style={[styles.homeServiceBadge, { flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "100%" }]}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="home" size={14} color="#6d28d9" style={{ marginRight: 6 }} />
              <Text style={styles.homeServiceBadgeText}>Home Service</Text>
            </View>
            {item.barber?.phone && (
              <Pressable style={{ flexDirection: 'row', alignItems: 'center' }} onPress={() => Linking.openURL(`tel:${item.barber.phone}`)}>
                <Ionicons name="call" size={12} color="#6d28d9" style={{ marginRight: 4 }} />
                <Text style={{ fontSize: 12, color: "#6d28d9", textDecorationLine: 'underline', fontWeight: 'bold' }}>{item.barber.phone}</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* OTP Verified / Service In Progress Banner for Barber Booking */}
        {(item.status === "in-progress" || item.isOtpVerified) && (
          <View style={{ backgroundColor: "#ecfdf5", padding: 14, borderRadius: 14, marginBottom: 14, borderWidth: 1, borderColor: "#a7f3d0" }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                <Ionicons name="checkmark-circle" size={24} color="#059669" style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, fontWeight: "800", color: "#065f46", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Identity Verified ✅
                  </Text>
                  <Text style={{ fontSize: 15, fontWeight: "900", color: "#047857", marginTop: 2 }}>
                    OTP Verified • Service In Progress ✂️
                  </Text>
                </View>
              </View>
              <View style={{ backgroundColor: "#d1fae5", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
                <Text style={{ fontSize: 11, fontWeight: "800", color: "#047857" }}>Verified ✅</Text>
              </View>
            </View>
            <Text style={{ fontSize: 11, color: "#047857", marginTop: 6, fontWeight: "600" }}>
              Barber partner has verified your 4-digit OTP. You are currently in the chair!
            </Text>
          </View>
        )}

        {/* Show OTP / Countdown for Customer */}
        {item.status === "confirmed" && !item.isOtpVerified && (
          <View style={styles.otpBox}>
            {(() => {
              const { start, end } = getCheckInTimes(item);
              
              if (currentTime < start) {
                const diff = start - currentTime;
                const hh = Math.floor(diff / 3600000).toString().padStart(2, '0');
                const mm = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
                const ss = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
                return (
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ fontSize: 13, color: "#64748b", fontWeight: "700" }}>Check-in starts in</Text>
                    <Text style={{ fontSize: 24, fontWeight: "900", color: "#334155", marginTop: 4 }}>{hh}:{mm}:{ss}</Text>
                  </View>
                );
              } else if (currentTime <= end) {
                const diff = end - currentTime;
                const mm = Math.floor(diff / 60000).toString().padStart(2, '0');
                const ss = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
                return (
                  <View>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <Text style={[styles.otpLabel, { color: "#16a34a" }]}>Check-in Open</Text>
                      <Text style={{ fontSize: 13, color: "#ef4444", fontWeight: "800" }}>Closes In {mm}:{ss}</Text>
                    </View>
                    <Text style={styles.otpValue}>{item.verificationPin}</Text>
                    <Text style={{ fontSize: 11, color: "#64748b", textAlign: "center", marginTop: 4 }}>Verify OTP before {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                  </View>
                );
              } else {
                return (
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ fontSize: 14, color: "#ef4444", fontWeight: "800" }}>Check-in Window Closed</Text>
                  </View>
                );
              }
            })()}
          </View>
        )}

        {item.status !== "cancelled" && item.status !== "completed" && item.status !== "in-progress" && item.status !== "expired" && (
          <View style={{flexDirection: 'row', gap: 10, marginTop: 16}}>
            <Pressable style={[styles.cancelBtn, {flex:1, marginTop: 0}]} onPress={() => setStatus(item.id, "cancelled")}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.cancelBtn, {flex:1, marginTop: 0, backgroundColor: "#f3e8ff"}]} onPress={() => {
              Alert.alert(
                "Reschedule Appointment",
                "Do you want to cancel this booking and book a new one?",
                [
                  { text: "No", style: "cancel" },
                  { text: "Yes, Reschedule", onPress: async () => {
                    try {
                      await api.patch(`/bookings/${item.id}`, { status: "cancelled" });
                      navigation.navigate("BarberDetail", { barberId: item.barber?.id || item.barberId, shopName: item.barber?.shopName });
                    } catch (e) {
                      Alert.alert("Error", e?.response?.data?.error || e.message);
                    }
                  }}
                ]
              );
            }}>
              <Text style={[styles.cancelText, {color: "#7e22ce"}]}>Reschedule</Text>
            </Pressable>
          </View>
        )}

        {item.status === "completed" && viewMode === "My Appointments" && (
          <View style={{flexDirection: 'row', gap: 10, marginTop: 16}}>
            <Pressable style={[styles.cancelBtn, {flex: 1, marginTop: 0, backgroundColor: "#f1f5f9"}]} onPress={() => {
              navigation.navigate("BarberDetail", { barberId: item.barber?.id || item.barberId, shopName: item.barber?.shopName });
            }}>
              <Text style={[styles.cancelText, {color: "#0f172a"}]}>Book Again</Text>
            </Pressable>
            <Pressable style={[styles.cancelBtn, {flex: 1, marginTop: 0, backgroundColor: "#fef08a"}]} onPress={() => { setReviewBookingId(item.id); setReviewBarberId(item.barber?.id || item.barberId?._id || item.barberId); setReviewModalVisible(true); }}>
              <Text style={[styles.cancelText, {color: "#854d0e"}]}>Leave a Review</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  const renderTailorCard = (item) => {
    const statusStyle = getStatusBadge(item.status);
    const shopName = item.tailorId?.shopName || "Tailor Shop";
    
    const cancelTailorOrder = async () => {
      Alert.alert("Cancel Booking", "Are you sure you want to cancel this booking?", [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              await api.patch(`/tailors/orders/${item._id}/cancel`, { cancellationReason: "Cancelled by customer" });
              Alert.alert("Booking Cancelled", "Your booking has been cancelled.");
              await load();
            } catch (e) {
              const errMsg = e?.response?.data?.error || "Failed to cancel order";
              Alert.alert("Error", errMsg);
            }
          }
        }
      ]);
    };

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={[styles.avatarCircle, { backgroundColor: "#f3e8ff", borderColor: "#d8b4fe" }]}>
              <Text style={[styles.avatarText, { color: "#6d28d9" }]}>✂️</Text>
            </View>
            <View style={styles.cardHeaderInfo}>
              <Text style={styles.shopName} numberOfLines={1}>{shopName}</Text>
              <Text style={styles.bookingIdText}>ORDER: #{item._id.slice(-6).toUpperCase()}</Text>
            </View>
          </View>
          <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
            <Ionicons name={statusStyle.icon} size={12} color={statusStyle.text} style={{ marginRight: 4 }} />
            <Text style={[styles.badgeText, { color: statusStyle.text }]}>{(item.status || "pending").toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.cardDivider} />

        {/* Tailor Verification OTP Box */}
        {item.status === "pending" ? (
          <View style={{ backgroundColor: "#fffbeb", padding: 12, borderRadius: 12, marginBottom: 14, borderWidth: 1, borderColor: "#fef08a", flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="time" size={20} color="#d97706" style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: "800", color: "#b45309" }}>Pending Confirmation</Text>
              <Text style={{ fontSize: 12, color: "#d97706", marginTop: 2 }}>Waiting for tailor partner to accept. OTP will be generated upon confirmation.</Text>
            </View>
          </View>
        ) : (
          <View style={{ backgroundColor: item.isOtpVerified ? "#ecfdf5" : (!item.isHomeService && item.otpExpiresAt && new Date() > new Date(item.otpExpiresAt)) ? "#fef2f2" : "#fef3c7", padding: 14, borderRadius: 14, marginBottom: 14, borderWidth: 1, borderColor: item.isOtpVerified ? "#a7f3d0" : (!item.isHomeService && item.otpExpiresAt && new Date() > new Date(item.otpExpiresAt)) ? "#fca5a5" : "#fde68a" }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                <Ionicons name={item.isOtpVerified ? "checkmark-circle" : (!item.isHomeService && item.otpExpiresAt && new Date() > new Date(item.otpExpiresAt)) ? "alert-circle" : "key"} size={24} color={item.isOtpVerified ? "#059669" : (!item.isHomeService && item.otpExpiresAt && new Date() > new Date(item.otpExpiresAt)) ? "#dc2626" : "#d97706"} style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, fontWeight: "800", color: item.isOtpVerified ? "#065f46" : (!item.isHomeService && item.otpExpiresAt && new Date() > new Date(item.otpExpiresAt)) ? "#991b1b" : "#92400e", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    {item.isOtpVerified ? "Identity Verified ✅" : (!item.isHomeService && item.otpExpiresAt && new Date() > new Date(item.otpExpiresAt)) ? "OTP Expired ❌" : "Share OTP with Tailor Partner ✂️"}
                  </Text>
                  <Text style={{ fontSize: 24, fontWeight: "900", color: item.isOtpVerified ? "#047857" : (!item.isHomeService && item.otpExpiresAt && new Date() > new Date(item.otpExpiresAt)) ? "#dc2626" : "#b45309", letterSpacing: 4, marginTop: 2, textDecorationLine: (!item.isOtpVerified && !item.isHomeService && item.otpExpiresAt && new Date() > new Date(item.otpExpiresAt)) ? "line-through" : "none" }}>
                    {item.otp || "----"}
                  </Text>
                </View>
              </View>
              <View style={{ backgroundColor: item.isOtpVerified ? "#d1fae5" : (!item.isHomeService && item.otpExpiresAt && new Date() > new Date(item.otpExpiresAt)) ? "#fee2e2" : "#fef08a", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
                <Text style={{ fontSize: 11, fontWeight: "800", color: item.isOtpVerified ? "#047857" : (!item.isHomeService && item.otpExpiresAt && new Date() > new Date(item.otpExpiresAt)) ? "#dc2626" : "#92400e" }}>
                  {item.isOtpVerified ? "Verified" : (!item.isHomeService && item.otpExpiresAt && new Date() > new Date(item.otpExpiresAt)) ? "Expired" : "Show Tailor"}
                </Text>
              </View>
            </View>

            {!item.isOtpVerified && (
              <View style={{ marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: "#fde68a" }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: "#b45309" }}>
                  {!item.isHomeService && item.otpExpiresAt && new Date() > new Date(item.otpExpiresAt)
                    ? "⚠️ OTP Expired (Valid for 4 hours only after tailor confirmation)"
                    : "🔒 Tailor partner must verify this OTP code before starting production process."
                  }
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Delivery OTP Box for Customer */}
        {item.isOtpVerified && item.deliveryOtp && (
          <View style={{ backgroundColor: item.isDeliveryOtpVerified ? "#ecfdf5" : "#e0f2fe", padding: 14, borderRadius: 14, marginBottom: 14, borderWidth: 1, borderColor: item.isDeliveryOtpVerified ? "#a7f3d0" : "#bae6fd" }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                <Ionicons name={item.isDeliveryOtpVerified ? "checkmark-done-circle" : "cube"} size={24} color={item.isDeliveryOtpVerified ? "#059669" : "#0284c7"} style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, fontWeight: "800", color: item.isDeliveryOtpVerified ? "#065f46" : "#0369a1", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    {item.isDeliveryOtpVerified ? "Order Delivered ✅" : "Delivery OTP 📦"}
                  </Text>
                  <Text style={{ fontSize: 24, fontWeight: "900", color: item.isDeliveryOtpVerified ? "#047857" : "#0369a1", letterSpacing: 4, marginTop: 2 }}>
                    {item.deliveryOtp}
                  </Text>
                </View>
              </View>
              <View style={{ backgroundColor: item.isDeliveryOtpVerified ? "#d1fae5" : "#e0f2fe", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
                <Text style={{ fontSize: 11, fontWeight: "800", color: item.isDeliveryOtpVerified ? "#047857" : "#0369a1" }}>
                  {item.isDeliveryOtpVerified ? "Delivered" : "Show Tailor"}
                </Text>
              </View>
            </View>

            {!item.isDeliveryOtpVerified && (
              <View style={{ marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: "#bae6fd" }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: "#0369a1" }}>
                  📦 Share this 4-digit Delivery OTP with your tailor partner when receiving your outfit to complete order.
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.detailsGrid}>
          <View style={styles.detailBlock}>
            <Text style={styles.detailLabel}>Mode</Text>
            <Text style={[styles.detailValue, { color: item.isPremiumService ? "#7c3aed" : item.isHomeService ? "#0d9488" : "#0369a1" }]}>
              {item.isPremiumService ? "👑 Premium VIP" : item.isHomeService ? "🏡 Home Visit" : "🏪 Visit Shop"}
            </Text>
          </View>
          <View style={styles.detailBlock}>
            <Text style={styles.detailLabel}>Booked On</Text>
            <Text style={styles.detailValue}>{formatDateOnly(item.createdAt)}</Text>
          </View>
        </View>

        {/* Promised Delivery / Completion Date Banner */}
        {item.deliveryDate ? (
          <View style={{ backgroundColor: "#f3e8ff", padding: 12, borderRadius: 12, marginBottom: 14, borderWidth: 1, borderColor: "#d8b4fe", flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="calendar" size={22} color="#6d28d9" style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: "800", color: "#6d28d9", textTransform: "uppercase", letterSpacing: 0.5 }}>
                Est. Completion Date
              </Text>
              <Text style={{ fontSize: 15, fontWeight: "900", color: "#4c1d95", marginTop: 2 }}>
                {new Date(item.deliveryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                {item.estimatedDays ? ` (${item.estimatedDays} Days)` : ""}
              </Text>
            </View>
            <View style={{ backgroundColor: "#6d28d9", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
              <Text style={{ color: "#ffffff", fontWeight: "800", fontSize: 12 }}>
                {item.estimatedDays || 3}d
              </Text>
            </View>
          </View>
        ) : item.estimatedDays ? (
          <View style={{ backgroundColor: "#f3e8ff", padding: 12, borderRadius: 12, marginBottom: 14, borderWidth: 1, borderColor: "#d8b4fe", flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="time" size={20} color="#6d28d9" style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: "800", color: "#6d28d9", textTransform: "uppercase" }}>Estimated Time</Text>
              <Text style={{ fontSize: 14, fontWeight: "900", color: "#4c1d95", marginTop: 2 }}>
                Will complete in {item.estimatedDays} Days
              </Text>
            </View>
          </View>
        ) : null}

        {item.services?.length ? (
          <View style={styles.svcContainer}>
            <Text style={styles.svcTitle}>Services Booked:</Text>
            <View style={styles.svcTags}>
              {item.services.map((s, i) => (
                <View key={i} style={styles.svcTag}>
                  <Text style={styles.svcTagText}>{s.name} - ₹{s.price || 0}</Text>
                </View>
              ))}
            </View>
            
            <View style={{ marginTop: 10, padding: 12, backgroundColor: "#f8fafc", borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0" }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                <Text style={{ fontSize: 13, color: "#64748b" }}>Services Total:</Text>
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#334155" }}>
                  ₹{item.services.reduce((acc, s) => acc + (s.price || 0) * (s.quantity || 1), 0)}
                </Text>
              </View>
              
              {item.fabricDetails?.totalFabricCost > 0 && (
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                  <Text style={{ fontSize: 13, color: "#64748b" }}>Fabric Cost:</Text>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: "#334155" }}>₹{item.fabricDetails.totalFabricCost}</Text>
                </View>
              )}

              {item.isHomeService && (
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                  <Text style={{ fontSize: 13, color: "#0d9488", fontWeight: "700" }}>🏡 Doorstep Delivery Charge:</Text>
                  <Text style={{ fontSize: 13, fontWeight: "800", color: "#0d9488" }}>₹{item.visitFee || 0}</Text>
                </View>
              )}

              {item.isPremiumService && (
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                  <Text style={{ fontSize: 13, color: "#7c3aed", fontWeight: "700" }}>👑 Premium VIP Service Fee:</Text>
                  <Text style={{ fontSize: 13, fontWeight: "800", color: "#7c3aed" }}>₹{item.visitFee || 0}</Text>
                </View>
              )}

              <View style={{ height: 1, backgroundColor: "#e2e8f0", marginVertical: 8 }} />

              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 14, fontWeight: "800", color: "#0f172a" }}>Total Amount:</Text>
                <Text style={{ fontSize: 16, fontWeight: "900", color: "#6d28d9" }}>₹{item.totalAmount}</Text>
              </View>
            </View>
          </View>
        ) : null}

        {!item.isOtpVerified && !["cancelled", "completed", "declined"].includes(item.status) ? (
          <View style={{ marginTop: 14 }}>
            <Pressable style={[styles.cancelBtn, { backgroundColor: "#fee2e2" }]} onPress={cancelTailorOrder}>
              <Ionicons name="close-circle" size={16} color="#ef4444" style={{ marginRight: 6 }} />
              <Text style={{ color: "#ef4444", fontWeight: "700", fontSize: 13 }}>Cancel Order</Text>
            </Pressable>
          </View>
        ) : item.isOtpVerified && !["cancelled", "completed", "declined"].includes(item.status) ? (
          <View style={{ marginTop: 14, backgroundColor: "#f1f5f9", padding: 10, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="lock-closed" size={16} color="#64748b" style={{ marginRight: 6 }} />
            <Text style={{ color: "#64748b", fontWeight: "700", fontSize: 12 }}>Cancellation Locked (OTP Verified 🔒)</Text>
          </View>
        ) : null}

        {/* Tailor Rating Button / Badge for Completed Orders */}
        {item.isTailorOrder && item.status === "completed" && (
          <View style={{ marginTop: 14 }}>
            {item.isRated ? (
              <View style={{ backgroundColor: "#f0fdf4", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#bbf7d0", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Ionicons name="star" size={18} color="#eab308" style={{ marginRight: 6 }} />
                  <Text style={{ fontSize: 13, fontWeight: "800", color: "#166534" }}>Rated: {item.rating}/5 Stars</Text>
                </View>
                <Pressable onPress={() => openTailorRatingModal(item)}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "#15803d", textDecorationLine: "underline" }}>Edit Review</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable 
                style={{ backgroundColor: "#6d28d9", paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", shadowColor: "#6d28d9", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 }}
                onPress={() => openTailorRatingModal(item)}
              >
                <Ionicons name="star" size={18} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={{ color: "#ffffff", fontWeight: "800", fontSize: 14 }}>⭐️ Rate Your Tailor Experience</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderBarberCard = (item) => {
    const statusStyle = getStatusBadge(item.status);
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={[styles.avatarCircle, { backgroundColor: "#fef08a", borderColor: "#fde047" }]}>
              <Text style={[styles.avatarText, { color: "#854d0e" }]}>{getInitials(item.customer?.name)}</Text>
            </View>
            <View style={styles.cardHeaderInfo}>
              <Text style={styles.shopName} numberOfLines={1}>{item.customer?.name || "Customer"}</Text>
              {item.customer?.phone ? (
                <Text style={styles.bookingIdText}>{item.customer.phone}</Text>
              ) : null}
            </View>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <View style={[styles.badge, { backgroundColor: statusStyle.bg, marginBottom: 8 }]}>
              <Ionicons name={statusStyle.icon} size={12} color={statusStyle.text} style={{ marginRight: 4 }} />
              <Text style={[styles.badgeText, { color: statusStyle.text }]}>{item.status}</Text>
            </View>
            <Pressable onPress={() => openHistory(item.customer?.phone)}>
              <Text style={{ fontSize: 11, color: "#6d28d9", fontWeight: "700" }}>View History</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.cardDivider} />

        <View style={styles.detailsGrid}>
          <View style={styles.detailBlock}>
            <Text style={styles.detailLabel}>Date & Time</Text>
            <Text style={styles.detailValue}>{formatDateLabel(item.arrivalTime || item.startTime)}</Text>
          </View>
          {(item.status === 'pending' || item.status === 'confirmed') && !item.isHomeService && (
            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>Customer Arrival</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={styles.detailValue}>{formatTime(item.arrivalTime || item.startTime)}</Text>
                <LiveCountdown targetDate={item.arrivalTime || item.startTime} />
              </View>
            </View>
          )}
          {item.isHomeService && item.status === 'confirmed' && item.barberArrivalTime && (
            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>Barber Arrival</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={styles.detailValue}>{formatTime(item.barberArrivalTime)}</Text>
                <LiveCountdown targetDate={item.barberArrivalTime} />
              </View>
            </View>
          )}
        </View>

        {item.seatLabel && (
          <View style={styles.seatHighlightBox}>
            <Ionicons name="person" size={16} color="#854d0e" />
            <Text style={styles.seatHighlightLabel}>Assigned Chair:</Text>
            <Text style={styles.seatHighlightValue}>{item.seatLabel}</Text>
          </View>
        )}

        {item.services?.length ? (
          <View style={styles.svcContainer}>
            <Text style={styles.svcTitle}>Requested Services:</Text>
            <View style={styles.svcTags}>
              {item.services.map((s, i) => (
                <View key={i} style={styles.svcTag}>
                  <Text style={styles.svcTagText}>{s.name} - ₹{s.price || 0}</Text>
                </View>
              ))}
            </View>
            <Text style={{fontSize: 13, fontWeight: "700", color: "#334155", marginTop: 8}}>Total: ₹{item.services.reduce((sum, s) => sum + (s.price || 0), 0)}</Text>
          </View>
        ) : null}

        {item.isHomeService ? (
          <View style={[styles.homeServiceBadge, { flexDirection: "column", alignItems: "flex-start", paddingVertical: 10, paddingHorizontal: 14, width: "100%" }]}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="home" size={14} color="#6d28d9" style={{ marginRight: 6 }} />
                <Text style={styles.homeServiceBadgeText}>Home Service Request</Text>
              </View>
              {item.customer?.phone && (
                <Pressable style={{ flexDirection: 'row', alignItems: 'center' }} onPress={() => Linking.openURL(`tel:${item.customer.phone}`)}>
                  <Ionicons name="call" size={12} color="#6d28d9" style={{ marginRight: 4 }} />
                  <Text style={{ fontSize: 12, color: "#6d28d9", textDecorationLine: 'underline', fontWeight: 'bold' }}>{item.customer.phone}</Text>
                </Pressable>
              )}
            </View>
            <Text style={{ fontSize: 13, color: "#4c1d95", fontWeight: "500", marginTop: 6 }}>
              <Text style={{fontWeight: "700"}}>Address:</Text> {item.homeServiceAddress || "Not provided"}
            </Text>
            {item.homeServiceLocation?.lat != null && item.homeServiceLocation?.lng != null && (
              <Pressable 
                style={{ 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  backgroundColor: '#7c3aed', 
                  paddingHorizontal: 12, 
                  paddingVertical: 8, 
                  borderRadius: 8, 
                  marginTop: 10,
                  alignSelf: 'flex-start'
                }} 
                onPress={() => {
                  Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${item.homeServiceLocation.lat},${item.homeServiceLocation.lng}`);
                }}
              >
                <Ionicons name="navigate" size={14} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={{ fontSize: 12, color: '#ffffff', fontWeight: '800' }}>Navigate to Customer</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={[styles.homeServiceBadge, { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0", paddingVertical: 8, paddingHorizontal: 12 }]}>
            <Ionicons name="storefront" size={14} color="#16a34a" style={{ marginRight: 6 }} />
            <Text style={[styles.homeServiceBadgeText, { color: "#16a34a" }]}>Shop Service</Text>
          </View>
        )}

        {/* Barber actions */}
        {item.status?.toLowerCase() === "pending" ? (
          <View style={styles.actionGrid}>
            <Pressable style={[styles.actionBtnSolid, { backgroundColor: "#f1f5f9" }]} onPress={() => setStatus(item.id, "cancelled")}>
              <Text style={[styles.actionBtnTextSolid, { color: "#ef4444" }]}>Decline</Text>
            </Pressable>
            
            <Pressable style={[styles.actionBtnSolid, { backgroundColor: "#6d28d9" }]} onPress={() => setStatus(item.id, "confirmed", item.startTime, item.isHomeService)}>
              <Text style={[styles.actionBtnTextSolid, { color: "#ffffff" }]}>Confirm Booking</Text>
            </Pressable>
          </View>
        ) : (item.status === "confirmed") ? (
          <View style={styles.verifyBox}>
            <Text style={styles.verifyLabel}>Verify Customer OTP</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable 
                style={styles.verifyBtn} 
                onPress={() => promptVerifyOtp(item.id)}
              >
                <Text style={styles.verifyBtnText}>Enter OTP & Start Haircut</Text>
              </Pressable>
            </View>
          </View>
        ) : item.status === "in-progress" ? (
          <View style={styles.actionGrid}>
            <Pressable style={[styles.actionBtnSolid, { backgroundColor: "#16a34a" }]} onPress={() => setStatus(item.id, "completed")}>
              <Text style={[styles.actionBtnTextSolid, { color: "#ffffff" }]}>Mark as Completed</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  };

  if (loading && items.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#6d28d9" size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      
      {/* Top Header Title */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Bookings</Text>
      </View>

      {/* Top Segmented Control for Partners */}
      {isPartner && (
        <View style={styles.primaryToggleWrapper}>
          <View style={styles.primaryToggle}>
            {["Shop Queue", "My Appointments"].map((mode) => {
              const active = viewMode === mode;
              return (
                <Pressable 
                  key={mode} 
                  style={[styles.primaryToggleBtn, active && styles.primaryToggleBtnActive]}
                  onPress={() => setViewMode(mode)}
                >
                  <Text style={[styles.primaryToggleText, active && styles.primaryToggleTextActive]}>
                    {mode}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* Sub-toggle for Shop Queue */}
      {viewMode === "Shop Queue" && (
        <View style={styles.subToggleWrapper}>
          {["Upcoming", "Completed", "Cancelled"].map((seg) => {
            const active = queueSegment === seg;
            return (
              <Pressable
                key={seg}
                style={[styles.subToggleBtn, active && styles.subToggleBtnActive]}
                onPress={() => setQueueSegment(seg)}
              >
                <Text style={[styles.subToggleText, active && styles.subToggleTextActive]}>
                  {seg}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Customer Status Filter Tabs & Service Type Chips */}
      {viewMode === "My Appointments" && (
        <View style={{ backgroundColor: "#ffffff", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" }}>
          {/* Main Status Tabs: All, Pending, Active, History */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, marginBottom: 8 }}>
            {[
              { key: "all", label: `All (${customerCounts.all})` },
              { key: "pending", label: `Pending (${customerCounts.pending})` },
              { key: "active", label: `Active (${customerCounts.active})` },
              { key: "history", label: `History (${customerCounts.history})` },
            ].map(tab => (
              <Pressable
                key={tab.key}
                style={[
                  { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0" },
                  customerTab === tab.key && { backgroundColor: "#6d28d9", borderColor: "#6d28d9" }
                ]}
                onPress={() => setCustomerTab(tab.key)}
              >
                <Text style={[{ fontSize: 13, fontWeight: "700", color: "#64748b" }, customerTab === tab.key && { color: "#ffffff" }]}>
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Service Type Filter Chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
            {[
              { key: "all", label: "All Services" },
              { key: "beauty", label: "💄 Beauty Parlor" },
              { key: "tailor", label: "✂️ Tailor Orders" },
              { key: "barber", label: "💈 Barber Bookings" },
            ].map(chip => (
              <Pressable
                key={chip.key}
                style={[
                  { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: "#f1f5f9" },
                  serviceTypeFilter === chip.key && { backgroundColor: chip.key === "beauty" ? "#be185d" : "#0f172a" }
                ]}
                onPress={() => setServiceTypeFilter(chip.key)}
              >
                <Text style={[{ fontSize: 12, fontWeight: "700", color: "#64748b" }, serviceTypeFilter === chip.key && { color: "#ffffff" }]}>
                  {chip.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Quick Active OTP Alert Banner for Customer */}
      {viewMode === "My Appointments" && activeOtpBooking && (
        <View style={{ marginHorizontal: 16, marginTop: 10, backgroundColor: "#fef3c7", padding: 12, borderRadius: 14, borderWidth: 1, borderColor: "#fde68a", flexDirection: "row", alignItems: "center" }}>
          <Ionicons name="key" size={20} color="#d97706" style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontWeight: "800", color: "#b45309", textTransform: "uppercase" }}>
              {activeOtpBooking.deliveryOtp ? "📦 Active Delivery OTP Code" : "✂️ Active Tailor Verification OTP"}
            </Text>
            <Text style={{ fontSize: 16, fontWeight: "900", color: "#92400e", letterSpacing: 2, marginTop: 2 }}>
              {activeOtpBooking.deliveryOtp || activeOtpBooking.otp}
            </Text>
          </View>
          <View style={{ backgroundColor: "#d97706", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
            <Text style={{ color: "#ffffff", fontWeight: "800", fontSize: 11 }}>
              Show Tailor
            </Text>
          </View>
        </View>
      )}

      <View style={styles.searchSection}>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search" size={20} color="#94a3b8" />
          <TextInput 
            style={styles.searchInput}
            placeholder="Search by name or phone..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#94a3b8"
          />
        </View>
        {viewMode === "Shop Queue" && (
          <Pressable style={styles.walkInBtn} onPress={() => setWalkInModalVisible(true)}>
            <Ionicons name="person-add" size={20} color="#fff" />
          </Pressable>
        )}
      </View>

      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id || item._id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6d28d9" />}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => viewMode === "Shop Queue" ? renderBarberCard(item) : item.isTailorOrder ? renderTailorCard(item) : renderCustomerCard(item)}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="calendar-outline" size={48} color="#94a3b8" />
            </View>
            <Text style={styles.emptyTitle}>
              {viewMode === "Shop Queue" ? "No Requests Yet" : "No Appointments"}
            </Text>
            <Text style={styles.emptySub}>
              {viewMode === "Shop Queue" 
                ? "Incoming requests from customers will appear here." 
                : "Your upcoming salon appointments will show up here."}
            </Text>
          </View>
        }
      />

      {/* OTP Input Modal */}
      <Modal visible={otpModalVisible} transparent animationType="fade" onRequestClose={() => setOtpModalVisible(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Verify Customer OTP</Text>
            <Text style={styles.modalDesc}>Enter the 4-digit PIN shown on the customer's app.</Text>
            
            <TextInput
              style={styles.otpInputBox}
              placeholder="0000"
              keyboardType="number-pad"
              maxLength={4}
              value={otpInput}
              onChangeText={setOtpInput}
              editable={!verifying}
            />
            
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setOtpModalVisible(false)} disabled={verifying}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalSubmitBtn} onPress={submitOtp} disabled={verifying}>
                {verifying ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalSubmitText}>Verify & Start</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Walk-in Modal */}
      <Modal visible={walkInModalVisible} transparent animationType="slide" onRequestClose={() => setWalkInModalVisible(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Walk-In Customer</Text>
            <TextInput
              style={[styles.otpInputBox, { fontSize: 16, textAlign: "left", letterSpacing: 0, padding: 12, marginBottom: 12 }]}
              placeholder="Customer Name (Optional)"
              value={walkInName}
              onChangeText={setWalkInName}
              placeholderTextColor="#94a3b8"
            />
            <Text style={{ alignSelf: 'flex-start', marginBottom: 8, fontWeight: '600' }}>Select Services</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {shopServices.map(svc => {
                const isSelected = selectedWalkInServices.includes(svc.id);
                return (
                  <Pressable 
                    key={svc.id}
                    style={{ padding: 8, borderRadius: 8, borderWidth: 1, borderColor: isSelected ? '#6d28d9' : '#e2e8f0', backgroundColor: isSelected ? '#6d28d9' : '#fff' }}
                    onPress={() => {
                      if (isSelected) setSelectedWalkInServices(prev => prev.filter(id => id !== svc.id));
                      else setSelectedWalkInServices(prev => [...prev, svc.id]);
                    }}
                  >
                    <Text style={{ color: isSelected ? '#fff' : '#475569', fontSize: 12 }}>{svc.name}</Text>
                  </Pressable>
                )
              })}
            </View>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setWalkInModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalSubmitBtn} onPress={submitWalkIn} disabled={submittingWalkIn}>
                {submittingWalkIn ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalSubmitText}>Add to Queue</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* History Modal */}
      <Modal visible={historyModalVisible} transparent animationType="slide" onRequestClose={() => setHistoryModalVisible(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Customer History</Text>
            {loadingHistory ? (
              <ActivityIndicator color="#6d28d9" style={{ marginVertical: 20 }} />
            ) : customerHistory.length === 0 ? (
              <Text style={{ color: '#64748b', marginVertical: 20 }}>No past visits found.</Text>
            ) : (
              <View style={{ width: '100%', maxHeight: 300, marginBottom: 20 }}>
                {customerHistory.map(hist => (
                  <View key={hist._id} style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                    <Text style={{ fontWeight: '700', color: '#0f172a' }}>{new Date(hist.startTime).toLocaleDateString()}</Text>
                    <Text style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>Services: {hist.services?.map(s => s.name).join(", ")}</Text>
                  </View>
                ))}
              </View>
            )}
            <Pressable style={[styles.modalCancelBtn, { width: '100%' }]} onPress={() => setHistoryModalVisible(false)}>
              <Text style={styles.modalCancelText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Review Modal */}
      <Modal visible={reviewModalVisible} transparent animationType="slide" onRequestClose={() => setReviewModalVisible(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Rate & Review</Text>
            <Text style={styles.modalDesc}>How was your experience?</Text>
            
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 20 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable key={star} onPress={() => setRating(star)}>
                  <Ionicons name={rating >= star ? "star" : "star-outline"} size={32} color="#fbbf24" />
                </Pressable>
              ))}
            </View>

            <TextInput
              style={[styles.otpInputBox, { fontSize: 14, textAlign: "left", letterSpacing: 0, padding: 12, minHeight: 80, marginBottom: 24 }]}
              placeholder="Leave a comment (Optional)"
              value={comment}
              onChangeText={setComment}
              placeholderTextColor="#94a3b8"
              multiline
            />
            
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setReviewModalVisible(false)} disabled={submittingReview}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalSubmitBtn} onPress={submitReview} disabled={submittingReview}>
                {submittingReview ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalSubmitText}>Submit Review</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Tailor Rating Modal */}
      <Modal visible={tailorRatingModalVisible} transparent animationType="slide" onRequestClose={() => setTailorRatingModalVisible(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <View style={{ alignItems: "center", marginBottom: 14 }}>
              <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: "#f3e8ff", justifyContent: "center", alignItems: "center", marginBottom: 8, borderWidth: 1, borderColor: "#d8b4fe" }}>
                <Ionicons name="cut" size={28} color="#6d28d9" />
              </View>
              <Text style={styles.modalTitle}>Rate Tailor Service ✂️</Text>
              <Text style={styles.modalDesc}>How was your tailoring & outfit experience?</Text>
            </View>
            
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 10, marginBottom: 20 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable key={star} onPress={() => setTailorRating(star)} style={{ padding: 4 }}>
                  <Ionicons name={tailorRating >= star ? "star" : "star-outline"} size={36} color="#eab308" />
                </Pressable>
              ))}
            </View>

            <TextInput
              style={[styles.otpInputBox, { fontSize: 14, textAlign: "left", letterSpacing: 0, padding: 12, minHeight: 80, marginBottom: 20 }]}
              placeholder="Leave feedback for tailor (Optional)"
              value={tailorComment}
              onChangeText={setTailorComment}
              placeholderTextColor="#94a3b8"
              multiline
            />
            
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setTailorRatingModalVisible(false)} disabled={submittingTailorRating}>
                <Text style={styles.modalCancelText}>Skip / Rate Later</Text>
              </Pressable>
              <Pressable style={[styles.modalSubmitBtn, { backgroundColor: "#6d28d9" }]} onPress={handleSubmittingTailorRating} disabled={submittingTailorRating}>
                {submittingTailorRating ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalSubmitText}>Submit Rating</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Confirm Home Service Modal */}
      <Modal visible={confirmHomeModalVisible} transparent animationType="slide" onRequestClose={() => setConfirmHomeModalVisible(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirm Home Service</Text>
            <Text style={styles.modalDesc}>ETA to Customer (Minutes)</Text>
            
            <TextInput
              style={[styles.otpInputBox, { fontSize: 16, textAlign: "left", letterSpacing: 0, padding: 12, marginBottom: 24 }]}
              placeholder="e.g. 15"
              keyboardType="number-pad"
              value={confirmETA}
              onChangeText={setConfirmETA}
              placeholderTextColor="#94a3b8"
            />
            
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setConfirmHomeModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalSubmitBtn} onPress={async () => {
                if (!confirmETA) return Alert.alert("Error", "Please enter ETA in minutes");
                try {
                  await api.patch(`/bookings/${confirmingBookingId}`, { status: "confirmed", barberETA: parseInt(confirmETA, 10) });
                  setConfirmHomeModalVisible(false);
                  await load();
                } catch (e) {
                  Alert.alert("Error", e?.response?.data?.error || e.message);
                }
              }}>
                <Text style={styles.modalSubmitText}>Confirm</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f8fafc" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f8fafc" },
  
  headerContainer: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 20 : 10,
    paddingBottom: 10,
    backgroundColor: "#f8fafc",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0f172a",
  },

  primaryToggleWrapper: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  primaryToggle: {
    flexDirection: "row",
    backgroundColor: "#e2e8f0",
    borderRadius: 12,
    padding: 4,
  },
  primaryToggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  primaryToggleBtnActive: {
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryToggleText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
  },
  primaryToggleTextActive: {
    color: "#0f172a",
    fontWeight: "700",
  },

  subToggleWrapper: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
  },
  subToggleBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  subToggleBtnActive: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a",
  },
  subToggleText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  subToggleTextActive: {
    color: "#ffffff",
  },

  listContent: { paddingHorizontal: 20, paddingBottom: 100 },
  
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatarCircle: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    justifyContent: "center", 
    alignItems: "center", 
    borderWidth: 1, 
  },
  avatarText: { fontSize: 16, fontWeight: "800" },
  cardHeaderInfo: { marginLeft: 12, flex: 1 },
  shopName: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  bookingIdText: { fontSize: 12, color: "#94a3b8", marginTop: 2, fontWeight: "500" },
  
  badge: { 
    flexDirection: "row", 
    alignItems: "center", 
    paddingHorizontal: 10, 
    paddingVertical: 6, 
    borderRadius: 12 
  },
  badgeText: { fontSize: 11, fontWeight: "800", textTransform: "uppercase" },

  cardDivider: {
    height: 1,
    backgroundColor: "#f1f5f9",
    marginVertical: 16,
  },

  detailsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  detailBlock: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    color: "#0f172a",
    fontWeight: "700",
  },
  countdownBadge: {
    backgroundColor: "#f3e8ff",
    borderWidth: 1,
    borderColor: "#d8b4fe",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 4,
    alignItems: "center",
    alignSelf: "flex-start"
  },
  countdownText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#7e22ce"
  },
  
  seatHighlightBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef08a",
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#fde047"
  },
  seatHighlightLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#854d0e",
    marginLeft: 8,
    marginRight: 6,
    textTransform: "uppercase"
  },
  seatHighlightValue: {
    fontSize: 14,
    fontWeight: "900",
    color: "#0f172a"
  },

  svcContainer: {
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  svcTitle: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  svcTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  svcTag: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  svcTagText: {
    fontSize: 12,
    color: "#334155",
    fontWeight: "600",
  },

  actionGrid: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  actionBtnSolid: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnTextSolid: {
    fontSize: 14,
    fontWeight: "700",
  },

  cancelBtn: { 
    marginTop: 16, 
    alignItems: "center", 
    paddingVertical: 10,
    backgroundColor: "#fef2f2",
    borderRadius: 12,
  },
  cancelText: { color: "#ef4444", fontWeight: "700", fontSize: 13 },

  emptyState: { 
    alignItems: "center", 
    justifyContent: "center", 
    paddingVertical: 80, 
    paddingHorizontal: 32 
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: "#334155", textAlign: "center" },
  emptySub: { fontSize: 14, color: "#64748b", textAlign: "center", marginTop: 8, lineHeight: 22 },

  otpBox: { backgroundColor: "#f0fdf4", padding: 12, borderRadius: 12, marginTop: 12, alignItems: "center", borderWidth: 1, borderColor: "#bbf7d0" },
  otpLabel: { fontSize: 11, fontWeight: "600", color: "#166534", textTransform: "uppercase" },
  otpValue: { fontSize: 24, fontWeight: "900", color: "#15803d", letterSpacing: 4, marginTop: 4 },

  verifyBox: { marginTop: 16, backgroundColor: "#f8fafc", padding: 16, borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0" },
  verifyLabel: { fontSize: 12, fontWeight: "700", color: "#475569", marginBottom: 8 },
  verifyBtn: { flex: 1, backgroundColor: "#0f172a", paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  verifyBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalContent: { backgroundColor: "#fff", borderRadius: 24, padding: 24, width: "100%", maxWidth: 340, alignItems: "center" },
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#0f172a", marginBottom: 8 },
  modalDesc: { fontSize: 14, color: "#64748b", textAlign: "center", marginBottom: 24, lineHeight: 20 },
  otpInputBox: { width: "100%", backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 16, padding: 16, fontSize: 24, fontWeight: "800", textAlign: "center", letterSpacing: 8, color: "#0f172a", marginBottom: 24 },
  modalActions: { flexDirection: "row", width: "100%", gap: 12 },
  modalCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: "#f1f5f9", alignItems: "center" },
  modalCancelText: { fontSize: 15, fontWeight: "700", color: "#64748b" },
  modalSubmitBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: "#16a34a", alignItems: "center" },
  modalSubmitText: { fontSize: 15, fontWeight: "700", color: "#fff" },

  homeServiceBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "#f3e8ff", alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginTop: 12, borderWidth: 1, borderColor: "#e9d5ff" },
  homeServiceBadgeText: { fontSize: 12, fontWeight: "700", color: "#6d28d9" },

  searchSection: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, marginBottom: 12, gap: 10 },
  searchInputWrapper: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#ffffff", paddingHorizontal: 12, height: 44, borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0" },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: "#0f172a" },
  walkInBtn: { width: 44, height: 44, backgroundColor: "#0f172a", borderRadius: 12, justifyContent: "center", alignItems: "center" },
});
