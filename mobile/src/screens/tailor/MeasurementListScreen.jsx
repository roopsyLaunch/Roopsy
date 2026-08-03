import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../api/client";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function MeasurementListScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchProfiles = useCallback(async () => {
    try {
      const res = await api.get("/measurements");
      setProfiles(res.data.profiles || []);
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to load measurement profiles");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchProfiles();
    }, [fetchProfiles])
  );

  const handleDelete = (id) => {
    Alert.alert("Delete Profile", "Are you sure you want to delete this profile?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
          try {
            await api.delete(`/measurements/${id}`);
            setProfiles(prev => prev.filter(p => p._id !== id));
          } catch (err) {
            console.error(err);
            Alert.alert("Error", "Failed to delete profile");
          }
        } 
      }
    ]);
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color="#0f172a" />
      </Pressable>
      <Text style={styles.headerTitle}>My Measurements</Text>
      <View style={{ width: 44 }} />
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 20) }]}>
      {renderHeader()}
      
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#6d28d9" />
        </View>
      ) : (
        <FlatList
          data={profiles}
          keyExtractor={item => item._id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardInfo}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.profileName}>{item.profileName}</Text>
                  <View style={styles.genderBadge}>
                    <Text style={styles.genderText}>{item.gender}</Text>
                  </View>
                </View>
                
                <Text style={styles.detailText}>
                  {item.measurementType === "standard" 
                    ? `Standard Size: ${item.standardSize}` 
                    : `Custom Measurements (${item.unit})`}
                </Text>
              </View>
              
              <View style={styles.actionRow}>
                <Pressable style={styles.iconBtn} onPress={() => navigation.navigate("MeasurementForm", { profile: item })}>
                  <Ionicons name="pencil" size={20} color="#3b82f6" />
                </Pressable>
                <Pressable style={styles.iconBtn} onPress={() => handleDelete(item._id)}>
                  <Ionicons name="trash" size={20} color="#ef4444" />
                </Pressable>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="body-outline" size={64} color="#cbd5e1" style={{ marginBottom: 16 }} />
              <Text style={styles.emptyTitle}>No Profiles Found</Text>
              <Text style={styles.emptyText}>Add your measurements so you don't have to enter them every time you order.</Text>
            </View>
          }
        />
      )}

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <Pressable 
          style={styles.addBtn}
          onPress={() => navigation.navigate("MeasurementForm")}
        >
          <Ionicons name="add" size={20} color="#ffffff" style={{ marginRight: 8 }} />
          <Text style={styles.addBtnText}>Add New Profile</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 16, backgroundColor: "#f8fafc" },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#ffffff", justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  headerTitle: { fontSize: 20, fontWeight: "900", color: "#0f172a" },
  
  listContent: { padding: 20, paddingBottom: 100 },
  card: { backgroundColor: "#ffffff", padding: 16, borderRadius: 16, marginBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: "#e2e8f0", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 6, elevation: 2 },
  cardInfo: { flex: 1 },
  cardHeaderRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  profileName: { fontSize: 16, fontWeight: "800", color: "#0f172a", marginRight: 10 },
  genderBadge: { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: "#f1f5f9", borderRadius: 8 },
  genderText: { fontSize: 10, fontWeight: "700", color: "#475569", textTransform: "uppercase" },
  detailText: { fontSize: 13, color: "#64748b", fontWeight: "500" },
  
  actionRow: { flexDirection: "row", gap: 12 },
  iconBtn: { padding: 8, backgroundColor: "#f8fafc", borderRadius: 8 },

  emptyContainer: { alignItems: "center", justifyContent: "center", paddingVertical: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: "#334155" },
  emptyText: { fontSize: 14, color: "#64748b", textAlign: "center", marginTop: 8, lineHeight: 22 },

  bottomBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#ffffff", paddingHorizontal: 24, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: "#f1f5f9",
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 10,
  },
  addBtn: { backgroundColor: "#6d28d9", height: 56, borderRadius: 16, flexDirection: "row", justifyContent: "center", alignItems: "center" },
  addBtnText: { color: "#ffffff", fontSize: 16, fontWeight: "700" }
});
