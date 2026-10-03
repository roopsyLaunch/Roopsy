import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable,
  RefreshControl, Alert, Modal, TextInput, ScrollView, Linking, Platform, Image
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../api/client";
import { getSocket } from "../../api/socket";
import { useAuth } from "../../context/AuthContext";
import { useFocusEffect } from "@react-navigation/native";
import { openMapForNavigation } from "../../services/locationService";
import { pickOrCaptureImage } from "../../services/imagePickerService";
import { uploadImageAsync } from "../../api/upload";

const formatDateOnly = (d) => {
  if (!d) return "N/A";
  const date = new Date(d);
  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short"
  });
};

const formatTime = (timeStr) => {
  if (!timeStr) return "N/A";
  const date = new Date(timeStr);
  if (!isNaN(date.getTime())) {
    return date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
  }
  return timeStr;
};

const getInitials = (name) => {
  if (!name) return "S";
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

const getStatusBadge = (status) => {
  switch (status) {
    case "confirmed":
    case "accepted":
      return { bg: "#e0f2fe", text: "#0369a1", icon: "checkmark-circle" };
    case "in-progress":
    case "stitching":
      return { bg: "#fef3c7", text: "#d97706", icon: "cut" };
    case "ready":
      return { bg: "#ecfdf5", text: "#059669", icon: "shirt" };
    case "completed":
      return { bg: "#dcfce7", text: "#15803d", icon: "checkmark-done-circle" };
    case "cancelled":
    case "declined":
    case "rejected":
    case "expired":
      return { bg: "#fee2e2", text: "#b91c1c", icon: "close-circle" };
    default:
      return { bg: "#f1f5f9", text: "#475569", icon: "time" };
  }
};

const LiveCountdown = ({ targetDate }) => {
  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    const update = () => {
      if (!targetDate) return;
      const diff = new Date(targetDate).getTime() - new Date().getTime();
      if (diff <= 0) {
        setTimeLeft("Late");
        return;
      }
      const mins = Math.floor(diff / 60000);
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      if (hrs > 0) {
        setTimeLeft(`${hrs}h ${remMins}m`);
      } else {
        setTimeLeft(`${mins}m`);
      }
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

export function TailorOrdersScreen({ navigation, route }) {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState(route?.params?.initialTab || "Shop Queue"); // "Shop Queue", "My Appointments"

  // ----------------- Shop Queue State (Tailor Partner's Orders) -----------------
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterTab, setFilterTab] = useState("all"); // "all", "pending", "active", "completed"

  // Accept Order Modal state
  const [acceptModalVisible, setAcceptModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [estDays, setEstDays] = useState("3");
  const [customVisitFee, setCustomVisitFee] = useState("0");
  const [submittingAccept, setSubmittingAccept] = useState(false);

  // OTP Verification state
  const [otpModalVisible, setOtpModalVisible] = useState(false);
  const [otpInput, setOtpInput] = useState("");
  const [otpOrderId, setOtpOrderId] = useState(null);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  // Delivery OTP Verification state
  const [deliveryOtpModalVisible, setDeliveryOtpModalVisible] = useState(false);
  const [deliveryOtpInput, setDeliveryOtpInput] = useState("");
  const [deliveryOrderId, setDeliveryOrderId] = useState(null);
  const [generatingDeliveryOtp, setGeneratingDeliveryOtp] = useState(false);
  const [verifyingDeliveryOtp, setVerifyingDeliveryOtp] = useState(false);
  const [directConfirmingId, setDirectConfirmingId] = useState(null);

  // ----------------- My Appointments State (Personal Customer Bookings) -----------------
  const [customerAppointments, setCustomerAppointments] = useState([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerTab, setCustomerTab] = useState("all"); // "all", "pending", "active", "history"
  const [serviceTypeFilter, setServiceTypeFilter] = useState("all"); // "all", "beauty", "tailor", "barber"
  const [searchQuery, setSearchQuery] = useState("");

  // Customer Review Modal state
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewBookingId, setReviewBookingId] = useState(null);
  const [reviewBarberId, setReviewBarberId] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  // Customer Tailor Rating Modal state
  const [tailorRatingModalVisible, setTailorRatingModalVisible] = useState(false);
  const [tailorRatingOrder, setTailorRatingOrder] = useState(null);
  const [tailorRating, setTailorRating] = useState(5);
  const [tailorComment, setTailorComment] = useState("");
  const [submittingTailorRating, setSubmittingTailorRating] = useState(false);

  // Full-screen image preview state
  const [previewImageModalVisible, setPreviewImageModalVisible] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState("");
  const [previewImageTitle, setPreviewImageTitle] = useState("");
  const openImagePreview = (url, title) => {
    if (!url) return;
    setPreviewImageUrl(url);
    setPreviewImageTitle(title || "Photo Preview");
    setPreviewImageModalVisible(true);
  };

  // ----------------- Data Loaders -----------------
  const loadOrders = useCallback(async () => {
    try {
      const res = await api.get("/tailors/me/orders");
      setOrders(res.data.orders || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const loadCustomerAppointments = useCallback(async () => {
    try {
      setCustomerLoading(true);
      const [barberRes, tailorRes] = await Promise.all([
        api.get("/bookings/me").catch(() => ({ data: { bookings: [] } })),
        api.get("/tailors/me/orders/customer").catch(() => ({ data: { orders: [] } }))
      ]);
      const barberBookings = (barberRes.data?.bookings || []).map(b => ({ ...b, isTailorOrder: false }));
      const tailorOrdersList = (tailorRes.data?.orders || []).map(o => ({ ...o, isTailorOrder: true }));
      const combined = [...barberBookings, ...tailorOrdersList].sort((a, b) => {
        const dateA = new Date(a.startTime || a.createdAt).getTime();
        const dateB = new Date(b.startTime || b.createdAt).getTime();
        return dateB - dateA;
      });
      setCustomerAppointments(combined);
    } catch (err) {
      console.error(err);
    } finally {
      setCustomerLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadOrders().finally(() => setLoading(false));
      loadCustomerAppointments();

      const socket = getSocket();
      if (user?.id) {
        socket.emit("joinUserRoom", user.id);
      }

      const handleNewOrder = () => {
        Alert.alert("New Tailor Booking ✂️", "A customer has placed a new booking request!");
        loadOrders();
      };
      const handleOrderUpdated = () => {
        loadOrders();
        loadCustomerAppointments();
      };
      const handleTailorCompleted = (data) => {
        loadCustomerAppointments();
        if (data && data.orderId) {
          api.get(`/tailors/orders/${data.orderId}`).then(res => {
            if (res.data?.order) {
              setTailorRatingOrder(res.data.order);
              setTailorRating(5);
              setTailorComment("");
              setTailorRatingModalVisible(true);
            }
          }).catch(() => {});
        }
      };

      socket.on("tailorNewOrder", handleNewOrder);
      socket.on("bookingUpdated", handleOrderUpdated);
      socket.on("tailorOrderCompleted", handleTailorCompleted);

      return () => {
        if (user?.id) socket.emit("leaveUserRoom", user.id);
        socket.off("tailorNewOrder", handleNewOrder);
        socket.off("bookingUpdated", handleOrderUpdated);
        socket.off("tailorOrderCompleted", handleTailorCompleted);
      };
    }, [loadOrders, loadCustomerAppointments, user?.id])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadOrders(), loadCustomerAppointments()]);
    setRefreshing(false);
  };

  // ----------------- Shop Queue Handlers -----------------
  const [deliveryProofUri, setDeliveryProofUri] = useState(null);
  const [uploadingDeliveryProof, setUploadingDeliveryProof] = useState(false);

  const handlePickDeliveryPhoto = async () => {
    const uri = await pickOrCaptureImage({
      title: "Finished Outfit Delivery Photo 📸",
      message: "Click photo of the finished delivered outfit (डिलीवरी प्रमाण):"
    });
    if (uri) {
      setDeliveryProofUri(uri);
    }
  };

  const handleCaptureDeliveryProofForOrder = async (orderId) => {
    try {
      const uri = await pickOrCaptureImage({
        title: "Finished Outfit Delivery Photo 📸",
        message: "Click or choose photo of the finished delivered outfit (कपड़ा डिलीवरी प्रमाण):"
      });
      if (!uri) return;

      setUploadingDeliveryProof(true);
      const uploadedUrl = await uploadImageAsync(uri);
      if (!uploadedUrl) {
        return Alert.alert("Error", "Could not upload delivery photo");
      }

      await api.patch(`/tailors/orders/${orderId}/delivery-proof`, {
        deliveryProofImageUrl: uploadedUrl
      });
      await loadOrders();
      Alert.alert("Photo Saved! 📦📸", "Cloth delivery proof photo has been successfully saved & confirmed!");
    } catch (err) {
      console.error(err);
      Alert.alert("Error", err?.response?.data?.error || "Could not save delivery photo.");
    } finally {
      setUploadingDeliveryProof(false);
    }
  };

  const handleOpenDeliveryOtpModal = (orderId) => {
    const curOrder = orders.find(o => (o._id || o.id) === orderId);
    setDeliveryOrderId(orderId);
    setDeliveryOtpInput("");
    setDeliveryProofUri(curOrder?.deliveryProofImageUrl || null);
    setDeliveryOtpModalVisible(true);
  };

  const handleGenerateDeliveryOtp = async (orderId) => {
    const curOrder = orders.find(o => (o._id || o.id) === orderId);
    if (curOrder && (curOrder.status === "cancelled" || curOrder.status === "declined")) {
      return Alert.alert("Order Cancelled", "Cannot generate delivery OTP for a cancelled order.");
    }
    setGeneratingDeliveryOtp(true);
    try {
      await api.post(`/tailors/orders/${orderId}/generate-delivery-otp`);
      setDeliveryOrderId(orderId);
      setDeliveryOtpInput("");
      setDeliveryProofUri(curOrder?.deliveryProofImageUrl || null);
      setDeliveryOtpModalVisible(true);
      await loadOrders();
      Alert.alert("Delivery OTP Generated 📦", "Customer has received the 4-digit Delivery OTP. Please enter and verify it when delivering the outfit.");
    } catch (err) {
      console.error(err);
      Alert.alert("Error", err?.response?.data?.error || "Could not generate Delivery OTP.");
    } finally {
      setGeneratingDeliveryOtp(false);
    }
  };

  const handleVerifyDeliveryOtp = async () => {
    if (!deliveryOtpInput || deliveryOtpInput.trim().length !== 4) {
      return Alert.alert("Required", "Please enter the 4-digit Delivery OTP code.");
    }
    const curOrder = orders.find(o => (o._id || o.id) === deliveryOrderId);
    if (curOrder && (curOrder.status === "cancelled" || curOrder.status === "declined")) {
      setDeliveryOtpModalVisible(false);
      return Alert.alert("Order Cancelled", "This order is cancelled. Delivery OTP verification is disabled.");
    }
    setVerifyingDeliveryOtp(true);
    try {
      let uploadedDeliveryUrl = curOrder?.deliveryProofImageUrl || "";
      if (deliveryProofUri && deliveryProofUri !== curOrder?.deliveryProofImageUrl) {
        setUploadingDeliveryProof(true);
        uploadedDeliveryUrl = await uploadImageAsync(deliveryProofUri);
      }

      const res = await api.post(`/tailors/orders/${deliveryOrderId}/verify-delivery-otp`, {
        otp: deliveryOtpInput,
        deliveryProofImageUrl: uploadedDeliveryUrl || undefined
      });
      setDeliveryOtpModalVisible(false);
      setDeliveryOtpInput("");
      setDeliveryProofUri(null);
      setDeliveryOrderId(null);
      await loadOrders();
      Alert.alert("Order Completed! 🎉", res.data?.message || "Delivery OTP verified & order marked completed!");
    } catch (err) {
      console.error(err);
      Alert.alert("Verification Error", err?.response?.data?.error || "Invalid Delivery OTP code.");
    } finally {
      setVerifyingDeliveryOtp(false);
      setUploadingDeliveryProof(false);
    }
  };

  const handleOpenAcceptModal = (order) => {
    setSelectedOrder(order);
    const isPrem = Boolean(
      order.isPremiumService ||
      (order.services || []).some(s => s.serviceMode === "premium" || s.isPremium || (s.name && /premium|vip/i.test(s.name)))
    );
    const pSvc = (order.services || []).find(s => s.serviceMode === "premium" || s.isPremium || (s.name && /premium|vip/i.test(s.name)) || s.completionTime);
    const compTime = order.completionTime || pSvc?.completionTime || (isPrem ? "12 Hours" : "");
    let defaultDays = order.estimatedDays;
    if (isPrem) {
      if (compTime) {
        const matchHours = compTime.match(/(\d+)\s*(?:hour|hr)/i);
        if (matchHours) {
          defaultDays = Math.max(1, Math.ceil(parseInt(matchHours[1], 10) / 24));
        }
      }
      if (!defaultDays || defaultDays > 1) defaultDays = 1;
    }
    setEstDays(String(defaultDays || (isPrem ? 1 : 3)));
    setCustomVisitFee(String(order.visitFee || 0));
    setAcceptModalVisible(true);
  };

  const handleConfirmAccept = async () => {
    if (!selectedOrder) return;
    const daysNum = parseInt(estDays, 10);
    if (isNaN(daysNum) || daysNum <= 0) {
      return Alert.alert("Required", "Please enter a valid number of days for completion.");
    }

    const feeNum = parseFloat(customVisitFee);
    if (selectedOrder.isHomeService && (isNaN(feeNum) || feeNum < 0)) {
      return Alert.alert("Required", "Please enter a valid delivery charge.");
    }

    const isPrem = Boolean(
      selectedOrder.isPremiumService ||
      (selectedOrder.services || []).some(s => s.serviceMode === "premium" || s.isPremium || (s.name && /premium|vip/i.test(s.name)))
    );
    const pSvc = (selectedOrder.services || []).find(s => s.serviceMode === "premium" || s.isPremium || (s.name && /premium|vip/i.test(s.name)) || s.completionTime);
    const compTime = selectedOrder.completionTime || pSvc?.completionTime || (isPrem ? "12 Hours" : "");

    setSubmittingAccept(true);
    try {
      let deliveryDate = new Date();
      if (isPrem && compTime) {
        const matchHours = compTime.match(/(\d+)\s*(?:hour|hr)/i);
        if (matchHours) {
          deliveryDate = new Date(Date.now() + parseInt(matchHours[1], 10) * 60 * 60 * 1000);
        } else {
          deliveryDate.setDate(deliveryDate.getDate() + daysNum);
        }
      } else {
        deliveryDate.setDate(deliveryDate.getDate() + daysNum);
      }

      await api.patch(`/tailors/orders/${selectedOrder._id}/status`, {
        status: "accepted",
        estimatedDays: daysNum,
        completionTime: compTime || `${daysNum} Days`,
        deliveryDate: deliveryDate.toISOString(),
        ...(selectedOrder.isHomeService ? { visitFee: feeNum } : {})
      });

      setAcceptModalVisible(false);
      setSelectedOrder(null);
      await loadOrders();
      Alert.alert("Order Accepted", `Order accepted! Completion set for ${compTime || `${daysNum} Days`}.`);
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Could not accept order.");
    } finally {
      setSubmittingAccept(false);
    }
  };

  const handleDirectConfirmPremium = async (order) => {
    setDirectConfirmingId(order._id);
    try {
      const pSvc = (order.services || []).find(s => s.serviceMode === "premium" || s.isPremium || (s.name && /premium|vip/i.test(s.name)) || s.completionTime);
      const compTime = (order.completionTime || pSvc?.completionTime || "12 Hours").trim();

      let daysNum = 1;
      let deliveryDate = new Date();

      if (compTime) {
        const matchHours = compTime.match(/(\d+)\s*(?:hour|hr)/i);
        const matchDays = compTime.match(/(\d+)\s*(?:day)/i);
        if (matchHours) {
          const hours = parseInt(matchHours[1], 10);
          daysNum = Math.max(1, Math.ceil(hours / 24));
          deliveryDate = new Date(Date.now() + hours * 60 * 60 * 1000);
        } else if (matchDays) {
          const days = parseInt(matchDays[1], 10);
          daysNum = Math.max(1, days);
          deliveryDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        }
      } else {
        deliveryDate = new Date(Date.now() + 12 * 60 * 60 * 1000);
      }

      await api.patch(`/tailors/orders/${order._id}/status`, {
        status: "accepted",
        estimatedDays: daysNum,
        completionTime: compTime,
        deliveryDate: deliveryDate.toISOString(),
        ...(order.isHomeService ? { visitFee: order.visitFee || 0 } : {})
      });

      await loadOrders();
      Alert.alert(
        "👑 VIP Booking Confirmed!",
        `Premium VIP booking confirmed instantly!\n\nDelivery timeline: ${compTime} (${deliveryDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}).\nCustomer has been notified with verification OTP.`
      );
    } catch (err) {
      console.error(err);
      Alert.alert("Error", err?.response?.data?.error || "Could not confirm VIP order.");
    } finally {
      setDirectConfirmingId(null);
    }
  };

  const handleOpenOtpModal = (orderId) => {
    setOtpOrderId(orderId);
    setOtpInput("");
    setOtpModalVisible(true);
  };

  const handleVerifyOtp = async () => {
    if (!otpInput || otpInput.trim().length !== 4) {
      return Alert.alert("Required", "Please enter the 4-digit OTP code.");
    }
    const curOrder = orders.find(o => (o._id || o.id) === otpOrderId);
    if (curOrder && (curOrder.status === "cancelled" || curOrder.status === "declined")) {
      setOtpModalVisible(false);
      return Alert.alert("Order Cancelled", "This order is cancelled. OTP verification is disabled.");
    }
    setVerifyingOtp(true);
    try {
      const res = await api.post(`/tailors/orders/${otpOrderId}/verify-otp`, { otp: otpInput });
      setOtpModalVisible(false);
      setOtpInput("");
      setOtpOrderId(null);
      await loadOrders();
      Alert.alert("Verified! ✅", res.data?.message || "Customer OTP verified successfully!");
    } catch (err) {
      console.error(err);
      Alert.alert("Verification Error", err?.response?.data?.error || "Invalid OTP code.");
    } finally {
      setVerifyingOtp(false);
    }
  };

  const updateStatus = async (orderId, newStatus) => {
    const targetOrder = orders.find(o => o._id === orderId);
    const ALLOWED_UNVERIFIED = ["accepted", "confirmed", "declined", "cancelled"];
    if (targetOrder && !ALLOWED_UNVERIFIED.includes(newStatus) && !targetOrder.isOtpVerified) {
      handleOpenOtpModal(orderId);
      return Alert.alert(
        "OTP Verification Required 🔒",
        "Please ask customer for 4-digit OTP and verify identity before starting or advancing production process."
      );
    }

    if (newStatus === "completed" && targetOrder && !targetOrder.isDeliveryOtpVerified) {
      if (!targetOrder.deliveryOtp) {
        return handleGenerateDeliveryOtp(orderId);
      } else {
        return handleOpenDeliveryOtpModal(orderId);
      }
    }

    try {
      await api.patch(`/tailors/orders/${orderId}/status`, { status: newStatus });
      await loadOrders();
    } catch (err) {
      console.error(err);
      Alert.alert("Error", err?.response?.data?.error || "Could not update status.");
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "pending": return "#f59e0b";
      case "accepted": return "#3b82f6";
      case "measuring": return "#8b5cf6";
      case "stitching": return "#d946ef";
      case "ready": return "#10b981";
      case "completed": return "#059669";
      case "cancelled":
      case "declined": return "#ef4444";
      default: return "#64748b";
    }
  };

  const calcTargetDate = (d) => {
    const num = parseInt(d, 10);
    if (isNaN(num) || num <= 0) return "";
    const dt = new Date();
    dt.setDate(dt.getDate() + num);
    return dt.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  };

  const pendingCount = orders.filter(o => o.status === "pending").length;

  const filteredOrders = orders.filter(o => {
    if (filterTab === "pending") return o.status === "pending";
    if (filterTab === "active") return ["accepted", "stitching", "ready", "measuring", "trial"].includes(o.status);
    if (filterTab === "completed") return o.status === "completed" || o.status === "cancelled" || o.status === "declined";
    return true;
  });

  // ----------------- Customer Appointments Handlers & Modals -----------------
  const cancelCustomerBooking = (bookingId) => {
    Alert.alert("Cancel Appointment", "Are you sure you want to cancel this booking?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, Cancel",
        style: "destructive",
        onPress: async () => {
          try {
            await api.patch(`/bookings/${bookingId}`, { status: "cancelled" });
            Alert.alert("Cancelled", "Your appointment has been cancelled.");
            await loadCustomerAppointments();
          } catch (e) {
            Alert.alert("Error", e?.response?.data?.error || "Failed to cancel booking");
          }
        }
      }
    ]);
  };

  const cancelCustomerTailorOrder = (orderId) => {
    Alert.alert("Cancel Booking Request", "Are you sure you want to cancel this tailor booking?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, Cancel",
        style: "destructive",
        onPress: async () => {
          try {
            await api.patch(`/tailors/orders/${orderId}/cancel`, { cancellationReason: "Cancelled by customer" });
            Alert.alert("Booking Cancelled", "Your tailor booking request has been successfully cancelled.");
            await loadCustomerAppointments();
          } catch (e) {
            Alert.alert("Cancellation Failed", e?.response?.data?.error || "Failed to cancel order");
          }
        }
      }
    ]);
  };

  const submitReview = async () => {
    if (!reviewBookingId) return;
    setSubmittingReview(true);
    try {
      await api.post("/reviews", {
        bookingId: reviewBookingId,
        barberId: reviewBarberId,
        rating,
        comment
      });
      setReviewModalVisible(false);
      setReviewBookingId(null);
      Alert.alert("Thank You!", "Your review has been submitted.");
      await loadCustomerAppointments();
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.error || "Failed to submit review");
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleSubmittingTailorRating = async () => {
    if (!tailorRatingOrder) return;
    setSubmittingTailorRating(true);
    try {
      const orderId = tailorRatingOrder._id || tailorRatingOrder.id;
      const res = await api.post(`/tailors/orders/${orderId}/rate`, {
        rating: Number(tailorRating) || 5,
        comment: (tailorComment || "").trim()
      });
      Alert.alert("Thank You! ⭐️", res.data?.message || "Your tailor rating & review has been saved successfully.");
      setTailorRatingModalVisible(false);
      setTailorRatingOrder(null);
      await loadCustomerAppointments();
    } catch (err) {
      Alert.alert("Submission Failed", err?.response?.data?.error || "Failed to submit tailor rating");
    } finally {
      setSubmittingTailorRating(false);
    }
  };

  const getBookingType = (item) => {
    if (item.isTailorOrder) return "tailor";
    const cat = (item.barber?.businessCategory || item.barber?.shopType || item.barberId?.businessCategory || "").toLowerCase();
    if (cat.includes("beauty") || cat.includes("parlor") || cat.includes("parlour")) return "beauty";
    return "barber";
  };

  // Customer items filter
  const customerCounts = {
    all: customerAppointments.length,
    pending: customerAppointments.filter(i => i.status === "pending").length,
    active: customerAppointments.filter(i => ["confirmed", "arrived", "in-progress", "accepted", "stitching", "ready", "fitting"].includes(i.status)).length,
    history: customerAppointments.filter(i => ["completed", "cancelled", "declined", "rejected", "expired"].includes(i.status)).length
  };

  const filteredCustomerAppointments = customerAppointments.filter(item => {
    const status = item.status;
    const bType = getBookingType(item);

    // Status filter
    if (customerTab === "pending" && status !== "pending") return false;
    if (customerTab === "active" && !["confirmed", "arrived", "in-progress", "accepted", "stitching", "ready", "fitting"].includes(status)) return false;
    if (customerTab === "history" && !["completed", "cancelled", "declined", "rejected", "expired"].includes(status)) return false;

    // Service filter
    if (serviceTypeFilter !== "all" && bType !== serviceTypeFilter) return false;

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const shopName = (item.isTailorOrder ? item.tailorId?.shopName : item.barber?.shopName) || "";
      const services = (item.services || []).map(s => s.name).join(" ");
      const idStr = item.id || item._id || "";
      return shopName.toLowerCase().includes(q) || services.toLowerCase().includes(q) || idStr.toLowerCase().includes(q);
    }
    return true;
  });

  const activeOtpBooking = customerAppointments.find(item =>
    !["cancelled", "declined", "rejected", "expired"].includes(item.status) &&
    (
      (item.status === "confirmed" || item.status === "accepted" || item.status === "ready") &&
      (item.otp || item.deliveryOtp || item.verificationPin) &&
      (!item.isOtpVerified || (item.deliveryOtp && !item.isDeliveryOtpVerified))
    )
  );

  // ----------------- Render Items -----------------
  const renderItem = ({ item }) => {
    const isHome = item.isHomeService;
    const isPremium = Boolean(
      item.isPremiumService ||
      (item.services || []).some(s => s.serviceMode === "premium" || s.isPremium || (s.name && /premium|vip/i.test(s.name)))
    );
    const expDate = item.deliveryDate ? new Date(item.deliveryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : null;

    const displayTurnaround = isPremium 
      ? (item.completionTime || pSvc?.completionTime || "12 Hours")
      : (item.status !== "pending" && (item.completionTime || item.estimatedDays) ? (item.completionTime || `${item.estimatedDays} Days`) : "");

    return (
      <View style={[styles.card, isPremium && styles.cardVIP]}>
        {/* VIP Premium Alert Banner */}
        {isPremium && (
          <View style={styles.vipOrderBanner}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
              <Ionicons name="sparkles" size={16} color="#fbbf24" />
              <Text style={styles.vipOrderBannerText}>👑 PREMIUM VIP BOOKING — EXPRESS</Text>
            </View>
            <View style={styles.vipBadgePill}>
              <Text style={styles.vipBadgePillText}>VIP FAST-TRACK</Text>
            </View>
          </View>
        )}

        {/* Pending Request Alert Banner */}
        {item.status === "pending" && !isPremium && (
          <View style={{ backgroundColor: "#fef3c7", padding: 10, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: "#fde68a", flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="notifications" size={18} color="#d97706" style={{ marginRight: 8 }} />
            <Text style={{ fontSize: 13, fontWeight: "800", color: "#b45309", flex: 1 }}>
              NEW BOOKING REQUEST — Action Required
            </Text>
          </View>
        )}

        {item.status === "pending" && isPremium && (
          <View style={{ backgroundColor: "#faf5ff", padding: 10, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: "#e9d5ff", flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="flash" size={18} color="#9333ea" style={{ marginRight: 8 }} />
            <Text style={{ fontSize: 13, fontWeight: "800", color: "#7e22ce", flex: 1 }}>
              ⚡ VIP EXPRESS BOOKING — 1-Tap Direct Confirm Available!
            </Text>
          </View>
        )}

        <View style={styles.headerRow}>
          <View style={styles.customerInfo}>
            <Text style={styles.customerName}>{item.customerId?.name || "Customer"}</Text>
            <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString()}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + "20" }]}>
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>{item.status.toUpperCase()}</Text>
          </View>
        </View>

        {/* Service Mode Badge */}
        <View style={styles.modeBadgeRow}>
          {isPremium && (
            <View style={[styles.modeBadge, { backgroundColor: "#f3e8ff", borderColor: "#c084fc", borderWidth: 1 }]}>
              <Ionicons name="ribbon" size={14} color="#7e22ce" />
              <Text style={[styles.modeBadgeText, { color: "#7e22ce", fontWeight: "800" }]}>
                👑 VIP Premium
              </Text>
            </View>
          )}

          <View style={[styles.modeBadge, { backgroundColor: isHome ? "#ede9fe" : "#e0f2fe" }]}>
            <Ionicons name={isHome ? "home" : "storefront"} size={14} color={isHome ? "#6d28d9" : "#0369a1"} />
            <Text style={[styles.modeBadgeText, { color: isHome ? "#6d28d9" : "#0369a1" }]}>
              {isHome ? "🏡 Home Service (Doorstep Visit)" : "🏪 Shop Service (Visit Shop)"}
            </Text>
          </View>

          {displayTurnaround ? (
            <View style={[styles.timelineBadge, isPremium && { backgroundColor: "#f3e8ff", borderColor: "#c084fc", borderWidth: 1 }]}>
              <Ionicons name="time-outline" size={14} color={isPremium ? "#7e22ce" : "#059669"} />
              <Text style={[styles.timelineBadgeText, isPremium && { color: "#7e22ce", fontWeight: "800" }]}>
                {displayTurnaround}{expDate ? ` (${expDate})` : ""}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Photo Proof Indicators */}
        {(item.clothProofImageUrl || item.deliveryProofImageUrl) && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {item.clothProofImageUrl ? (
              <Pressable
                onPress={() => openImagePreview(item.clothProofImageUrl, "Cloth Handover Photo (कपड़े की फोटो) 📸")}
                style={({ pressed }) => [
                  { flexDirection: "row", alignItems: "center", backgroundColor: "#f5f3ff", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: "#c4b5fd", gap: 6 },
                  pressed && { opacity: 0.75 }
                ]}
              >
                <Image source={{ uri: item.clothProofImageUrl }} style={{ width: 22, height: 22, borderRadius: 4 }} />
                <Ionicons name="camera" size={13} color="#7c3aed" />
                <Text style={{ fontSize: 11, fontWeight: "800", color: "#6d28d9" }}>Cloth Photo 🔍</Text>
              </Pressable>
            ) : null}
            {item.deliveryProofImageUrl ? (
              <Pressable
                onPress={() => openImagePreview(item.deliveryProofImageUrl, "Delivered Outfit Proof (डिलीवरी प्रमाण फोटो) 📦📸")}
                style={({ pressed }) => [
                  { flexDirection: "row", alignItems: "center", backgroundColor: "#f0fdf4", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: "#86efac", gap: 6 },
                  pressed && { opacity: 0.75 }
                ]}
              >
                <Image source={{ uri: item.deliveryProofImageUrl }} style={{ width: 22, height: 22, borderRadius: 4 }} />
                <Ionicons name="shield-checkmark" size={13} color="#16a34a" />
                <Text style={{ fontSize: 11, fontWeight: "800", color: "#15803d" }}>Delivery Photo 🔍</Text>
              </Pressable>
            ) : null}
          </View>
        )}

        {/* Customer Address & Contact Info */}
        {item.homeServiceAddress ? (
          <Pressable
            onPress={() => openMapForNavigation(item.homeServiceAddress, item.homeServiceLocation, `${item.customerId?.name || "Customer"}'s Location`)}
            style={({ pressed }) => [
              { backgroundColor: "#f0fdfa", padding: 12, borderRadius: 12, marginBottom: 12, borderWidth: 1.5, borderColor: "#99f6e4" },
              pressed && { opacity: 0.85 }
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="location-sharp" size={15} color="#0d9488" style={{ marginRight: 4 }} />
                <Text style={{ fontSize: 12, fontWeight: "800", color: "#0f766e" }}>
                  {isHome ? "Doorstep Visit Address:" : "Customer Address:"}
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {item.customerId?.phone && (
                  <Pressable onPress={() => Linking.openURL(`tel:${item.customerId.phone}`)} style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#ccfbf1", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 }}>
                    <Ionicons name="call" size={11} color="#0d9488" style={{ marginRight: 3 }} />
                    <Text style={{ fontSize: 11, color: "#0f766e", fontWeight: "700" }}>{item.customerId.phone}</Text>
                  </Pressable>
                )}
                <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#0d9488", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                  <Ionicons name="navigate" size={11} color="#ffffff" style={{ marginRight: 3 }} />
                  <Text style={{ fontSize: 10, color: "#ffffff", fontWeight: "800" }}>Map</Text>
                </View>
              </View>
            </View>
            <Text style={{ fontSize: 12.5, color: "#134e4a", fontWeight: "600", lineHeight: 18 }}>
              {item.homeServiceAddress}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: "#ccfbf1" }}>
              <Text style={{ fontSize: 11, color: "#0d9488", fontWeight: "600" }}>
                📍 Tap address to start navigation
              </Text>
              <Ionicons name="arrow-forward" size={12} color="#0d9488" />
            </View>
          </Pressable>
        ) : item.customerId?.phone ? (
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10, backgroundColor: "#f8fafc", padding: 8, borderRadius: 8, borderWidth: 1, borderColor: "#e2e8f0" }}>
            <Ionicons name="call" size={13} color="#0d9488" style={{ marginRight: 6 }} />
            <Text style={{ fontSize: 12, color: "#64748b", marginRight: 4 }}>Customer Contact:</Text>
            <Pressable onPress={() => Linking.openURL(`tel:${item.customerId.phone}`)}>
              <Text style={{ fontSize: 12, color: "#0d9488", fontWeight: "700", textDecorationLine: "underline" }}>
                {item.customerId.phone}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* Initial OTP Verification Badge */}
        {item.status !== "pending" && !["cancelled", "declined", "completed"].includes(item.status) && (
          <View style={{ backgroundColor: item.isOtpVerified ? "#ecfdf5" : "#fffbeb", padding: 12, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: item.isOtpVerified ? "#a7f3d0" : "#fef08a", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flexDirection: "row", alignItems: "center", flex: 1, marginRight: 8 }}>
              <Ionicons name={item.isOtpVerified ? "checkmark-circle" : "shield-checkmark"} size={18} color={item.isOtpVerified ? "#059669" : "#d97706"} style={{ marginRight: 6 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: item.isOtpVerified ? "#047857" : "#b45309" }}>
                  {item.isOtpVerified ? "Initial Booking OTP Verified ✅" : "🔒 Start OTP Verification Required"}
                </Text>
                {!item.isOtpVerified && (
                  <Text style={{ fontSize: 11, color: "#d97706", marginTop: 2 }}>
                    Verify initial OTP from customer to start production
                  </Text>
                )}
              </View>
            </View>
            {!item.isOtpVerified && (
              <Pressable style={{ backgroundColor: "#d97706", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }} onPress={() => handleOpenOtpModal(item._id)}>
                <Text style={{ color: "#ffffff", fontWeight: "800", fontSize: 12 }}>Verify OTP</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Delivery OTP Card for Ready / Active Orders */}
        {item.isOtpVerified && item.status !== "completed" && item.status !== "cancelled" && item.status !== "declined" && (
          <View style={{ backgroundColor: item.isDeliveryOtpVerified ? "#ecfdf5" : item.deliveryOtp ? "#e0f2fe" : "#f0fdf4", padding: 12, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: item.isDeliveryOtpVerified ? "#a7f3d0" : item.deliveryOtp ? "#bae6fd" : "#bbf7d0" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flexDirection: "row", alignItems: "center", flex: 1, marginRight: 8 }}>
                <Ionicons name={item.isDeliveryOtpVerified ? "checkmark-done-circle" : "cube"} size={20} color={item.isDeliveryOtpVerified ? "#059669" : item.deliveryOtp ? "#0284c7" : "#16a34a"} style={{ marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: "800", color: item.isDeliveryOtpVerified ? "#047857" : item.deliveryOtp ? "#0369a1" : "#15803d" }}>
                    {item.isDeliveryOtpVerified ? "Delivery OTP Verified ✅" : item.deliveryOtp ? "Delivery OTP Sent to Customer 📦" : "Ready for Delivery"}
                  </Text>
                  <Text style={{ fontSize: 11, color: item.deliveryOtp ? "#0284c7" : "#166534", marginTop: 2 }}>
                    {item.isDeliveryOtpVerified ? "Order completed successfully" : item.deliveryOtp ? "Enter customer Delivery OTP to finish delivery" : "Tap Deliver Order to send Delivery OTP to customer"}
                  </Text>
                </View>
              </View>
              {!item.isDeliveryOtpVerified && (
                <Pressable
                  style={{ backgroundColor: item.deliveryOtp ? "#0284c7" : "#16a34a", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}
                  onPress={() => item.deliveryOtp ? handleOpenDeliveryOtpModal(item._id) : handleGenerateDeliveryOtp(item._id)}
                  disabled={generatingDeliveryOtp}
                >
                  {generatingDeliveryOtp ? <ActivityIndicator color="#fff" size="small" /> : (
                    <Text style={{ color: "#ffffff", fontWeight: "800", fontSize: 12 }}>
                      {item.deliveryOtp ? "Verify Delivery OTP" : "Deliver Order 📦"}
                    </Text>
                  )}
                </Pressable>
              )}
            </View>

            {/* Delivery Photo Proof action row */}
            {!item.isDeliveryOtpVerified && (
              <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: item.deliveryOtp ? "#bae6fd" : "#bbf7d0" }}>
                {item.deliveryProofImageUrl ? (
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Pressable
                      onPress={() => openImagePreview(item.deliveryProofImageUrl, "Delivered Outfit Proof (डिलीवरी प्रमाण फोटो) 📦📸")}
                      style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
                    >
                      <Image source={{ uri: item.deliveryProofImageUrl }} style={{ width: 36, height: 36, borderRadius: 6, marginRight: 8, borderWidth: 1.5, borderColor: "#86efac" }} />
                      <View>
                        <Text style={{ fontSize: 11, fontWeight: "800", color: "#15803d" }}>Delivery Photo Saved ✅</Text>
                        <Text style={{ fontSize: 9.5, color: "#16a34a", fontWeight: "600" }}>Tap to view full photo 🔍</Text>
                      </View>
                    </Pressable>
                    <Pressable
                      onPress={() => handleCaptureDeliveryProofForOrder(item._id)}
                      disabled={uploadingDeliveryProof}
                      style={{ backgroundColor: "#dcfce7", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: "700", color: "#15803d" }}>Change 📷</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => handleCaptureDeliveryProofForOrder(item._id)}
                    disabled={uploadingDeliveryProof}
                    style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#ffffff", paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: item.deliveryOtp ? "#bae6fd" : "#bbf7d0" }}
                  >
                    <Ionicons name="camera" size={14} color="#0284c7" style={{ marginRight: 6 }} />
                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#0284c7" }}>
                      Upload Delivery Photo (कपड़ा डिलीवरी फोटो) 📸
                    </Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        )}

        <View style={styles.servicesBox}>
          {item.services.map((s, i) => {
            const isSvcVip = isPremium || s.serviceMode === "premium" || (s.name && /premium|vip/i.test(s.name));
            return (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginVertical: 2 }}>
                <Text style={styles.serviceText}>• {s.name} (x{s.quantity})</Text>
                {isSvcVip && (
                  <View style={styles.serviceVipTag}>
                    <Text style={styles.serviceVipTagText}>👑 VIP</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.totalPrice}>₹{item.totalAmount}</Text>
          <View style={styles.actions}>
            {item.status === "pending" && (
              <>
                <Pressable style={[styles.btn, styles.declineBtn]} onPress={() => updateStatus(item._id, "declined")}>
                  <Text style={styles.declineText}>Decline</Text>
                </Pressable>
                {isPremium ? (
                  <Pressable
                    style={[styles.btn, styles.acceptBtnVIP]}
                    onPress={() => handleDirectConfirmPremium(item)}
                    disabled={directConfirmingId === item._id}
                  >
                    {directConfirmingId === item._id ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Ionicons name="flash" size={15} color="#fbbf24" />
                        <Text style={styles.acceptText}>Direct Confirm ⚡</Text>
                      </View>
                    )}
                  </Pressable>
                ) : (
                  <Pressable style={[styles.btn, styles.acceptBtn]} onPress={() => handleOpenAcceptModal(item)}>
                    <Text style={styles.acceptText}>Confirm Booking ✅</Text>
                  </Pressable>
                )}
              </>
            )}
            {item.status !== "pending" && item.status !== "cancelled" && item.status !== "completed" && item.status !== "declined" && (
              <View style={{ flexDirection: "row", gap: 8 }}>
                {!item.isOtpVerified && (
                  <Pressable style={[styles.btn, styles.declineBtn]} onPress={() => updateStatus(item._id, "declined")}>
                    <Text style={styles.declineText}>Cancel</Text>
                  </Pressable>
                )}
                {item.status === "accepted" && (
                  <Pressable
                    style={[styles.nextBtn, !item.isOtpVerified && { backgroundColor: "#f59e0b" }]}
                    onPress={() => updateStatus(item._id, "stitching")}
                  >
                    <Text style={styles.nextBtnText}>
                      {item.isOtpVerified ? "Start Stitching" : "Verify OTP to Start 🔒"}
                    </Text>
                  </Pressable>
                )}
                {item.status === "stitching" && (
                  <Pressable style={[styles.nextBtn, { backgroundColor: "#0284c7" }]} onPress={() => handleGenerateDeliveryOtp(item._id)}>
                    <Text style={styles.nextBtnText}>Deliver Order 📦</Text>
                  </Pressable>
                )}
                {item.status === "ready" && (
                  <Pressable style={[styles.nextBtn, { backgroundColor: "#16a34a" }]} onPress={() => item.deliveryOtp ? handleOpenDeliveryOtpModal(item._id) : handleGenerateDeliveryOtp(item._id)}>
                    <Text style={styles.nextBtnText}>{item.deliveryOtp ? "Verify Delivery OTP" : "Deliver Order 📦"}</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderCustomerCard = (item) => {
    const statusStyle = getStatusBadge(item.status);
    const isBeauty = getBookingType(item) === "beauty";
    return (
      <View style={styles.customerCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={[styles.avatarCircle, { backgroundColor: isBeauty ? "#fce7f3" : "#e0e7ff", borderColor: isBeauty ? "#fbcfe8" : "#c7d2fe" }]}>
              <Text style={[styles.avatarText, { color: isBeauty ? "#be185d" : "#4f46e5" }]}>{isBeauty ? "💄" : getInitials(item.barber?.shopName)}</Text>
            </View>
            <View style={styles.cardHeaderInfo}>
              <Text style={styles.shopName} numberOfLines={1}>{item.barber?.shopName || (isBeauty ? "Beauty Parlor" : "Barber Shop")}</Text>
              <Text style={styles.bookingIdText}>{isBeauty ? "💄 BEAUTY • " : "💈 SALON • "}ID: {(item.id || item._id || "").slice(-6).toUpperCase()}</Text>
            </View>
          </View>
          <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
            <Ionicons name={statusStyle.icon} size={12} color={statusStyle.text} style={{ marginRight: 4 }} />
            <Text style={[styles.badgeText, { color: statusStyle.text }]}>{item.status}</Text>
          </View>
        </View>

        <View style={styles.cardDivider} />

        {/* Live Queue Position */}
        {["pending", "confirmed", "arrived"].includes(item.status) && item.queuePosition > 0 && (
          <View style={{ backgroundColor: "#ffedd5", padding: 12, borderRadius: 12, marginBottom: 16, flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="people" size={20} color="#ea580c" style={{ marginRight: 8 }} />
            <View>
              <Text style={{ color: "#c2410c", fontWeight: "700", fontSize: 14 }}>Queue Position: #{item.queuePosition}</Text>
              <Text style={{ color: "#ea580c", fontSize: 12 }}>Customers ahead of you: {item.queuePosition - 1}</Text>
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
        </View>

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
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#334155", marginTop: 8 }}>
              Total: ₹{item.services.reduce((sum, s) => sum + (s.price || 0), 0)}
            </Text>
          </View>
        ) : null}

        {/* Pending Confirmation Banner */}
        {item.status === "pending" && (
          <View style={{ backgroundColor: "#fffbeb", padding: 12, borderRadius: 12, marginVertical: 10, borderWidth: 1, borderColor: "#fef08a", flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="time" size={20} color="#d97706" style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: "800", color: "#b45309" }}>Pending Confirmation</Text>
              <Text style={{ fontSize: 12, color: "#d97706", marginTop: 2 }}>
                Waiting for barber partner to confirm. OTP will be generated immediately once confirmed.
              </Text>
            </View>
          </View>
        )}

        {/* Check-in OTP Box */}
        {item.status === "confirmed" && !item.isOtpVerified && item.verificationPin && (
          <View style={{
            backgroundColor: (item.otpExpiresAt && new Date() > new Date(item.otpExpiresAt)) ? "#fef2f2" : "#fef3c7",
            padding: 14,
            borderRadius: 14,
            marginVertical: 12,
            borderWidth: 1,
            borderColor: (item.otpExpiresAt && new Date() > new Date(item.otpExpiresAt)) ? "#fca5a5" : "#fde68a",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between"
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
              <Ionicons
                name={(item.otpExpiresAt && new Date() > new Date(item.otpExpiresAt)) ? "alert-circle" : "key"}
                size={24}
                color={(item.otpExpiresAt && new Date() > new Date(item.otpExpiresAt)) ? "#dc2626" : "#d97706"}
                style={{ marginRight: 10 }}
              />
              <View>
                <Text style={{
                  fontSize: 11,
                  fontWeight: "800",
                  color: (item.otpExpiresAt && new Date() > new Date(item.otpExpiresAt)) ? "#991b1b" : "#b45309",
                  textTransform: "uppercase"
                }}>
                  {(item.otpExpiresAt && new Date() > new Date(item.otpExpiresAt)) ? "OTP Expired ❌" : "Check-in OTP (Valid 12h)"}
                </Text>
                <Text style={{
                  fontSize: 24,
                  fontWeight: "900",
                  color: (item.otpExpiresAt && new Date() > new Date(item.otpExpiresAt)) ? "#dc2626" : "#92400e",
                  letterSpacing: 4,
                  marginTop: 2,
                  textDecorationLine: (item.otpExpiresAt && new Date() > new Date(item.otpExpiresAt)) ? "line-through" : "none"
                }}>
                  {item.verificationPin}
                </Text>
              </View>
            </View>
            <View style={{
              backgroundColor: (item.otpExpiresAt && new Date() > new Date(item.otpExpiresAt)) ? "#fee2e2" : "#d97706",
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 8
            }}>
              <Text style={{
                color: (item.otpExpiresAt && new Date() > new Date(item.otpExpiresAt)) ? "#dc2626" : "#ffffff",
                fontWeight: "800",
                fontSize: 11
              }}>
                {(item.otpExpiresAt && new Date() > new Date(item.otpExpiresAt)) ? "Expired" : "Show Stylist"}
              </Text>
            </View>
          </View>
        )}

        {/* Actions for customer */}
        {(item.status === "pending" || item.status === "confirmed") && (
          <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
            <Pressable style={styles.cancelBookingBtn} onPress={() => cancelCustomerBooking(item.id || item._id)}>
              <Text style={styles.cancelBookingBtnText}>Cancel Booking</Text>
            </Pressable>
          </View>
        )}

        {item.status === "completed" && (
          <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
            <Pressable
              style={[styles.cancelBookingBtn, { backgroundColor: "#fef08a" }]}
              onPress={() => {
                setReviewBookingId(item.id || item._id);
                setReviewBarberId(item.barber?.id || item.barberId?._id || item.barberId);
                setRating(5);
                setComment("");
                setReviewModalVisible(true);
              }}
            >
              <Text style={[styles.cancelBookingBtnText, { color: "#854d0e" }]}>⭐️ Leave a Review</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  const renderTailorCard = (item) => {
    const statusStyle = getStatusBadge(item.status);
    const shopName = item.tailorId?.shopName || "Tailor Shop";
    const isTailorVip = Boolean(
      item.isPremiumService ||
      (item.services || []).some(s => s.serviceMode === "premium" || (s.name && /premium|vip/i.test(s.name)))
    );

    return (
      <View style={[styles.customerCard, isTailorVip && { borderColor: "#c084fc", borderWidth: 1.5, backgroundColor: "#fffdfa" }]}>
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

        {/* Delivery / Completion Date Banner */}
        {item.deliveryDate ? (
          <View style={{ backgroundColor: "#f3e8ff", padding: 12, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: "#d8b4fe" }}>
            <Text style={{ fontSize: 11, fontWeight: "800", color: "#6d28d9", textTransform: "uppercase" }}>Est. Completion</Text>
            <Text style={{ fontSize: 14, fontWeight: "900", color: "#4c1d95", marginTop: 2 }}>
              Your order will be completed by {new Date(item.deliveryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </Text>
          </View>
        ) : null}

        {/* Customer OTP Card */}
        {item.otp && !["cancelled", "declined"].includes(item.status) && (
          <View style={{ backgroundColor: item.isOtpVerified ? "#ecfdf5" : "#fef3c7", padding: 12, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: item.isOtpVerified ? "#a7f3d0" : "#fde68a", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
              <Ionicons name={item.isOtpVerified ? "checkmark-circle" : "key"} size={22} color={item.isOtpVerified ? "#059669" : "#d97706"} style={{ marginRight: 8 }} />
              <View>
                <Text style={{ fontSize: 10, fontWeight: "800", color: item.isOtpVerified ? "#065f46" : "#b45309" }}>{item.isOtpVerified ? "IDENTITY VERIFIED ✅" : "SHARE WITH TAILOR ✂️"}</Text>
                <Text style={{ fontSize: 20, fontWeight: "900", color: item.isOtpVerified ? "#047857" : "#b45309", letterSpacing: 3, marginTop: 1 }}>{item.otp}</Text>
              </View>
            </View>
            <View style={{ backgroundColor: item.isOtpVerified ? "#d1fae5" : "#fef08a", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
              <Text style={{ fontSize: 10, fontWeight: "800", color: item.isOtpVerified ? "#047857" : "#92400e" }}>{item.isOtpVerified ? "Verified" : "Show Tailor"}</Text>
            </View>
          </View>
        )}

        {/* Delivery OTP Card */}
        {item.deliveryOtp && !["cancelled", "declined"].includes(item.status) && (
          <View style={{ backgroundColor: item.isDeliveryOtpVerified ? "#ecfdf5" : "#e0f2fe", padding: 12, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: item.isDeliveryOtpVerified ? "#a7f3d0" : "#bae6fd", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
              <Ionicons name={item.isDeliveryOtpVerified ? "checkmark-done-circle" : "cube"} size={22} color={item.isDeliveryOtpVerified ? "#059669" : "#0284c7"} style={{ marginRight: 8 }} />
              <View>
                <Text style={{ fontSize: 10, fontWeight: "800", color: item.isDeliveryOtpVerified ? "#065f46" : "#0369a1" }}>{item.isDeliveryOtpVerified ? "ORDER DELIVERED ✅" : "DELIVERY OTP 📦"}</Text>
                <Text style={{ fontSize: 20, fontWeight: "900", color: item.isDeliveryOtpVerified ? "#047857" : "#0369a1", letterSpacing: 3, marginTop: 1 }}>{item.deliveryOtp}</Text>
              </View>
            </View>
            <View style={{ backgroundColor: item.isDeliveryOtpVerified ? "#d1fae5" : "#e0f2fe", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
              <Text style={{ fontSize: 10, fontWeight: "800", color: item.isDeliveryOtpVerified ? "#047857" : "#0369a1" }}>{item.isDeliveryOtpVerified ? "Delivered" : "Show Tailor"}</Text>
            </View>
          </View>
        )}

        {/* Customer Cloth Handover Photo Card */}
        {item.clothProofImageUrl ? (
          <View style={{
            backgroundColor: "#faf5ff",
            padding: 12,
            borderRadius: 12,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: "#e9d5ff"
          }}>
            <Pressable
              onPress={() => openImagePreview(item.clothProofImageUrl, "Cloth Handover Photo (कपड़े की फोटो) 📸")}
              style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                <Ionicons name="camera" size={16} color="#7c3aed" style={{ marginRight: 6 }} />
                <Text style={{ fontSize: 11, fontWeight: "800", color: "#6d28d9" }}>
                  CLOTH HANDOVER PHOTO (कपड़े की फोटो) 📸
                </Text>
              </View>
              <View style={{ backgroundColor: "#ede9fe", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                <Text style={{ fontSize: 9, fontWeight: "800", color: "#6d28d9" }}>Attached ✅</Text>
              </View>
            </Pressable>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Pressable
                onPress={() => openImagePreview(item.clothProofImageUrl, "Cloth Handover Photo (कपड़े की फोटो) 📸")}
                style={{ width: 52, height: 52, borderRadius: 8, overflow: "hidden", borderWidth: 1.5, borderColor: "#c4b5fd", marginRight: 10, backgroundColor: "#000" }}
              >
                <Image source={{ uri: item.clothProofImageUrl }} style={{ width: "100%", height: "100%", resizeMode: "cover" }} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: "#581c87", fontWeight: "600" }}>
                  Photo of cloth handed over for tailoring.
                </Text>
                <Pressable
                  onPress={() => openImagePreview(item.clothProofImageUrl, "Cloth Handover Photo (कपड़े की फोटो) 📸")}
                  style={{ backgroundColor: "#7c3aed", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: "flex-start", marginTop: 4 }}
                >
                  <Text style={{ fontSize: 10, fontWeight: "700", color: "#fff" }}>View Full Photo 🔍</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}

        {/* Delivered Outfit Proof Photo */}
        {item.deliveryProofImageUrl ? (
          <View style={{
            backgroundColor: "#f0fdf4",
            padding: 12,
            borderRadius: 12,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: "#bbf7d0"
          }}>
            <Pressable
              onPress={() => openImagePreview(item.deliveryProofImageUrl, "Delivered Outfit Proof (डिलीवरी प्रमाण फोटो) 📦📸")}
              style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                <Ionicons name="shield-checkmark" size={16} color="#16a34a" style={{ marginRight: 6 }} />
                <Text style={{ fontSize: 11, fontWeight: "800", color: "#15803d" }}>
                  DELIVERED OUTFIT PROOF (डिलीवरी प्रमाण फोटो) 📦📸
                </Text>
              </View>
              <View style={{ backgroundColor: "#dcfce7", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                <Text style={{ fontSize: 9, fontWeight: "800", color: "#16a34a" }}>Delivered Proof ✅</Text>
              </View>
            </Pressable>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Pressable
                onPress={() => openImagePreview(item.deliveryProofImageUrl, "Delivered Outfit Proof (डिलीवरी प्रमाण फोटो) 📦📸")}
                style={{ width: 52, height: 52, borderRadius: 8, overflow: "hidden", borderWidth: 1.5, borderColor: "#86efac", marginRight: 10, backgroundColor: "#000" }}
              >
                <Image source={{ uri: item.deliveryProofImageUrl }} style={{ width: "100%", height: "100%", resizeMode: "cover" }} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: "#166534", fontWeight: "600" }}>
                  Photo of finished outfit uploaded by tailor partner upon delivery.
                </Text>
                <Pressable
                  onPress={() => openImagePreview(item.deliveryProofImageUrl, "Delivered Outfit Proof (डिलीवरी प्रमाण फोटो) 📦📸")}
                  style={{ backgroundColor: "#16a34a", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: "flex-start", marginTop: 4 }}
                >
                  <Text style={{ fontSize: 10, fontWeight: "700", color: "#fff" }}>View Full Photo 🔍</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.servicesBox}>
          {(item.services || []).map((s, i) => (
            <Text key={i} style={styles.serviceText}>• {s.name} (₹{s.price || 0})</Text>
          ))}
          <Text style={{ fontSize: 14, fontWeight: "800", color: "#0f172a", marginTop: 6 }}>Total: ₹{item.totalAmount}</Text>
        </View>

        {item.status === "pending" && (
          <Pressable style={styles.cancelBookingBtn} onPress={() => cancelCustomerTailorOrder(item._id)}>
            <Text style={styles.cancelBookingBtnText}>Cancel Order</Text>
          </Pressable>
        )}

        {item.status === "completed" && (
          <Pressable
            style={[styles.cancelBookingBtn, { backgroundColor: "#fef08a" }]}
            onPress={() => {
              setTailorRatingOrder(item);
              setTailorRating(5);
              setTailorComment("");
              setTailorRatingModalVisible(true);
            }}
          >
            <Text style={[styles.cancelBookingBtnText, { color: "#854d0e" }]}>⭐️ Rate Tailor Service</Text>
          </Pressable>
        )}
      </View>
    );
  };

  if (loading && orders.length === 0 && customerAppointments.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6d28d9" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Top Header Title */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Orders & Queue</Text>
      </View>

      {/* Top Segmented Control for Tailor Partner */}
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

      {/* ==================== VIEW MODE 1: SHOP QUEUE ==================== */}
      {viewMode === "Shop Queue" && (
        <>
          {/* Shop Orders Filter Tabs */}
          <View style={{ paddingTop: 4, paddingBottom: 10 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
              {[
                { key: "all", label: `All (${orders.length})` },
                { key: "pending", label: `Pending (${pendingCount})`, badge: pendingCount > 0 },
                { key: "active", label: "Active" },
                { key: "completed", label: "History" }
              ].map(tab => (
                <Pressable
                  key={tab.key}
                  style={[
                    { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#e2e8f0" },
                    filterTab === tab.key && { backgroundColor: "#6d28d9", borderColor: "#6d28d9" }
                  ]}
                  onPress={() => setFilterTab(tab.key)}
                >
                  <Text style={[{ fontSize: 13, fontWeight: "700", color: "#64748b" }, filterTab === tab.key && { color: "#ffffff" }]}>
                    {tab.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <FlatList
            data={filteredOrders}
            keyExtractor={item => item._id}
            contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6d28d9" />}
            renderItem={renderItem}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="document-text-outline" size={48} color="#cbd5e1" />
                <Text style={styles.emptyText}>No orders found in Shop Queue.</Text>
              </View>
            }
          />
        </>
      )}

      {/* ==================== VIEW MODE 2: MY APPOINTMENTS ==================== */}
      {viewMode === "My Appointments" && (
        <>
          {/* Status Filter Tabs */}
          <View style={{ backgroundColor: "#ffffff", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" }}>
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

          {/* Quick Active OTP Alert Banner */}
          {activeOtpBooking && (
            <View style={{ marginHorizontal: 16, marginTop: 10, backgroundColor: "#fef3c7", padding: 12, borderRadius: 14, borderWidth: 1, borderColor: "#fde68a", flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="key" size={20} color="#d97706" style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, fontWeight: "800", color: "#b45309", textTransform: "uppercase" }}>
                  {activeOtpBooking.deliveryOtp 
                    ? "📦 Active Delivery OTP Code" 
                    : activeOtpBooking.isTailorOrder 
                      ? "✂️ Active Tailor Verification OTP" 
                      : "💈 Active Barber Check-in OTP (12h Validity)"}
                </Text>
                <Text style={{ fontSize: 16, fontWeight: "900", color: "#92400e", letterSpacing: 2, marginTop: 2 }}>
                  {activeOtpBooking.deliveryOtp || activeOtpBooking.otp || activeOtpBooking.verificationPin}
                </Text>
              </View>
              <View style={{ backgroundColor: "#d97706", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
                <Text style={{ color: "#ffffff", fontWeight: "800", fontSize: 11 }}>
                  {activeOtpBooking.isTailorOrder ? "Show Tailor" : "Show Barber"}
                </Text>
              </View>
            </View>
          )}

          {/* Search Bar */}
          <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 }}>
            <View style={styles.searchInputWrapper}>
              <Ionicons name="search" size={18} color="#94a3b8" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search appointments..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor="#94a3b8"
              />
            </View>
          </View>

          <FlatList
            data={filteredCustomerAppointments}
            keyExtractor={item => item.id || item._id}
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6d28d9" />}
            renderItem={({ item }) => item.isTailorOrder ? renderTailorCard(item) : renderCustomerCard(item)}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="calendar-outline" size={48} color="#cbd5e1" />
                <Text style={styles.emptyText}>No Appointments</Text>
                <Text style={{ fontSize: 13, color: "#94a3b8", textAlign: "center", marginTop: 4 }}>
                  Your personal salon and tailor appointments will appear here.
                </Text>
              </View>
            }
          />
        </>
      )}

      {/* Accept Order & Set Target Date Modal */}
      <Modal visible={acceptModalVisible} transparent animationType="slide" onRequestClose={() => setAcceptModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Accept Order</Text>
              <Pressable onPress={() => setAcceptModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </Pressable>
            </View>

            <Text style={{ fontSize: 14, color: "#475569", marginBottom: 16 }}>
              Set estimated completion time for customer order:
            </Text>

            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Estimated Days:</Text>
              <TextInput
                style={styles.daysInput}
                keyboardType="numeric"
                value={estDays}
                onChangeText={setEstDays}
                maxLength={3}
              />
            </View>

            {/* Quick Day Chips */}
            <View style={styles.dayPillsContainer}>
              {["1", "2", "3", "5", "7", "10"].map((d) => (
                <Pressable
                  key={d}
                  style={[styles.dayPill, estDays === d && styles.dayPillActive]}
                  onPress={() => setEstDays(d)}
                >
                  <Text style={[styles.dayPillText, estDays === d && styles.dayPillTextActive]}>{d}d</Text>
                </Pressable>
              ))}
            </View>

            {calcTargetDate(estDays) ? (
              <View style={styles.targetDateBox}>
                <Ionicons name="calendar-outline" size={18} color="#6d28d9" style={{ marginRight: 8 }} />
                <Text style={styles.targetDateText}>
                  Est. Delivery: <Text style={{ fontWeight: "800" }}>{calcTargetDate(estDays)}</Text>
                </Text>
              </View>
            ) : null}

            {selectedOrder?.isHomeService && (
              <View style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#334155", marginBottom: 8 }}>
                  🏡 Home Delivery / Service Charge (₹):
                </Text>
                <View style={[styles.inputRow, { marginBottom: 0 }]}>
                  <Text style={styles.inputLabel}>Amount (₹):</Text>
                  <TextInput
                    style={[styles.daysInput, { width: 120 }]}
                    keyboardType="numeric"
                    value={customVisitFee}
                    onChangeText={setCustomVisitFee}
                    maxLength={5}
                    placeholder="0"
                  />
                </View>
              </View>
            )}

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setAcceptModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.confirmBtn} onPress={handleConfirmAccept} disabled={submittingAccept}>
                {submittingAccept ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmBtnText}>Confirm Accept</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* OTP Verification Modal */}
      <Modal visible={otpModalVisible} transparent animationType="fade" onRequestClose={() => setOtpModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: 30 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Verify Customer OTP</Text>
              <Pressable onPress={() => setOtpModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </Pressable>
            </View>

            <Text style={{ fontSize: 14, color: "#475569", marginBottom: 16 }}>
              Ask customer for 4-digit verification OTP to confirm identity:
            </Text>

            <TextInput
              style={{ backgroundColor: "#f8fafc", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 24, fontWeight: "900", color: "#6d28d9", letterSpacing: 8, textAlign: "center", borderWidth: 1, borderColor: "#cbd5e1", marginBottom: 20 }}
              placeholder="0000"
              placeholderTextColor="#94a3b8"
              keyboardType="numeric"
              maxLength={4}
              value={otpInput}
              onChangeText={setOtpInput}
              editable={!verifyingOtp}
            />

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setOtpModalVisible(false)} disabled={verifyingOtp}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.confirmBtn} onPress={handleVerifyOtp} disabled={verifyingOtp}>
                {verifyingOtp ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmBtnText}>Verify OTP</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delivery OTP Verification Modal */}
      <Modal visible={deliveryOtpModalVisible} transparent animationType="fade" onRequestClose={() => setDeliveryOtpModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: 30 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Verify Customer Delivery OTP 📦</Text>
              <Pressable onPress={() => setDeliveryOtpModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </Pressable>
            </View>

            <Text style={{ fontSize: 14, color: "#475569", marginBottom: 12 }}>
              Ask customer for the 4-digit Delivery OTP to confirm receipt & complete order:
            </Text>

            {/* Delivery Photo Capture */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#0369a1", marginBottom: 6 }}>
                📸 Finished Outfit Delivery Photo (कपड़ा डिलीवरी फोटो):
              </Text>
              {deliveryProofUri ? (
                <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#e0f2fe", padding: 10, borderRadius: 10, borderWidth: 1, borderColor: "#bae6fd" }}>
                  <Pressable
                    onPress={() => openImagePreview(deliveryProofUri, "Finished Outfit Delivery Photo 📸")}
                    style={{ width: 48, height: 48, borderRadius: 8, overflow: "hidden", borderWidth: 1.5, borderColor: "#0284c7", marginRight: 10, backgroundColor: "#000" }}
                  >
                    <Image source={{ uri: deliveryProofUri }} style={{ width: "100%", height: "100%", resizeMode: "cover" }} />
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#0369a1" }}>Delivery Photo Attached ✅</Text>
                    <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
                      <Pressable onPress={() => openImagePreview(deliveryProofUri, "Finished Outfit Delivery Photo 📸")}>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: "#0369a1" }}>View Full 🔍</Text>
                      </Pressable>
                      <Pressable onPress={handlePickDeliveryPhoto}>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: "#0284c7" }}>Change 📷</Text>
                      </Pressable>
                      <Pressable onPress={() => setDeliveryProofUri(null)}>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: "#dc2626" }}>Remove</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              ) : (
                <Pressable
                  onPress={handlePickDeliveryPhoto}
                  style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#f0f9ff", paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: "#bae6fd", borderStyle: "dashed" }}
                >
                  <Ionicons name="camera" size={18} color="#0284c7" style={{ marginRight: 6 }} />
                  <Text style={{ fontSize: 12, fontWeight: "800", color: "#0284c7" }}>
                    Click / Upload Delivery Photo (कपड़ा डिलीवरी फोटो) 📸
                  </Text>
                </Pressable>
              )}
            </View>

            <TextInput
              style={{ backgroundColor: "#f8fafc", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 24, fontWeight: "900", color: "#0284c7", letterSpacing: 8, textAlign: "center", borderWidth: 1, borderColor: "#bae6fd", marginBottom: 20 }}
              placeholder="0000"
              placeholderTextColor="#94a3b8"
              keyboardType="numeric"
              maxLength={4}
              value={deliveryOtpInput}
              onChangeText={setDeliveryOtpInput}
              editable={!verifyingDeliveryOtp && !uploadingDeliveryProof}
            />

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setDeliveryOtpModalVisible(false)} disabled={verifyingDeliveryOtp || uploadingDeliveryProof}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.confirmBtn, { backgroundColor: "#0284c7" }]} onPress={handleVerifyDeliveryOtp} disabled={verifyingDeliveryOtp || uploadingDeliveryProof}>
                {verifyingDeliveryOtp || uploadingDeliveryProof ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmBtnText}>Verify & Complete ✅</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Salon/Parlor Review Modal */}
      <Modal visible={reviewModalVisible} transparent animationType="slide" onRequestClose={() => setReviewModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Rate & Review</Text>
            <Text style={styles.modalSub}>How was your experience?</Text>

            <View style={{ flexDirection: "row", justifyContent: "center", gap: 10, marginBottom: 20 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable key={star} onPress={() => setRating(star)} style={{ padding: 4 }}>
                  <Ionicons name={rating >= star ? "star" : "star-outline"} size={36} color="#eab308" />
                </Pressable>
              ))}
            </View>

            <TextInput
              style={{ backgroundColor: "#f8fafc", borderRadius: 10, borderWidth: 1, borderColor: "#e2e8f0", fontSize: 14, padding: 12, minHeight: 80, marginBottom: 20, textAlignVertical: "top" }}
              placeholder="Write a review or feedback (Optional)"
              value={comment}
              onChangeText={setComment}
              placeholderTextColor="#94a3b8"
              multiline
            />

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setReviewModalVisible(false)} disabled={submittingReview}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.confirmBtn} onPress={submitReview} disabled={submittingReview}>
                {submittingReview ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmBtnText}>Submit Review</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Tailor Rating Modal */}
      <Modal visible={tailorRatingModalVisible} transparent animationType="slide" onRequestClose={() => setTailorRatingModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={{ alignItems: "center", marginBottom: 14 }}>
              <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: "#f3e8ff", justifyContent: "center", alignItems: "center", marginBottom: 8, borderWidth: 1, borderColor: "#d8b4fe" }}>
                <Ionicons name="cut" size={28} color="#6d28d9" />
              </View>
              <Text style={styles.modalTitle}>Rate Tailor Service ✂️</Text>
              <Text style={styles.modalSub}>How was your tailoring & outfit experience?</Text>
            </View>

            <View style={{ flexDirection: "row", justifyContent: "center", gap: 10, marginBottom: 20 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable key={star} onPress={() => setTailorRating(star)} style={{ padding: 4 }}>
                  <Ionicons name={tailorRating >= star ? "star" : "star-outline"} size={36} color="#eab308" />
                </Pressable>
              ))}
            </View>

            <TextInput
              style={{ backgroundColor: "#f8fafc", borderRadius: 10, borderWidth: 1, borderColor: "#e2e8f0", fontSize: 14, padding: 12, minHeight: 80, marginBottom: 20, textAlignVertical: "top" }}
              placeholder="Leave feedback for tailor (Optional)"
              value={tailorComment}
              onChangeText={setTailorComment}
              placeholderTextColor="#94a3b8"
              multiline
            />

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setTailorRatingModalVisible(false)} disabled={submittingTailorRating}>
                <Text style={styles.cancelBtnText}>Skip / Later</Text>
              </Pressable>
              <Pressable style={styles.confirmBtn} onPress={handleSubmittingTailorRating} disabled={submittingTailorRating}>
                {submittingTailorRating ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmBtnText}>Submit Rating</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Full-Screen Photo Preview Modal */}
      <Modal visible={previewImageModalVisible} transparent animationType="fade" onRequestClose={() => setPreviewImageModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.92)", justifyContent: "center", alignItems: "center", padding: 20 }}>
          <View style={{ width: "100%", flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "800", flex: 1 }}>{previewImageTitle || "Photo Preview"}</Text>
            <Pressable
              onPress={() => setPreviewImageModalVisible(false)}
              style={{ backgroundColor: "rgba(255,255,255,0.2)", width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" }}
            >
              <Ionicons name="close" size={24} color="#ffffff" />
            </Pressable>
          </View>
          {previewImageUrl ? (
            <Image
              source={{ uri: previewImageUrl }}
              style={{ width: "100%", height: "75%", borderRadius: 16, resizeMode: "contain" }}
            />
          ) : null}
          <Pressable
            onPress={() => setPreviewImageModalVisible(false)}
            style={{ marginTop: 20, backgroundColor: "#ffffff", paddingVertical: 10, paddingHorizontal: 24, borderRadius: 12 }}
          >
            <Text style={{ color: "#0f172a", fontWeight: "800", fontSize: 14 }}>Close Preview</Text>
          </Pressable>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },

  // Top Header & Primary Toggle
  headerContainer: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 16 : 10,
    paddingBottom: 10,
    backgroundColor: "#f8fafc",
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#0f172a",
  },
  primaryToggleWrapper: {
    paddingHorizontal: 20,
    paddingBottom: 12,
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
    fontWeight: "800",
  },

  // Search input
  searchInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    height: 42,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: "#0f172a",
  },

  // Tailor Order Card styles
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#e2e8f0" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  customerInfo: { flex: 1 },
  customerName: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  date: { fontSize: 12, color: "#64748b", marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: "800" },

  modeBadgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  modeBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  modeBadgeText: { fontSize: 12, fontWeight: "700", marginLeft: 6 },
  timelineBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "#ecfdf5", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  timelineBadgeText: { fontSize: 12, fontWeight: "700", color: "#059669", marginLeft: 4 },

  servicesBox: { backgroundColor: "#f1f5f9", padding: 12, borderRadius: 8, marginBottom: 16 },
  serviceText: { fontSize: 13, color: "#334155", marginBottom: 4 },

  footerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalPrice: { fontSize: 18, fontWeight: "800", color: "#0f172a" },
  actions: { flexDirection: "row", gap: 8 },

  btn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  declineBtn: { backgroundColor: "#fef2f2" },
  declineText: { color: "#ef4444", fontWeight: "600", fontSize: 13 },
  acceptBtn: { backgroundColor: "#6d28d9" },
  acceptText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  nextBtn: { backgroundColor: "#0f172a", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  nextBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },

  cardVIP: {
    borderWidth: 2,
    borderColor: "#9333ea",
    backgroundColor: "#fdf8ff",
    shadowColor: "#9333ea",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  vipOrderBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#7e22ce",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 12,
  },
  vipOrderBannerText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: 0.5,
  },
  vipBadgePill: {
    backgroundColor: "#facc15",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  vipBadgePillText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#581c87",
  },
  acceptBtnVIP: {
    backgroundColor: "#7e22ce",
    flexDirection: "row",
    alignItems: "center",
  },
  serviceVipTag: {
    backgroundColor: "#f3e8ff",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#d8b4fe",
  },
  serviceVipTagText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#7e22ce",
  },

  empty: { padding: 40, alignItems: "center" },
  emptyText: { marginTop: 12, fontSize: 16, color: "#475569", fontWeight: "700" },

  // Customer Card styles
  customerCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardHeaderLeft: { flexDirection: "row", alignItems: "center", flex: 1, marginRight: 8 },
  avatarCircle: { width: 42, height: 42, borderRadius: 21, justifyContent: "center", alignItems: "center", borderWidth: 1, marginRight: 10 },
  avatarText: { fontSize: 16, fontWeight: "800" },
  cardHeaderInfo: { flex: 1 },
  shopName: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  bookingIdText: { fontSize: 11, color: "#64748b", fontWeight: "600", marginTop: 2 },
  badge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
  cardDivider: { height: 1, backgroundColor: "#f1f5f9", marginVertical: 12 },

  detailsGrid: { flexDirection: "row", gap: 16, marginBottom: 12 },
  detailBlock: { flex: 1 },
  detailLabel: { fontSize: 11, color: "#64748b", fontWeight: "600", textTransform: "uppercase" },
  detailValue: { fontSize: 13, fontWeight: "700", color: "#0f172a", marginTop: 2 },

  countdownBadge: {
    backgroundColor: "#eff6ff",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  countdownText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#1d4ed8",
  },

  svcContainer: { backgroundColor: "#f8fafc", padding: 10, borderRadius: 10, marginVertical: 8 },
  svcTitle: { fontSize: 11, fontWeight: "700", color: "#64748b", marginBottom: 6 },
  svcTags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  svcTag: { backgroundColor: "#ffffff", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: "#e2e8f0" },
  svcTagText: { fontSize: 11, fontWeight: "600", color: "#334155" },

  cancelBookingBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#fef2f2",
    alignItems: "center",
  },
  cancelBookingBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#dc2626",
  },

  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.6)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#0f172a" },
  modalSub: { fontSize: 14, color: "#475569", marginBottom: 16 },

  dayPillsContainer: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  dayPill: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#cbd5e1" },
  dayPillActive: { backgroundColor: "#6d28d9", borderColor: "#6d28d9" },
  dayPillText: { fontSize: 13, fontWeight: "700", color: "#475569" },
  dayPillTextActive: { color: "#ffffff" },

  inputRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  inputLabel: { fontSize: 14, fontWeight: "600", color: "#334155" },
  daysInput: { width: 80, backgroundColor: "#f1f5f9", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15, fontWeight: "700", color: "#0f172a", textAlign: "center", borderWidth: 1, borderColor: "#cbd5e1" },

  targetDateBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#f3e8ff", padding: 12, borderRadius: 12, marginBottom: 20 },
  targetDateText: { fontSize: 14, color: "#4c1d95" },

  modalActions: { flexDirection: "row", gap: 12 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: "#f1f5f9", alignItems: "center" },
  cancelBtnText: { fontSize: 15, fontWeight: "700", color: "#475569" },
  confirmBtn: { flex: 2, padding: 14, borderRadius: 12, backgroundColor: "#6d28d9", alignItems: "center" },
  confirmBtnText: { fontSize: 15, fontWeight: "800", color: "#ffffff" }
});
