import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

const CATEGORIES = [
  { id: "Barber Shop", title: "Barber Shop", sub: "Haircut, Beard, Shaving & more", icon: "cut", color: "#6d28d9", bg: "#f3e8ff" },
  { id: "Beauty Parlor", title: "Beauty Parlour", sub: "Hair, Makeup, Facial, Nails & more", icon: "sparkles", color: "#be185d", bg: "#fce7f3" },
  { id: "Stitching Center", title: "Stitching (Tailor)", sub: "Tailoring, Alteration, Custom Stitching", icon: "shirt", color: "#047857", bg: "#d1fae5" },
];

export function PartnerCategoryScreen({ navigation, route }) {
  const [selected, setSelected] = useState(route.params?.registrationData?.category || "Barber Shop");

  const onContinue = () => {
    navigation.navigate("PartnerBasicInfo", {
      registrationData: { ...(route.params?.registrationData || {}), category: selected }
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </Pressable>
        <Text style={styles.headerTitle}>Select Business Category</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.subtitle}>Choose the category that best describes your business</Text>

        {CATEGORIES.map((cat) => (
          <Pressable 
            key={cat.id}
            style={[styles.card, selected === cat.id && styles.cardSelected]}
            onPress={() => setSelected(cat.id)}
          >
            <View style={[styles.iconBox, { backgroundColor: cat.bg }]}>
              <Ionicons name={cat.icon} size={24} color={cat.color} />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.cardTitle}>{cat.title}</Text>
              <Text style={styles.cardSub}>{cat.sub}</Text>
            </View>
            <View style={styles.radio}>
              {selected === cat.id && <View style={styles.radioInner} />}
            </View>
          </Pressable>
        ))}

        <Pressable style={styles.btn} onPress={onContinue}>
          <Text style={styles.btnText}>Continue</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#ffffff" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 16, fontWeight: "700" },
  container: { padding: 24 },
  subtitle: { fontSize: 14, color: "#64748b", marginBottom: 24, textAlign: "center" },
  card: { flexDirection: "row", alignItems: "center", padding: 16, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 12, marginBottom: 12 },
  cardSelected: { borderColor: "#6d28d9", backgroundColor: "#faf5ff" },
  iconBox: { width: 48, height: 48, borderRadius: 24, justifyContent: "center", alignItems: "center", marginRight: 16 },
  textContainer: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  cardSub: { fontSize: 12, color: "#64748b", marginTop: 2 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: "#cbd5e1", justifyContent: "center", alignItems: "center" },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#6d28d9" },
  btn: { backgroundColor: "#6d28d9", padding: 16, borderRadius: 12, alignItems: "center", marginTop: 20, marginBottom: 40 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
