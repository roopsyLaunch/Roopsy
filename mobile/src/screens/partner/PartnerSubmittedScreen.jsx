import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, Image, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";

export function PartnerSubmittedScreen({ navigation }) {
  const { refreshMe } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleFinish = async () => {
    setLoading(true);
    await refreshMe();
    setLoading(false);
  };
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        
        <View style={styles.content}>
          <View style={styles.imageContainer}>
            <Image 
              source={{ uri: "https://cdn-icons-png.flaticon.com/512/3281/3281323.png" }} 
              style={styles.image} 
            />
            <View style={styles.clockBadge}>
              <Ionicons name="time" size={24} color="#6d28d9" />
            </View>
          </View>
          
          <Text style={styles.title}>Application Submitted!</Text>
          <Text style={styles.subtitle}>
            Your application is under review. We will notify you once it's approved.
          </Text>

          <View style={styles.statusBox}>
            <View style={styles.statusIconBox}>
              <Ionicons name="time-outline" size={20} color="#b45309" />
            </View>
            <View>
              <Text style={styles.statusLabel}>Status</Text>
              <Text style={styles.statusVal}>Pending Review</Text>
            </View>
          </View>
        </View>

        <Pressable 
          style={styles.btn} 
          onPress={handleFinish}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Back to Home</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#ffffff" },
  container: { flex: 1, padding: 24, justifyContent: "space-between" },
  content: { flex: 1, justifyContent: "center", alignItems: "center" },
  imageContainer: { position: "relative", marginBottom: 30, backgroundColor: "#f3e8ff", width: 140, height: 140, borderRadius: 70, justifyContent: "center", alignItems: "center" },
  image: { width: 80, height: 80 },
  clockBadge: { position: "absolute", bottom: -10, right: -10, backgroundColor: "#fff", width: 48, height: 48, borderRadius: 24, justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 4 },
  title: { fontSize: 24, fontWeight: "800", color: "#0f172a", marginBottom: 12, textAlign: "center" },
  subtitle: { fontSize: 14, color: "#64748b", textAlign: "center", paddingHorizontal: 20, lineHeight: 22, marginBottom: 40 },
  statusBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#fef3c7", padding: 16, borderRadius: 12, width: "100%", borderWidth: 1, borderColor: "#fde68a" },
  statusIconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#fff", justifyContent: "center", alignItems: "center", marginRight: 12 },
  statusLabel: { fontSize: 12, color: "#b45309", marginBottom: 2 },
  statusVal: { fontSize: 14, fontWeight: "700", color: "#b45309" },
  btn: { backgroundColor: "#6d28d9", padding: 16, borderRadius: 12, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
