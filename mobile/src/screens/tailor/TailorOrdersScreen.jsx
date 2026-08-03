import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, RefreshControl, Alert, Modal, TextInput, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../api/client";
import { getSocket } from "../../api/socket";

export function TailorOrdersScreen() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  const loadOrders = useCallback(async () => {
    try {
      const res = await api.get("/tailors/me/orders");
      setOrders(res.data.orders || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    loadOrders().finally(() => setLoading(false));

    const socket = getSocket();
    const handleNewOrder = () => {
      Alert.alert("New Tailor Booking ✂️", "A customer has placed a new booking request!");
      loadOrders();
    };
    const handleOrderUpdated = () => {
      loadOrders();
    };

    socket.on("tailorNewOrder", handleNewOrder);
    socket.on("bookingUpdated", handleOrderUpdated);

    return () => {
      socket.off("tailorNewOrder", handleNewOrder);
      socket.off("bookingUpdated", handleOrderUpdated);
    };
  }, [loadOrders]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  };

  // Delivery OTP Verification state
  const [deliveryOtpModalVisible, setDeliveryOtpModalVisible] = useState(false);
  const [deliveryOtpInput, setDeliveryOtpInput] = useState("");
  const [deliveryOrderId, setDeliveryOrderId] = useState(null);
  const [generatingDeliveryOtp, setGeneratingDeliveryOtp] = useState(false);
  const [verifyingDeliveryOtp, setVerifyingDeliveryOtp] = useState(false);

  const handleOpenDeliveryOtpModal = (orderId) => {
    setDeliveryOrderId(orderId);
    setDeliveryOtpInput("");
    setDeliveryOtpModalVisible(true);
  };

  const handleGenerateDeliveryOtp = async (orderId) => {
    setGeneratingDeliveryOtp(true);
    try {
      const res = await api.post(`/tailors/orders/${orderId}/generate-delivery-otp`);
      setDeliveryOrderId(orderId);
      setDeliveryOtpInput("");
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
    setVerifyingDeliveryOtp(true);
    try {
      const res = await api.post(`/tailors/orders/${deliveryOrderId}/verify-delivery-otp`, { otp: deliveryOtpInput });
      setDeliveryOtpModalVisible(false);
      setDeliveryOtpInput("");
      setDeliveryOrderId(null);
      await loadOrders();
      Alert.alert("Order Completed! 🎉", res.data?.message || "Delivery OTP verified & order marked completed!");
    } catch (err) {
      console.error(err);
      Alert.alert("Verification Error", err?.response?.data?.error || "Invalid Delivery OTP code.");
    } finally {
      setVerifyingDeliveryOtp(false);
    }
  };

  const handleOpenAcceptModal = (order) => {
    setSelectedOrder(order);
    setEstDays(String(order.estimatedDays || 3));
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

    setSubmittingAccept(true);
    try {
      const deliveryDate = new Date();
      deliveryDate.setDate(deliveryDate.getDate() + daysNum);

      await api.patch(`/tailors/orders/${selectedOrder._id}/status`, {
        status: "accepted",
        estimatedDays: daysNum,
        deliveryDate: deliveryDate.toISOString(),
        ...(selectedOrder.isHomeService ? { visitFee: feeNum } : {})
      });

      setAcceptModalVisible(false);
      setSelectedOrder(null);
      await loadOrders();
      Alert.alert("Order Accepted", `Order accepted! Completion set for ${daysNum} days.`);
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Could not accept order.");
    } finally {
      setSubmittingAccept(false);
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

  const [filterTab, setFilterTab] = useState("all"); // "all", "pending", "active", "completed"

  const filteredOrders = orders.filter(o => {
    if (filterTab === "pending") return o.status === "pending";
    if (filterTab === "active") return ["accepted", "stitching", "ready", "measuring", "trial"].includes(o.status);
    if (filterTab === "completed") return o.status === "completed" || o.status === "cancelled" || o.status === "declined";
    return true;
  });

  const renderItem = ({ item }) => {
    const isHome = item.isHomeService;
    const expDate = item.deliveryDate ? new Date(item.deliveryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : null;

    return (
      <View style={styles.card}>
        {/* Pending Request Alert Banner */}
        {item.status === "pending" && (
          <View style={{ backgroundColor: "#fef3c7", padding: 10, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: "#fde68a", flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="notifications" size={18} color="#d97706" style={{ marginRight: 8 }} />
            <Text style={{ fontSize: 13, fontWeight: "800", color: "#b45309", flex: 1 }}>
              NEW BOOKING REQUEST — Action Required
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
          <View style={[styles.modeBadge, { backgroundColor: isHome ? "#ede9fe" : "#e0f2fe" }]}>
            <Ionicons name={isHome ? "home" : "storefront"} size={14} color={isHome ? "#6d28d9" : "#0369a1"} />
            <Text style={[styles.modeBadgeText, { color: isHome ? "#6d28d9" : "#0369a1" }]}>
              {isHome ? "🏡 Home Service (Doorstep Visit)" : "🏪 Shop Service (Visit Shop)"}
            </Text>
          </View>

          {item.estimatedDays ? (
            <View style={styles.timelineBadge}>
              <Ionicons name="time-outline" size={14} color="#059669" />
              <Text style={styles.timelineBadgeText}>
                {item.estimatedDays} Days{expDate ? ` (${expDate})` : ""}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Initial OTP Verification Badge */}
        {item.status !== "pending" && (
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
          <View style={{ backgroundColor: item.isDeliveryOtpVerified ? "#ecfdf5" : item.deliveryOtp ? "#e0f2fe" : "#f0fdf4", padding: 12, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: item.isDeliveryOtpVerified ? "#a7f3d0" : item.deliveryOtp ? "#bae6fd" : "#bbf7d0", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
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
        )}

        <View style={styles.servicesBox}>
          {item.services.map((s, i) => (
            <Text key={i} style={styles.serviceText}>• {s.name} (x{s.quantity})</Text>
          ))}
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.totalPrice}>₹{item.totalAmount}</Text>
          <View style={styles.actions}>
            {item.status === "pending" && (
              <>
                <Pressable style={[styles.btn, styles.declineBtn]} onPress={() => updateStatus(item._id, "declined")}>
                  <Text style={styles.declineText}>Decline</Text>
                </Pressable>
                <Pressable style={[styles.btn, styles.acceptBtn]} onPress={() => handleOpenAcceptModal(item)}>
                  <Text style={styles.acceptText}>Confirm Booking ✅</Text>
                </Pressable>
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

  if (loading && orders.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6d28d9" />
      </View>
    );
  }

  const calcTargetDate = (d) => {
    const num = parseInt(d, 10);
    if (isNaN(num) || num <= 0) return "";
    const dt = new Date();
    dt.setDate(dt.getDate() + num);
    return dt.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  };

  const pendingCount = orders.filter(o => o.status === "pending").length;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Filter Tabs */}
      <View style={{ paddingTop: 8, paddingBottom: 8 }}>
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
            <Text style={styles.emptyText}>No orders found for selected filter.</Text>
          </View>
        }
      />

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

            <Text style={{ fontSize: 14, color: "#475569", marginBottom: 16 }}>
              Ask customer for the 4-digit Delivery OTP to confirm receipt & complete order:
            </Text>

            <TextInput
              style={{ backgroundColor: "#f8fafc", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 24, fontWeight: "900", color: "#0284c7", letterSpacing: 8, textAlign: "center", borderWidth: 1, borderColor: "#bae6fd", marginBottom: 20 }}
              placeholder="0000"
              placeholderTextColor="#94a3b8"
              keyboardType="numeric"
              maxLength={4}
              value={deliveryOtpInput}
              onChangeText={setDeliveryOtpInput}
              editable={!verifyingDeliveryOtp}
            />

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setDeliveryOtpModalVisible(false)} disabled={verifyingDeliveryOtp}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.confirmBtn, { backgroundColor: "#0284c7" }]} onPress={handleVerifyDeliveryOtp} disabled={verifyingDeliveryOtp}>
                {verifyingDeliveryOtp ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmBtnText}>Verify & Complete ✅</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
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
  
  empty: { padding: 40, alignItems: "center" },
  emptyText: { marginTop: 12, fontSize: 15, color: "#64748b", fontWeight: "500" },

  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.6)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#0f172a" },
  modalSub: { fontSize: 14, color: "#475569", marginBottom: 16 },
  modalPrompt: { fontSize: 15, fontWeight: "700", color: "#6d28d9", marginBottom: 16 },

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
