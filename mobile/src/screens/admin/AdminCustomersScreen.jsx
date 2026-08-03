import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator, RefreshControl, Image, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../api/client";
import { useFocusEffect } from "@react-navigation/native";

export function AdminCustomersScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/admin-panel/customers");
      setCustomers(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = () => { setRefreshing(true); load(); };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Image source={{ uri: item.avatarUrl || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100" }} style={styles.avatar} />
        <View style={styles.cardInfo}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.sub}>{item.email} • {item.phone || "No Phone"}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </Pressable>
        <Text style={styles.title}>Customer Mgmt</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} size="large" color="#0f172a" />
      ) : (
        <FlatList
          data={customers}
          keyExtractor={i => i._id || Math.random().toString()}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyText}>No customers loaded yet.</Text>
              <Text style={styles.emptySub}>Connect API to view all platform users.</Text>
            </View>
          }
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
  
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#e2e8f0" },
  cardHeader: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12, backgroundColor: "#e2e8f0" },
  cardInfo: { flex: 1 },
  name: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  sub: { fontSize: 12, color: "#64748b", marginTop: 4 },

  empty: { flex: 1, justifyContent: "center", alignItems: "center", marginTop: 100 },
  emptyText: { fontSize: 16, fontWeight: "700", color: "#475569", marginTop: 16 },
  emptySub: { fontSize: 13, color: "#94a3b8", marginTop: 4 },
});
