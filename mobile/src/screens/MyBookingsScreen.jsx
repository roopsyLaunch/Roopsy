import React, { useCallback, useState, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
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
  Platform, Linking
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api/client";
import { getSocket } from "../api/socket";
import { useAuth } from "../context/AuthContext";
import { openMapForNavigation } from "../services/locationService";
import { pickOrCaptureImage } from "../services/imagePickerService";
import { uploadImageAsync } from "../api/upload";

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

export function MyBookingsScreen({ navigation, route }) {
  const { user } = useAuth();
  const isPartner = user?.role === "barber" || user?.role === "tailor" || user?.role === "admin";

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
  const [generatingOtpBookingId, setGeneratingOtpBookingId] = useState(null);

  // Completion OTP Modal State (for marking complete & confirming with customer)
  const [completionOtpModalVisible, setCompletionOtpModalVisible] = useState(false);
  const [completionOtpInput, setCompletionOtpInput] = useState("");
  const [activeCompletionBookingId, setActiveCompletionBookingId] = useState(null);
  const [generatingCompletionOtp, setGeneratingCompletionOtp] = useState(false);
  const [verifyingCompletionOtp, setVerifyingCompletionOtp] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");



  // History Modal
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [customerHistory, setCustomerHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Walk-in Modal
  const [walkInModalVisible, setWalkInModalVisible] = useState(false);
  const [walkInName, setWalkInName] = useState("");
  const [walkInPhone, setWalkInPhone] = useState("");
  const [walkInSearch, setWalkInSearch] = useState("");
  const [shopServices, setShopServices] = useState([]);
  const [selectedWalkInServices, setSelectedWalkInServices] = useState([]);
  const [submittingWalkIn, setSubmittingWalkIn] = useState(false);
  const [loadingShopServices, setLoadingShopServices] = useState(false);
  const [walkInChairIndex, setWalkInChairIndex] = useState(null);
  const [shopSeats, setShopSeats] = useState([]);

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
      const res = await api.post(`/tailors/orders/${orderId}/rate`, {
        rating: Number(tailorRating) || 5,
        comment: (tailorComment || "").trim()
      });
      Alert.alert("Thank You! ⭐️", res.data?.message || "Your tailor rating & review has been saved successfully.");
      setTailorRatingModalVisible(false);
      setTailorRatingOrder(null);
      await load();
    } catch (err) {
      console.error(err);
      Alert.alert("Submission Failed", err?.response?.data?.error || "Failed to submit tailor rating");
    } finally {
      setSubmittingTailorRating(false);
    }
  };

  // Tailor Cloth Handover & Delivery Proof Photo States
  const [uploadingClothOrderId, setUploadingClothOrderId] = useState(null);
  const [previewImageModalVisible, setPreviewImageModalVisible] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState("");
  const [previewImageTitle, setPreviewImageTitle] = useState("");

  const handleUploadClothProof = async (orderId) => {
    try {
      const imageUri = await pickOrCaptureImage({
        title: "Cloth Handover Photo 📸",
        message: "Click or select photo of the cloth handed over to the tailor (कपड़े की फोटो):"
      });
      if (!imageUri) return;

      setUploadingClothOrderId(orderId);
      const uploadedUrl = await uploadImageAsync(imageUri);
      if (!uploadedUrl) {
        Alert.alert("Upload Failed", "Could not upload image to server.");
        return;
      }

      await api.patch(`/tailors/orders/${orderId}/cloth-proof`, {
        clothProofImageUrl: uploadedUrl
      });

      // Update state locally
      setItems((prevItems) =>
        prevItems.map((item) =>
          (item._id === orderId || item.id === orderId)
            ? { ...item, clothProofImageUrl: uploadedUrl, clothProofUploadedAt: new Date(), clothProofUploadedBy: "customer" }
            : item
        )
      );
      await load();

      Alert.alert("Photo Uploaded! 📸", "Cloth handover photo successfully saved and shared with tailor partner.");
    } catch (err) {
      console.error("Upload cloth proof error:", err);
      const errMsg = err?.response?.data?.error || err?.friendlyMessage || err?.message || "Could not upload cloth handover photo.";
      Alert.alert("Upload Error", errMsg);
    } finally {
      setUploadingClothOrderId(null);
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
          const isDoneA = ["completed", "cancelled", "declined", "expired"].includes(a.status);
          const isDoneB = ["completed", "cancelled", "declined", "expired"].includes(b.status);
          if (isDoneA !== isDoneB) return isDoneA ? 1 : -1;
          const dateA = new Date(a.startTime || a.visitDate || a.createdAt).getTime();
          const dateB = new Date(b.startTime || b.visitDate || b.createdAt).getTime();
          return dateB - dateA;
        });
        setItems(combined);
      } else if (isPartner) {
        if (user?.role === "tailor") {
          const res = await api.get("/tailors/me/orders");
          setItems(res.data.orders || []);
        } else {
          const res = await api.get("/bookings/barber");
          setItems(res.data.bookings || []);

          const svcRes = await api.get("/barbers/me");
          if (svcRes.data?.services) {
            setShopServices(svcRes.data.services);
          }
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
          // When barber confirms a pending booking (no OTP yet) — show confirmation alert to customer
          if (data && data.status === "confirmed" && !data.verificationPin && !data.isOtpVerified) {
            Alert.alert(
              "Booking Confirmed! ✅",
              "Great news! Your booking request has been confirmed by the shop partner. 🎉\n\nYou can now visit the shop at your scheduled time. Your Check-in OTP code will unlock upon arrival."
            );
          }
          if (data && (data.status === "cancelled" || data.status === "declined") && (data.isDeclined || data.title?.includes("Declined"))) {
            Alert.alert(
              "Booking Request Declined ❌",
              data.message || "Sorry, your appointment request was declined by the shop partner."
            );
          }
          if (data && data.verificationPin && !data.isOtpVerified && data.status === "confirmed") {
            Alert.alert("It's Your Turn! 🔑", `Your Check-in OTP is: ${data.verificationPin}. Please share this 4-digit code with your barber.`);
          }
          if (data && (data.isOtpVerified || data.message === "OTP Verified ✅")) {
            Alert.alert("OTP Verified! ✅", "Your OTP was verified by the barber partner. Haircut service is now in progress!");
          }
          if (data && data.completionPin) {
            Alert.alert("Service Finished! 🎉", `Your service is complete! Your Completion OTP is: ${data.completionPin}. Please share this OTP with your barber/stylist to confirm completion.`);
          }
          if (data && data.requestReview && data.bookingId) {
            setReviewBookingId(data.bookingId);
            setReviewBarberId(data.barberId);
            setReviewModalVisible(true);
          }
          if (data && data.requestRating && data.orderId) {
            api.get(`/tailors/orders/${data.orderId}`).then(res => {
              if (res.data?.order) {
                openTailorRatingModal(res.data.order);
              }
            }).catch(() => { });
          }
        }
      };

      const handleNewBookingRequest = (data) => {
        if (isActive) {
          load();
          if (isPartner && viewMode !== "My Appointments") {
            Alert.alert(
              "New Booking Request! 🔔",
              `Customer ${data?.customerName || "A client"} has requested an appointment for ${data?.serviceNames || "services"}.\n\nPlease Accept or Decline.`
            );
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
            }).catch(() => { });
          }
        }
      };

      socket.on("bookingUpdated", handleBookingUpdated);
      socket.on("bookingCancelled", handleBookingUpdated);
      socket.on("newBookingRequest", handleNewBookingRequest);
      socket.on("newBooking", handleNewBookingRequest);
      socket.on("tailorOrderCompleted", handleTailorOrderCompleted);

      return () => {
        isActive = false;
        socket.off("bookingUpdated", handleBookingUpdated);
        socket.off("bookingCancelled", handleBookingUpdated);
        socket.off("newBookingRequest", handleNewBookingRequest);
        socket.off("newBooking", handleNewBookingRequest);
        socket.off("tailorOrderCompleted", handleTailorOrderCompleted);
      };
    }, [load, user?.id, isPartner, viewMode])
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

    let alertTitle = "Confirm Action";
    let confirmMsg = `Are you sure you want to mark this booking as ${status}?`;
    let confirmBtnText = "Yes";

    if (status === "confirmed") {
      alertTitle = "Confirm Booking ✅";
      confirmMsg = startTime 
        ? `Accept & confirm this booking for arrival at ${formatTime(startTime)}?`
        : "Accept & confirm this customer appointment request?";
      confirmBtnText = "Accept & Confirm ✅";
    } else if (status === "cancelled") {
      if (viewMode === "My Appointments") {
        alertTitle = "Cancel Booking";
        confirmMsg = "Are you sure you want to cancel your booking?";
        confirmBtnText = "Yes, Cancel";
      } else {
        alertTitle = "Decline Request ❌";
        confirmMsg = "Are you sure you want to decline this customer's booking request?";
        confirmBtnText = "Yes, Decline ❌";
      }
    }

    Alert.alert(alertTitle, confirmMsg, [
      { text: "No", style: "cancel" },
      {
        text: confirmBtnText,
        style: status === "cancelled" ? "destructive" : "default",
        onPress: async () => {
          try {
            await api.patch(`/bookings/${id}`, { status });
            if (status === "confirmed") {
              Alert.alert("Booking Confirmed! ✅", "Appointment is confirmed. Customer has been notified. Enter OTP will unlock upon arrival.");
            } else if (status === "cancelled" && viewMode !== "My Appointments") {
              Alert.alert("Request Declined", "Booking request has been declined. Customer has been notified.");
            }
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

  const handleTriggerCheckinOtp = async (item) => {
    const bookingId = item.id || item._id;
    if (item.status === "pending") {
      return Alert.alert(
        "Confirmation Required ⏳",
        "Please confirm this booking first before generating or entering the check-in OTP."
      );
    }
    if (item.verificationPin) {
      promptVerifyOtp(bookingId);
      return;
    }

    try {
      setGeneratingOtpBookingId(bookingId);
      await api.post(`/bookings/${bookingId}/generate-checkin-otp`);
      Alert.alert(
        "OTP Sent to Customer! 🔑",
        `Check-in OTP has been sent to ${item.customer?.name || "the customer"}. Please ask customer for the 4-digit code.`
      );
      promptVerifyOtp(bookingId);
      await load();
    } catch (e) {
      const errMsg = e?.response?.data?.error;
      Alert.alert(
        "Queue Order Notice ⏳",
        typeof errMsg === "string" ? errMsg : (errMsg?.message || "Cannot generate OTP at this time. Earlier bookings must be served first.")
      );
    } finally {
      setGeneratingOtpBookingId(null);
    }
  };

  const handleResendOtp = async (bookingId) => {
    if (!bookingId) return;
    try {
      setVerifying(true);
      await api.post(`/bookings/${bookingId}/generate-checkin-otp`);
      Alert.alert("OTP Resent! 🔑", "A new Check-in OTP code has been generated and sent to the customer.");
      await load();
    } catch (e) {
      const errMsg = e?.response?.data?.error;
      Alert.alert(
        "Resend Error",
        typeof errMsg === "string" ? errMsg : (errMsg?.message || "Failed to resend OTP.")
      );
    } finally {
      setVerifying(false);
    }
  };

  const submitOtp = async () => {
    if (!otpInput || otpInput.length !== 4) {
      Alert.alert("Invalid Input", "Please enter a valid 4-digit OTP check-in code.");
      return;
    }
    const targetBooking = items.find(i => (i.id || i._id) === activeBookingId);
    if (targetBooking && (targetBooking.status === "cancelled" || targetBooking.status === "declined")) {
      setOtpModalVisible(false);
      return Alert.alert("Booking Cancelled", "This booking is cancelled. OTP verification cannot be performed.");
    }
    if (targetBooking && targetBooking.status === "pending") {
      setOtpModalVisible(false);
      return Alert.alert("Booking Pending ⏳", "This booking is awaiting partner confirmation. Please confirm the booking first.");
    }
    setVerifying(true);
    try {
      await api.post("/bookings/verify-otp", { bookingId: activeBookingId, otp: otpInput });
      setOtpModalVisible(false);
      Alert.alert("Verification Success", "Customer check-in verified successfully. The service session has started.");
      await load();
    } catch (e) {
      const err = e?.response?.data?.error;
      Alert.alert("Verification Error", typeof err === "string" ? err : "Failed to verify the customer OTP. Please check the code and try again.");
    } finally {
      setVerifying(false);
    }
  };

  const handleStartService = async (booking) => {
    const bookingId = booking.id || booking._id;
    try {
      setVerifying(true);
      await api.patch(`/bookings/${bookingId}`, { status: "in-progress" });
      await load();
      Alert.alert("Service Started! ✂️", "Haircut / styling service has officially started.");
    } catch (e) {
      const err = e?.response?.data?.error;
      Alert.alert("Error", typeof err === "string" ? err : (err?.message || "Failed to start service."));
    } finally {
      setVerifying(false);
    }
  };

  const handleStartCompletion = async (booking) => {
    const bookingId = booking.id || booking._id;
    Alert.alert(
      "Complete Service",
      "Are you sure you want to mark this haircut service as completed?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Complete Service",
          style: "default",
          onPress: async () => {
            try {
              setVerifying(true);
              await api.patch(`/bookings/${bookingId}`, { status: "completed" });
              await load();
              Alert.alert("Service Completed! ✅", "The haircut service has been successfully completed.");
            } catch (e) {
              const err = e?.response?.data?.error;
              Alert.alert("Error", typeof err === "string" ? err : (err?.message || "Failed to complete service."));
            } finally {
              setVerifying(false);
            }
          }
        }
      ]
    );
  };

  const submitCompletionOtp = async () => {
    if (!completionOtpInput || completionOtpInput.trim().length !== 4) {
      Alert.alert("Invalid Input", "Please enter the 4-digit Completion OTP code.");
      return;
    }
    const targetBooking = items.find(i => (i.id || i._id) === activeCompletionBookingId);
    if (targetBooking && (targetBooking.status === "cancelled" || targetBooking.status === "declined")) {
      setCompletionOtpModalVisible(false);
      return Alert.alert("Booking Cancelled", "This booking is cancelled. Completion OTP verification cannot be performed.");
    }
    setVerifyingCompletionOtp(true);
    try {
      const res = await api.post("/bookings/verify-completion-otp", {
        bookingId: activeCompletionBookingId,
        otp: completionOtpInput.trim()
      });
      setCompletionOtpModalVisible(false);
      setCompletionOtpInput("");
      setActiveCompletionBookingId(null);
      Alert.alert("Service Completed! 🎉", res.data?.message || "Completion OTP verified & service marked completed!");
      await load();
    } catch (e) {
      const err = e?.response?.data?.error;
      Alert.alert("Verification Failed", typeof err === "string" ? err : "Invalid Completion OTP. Please verify the code and try again.");
    } finally {
      setVerifyingCompletionOtp(false);
    }
  };

  const openHistory = async (phone) => {
    if (!phone) return Alert.alert("Information Missing", "No contact details are available for this customer.");
    setHistoryModalVisible(true);
    setLoadingHistory(true);
    try {
      const res = await api.get(`/barbers/customer-history/${phone}`);
      setCustomerHistory(res.data.history || []);
    } catch (e) {
      Alert.alert("System Error", "Failed to retrieve the customer session history. Please try again.");
    } finally {
      setLoadingHistory(false);
    }
  };

  const openWalkInModal = async () => {
    setWalkInModalVisible(true);
    setWalkInSearch("");
    setWalkInChairIndex(0);
    setLoadingShopServices(true);
    try {
      const svcRes = await api.get("/barbers/me");
      if (svcRes.data?.services && Array.isArray(svcRes.data.services)) {
        setShopServices(svcRes.data.services);
      }
      const seats = svcRes.data?.barber?.seats || svcRes.data?.seats || [];
      setShopSeats(seats.length > 0 ? seats : [{ index: 0, label: "Chair 1", isAvailable: true }]);
    } catch (err) {
      console.error("Failed to load shop services for walk-in", err);
    } finally {
      setLoadingShopServices(false);
    }
  };

  const submitWalkIn = async () => {
    if (selectedWalkInServices.length === 0) {
      return Alert.alert("Select Services", "Please select at least one styling service to proceed.");
    }
    setSubmittingWalkIn(true);
    try {
      await api.post("/bookings/walk-in", {
        customerName: (walkInName || "").trim(),
        serviceIds: selectedWalkInServices,
        seatIndex: walkInChairIndex !== null && walkInChairIndex !== undefined ? walkInChairIndex : 0,
      });
      setWalkInModalVisible(false);
      setWalkInName("");
      setWalkInPhone("");
      setSelectedWalkInServices([]);
      setWalkInSearch("");
      setWalkInChairIndex(0);
      Alert.alert("Chair Booked! 💈", "Walk-in client booked on chair. Live timing updated!");
      await load();
    } catch (e) {
      Alert.alert("Booking Failed", e?.response?.data?.error || "Could not add the walk-in customer. Please try again.");
    } finally {
      setSubmittingWalkIn(false);
    }
  };

  const selectedServicesData = React.useMemo(() => {
    return shopServices.filter(s => {
      const sid = s.id || s._id;
      return selectedWalkInServices.includes(sid);
    });
  }, [shopServices, selectedWalkInServices]);

  const walkInTotalPrice = React.useMemo(() => {
    return selectedServicesData.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
  }, [selectedServicesData]);

  const walkInTotalDuration = React.useMemo(() => {
    return selectedServicesData.reduce((sum, s) => sum + (Number(s.durationMinutes) || 30), 0);
  }, [selectedServicesData]);

  const filteredWalkInServices = React.useMemo(() => {
    if (!walkInSearch.trim()) return shopServices;
    const q = walkInSearch.toLowerCase().trim();
    return shopServices.filter(s => (s.name || "").toLowerCase().includes(q) || (s.category || "").toLowerCase().includes(q));
  }, [shopServices, walkInSearch]);

  const submitReview = async () => {
    const ratingNum = Number(rating);
    if (!ratingNum || ratingNum < 1 || ratingNum > 5) {
      return Alert.alert("Invalid Rating", "Please select a rating value between 1 and 5 stars.");
    }
    if (!reviewBookingId) {
      return Alert.alert("Error", "Booking details missing. Please refresh and try again.");
    }

    setSubmittingReview(true);
    try {
      const res = await api.post("/reviews", {
        barberId: reviewBarberId,
        bookingId: reviewBookingId,
        rating: ratingNum,
        comment: (comment || "").trim()
      });
      setReviewModalVisible(false);
      setRating(5);
      setComment("");
      Alert.alert("Feedback Saved ⭐️", res.data?.message || "Thank you! Your rating and review have been submitted successfully.");
      await load();
    } catch (e) {
      const errMsg = e?.response?.data?.error || "An error occurred while saving your feedback. Please try again.";
      Alert.alert("Submission Failed", typeof errMsg === "string" ? errMsg : JSON.stringify(errMsg));
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
      case "stitching":
        return { bg: "#f5f3ff", text: "#7c3aed", icon: "cut" };
      case "ready":
        return { bg: "#ecfdf5", text: "#059669", icon: "sparkles" };
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
    const cat = (item.barber?.businessCategory || item.barberId?.businessCategory || "").toLowerCase();
    const pref = (item.barber?.genderPreference || item.barberId?.genderPreference || "").toLowerCase();
    const shop = (item.barber?.shopName || item.barberId?.shopName || item.shopName || "").toLowerCase();
    const svcs = (item.services || []).map(s => ((s.category || "") + " " + (s.name || "")).toLowerCase()).join(" ");

    // If partner category or shop name explicitly indicates barber/salon/hair cutting -> BARBER
    if (
      cat.includes("barber") || cat.includes("salon") || cat.includes("hair") || cat.includes("men") ||
      shop.includes("barber") || shop.includes("salon") || shop.includes("hair") || shop.includes("cutting")
    ) {
      return "barber";
    }

    if (
      cat.includes("beauty") || cat.includes("parlor") || cat.includes("parlour") ||
      pref === "women_only" ||
      shop.includes("beauty") || shop.includes("parlor") || shop.includes("parlour") ||
      svcs.includes("makeup") || svcs.includes("waxing") || svcs.includes("bridal") || svcs.includes("mehndi") || svcs.includes("threading")
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
    return items.find(i => 
      !["cancelled", "declined", "rejected", "expired"].includes(i.status) && (
        (i.isTailorOrder && (
          (i.status === "accepted" && i.otp && !i.isOtpVerified) ||
          (i.deliveryOtp && !i.isDeliveryOtpVerified)
        )) ||
        (!i.isTailorOrder && i.status === "confirmed" && i.verificationPin && !i.isOtpVerified)
      )
    );
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

    if (viewMode === "Shop Queue") {
      list.sort((a, b) => {
        if (a.status === "in-progress" && b.status !== "in-progress") return -1;
        if (b.status === "in-progress" && a.status !== "in-progress") return 1;
        const isDoneA = ["completed", "cancelled", "declined", "expired"].includes(a.status);
        const isDoneB = ["completed", "cancelled", "declined", "expired"].includes(b.status);
        if (isDoneA !== isDoneB) return isDoneA ? 1 : -1;
        if (a.queuePosition && b.queuePosition && a.queuePosition !== b.queuePosition) {
          return a.queuePosition - b.queuePosition;
        }
        const timeA = new Date(a.startTime || a.visitDate || a.createdAt).getTime();
        const timeB = new Date(b.startTime || b.visitDate || b.createdAt).getTime();
        if (timeA !== timeB) return timeA - timeB;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
    } else {
      list.sort((a, b) => {
        const isDoneA = ["completed", "cancelled", "declined", "expired"].includes(a.status);
        const isDoneB = ["completed", "cancelled", "declined", "expired"].includes(b.status);
        if (isDoneA !== isDoneB) return isDoneA ? 1 : -1;
        const timeA = new Date(a.startTime || a.visitDate || a.createdAt).getTime();
        const timeB = new Date(b.startTime || b.visitDate || b.createdAt).getTime();
        return timeB - timeA;
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

  const renderCustomerCard = (item, index) => {
    const statusStyle = getStatusBadge(item.status);
    const isBeauty = getBookingType(item) === "beauty";
    const shopName = item.shopName || item.barber?.shopName || item.barberId?.shopName || (isBeauty ? "Beauty Parlor" : "Barber Shop");
    const partnerPhone = item.barber?.phone || item.barber?.mobileNumber || item.barberId?.mobileNumber || item.barberId?.phone || item.barberId?.userId?.phone || "";

    return (
      <View style={styles.card}>
        {/* Header: Avatar + Shop Name + Category ID + Status Badge */}
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={{ position: "relative" }}>
              <View style={[styles.avatarCircle, { backgroundColor: isBeauty ? "#fce7f3" : "#e0e7ff", borderColor: isBeauty ? "#fbcfe8" : "#c7d2fe" }]}>
                <Text style={[styles.avatarText, { color: isBeauty ? "#be185d" : "#4f46e5" }]}>
                  {isBeauty ? "💄" : (shopName ? getInitials(shopName) : "💈")}
                </Text>
              </View>
              {typeof index === "number" && (
                <View style={[styles.serialTagOverlay, { backgroundColor: isBeauty ? "#be185d" : "#4f46e5" }]}>
                  <Text style={styles.serialTagOverlayText}>#{index + 1}</Text>
                </View>
              )}
            </View>
            <View style={styles.cardHeaderInfo}>
              <Text style={styles.shopName} numberOfLines={1}>{shopName}</Text>
              <Text style={styles.bookingIdText}>
                {typeof index === "number" ? `TOKEN #${index + 1} • ` : ""}{isBeauty ? "💄 BEAUTY • " : "💈 SALON • "}ID: {(item.id || "").slice(-6).toUpperCase()}
              </Text>
            </View>
          </View>
          <View style={{ alignItems: "flex-end", gap: 4 }}>
            {typeof index === "number" && (
              <View style={[styles.serialTokenBadge, { backgroundColor: isBeauty ? "#fdf2f8" : "#e0e7ff", borderColor: isBeauty ? "#fbcfe8" : "#c7d2fe" }]}>
                <Ionicons name="time-outline" size={11} color={isBeauty ? "#be185d" : "#4338ca"} style={{ marginRight: 3 }} />
                <Text style={[styles.serialTokenBadgeText, { color: isBeauty ? "#be185d" : "#4338ca" }]}>Token #{index + 1}</Text>
              </View>
            )}
            <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
              <Ionicons name={statusStyle.icon} size={11} color={statusStyle.text} style={{ marginRight: 3 }} />
              <Text style={[styles.badgeText, { color: statusStyle.text }]}>{item.status}</Text>
            </View>
          </View>
        </View>

        <View style={styles.cardDivider} />

        {/* Compact Partner Contact Bar (Shows Shop Name instead of generic title) */}
        {Boolean(partnerPhone) && !["pending", "cancelled", "declined", "expired"].includes(item.status) && (
          <Pressable
            onPress={() => Linking.openURL(`tel:${partnerPhone}`)}
            style={({ pressed }) => [
              styles.compactContactBar,
              { backgroundColor: isBeauty ? "#fdf2f8" : "#f0f4ff", borderColor: isBeauty ? "#fbcfe8" : "#dbeafe" },
              pressed && { opacity: 0.85 }
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", flex: 1, marginRight: 8 }}>
              <View style={[styles.compactContactIconCircle, { backgroundColor: isBeauty ? "#fce7f3" : "#dbeafe" }]}>
                <Ionicons name="call" size={13} color={isBeauty ? "#be185d" : "#2563eb"} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.compactContactShopTitle, { color: isBeauty ? "#be185d" : "#1e40af" }]} numberOfLines={1}>
                  {shopName} Contact
                </Text>
                <Text style={styles.compactContactPhoneText}>{partnerPhone}</Text>
              </View>
            </View>

            <View style={[styles.compactCallPill, { backgroundColor: isBeauty ? "#be185d" : "#2563eb" }]}>
              <Ionicons name="call" size={11} color="#ffffff" style={{ marginRight: 4 }} />
              <Text style={styles.compactCallPillText}>Call Partner</Text>
            </View>
          </Pressable>
        )}

        {/* Live Queue Position & Delay Notice */}
        {["pending", "confirmed", "arrived"].includes(item.status) && item.queuePosition > 0 && (
          <View style={{ backgroundColor: "#ffedd5", paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, marginBottom: 8, flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="people" size={16} color="#ea580c" style={{ marginRight: 6 }} />
            <Text style={{ color: "#c2410c", fontWeight: "700", fontSize: 12, flex: 1 }}>
              Queue Position #{item.queuePosition} • ({item.queuePosition - 1} ahead)
            </Text>
          </View>
        )}

        {item.delayMinutes > 0 && (
          <View style={{ backgroundColor: "#fee2e2", paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, marginBottom: 8, flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="warning" size={16} color="#ef4444" style={{ marginRight: 6 }} />
            <Text style={{ color: "#b91c1c", fontWeight: "700", fontSize: 12, flex: 1 }}>
              Service Delayed by ~{item.delayMinutes} mins
            </Text>
          </View>
        )}

        {/* Unified Schedule & Chair Row (Compact) */}
        <View style={styles.compactScheduleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.compactScheduleLabel}>APPOINTMENT</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2, flexWrap: "wrap" }}>
              <Text style={styles.compactScheduleValue}>
                {formatDateOnly(item.arrivalTime || item.startTime)}, {formatTime(item.arrivalTime || item.startTime)}
              </Text>
              {!item.isHomeService && item.status === 'confirmed' && (
                <LiveCountdown targetDate={item.arrivalTime || item.startTime} />
              )}
              {!item.isHomeService && item.status === 'pending' && (
                <View style={[styles.countdownBadge, { backgroundColor: "#fef3c7", borderColor: "#fde047", borderWidth: 1 }]}>
                  <Text style={[styles.countdownText, { color: "#b45309" }]}>Pending Confirmation</Text>
                </View>
              )}
              {item.isHomeService && item.status === 'confirmed' && item.barberArrivalTime && (
                <LiveCountdown targetDate={item.barberArrivalTime} />
              )}
            </View>
          </View>

          {item.seatLabel ? (
            <View style={styles.compactChairBadge}>
              <Ionicons name="person" size={11} color="#854d0e" style={{ marginRight: 3 }} />
              <Text style={styles.compactChairText}>{item.seatLabel}</Text>
            </View>
          ) : item.isHomeService ? (
            <View style={styles.compactHomeBadge}>
              <Ionicons name="home" size={11} color="#6d28d9" style={{ marginRight: 3 }} />
              <Text style={styles.compactHomeText}>Home Service</Text>
            </View>
          ) : null}
        </View>

        {/* Services & Price Breakdown (Compact Strip) */}
        {item.services?.length ? (
          <View style={styles.compactSvcContainer}>
            <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 5, alignItems: "center" }}>
              <Text style={styles.compactSvcHeader}>Services:</Text>
              {item.services.map((s, i) => (
                <View key={i} style={styles.compactSvcTag}>
                  <Text style={styles.compactSvcTagText}>
                    {s.name} - ₹{s.price || 0}
                  </Text>
                </View>
              ))}
            </View>
            <View style={{ alignItems: "flex-end", marginLeft: 8 }}>
              <Text style={styles.compactTotalLabel}>Total</Text>
              <Text style={styles.compactTotalValue}>
                ₹{item.services.reduce((sum, s) => sum + (s.price || 0), 0)}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Location & Directions Row */}
        {item.isHomeService ? (
          item.homeServiceAddress ? (
            <Pressable
              onPress={() => openMapForNavigation(item.homeServiceAddress, item.homeServiceLocation, "Service Address")}
              style={({ pressed }) => [
                styles.shopAddressBar,
                pressed && { opacity: 0.85 }
              ]}
            >
              <View style={[styles.shopAddressIconCircle, { backgroundColor: "#f5f3ff" }]}>
                <Ionicons name="home" size={16} color="#7c3aed" />
              </View>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={[styles.shopAddressBarLabel, { color: "#6d28d9" }]}>Service Address (Home):</Text>
                <Text style={styles.shopAddressBarValue} numberOfLines={2}>
                  {item.homeServiceAddress}
                </Text>
              </View>
              <View style={[styles.shopAddressMapIconBtn, { backgroundColor: "#7c3aed" }]}>
                <Ionicons name="navigate" size={12} color="#ffffff" style={{ marginRight: 3 }} />
                <Text style={styles.shopAddressMapBtnText}>Map 🗺️</Text>
              </View>
            </Pressable>
          ) : null
        ) : (
          (() => {
            const addrObj = (typeof item.barber?.address === 'object' && item.barber?.address) || 
                            (typeof item.barberId?.address === 'object' && item.barberId?.address) || {};
            const shopAddr = item.shopAddress ||
              item.barber?.formattedAddress ||
              [addrObj.line1, addrObj.line2, addrObj.city, addrObj.state, addrObj.pincode].filter(Boolean).join(", ") ||
              (addrObj.line1 ? `${addrObj.line1}, ${addrObj.city || ""}`.trim() : "") ||
              (typeof item.barber?.address === 'string' ? item.barber.address : "") ||
              (item.notes ? item.notes : "") ||
              "Salon Address";
            const shopLoc = item.shopLocation || item.barber?.location || item.barberId?.location || null;

            return (
              <Pressable
                onPress={() => openMapForNavigation(shopAddr, shopLoc, shopName)}
                style={({ pressed }) => [
                  styles.shopAddressBar,
                  pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }
                ]}
              >
                <View style={[styles.shopAddressIconCircle, { backgroundColor: isBeauty ? "#fce7f3" : "#eef2ff" }]}>
                  <Ionicons name="location-sharp" size={16} color={isBeauty ? "#be185d" : "#4f46e5"} />
                </View>

                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.shopAddressBarLabel, { color: isBeauty ? "#be185d" : "#4f46e5" }]}>
                    {shopName} (Shop Visit)
                  </Text>
                  <Text style={styles.shopAddressBarValue} numberOfLines={2}>
                    {shopAddr}
                  </Text>
                </View>

                <View style={[styles.shopAddressMapIconBtn, { backgroundColor: isBeauty ? "#be185d" : "#4f46e5" }]}>
                  <Ionicons name="navigate" size={12} color="#ffffff" style={{ marginRight: 3 }} />
                  <Text style={styles.shopAddressMapBtnText}>Map 🗺️</Text>
                </View>
              </Pressable>
            );
          })()
        )}

        {/* OTP Verified / Service In Progress Banner */}
        {item.status !== "cancelled" && item.status !== "declined" && (item.status === "in-progress" || item.isOtpVerified) && (
          <View style={{ backgroundColor: "#ecfdf5", padding: 10, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: "#a7f3d0" }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                <Ionicons name="checkmark-circle" size={20} color="#059669" style={{ marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: "900", color: "#047857" }}>
                    OTP Verified • In Chair ✂️
                  </Text>
                </View>
              </View>
              <View style={{ backgroundColor: "#d1fae5", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                <Text style={{ fontSize: 10.5, fontWeight: "800", color: "#047857" }}>Verified ✅</Text>
              </View>
            </View>
          </View>
        )}

        {/* Completion OTP Card for Customer */}
        {item.status !== "cancelled" && item.status !== "declined" && item.completionPin && !item.isCompletionOtpVerified && (
          <View style={{ backgroundColor: "#fdf4ff", padding: 12, borderRadius: 12, marginBottom: 8, borderWidth: 1.5, borderColor: "#d946ef" }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                <Ionicons name="sparkles" size={18} color="#c026d3" style={{ marginRight: 6 }} />
                <Text style={{ fontSize: 12, fontWeight: "800", color: "#701a75" }}>
                  Completion OTP: Share with Partner 🎉
                </Text>
              </View>
            </View>
            <View style={{ alignItems: "center", marginVertical: 6, backgroundColor: "#ffffff", paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: "#f5d0fe" }}>
              <Text style={{ fontSize: 24, fontWeight: "900", color: "#86198f", letterSpacing: 6 }}>
                {item.completionPin}
              </Text>
            </View>
          </View>
        )}

        {/* Completion Verified Banner */}
        {item.isCompletionOtpVerified && (
          <View style={{ backgroundColor: "#f0fdf4", padding: 10, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: "#bbf7d0", flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="checkmark-done-circle" size={18} color="#16a34a" style={{ marginRight: 8 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: "800", color: "#15803d" }}>Service Completed & Confirmed ✅</Text>
            </View>
          </View>
        )}

        {/* Pending Confirmation Card for Customer */}
        {item.status === "pending" && (
          <View style={{
            backgroundColor: "#fffdf5",
            borderRadius: 14,
            padding: 13,
            marginBottom: 10,
            borderWidth: 1.5,
            borderColor: "#fde68a",
          }}>
            {/* Header with amber badge */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 7, flex: 1 }}>
                <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: "#fef3c7", justifyContent: "center", alignItems: "center" }}>
                  <Ionicons name="hourglass" size={16} color="#d97706" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: "800", color: "#92400e" }}>
                    Awaiting Shop Confirmation ⏳
                  </Text>
                  <Text style={{ fontSize: 11, color: "#b45309", fontWeight: "600" }}>
                    Booking Request Sent • Not Confirmed Yet
                  </Text>
                </View>
              </View>
              <View style={{ backgroundColor: "#fef3c7", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, borderWidth: 1, borderColor: "#fde68a" }}>
                <Text style={{ fontSize: 10.5, fontWeight: "800", color: "#b45309" }}>PENDING</Text>
              </View>
            </View>

            {/* Visual 3-Stage Booking Progress Stepper */}
            <View style={{ backgroundColor: "#ffffff", borderRadius: 10, padding: 10, borderWidth: 1, borderColor: "#fef3c7", marginBottom: 9 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ alignItems: "center", flex: 1 }}>
                  <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
                  <Text style={{ fontSize: 10, fontWeight: "700", color: "#16a34a", marginTop: 2 }}>Requested</Text>
                </View>
                <View style={{ height: 2, flex: 1, backgroundColor: "#fde68a" }} />
                <View style={{ alignItems: "center", flex: 1 }}>
                  <Ionicons name="time" size={18} color="#d97706" />
                  <Text style={{ fontSize: 10, fontWeight: "800", color: "#d97706", marginTop: 2 }}>Confirming...</Text>
                </View>
                <View style={{ height: 2, flex: 1, backgroundColor: "#e2e8f0" }} />
                <View style={{ alignItems: "center", flex: 1 }}>
                  <Ionicons name="lock-closed" size={18} color="#94a3b8" />
                  <Text style={{ fontSize: 10, fontWeight: "600", color: "#94a3b8", marginTop: 2 }}>OTP Locked</Text>
                </View>
              </View>
            </View>

            {/* Informational Message */}
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6, backgroundColor: "#fffbeb", padding: 8, borderRadius: 8 }}>
              <Ionicons name="information-circle" size={16} color="#d97706" style={{ marginTop: 1 }} />
              <Text style={{ fontSize: 11.5, color: "#78350f", flex: 1, lineHeight: 16 }}>
                Shop partner has not accepted yet. Your Check-in OTP code will unlock and become visible once the shopkeeper confirms your appointment.
              </Text>
            </View>
          </View>
        )}

        {/* Check-in OTP Box (Compact) or In Queue Waiting Banner */}
        {item.status === "confirmed" && !item.isOtpVerified && item.verificationPin ? (
          <View style={[
            styles.compactOtpCard,
            (item.otpExpiresAt && new Date() > new Date(item.otpExpiresAt)) && { backgroundColor: "#fef2f2", borderColor: "#fca5a5" }
          ]}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons
                  name={(item.otpExpiresAt && new Date() > new Date(item.otpExpiresAt)) ? "alert-circle" : "key"}
                  size={16}
                  color={(item.otpExpiresAt && new Date() > new Date(item.otpExpiresAt)) ? "#dc2626" : "#d97706"}
                  style={{ marginRight: 6 }}
                />
                <Text style={[
                  styles.compactOtpHeader,
                  (item.otpExpiresAt && new Date() > new Date(item.otpExpiresAt)) && { color: "#dc2626" }
                ]}>
                  {(item.otpExpiresAt && new Date() > new Date(item.otpExpiresAt)) ? "OTP Expired ❌" : "Check-in OTP 🔑"}
                </Text>
              </View>
              <View style={[
                styles.compactOtpBadge,
                (item.otpExpiresAt && new Date() > new Date(item.otpExpiresAt)) && { backgroundColor: "#fee2e2" }
              ]}>
                <Text style={[
                  styles.compactOtpBadgeText,
                  (item.otpExpiresAt && new Date() > new Date(item.otpExpiresAt)) && { color: "#dc2626" }
                ]}>
                  {(item.otpExpiresAt && new Date() > new Date(item.otpExpiresAt)) ? "Expired" : "Show Barber"}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 4 }}>
              <Text style={[
                styles.compactOtpPin,
                (item.otpExpiresAt && new Date() > new Date(item.otpExpiresAt)) && { color: "#dc2626", textDecorationLine: "line-through" }
              ]}>
                {item.verificationPin}
              </Text>
              <Text style={[
                styles.compactOtpHours,
                (item.otpExpiresAt && new Date() > new Date(item.otpExpiresAt)) && { color: "#dc2626" }
              ]}>
                {item.otpExpiresAt
                  ? `Expires: ${new Date(item.otpExpiresAt).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit', hour12: true })}`
                  : "Valid 12h"}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Confirmed but No OTP yet: Barber confirmed, waiting for their turn */}
        {item.status === "confirmed" && !item.isOtpVerified && !item.verificationPin && !item.isTailorOrder && (
          <View style={{
            backgroundColor: "#ecfdf5",
            borderRadius: 14,
            padding: 12,
            marginBottom: 10,
            borderWidth: 1.5,
            borderColor: "#6ee7b7",
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#d1fae5", justifyContent: "center", alignItems: "center" }}>
                <Ionicons name="checkmark-circle" size={20} color="#059669" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "800", color: "#065f46" }}>Booking Confirmed by Shop! ✅</Text>
                <Text style={{ fontSize: 11, color: "#047857", fontWeight: "600" }}>Shopkeeper accepted your request</Text>
              </View>
              <View style={{ backgroundColor: "#d1fae5", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1, borderColor: "#6ee7b7" }}>
                <Text style={{ fontSize: 10.5, fontWeight: "800", color: "#065f46" }}>CONFIRMED</Text>
              </View>
            </View>

            {/* 3-stage mini-stepper for confirmed */}
            <View style={{ backgroundColor: "#ffffff", borderRadius: 10, padding: 10, borderWidth: 1, borderColor: "#d1fae5", marginTop: 10, marginBottom: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={{ alignItems: "center", flex: 1 }}>
                  <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
                  <Text style={{ fontSize: 10, fontWeight: "700", color: "#16a34a", marginTop: 2 }}>Requested</Text>
                </View>
                <View style={{ height: 2, flex: 1, backgroundColor: "#6ee7b7" }} />
                <View style={{ alignItems: "center", flex: 1 }}>
                  <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
                  <Text style={{ fontSize: 10, fontWeight: "700", color: "#16a34a", marginTop: 2 }}>Confirmed ✅</Text>
                </View>
                <View style={{ height: 2, flex: 1, backgroundColor: "#e2e8f0" }} />
                <View style={{ alignItems: "center", flex: 1 }}>
                  <Ionicons name="key" size={18} color="#94a3b8" />
                  <Text style={{ fontSize: 10, fontWeight: "600", color: "#94a3b8", marginTop: 2 }}>OTP Pending</Text>
                </View>
              </View>
            </View>

            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 5, backgroundColor: "#f0fdf4", padding: 8, borderRadius: 8 }}>
              <Ionicons name="information-circle" size={14} color="#16a34a" style={{ marginTop: 1 }} />
              <Text style={{ fontSize: 11, color: "#166534", flex: 1, lineHeight: 15 }}>
                Your Check-in OTP will appear here when the shopkeeper generates it at your turn. Please visit the shop at your scheduled time.
              </Text>
            </View>
          </View>
        )}

        {/* Action Buttons Section */}
        {viewMode !== "My Appointments" ? (
          /* ================= SHOP PARTNER ACTION CONTROLS ================= */
          <View style={{ marginTop: 14 }}>
            {item.status === "pending" && (
              <View style={{ gap: 8 }}>
                <View style={{ backgroundColor: "#fef3c7", padding: 10, borderRadius: 10, borderWidth: 1, borderColor: "#fde68a", flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="time" size={18} color="#b45309" />
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "#92400e", flex: 1 }}>
                    New Customer Request • Please confirm to accept this appointment
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Pressable
                    style={[styles.cancelBtn, { flex: 1, marginTop: 0, backgroundColor: "#fef2f2", borderColor: "#fca5a5", borderWidth: 1 }]}
                    onPress={() => setStatus(item.id || item._id, "cancelled")}
                  >
                    <Ionicons name="close-circle" size={15} color="#dc2626" style={{ marginRight: 4 }} />
                    <Text style={[styles.cancelText, { color: "#dc2626" }]}>Decline ❌</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.cancelBtn, { flex: 2, marginTop: 0, backgroundColor: "#6d28d9", borderColor: "#6d28d9" }]}
                    onPress={() => setStatus(item.id || item._id, "confirmed", item.arrivalTime || item.startTime, item.isHomeService)}
                  >
                    <Ionicons name="checkmark-circle" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                    <Text style={[styles.cancelText, { color: "#ffffff", fontWeight: "800" }]}>Confirm Booking ✅</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {item.status === "confirmed" && (
              <View style={{ gap: 8 }}>
                <View style={{ backgroundColor: "#ecfdf5", padding: 10, borderRadius: 10, borderWidth: 1, borderColor: "#a7f3d0", flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="checkmark-circle" size={18} color="#059669" />
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "#065f46", flex: 1 }}>
                    Booking Confirmed ✅ • Ask customer for 4-digit OTP upon arrival
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Pressable
                    style={[
                      styles.cancelBtn,
                      {
                        flex: 2,
                        marginTop: 0,
                        backgroundColor: "#0f172a",
                        borderColor: "#0f172a",
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6
                      },
                      generatingOtpBookingId === (item.id || item._id) && { opacity: 0.7 }
                    ]}
                    onPress={() => handleTriggerCheckinOtp(item)}
                    disabled={generatingOtpBookingId === (item.id || item._id)}
                  >
                    {generatingOtpBookingId === (item.id || item._id) ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Ionicons name="key" size={15} color="#fbbf24" />
                        <Text style={[styles.cancelText, { color: "#ffffff", fontWeight: "800" }]}>Enter OTP ✂️</Text>
                      </>
                    )}
                  </Pressable>
                  <Pressable
                    style={[styles.cancelBtn, { flex: 1, marginTop: 0, backgroundColor: "#fef2f2", borderColor: "#fca5a5", borderWidth: 1 }]}
                    onPress={() => setStatus(item.id || item._id, "cancelled")}
                  >
                    <Text style={[styles.cancelText, { color: "#dc2626" }]}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {item.status === "arrived" && (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable
                  style={[styles.cancelBtn, { flex: 2, marginTop: 0, backgroundColor: "#0f172a", borderColor: "#0f172a" }]}
                  onPress={() => handleTriggerCheckinOtp(item)}
                >
                  <Ionicons name="key" size={15} color="#fbbf24" style={{ marginRight: 6 }} />
                  <Text style={[styles.cancelText, { color: "#ffffff", fontWeight: "800" }]}>Enter OTP ✂️</Text>
                </Pressable>
                <Pressable
                  style={[styles.cancelBtn, { flex: 1, marginTop: 0, backgroundColor: "#fef2f2", borderColor: "#fca5a5", borderWidth: 1 }]}
                  onPress={() => setStatus(item.id || item._id, "cancelled")}
                >
                  <Text style={[styles.cancelText, { color: "#dc2626" }]}>Cancel</Text>
                </Pressable>
              </View>
            )}

            {item.status === "in-progress" && (
              <Pressable
                style={[styles.cancelBtn, { marginTop: 0, backgroundColor: "#16a34a", borderColor: "#16a34a" }]}
                onPress={() => handleStartCompletion(item)}
              >
                <Ionicons name="checkmark-done" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={[styles.cancelText, { color: "#ffffff", fontWeight: "800" }]}>Complete Service ✂️</Text>
              </Pressable>
            )}
          </View>
        ) : (
          /* ================= CUSTOMER ACTION CONTROLS ================= */
          <View style={{ marginTop: 14 }}>
            {item.status === "pending" && (
              <Pressable
                style={[
                  styles.cancelBtn,
                  { marginTop: 0, backgroundColor: "#fef2f2", borderColor: "#fca5a5", borderWidth: 1 }
                ]}
                onPress={() => setStatus(item.id || item._id, "cancelled")}
              >
                <Text style={[styles.cancelText, { color: "#dc2626" }]}>Cancel Request</Text>
              </Pressable>
            )}

            {item.status !== "cancelled" && item.status !== "completed" && item.status !== "in-progress" && item.status !== "expired" && item.status !== "pending" && (
              <Pressable
                style={[
                  styles.cancelBtn,
                  { marginTop: 0, backgroundColor: "#fef2f2", borderColor: "#fca5a5", borderWidth: 1 }
                ]}
                onPress={() => setStatus(item.id || item._id, "cancelled")}
              >
                <Text style={[styles.cancelText, { color: "#dc2626" }]}>Cancel Booking</Text>
              </Pressable>
            )}
          </View>
        )}

        {item.status === "completed" && viewMode === "My Appointments" && (
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <Pressable style={[styles.cancelBtn, { flex: 1, marginTop: 0, backgroundColor: "#f1f5f9" }]} onPress={() => {
              const bObj = item.barber || item.barberId || {};
              const cat = (bObj.businessCategory || "").toLowerCase();
              const bId = bObj.id || bObj._id || item.barberId;
              const sName = bObj.shopName || "";
              if (cat.includes("tailor") || cat.includes("stitching") || cat.includes("center")) {
                navigation.navigate("TailorDetail", { tailorId: bId, shopName: sName });
              } else if (cat.includes("beauty") || cat.includes("parlor") || cat.includes("parlour")) {
                navigation.navigate("BeautyParlorDetail", { barberId: bId, shopName: sName });
              } else {
                navigation.navigate("BarberDetail", { barberId: bId, shopName: sName });
              }
            }}>
              <Text style={[styles.cancelText, { color: "#0f172a" }]}>Book Again</Text>
            </Pressable>
            {item.isRated ? (
              <View style={{ flex: 1, backgroundColor: "#f0fdf4", padding: 8, borderRadius: 12, borderWidth: 1, borderColor: "#bbf7d0", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Ionicons name="star" size={16} color="#eab308" style={{ marginRight: 4 }} />
                  <Text style={{ fontSize: 12, fontWeight: "800", color: "#166534" }}>Rated: {item.rating}/5</Text>
                </View>
                <Pressable onPress={() => {
                  setReviewBookingId(item.id || item._id);
                  setReviewBarberId(item.barber?.id || item.barberId?._id || item.barberId);
                  setRating(item.rating || 5);
                  setComment(item.reviewComment || "");
                  setReviewModalVisible(true);
                }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#15803d", textDecorationLine: "underline" }}>Edit Review</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable style={[styles.cancelBtn, { flex: 1, marginTop: 0, backgroundColor: "#fef08a" }]} onPress={() => {
                setReviewBookingId(item.id || item._id);
                setReviewBarberId(item.barber?.id || item.barberId?._id || item.barberId);
                setRating(5);
                setComment("");
                setReviewModalVisible(true);
              }}>
                <Text style={[styles.cancelText, { color: "#854d0e" }]}>⭐️ Leave a Review</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderTailorCard = (item, index) => {
    const statusStyle = getStatusBadge(item.status);
    const shopName = item.tailorId?.shopName || "Tailor Shop";
    const tailorPhone = item.tailorId?.mobileNumber || item.tailorId?.phone || item.tailorId?.userId?.phone || item.tailorPhone || "";
    const isTailorVip = Boolean(
      item.isPremiumService ||
      (item.services || []).some(s => s.serviceMode === "premium" || s.isPremium || (s.name && /premium|vip/i.test(s.name)))
    );
    const vipCompletionTime = (
      item.completionTime ||
      (item.services || []).find(s => s.serviceMode === "premium" || s.isPremium || (s.name && /premium|vip/i.test(s.name)))?.completionTime ||
      (isTailorVip ? "12 Hours" : "")
    ).trim();

    const cancelTailorOrder = async () => {
      Alert.alert("Cancel Booking Request", "Are you sure you want to cancel this tailor booking?", [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              await api.patch(`/tailors/orders/${item._id}/cancel`, { cancellationReason: "Cancelled by customer" });
              Alert.alert("Booking Cancelled", "Your tailor booking request has been successfully cancelled.");
              await load();
            } catch (e) {
              const errMsg = e?.response?.data?.error || "Failed to cancel order";
              Alert.alert("Cancellation Failed", errMsg);
            }
          }
        }
      ]);
    };

    return (
      <View style={[
        styles.card,
        isTailorVip && { borderColor: "#c084fc", borderWidth: 1.5, backgroundColor: "#faf5ff" },
        { padding: 14, marginBottom: 14, borderRadius: 16 }
      ]}>
        {/* VIP Micro Ribbon */}
        {isTailorVip && (
          <View style={{ backgroundColor: "#7e22ce", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Ionicons name="sparkles" size={12} color="#fbbf24" />
              <Text style={{ color: "#ffffff", fontWeight: "900", fontSize: 10.5, letterSpacing: 0.5 }}>
                👑 PREMIUM VIP BOOKING
              </Text>
            </View>
            <View style={{ backgroundColor: "#facc15", paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 4 }}>
              <Text style={{ color: "#581c87", fontWeight: "900", fontSize: 9.5 }}>
                {vipCompletionTime || "EXPRESS"}
              </Text>
            </View>
          </View>
        )}

        {/* Clean Header: Shop Info, Order ID, Call Button & Status */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1, marginRight: 8 }}>
            <View style={{ position: "relative" }}>
              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#f3e8ff", alignItems: "center", justifyContent: "center", marginRight: 10, borderWidth: 1, borderColor: "#e9d5ff" }}>
                <Text style={{ fontSize: 17 }}>✂️</Text>
              </View>
              {typeof index === "number" && (
                <View style={[styles.serialTagOverlay, { backgroundColor: "#7e22ce" }]}>
                  <Text style={styles.serialTagOverlayText}>#{index + 1}</Text>
                </View>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: "800", color: "#0f172a" }} numberOfLines={1}>{shopName}</Text>
              <Text style={{ fontSize: 11, color: "#64748b", fontWeight: "600", marginTop: 1 }}>
                {typeof index === "number" ? `ORDER #${index + 1} • ` : ""}#{item._id.slice(-6).toUpperCase()} • {formatDateOnly(item.createdAt)}
              </Text>
            </View>
          </View>
          <View style={{ alignItems: "flex-end", gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              {typeof index === "number" && (
                <View style={[styles.serialTokenBadge, { backgroundColor: "#f3e8ff", borderColor: "#d8b4fe" }]}>
                  <Ionicons name="time-outline" size={11} color="#7e22ce" style={{ marginRight: 3 }} />
                  <Text style={[styles.serialTokenBadgeText, { color: "#7e22ce" }]}>Queue #{index + 1}</Text>
                </View>
              )}
              {Boolean(tailorPhone) && !["pending", "cancelled", "declined"].includes(item.status) && (
                <Pressable
                  onPress={() => Linking.openURL(`tel:${tailorPhone}`)}
                  style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#7c3aed", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, gap: 4 }}
                >
                  <Ionicons name="call" size={12} color="#ffffff" />
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#ffffff" }}>Call</Text>
                </Pressable>
              )}
            </View>
            <View style={[styles.badge, { backgroundColor: statusStyle.bg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }]}>
              <Ionicons name={statusStyle.icon} size={11} color={statusStyle.text} style={{ marginRight: 3 }} />
              <Text style={[styles.badgeText, { color: statusStyle.text, fontSize: 10.5, fontWeight: "800" }]}>
                {(item.status || "pending").toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Services & Pricing Box */}
        {item.services?.length ? (
          <View style={{ backgroundColor: "#f8fafc", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: "#f1f5f9" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 13, color: "#1e293b", fontWeight: "700", flex: 1, marginRight: 8 }} numberOfLines={1}>
                ✂️ {item.services.map(s => `${s.name}${s.quantity > 1 ? ` x${s.quantity}` : ""}`).join(", ")}
              </Text>
              <Text style={{ fontSize: 15, fontWeight: "900", color: "#6d28d9" }}>
                ₹{item.totalAmount}
              </Text>
            </View>
            {(item.isHomeService && item.visitFee > 0) || (item.fabricDetails?.totalFabricCost > 0) ? (
              <Text style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
                {[
                  item.services.length > 0 ? `Services: ₹${item.services.reduce((acc, s) => acc + (s.price || 0) * (s.quantity || 1), 0)}` : "",
                  item.fabricDetails?.totalFabricCost > 0 ? `Fabric: ₹${item.fabricDetails.totalFabricCost}` : "",
                  item.isHomeService && item.visitFee > 0 ? `Doorstep: ₹${item.visitFee}` : ""
                ].filter(Boolean).join(" • ")}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* Schedule & Location Details Line */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", marginBottom: 10, paddingHorizontal: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ backgroundColor: item.isPremiumService ? "#f3e8ff" : item.isHomeService ? "#ede9fe" : "#e0f2fe", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
              <Text style={{ fontSize: 10.5, fontWeight: "700", color: item.isPremiumService ? "#7c3aed" : item.isHomeService ? "#6d28d9" : "#0369a1" }}>
                {item.isPremiumService ? "👑 VIP Express" : item.isHomeService ? "🏡 Home Visit" : "🏪 Shop Visit"}
              </Text>
            </View>

            {(item.deliveryDate || item.completionTime || item.estimatedDays) ? (
              <View style={{ backgroundColor: "#f3e8ff", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Ionicons name="time-outline" size={11} color="#6d28d9" />
                <Text style={{ fontSize: 10.5, fontWeight: "700", color: "#6d28d9" }}>
                  {item.deliveryDate
                    ? `Est: ${new Date(item.deliveryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                    : `Est: ${vipCompletionTime || item.completionTime || `${item.estimatedDays}d`}`}
                </Text>
              </View>
            ) : null}
          </View>

          {item.homeServiceAddress && item.isHomeService && item.status !== "completed" && (
            <Pressable
              onPress={() => openMapForNavigation(item.homeServiceAddress, item.homeServiceLocation, "Order Address")}
              style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#f0fdfa", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: "#ccfbf1" }}
            >
              <Ionicons name="location-sharp" size={11} color="#0d9488" />
              <Text style={{ fontSize: 10.5, color: "#0f766e", fontWeight: "700" }}>Map 🗺️</Text>
            </Pressable>
          )}
        </View>

        {/* Address snippet if home service */}
        {item.homeServiceAddress && (
          <View style={{ marginBottom: 10, paddingHorizontal: 2 }}>
            <Text style={{ fontSize: 11, color: "#475569" }} numberOfLines={1}>
              📍 {item.homeServiceAddress}
            </Text>
          </View>
        )}

        {/* Attached Photo Proofs (Clean Thumbnails) */}
        {item.status !== "pending" && !["cancelled", "declined"].includes(item.status) && (
          <View style={{ marginBottom: 10 }}>
            {(item.clothProofImageUrl || item.deliveryProofImageUrl) ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {item.clothProofImageUrl ? (
                  <Pressable
                    onPress={() => {
                      setPreviewImageUrl(item.clothProofImageUrl);
                      setPreviewImageTitle("Cloth Handover Photo (कपड़े की फोटो) 📸");
                      setPreviewImageModalVisible(true);
                    }}
                    style={({ pressed }) => [
                      {
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: "#f5f3ff",
                        borderWidth: 1,
                        borderColor: "#ddd6fe",
                        paddingHorizontal: 8,
                        paddingVertical: 5,
                        borderRadius: 8,
                        gap: 6,
                      },
                      pressed && { opacity: 0.8 }
                    ]}
                  >
                    <Image source={{ uri: item.clothProofImageUrl }} style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: "#000" }} />
                    <View>
                      <Text style={{ fontSize: 11, fontWeight: "800", color: "#6d28d9" }}>Cloth Photo 🔍</Text>
                      <Text style={{ fontSize: 9, color: "#8b5cf6" }}>Tap to view</Text>
                    </View>
                    {!item.isOtpVerified && (
                      <Pressable
                        onPress={() => handleUploadClothProof(item._id)}
                        disabled={uploadingClothOrderId === item._id}
                        style={{ marginLeft: 4, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: "#ede9fe", borderRadius: 4 }}
                      >
                        <Text style={{ fontSize: 9, fontWeight: "700", color: "#7c3aed" }}>Retake 📷</Text>
                      </Pressable>
                    )}
                  </Pressable>
                ) : item.status !== "completed" ? (
                  <Pressable
                    onPress={() => handleUploadClothProof(item._id)}
                    disabled={uploadingClothOrderId === item._id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: "#fdf4ff",
                      borderWidth: 1,
                      borderColor: "#f5d0fe",
                      paddingHorizontal: 8,
                      paddingVertical: 5,
                      borderRadius: 8,
                      gap: 5
                    }}
                  >
                    <Ionicons name="camera" size={13} color="#9333ea" />
                    <Text style={{ fontSize: 10.5, fontWeight: "800", color: "#9333ea" }}>
                      {uploadingClothOrderId === item._id ? "Uploading..." : "+ Add Cloth Photo 📸"}
                    </Text>
                  </Pressable>
                ) : null}

                {item.deliveryProofImageUrl ? (
                  <Pressable
                    onPress={() => {
                      setPreviewImageUrl(item.deliveryProofImageUrl);
                      setPreviewImageTitle("Delivered Outfit Proof (डिलीवरी प्रमाण) 📦📸");
                      setPreviewImageModalVisible(true);
                    }}
                    style={({ pressed }) => [
                      {
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: "#f0fdf4",
                        borderWidth: 1,
                        borderColor: "#bbf7d0",
                        paddingHorizontal: 8,
                        paddingVertical: 5,
                        borderRadius: 8,
                        gap: 6,
                      },
                      pressed && { opacity: 0.8 }
                    ]}
                  >
                    <Image source={{ uri: item.deliveryProofImageUrl }} style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: "#000" }} />
                    <View>
                      <Text style={{ fontSize: 11, fontWeight: "800", color: "#15803d" }}>Delivery Photo 🔍</Text>
                      <Text style={{ fontSize: 9, color: "#16a34a" }}>Tap to view</Text>
                    </View>
                  </Pressable>
                ) : null}
              </View>
            ) : (!item.isOtpVerified && item.status !== "completed") ? (
              <Pressable
                onPress={() => handleUploadClothProof(item._id)}
                disabled={uploadingClothOrderId === item._id}
                style={({ pressed }) => [
                  {
                    backgroundColor: "#f5f3ff",
                    borderWidth: 1,
                    borderColor: "#ddd6fe",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: 8,
                    gap: 6
                  },
                  pressed && { opacity: 0.85 }
                ]}
              >
                {uploadingClothOrderId === item._id ? (
                  <ActivityIndicator size="small" color="#7c3aed" />
                ) : (
                  <>
                    <Ionicons name="camera" size={13} color="#7c3aed" />
                    <Text style={{ color: "#7c3aed", fontWeight: "700", fontSize: 11 }}>
                      + Add Cloth Photo (कपड़े की फोटो) 📸
                    </Text>
                  </>
                )}
              </Pressable>
            ) : null}
          </View>
        )}

        {/* Contextual OTP & Progress Section */}
        {["cancelled", "declined"].includes(item.status) ? (
          <View style={{ backgroundColor: "#fef2f2", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: "#fecaca" }}>
            <Ionicons name="close-circle" size={14} color="#dc2626" />
            <Text style={{ fontSize: 11, fontWeight: "700", color: "#991b1b" }}>Booking Cancelled ❌ • OTP inactive</Text>
          </View>
        ) : item.status === "pending" ? (
          <View style={{ backgroundColor: isTailorVip ? "#faf5ff" : "#fffbeb", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: isTailorVip ? "#e9d5ff" : "#fef08a" }}>
            <Ionicons name={isTailorVip ? "flash" : "time"} size={14} color={isTailorVip ? "#9333ea" : "#d97706"} />
            <Text style={{ fontSize: 11, fontWeight: "700", color: isTailorVip ? "#7e22ce" : "#b45309", flex: 1 }}>
              {isTailorVip ? "👑 VIP Order — Direct confirmation soon" : "⏳ Pending tailor confirmation"}
            </Text>
          </View>
        ) : item.status === "completed" ? (
          <View style={{ backgroundColor: "#f0fdf4", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: "#bbf7d0" }}>
            <Ionicons name="checkmark-done-circle" size={15} color="#16a34a" />
            <Text style={{ fontSize: 11, fontWeight: "700", color: "#166534", flex: 1 }}>
              Order Completed • Handover & Delivery Verified ✅
            </Text>
          </View>
        ) : !item.isOtpVerified ? (
          <View style={{
            backgroundColor: "#fffbeb",
            borderWidth: 1,
            borderColor: "#fde68a",
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 7,
            marginBottom: 8,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between"
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="key" size={15} color="#d97706" />
              <Text style={{ fontSize: 11, fontWeight: "700", color: "#92400e" }}>Cloth Handover OTP:</Text>
              <Text style={{ fontSize: 15, fontWeight: "900", color: "#b45309", letterSpacing: 1.5 }}>
                {item.otp || "----"}
              </Text>
            </View>
            <View style={{ backgroundColor: "#fef08a", paddingHorizontal: 7, paddingVertical: 2.5, borderRadius: 4 }}>
              <Text style={{ fontSize: 9.5, fontWeight: "800", color: "#854d0e" }}>Share with Tailor</Text>
            </View>
          </View>
        ) : (
          <View style={{ marginBottom: 8, gap: 6 }}>
            {/* Handover OTP is Verified */}
            <View style={{ backgroundColor: "#ecfdf5", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: "#a7f3d0" }}>
              <Ionicons name="checkmark-circle" size={14} color="#059669" />
              <Text style={{ fontSize: 11, fontWeight: "700", color: "#065f46" }}>
                Cloth Handover OTP Verified ✅
              </Text>
            </View>

            {/* Waiting for tailor to start stitching */}
            {!(item.isStitchingStarted || item.status === "stitching" || item.deliveryOtp || ["trial", "alteration", "ironing", "quality_check", "packing", "ready", "dispatched", "completed"].includes(item.status)) && (
              <View style={{ backgroundColor: "#fefce8", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: "#fef08a" }}>
                <Ionicons name="hourglass-outline" size={14} color="#b45309" />
                <Text style={{ fontSize: 11, fontWeight: "700", color: "#92400e" }}>
                  Cloth Handed Over • Tailor will start stitching soon 🪡
                </Text>
              </View>
            )}

            {/* Stitching In Progress */}
            {item.status === "stitching" && !item.deliveryOtp && (
              <View style={{ backgroundColor: "#f5f3ff", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: "#ddd6fe" }}>
                <Ionicons name="cut" size={15} color="#7c3aed" />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11.5, fontWeight: "800", color: "#6d28d9" }}>
                    Stitching in Progress 🪡
                  </Text>
                  <Text style={{ fontSize: 10.5, color: "#7c3aed", marginTop: 1 }}>
                    Tailor is stitching your outfit. You will be notified once it is ready!
                  </Text>
                </View>
              </View>
            )}

            {/* Stitching Completed / Ready to Receive */}
            {item.status === "ready" && !item.deliveryOtp && (
              <View style={{ backgroundColor: "#ecfdf5", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: "#a7f3d0" }}>
                <Ionicons name="sparkles" size={16} color="#059669" />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: "800", color: "#065f46" }}>
                    Order Stitching Completed! 🎉
                  </Text>
                  <Text style={{ fontSize: 10.5, color: "#047857", marginTop: 2 }}>
                    Your outfit is ready to receive or pick up. Tailor will provide Delivery OTP upon handover.
                  </Text>
                </View>
              </View>
            )}

            {/* Delivery OTP (When ready for delivery) */}
            {item.deliveryOtp && (
              <View style={{
                backgroundColor: item.isDeliveryOtpVerified ? "#ecfdf5" : "#f0f9ff",
                borderWidth: 1,
                borderColor: item.isDeliveryOtpVerified ? "#a7f3d0" : "#bae6fd",
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 7,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between"
              }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons name={item.isDeliveryOtpVerified ? "checkmark-done-circle" : "cube"} size={15} color={item.isDeliveryOtpVerified ? "#059669" : "#0284c7"} />
                  <Text style={{ fontSize: 11, fontWeight: "700", color: item.isDeliveryOtpVerified ? "#065f46" : "#0369a1" }}>Delivery OTP:</Text>
                  <Text style={{ fontSize: 15, fontWeight: "900", color: item.isDeliveryOtpVerified ? "#047857" : "#0284c7", letterSpacing: 1.5 }}>
                    {item.deliveryOtp}
                  </Text>
                </View>
                <View style={{ backgroundColor: item.isDeliveryOtpVerified ? "#d1fae5" : "#e0f2fe", paddingHorizontal: 7, paddingVertical: 2.5, borderRadius: 4 }}>
                  <Text style={{ fontSize: 9.5, fontWeight: "800", color: item.isDeliveryOtpVerified ? "#047857" : "#0369a1" }}>
                    {item.isDeliveryOtpVerified ? "Delivered ✅" : "Share on Delivery"}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Actions Row */}
        {!item.isOtpVerified && !["cancelled", "completed", "declined"].includes(item.status) ? (
          <Pressable style={[styles.cancelBtn, { backgroundColor: "#fee2e2", paddingVertical: 6, borderRadius: 8, marginTop: 2 }]} onPress={cancelTailorOrder}>
            <Ionicons name="close-circle" size={13} color="#ef4444" style={{ marginRight: 4 }} />
            <Text style={{ color: "#ef4444", fontWeight: "700", fontSize: 11 }}>Cancel Order</Text>
          </Pressable>
        ) : item.isOtpVerified && !["cancelled", "completed", "declined"].includes(item.status) ? (
          <View style={{ backgroundColor: "#f8fafc", paddingVertical: 5, paddingHorizontal: 8, borderRadius: 6, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 2 }}>
            <Ionicons name="lock-closed" size={11} color="#64748b" />
            <Text style={{ color: "#64748b", fontWeight: "700", fontSize: 10 }}>Cancellation Locked (Handover Done 🔒)</Text>
          </View>
        ) : null}

        {/* Rate Tailor */}
        {item.isTailorOrder && item.status === "completed" && (
          <View style={{ marginTop: 4 }}>
            {item.isRated ? (
              <View style={{ backgroundColor: "#f0fdf4", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: "#bbf7d0", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Ionicons name="star" size={14} color="#eab308" style={{ marginRight: 5 }} />
                  <Text style={{ fontSize: 11.5, fontWeight: "800", color: "#166534" }}>Rated: {item.rating}/5 Stars</Text>
                </View>
                <Pressable onPress={() => openTailorRatingModal(item)}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#15803d", textDecorationLine: "underline" }}>Edit Review</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={{ backgroundColor: "#6d28d9", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}
                onPress={() => openTailorRatingModal(item)}
              >
                <Ionicons name="star" size={14} color="#ffffff" />
                <Text style={{ color: "#ffffff", fontWeight: "800", fontSize: 12 }}>⭐️ Rate Your Tailor Experience</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderBarberCard = (item, index) => {
    const statusStyle = getStatusBadge(item.status);
    const customerName = item.customer?.name || item.guestName || "Customer";
    const customerPhone = item.customer?.phone || item.guestPhone || "";

    const customerAddrObj = (typeof item.customer?.address === 'object' && item.customer?.address) || 
                            (typeof item.customerId?.address === 'object' && item.customerId?.address) || {};
    const effectiveCustAddress = item.customerAddress ||
      item.homeServiceAddress ||
      item.customer?.formattedAddress ||
      [customerAddrObj.line1, customerAddrObj.city, customerAddrObj.pincode].filter(Boolean).join(", ") ||
      (customerAddrObj.line1 ? `${customerAddrObj.line1}, ${customerAddrObj.city || ""}`.trim() : "") ||
      (item.notes && item.notes.length > 3 ? item.notes : "") ||
      "";
    const effectiveCustLocation = item.customerLocation || item.homeServiceLocation || (customerAddrObj.lat && customerAddrObj.lng ? { lat: customerAddrObj.lat, lng: customerAddrObj.lng } : null);

    return (
      <View style={styles.card}>
        {/* Header: Customer Avatar + Name + Phone + Status + History */}
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={{ position: "relative" }}>
              <View style={[styles.avatarCircle, { backgroundColor: "#fef08a", borderColor: "#fde047" }]}>
                <Text style={[styles.avatarText, { color: "#854d0e" }]}>{getInitials(customerName)}</Text>
              </View>
              {typeof index === "number" && (
                <View style={[styles.serialTagOverlay, { backgroundColor: "#d97706" }]}>
                  <Text style={styles.serialTagOverlayText}>#{item.queuePosition || (index + 1)}</Text>
                </View>
              )}
            </View>
            <View style={styles.cardHeaderInfo}>
              <Text style={styles.shopName} numberOfLines={1}>{customerName}</Text>
              {customerPhone ? (
                <Pressable onPress={() => Linking.openURL(`tel:${customerPhone}`)} style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
                  <Ionicons name="call" size={11} color="#6d28d9" style={{ marginRight: 3 }} />
                  <Text style={[styles.bookingIdText, { color: "#6d28d9", fontWeight: "700" }]}>{customerPhone}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          <View style={{ alignItems: "flex-end" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 4 }}>
              {typeof index === "number" && (
                <View style={[styles.serialTokenBadge, { backgroundColor: "#fef3c7", borderColor: "#fcd34d" }]}>
                  <Ionicons name="time-outline" size={11} color="#b45309" style={{ marginRight: 3 }} />
                  <Text style={[styles.serialTokenBadgeText, { color: "#b45309" }]}>Queue #{item.queuePosition || (index + 1)}</Text>
                </View>
              )}
              <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
                <Ionicons name={statusStyle.icon} size={11} color={statusStyle.text} style={{ marginRight: 3 }} />
                <Text style={[styles.badgeText, { color: statusStyle.text }]}>{item.status}</Text>
              </View>
            </View>
            {customerPhone ? (
              <Pressable onPress={() => openHistory(customerPhone)}>
                <Text style={{ fontSize: 11, color: "#6d28d9", fontWeight: "700" }}>History 📋</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.cardDivider} />

        {/* Schedule & Chair Row (Compact) */}
        <View style={styles.compactScheduleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.compactScheduleLabel}>
              {item.isHomeService ? "APPOINTMENT" : "CUSTOMER ARRIVAL TIME"}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2, flexWrap: "wrap" }}>
              <Text style={styles.compactScheduleValue}>
                {formatDateLabel(item.arrivalTime || item.startTime)}
              </Text>
              {item.customerETA ? (
                <View style={{ backgroundColor: "#e0f2fe", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                  <Text style={{ fontSize: 10.5, fontWeight: "700", color: "#0369a1" }}>ETA: ~{item.customerETA}m</Text>
                </View>
              ) : null}
              {item.status === 'confirmed' && !item.isHomeService && (
                <LiveCountdown targetDate={item.arrivalTime || item.startTime} />
              )}
              {item.status === 'pending' && !item.isHomeService && (
                <View style={[styles.countdownBadge, { backgroundColor: "#fef3c7", borderColor: "#fde047", borderWidth: 1 }]}>
                  <Text style={[styles.countdownText, { color: "#b45309" }]}>Starts after confirmation</Text>
                </View>
              )}
              {item.isHomeService && item.status === 'confirmed' && item.barberArrivalTime && (
                <LiveCountdown targetDate={item.barberArrivalTime} />
              )}
            </View>
          </View>

          {item.seatLabel ? (
            <View style={styles.compactChairBadge}>
              <Ionicons name="person" size={11} color="#854d0e" style={{ marginRight: 3 }} />
              <Text style={styles.compactChairText}>{item.seatLabel}</Text>
            </View>
          ) : item.isHomeService ? (
            <View style={styles.compactHomeBadge}>
              <Ionicons name="home" size={11} color="#6d28d9" style={{ marginRight: 3 }} />
              <Text style={styles.compactHomeText}>Home Service</Text>
            </View>
          ) : null}
        </View>

        {/* Services & Earnings Strip */}
        {item.services?.length ? (
          <View style={styles.compactSvcContainer}>
            <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 5, alignItems: "center" }}>
              <Text style={styles.compactSvcHeader}>Services:</Text>
              {item.services.map((s, i) => (
                <View key={i} style={styles.compactSvcTag}>
                  <Text style={styles.compactSvcTagText}>{s.name} - ₹{s.price || 0}</Text>
                </View>
              ))}
            </View>
            <View style={{ alignItems: "flex-end", marginLeft: 8 }}>
              <Text style={styles.compactTotalLabel}>Total</Text>
              <Text style={styles.compactTotalValue}>
                ₹{item.services.reduce((sum, s) => sum + (s.price || 0), 0)}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Service Type & Address / Map Navigation */}
        {item.isHomeService ? (
          <View style={{ backgroundColor: "#faf5ff", borderRadius: 10, padding: 8, marginBottom: 8, borderWidth: 1, borderColor: "#e9d5ff" }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: effectiveCustAddress ? 6 : 0 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="home" size={14} color="#7c3aed" style={{ marginRight: 4 }} />
                <Text style={{ fontSize: 11.5, fontWeight: "800", color: "#6d28d9", textTransform: "uppercase" }}>
                  Customer Home Service
                </Text>
              </View>

              {customerPhone ? (
                <Pressable
                  onPress={() => Linking.openURL(`tel:${customerPhone}`)}
                  style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#ede9fe", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 }}
                >
                  <Ionicons name="call" size={11} color="#6d28d9" style={{ marginRight: 3 }} />
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#6d28d9" }}>Call Customer</Text>
                </Pressable>
              ) : null}
            </View>

            {effectiveCustAddress ? (
              <Pressable
                onPress={() => {
                  openMapForNavigation(effectiveCustAddress, effectiveCustLocation, `${customerName}'s Home`);
                }}
                style={({ pressed }) => [
                  styles.shopAddressBar,
                  { marginBottom: 0, marginTop: 4, backgroundColor: "#ffffff" },
                  pressed && { opacity: 0.85 }
                ]}
              >
                <View style={[styles.shopAddressIconCircle, { backgroundColor: "#f3e8ff" }]}>
                  <Ionicons name="location-sharp" size={15} color="#7c3aed" />
                </View>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.shopAddressBarLabel, { color: "#6d28d9" }]}>Customer Address:</Text>
                  <Text style={styles.shopAddressBarValue} numberOfLines={2}>
                    {effectiveCustAddress}
                  </Text>
                </View>
                <View style={[styles.shopAddressMapIconBtn, { backgroundColor: "#7c3aed" }]}>
                  <Ionicons name="navigate" size={12} color="#ffffff" style={{ marginRight: 3 }} />
                  <Text style={styles.shopAddressMapBtnText}>Map 🗺️</Text>
                </View>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={{ backgroundColor: "#f0fdf4", borderRadius: 10, padding: 8, marginBottom: 8, borderWidth: 1, borderColor: "#bbf7d0" }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: effectiveCustAddress ? 6 : 0 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="storefront" size={13} color="#16a34a" style={{ marginRight: 4 }} />
                <Text style={{ fontSize: 11.5, fontWeight: "800", color: "#16a34a", textTransform: "uppercase" }}>Shop Visit Service</Text>
              </View>
              {customerPhone ? (
                <Pressable onPress={() => Linking.openURL(`tel:${customerPhone}`)} style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#dcfce7", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 }}>
                  <Ionicons name="call" size={11} color="#16a34a" style={{ marginRight: 3 }} />
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#16a34a" }}>{customerPhone}</Text>
                </Pressable>
              ) : null}
            </View>

            {effectiveCustAddress ? (
              <View
                style={[
                  styles.shopAddressBar,
                  { marginBottom: 0, marginTop: 4, backgroundColor: "#ffffff", borderColor: "#bbf7d0" }
                ]}
              >
                <View style={[styles.shopAddressIconCircle, { backgroundColor: "#dcfce7" }]}>
                  <Ionicons name="location-sharp" size={15} color="#16a34a" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.shopAddressBarLabel, { color: "#15803d" }]}>Booked From (Customer Area):</Text>
                  <Text style={[styles.shopAddressBarValue, { color: "#1e293b" }]} numberOfLines={2}>
                    {effectiveCustAddress}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        )}

        {/* Barber Actions (Pending, Confirmed, In Progress) */}
        {item.status?.toLowerCase() === "pending" ? (
          <View style={{ marginTop: 6 }}>
            <View style={{
              backgroundColor: "#fffbeb",
              borderWidth: 1,
              borderColor: "#fde68a",
              borderRadius: 10,
              padding: 9,
              marginBottom: 8,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}>
              <Ionicons name="time" size={18} color="#d97706" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: "800", color: "#92400e" }}>
                  Pending Confirmation Request ⏳
                </Text>
                <Text style={{ fontSize: 11, color: "#b45309" }}>
                  Please confirm to accept this booking. Check-in OTP will unlock only after you confirm.
                </Text>
              </View>
            </View>

            <View style={styles.actionGrid}>
              <Pressable style={[styles.actionBtnSolid, { backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fca5a5", flexDirection: "row", alignItems: "center", justifyContent: "center" }]} onPress={() => setStatus(item.id || item._id, "cancelled")}>
                <Ionicons name="close-circle" size={14} color="#ef4444" style={{ marginRight: 4 }} />
                <Text style={[styles.actionBtnTextSolid, { color: "#ef4444" }]}>Decline</Text>
              </Pressable>

              <Pressable style={[styles.actionBtnSolid, { backgroundColor: "#6d28d9", flexDirection: "row", alignItems: "center", justifyContent: "center" }]} onPress={() => setStatus(item.id || item._id, "confirmed", item.arrivalTime || item.startTime, item.isHomeService)}>
                <Ionicons name="checkmark-circle" size={14} color="#ffffff" style={{ marginRight: 4 }} />
                <Text style={[styles.actionBtnTextSolid, { color: "#ffffff" }]}>Confirm Booking ✅</Text>
              </Pressable>
            </View>
          </View>
        ) : (item.status === "confirmed") ? (
          <View style={{ marginTop: 6, flexDirection: "row", gap: 8 }}>
            {item.isWalkIn ? (
              <Pressable
                style={[
                  styles.actionBtnSolid,
                  { backgroundColor: "#6d28d9", flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 44, borderRadius: 10 }
                ]}
                onPress={() => handleStartService(item)}
              >
                <Ionicons name="play" size={16} color="#ffffff" />
                <Text style={[styles.actionBtnTextSolid, { color: "#ffffff", fontWeight: "800" }]}>Start Service ✂️</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[
                  styles.verifyBtn,
                  { flexDirection: "row", justifyContent: "center", paddingVertical: 11, backgroundColor: item.verificationPin ? "#0f172a" : "#6d28d9", flex: 1 },
                  generatingOtpBookingId === (item.id || item._id) && { opacity: 0.7 }
                ]}
                onPress={() => handleTriggerCheckinOtp(item)}
                disabled={generatingOtpBookingId === (item.id || item._id)}
              >
                {generatingOtpBookingId === (item.id || item._id) ? (
                  <ActivityIndicator color="#ffffff" size="small" style={{ marginRight: 6 }} />
                ) : (
                  <Ionicons name="key" size={15} color="#ffffff" style={{ marginRight: 6 }} />
                )}
                <Text style={styles.verifyBtnText}>Enter OTP ✂️</Text>
              </Pressable>
            )}

            <Pressable
              style={{
                backgroundColor: "#fef2f2",
                borderWidth: 1,
                borderColor: "#fca5a5",
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 11,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center"
              }}
              onPress={() => setStatus(item.id || item._id, "cancelled")}
            >
              <Ionicons name="close-circle" size={15} color="#dc2626" style={{ marginRight: 4 }} />
              <Text style={{ color: "#dc2626", fontWeight: "700", fontSize: 13 }}>Cancel</Text>
            </Pressable>
          </View>
        ) : item.status === "in-progress" ? (
          <View style={{ marginTop: 4 }}>
            <Pressable style={[styles.actionBtnSolid, { backgroundColor: "#16a34a" }]} onPress={() => handleStartCompletion(item)}>
              <Text style={[styles.actionBtnTextSolid, { color: "#ffffff" }]}>
                Complete Service 🎉
              </Text>
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

      {viewMode === "Shop Queue" && (
        <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 6, alignItems: "flex-end" }}>
          <Pressable
            style={[styles.walkInBtn, { width: "auto", paddingHorizontal: 14, height: 38, borderRadius: 10, flexDirection: "row", alignItems: "center", gap: 6 }]}
            onPress={openWalkInModal}
          >
            <Ionicons name="person-add" size={16} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>+ Walk-in Client</Text>
          </Pressable>
        </View>
      )}

      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id || item._id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6d28d9" />}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => viewMode === "Shop Queue" ? renderBarberCard(item, index) : item.isTailorOrder ? renderTailorCard(item, index) : renderCustomerCard(item, index)}
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

            <Pressable
              onPress={() => handleResendOtp(activeBookingId)}
              disabled={verifying}
              style={{ marginTop: 6, marginBottom: 16 }}
            >
              <Text style={{ fontSize: 13, color: "#6d28d9", fontWeight: "600", textAlign: "center" }}>
                Didn't receive code? Resend OTP
              </Text>
            </Pressable>

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

      {/* Completion OTP Modal (Verify & Complete Service) */}
      <Modal visible={completionOtpModalVisible} transparent animationType="fade" onRequestClose={() => setCompletionOtpModalVisible(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: "#f3e8ff", justifyContent: "center", alignItems: "center", marginBottom: 12 }}>
              <Ionicons name="checkmark-done-circle" size={32} color="#7c3aed" />
            </View>
            <Text style={styles.modalTitle}>Verify Completion OTP</Text>
            <Text style={styles.modalDesc}>Ask the customer for the 4-digit Completion OTP sent to their phone to verify service is complete.</Text>

            <TextInput
              style={[styles.otpInputBox, { borderColor: "#c084fc", color: "#6d28d9" }]}
              placeholder="0000"
              keyboardType="number-pad"
              maxLength={4}
              value={completionOtpInput}
              onChangeText={setCompletionOtpInput}
              editable={!verifyingCompletionOtp}
            />

            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setCompletionOtpModalVisible(false)} disabled={verifyingCompletionOtp}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalSubmitBtn, { backgroundColor: "#7c3aed" }]} onPress={submitCompletionOtp} disabled={verifyingCompletionOtp}>
                {verifyingCompletionOtp ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalSubmitText}>Verify & Complete</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Walk-in Client Modal */}
      <Modal visible={walkInModalVisible} transparent animationType="slide" onRequestClose={() => setWalkInModalVisible(false)}>
        <View style={styles.walkInModalBg}>
          <View style={styles.walkInModalCard}>
            {/* Modal Header */}
            <View style={styles.walkInHeaderRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                <View style={styles.walkInHeaderIconCircle}>
                  <Text style={{ fontSize: 20 }}>💈</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.walkInModalTitle}>New Walk-In Client</Text>
                  <Text style={styles.walkInModalSub}>Quick in-shop booking & queue entry</Text>
                </View>
              </View>
              <Pressable
                onPress={() => setWalkInModalVisible(false)}
                style={styles.walkInCloseBtn}
                hitSlop={8}
              >
                <Ionicons name="close" size={20} color="#64748b" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {/* Client Info Section */}
              <View style={styles.walkInSectionCard}>
                <Text style={styles.walkInFieldLabel}>1. CUSTOMER NAME</Text>
                
                <View style={styles.walkInInputContainer}>
                  <Ionicons name="person-outline" size={18} color="#6d28d9" style={{ marginRight: 10 }} />
                  <TextInput
                    style={styles.walkInInputField}
                    placeholder="Enter Customer Name (e.g. Rahul)"
                    placeholderTextColor="#94a3b8"
                    value={walkInName}
                    onChangeText={setWalkInName}
                  />
                </View>
              </View>

              {/* Chair Assignment Section (Only Chair 1 / Available Chairs, No Auto) */}
              <View style={[styles.walkInSectionCard, { marginTop: 12 }]}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <Text style={styles.walkInFieldLabel}>ASSIGN TO CHAIR</Text>
                  <Text style={{ fontSize: 11, color: "#64748b", fontWeight: "700" }}>
                    Styling Chair
                  </Text>
                </View>

                {(() => {
                  const displaySeats = shopSeats.length > 0 ? shopSeats : [{ index: 0, label: "Chair 1", isAvailable: true }];
                  const activeChairIndex = walkInChairIndex !== null && walkInChairIndex !== undefined ? walkInChairIndex : 0;
                  const currentSeat = displaySeats.find(s => s.index === activeChairIndex) || displaySeats[0];
                  
                  // Calculate active bookings on this chair from live bookings list
                  const activeChairBookings = items.filter(b => 
                    ["in-progress", "confirmed", "arrived", "pending"].includes((b.status || "").toLowerCase()) &&
                    (b.seatIndex === activeChairIndex || b.seatIndex === null || b.seatIndex === undefined)
                  );
                  const isBusy = activeChairBookings.length > 0;
                  const nextQueueNumber = activeChairBookings.length + 1;

                  // Free time calculation
                  let freeInMins = 0;
                  let freeTimeStr = "";
                  if (isBusy) {
                    if (currentSeat?.nextAvailableAt) {
                      freeInMins = Math.max(1, Math.ceil((new Date(currentSeat.nextAvailableAt).getTime() - Date.now()) / 60000));
                      freeTimeStr = new Date(currentSeat.nextAvailableAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                    } else if (currentSeat?.freeInMinutes) {
                      freeInMins = currentSeat.freeInMinutes;
                    } else {
                      const latestEnd = activeChairBookings.reduce((max, b) => {
                        const t = new Date(b.endTime || b.startTime).getTime();
                        return t > max ? t : max;
                      }, Date.now());
                      freeInMins = Math.max(1, Math.ceil((latestEnd - Date.now()) / 60000));
                      freeTimeStr = new Date(latestEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                    }
                  }

                  return (
                    <View>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                        {displaySeats.map((seat) => {
                          const isChosen = activeChairIndex === seat.index;
                          const seatActiveBookings = items.filter(b => 
                            ["in-progress", "confirmed", "arrived", "pending"].includes((b.status || "").toLowerCase()) &&
                            (b.seatIndex === seat.index || b.seatIndex === null || b.seatIndex === undefined)
                          );
                          const seatIsBusy = seatActiveBookings.length > 0;
                          return (
                            <Pressable
                              key={seat.index}
                              style={[
                                styles.chairSelectChip,
                                isChosen && styles.chairSelectChipActive,
                                !isChosen && seatIsBusy && { borderColor: "#fdba74", backgroundColor: "#fff7ed" }
                              ]}
                              onPress={() => setWalkInChairIndex(seat.index)}
                            >
                              <Text style={{ fontSize: 14 }}>{seatIsBusy ? "⏳" : "💺"}</Text>
                              <Text style={[styles.chairSelectChipText, isChosen && { color: "#fff" }]}>
                                {seat.label || `Chair ${seat.index + 1}`}
                              </Text>
                              {seatIsBusy && (
                                <View style={{ backgroundColor: isChosen ? "rgba(255,255,255,0.25)" : "#ffedd5", paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, marginLeft: 2 }}>
                                  <Text style={{ fontSize: 9.5, fontWeight: "800", color: isChosen ? "#fff" : "#ea580c" }}>Busy</Text>
                                </View>
                              )}
                            </Pressable>
                          );
                        })}
                      </View>

                      {/* Live Chair Status Box */}
                      {isBusy ? (
                        <View style={{ backgroundColor: "#fff7ed", padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: "#fdba74", marginTop: 10 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                              <Ionicons name="time" size={17} color="#ea580c" />
                              <Text style={{ fontSize: 13, fontWeight: "900", color: "#c2410c" }}>
                                {currentSeat?.label || "Chair 1"} Abhi Busy Hai ⏳
                              </Text>
                            </View>
                            <View style={{ backgroundColor: "#fed7aa", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                              <Text style={{ fontSize: 11, fontWeight: "800", color: "#9a3412" }}>Aapka No: Queue #{nextQueueNumber}</Text>
                            </View>
                          </View>
                          <Text style={{ fontSize: 12, color: "#9a3412", lineHeight: 18, marginTop: 3 }}>
                            ⏳ Chair lagbhag <Text style={{ fontWeight: "900", color: "#c2410c" }}>{freeInMins} minute</Text> me khali hogi {freeTimeStr ? `(~${freeTimeStr})` : ""}. Is walk-in client ka number <Text style={{ fontWeight: "900", color: "#c2410c" }}>Queue #{nextQueueNumber}</Text> par aayega.
                          </Text>
                          <Text style={{ fontSize: 11, color: "#ea580c", fontWeight: "700", marginTop: 4 }}>
                            💡 Booking confirm karte hi yeh client queue me add ho jayega aur service turns sequentially book honge.
                          </Text>
                        </View>
                      ) : (
                        <View style={{ backgroundColor: "#f0fdf4", padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: "#86efac", marginTop: 10 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                              <Ionicons name="checkmark-circle" size={17} color="#16a34a" />
                              <Text style={{ fontSize: 13, fontWeight: "900", color: "#15803d" }}>
                                {currentSeat?.label || "Chair 1"} Abhi Khali Hai ✂️
                              </Text>
                            </View>
                            <View style={{ backgroundColor: "#bbf7d0", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                              <Text style={{ fontSize: 11, fontWeight: "800", color: "#166534" }}>Queue #1 (Next Turn)</Text>
                            </View>
                          </View>
                          <Text style={{ fontSize: 12, color: "#166534", marginTop: 3 }}>
                            Chair abhi bilkul khali hai. Booking karte hi client ka service session Queue #1 par start kiya ja sakta hai.
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })()}
              </View>

              {/* Service Selection Section */}
              <View style={[styles.walkInSectionCard, { marginTop: 14 }]}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <Text style={styles.walkInFieldLabel}>2. SELECT SERVICES</Text>
                  {selectedWalkInServices.length > 0 && (
                    <View style={styles.walkInCountBadge}>
                      <Text style={styles.walkInCountBadgeText}>{selectedWalkInServices.length} Selected</Text>
                    </View>
                  )}
                </View>

                {/* Service Search Input */}
                <View style={styles.walkInSearchBox}>
                  <Ionicons name="search" size={16} color="#94a3b8" style={{ marginRight: 8 }} />
                  <TextInput
                    style={{ flex: 1, fontSize: 13, color: "#0f172a", paddingVertical: 6 }}
                    placeholder="Search services by name..."
                    placeholderTextColor="#94a3b8"
                    value={walkInSearch}
                    onChangeText={setWalkInSearch}
                  />
                  {walkInSearch.length > 0 && (
                    <Pressable onPress={() => setWalkInSearch("")} hitSlop={6}>
                      <Ionicons name="close-circle" size={16} color="#94a3b8" />
                    </Pressable>
                  )}
                </View>

                {/* Services List */}
                {loadingShopServices ? (
                  <View style={{ paddingVertical: 30, alignItems: "center" }}>
                    <ActivityIndicator size="small" color="#6d28d9" />
                    <Text style={{ marginTop: 8, fontSize: 13, color: "#64748b" }}>Loading shop services...</Text>
                  </View>
                ) : filteredWalkInServices.length === 0 ? (
                  <View style={{ paddingVertical: 24, alignItems: "center" }}>
                    <Ionicons name="cut-outline" size={36} color="#cbd5e1" />
                    <Text style={{ fontSize: 13, fontWeight: "600", color: "#64748b", marginTop: 6 }}>
                      {shopServices.length === 0 ? "No services registered for this shop." : "No matching services found."}
                    </Text>
                  </View>
                ) : (
                  <View style={{ gap: 8, marginTop: 10 }}>
                    {filteredWalkInServices.map((svc) => {
                      const sid = svc.id || svc._id;
                      const isSelected = selectedWalkInServices.includes(sid);
                      return (
                        <Pressable
                          key={sid}
                          style={[
                            styles.walkInServiceCard,
                            isSelected && styles.walkInServiceCardActive
                          ]}
                          onPress={() => {
                            if (isSelected) {
                              setSelectedWalkInServices(prev => prev.filter(id => id !== sid));
                            } else {
                              setSelectedWalkInServices(prev => [...prev, sid]);
                            }
                          }}
                        >
                          <Ionicons
                            name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                            size={22}
                            color={isSelected ? "#6d28d9" : "#94a3b8"}
                            style={{ marginRight: 10 }}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.walkInServiceName, isSelected && { color: "#5b21b6" }]} numberOfLines={1}>
                              {svc.name}
                            </Text>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 }}>
                              <View style={styles.walkInDurationTag}>
                                <Ionicons name="time-outline" size={11} color="#64748b" style={{ marginRight: 2 }} />
                                <Text style={styles.walkInDurationTagText}>{svc.durationMinutes || 30}m</Text>
                              </View>
                              {svc.category ? (
                                <Text style={{ fontSize: 11, color: "#94a3b8" }}>• {svc.category}</Text>
                              ) : null}
                            </View>
                          </View>
                          <View style={[styles.walkInPriceBadge, isSelected && { backgroundColor: "#ede9fe" }]}>
                            <Text style={[styles.walkInPriceBadgeText, isSelected && { color: "#6d28d9" }]}>
                              ₹{svc.price || 0}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            </ScrollView>

            {/* Bottom Summary & Confirmation Bar */}
            <View style={styles.walkInFooter}>
              {selectedWalkInServices.length > 0 ? (
                <View style={styles.walkInSummaryRow}>
                  <View>
                    <Text style={{ fontSize: 11, fontWeight: "600", color: "#64748b" }}>TOTAL ESTIMATE</Text>
                    <Text style={{ fontSize: 18, fontWeight: "900", color: "#0f172a" }}>₹{walkInTotalPrice}</Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#f3e8ff", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                    <Ionicons name="time" size={13} color="#6d28d9" />
                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#6d28d9" }}>{walkInTotalDuration} mins</Text>
                  </View>
                </View>
              ) : null}

              <View style={styles.walkInActionBtns}>
                <Pressable
                  style={styles.walkInCancelBtn}
                  onPress={() => setWalkInModalVisible(false)}
                  disabled={submittingWalkIn}
                >
                  <Text style={styles.walkInCancelBtnText}>Cancel</Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.walkInConfirmBtn,
                    selectedWalkInServices.length === 0 && { backgroundColor: "#cbd5e1" }
                  ]}
                  onPress={submitWalkIn}
                  disabled={submittingWalkIn || selectedWalkInServices.length === 0}
                >
                  {submittingWalkIn ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Ionicons name="checkmark-done" size={18} color="#fff" />
                      <Text style={styles.walkInConfirmBtnText}>
                        {selectedWalkInServices.length === 0 ? "Select Services" : `Confirm Booking • ₹${walkInTotalPrice}`}
                      </Text>
                    </View>
                  )}
                </Pressable>
              </View>
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

            <View style={{ flexDirection: "row", justifyContent: "center", gap: 10, marginBottom: 20 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable key={star} onPress={() => setRating(star)} style={{ padding: 4 }}>
                  <Ionicons name={rating >= star ? "star" : "star-outline"} size={36} color="#eab308" />
                </Pressable>
              ))}
            </View>

            <TextInput
              style={[styles.otpInputBox, { fontSize: 14, textAlign: "left", letterSpacing: 0, padding: 12, minHeight: 80, marginBottom: 24 }]}
              placeholder="Write a review or feedback (Optional)"
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

      {/* Check-in OTP Modal */}
      <Modal visible={otpModalVisible} transparent animationType="fade" onRequestClose={() => setOtpModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 }}>
          <View style={{ backgroundColor: "#fff", borderRadius: 24, padding: 24, width: "100%", maxWidth: 340, alignItems: "center" }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: "#ede9fe", justifyContent: "center", alignItems: "center", marginBottom: 12 }}>
              <Ionicons name="key" size={28} color="#6d28d9" />
            </View>
            <Text style={{ fontSize: 20, fontWeight: "800", color: "#0f172a", marginBottom: 8 }}>Verify Customer OTP</Text>
            <Text style={{ fontSize: 13.5, color: "#64748b", textAlign: "center", marginBottom: 16, lineHeight: 20 }}>
              Enter the 4-digit PIN shown on the customer's phone to check them in and begin the haircut.
            </Text>

            <TextInput
              style={{ width: "100%", backgroundColor: "#f8fafc", borderWidth: 1.5, borderColor: "#a78bfa", borderRadius: 16, padding: 14, fontSize: 26, fontWeight: "800", textAlign: "center", letterSpacing: 8, color: "#4c1d95", marginBottom: 12 }}
              placeholder="0000"
              keyboardType="number-pad"
              maxLength={4}
              value={otpInput}
              onChangeText={setOtpInput}
              editable={!verifying}
            />

            <Pressable
              onPress={() => handleResendOtp(activeBookingId)}
              disabled={verifying}
              style={{ marginBottom: 18 }}
            >
              <Text style={{ fontSize: 13, color: "#6d28d9", fontWeight: "600", textAlign: "center" }}>
                Didn't receive code? Resend OTP
              </Text>
            </Pressable>

            <View style={{ flexDirection: "row", width: "100%", gap: 12 }}>
              <Pressable style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: "#f1f5f9", alignItems: "center" }} onPress={() => setOtpModalVisible(false)} disabled={verifying}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#64748b" }}>Cancel</Text>
              </Pressable>
              <Pressable style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: "#6d28d9", alignItems: "center" }} onPress={submitOtp} disabled={verifying}>
                {verifying ? <ActivityIndicator color="#fff" /> : <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>Verify & Start</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Completion OTP Modal */}
      <Modal visible={completionOtpModalVisible} transparent animationType="fade" onRequestClose={() => setCompletionOtpModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 }}>
          <View style={{ backgroundColor: "#fff", borderRadius: 24, padding: 24, width: "100%", maxWidth: 340, alignItems: "center" }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: "#f3e8ff", justifyContent: "center", alignItems: "center", marginBottom: 12 }}>
              <Ionicons name="checkmark-done-circle" size={32} color="#7c3aed" />
            </View>
            <Text style={{ fontSize: 20, fontWeight: "800", color: "#0f172a", marginBottom: 8 }}>Verify Completion OTP</Text>
            <Text style={{ fontSize: 13.5, color: "#64748b", textAlign: "center", marginBottom: 20, lineHeight: 20 }}>
              Ask customer for the 4-digit Completion OTP code sent to their phone to verify service is complete.
            </Text>

            <TextInput
              style={{ width: "100%", backgroundColor: "#f8fafc", borderWidth: 1.5, borderColor: "#c084fc", borderRadius: 16, padding: 14, fontSize: 26, fontWeight: "800", textAlign: "center", letterSpacing: 8, color: "#6d28d9", marginBottom: 24 }}
              placeholder="0000"
              keyboardType="number-pad"
              maxLength={4}
              value={completionOtpInput}
              onChangeText={setCompletionOtpInput}
              editable={!verifyingCompletionOtp}
            />

            <View style={{ flexDirection: "row", width: "100%", gap: 12 }}>
              <Pressable style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: "#f1f5f9", alignItems: "center" }} onPress={() => setCompletionOtpModalVisible(false)} disabled={verifyingCompletionOtp}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#64748b" }}>Cancel</Text>
              </Pressable>
              <Pressable style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: "#7c3aed", alignItems: "center" }} onPress={submitCompletionOtp} disabled={verifyingCompletionOtp}>
                {verifyingCompletionOtp ? <ActivityIndicator color="#fff" /> : <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>Verify & Complete</Text>}
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
    marginVertical: 10,
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

  shopLocationCard: {
    backgroundColor: "#f8fafc",
    padding: 14,
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  shopLocationCardConfirmed: {
    backgroundColor: "#f0fdf4",
    borderColor: "#bbf7d0",
  },
  shopLocationCardBeauty: {
    backgroundColor: "#fdf2f8",
    borderColor: "#fbcfe8",
  },
  shopLocationHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  shopLocationIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  shopLocationTag: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  shopLocationName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
    marginTop: 2,
  },
  readyBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#dcfce7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  readyBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#16a34a",
  },
  /* Compact & Modern Styles for Customer & Barber cards */
  compactContactBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
  },
  compactContactIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  compactContactShopTitle: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  compactContactPhoneText: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#0f172a",
  },
  compactCallPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  compactCallPillText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 11,
  },

  compactScheduleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f8fafc",
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  compactScheduleLabel: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#64748b",
    letterSpacing: 0.4,
  },
  compactScheduleValue: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#0f172a",
  },
  compactChairBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef08a",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#fde047",
  },
  compactChairText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#854d0e",
  },
  compactHomeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3e8ff",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#ddd6fe",
  },
  compactHomeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#6d28d9",
  },

  compactSvcContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  compactSvcHeader: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
    marginRight: 4,
  },
  compactSvcTag: {
    backgroundColor: "#f8fafc",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  compactSvcTagText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#334155",
  },
  compactTotalLabel: {
    fontSize: 9.5,
    fontWeight: "600",
    color: "#94a3b8",
    textTransform: "uppercase",
  },
  compactTotalValue: {
    fontSize: 13.5,
    fontWeight: "900",
    color: "#0f172a",
  },

  compactOtpCard: {
    backgroundColor: "#fefce8",
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#fef08a",
  },
  compactOtpHeader: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#92400e",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  compactOtpBadge: {
    backgroundColor: "#fef08a",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  compactOtpBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#854d0e",
  },
  compactOtpPin: {
    fontSize: 19,
    fontWeight: "900",
    color: "#b45309",
    letterSpacing: 3,
  },
  compactOtpHours: {
    fontSize: 10,
    fontWeight: "600",
    color: "#b45309",
  },

  shopAddressBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  shopAddressIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  shopAddressBarLabel: {
    fontSize: 10.5,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  shopAddressBarValue: {
    fontSize: 11.5,
    color: "#1e293b",
    fontWeight: "600",
    lineHeight: 15,
  },
  shopAddressMapIconBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 7,
    shadowColor: "#4f46e5",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  shopAddressMapBtnText: {
    color: "#ffffff",
    fontSize: 10.5,
    fontWeight: "800",
  },
  serialTokenBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e0e7ff",
    borderColor: "#c7d2fe",
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  serialTokenBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#4338ca",
    letterSpacing: 0.3,
  },
  serialTagOverlay: {
    position: "absolute",
    bottom: -3,
    right: -3,
    backgroundColor: "#4f46e5",
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: 1.5,
    borderColor: "#ffffff",
  },
  serialTagOverlayText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "900",
  },
  walkInModalBg: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "flex-end",
  },
  walkInModalCard: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 18,
    paddingHorizontal: 16,
    maxHeight: "88%",
  },
  walkInHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  walkInHeaderIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#f3e8ff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e9d5ff",
  },
  walkInModalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
  },
  walkInModalSub: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 1,
  },
  walkInCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  walkInSectionCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  walkInFieldLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748b",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  walkInInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 12,
    height: 44,
  },
  walkInInputField: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  walkInCountBadge: {
    backgroundColor: "#6d28d9",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  walkInCountBadgeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
  },
  walkInSearchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 10,
    height: 38,
  },
  walkInServiceCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
  },
  walkInServiceCardActive: {
    backgroundColor: "#faf5ff",
    borderColor: "#7c3aed",
  },
  walkInServiceName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  walkInDurationTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  walkInDurationTagText: {
    fontSize: 11,
    color: "#475569",
    fontWeight: "600",
  },
  walkInPriceBadge: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  walkInPriceBadgeText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0f172a",
  },
  walkInFooter: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    backgroundColor: "#ffffff",
  },
  walkInSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  walkInActionBtns: {
    flexDirection: "row",
    gap: 10,
  },
  walkInCancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  walkInCancelBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748b",
  },
  walkInConfirmBtn: {
    flex: 2,
    height: 46,
    borderRadius: 12,
    backgroundColor: "#6d28d9",
    alignItems: "center",
    justifyContent: "center",
  },
  walkInConfirmBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#ffffff",
  },
  chairSelectChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  chairSelectChipActive: {
    backgroundColor: "#6d28d9",
    borderColor: "#6d28d9",
  },
  chairSelectChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
  },
});
