import React, { useCallback, useState, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

export function AdminApprovalsScreen() {
  const { refreshMe } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await api.get("/admin/barbers/pending");
    setItems(res.data.requests || []);
  }, []);

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await load();
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  async function decide(id, status) {
    try {
      const body = { status };
      if (status === "rejected") {
        body.rejectionReason = "Documents incomplete — please re-upload";
      }
      await api.patch(`/admin/barbers/${id}/decision`, body);
      await load();
      await refreshMe();
      Alert.alert("Done", status === "approved" ? "Barber approved" : "Barber rejected");
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.error || e.message);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#e11d48" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Pending shops</Text>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e11d48" />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.shop}>{item.shopName}</Text>
            <Text style={styles.meta}>
              {item.user?.name} · {item.user?.email}
            </Text>
            <Text style={styles.meta}>
              {item.address?.line1}, {item.address?.city} {item.address?.pincode}
            </Text>
            <Text style={styles.meta}>Aadhaar (last 4): {item.aadhaarLast4 || "—"}</Text>
            <Text style={styles.meta}>UPI: {item.bank?.upiId || "—"}</Text>
            <View style={styles.row}>
              <Pressable style={[styles.approve, styles.rowBtn]} onPress={() => decide(item.id, "approved")}>
                <Text style={styles.approveText}>Approve</Text>
              </Pressable>
              <Pressable style={[styles.reject, styles.rowBtn]} onPress={() => decide(item.id, "rejected")}>
                <Text style={styles.rejectText}>Reject</Text>
              </Pressable>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No pending applications.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f10", padding: 16 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0f0f10" },
  heading: { fontSize: 22, fontWeight: "700", color: "#fafafa", marginBottom: 12 },
  card: {
    backgroundColor: "#18181b",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#27272a",
  },
  shop: { fontSize: 18, fontWeight: "600", color: "#f5f5f5" },
  meta: { color: "#a3a3a3", marginTop: 6 },
  row: { flexDirection: "row", marginTop: 14 },
  rowBtn: { marginRight: 12 },
  approve: { backgroundColor: "#14532d", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  approveText: { color: "#bbf7d0", fontWeight: "700" },
  reject: { backgroundColor: "#450a0a", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  rejectText: { color: "#fecaca", fontWeight: "700" },
  empty: { color: "#71717a", textAlign: "center", marginTop: 24 },
});
