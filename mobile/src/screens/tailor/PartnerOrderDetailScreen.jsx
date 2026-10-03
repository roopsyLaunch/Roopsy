import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  ActivityIndicator, Alert, TextInput, Modal, Image
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../api/client";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { openMapForNavigation } from "../../services/locationService";
import { pickOrCaptureImage } from "../../services/imagePickerService";
import { uploadImageAsync } from "../../api/upload";

const STAGE_COLORS = {
  pending: "#f59e0b", accepted: "#3b82f6", declined: "#ef4444", cancelled: "#ef4444",
  measurement_pending: "#8b5cf6", fabric_pending: "#f97316", pattern_making: "#a855f7",
  cutting: "#ec4899", stitching: "#6d28d9", embroidery: "#be185d", trial: "#d97706",
  alteration: "#7c3aed", ironing: "#0ea5e9", quality_check: "#0d9488",
  packing: "#059669", ready: "#16a34a", dispatched: "#0f172a", completed: "#15803d",
};

const STAGE_LABELS = {
  pending: "Pending", accepted: "Accepted", declined: "Declined", cancelled: "Cancelled",
  measurement_pending: "Measurement", fabric_pending: "Fabric Pending", pattern_making: "Pattern Making",
  cutting: "Cutting", stitching: "Stitching", embroidery: "Embroidery", trial: "Trial",
  alteration: "Alteration", ironing: "Ironing", quality_check: "Quality Check",
  packing: "Packing", ready: "Ready", dispatched: "Dispatched", completed: "Completed",
};

const Section = ({ title, children, icon }) => (
  <View style={sectionStyles.container}>
    <View style={sectionStyles.header}>
      {icon && <Ionicons name={icon} size={18} color="#6d28d9" style={{ marginRight: 8 }} />}
      <Text style={sectionStyles.title}>{title}</Text>
    </View>
    {children}
  </View>
);

const sectionStyles = StyleSheet.create({
  container: { backgroundColor: "#ffffff", borderRadius: 18, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: "#e2e8f0" },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 14, borderBottomWidth: 1, borderBottomColor: "#f1f5f9", paddingBottom: 12 },
  title: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
});

const InfoRow = ({ label, value, valueColor }) => (
  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
    <Text style={{ fontSize: 13, color: "#64748b", fontWeight: "600" }}>{label}</Text>
    <Text style={{ fontSize: 14, color: valueColor || "#0f172a", fontWeight: "700", flexShrink: 1, textAlign: "right", marginLeft: 12 }}>{value || "—"}</Text>
  </View>
);

export function PartnerOrderDetailScreen({ route, navigation }) {
  const { orderId } = route.params;
  const insets = useSafeAreaInsets();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [noteModal, setNoteModal] = useState(false);
  const [internalNote, setInternalNote] = useState("");
  const [saving, setSaving] = useState(false);

  const loadOrder = useCallback(async () => {
    try {
      const res = await api.get(`/tailors/orders/${orderId}`);
      setOrder(res.data.order);
      setInternalNote(res.data.order?.internalNotes || "");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useFocusEffect(useCallback(() => { loadOrder(); }, [loadOrder]));

  const saveInternalNote = async () => {
    setSaving(true);
    try {
      await api.patch(`/tailors/orders/${orderId}/status`, { internalNotes: internalNote });
      setNoteModal(false);
      await loadOrder();
    } catch (err) {
      Alert.alert("Error", "Could not save note.");
    } finally {
      setSaving(false);
    }
  };

  const setPriority = async (priority) => {
    try {
      await api.patch(`/tailors/orders/${orderId}/status`, { priority });
      await loadOrder();
    } catch (err) {
      Alert.alert("Error", "Could not update priority.");
    }
  };

  const [otpInput, setOtpInput] = useState("");
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  const [deliveryOtpInput, setDeliveryOtpInput] = useState("");
  const [generatingDeliveryOtp, setGeneratingDeliveryOtp] = useState(false);
  const [verifyingDeliveryOtp, setVerifyingDeliveryOtp] = useState(false);
  const [deliveryProofUri, setDeliveryProofUri] = useState(null);
  const [uploadingDeliveryProof, setUploadingDeliveryProof] = useState(false);
  const [uploadingClothProof, setUploadingClothProof] = useState(false);

  // Full-screen image preview state
  const [previewImageModalVisible, setPreviewImageModalVisible] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState("");
  const [previewImageTitle, setPreviewImageTitle] = useState("");

  const handleCaptureClothProof = async () => {
    try {
      const uri = await pickOrCaptureImage({
        title: "Cloth Handover Photo 📸",
        message: "Click or choose photo of the cloth received from customer:"
      });
      if (!uri) return;

      setUploadingClothProof(true);
      const uploadedUrl = await uploadImageAsync(uri);
      if (!uploadedUrl) return Alert.alert("Error", "Could not upload image");

      await api.patch(`/tailors/orders/${orderId}/cloth-proof`, {
        clothProofImageUrl: uploadedUrl
      });
      await loadOrder();
      Alert.alert("Photo Saved! 📸", "Cloth handover photo has been recorded.");
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Could not save cloth photo.");
    } finally {
      setUploadingClothProof(false);
    }
  };

  const handleCaptureDeliveryProof = async () => {
    try {
      const uri = await pickOrCaptureImage({
        title: "Finished Outfit Delivery Photo 📸",
        message: "Click or choose photo of the finished delivered outfit (कपड़ा डिलीवरी प्रमाण):"
      });
      if (!uri) return;

      setUploadingDeliveryProof(true);
      const uploadedUrl = await uploadImageAsync(uri);
      if (!uploadedUrl) {
        Alert.alert("Error", "Could not upload delivery photo");
        return;
      }

      await api.patch(`/tailors/orders/${orderId}/delivery-proof`, {
        deliveryProofImageUrl: uploadedUrl
      });
      setDeliveryProofUri(null);
      await loadOrder();
      Alert.alert("Photo Saved! 📦📸", "Cloth delivery proof photo has been successfully saved & confirmed!");
    } catch (err) {
      console.error(err);
      Alert.alert("Error", err?.response?.data?.error || "Could not save delivery photo.");
    } finally {
      setUploadingDeliveryProof(false);
    }
  };

  const handlePickDeliveryPhoto = async () => {
    const uri = await pickOrCaptureImage({
      title: "Finished Outfit Delivery Photo 📸",
      message: "Click photo of the finished delivered outfit (डिलीवरी प्रमाण):"
    });
    if (uri) {
      setDeliveryProofUri(uri);
    }
  };

  const handleVerifyOtp = async () => {
    if (order?.status === "cancelled" || order?.status === "declined") {
      return Alert.alert("Order Cancelled", "This order is cancelled. OTP verification cannot be performed.");
    }
    if (!otpInput || otpInput.trim().length !== 4) {
      return Alert.alert("Required", "Please enter the 4-digit OTP code.");
    }
    setVerifyingOtp(true);
    try {
      const res = await api.post(`/tailors/orders/${orderId}/verify-otp`, { otp: otpInput });
      setOtpInput("");
      await loadOrder();
      Alert.alert("Verified! ✅", res.data?.message || "Customer OTP verified successfully!");
    } catch (err) {
      console.error(err);
      Alert.alert("Verification Failed", err?.response?.data?.error || "Invalid OTP code.");
    } finally {
      setVerifyingOtp(false);
    }
  };

  const [startingStitching, setStartingStitching] = useState(false);

  const handleStartStitching = async () => {
    if (order?.status === "cancelled" || order?.status === "declined") {
      return Alert.alert("Order Cancelled", "Cannot start stitching on a cancelled order.");
    }
    if (!order?.isOtpVerified) {
      return Alert.alert("Handover Required 🔒", "Please verify customer cloth handover OTP first before starting stitching.");
    }
    setStartingStitching(true);
    try {
      const res = await api.post(`/tailors/orders/${orderId}/start-stitching`);
      await loadOrder();
      Alert.alert("Stitching Started! 🪡", res.data?.message || "Order moved to Stitching in Progress. Customer has been notified!");
    } catch (err) {
      console.error(err);
      Alert.alert("Error", err?.response?.data?.error || "Could not start stitching.");
    } finally {
      setStartingStitching(false);
    }
  };

  const handleGenerateDeliveryOtp = async () => {
    if (order?.status === "cancelled" || order?.status === "declined") {
      return Alert.alert("Order Cancelled", "Cannot generate delivery OTP for a cancelled order.");
    }
    setGeneratingDeliveryOtp(true);
    try {
      const res = await api.post(`/tailors/orders/${orderId}/generate-delivery-otp`);
      await loadOrder();
      Alert.alert("Delivery OTP Generated 📦", "Customer has received 4-digit Delivery OTP. Please enter and verify it when delivering the outfit.");
    } catch (err) {
      console.error(err);
      Alert.alert("Error", err?.response?.data?.error || "Could not generate Delivery OTP.");
    } finally {
      setGeneratingDeliveryOtp(false);
    }
  };

  const handleVerifyDeliveryOtp = async () => {
    if (order?.status === "cancelled" || order?.status === "declined") {
      return Alert.alert("Order Cancelled", "This order is cancelled. Delivery OTP verification cannot be performed.");
    }
    if (!deliveryOtpInput || deliveryOtpInput.trim().length !== 4) {
      return Alert.alert("Required", "Please enter the 4-digit Delivery OTP code.");
    }
    setVerifyingDeliveryOtp(true);
    try {
      let finalDeliveryPhotoUrl = order?.deliveryProofImageUrl || "";
      if (deliveryProofUri) {
        setUploadingDeliveryProof(true);
        finalDeliveryPhotoUrl = await uploadImageAsync(deliveryProofUri);
      }

      const res = await api.post(`/tailors/orders/${orderId}/verify-delivery-otp`, {
        otp: deliveryOtpInput,
        deliveryProofImageUrl: finalDeliveryPhotoUrl
      });
      setDeliveryOtpInput("");
      setDeliveryProofUri(null);
      await loadOrder();
      Alert.alert("Order Completed! 🎉", res.data?.message || "Delivery OTP verified & order marked completed!");
    } catch (err) {
      console.error(err);
      Alert.alert("Verification Failed", err?.response?.data?.error || "Invalid Delivery OTP code.");
    } finally {
      setVerifyingDeliveryOtp(false);
      setUploadingDeliveryProof(false);
    }
  };

  const cancelOrderByTailor = async () => {
    Alert.alert(
      "Decline / Cancel Order",
      "Are you sure you want to cancel this order?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel Order",
          style: "destructive",
          onPress: async () => {
            try {
              await api.patch(`/tailors/orders/${orderId}/status`, {
                status: "declined",
                cancellationReason: "Cancelled by Tailor Partner"
              });
              Alert.alert("Order Cancelled", "The order has been cancelled.");
              await loadOrder();
            } catch (e) {
              Alert.alert("Error", e?.response?.data?.error || "Failed to cancel order");
            }
          }
        }
      ]
    );
  };

  if (loading || !order) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6d28d9" />
      </View>
    );
  }

  const stageColor = STAGE_COLORS[order.status] || "#64748b";
  const stageLabel = STAGE_LABELS[order.status] || order.status;
  const grandTotal = order.totalAmount + (order.visitFee || 0);
  const isExpired = !order.isHomeService && order.otpExpiresAt && new Date() > new Date(order.otpExpiresAt);
  const expTimeStr = order.otpExpiresAt ? new Date(order.otpExpiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#0f172a" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.orderId}>#{orderId.slice(-6).toUpperCase()}</Text>
          <View style={[styles.stagePill, { backgroundColor: stageColor + "20" }]}>
            <View style={[styles.stageDot, { backgroundColor: stageColor }]} />
            <Text style={[styles.stageText, { color: stageColor }]}>{stageLabel}</Text>
          </View>
        </View>
        {order.status !== "completed" && (
          <Pressable style={styles.noteBtn} onPress={() => setNoteModal(true)}>
            <Ionicons name="create-outline" size={22} color="#6d28d9" />
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Priority Selector */}
        {order.status !== "completed" && (
          <View style={styles.priorityRow}>
            <Text style={styles.priorityLabel}>Priority:</Text>
            {["normal", "urgent", "rush"].map(p => (
              <Pressable
                key={p}
                style={[styles.priorityPill, order.priority === p && styles.priorityPillActive]}
                onPress={() => setPriority(p)}
              >
                <Text style={[styles.priorityText, order.priority === p && styles.priorityTextActive]}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Cancellation Action / Lock Banner for Tailor Partner */}
        {!order.isOtpVerified && !["cancelled", "completed", "declined"].includes(order.status) ? (
          <Pressable
            style={{ backgroundColor: "#fee2e2", padding: 12, borderRadius: 14, alignItems: "center", marginBottom: 14, borderWidth: 1, borderColor: "#fca5a5", flexDirection: "row", justifyContent: "center" }}
            onPress={cancelOrderByTailor}
          >
            <Ionicons name="close-circle" size={18} color="#dc2626" style={{ marginRight: 6 }} />
            <Text style={{ color: "#dc2626", fontWeight: "800", fontSize: 13 }}>Cancel / Decline Order</Text>
          </Pressable>
        ) : order.isOtpVerified && !["cancelled", "completed", "declined"].includes(order.status) ? (
          <View style={{ backgroundColor: "#f1f5f9", padding: 10, borderRadius: 14, alignItems: "center", marginBottom: 14, borderWidth: 1, borderColor: "#cbd5e1", flexDirection: "row", justifyContent: "center" }}>
            <Ionicons name="lock-closed" size={16} color="#64748b" style={{ marginRight: 6 }} />
            <Text style={{ color: "#64748b", fontWeight: "700", fontSize: 12 }}>Cancellation Locked (OTP Verified 🔒)</Text>
          </View>
        ) : null}

        {/* Quick Photo Proof Bar for Tailor */}
        {(order.clothProofImageUrl || order.deliveryProofImageUrl) && (
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
            {order.clothProofImageUrl ? (
              <Pressable
                onPress={() => {
                  setPreviewImageUrl(order.clothProofImageUrl);
                  setPreviewImageTitle("Cloth Handover Photo (कपड़े की फोटो) 📸");
                  setPreviewImageModalVisible(true);
                }}
                style={{ flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#f5f3ff", padding: 10, borderRadius: 12, borderWidth: 1, borderColor: "#ddd6fe", gap: 8 }}
              >
                <Image source={{ uri: order.clothProofImageUrl }} style={{ width: 36, height: 36, borderRadius: 6 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, fontWeight: "800", color: "#6d28d9" }}>Cloth Photo 📸</Text>
                  <Text style={{ fontSize: 9.5, color: "#7c3aed", fontWeight: "600" }}>Tap to view full 🔍</Text>
                </View>
              </Pressable>
            ) : null}
            {order.deliveryProofImageUrl ? (
              <Pressable
                onPress={() => {
                  setPreviewImageUrl(order.deliveryProofImageUrl);
                  setPreviewImageTitle("Delivered Outfit Proof (डिलीवरी प्रमाण फोटो) 📦📸");
                  setPreviewImageModalVisible(true);
                }}
                style={{ flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#f0fdf4", padding: 10, borderRadius: 12, borderWidth: 1, borderColor: "#bbf7d0", gap: 8 }}
              >
                <Image source={{ uri: order.deliveryProofImageUrl }} style={{ width: 36, height: 36, borderRadius: 6 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, fontWeight: "800", color: "#15803d" }}>Delivery Photo 📦</Text>
                  <Text style={{ fontSize: 9.5, color: "#16a34a", fontWeight: "600" }}>Tap to view full 🔍</Text>
                </View>
              </Pressable>
            ) : null}
          </View>
        )}

        {/* Initial OTP Verification Box - ONLY show if not cancelled/declined */}
        {!["cancelled", "declined"].includes(order.status) ? (
          <Section title="Initial Booking OTP Verification" icon="shield-checkmark">
            <View style={{ backgroundColor: order.isOtpVerified ? "#ecfdf5" : isExpired ? "#fef2f2" : "#fffbeb", padding: 14, borderRadius: 14, borderWidth: 1, borderColor: order.isOtpVerified ? "#a7f3d0" : isExpired ? "#fca5a5" : "#fef08a" }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: order.isOtpVerified ? 0 : 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Ionicons name={order.isOtpVerified ? "checkmark-circle" : isExpired ? "alert-circle" : "key"} size={22} color={order.isOtpVerified ? "#059669" : isExpired ? "#dc2626" : "#d97706"} style={{ marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: "800", color: order.isOtpVerified ? "#047857" : isExpired ? "#991b1b" : "#b45309" }}>
                      {order.isOtpVerified ? "INITIAL OTP VERIFIED ✅" : isExpired ? "OTP EXPIRED (4 HOURS EXCEEDED) ⚠️" : "ENTER CUSTOMER INITIAL OTP"}
                    </Text>
                    <Text style={{ fontSize: 12, color: isExpired ? "#dc2626" : "#64748b", marginTop: 2 }}>
                      {order.isOtpVerified
                        ? `Verified on ${new Date(order.otpVerifiedAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                        : isExpired
                          ? "Shop service OTP expired 4 hours after confirmation."
                          : !order.isHomeService && expTimeStr
                            ? `Shop service OTP valid for 4 hours (Expires at ${expTimeStr})`
                            : "Customer will provide 4-digit code on arrival"}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Cloth Handover Photo Section */}
              {order.clothProofImageUrl ? (
                <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: order.isOtpVerified ? "#a7f3d0" : "#fef08a" }}>
                  <Pressable
                    onPress={() => {
                      setPreviewImageUrl(order.clothProofImageUrl);
                      setPreviewImageTitle("Cloth Handover Photo (कपड़े की फोटो) 📸");
                      setPreviewImageModalVisible(true);
                    }}
                    style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: "800", color: "#6d28d9" }}>
                      CLOTH HANDOVER PHOTO (कपड़े की फोटो) 📸 🔍
                    </Text>
                    <View style={{ backgroundColor: "#ede9fe", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                      <Text style={{ fontSize: 9, fontWeight: "800", color: "#6d28d9" }}>Uploaded by {order.clothProofUploadedBy || "Customer"}</Text>
                    </View>
                  </Pressable>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Pressable
                      onPress={() => {
                        setPreviewImageUrl(order.clothProofImageUrl);
                        setPreviewImageTitle("Cloth Handover Photo (कपड़े की फोटो)");
                        setPreviewImageModalVisible(true);
                      }}
                      style={{ width: 56, height: 56, borderRadius: 8, overflow: "hidden", borderWidth: 1.5, borderColor: "#c4b5fd", marginRight: 10, backgroundColor: "#000" }}
                    >
                      <Image source={{ uri: order.clothProofImageUrl }} style={{ width: "100%", height: "100%", resizeMode: "cover" }} />
                    </Pressable>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, color: "#475569" }}>Photo of cloth handed over by customer.</Text>
                      <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                        <Pressable
                          onPress={() => {
                            setPreviewImageUrl(order.clothProofImageUrl);
                            setPreviewImageTitle("Cloth Handover Photo (कपड़े की फोटो)");
                            setPreviewImageModalVisible(true);
                          }}
                          style={{ backgroundColor: "#7c3aed", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}
                        >
                          <Text style={{ fontSize: 10, fontWeight: "700", color: "#fff" }}>View Full Photo 🔍</Text>
                        </Pressable>
                        {order.status !== "completed" && (
                          <Pressable
                            onPress={handleCaptureClothProof}
                            disabled={uploadingClothProof}
                            style={{ backgroundColor: "#f3e8ff", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: "#d8b4fe" }}
                          >
                            {uploadingClothProof ? <ActivityIndicator size="small" color="#7c3aed" /> : <Text style={{ fontSize: 10, fontWeight: "700", color: "#7c3aed" }}>Retake 📷</Text>}
                          </Pressable>
                        )}
                      </View>
                    </View>
                  </View>
                </View>
              ) : order.status !== "completed" ? (
                <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: order.isOtpVerified ? "#a7f3d0" : "#fef08a" }}>
                  <Pressable
                    onPress={handleCaptureClothProof}
                    disabled={uploadingClothProof}
                    style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#f5f3ff", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: "#ddd6fe" }}
                  >
                    {uploadingClothProof ? (
                      <ActivityIndicator size="small" color="#7c3aed" />
                    ) : (
                      <>
                        <Ionicons name="camera" size={16} color="#7c3aed" style={{ marginRight: 6 }} />
                        <Text style={{ fontSize: 11, fontWeight: "800", color: "#7c3aed" }}>
                          Click / Attach Cloth Photo (कपड़े की फोटो) 📸
                        </Text>
                      </>
                    )}
                  </Pressable>
                </View>
              ) : null}

              {!order.isOtpVerified && (
                <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                  <TextInput
                    style={{ flex: 1, backgroundColor: "#ffffff", borderRadius: 10, borderWidth: 1, borderColor: isExpired ? "#fca5a5" : "#cbd5e1", fontSize: 18, fontWeight: "800", textAlign: "center", paddingVertical: 8, letterSpacing: 4 }}
                    placeholder="0000"
                    keyboardType="number-pad"
                    maxLength={4}
                    value={otpInput}
                    onChangeText={setOtpInput}
                  />
                  <Pressable
                    style={{ backgroundColor: isExpired ? "#94a3b8" : "#6d28d9", paddingHorizontal: 16, borderRadius: 10, justifyContent: "center", alignItems: "center" }}
                    onPress={handleVerifyOtp}
                    disabled={verifyingOtp}
                  >
                    {verifyingOtp ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#ffffff", fontWeight: "800", fontSize: 14 }}>Verify</Text>}
                  </Pressable>
                </View>
              )}
            </View>
          </Section>
        ) : (
          <View style={{ backgroundColor: "#fee2e2", padding: 14, borderRadius: 14, marginBottom: 14, borderWidth: 1, borderColor: "#fca5a5", flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="close-circle" size={22} color="#dc2626" style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: "800", color: "#991b1b" }}>
                ORDER CANCELLED / DECLINED ❌
              </Text>
              <Text style={{ fontSize: 12, color: "#b91c1c", marginTop: 2 }}>
                This order has been {order.status}. OTP verification is disabled.
              </Text>
            </View>
          </View>
        )}

        {/* Step 2: Start Stitching Section (Enabled only after Handover OTP verified) */}
        {order.isOtpVerified && !["cancelled", "declined", "completed"].includes(order.status) && !(order.isStitchingStarted || order.status === "stitching" || ["trial", "alteration", "ironing", "quality_check", "packing", "ready", "dispatched", "completed"].includes(order.status)) && (
          <Section title="Step 2: Production & Stitching" icon="cut">
            <View style={{ backgroundColor: "#f5f3ff", padding: 14, borderRadius: 14, borderWidth: 1.5, borderColor: "#ddd6fe" }}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
                <Ionicons name="cut" size={24} color="#7c3aed" style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: "800", color: "#6d28d9" }}>
                    START STITCHING (सिलाई शुरू करें) 🪡
                  </Text>
                  <Text style={{ fontSize: 12, color: "#7c3aed", marginTop: 2 }}>
                    Cloth handover is verified. Tap below when you begin cutting / stitching.
                  </Text>
                </View>
              </View>

              <Pressable
                style={{ backgroundColor: "#7c3aed", paddingVertical: 12, borderRadius: 10, alignItems: "center", justifyContent: "center" }}
                onPress={handleStartStitching}
                disabled={startingStitching}
              >
                {startingStitching ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: "#ffffff", fontWeight: "800", fontSize: 14 }}>
                    🪡 Start Stitching Now
                  </Text>
                )}
              </Pressable>

              <View style={{ backgroundColor: "#ede9fe", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginTop: 10, flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="lock-closed" size={13} color="#6d28d9" />
                <Text style={{ fontSize: 11, color: "#6d28d9", fontWeight: "700" }}>
                  Delivery OTP will unlock after stitching has started
                </Text>
              </View>
            </View>
          </Section>
        )}

        {/* Cloth Delivery & Proof Section */}
        {order.isOtpVerified && (order.isStitchingStarted || order.status === "stitching" || ["trial", "alteration", "ironing", "quality_check", "packing", "ready", "dispatched", "completed"].includes(order.status)) && !["cancelled", "declined"].includes(order.status) && (
          <Section title="Cloth Delivery & Verification Proof" icon="cube">
            <View style={{ backgroundColor: order.isDeliveryOtpVerified ? "#ecfdf5" : order.deliveryOtp ? "#e0f2fe" : "#f0fdf4", padding: 14, borderRadius: 14, borderWidth: 1, borderColor: order.isDeliveryOtpVerified ? "#a7f3d0" : order.deliveryOtp ? "#bae6fd" : "#bbf7d0" }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                  <Ionicons name={order.isDeliveryOtpVerified ? "checkmark-done-circle" : "cube-outline"} size={22} color={order.isDeliveryOtpVerified ? "#059669" : order.deliveryOtp ? "#0284c7" : "#16a34a"} style={{ marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: "800", color: order.isDeliveryOtpVerified ? "#047857" : order.deliveryOtp ? "#0369a1" : "#15803d" }}>
                      {order.isDeliveryOtpVerified ? "DELIVERY COMPLETED & VERIFIED ✅" : order.deliveryOtp ? "DELIVERY OTP SENT TO CUSTOMER 📦" : "READY FOR CLOTH DELIVERY 📦"}
                    </Text>
                    <Text style={{ fontSize: 12, color: order.deliveryOtp ? "#0284c7" : "#166534", marginTop: 2 }}>
                      {order.isDeliveryOtpVerified
                        ? `Delivered on ${new Date(order.deliveryOtpVerifiedAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                        : order.deliveryOtp
                          ? "Upload delivery proof photo & enter customer 4-digit Delivery OTP"
                          : "Upload delivery proof photo & tap below to generate Delivery OTP"}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Delivery Proof Photo Capture for Tailor */}
              <View style={{ marginTop: 4, paddingTop: 10, borderTopWidth: 1, borderTopColor: order.isDeliveryOtpVerified ? "#a7f3d0" : "#bae6fd" }}>
                <Pressable
                  disabled={!order.deliveryProofImageUrl}
                  onPress={() => {
                    setPreviewImageUrl(order.deliveryProofImageUrl);
                    setPreviewImageTitle("Cloth Delivery Proof Photo 📦📸");
                    setPreviewImageModalVisible(true);
                  }}
                  style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}
                >
                  <Text style={{ fontSize: 11, fontWeight: "800", color: order.deliveryProofImageUrl ? "#047857" : "#0369a1" }}>
                    📸 CLOTH DELIVERY PHOTO (कपड़ा डिलीवरी फोटो प्रमाण) {order.deliveryProofImageUrl ? "🔍" : ""}
                  </Text>
                  {order.deliveryProofImageUrl ? (
                    <View style={{ backgroundColor: "#d1fae5", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4 }}>
                      <Text style={{ fontSize: 9, fontWeight: "800", color: "#047857" }}>Proof Saved ✅</Text>
                    </View>
                  ) : null}
                </Pressable>

                {order.deliveryProofImageUrl ? (
                  <View style={{ backgroundColor: "#f0fdf4", padding: 10, borderRadius: 10, borderWidth: 1, borderColor: "#bbf7d0", marginBottom: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Pressable
                        onPress={() => {
                          setPreviewImageUrl(order.deliveryProofImageUrl);
                          setPreviewImageTitle("Cloth Delivery Proof Photo");
                          setPreviewImageModalVisible(true);
                        }}
                        style={{ width: 60, height: 60, borderRadius: 8, overflow: "hidden", borderWidth: 1.5, borderColor: "#059669", marginRight: 10, backgroundColor: "#000" }}
                      >
                        <Image source={{ uri: order.deliveryProofImageUrl }} style={{ width: "100%", height: "100%", resizeMode: "cover" }} />
                      </Pressable>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, fontWeight: "700", color: "#065f46" }}>
                          Cloth Delivery Photo Recorded ✅
                        </Text>
                        <Text style={{ fontSize: 10, color: "#166534", marginTop: 2 }}>
                          {order.deliveryProofUploadedAt
                            ? `Recorded on ${new Date(order.deliveryProofUploadedAt).toLocaleDateString()} at ${new Date(order.deliveryProofUploadedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                            : "Recorded as proof of delivery"}
                        </Text>
                        <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                          <Pressable
                            onPress={() => {
                              setPreviewImageUrl(order.deliveryProofImageUrl);
                              setPreviewImageTitle("Cloth Delivery Proof Photo");
                              setPreviewImageModalVisible(true);
                            }}
                            style={{ backgroundColor: "#059669", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}
                          >
                            <Text style={{ fontSize: 10, fontWeight: "700", color: "#fff" }}>View Full Photo 🔍</Text>
                          </Pressable>
                          {!order.isDeliveryOtpVerified && order.status !== "completed" && (
                            <Pressable
                              onPress={handleCaptureDeliveryProof}
                              disabled={uploadingDeliveryProof}
                              style={{ backgroundColor: "#e0f2fe", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: "#bae6fd" }}
                            >
                              <Text style={{ fontSize: 10, fontWeight: "700", color: "#0369a1" }}>Change / Retake 📷</Text>
                            </Pressable>
                          )}
                        </View>
                      </View>
                    </View>
                  </View>
                ) : deliveryProofUri ? (
                  <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#e0f2fe", padding: 10, borderRadius: 10, borderWidth: 1, borderColor: "#bae6fd", marginBottom: 8 }}>
                    <Image source={{ uri: deliveryProofUri }} style={{ width: 56, height: 56, borderRadius: 8, marginRight: 10 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, color: "#0369a1", fontWeight: "700" }}>New Photo Selected</Text>
                      <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                        <Pressable
                          onPress={handleCaptureDeliveryProof}
                          disabled={uploadingDeliveryProof}
                          style={{ backgroundColor: "#0284c7", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}
                        >
                          <Text style={{ fontSize: 10, fontWeight: "800", color: "#fff" }}>Save Photo Now 💾</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => setDeliveryProofUri(null)}
                          style={{ backgroundColor: "#fee2e2", paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6 }}
                        >
                          <Text style={{ fontSize: 10, fontWeight: "700", color: "#dc2626" }}>Cancel</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                ) : order.status !== "completed" ? (
                  <Pressable
                    onPress={handleCaptureDeliveryProof}
                    disabled={uploadingDeliveryProof}
                    style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#e0f2fe", paddingVertical: 11, borderRadius: 10, borderWidth: 1.5, borderColor: "#bae6fd", borderStyle: "dashed", marginBottom: 8 }}
                  >
                    {uploadingDeliveryProof ? (
                      <ActivityIndicator size="small" color="#0284c7" />
                    ) : (
                      <>
                        <Ionicons name="camera" size={18} color="#0284c7" style={{ marginRight: 8 }} />
                        <Text style={{ fontSize: 12, fontWeight: "800", color: "#0284c7" }}>
                          Click / Upload Cloth Delivery Photo (कपड़ा डिलीवरी फोटो) 📸
                        </Text>
                      </>
                    )}
                  </Pressable>
                ) : null}
              </View>

              {/* Delivery OTP Input & Verification */}
              {!order.isDeliveryOtpVerified && (
                order.deliveryOtp ? (
                  <View style={{ marginTop: 6 }}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#0369a1", marginBottom: 6 }}>
                      Enter 4-Digit Customer Delivery OTP to complete order:
                    </Text>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <TextInput
                        style={{ flex: 1, backgroundColor: "#ffffff", borderRadius: 10, borderWidth: 1, borderColor: "#bae6fd", fontSize: 18, fontWeight: "800", textAlign: "center", paddingVertical: 8, letterSpacing: 4 }}
                        placeholder="0000"
                        keyboardType="number-pad"
                        maxLength={4}
                        value={deliveryOtpInput}
                        onChangeText={setDeliveryOtpInput}
                      />
                      <Pressable
                        style={{ backgroundColor: "#0284c7", paddingHorizontal: 16, borderRadius: 10, justifyContent: "center", alignItems: "center" }}
                        onPress={handleVerifyDeliveryOtp}
                        disabled={verifyingDeliveryOtp || uploadingDeliveryProof}
                      >
                        {verifyingDeliveryOtp || uploadingDeliveryProof ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#ffffff", fontWeight: "800", fontSize: 14 }}>Verify Delivery</Text>}
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    style={{ backgroundColor: "#16a34a", paddingVertical: 12, borderRadius: 10, alignItems: "center", marginTop: 8 }}
                    onPress={handleGenerateDeliveryOtp}
                    disabled={generatingDeliveryOtp}
                  >
                    {generatingDeliveryOtp ? <ActivityIndicator color="#fff" /> : (
                      <Text style={{ color: "#ffffff", fontWeight: "800", fontSize: 14 }}>Generate Delivery OTP 📦</Text>
                    )}
                  </Pressable>
                )
              )}
            </View>
          </Section>
        )}

        {/* Customer & Service Mode */}
        <Section title="Order Details" icon="person">
          <InfoRow label="Name" value={order.customerId?.name} />
          <InfoRow label="Phone" value={order.customerId?.phone} />
          <InfoRow label="Order Date" value={new Date(order.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} />
          <InfoRow
            label="Service Mode"
            value={order.isHomeService ? "🏡 Home Service (Doorstep Visit)" : "🏪 Shop Service (Customer Visit)"}
            valueColor={order.isHomeService ? "#7c3aed" : "#0369a1"}
          />
          {order.isHomeService ? (
            <>
              <View style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <Text style={{ fontSize: 13, color: "#64748b", fontWeight: "600" }}>Visit Address</Text>
                  {order.homeServiceAddress && order.status !== "completed" ? (
                    <Pressable
                      onPress={() => openMapForNavigation(order.homeServiceAddress, order.homeServiceLocation, `${order.customerId?.name || "Customer"}'s Home`)}
                      style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#0d9488", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}
                    >
                      <Ionicons name="navigate" size={12} color="#ffffff" style={{ marginRight: 4 }} />
                      <Text style={{ fontSize: 11, color: "#ffffff", fontWeight: "700" }}>Open Map</Text>
                    </Pressable>
                  ) : null}
                </View>
                {order.status !== "completed" ? (
                  <Pressable
                    onPress={() => {
                      if (order.homeServiceAddress) {
                        openMapForNavigation(order.homeServiceAddress, order.homeServiceLocation, `${order.customerId?.name || "Customer"}'s Home`);
                      }
                    }}
                    style={({ pressed }) => [
                      { backgroundColor: "#f0fdfa", padding: 10, borderRadius: 8, borderWidth: 1, borderColor: "#ccfbf1", marginTop: 2 },
                      pressed && { opacity: 0.8 }
                    ]}
                  >
                    <Text style={{ fontSize: 13, color: "#134e4a", fontWeight: "600", lineHeight: 18 }}>
                      {order.homeServiceAddress || "—"}
                    </Text>
                    {order.homeServiceAddress && (
                      <Text style={{ fontSize: 11, color: "#0d9488", fontWeight: "700", marginTop: 4 }}>
                        📍 Tap to navigate with Google Maps
                      </Text>
                    )}
                  </Pressable>
                ) : (
                  <View style={{ backgroundColor: "#f8fafc", padding: 10, borderRadius: 8, borderWidth: 1, borderColor: "#e2e8f0", marginTop: 2 }}>
                    <Text style={{ fontSize: 13, color: "#334155", fontWeight: "500", lineHeight: 18 }}>
                      {order.homeServiceAddress || "—"}
                    </Text>
                  </View>
                )}
              </View>
              {order.visitDate && (
                <InfoRow label="Visit Date" value={new Date(order.visitDate).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} />
              )}
            </>
          ) : (
            order.homeServiceAddress ? (
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 13, color: "#64748b", fontWeight: "600", marginBottom: 4 }}>Customer Address</Text>
                <View style={{ backgroundColor: "#f8fafc", padding: 10, borderRadius: 8, borderWidth: 1, borderColor: "#e2e8f0", marginTop: 2 }}>
                  <Text style={{ fontSize: 13, color: "#334155", fontWeight: "500", lineHeight: 18 }}>
                    {order.homeServiceAddress}
                  </Text>
                </View>
              </View>
            ) : null
          )}
          {order.status !== "pending" && (order.completionTime || order.estimatedDays) ? (
            <InfoRow
              label="Estimated Completion"
              value={`${order.completionTime || `${order.estimatedDays} Days`} (${order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "Target"})`}
              valueColor={order.isPremiumService ? "#7c3aed" : "#059669"}
            />
          ) : order.isPremiumService && order.completionTime ? (
            <InfoRow
              label="Estimated Completion"
              value={order.completionTime}
              valueColor="#7c3aed"
            />
          ) : null}
        </Section>

        {/* Services & Pricing */}
        <Section title="Services & Cost" icon="receipt">
          {order.services.map((svc, i) => (
            <InfoRow key={i} label={`${svc.name} × ${svc.quantity}`} value={`₹${svc.price * svc.quantity}`} />
          ))}
          {order.fabricSource === "shop" && order.fabricDetails && (
            <InfoRow label={`Fabric: ${order.fabricDetails.name} (${order.fabricDetails.metersNeeded}m)`} value={`₹${order.fabricDetails.totalFabricCost}`} />
          )}
          {order.visitFee > 0 && (
            <InfoRow label="At-Home Visit Fee" value={`₹${order.visitFee}`} />
          )}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Grand Total</Text>
            <Text style={styles.totalValue}>₹{order.totalAmount}</Text>
          </View>
        </Section>

        {/* Design Preferences */}
        {order.designPreferences && (
          <Section title="Design Preferences" icon="shirt">
            <InfoRow label="Fit" value={order.designPreferences.fit} />
            <InfoRow label="Collar" value={order.designPreferences.collar} />
            <InfoRow label="Sleeves" value={order.designPreferences.sleeves} />
            <InfoRow label="Pockets" value={order.designPreferences.pockets} />
            {order.designPreferences.referenceImageUrl && (
              <InfoRow label="Reference Image" value="✅ Uploaded" valueColor="#16a34a" />
            )}
          </Section>
        )}

        {/* Fabric */}
        <Section title="Fabric" icon="color-palette">
          <InfoRow label="Source" value={order.fabricSource === "shop" ? "From Tailor Shop" : "Customer's Own Fabric"} />
          {order.fabricSource === "shop" && order.fabricDetails && (
            <>
              <InfoRow label="Fabric Name" value={order.fabricDetails.name} />
              <InfoRow label="Color" value={order.fabricDetails.color} />
              <InfoRow label="Quantity" value={`${order.fabricDetails.metersNeeded} meters`} />
            </>
          )}
        </Section>

        {/* Measurements */}
        <Section title="Measurements" icon="body">
          {order.measurementProfileId ? (
            <InfoRow label="Profile" value={`Saved Profile (#${String(order.measurementProfileId).slice(-5)})`} valueColor="#6d28d9" />
          ) : (
            <InfoRow label="Method" value="Visit Shop for Measurements" />
          )}
        </Section>

        {/* Notes */}
        <Section title="Notes" icon="document-text">
          <InfoRow label="Customer Notes" value={order.notes || "None"} />
          <View style={styles.internalNotesBox}>
            <Text style={styles.internalLabel}>Internal Notes (Private)</Text>
            <Text style={styles.internalValue}>{order.internalNotes || "Tap the edit button to add internal notes..."}</Text>
          </View>
        </Section>

        {/* Status History */}
        {order.statusHistory && order.statusHistory.length > 0 && (
          <Section title="Stage History" icon="time">
            {order.statusHistory.map((h, i) => (
              <View key={i} style={styles.historyRow}>
                <View style={[styles.historyDot, { backgroundColor: STAGE_COLORS[h.status] || "#94a3b8" }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyStatus}>{STAGE_LABELS[h.status] || h.status}</Text>
                  {h.note ? <Text style={styles.historyNote}>{h.note}</Text> : null}
                  <Text style={styles.historyDate}>{new Date(h.changedAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</Text>
                </View>
              </View>
            ))}
          </Section>
        )}

      </ScrollView>

      {/* Internal Note Modal */}
      <Modal visible={noteModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Internal Note</Text>
            <Text style={styles.modalSubtitle}>These notes are private and only visible to you and your staff.</Text>
            <TextInput
              style={styles.noteInput}
              multiline
              numberOfLines={5}
              placeholder="Add internal notes, staff instructions, quality observations..."
              value={internalNote}
              onChangeText={setInternalNote}
            />
            <View style={styles.modalBtns}>
              <Pressable style={styles.cancelBtn} onPress={() => setNoteModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={saveInternalNote} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Save Note</Text>}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll: { padding: 16, paddingBottom: 100 },

  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 14, backgroundColor: "#f8fafc", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#ffffff", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#e2e8f0" },
  headerCenter: { flex: 1, alignItems: "center" },
  orderId: { fontSize: 18, fontWeight: "900", color: "#0f172a" },
  stagePill: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, marginTop: 4, gap: 6 },
  stageDot: { width: 7, height: 7, borderRadius: 4 },
  stageText: { fontSize: 12, fontWeight: "800" },
  noteBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#ede9fe", justifyContent: "center", alignItems: "center" },

  priorityRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#ffffff", padding: 14, borderRadius: 14, marginBottom: 14, gap: 10, borderWidth: 1, borderColor: "#e2e8f0" },
  priorityLabel: { fontSize: 13, fontWeight: "700", color: "#64748b" },
  priorityPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 100, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0" },
  priorityPillActive: { backgroundColor: "#0f172a", borderColor: "#0f172a" },
  priorityText: { fontSize: 13, fontWeight: "600", color: "#475569" },
  priorityTextActive: { color: "#ffffff" },

  totalRow: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingTop: 12, marginTop: 4 },
  totalLabel: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  totalValue: { fontSize: 20, fontWeight: "900", color: "#0d9488" },

  internalNotesBox: { backgroundColor: "#fffbeb", padding: 12, borderRadius: 10, borderWidth: 1, borderColor: "#fde68a", marginTop: 8 },
  internalLabel: { fontSize: 11, fontWeight: "700", color: "#92400e", marginBottom: 4, textTransform: "uppercase" },
  internalValue: { fontSize: 14, color: "#78350f", lineHeight: 20 },

  historyRow: { flexDirection: "row", marginBottom: 14, gap: 12 },
  historyDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  historyStatus: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  historyNote: { fontSize: 13, color: "#475569", marginTop: 2 },
  historyDate: { fontSize: 11, color: "#94a3b8", marginTop: 2 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#ffffff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: "900", color: "#0f172a", marginBottom: 6 },
  modalSubtitle: { fontSize: 13, color: "#64748b", marginBottom: 16 },
  noteInput: { backgroundColor: "#f8fafc", borderRadius: 12, padding: 14, fontSize: 15, color: "#0f172a", minHeight: 110, textAlignVertical: "top", borderWidth: 1, borderColor: "#e2e8f0", marginBottom: 20 },
  modalBtns: { flexDirection: "row", gap: 12 },
  cancelBtn: { flex: 1, height: 52, borderRadius: 14, justifyContent: "center", alignItems: "center", backgroundColor: "#f1f5f9" },
  cancelBtnText: { fontWeight: "700", color: "#475569", fontSize: 15 },
  saveBtn: { flex: 2, height: 52, borderRadius: 14, justifyContent: "center", alignItems: "center", backgroundColor: "#6d28d9" },
  saveBtnText: { color: "#ffffff", fontWeight: "700", fontSize: 15 },
});
