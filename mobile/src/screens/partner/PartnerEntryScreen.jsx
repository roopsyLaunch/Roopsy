import React from "react";
import { View, Text, StyleSheet, Pressable, Image, ScrollView, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");

export function PartnerEntryScreen({ navigation }) {
  const features = [
    {
      icon: "trending-up-outline",
      title: "Boost Revenue",
      desc: "Get bookings from local customers instantly.",
      color: "#8b5cf6",
      bg: "#f5f3ff",
    },
    {
      icon: "calendar-outline",
      title: "Smart Calendar",
      desc: "Manage slots, bookings, and seat rosters.",
      color: "#3b82f6",
      bg: "#eff6ff",
    },
    {
      icon: "people-outline",
      title: "Customer CRM",
      desc: "Keep records, measurements & direct chat.",
      color: "#10b981",
      bg: "#ecfdf5",
    },
    {
      icon: "shield-checkmark-outline",
      title: "Verified System",
      desc: "4-digit OTP system to prevent false bookings.",
      color: "#f59e0b",
      bg: "#fffbeb",
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#1e293b" />
          </Pressable>
          <Text style={styles.headerTitle}>Partner Program</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Hero Card */}
        <View style={styles.heroCard}>
          <Image
            source={{
              uri: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=500&auto=format&fit=crop&q=80",
            }}
            style={styles.heroImage}
          />
          <LinearGradient
            colors={["transparent", "rgba(15, 23, 42, 0.9)"]}
            style={styles.heroOverlay}
          >
            <Text style={styles.heroBadge}>BARBER • SALON • TAILOR</Text>
            <Text style={styles.heroTitle}>Grow Your Business{"\n"}Digital & Seamless</Text>
          </LinearGradient>
        </View>

        {/* Introduction */}
        <View style={styles.introSection}>
          <Text style={styles.sectionLabel}>WHY PARTNER WITH US</Text>
          <Text style={styles.sectionTitle}>Built for Beauty & Stitching Salons</Text>
          <Text style={styles.sectionDesc}>
            Digitize your shop presence. Streamline appointment bookings, customer sizes, seat queues, and track analytics from one dashboard.
          </Text>
        </View>

        {/* Grid Features */}
        <View style={styles.gridContainer}>
          {features.map((item, index) => (
            <View key={index} style={styles.gridItem}>
              <View style={[styles.iconCircle, { backgroundColor: item.bg }]}>
                <Ionicons name={item.icon} size={22} color={item.color} />
              </View>
              <Text style={styles.gridItemTitle}>{item.title}</Text>
              <Text style={styles.gridItemDesc}>{item.desc}</Text>
            </View>
          ))}
        </View>

        {/* CTA Button */}
        <View style={styles.ctaContainer}>
          <Pressable
            style={styles.buttonTouchable}
            onPress={() => navigation.navigate("PartnerCategory")}
          >
            <LinearGradient
              colors={["#7c3aed", "#6d28d9"]}
              style={styles.btnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.btnText}>Register Your Business</Text>
              <Ionicons name="arrow-forward" size={18} color="#ffffff" style={{ marginLeft: 8 }} />
            </LinearGradient>
          </Pressable>
          <Text style={styles.helperText}>Takes less than 3 minutes to set up your shop profile</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  backBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "#f8fafc",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: 0.3,
  },
  heroCard: {
    margin: 20,
    height: 220,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#1e1b4b",
    elevation: 8,
    shadowColor: "#7c3aed",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  heroImage: {
    width: "100%",
    height: "100%",
    position: "absolute",
    opacity: 0.85,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    padding: 20,
  },
  heroBadge: {
    fontSize: 10,
    fontWeight: "800",
    color: "#a78bfa",
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#ffffff",
    lineHeight: 28,
  },
  introSection: {
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#7c3aed",
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 8,
  },
  sectionDesc: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 18,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    justifyContent: "space-between",
    marginBottom: 20,
  },
  gridItem: {
    width: (width - 48) / 2,
    backgroundColor: "#f8fafc",
    padding: 16,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  gridItemTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 4,
  },
  gridItemDesc: {
    fontSize: 11,
    color: "#64748b",
    lineHeight: 15,
  },
  ctaContainer: {
    paddingHorizontal: 24,
    alignItems: "center",
    marginTop: 10,
  },
  buttonTouchable: {
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#7c3aed",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  btnGradient: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 16,
  },
  btnText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 15,
  },
  helperText: {
    fontSize: 11.5,
    color: "#94a3b8",
    marginTop: 10,
  },
});
