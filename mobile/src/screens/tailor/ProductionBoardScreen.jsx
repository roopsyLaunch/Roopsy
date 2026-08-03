import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  ActivityIndicator, Alert, RefreshControl, Modal, TextInput
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../api/client";
import { useFocusEffect } from "@react-navigation/native";

const STAGES = [
  { key: "pending",             label: "New",              color: "#f59e0b", bg: "#fef3c7", icon: "notifications"   },
  { key: "accepted",            label: "Accepted",         color: "#3b82f6", bg: "#dbeafe", icon: "checkmark"       },
  { key: "measurement_pending", label: "Measuring",        color: "#8b5cf6", bg: "#ede9fe", icon: "body"            },
  { key: "fabric_pending",      label: "Fabric",           color: "#f97316", bg: "#ffedd5", icon: "color-palette"   },
  { key: "pattern_making",      label: "Pattern",          color: "#a855f7", bg: "#fae8ff", icon: "grid"            },
  { key: "cutting",             label: "Cutting",          color: "#ec4899", bg: "#fce7f3", icon: "cut"             },
  { key: "stitching",           label: "Stitching",        color: "#6d28d9", bg: "#ede9fe", icon: "construct"       },
  { key: "embroidery",          label: "Embroidery",       color: "#be185d", bg: "#fdf2f8", icon: "flower"          },
  { key: "trial",               label: "Trial",            color: "#d97706", bg: "#fffbeb", icon: "shirt"           },
  { key: "alteration",          label: "Alteration",       color: "#7c3aed", bg: "#ede9fe", icon: "hammer"          },
  { key: "ironing",             label: "Ironing",          color: "#0ea5e9", bg: "#e0f2fe", icon: "flame"           },
  { key: "quality_check",       label: "QC",               color: "#0d9488", bg: "#ccfbf1", icon: "shield-checkmark"},
  { key: "packing",             label: "Packing",          color: "#059669", bg: "#d1fae5", icon: "cube"            },
  { key: "ready",               label: "Ready",            color: "#16a34a", bg: "#dcfce7", icon: "bag-check"       },
  { key: "dispatched",          label: "Dispatched",       color: "#0f172a", bg: "#f1f5f9", icon: "bicycle"         },
  { key: "completed",           label: "Completed",        color: "#15803d", bg: "#f0fdf4", icon: "ribbon"          },
];

// The natural "next stage" for the Move button
const NEXT_STAGE = {
  pending:             "accepted",
  accepted:            "measurement_pending",
  measurement_pending: "fabric_pending",
  fabric_pending:      "pattern_making",
  pattern_making:      "cutting",
  cutting:             "stitching",
  stitching:           "embroidery",
  embroidery:          "trial",
  trial:               "alteration",
  alteration:          "ironing",
  ironing:             "quality_check",
  quality_check:       "packing",
  packing:             "ready",
  ready:               "dispatched",
  dispatched:          "completed",
};

export function ProductionBoardScreen({ navigation }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStage, setSelectedStage] = useState("pending");
  const [moveModal, setMoveModal] = useState({ visible: false, order: null });
  const [noteText, setNoteText] = useState("");
  const [targetStage, setTargetStage] = useState("");
  const [busy, setBusy] = useState(false);

  const loadOrders = useCallback(async () => {
    try {
      const res = await api.get("/tailors/me/orders");
      setOrders(res.data.orders || []);
    } catch (err) { console.error(err); }
  }, []);

  useFocusEffect(useCallback(() => {
    loadOrders().finally(() => setLoading(false));
  }, [loadOrders]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  };

  const confirmMoveStage = (order, stage) => {
    setMoveModal({ visible: true, order });
    setTargetStage(stage);
    setNoteText("");
  };

  const doMoveStage = async () => {
    if (!moveModal.order || !targetStage) return;

    const COMPLETION_STAGES = ["ready", "dispatched", "completed"];
    if (COMPLETION_STAGES.includes(targetStage) && !moveModal.order.isOtpVerified) {
      setMoveModal({ visible: false, order: null });
      return Alert.alert(
        "OTP Verification Required 🔒",
        "This order cannot be marked as complete or ready without customer OTP verification. Ask customer for 4-digit OTP and verify identity first."
      );
    }

    setBusy(true);
    try {
      await api.patch(`/tailors/orders/${moveModal.order._id}/status`, {
        status: targetStage,
        note: noteText,
      });
      setMoveModal({ visible: false, order: null });
      await loadOrders();
    } catch (err) {
      Alert.alert("OTP Verification Required 🔒", err?.response?.data?.error || "Could not update order stage.");
    } finally {
      setBusy(false);
    }
  };

  const declineOrder = async (orderId) => {
    Alert.alert("Decline Order", "Are you sure you want to decline this order?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Decline", style: "destructive", onPress: async () => {
          await api.patch(`/tailors/orders/${orderId}/status`, { status: "declined" });
          await loadOrders();
        }
      }
    ]);
  };

  const staged = orders.filter(o => o.status === selectedStage);
  const counts = STAGES.reduce((acc, s) => {
    acc[s.key] = orders.filter(o => o.status === s.key).length;
    return acc;
  }, {});

  const selectedMeta = STAGES.find(s => s.key === selectedStage);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Production Board</Text>
        <Pressable style={styles.refreshBtn} onPress={onRefresh}>
          <Ionicons name="refresh" size={20} color="#6d28d9" />
        </Pressable>
      </View>

      {/* Stage Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsContainer}
        style={styles.tabsScroll}
      >
        {STAGES.map(stage => {
          const isActive = selectedStage === stage.key;
          const count = counts[stage.key] || 0;
          return (
            <Pressable
              key={stage.key}
              style={[styles.tab, isActive && { backgroundColor: stage.color }]}
              onPress={() => setSelectedStage(stage.key)}
            >
              <View style={styles.tabInner}>
                <Ionicons name={stage.icon} size={16} color={isActive ? "#fff" : stage.color} />
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{stage.label}</Text>
              </View>
              {count > 0 && (
                <View style={[styles.tabBadge, { backgroundColor: isActive ? "rgba(255,255,255,0.3)" : stage.bg }]}>
                  <Text style={[styles.tabBadgeText, { color: isActive ? "#fff" : stage.color }]}>{count}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Stage Summary Banner */}
      {selectedMeta && (
        <View style={[styles.stageBanner, { backgroundColor: selectedMeta.bg }]}>
          <Ionicons name={selectedMeta.icon} size={20} color={selectedMeta.color} />
          <Text style={[styles.stageBannerText, { color: selectedMeta.color }]}>
            {staged.length} order{staged.length !== 1 ? "s" : ""} in {selectedMeta.label}
          </Text>
        </View>
      )}

      {/* Orders in Stage */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#6d28d9" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6d28d9" />}
        >
          {staged.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="albums-outline" size={44} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No orders in this stage</Text>
              <Text style={styles.emptyDesc}>Pull to refresh or select another stage.</Text>
            </View>
          ) : (
            staged.map(order => {
              const nextStage = NEXT_STAGE[order.status];
              const nextMeta = nextStage ? STAGES.find(s => s.key === nextStage) : null;

              return (
                <Pressable
                  key={order._id}
                  style={styles.orderCard}
                  onPress={() => navigation.navigate("PartnerOrderDetail", { orderId: order._id })}
                >
                  {/* Priority Tag */}
                  {(order.priority === "urgent" || order.priority === "rush") && (
                    <View style={styles.urgentTag}>
                      <Ionicons name="flash" size={12} color="#fff" />
                      <Text style={styles.urgentTagText}>{order.priority.toUpperCase()}</Text>
                    </View>
                  )}

                  {/* Card Header */}
                  <View style={styles.cardHeader}>
                    <View>
                      <Text style={styles.customerName}>{order.customerId?.name || "Customer"}</Text>
                      <Text style={styles.orderId}>#{order._id.slice(-6).toUpperCase()}</Text>
                    </View>
                    <Text style={styles.orderAmount}>₹{order.totalAmount}</Text>
                  </View>

                  {/* Services */}
                  <View style={styles.servicesList}>
                    {order.services.map((s, i) => (
                      <View key={i} style={styles.serviceTag}>
                        <Text style={styles.serviceTagText}>{s.name}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Meta */}
                  <View style={styles.cardMeta}>
                    {order.isHomeService && (
                      <View style={styles.metaTag}>
                        <Ionicons name="star" size={12} color="#7c3aed" />
                        <Text style={[styles.metaTagText, { color: "#7c3aed" }]}>Premium</Text>
                      </View>
                    )}
                    {order.fabricSource === "shop" && (
                      <View style={styles.metaTag}>
                        <Ionicons name="color-palette" size={12} color="#8b5cf6" />
                        <Text style={[styles.metaTagText, { color: "#8b5cf6" }]}>Shop Fabric</Text>
                      </View>
                    )}
                    <Text style={styles.dateText}>
                      {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </Text>
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.cardActions}>
                    {order.status === "pending" && (
                      <Pressable style={styles.declineBtn} onPress={() => declineOrder(order._id)}>
                        <Text style={styles.declineBtnText}>Decline</Text>
                      </Pressable>
                    )}
                    {nextMeta && (
                      <Pressable
                        style={[styles.moveBtn, { backgroundColor: nextMeta.color }]}
                        onPress={() => confirmMoveStage(order, nextStage)}
                      >
                        <Ionicons name="arrow-forward" size={14} color="#fff" />
                        <Text style={styles.moveBtnText}>Move to {nextMeta.label}</Text>
                      </Pressable>
                    )}
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Move Stage Modal */}
      <Modal visible={moveModal.visible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Move to Next Stage</Text>
            {targetStage && (
              <View style={styles.targetBadge}>
                <Ionicons name={STAGES.find(s => s.key === targetStage)?.icon || "arrow-forward"} size={16} color={STAGES.find(s => s.key === targetStage)?.color || "#0f172a"} />
                <Text style={[styles.targetBadgeText, { color: STAGES.find(s => s.key === targetStage)?.color || "#0f172a" }]}>
                  {STAGES.find(s => s.key === targetStage)?.label || targetStage}
                </Text>
              </View>
            )}
            <Text style={styles.modalLabel}>Add a note (optional)</Text>
            <TextInput
              style={styles.noteInput}
              multiline
              numberOfLines={3}
              placeholder="e.g. Customer approved trial, proceeding to alteration..."
              value={noteText}
              onChangeText={setNoteText}
            />
            <View style={styles.modalButtons}>
              <Pressable style={styles.cancelModalBtn} onPress={() => setMoveModal({ visible: false, order: null })}>
                <Text style={styles.cancelModalText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.confirmModalBtn} onPress={doMoveStage} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.confirmModalText}>Confirm Move</Text>}
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

  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, backgroundColor: "#ffffff", borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  headerTitle: { fontSize: 22, fontWeight: "900", color: "#0f172a" },
  refreshBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#ede9fe", justifyContent: "center", alignItems: "center" },

  tabsScroll: { backgroundColor: "#ffffff", maxHeight: 68 },
  tabsContainer: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  tab: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, backgroundColor: "#f8fafc", gap: 8 },
  tabInner: { flexDirection: "row", alignItems: "center", gap: 6 },
  tabLabel: { fontSize: 13, fontWeight: "700", color: "#475569" },
  tabLabelActive: { color: "#ffffff" },
  tabBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 100 },
  tabBadgeText: { fontSize: 11, fontWeight: "800" },

  stageBanner: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 10, gap: 10 },
  stageBannerText: { fontSize: 14, fontWeight: "700" },

  listContent: { padding: 16, paddingBottom: 100 },
  emptyBox: { paddingVertical: 60, alignItems: "center" },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: "#64748b", marginTop: 12 },
  emptyDesc: { fontSize: 13, color: "#94a3b8", marginTop: 6 },

  orderCard: { backgroundColor: "#ffffff", borderRadius: 18, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: "#e2e8f0", shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2, overflow: "hidden" },
  urgentTag: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", backgroundColor: "#ef4444", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, marginBottom: 10, gap: 4 },
  urgentTagText: { color: "#ffffff", fontSize: 10, fontWeight: "800" },

  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  customerName: { fontSize: 17, fontWeight: "800", color: "#0f172a" },
  orderId: { fontSize: 12, color: "#94a3b8", marginTop: 2, fontWeight: "600" },
  orderAmount: { fontSize: 18, fontWeight: "900", color: "#0f172a" },

  servicesList: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  serviceTag: { backgroundColor: "#f1f5f9", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  serviceTagText: { fontSize: 13, fontWeight: "600", color: "#334155" },

  cardMeta: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  metaTag: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#f8fafc", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  metaTagText: { fontSize: 12, fontWeight: "600" },
  dateText: { fontSize: 12, color: "#94a3b8", marginLeft: "auto", fontWeight: "600" },

  cardActions: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
  declineBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fecaca" },
  declineBtnText: { color: "#ef4444", fontWeight: "700", fontSize: 13 },
  moveBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, gap: 6 },
  moveBtnText: { color: "#ffffff", fontWeight: "700", fontSize: 13 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#ffffff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: "900", color: "#0f172a", marginBottom: 16 },
  targetBadge: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#f8fafc", padding: 12, borderRadius: 12, marginBottom: 16 },
  targetBadgeText: { fontSize: 16, fontWeight: "800" },
  modalLabel: { fontSize: 13, fontWeight: "700", color: "#475569", marginBottom: 8 },
  noteInput: { backgroundColor: "#f8fafc", borderRadius: 12, padding: 14, fontSize: 15, color: "#0f172a", minHeight: 80, textAlignVertical: "top", borderWidth: 1, borderColor: "#e2e8f0", marginBottom: 20 },
  modalButtons: { flexDirection: "row", gap: 12 },
  cancelModalBtn: { flex: 1, height: 52, borderRadius: 14, justifyContent: "center", alignItems: "center", backgroundColor: "#f1f5f9" },
  cancelModalText: { fontWeight: "700", color: "#475569", fontSize: 15 },
  confirmModalBtn: { flex: 2, height: 52, borderRadius: 14, justifyContent: "center", alignItems: "center", backgroundColor: "#0f172a" },
  confirmModalText: { color: "#ffffff", fontWeight: "700", fontSize: 15 },
});
