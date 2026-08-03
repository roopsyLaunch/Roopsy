import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, Image
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../api/client";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";

export function AdminDashboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/admin-panel/dashboard-stats");
      setStats(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  if (loading || !stats) return <View style={styles.centered}><ActivityIndicator size="large" color="#0f172a" /></View>;

  const ACTIONS = [
    { label: "Partner Mgmt", icon: "people", color: "#6d28d9", bg: "#ede9fe", screen: "AdminPartners" },
    { label: "All Orders", icon: "cart", color: "#059669", bg: "#d1fae5", screen: "AdminOrders" },
    { label: "Finance & Payouts", icon: "wallet", color: "#b45309", bg: "#fef3c7", screen: "AdminFinance" },
    { label: "CMS & Catalog", icon: "layers", color: "#0ea5e9", bg: "#e0f2fe", screen: "AdminCatalog" },
    { label: "Customers", icon: "person", color: "#be185d", bg: "#fce7f3", screen: "AdminCustomers" },
    { label: "Analytics", icon: "bar-chart", color: "#0f172a", bg: "#f1f5f9", screen: "AdminAnalytics" },
  ];

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
      <View style={styles.header}>
        <View style={styles.headerProfile}>
          <Image source={{ uri: user?.avatarUrl || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100" }} style={styles.avatar} />
          <View>
            <Text style={styles.greeting}>Marketplace Admin</Text>
            <Text style={styles.adminName}>{user?.name}</Text>
          </View>
        </View>
        <Pressable style={styles.closeBtn} onPress={() => navigation.navigate("Home")}>
          <Ionicons name="close" size={24} color="#0f172a" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0f172a" />}
      >
        <View style={styles.revenueCard}>
          <Text style={styles.revenueLabel}>Total Platform Revenue</Text>
          <Text style={styles.revenueValue}>₹{(stats.totalRevenue || 0).toLocaleString()}</Text>
          <View style={styles.revenueRow}>
            <View style={styles.revStat}>
              <Text style={styles.revStatLabel}>Commission Earned</Text>
              <Text style={styles.revStatValue}>₹{(stats.platformCommission || 0).toLocaleString()}</Text>
            </View>
            <View style={styles.revDivider} />
            <View style={styles.revStat}>
              <Text style={styles.revStatLabel}>Total Orders</Text>
              <Text style={styles.revStatValue}>{stats.totalOrders}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Ecosystem Growth</Text>
        <View style={styles.kpiGrid}>
          {[
            { label: "Active Tailors", value: stats.activeTailors, icon: "storefront", color: "#6d28d9" },
            { label: "Pending KYC", value: stats.pendingTailors, icon: "document-text", color: "#f59e0b" },
            { label: "Total Customers", value: stats.totalUsers, icon: "people", color: "#059669" },
            { label: "Total Tailors", value: stats.totalTailors, icon: "list", color: "#0ea5e9" },
          ].map(kpi => (
            <View key={kpi.label} style={styles.kpiCard}>
              <View style={[styles.kpiIcon, { backgroundColor: kpi.color + "20" }]}>
                <Ionicons name={kpi.icon} size={20} color={kpi.color} />
              </View>
              <Text style={styles.kpiValue}>{kpi.value}</Text>
              <Text style={styles.kpiLabel}>{kpi.label}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Admin Workflows</Text>
        <View style={styles.actionsGrid}>
          {ACTIONS.map(act => (
            <Pressable key={act.label} style={styles.actionBtn} onPress={() => navigation.navigate(act.screen)}>
              <View style={[styles.actionIcon, { backgroundColor: act.bg }]}>
                <Ionicons name={act.icon} size={24} color={act.color} />
              </View>
              <Text style={styles.actionLabel}>{act.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },

  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 16 },
  headerProfile: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#e2e8f0" },
  greeting: { fontSize: 11, fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: 1 },
  adminName: { fontSize: 18, fontWeight: "900", color: "#0f172a" },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#f1f5f9", justifyContent: "center", alignItems: "center" },

  scroll: { padding: 16, paddingBottom: 40 },

  revenueCard: { backgroundColor: "#0f172a", borderRadius: 24, padding: 24, marginBottom: 24 },
  revenueLabel: { fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.7)", marginBottom: 4 },
  revenueValue: { fontSize: 38, fontWeight: "900", color: "#ffffff", marginBottom: 20 },
  revenueRow: { flexDirection: "row" },
  revStat: { flex: 1 },
  revStatLabel: { fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.6)", textTransform: "uppercase" },
  revStatValue: { fontSize: 18, fontWeight: "800", color: "#34d399", marginTop: 4 },
  revDivider: { width: 1, height: 34, backgroundColor: "rgba(255,255,255,0.2)", marginHorizontal: 16 },

  sectionTitle: { fontSize: 18, fontWeight: "900", color: "#0f172a", marginBottom: 16 },

  kpiGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 24 },
  kpiCard: { width: "48%", backgroundColor: "#ffffff", padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: "#e2e8f0" },
  kpiIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center", marginBottom: 12 },
  kpiValue: { fontSize: 24, fontWeight: "900", color: "#0f172a" },
  kpiLabel: { fontSize: 12, fontWeight: "600", color: "#64748b", marginTop: 4 },

  actionsGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  actionBtn: { width: "31%", backgroundColor: "#ffffff", paddingVertical: 16, borderRadius: 16, alignItems: "center", marginBottom: 12, borderWidth: 1, borderColor: "#e2e8f0" },
  actionIcon: { width: 48, height: 48, borderRadius: 16, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  actionLabel: { fontSize: 11, fontWeight: "700", color: "#475569", textAlign: "center" },
});
