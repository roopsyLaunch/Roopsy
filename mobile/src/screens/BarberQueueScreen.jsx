import React, { useCallback, useState, useEffect } from "react";
import {
  ActivityIndicator, Alert, FlatList, Pressable, RefreshControl,
  StyleSheet, Text, View, Modal, TextInput, ScrollView, Linking
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { getSocket } from "../api/socket";
import { openMapForNavigation } from "../services/locationService";

function formatDateLabel(isoDate) {
  const d = new Date(isoDate);
  return `${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
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

export function BarberQueueScreen() {
  const { barber } = useAuth();
  const [queue, setQueue] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  
  const [walkInModalVisible, setWalkInModalVisible] = useState(false);
  const [walkInName, setWalkInName] = useState("");
  const [walkInPhone, setWalkInPhone] = useState("");
  const [walkInSearch, setWalkInSearch] = useState("");
  const [selectedServices, setSelectedServices] = useState([]);

  const selectedServicesData = services.filter((s) => selectedServices.includes(s.id || s._id));
  const walkInTotalPrice = selectedServicesData.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
  const walkInTotalDuration = selectedServicesData.reduce((sum, s) => sum + (Number(s.durationMinutes) || 0), 0);

  const filteredServices = services.filter((s) => {
    if (!walkInSearch.trim()) return true;
    const q = walkInSearch.trim().toLowerCase();
    return (s.name || "").toLowerCase().includes(q) || (s.category || "").toLowerCase().includes(q);
  });

  const [confirmHomeModalVisible, setConfirmHomeModalVisible] = useState(false);
  const [confirmETA, setConfirmETA] = useState("");
  const [confirmingBookingId, setConfirmingBookingId] = useState(null);

  // Completion OTP state
  const [completionOtpModalVisible, setCompletionOtpModalVisible] = useState(false);
  const [completionOtpInput, setCompletionOtpInput] = useState("");
  const [activeCompletionBookingId, setActiveCompletionBookingId] = useState(null);
  const [verifyingCompletionOtp, setVerifyingCompletionOtp] = useState(false);

  // Check-in OTP state
  const [otpModalVisible, setOtpModalVisible] = useState(false);
  const [otpInput, setOtpInput] = useState("");
  const [activeBookingId, setActiveBookingId] = useState(null);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [generatingOtpBookingId, setGeneratingOtpBookingId] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const [qRes, sRes] = await Promise.all([
        api.get(`/bookings/queue?date=${selectedDate}`),
        api.get("/barbers/me")
      ]);
      setQueue(qRes.data.queue || []);
      setServices((sRes.data.services || []).map((s) => ({ ...s, id: s.id || s._id, _id: s._id || s.id })));
    } catch (e) {
      console.error(e);
    }
  }, [selectedDate]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      (async () => {
        if (queue.length === 0) setLoading(true);
        try { if (isActive) await loadData(); } finally { if (isActive) setLoading(false); }
      })();
      return () => { isActive = false; };
    }, [loadData])
  );

  useEffect(() => {
    const barberId = barber?.id || barber?._id;
    if (!barberId) return;
    const socket = getSocket();
    if (socket) {
      socket.emit("joinBarberRoom", barberId);
      if (barber?.userId) {
        socket.emit("joinUserRoom", barber.userId);
      }

      const handleNewBooking = (data) => {
        loadData();
        Alert.alert(
          "New Booking Request! 🔔",
          `Customer ${data?.customerName || "A client"} has requested an appointment.\n\nPlease Accept or Decline.`
        );
      };

      socket.on("queueUpdated", loadData);
      socket.on("slotsUpdated", loadData);
      socket.on("bookingUpdated", loadData);
      socket.on("newBookingRequest", handleNewBooking);
      socket.on("newBooking", handleNewBooking);

      return () => {
        socket.emit("leaveBarberRoom", barberId);
        socket.off("queueUpdated", loadData);
        socket.off("slotsUpdated", loadData);
        socket.off("bookingUpdated", loadData);
        socket.off("newBookingRequest", handleNewBooking);
        socket.off("newBooking", handleNewBooking);
      };
    }
  }, [barber, loadData]);

  async function onRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  async function setStatus(id, status, startTime = null, isHomeService = false) {
    if (status === "confirmed" && isHomeService) {
      setConfirmingBookingId(id);
      setConfirmETA("");
      setConfirmHomeModalVisible(true);
      return;
    }
    
    if (status === "cancelled") {
      Alert.alert("Decline Booking", "Are you sure you want to decline this booking request?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Decline ❌",
          style: "destructive",
          onPress: async () => {
            try {
              await api.patch(`/bookings/${id}`, { status: "cancelled" });
              Alert.alert("Declined ❌", "Booking request has been declined. Customer has been notified.");
              await loadData();
            } catch (e) {
              Alert.alert("Error", e?.response?.data?.error || e.message);
            }
          }
        }
      ]);
      return;
    }

    if (status === "confirmed") {
      const d = startTime ? new Date(startTime) : null;
      const timeStr = d ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
      Alert.alert("Confirm Booking", `Accept & confirm this booking${timeStr ? ` for arrival at ${timeStr}` : ""}?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm Booking ✅",
          onPress: async () => {
            try {
              await api.patch(`/bookings/${id}`, { status: "confirmed" });
              Alert.alert("Booking Confirmed! ✅", "Appointment is confirmed. Customer has been notified. Enter OTP will unlock upon arrival.");
              await loadData();
            } catch (e) {
              Alert.alert("Error", e?.response?.data?.error || e.message);
            }
          }
        }
      ]);
      return;
    }

    try {
      await api.patch(`/bookings/${id}`, { status });
      await loadData();
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.error || e.message);
    }
  }

  async function handleWalkIn() {
    if (selectedServices.length === 0) return Alert.alert("Error", "Select at least one service");
    try {
      await api.post("/bookings/walk-in", {
        serviceIds: selectedServices,
        customerName: (walkInName || "").trim(),
      });
      setWalkInModalVisible(false);
      setWalkInName("");
      setWalkInPhone("");
      setSelectedServices([]);
      setWalkInSearch("");
      Alert.alert("Chair Booked! 💈", "Walk-in client successfully booked on chair.");
      await loadData();
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.error || e.message);
    }
  }

  const handleStartCompletion = async (item) => {
    const bookingId = item.id || item._id;
    Alert.alert(
      "Complete Service",
      "Are you sure you want to mark this service as completed?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Complete Service",
          style: "default",
          onPress: async () => {
            try {
              await api.patch(`/bookings/${bookingId}`, { status: "completed" });
              await loadData();
              Alert.alert("Completed ✅", "Service marked as completed!");
            } catch (e) {
              const err = e?.response?.data?.error;
              Alert.alert("Error", typeof err === "string" ? err : (err?.message || "Failed to complete service."));
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
    const targetBooking = queue.find(i => (i.id || i._id) === activeCompletionBookingId);
    if (targetBooking && targetBooking.status === "cancelled") {
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
      await loadData();
    } catch (e) {
      const err = e?.response?.data?.error;
      Alert.alert("Verification Failed", typeof err === "string" ? err : "Invalid Completion OTP. Please verify the code and try again.");
    } finally {
      setVerifyingCompletionOtp(false);
    }
  };

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
        "Please confirm this booking request first before generating or verifying the Check-in OTP."
      );
    }
    const hasExistingOtp = Boolean(item.verificationPin || item.hasVerificationPin || item.hasOtp);
    if (hasExistingOtp) {
      promptVerifyOtp(bookingId);
      return;
    }

    try {
      setGeneratingOtpBookingId(bookingId);
      await api.post(`/bookings/${bookingId}/generate-checkin-otp`);
      Alert.alert(
        "OTP Sent to Customer! 🔑",
        `Check-in OTP code has been generated and sent to ${item.customer?.name || item.guestName || "the customer"}. Please ask customer for the 4-digit code.`
      );
      promptVerifyOtp(bookingId);
      await loadData();
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
      setVerifyingOtp(true);
      await api.post(`/bookings/${bookingId}/generate-checkin-otp`);
      Alert.alert("OTP Resent! 🔑", "A new Check-in OTP code has been generated and sent to the customer.");
      await loadData();
    } catch (e) {
      const errMsg = e?.response?.data?.error;
      Alert.alert(
        "Resend Error",
        typeof errMsg === "string" ? errMsg : (errMsg?.message || "Failed to resend OTP.")
      );
    } finally {
      setVerifyingOtp(false);
    }
  };

  const submitCheckinOtp = async () => {
    if (!otpInput || otpInput.trim().length !== 4) {
      Alert.alert("Invalid Input", "Please enter the 4-digit Check-in OTP code.");
      return;
    }
    const targetBooking = queue.find(i => (i.id || i._id) === activeBookingId);
    if (targetBooking && targetBooking.status === "cancelled") {
      setOtpModalVisible(false);
      return Alert.alert("Booking Cancelled", "This booking is cancelled. OTP verification cannot be performed.");
    }
    if (targetBooking && targetBooking.status === "pending") {
      setOtpModalVisible(false);
      return Alert.alert("Booking Pending ⏳", "This booking is awaiting partner confirmation. Please confirm the booking first before entering OTP.");
    }
    setVerifyingOtp(true);
    try {
      await api.post("/bookings/verify-otp", {
        bookingId: activeBookingId,
        otp: otpInput.trim()
      });
      setOtpModalVisible(false);
      setOtpInput("");
      setActiveBookingId(null);
      Alert.alert("Check-in Verified! ✂️", "Customer OTP verified successfully. Haircut service is now in progress!");
      await loadData();
    } catch (e) {
      const err = e?.response?.data?.error;
      Alert.alert("Verification Error", typeof err === "string" ? err : "Failed to verify customer OTP. Please check the code and try again.");
    } finally {
      setVerifyingOtp(false);
    }
  };

  const toggleService = (serviceOrId) => {
    const id = typeof serviceOrId === "object" ? (serviceOrId.id || serviceOrId._id) : serviceOrId;
    if (!id) return;
    setSelectedServices(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case "in-progress": return <View style={[styles.statusBadge, {backgroundColor:"#dcfce7"}]}><Text style={{color:"#15803d", fontSize:11, fontWeight:"700"}}>In Progress</Text></View>;
      case "arrived": return <View style={[styles.statusBadge, {backgroundColor:"#e0f2fe"}]}><Text style={{color:"#0369a1", fontSize:11, fontWeight:"700"}}>Arrived</Text></View>;
      case "confirmed": return <View style={[styles.statusBadge, {backgroundColor:"#fef08a"}]}><Text style={{color:"#ca8a04", fontSize:11, fontWeight:"700"}}>Confirmed</Text></View>;
      case "pending": return <View style={[styles.statusBadge, {backgroundColor:"#ffedd5"}]}><Text style={{color:"#c2410c", fontSize:11, fontWeight:"700"}}>Pending</Text></View>;
      case "cancelled": return <View style={[styles.statusBadge, {backgroundColor:"#fee2e2"}]}><Text style={{color:"#ef4444", fontSize:11, fontWeight:"700"}}>Cancelled</Text></View>;
      default: return null;
    }
  };

  const renderItem = ({ item }) => {
    const isWalkIn = item.isWalkIn;
    const name = item.customer?.name || item.guestName || "Customer";
    const customerAddrObj = (typeof item.customer?.address === 'object' && item.customer?.address) || 
                            (typeof item.customerId?.address === 'object' && item.customerId?.address) || {};
    const custAddress = item.customerAddress ||
      item.homeServiceAddress ||
      item.customer?.formattedAddress ||
      [customerAddrObj.line1, customerAddrObj.city, customerAddrObj.pincode].filter(Boolean).join(", ") ||
      (customerAddrObj.line1 ? `${customerAddrObj.line1}, ${customerAddrObj.city || ""}`.trim() : "") ||
      (item.notes && item.notes.length > 3 ? item.notes : "") ||
      "";
    const custLocation = item.customerLocation || item.homeServiceLocation || (customerAddrObj.lat && customerAddrObj.lng ? { lat: customerAddrObj.lat, lng: customerAddrObj.lng } : null);
    
    return (
      <View style={[styles.card, item.status === 'in-progress' && styles.cardActive]}>
        <View style={styles.cardHeader}>
           <View style={{flexDirection:"row", alignItems:"center"}}>
             <View style={[styles.avatarCircle, item.status === 'in-progress' && {backgroundColor:"#10b981"}]}>
               <Text style={[styles.avatarText, item.status === 'in-progress' && {color:"#fff"}]}>{name.charAt(0).toUpperCase()}</Text>
             </View>
             <View style={{marginLeft: 12, flex: 1}}>
               <Text style={styles.customerName}>{name} {isWalkIn && <Text style={{color:"#64748b", fontSize:12, fontWeight:"normal"}}>(Walk-In)</Text>}</Text>
               <Text style={styles.serviceText}>{item.services?.map(s => s.name).join(", ")} ({item.expectedDuration}m) - ₹{item.services?.reduce((sum, s) => sum + (s.price || 0), 0) || 0}</Text>
               {item.isHomeService ? (
                 <View style={{ marginTop: 6, backgroundColor: "#f3e8ff", padding: 8, borderRadius: 8, borderWidth: 1, borderColor: "#e9d5ff" }}>
                   <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
                     <Ionicons name="home" size={12} color="#6d28d9" style={{ marginRight: 4 }} />
                     <Text style={{ fontSize: 12, fontWeight: "700", color: "#6d28d9" }}>Home Service Request</Text>
                   </View>
                   {item.status !== "completed" && custAddress ? (
                     <Pressable
                       onPress={() => openMapForNavigation(custAddress, custLocation, `${name}'s Home`)}
                       style={({ pressed }) => [
                         { backgroundColor: "#ffffff", padding: 8, borderRadius: 8, borderWidth: 1, borderColor: "#d8b4fe", marginTop: 4 },
                         pressed && { opacity: 0.8 }
                       ]}
                     >
                       <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                         <Text style={{ fontSize: 10, color: "#7c3aed", fontWeight: "800", textTransform: "uppercase" }}>Address (Tap for Map)</Text>
                         <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#7c3aed", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                           <Ionicons name="navigate" size={10} color="#ffffff" style={{ marginRight: 3 }} />
                           <Text style={{ fontSize: 10, color: "#ffffff", fontWeight: "700" }}>Navigate</Text>
                         </View>
                       </View>
                       <Text style={{ fontSize: 11, color: "#3b0764", fontWeight: "600" }}>
                         {custAddress}
                       </Text>
                     </Pressable>
                   ) : (
                     <View style={{ backgroundColor: "#ffffff", padding: 8, borderRadius: 8, borderWidth: 1, borderColor: "#e2e8f0", marginTop: 4 }}>
                       <Text style={{ fontSize: 10, color: "#64748b", fontWeight: "800", textTransform: "uppercase", marginBottom: 2 }}>Service Address</Text>
                       <Text style={{ fontSize: 11, color: "#334155", fontWeight: "500" }}>
                         {custAddress || "—"}
                       </Text>
                     </View>
                   )}
                   {item.customer?.phone && (
                     <Pressable style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }} onPress={() => Linking.openURL(`tel:${item.customer.phone}`)}>
                       <Ionicons name="call" size={12} color="#6d28d9" style={{ marginRight: 4 }} />
                       <Text style={{ fontSize: 11, color: "#6d28d9", textDecorationLine: 'underline', fontWeight: 'bold' }}>{item.customer.phone}</Text>
                     </Pressable>
                   )}
                 </View>
               ) : (
                  <View style={{ marginTop: 6 }}>
                    <View style={{ backgroundColor: "#f0fdf4", paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: "#bbf7d0", flexDirection: "row", alignItems: "center", alignSelf: "flex-start" }}>
                      <Ionicons name="storefront" size={12} color="#16a34a" style={{ marginRight: 4 }} />
                      <Text style={{ fontSize: 12, fontWeight: "700", color: "#16a34a" }}>Shop Service</Text>
                    </View>
                    {custAddress ? (
                      <View style={{ backgroundColor: "#ffffff", padding: 7, borderRadius: 8, borderWidth: 1, borderColor: "#bbf7d0", marginTop: 4 }}>
                        <Text style={{ fontSize: 10, color: "#15803d", fontWeight: "800", textTransform: "uppercase", marginBottom: 2 }}>📍 Booked From (Customer Area):</Text>
                        <Text style={{ fontSize: 11, color: "#1e293b", fontWeight: "600" }} numberOfLines={2}>
                          {custAddress}
                        </Text>
                      </View>
                    ) : null}
                  </View>
               )}
             </View>
           </View>
           <View style={{alignItems:"flex-end", maxWidth: 100}}>
             {getStatusBadge(item.status)}
             <Text style={styles.timeText}>{formatDateLabel(item.arrivalTime || item.startTime)}</Text>
             {!item.isHomeService && item.status === 'confirmed' && (
               <LiveCountdown targetDate={item.arrivalTime || item.startTime} />
             )}
             {!item.isHomeService && item.status === 'pending' && (
               <View style={[styles.countdownBadge, { backgroundColor: "#fef3c7" }]}>
                 <Text style={[styles.countdownText, { color: "#b45309" }]}>Pending</Text>
               </View>
             )}
             {item.isHomeService && item.status === 'confirmed' && item.barberArrivalTime && (
               <LiveCountdown targetDate={item.barberArrivalTime} />
             )}
             {item.queuePosition > 0 && <Text style={styles.queuePos}>Queue #{item.queuePosition}</Text>}
             {item.delayMinutes > 0 && <Text style={styles.delayText}>Delayed {item.delayMinutes}m</Text>}
           </View>
        </View>

        <View style={styles.actionRow}>
          {item.status === 'pending' && (
            <View style={{ flexDirection: "row", gap: 8, flex: 1 }}>
              <Pressable style={[styles.btn, { backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fca5a5", flex: 1 }]} onPress={() => setStatus(item.id, "cancelled")}>
                <Text style={[styles.btnText, { color: "#dc2626" }]}>Decline ❌</Text>
              </Pressable>
              <Pressable style={[styles.btn, { backgroundColor: "#6d28d9", flex: 2 }]} onPress={() => setStatus(item.id, "confirmed", item.arrivalTime || item.startTime, item.isHomeService)}>
                <Text style={styles.btnText}>Confirm Booking ✅</Text>
              </Pressable>
            </View>
          )}
          {item.status === 'confirmed' && (
            <View style={{ flexDirection: "row", gap: 6 }}>
              {item.isWalkIn ? (
                <Pressable
                  style={[styles.btn, { backgroundColor: "#6d28d9", flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 }]}
                  onPress={() => setStatus(item.id, "in-progress")}
                >
                  <Ionicons name="play" size={14} color="#fff" />
                  <Text style={styles.btnText}>Start Service ✂️</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={[
                    styles.btn,
                    { 
                      backgroundColor: (item.verificationPin || item.hasVerificationPin || item.hasOtp) ? "#0f172a" : "#7c3aed", 
                      flex: 1, 
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
                      <Ionicons name="key" size={14} color="#fff" />
                      <Text style={styles.btnText}>Enter OTP ✂️</Text>
                    </>
                  )}
                </Pressable>
              )}
              <Pressable style={[styles.btn, {backgroundColor:"#ef4444", paddingHorizontal: 12}]} onPress={() => setStatus(item.id, "cancelled")}>
                <Text style={styles.btnText}>Cancel</Text>
              </Pressable>
            </View>
          )}
          {item.status === 'arrived' && (
            <View style={{ flexDirection: "row", gap: 6 }}>
              <Pressable
                style={[
                  styles.btn,
                  { backgroundColor: (item.verificationPin || item.hasVerificationPin || item.hasOtp) ? "#0f172a" : "#7c3aed", flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
                  generatingOtpBookingId === (item.id || item._id) && { opacity: 0.7 }
                ]}
                onPress={() => handleTriggerCheckinOtp(item)}
                disabled={generatingOtpBookingId === (item.id || item._id)}
              >
                {generatingOtpBookingId === (item.id || item._id) ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="key" size={14} color="#fff" />
                    <Text style={styles.btnText}>Enter OTP ✂️</Text>
                  </>
                )}
              </Pressable>
              <Pressable style={[styles.btn, {backgroundColor:"#ef4444", paddingHorizontal: 12}]} onPress={() => setStatus(item.id, "cancelled")}>
                <Text style={styles.btnText}>Cancel</Text>
              </Pressable>
            </View>
          )}
          {item.status === 'in-progress' && (
            <Pressable style={[styles.btn, {backgroundColor:"#16a34a"}]} onPress={() => handleStartCompletion(item)}>
              <Text style={styles.btnText}>Complete Service ✂️</Text>
            </Pressable>
          )}
          {(item.status === 'confirmed' || item.status === 'arrived' || item.status === 'pending') && (
            <Pressable style={[styles.btn, {backgroundColor:"#ef4444"}]} onPress={() => setStatus(item.id, "no-show")}>
              <Text style={styles.btnText}>No-Show</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator color="#6d28d9" size="large" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Live Queue</Text>
        <Pressable style={styles.walkInBtn} onPress={() => setWalkInModalVisible(true)}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.walkInBtnText}>Walk-In</Text>
        </Pressable>
      </View>

      <View style={styles.datePickerContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateScroll}>
          {[...Array(30)].map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() + i);
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            const isSelected = selectedDate === dateStr;
            const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
            return (
              <Pressable
                key={dateStr}
                style={[styles.dateBubble, isSelected && styles.dateBubbleActive]}
                onPress={() => setSelectedDate(dateStr)}
              >
                <Text style={[styles.dateDayText, isSelected && styles.dateTextActive]}>{dayName}</Text>
                <Text style={[styles.dateNumText, isSelected && styles.dateTextActive]}>{d.getDate()}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={queue}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.listContent}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={60} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>Queue is empty</Text>
          </View>
        }
      />

      <Modal visible={walkInModalVisible} animationType="slide" transparent onRequestClose={() => setWalkInModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "90%", padding: 20 }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#ede9fe", justifyContent: "center", alignItems: "center" }}>
                  <Text style={{ fontSize: 20 }}>💈</Text>
                </View>
                <View>
                  <Text style={styles.modalTitle}>New Walk-In Customer</Text>
                  <Text style={{ fontSize: 12, color: "#64748b" }}>Select customer service and add to queue</Text>
                </View>
              </View>
              <Pressable onPress={() => setWalkInModalVisible(false)} hitSlop={8}>
                <Ionicons name="close-circle" size={26} color="#cbd5e1" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ backgroundColor: "#f8fafc", padding: 14, borderRadius: 14, borderWidth: 1, borderColor: "#e2e8f0", marginBottom: 14 }}>
                <Text style={{ fontSize: 11, fontWeight: "800", color: "#64748b", marginBottom: 8 }}>1. CUSTOMER NAME</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: "#fff", marginBottom: 0 }]}
                  placeholder="Enter Customer Name (e.g. Ramesh)"
                  value={walkInName}
                  onChangeText={setWalkInName}
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <View style={{ backgroundColor: "#f8fafc", padding: 14, borderRadius: 14, borderWidth: 1, borderColor: "#e2e8f0" }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <Text style={{ fontSize: 11, fontWeight: "800", color: "#64748b" }}>2. SELECT SERVICES</Text>
                  {selectedServices.length > 0 && (
                    <View style={{ backgroundColor: "#6d28d9", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                      <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>{selectedServices.length} Selected</Text>
                    </View>
                  )}
                </View>

                {/* Search */}
                <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, paddingHorizontal: 10, marginBottom: 10 }}>
                  <Ionicons name="search" size={16} color="#94a3b8" style={{ marginRight: 6 }} />
                  <TextInput
                    style={{ flex: 1, height: 38, fontSize: 13, color: "#0f172a" }}
                    placeholder="Search services..."
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

                <View style={{ gap: 8 }}>
                  {filteredServices.length === 0 ? (
                    <Text style={{ textAlign: "center", color: "#94a3b8", paddingVertical: 14, fontSize: 13 }}>
                      No services found.
                    </Text>
                  ) : (
                    filteredServices.map(s => {
                      const sid = s.id || s._id;
                      const isSelected = selectedServices.includes(sid);
                      return (
                        <Pressable
                          key={sid}
                          style={[
                            styles.serviceRow,
                            isSelected && styles.serviceRowActive,
                            { paddingVertical: 10, paddingHorizontal: 12, alignItems: "center" }
                          ]}
                          onPress={() => toggleService(sid)}
                        >
                          <Ionicons
                            name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                            size={20}
                            color={isSelected ? "#fff" : "#94a3b8"}
                            style={{ marginRight: 8 }}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.serviceRowText, isSelected && { color: "#fff", fontWeight: "700" }]}>
                              {s.name}
                            </Text>
                            <Text style={[{ fontSize: 11, color: "#64748b" }, isSelected && { color: "#ddd6fe" }]}>
                              ⏱️ {s.durationMinutes || 30}m {s.category ? `• ${s.category}` : ""}
                            </Text>
                          </View>
                          <Text style={[styles.serviceRowText, { fontWeight: "800" }, isSelected && { color: "#fff" }]}>
                            ₹{s.price || 0}
                          </Text>
                        </Pressable>
                      );
                    })
                  )}
                </View>
              </View>
            </ScrollView>

            {/* Live Pricing Summary */}
            <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#f1f5f9" }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, backgroundColor: "#f8fafc", padding: 10, borderRadius: 10 }}>
                <View>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#64748b" }}>TOTAL ESTIMATE</Text>
                  <Text style={{ fontSize: 12, color: "#475569" }}>
                    {selectedServices.length} services • ~{walkInTotalDuration} mins
                  </Text>
                </View>
                <Text style={{ fontSize: 18, fontWeight: "900", color: "#6d28d9" }}>
                  ₹{walkInTotalPrice}
                </Text>
              </View>

              <View style={styles.modalActions}>
                <Pressable style={styles.cancelBtn} onPress={() => setWalkInModalVisible(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.submitBtn, selectedServices.length === 0 && { backgroundColor: "#cbd5e1" }]}
                  onPress={handleWalkIn}
                  disabled={selectedServices.length === 0}
                >
                  <Text style={styles.submitBtnText}>Add to Queue</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={confirmHomeModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirm Home Service</Text>
            <Text style={styles.subTitle}>ETA to Customer (Minutes)</Text>
            <TextInput 
              style={styles.input} 
              placeholder="e.g. 15" 
              value={confirmETA} 
              onChangeText={setConfirmETA} 
              keyboardType="number-pad" 
            />
            
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setConfirmHomeModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.submitBtn} onPress={async () => {
                if (!confirmETA) return Alert.alert("Error", "Please enter ETA in minutes");
                try {
                  await api.patch(`/bookings/${confirmingBookingId}`, { status: "confirmed", barberETA: parseInt(confirmETA, 10) });
                  setConfirmHomeModalVisible(false);
                  await loadData();
                } catch (e) {
                  Alert.alert("Error", e?.response?.data?.error || e.message);
                }
              }}>
                <Text style={styles.submitBtnText}>Confirm Booking</Text>
              </Pressable>
            </View>
          </View>
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
            <Text style={{ fontSize: 14, color: "#64748b", textAlign: "center", marginBottom: 16, lineHeight: 20 }}>
              Enter the 4-digit PIN shown on the customer's app to start the haircut service.
            </Text>

            <TextInput
              style={{ width: "100%", backgroundColor: "#f8fafc", borderWidth: 1.5, borderColor: "#a78bfa", borderRadius: 16, padding: 16, fontSize: 26, fontWeight: "800", textAlign: "center", letterSpacing: 8, color: "#4c1d95", marginBottom: 12 }}
              placeholder="0000"
              keyboardType="number-pad"
              maxLength={4}
              value={otpInput}
              onChangeText={setOtpInput}
              editable={!verifyingOtp}
            />

            <Pressable
              onPress={() => handleResendOtp(activeBookingId)}
              disabled={verifyingOtp}
              style={{ marginBottom: 18 }}
            >
              <Text style={{ fontSize: 13, color: "#6d28d9", fontWeight: "600", textAlign: "center" }}>
                Didn't receive code? Resend OTP
              </Text>
            </Pressable>

            <View style={{ flexDirection: "row", width: "100%", gap: 12 }}>
              <Pressable style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: "#f1f5f9", alignItems: "center" }} onPress={() => setOtpModalVisible(false)} disabled={verifyingOtp}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#64748b" }}>Cancel</Text>
              </Pressable>
              <Pressable style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: "#6d28d9", alignItems: "center" }} onPress={submitCheckinOtp} disabled={verifyingOtp}>
                {verifyingOtp ? <ActivityIndicator color="#fff" /> : <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>Verify & Start</Text>}
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
            <Text style={{ fontSize: 14, color: "#64748b", textAlign: "center", marginBottom: 20, lineHeight: 20 }}>
              Ask the customer for the 4-digit Completion OTP code sent to their phone to verify service is complete.
            </Text>

            <TextInput
              style={{ width: "100%", backgroundColor: "#f8fafc", borderWidth: 1.5, borderColor: "#c084fc", borderRadius: 16, padding: 16, fontSize: 26, fontWeight: "800", textAlign: "center", letterSpacing: 8, color: "#6d28d9", marginBottom: 24 }}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  title: { fontSize: 20, fontWeight: "bold", color: "#0f172a" },
  walkInBtn: { flexDirection: "row", backgroundColor: "#6d28d9", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, alignItems: "center" },
  walkInBtnText: { color: "#fff", fontWeight: "600", marginLeft: 4 },
  datePickerContainer: { backgroundColor: "#fff", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  dateScroll: { paddingHorizontal: 16, gap: 12 },
  dateBubble: { width: 52, height: 60, borderRadius: 16, backgroundColor: "#f1f5f9", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#e2e8f0" },
  dateBubbleActive: { backgroundColor: "#6d28d9", borderColor: "#6d28d9" },
  dateDayText: { fontSize: 11, color: "#64748b", fontWeight: "600", marginBottom: 2 },
  dateNumText: { fontSize: 16, color: "#0f172a", fontWeight: "bold" },
  dateTextActive: { color: "#fff" },
  listContent: { padding: 16, paddingBottom: 100 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#e2e8f0" },
  cardActive: { borderColor: "#10b981", borderWidth: 2, backgroundColor: "#f0fdf4" },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  avatarCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#f1f5f9", justifyContent: "center", alignItems: "center" },
  avatarText: { fontSize: 16, fontWeight: "700", color: "#475569" },
  customerName: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  serviceText: { fontSize: 13, color: "#64748b", marginTop: 2 },
  timeText: { fontSize: 13, fontWeight: "600", color: "#334155", marginTop: 4 },
  queuePos: { fontSize: 12, fontWeight: "700", color: "#ea580c", marginTop: 2 },
  delayText: { fontSize: 12, fontWeight: "700", color: "#ef4444", marginTop: 2 },
  etaBadge: { backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fca5a5", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4 },
  etaBadgeText: { fontSize: 11, fontWeight: "700", color: "#dc2626" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  countdownBadge: { backgroundColor: "#f3e8ff", borderWidth: 1, borderColor: "#d8b4fe", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginTop: 6, alignItems: "center" },
  countdownText: { fontSize: 12, fontWeight: "700", color: "#7e22ce" },
  actionRow: { flexDirection: "row", marginTop: 16, gap: 8 },
  btn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  emptyContainer: { alignItems: "center", paddingVertical: 60 },
  emptyTitle: { fontSize: 16, color: "#94a3b8", marginTop: 12 },
  
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "80%" },
  modalTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 16, color: "#0f172a" },
  subTitle: { fontSize: 16, fontWeight: "600", marginTop: 16, marginBottom: 8, color: "#334155" },
  input: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, padding: 12, marginBottom: 12 },
  serviceList: { maxHeight: 200 },
  serviceRow: { flexDirection: "row", justifyContent: "space-between", padding: 12, borderRadius: 8, backgroundColor: "#f1f5f9", marginBottom: 8 },
  serviceRowActive: { backgroundColor: "#6d28d9" },
  serviceRowText: { fontSize: 14, fontWeight: "500", color: "#334155" },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 20 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: "#f1f5f9", alignItems: "center" },
  cancelBtnText: { color: "#475569", fontWeight: "600" },
  submitBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: "#6d28d9", alignItems: "center" },
  submitBtnText: { color: "#fff", fontWeight: "600" }
});
