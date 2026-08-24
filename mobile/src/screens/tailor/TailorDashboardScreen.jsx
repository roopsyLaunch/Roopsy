import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  ActivityIndicator, Switch, Image, RefreshControl, Alert
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../api/client";
import { getSocket } from "../../api/socket";
import { useFocusEffect } from "@react-navigation/native";

const QUICK_ACTIONS = [
  { label: "Production\nBoard", icon: "albums", color: "#6d28d9", bg: "#ede9fe", screen: "ProductionBoard" },
  { label: "All\nOrders", icon: "document-text", color: "#b45309", bg: "#fef3c7", screen: "TailorOrders" },
  { label: "Services &\nPricing", icon: "cut", color: "#0369a1", bg: "#e0f2fe", screen: "TailorServices" },
  { label: "CRM\nCustomers", icon: "people", color: "#059669", bg: "#d1fae5", screen: "TailorCRM" },
  { label: "Inventory", icon: "cube", color: "#be185d", bg: "#fce7f3", screen: "TailorInventory" },
  { label: "Staff\nManage", icon: "person-add", color: "#7c3aed", bg: "#ede9fe", screen: "TailorStaff" },
  { label: "Finance\nReport", icon: "bar-chart", color: "#0f172a", bg: "#f1f5f9", screen: "TailorFinance" },
  { label: "Shop\nProfile", icon: "storefront", color: "#b45309", bg: "#fef9c3", screen: "TailorShopEdit" },
];

export function TailorDashboardScreen({ navigation }) {
  const { tailor, refreshMe, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    todayRevenue: 0,
    monthRevenue: 0,
    totalOrders: 0,
    pending: 0,
    inProduction: 0,
    trial: 0,
    ready: 0,
    completed: 0,
    homeVisits: 0,
    urgent: 0,
  });
  const [recentOrders, setRecentOrders] = useState([]);

  const PRODUCTION_STAGES = ["cutting", "stitching", "embroidery", "alteration", "ironing", "quality_check", "packing"];

  const loadStats = useCallback(async () => {
    if (!tailor) return;
    try {
      const res = await api.get("/tailors/me/orders");
      const orders = res.data.orders || [];
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const todayRevenue = orders
        .filter(o => o.status === "completed" && new Date(o.updatedAt) >= todayStart)
        .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

      const monthRevenue = orders
        .filter(o => o.status === "completed" && new Date(o.updatedAt) >= monthStart)
        .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

      setStats({
        todayRevenue,
        monthRevenue,
        totalOrders: orders.length,
        pending: orders.filter(o => o.status === "pending").length,
        inProduction: orders.filter(o => PRODUCTION_STAGES.includes(o.status)).length,
        trial: orders.filter(o => o.status === "trial").length,
        ready: orders.filter(o => o.status === "ready").length,
        completed: orders.filter(o => o.status === "completed").length,
        homeVisits: orders.filter(o => o.isHomeService).length,
        urgent: orders.filter(o => o.priority === "urgent" || o.priority === "rush").length,
      });
      setRecentOrders(orders.slice(0, 5));
    } catch (err) {
      console.error(err);
    }
  }, [tailor]);

  useFocusEffect(useCallback(() => {
    loadStats();
    
    const socket = getSocket();
    if (user?.id) {
      socket.emit("joinUserRoom", user.id);
    }
    const handleNewOrder = () => {
      Alert.alert("New Booking Request ✂️", "You have a new tailor booking request!");
      loadStats();
    };
    socket.on("tailorNewOrder", handleNewOrder);
    socket.on("bookingUpdated", loadStats);

    return () => {
      socket.off("tailorNewOrder", handleNewOrder);
      socket.off("bookingUpdated", loadStats);
    };
  }, [loadStats, user?.id]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  const toggleStatus = async () => {
    setLoading(true);
    try {
      await api.patch("/tailors/me", { isShopOpen: !tailor.isShopOpen });
      await refreshMe();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getStageColor = (status) => {
    if (status === "pending") return "#f59e0b";
    if (status === "accepted" || status === "measurement_pending") return "#3b82f6";
    if (["cutting", "stitching"].includes(status)) return "#8b5cf6";
    if (status === "trial") return "#f97316";
    if (status === "ready" || status === "dispatched") return "#10b981";
    if (status === "completed") return "#059669";
    if (["cancelled", "declined"].includes(status)) return "#ef4444";
    return "#64748b";
  };

  if (!tailor) return <ActivityIndicator style={{ flex: 1 }} color="#6d28d9" />;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6d28d9" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerCard}>
          <Image
            source={{ uri: tailor.shopPosterUrl || user?.avatarUrl || "https://images.unsplash.com/photo-1598522325754-046dd13ac1c0?w=500&q=80" }}
            style={styles.avatar}
          />
          <View style={styles.headerText}>
            <Text style={styles.greeting}>Partner ERP</Text>
            <Text style={styles.shopName}>{tailor.shopName || "My Tailor Shop"}</Text>
            <Text style={styles.ownerName}>{tailor.ownerName || user?.name}</Text>
          </View>
          <View style={styles.headerRight}>
            {loading ? (
              <ActivityIndicator color="#6d28d9" size="small" />
            ) : (
              <Switch
                value={tailor.isShopOpen}
                onValueChange={toggleStatus}
                trackColor={{ false: "#e2e8f0", true: "#c4b5fd" }}
                thumbColor={tailor.isShopOpen ? "#6d28d9" : "#94a3b8"}
              />
            )}
            <Text style={[styles.shopStatusText, { color: tailor.isShopOpen ? "#6d28d9" : "#94a3b8" }]}>
              {tailor.isShopOpen ? "Open" : "Closed"}
            </Text>
          </View>
        </View>

        {/* Verification Status Banner */}
        {tailor.approvalStatus === "pending" && (
          <View style={{ backgroundColor: "#fef3c7", padding: 12, marginHorizontal: 20, marginBottom: 16, borderRadius: 12, borderWidth: 1, borderColor: "#fde68a" }}>
            <Text style={{ color: "#92400e", fontWeight: "700", fontSize: 14, marginBottom: 4 }}>
              Verification Pending
            </Text>
            <Text style={{ color: "#b45309", fontSize: 12 }}>
              You can configure your shop setup, but it will not appear to customers until an admin verifies your details.
            </Text>
          </View>
        )}
        {tailor.approvalStatus === "rejected" && (
          <View style={{ backgroundColor: "#fee2e2", padding: 12, marginHorizontal: 20, marginBottom: 16, borderRadius: 12, borderWidth: 1, borderColor: "#fca5a5" }}>
            <Text style={{ color: "#991b1b", fontWeight: "700", fontSize: 14, marginBottom: 4 }}>
              Application Rejected
            </Text>
            <Text style={{ color: "#c53030", fontSize: 12 }}>
              Your application was rejected. Reason: {tailor.rejectionReason || "Not specified"}. Please update your profile details.
            </Text>
          </View>
        )}

        {/* Urgent Alert Banner */}
        {stats.urgent > 0 && (
          <Pressable style={styles.urgentBanner} onPress={() => navigation.navigate("TailorOrders")}>
            <Ionicons name="warning" size={18} color="#ffffff" />
            <Text style={styles.urgentText}>{stats.urgent} urgent/rush order{stats.urgent > 1 ? "s" : ""} need attention!</Text>
            <Ionicons name="chevron-forward" size={18} color="#ffffff" />
          </Pressable>
        )}

        {/* Pending Booking Requests Banner */}
        {stats.pending > 0 && (
          <Pressable style={[styles.urgentBanner, { backgroundColor: "#d97706", marginBottom: 16 }]} onPress={() => navigation.navigate("TailorOrders")}>
            <Ionicons name="notifications" size={20} color="#ffffff" />
            <Text style={[styles.urgentText, { flex: 1 }]}>{stats.pending} New Booking Request{stats.pending > 1 ? "s" : ""} awaiting your confirmation!</Text>
            <View style={{ backgroundColor: "#ffffff", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
              <Text style={{ color: "#d97706", fontWeight: "800", fontSize: 12 }}>Confirm Now</Text>
            </View>
          </Pressable>
        )}

        {/* Revenue Cards */}
        <Text style={styles.sectionTitle}>Today's Overview</Text>
        <View style={styles.revenueRow}>
          <View style={[styles.revenueCard, { backgroundColor: "#6d28d9" }]}>
            <Ionicons name="today" size={22} color="rgba(255,255,255,0.7)" />
            <Text style={styles.revenueValue}>₹{stats.todayRevenue.toLocaleString()}</Text>
            <Text style={styles.revenueLabel}>Today's Revenue</Text>
          </View>
          <View style={[styles.revenueCard, { backgroundColor: "#0f172a" }]}>
            <Ionicons name="calendar" size={22} color="rgba(255,255,255,0.7)" />
            <Text style={styles.revenueValue}>₹{stats.monthRevenue.toLocaleString()}</Text>
            <Text style={styles.revenueLabel}>This Month</Text>
          </View>
        </View>

        {/* KPI Grid */}
        <Text style={styles.sectionTitle}>Production Status</Text>
        <View style={styles.kpiGrid}>
          {[
            { label: "New Orders", value: stats.pending, icon: "notifications", color: "#f59e0b", bg: "#fef3c7", screen: "TailorOrders" },
            { label: "In Production", value: stats.inProduction, icon: "construct", color: "#8b5cf6", bg: "#ede9fe", screen: "ProductionBoard" },
            { label: "Trial Pending", value: stats.trial, icon: "body", color: "#f97316", bg: "#ffedd5", screen: "ProductionBoard" },
            { label: "Ready to Ship", value: stats.ready, icon: "checkmark-circle", color: "#10b981", bg: "#d1fae5", screen: "ProductionBoard" },
            { label: "Premium Services", value: stats.homeVisits, icon: "star", color: "#7c3aed", bg: "#ede9fe", screen: "TailorOrders" },
            { label: "Completed", value: stats.completed, icon: "ribbon", color: "#059669", bg: "#ecfdf5", screen: "TailorOrders" },
          ].map((kpi) => (
            <Pressable key={kpi.label} style={styles.kpiCard} onPress={() => navigation.navigate(kpi.screen)}>
              <View style={[styles.kpiIcon, { backgroundColor: kpi.bg }]}>
                <Ionicons name={kpi.icon} size={22} color={kpi.color} />
              </View>
              <Text style={[styles.kpiValue, { color: kpi.color }]}>{kpi.value}</Text>
              <Text style={styles.kpiLabel}>{kpi.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickGrid}>
          {QUICK_ACTIONS.map((qa) => (
            <Pressable key={qa.label} style={styles.quickCard} onPress={() => navigation.navigate(qa.screen)}>
              <View style={[styles.quickIcon, { backgroundColor: qa.bg }]}>
                <Ionicons name={qa.icon} size={24} color={qa.color} />
              </View>
              <Text style={styles.quickLabel}>{qa.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Recent Orders */}
        <View style={styles.recentHeader}>
          <Text style={styles.sectionTitle}>Recent Orders</Text>
          <Pressable onPress={() => navigation.navigate("TailorOrders")}>
            <Text style={styles.seeAll}>See All</Text>
          </Pressable>
        </View>
        {recentOrders.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="document-outline" size={36} color="#cbd5e1" />
            <Text style={styles.emptyText}>No orders yet</Text>
          </View>
        ) : (
          recentOrders.map(order => (
            <Pressable
              key={order._id}
              style={styles.orderRow}
              onPress={() => navigation.navigate("PartnerOrderDetail", { orderId: order._id })}
            >
              <View style={[styles.orderDot, { backgroundColor: getStageColor(order.status) }]} />
              <View style={styles.orderInfo}>
                <Text style={styles.orderCustomer}>{order.customerId?.name || "Customer"}</Text>
                <Text style={styles.orderServices}>{order.services.map(s => s.name).join(", ")}</Text>
              </View>
              <View style={styles.orderRight}>
                <Text style={styles.orderAmount}>₹{order.totalAmount}</Text>
                <View style={[styles.stageBadge, { backgroundColor: getStageColor(order.status) + "20" }]}>
                  <Text style={[styles.stageBadgeText, { color: getStageColor(order.status) }]}>
                    {order.status.replace(/_/g, " ").toUpperCase()}
                  </Text>
                </View>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  scroll: { padding: 20, paddingBottom: 100 },

  headerCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#ffffff", padding: 16, borderRadius: 20, marginBottom: 20, borderWidth: 1, borderColor: "#e2e8f0" },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#e2e8f0" },
  headerText: { flex: 1, marginLeft: 12 },
  greeting: { fontSize: 11, color: "#6d28d9", fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },
  shopName: { fontSize: 17, fontWeight: "900", color: "#0f172a" },
  ownerName: { fontSize: 12, color: "#64748b", marginTop: 2 },
  headerRight: { alignItems: "center" },
  shopStatusText: { fontSize: 11, fontWeight: "700", marginTop: 4 },

  urgentBanner: { flexDirection: "row", alignItems: "center", backgroundColor: "#ef4444", padding: 14, borderRadius: 14, marginBottom: 20, gap: 10 },
  urgentText: { flex: 1, color: "#ffffff", fontWeight: "700", fontSize: 14 },

  sectionTitle: { fontSize: 17, fontWeight: "800", color: "#0f172a", marginBottom: 14, marginTop: 4 },

  revenueRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  revenueCard: { flex: 1, padding: 20, borderRadius: 18 },
  revenueValue: { fontSize: 22, fontWeight: "900", color: "#ffffff", marginTop: 10 },
  revenueLabel: { fontSize: 12, fontWeight: "600", color: "rgba(255,255,255,0.7)", marginTop: 4 },

  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 24 },
  kpiCard: { width: "30%", flex: 0, minWidth: "30%", backgroundColor: "#ffffff", padding: 14, borderRadius: 16, alignItems: "center", borderWidth: 1, borderColor: "#f1f5f9" },
  kpiIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  kpiValue: { fontSize: 22, fontWeight: "900" },
  kpiLabel: { fontSize: 11, color: "#64748b", fontWeight: "600", textAlign: "center", marginTop: 4 },

  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 24 },
  quickCard: { width: "22%", alignItems: "center" },
  quickIcon: { width: 52, height: 52, borderRadius: 16, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  quickLabel: { fontSize: 10, fontWeight: "700", color: "#475569", textAlign: "center" },

  recentHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  seeAll: { color: "#6d28d9", fontWeight: "700", fontSize: 14 },

  orderRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#ffffff", padding: 14, borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: "#f1f5f9" },
  orderDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  orderInfo: { flex: 1 },
  orderCustomer: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  orderServices: { fontSize: 12, color: "#64748b", marginTop: 2 },
  orderRight: { alignItems: "flex-end" },
  orderAmount: { fontSize: 15, fontWeight: "800", color: "#0f172a", marginBottom: 4 },
  stageBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  stageBadgeText: { fontSize: 9, fontWeight: "800" },

  emptyCard: { backgroundColor: "#ffffff", padding: 40, borderRadius: 16, alignItems: "center", borderWidth: 1, borderColor: "#f1f5f9" },
  emptyText: { marginTop: 10, fontSize: 14, color: "#94a3b8", fontWeight: "600" },
});
