import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator, RefreshControl, Image, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../api/client";
import { useFocusEffect } from "@react-navigation/native";

export function AdminPartnersScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [tailors, setTailors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("pending"); // pending, active, all

  const load = useCallback(async () => {
    try {
      const res = await api.get("/admin-panel/tailors");
      setTailors(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  const updateStatus = async (id, isVerified, isActive) => {
    try {
      await api.patch(`/admin-panel/tailors/${id}`, { isVerified, isActive });
      load();
    } catch (err) { Alert.alert("Error", "Failed to update status"); }
  };

  const filteredTailors = tailors.filter(t => {
    if (filter === "pending") return !t.isVerified;
    if (filter === "active") return t.isVerified && t.isActive;
    return true; // all
  });

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Image source={{ uri: item.shopPosterUrl || "https://images.unsplash.com/photo-1598522325754-046dd13ac1c0?w=100" }} style={styles.avatar} />
        <View style={styles.cardInfo}>
          <Text style={styles.shopName}>{item.shopName}</Text>
          <Text style={styles.ownerName}>{item.ownerName} • {item.userId?.phone || "No Phone"}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: item.isVerified ? "#d1fae5" : "#fef3c7" }]}>
          <Text style={[styles.statusText, { color: item.isVerified ? "#059669" : "#b45309" }]}>
            {item.isVerified ? "VERIFIED" : "PENDING"}
          </Text>
        </View>
      </View>

      <View style={styles.cardActions}>
        {!item.isVerified && (
          <Pressable style={[styles.actionBtn, { backgroundColor: "#059669" }]} onPress={() => updateStatus(item._id, true, true)}>
            <Ionicons name="checkmark-circle" size={16} color="#fff" />
            <Text style={styles.actionBtnText}>Approve</Text>
          </Pressable>
        )}
        {item.isVerified && (
          <Pressable 
            style={[styles.actionBtn, { backgroundColor: item.isActive ? "#ef4444" : "#6d28d9" }]} 
            onPress={() => updateStatus(item._id, true, !item.isActive)}
          >
            <Ionicons name={item.isActive ? "ban" : "play"} size={16} color="#fff" />
            <Text style={styles.actionBtnText}>{item.isActive ? "Suspend" : "Activate"}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </Pressable>
        <Text style={styles.title}>Partner Mgmt</Text>
      </View>

      <View style={styles.filterRow}>
        {["pending", "active", "all"].map(f => (
          <Pressable key={f} style={[styles.filterPill, filter === f && styles.filterPillActive]} onPress={() => setFilter(f)}>
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} size="large" color="#0f172a" />
      ) : (
        <FlatList
          data={filteredTailors}
          keyExtractor={i => i._id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={renderItem}
          ListEmptyComponent={<Text style={styles.emptyText}>No partners found.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 16 },
  backBtn: { marginRight: 12 },
  title: { fontSize: 20, fontWeight: "900", color: "#0f172a" },
  
  filterRow: { flexDirection: "row", gap: 10, paddingHorizontal: 16, marginBottom: 16 },
  filterPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100, backgroundColor: "#e2e8f0" },
  filterPillActive: { backgroundColor: "#0f172a" },
  filterText: { fontSize: 13, fontWeight: "600", color: "#64748b" },
  filterTextActive: { color: "#ffffff" },

  list: { paddingHorizontal: 16, paddingBottom: 40 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#e2e8f0" },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 16 },
  avatar: { width: 50, height: 50, borderRadius: 12, marginRight: 12 },
  cardInfo: { flex: 1 },
  shopName: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  ownerName: { fontSize: 12, color: "#64748b", marginTop: 4 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: "800" },

  cardActions: { flexDirection: "row", gap: 10 },
  actionBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, gap: 6 },
  actionBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  emptyText: { textAlign: "center", color: "#64748b", marginTop: 40 }
});
