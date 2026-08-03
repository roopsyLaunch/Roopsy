import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable,
  ActivityIndicator, TextInput, Image, RefreshControl
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../api/client";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const TAG_COLORS = {
  VIP:       { bg: "#fef9c3", text: "#92400e" },
  Bride:     { bg: "#fce7f3", text: "#be185d" },
  Corporate: { bg: "#dbeafe", text: "#1e40af" },
  Regular:   { bg: "#d1fae5", text: "#065f46" },
  Repeat:    { bg: "#ede9fe", text: "#5b21b6" },
};

export function TailorCRMScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]       = useState("");
  const [sortBy, setSortBy]       = useState("recent"); // "recent" | "spend" | "orders"

  const load = useCallback(async () => {
    try {
      const res = await api.get("/tailor-crm/customers");
      setCustomers(res.data.customers || []);
    } catch (err) { console.error(err); }
  }, []);

  useFocusEffect(useCallback(() => {
    load().finally(() => setLoading(false));
  }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const sorted = [...customers]
    .filter(c => {
      const name  = c.customer?.name?.toLowerCase() || "";
      const phone = c.customer?.phone || "";
      const q     = search.toLowerCase();
      return name.includes(q) || phone.includes(q);
    })
    .sort((a, b) => {
      if (sortBy === "spend")  return b.totalSpend  - a.totalSpend;
      if (sortBy === "orders") return b.totalOrders - a.totalOrders;
      return new Date(b.lastOrderAt) - new Date(a.lastOrderAt);
    });

  const renderItem = ({ item }) => {
    const { customer, totalOrders, totalSpend, lastOrderAt, crm } = item;
    const tags    = crm?.tags || [];
    const loyalty = crm?.loyaltyPoints || 0;
    const initials = (customer?.name || "?").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

    return (
      <Pressable
        style={styles.card}
        onPress={() => navigation.navigate("TailorCRMDetail", { customerId: customer._id, customerName: customer.name })}
      >
        <View style={styles.cardLeft}>
          {customer?.avatarUrl ? (
            <Image source={{ uri: customer.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
          )}
          {crm?.isFlagged && (
            <View style={styles.flagDot}>
              <Ionicons name="flag" size={10} color="#fff" />
            </View>
          )}
        </View>

        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <Text style={styles.customerName}>{customer?.name || "Unknown"}</Text>
            {loyalty > 0 && (
              <View style={styles.loyaltyBadge}>
                <Ionicons name="star" size={10} color="#f59e0b" />
                <Text style={styles.loyaltyText}>{loyalty} pts</Text>
              </View>
            )}
          </View>

          <Text style={styles.customerPhone}>{customer?.phone || customer?.email || "—"}</Text>

          {tags.length > 0 && (
            <View style={styles.tagsRow}>
              {tags.map(tag => {
                const c = TAG_COLORS[tag] || { bg: "#f1f5f9", text: "#475569" };
                return (
                  <View key={tag} style={[styles.tag, { backgroundColor: c.bg }]}>
                    <Text style={[styles.tagText, { color: c.text }]}>{tag}</Text>
                  </View>
                );
              })}
            </View>
          )}

          <View style={styles.statsRow}>
            <View style={styles.statChip}>
              <Ionicons name="bag-handle-outline" size={12} color="#6d28d9" />
              <Text style={styles.statChipText}>{totalOrders} orders</Text>
            </View>
            <View style={styles.statChip}>
              <Ionicons name="cash-outline" size={12} color="#059669" />
              <Text style={styles.statChipText}>₹{totalSpend.toLocaleString()}</Text>
            </View>
            {lastOrderAt && (
              <View style={styles.statChip}>
                <Ionicons name="time-outline" size={12} color="#94a3b8" />
                <Text style={[styles.statChipText, { color: "#94a3b8" }]}>
                  {new Date(lastOrderAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </Text>
              </View>
            )}
          </View>
        </View>

        <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLabel}>Customer CRM</Text>
          <Text style={styles.headerCount}>{customers.length} Customers</Text>
        </View>
        <Pressable style={styles.addBtn} onPress={() => {}}>
          <Ionicons name="person-add-outline" size={20} color="#6d28d9" />
        </Pressable>
      </View>

      {/* Search */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or phone..."
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={18} color="#94a3b8" />
          </Pressable>
        )}
      </View>

      {/* Sort Pills */}
      <View style={styles.sortRow}>
        {[
          { key: "recent", label: "Recent" },
          { key: "spend",  label: "Top Spenders" },
          { key: "orders", label: "Most Orders" },
        ].map(s => (
          <Pressable
            key={s.key}
            style={[styles.sortPill, sortBy === s.key && styles.sortPillActive]}
            onPress={() => setSortBy(s.key)}
          >
            <Text style={[styles.sortText, sortBy === s.key && styles.sortTextActive]}>{s.label}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#6d28d9" />
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={item => item.customer._id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6d28d9" />}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="people-outline" size={44} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No customers yet</Text>
              <Text style={styles.emptyDesc}>Customers who place orders will appear here.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: "#f8fafc" },
  centered:         { flex: 1, justifyContent: "center", alignItems: "center" },

  header:           { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 14, backgroundColor: "#f8fafc" },
  headerLabel:      { fontSize: 12, fontWeight: "700", color: "#6d28d9", textTransform: "uppercase", letterSpacing: 1 },
  headerCount:      { fontSize: 24, fontWeight: "900", color: "#0f172a" },
  addBtn:           { width: 44, height: 44, borderRadius: 22, backgroundColor: "#ede9fe", justifyContent: "center", alignItems: "center" },

  searchBox:        { flexDirection: "row", alignItems: "center", backgroundColor: "#ffffff", marginHorizontal: 20, paddingHorizontal: 14, height: 48, borderRadius: 14, borderWidth: 1, borderColor: "#e2e8f0", marginBottom: 14 },
  searchInput:      { flex: 1, marginLeft: 10, fontSize: 15, color: "#0f172a" },

  sortRow:          { flexDirection: "row", paddingHorizontal: 20, gap: 10, marginBottom: 16 },
  sortPill:         { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#e2e8f0" },
  sortPillActive:   { backgroundColor: "#0f172a", borderColor: "#0f172a" },
  sortText:         { fontSize: 13, fontWeight: "600", color: "#64748b" },
  sortTextActive:   { color: "#ffffff" },

  list:             { paddingHorizontal: 16, paddingBottom: 40 },
  card:             { flexDirection: "row", alignItems: "center", backgroundColor: "#ffffff", padding: 14, borderRadius: 18, marginBottom: 12, borderWidth: 1, borderColor: "#f1f5f9", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },

  cardLeft:         { position: "relative", marginRight: 14 },
  avatar:           { width: 52, height: 52, borderRadius: 26, backgroundColor: "#e2e8f0" },
  avatarFallback:   { width: 52, height: 52, borderRadius: 26, backgroundColor: "#ede9fe", justifyContent: "center", alignItems: "center" },
  avatarInitials:   { fontSize: 18, fontWeight: "800", color: "#6d28d9" },
  flagDot:          { position: "absolute", bottom: 0, right: 0, width: 18, height: 18, borderRadius: 9, backgroundColor: "#ef4444", justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#fff" },

  cardBody:         { flex: 1 },
  cardTop:          { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3 },
  customerName:     { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  loyaltyBadge:     { flexDirection: "row", alignItems: "center", backgroundColor: "#fef3c7", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100, gap: 3 },
  loyaltyText:      { fontSize: 11, fontWeight: "700", color: "#92400e" },
  customerPhone:    { fontSize: 13, color: "#64748b", marginBottom: 8 },

  tagsRow:          { flexDirection: "row", gap: 6, marginBottom: 10, flexWrap: "wrap" },
  tag:              { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  tagText:          { fontSize: 11, fontWeight: "700" },

  statsRow:         { flexDirection: "row", gap: 8 },
  statChip:         { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#f8fafc", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statChipText:     { fontSize: 12, fontWeight: "600", color: "#334155" },

  emptyBox:         { paddingVertical: 60, alignItems: "center" },
  emptyTitle:       { fontSize: 17, fontWeight: "700", color: "#64748b", marginTop: 12 },
  emptyDesc:        { fontSize: 13, color: "#94a3b8", marginTop: 6, textAlign: "center" },
});
