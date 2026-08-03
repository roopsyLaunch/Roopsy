import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

const CUSTOMER_FEATURES = [
  {
    id: "c1",
    title: "AI Style Try-On & Smart Recommendations",
    subtitle: "Preview haircuts, beard trims & custom tailored outfit fittings using AI camera before booking.",
    icon: "camera-outline",
    color: "#8b5cf6",
    bgColor: "#f3e8ff",
    badge: "AI FEATURE",
    eta: "Next Update 🚀"
  },
  {
    id: "c2",
    title: "Doorstep Luxury Spa & Bridal Packages",
    subtitle: "Book premium home wellness massages, organic facials, and complete bridal makeup artists.",
    icon: "sparkles-outline",
    color: "#ec4899",
    bgColor: "#fce7f3",
    badge: "WELLNESS",
    eta: "Q4 2026"
  },
  {
    id: "c3",
    title: "Live GPS Partner Tracking",
    subtitle: "Track your assigned barber or tailor on a live map in real-time when they travel to your home.",
    icon: "location-outline",
    color: "#0284c7",
    bgColor: "#e0f2fe",
    badge: "LIVE TRACKING",
    eta: "Coming Soon"
  },
  {
    id: "c4",
    title: "Loyalty Cashbacks & Reward Store",
    subtitle: "Earn points on every salon appointment & stitching order to redeem free haircuts & discount vouchers.",
    icon: "gift-outline",
    color: "#16a34a",
    bgColor: "#dcfce7",
    badge: "REWARDS",
    eta: "Coming Soon"
  }
];

const PARTNER_FEATURES = [
  {
    id: "p1",
    title: "AI Smart Stock & Inventory Predictor",
    subtitle: "Automated alerts & predictions when fabric meters, hair products, or dyes are running low.",
    icon: "analytics-outline",
    color: "#d97706",
    bgColor: "#fef3c7",
    badge: "ERP PRO",
    eta: "Q4 2026"
  },
  {
    id: "p2",
    title: "Automated WhatsApp Client Marketing",
    subtitle: "Send automated appointment reminders, festive discounts & review requests directly to clients.",
    icon: "chatbubbles-outline",
    color: "#25d366",
    bgColor: "#dcfce7",
    badge: "MARKETING",
    eta: "Next Update 🚀"
  },
  {
    id: "p3",
    title: "Instant 1-Click Earnings Payouts",
    subtitle: "Withdraw daily salon & tailoring earnings directly to bank accounts within 5 seconds via UPI.",
    icon: "wallet-outline",
    color: "#0f172a",
    bgColor: "#f1f5f9",
    badge: "FINANCE",
    eta: "Coming Soon"
  },
  {
    id: "p4",
    title: "Multi-Branch & Staff Shift Manager",
    subtitle: "Manage multiple salon locations, seat rosters, and tailor master staff shifts from one screen.",
    icon: "business-outline",
    color: "#6d28d9",
    bgColor: "#ede9fe",
    badge: "ENTERPRISE",
    eta: "Coming Soon"
  }
];

export function ComingSoonScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState("all"); // "all", "customer", "partner"

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
      {/* Top Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#0f172a" />
        </Pressable>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerSub}>UPCOMING ROADMAP</Text>
          <Text style={styles.headerTitle}>More Services & Features</Text>
        </View>
        <View style={styles.rocketBadge}>
          <Ionicons name="rocket-outline" size={20} color="#7c3aed" />
        </View>
      </View>

      {/* Hero Banner */}
      <View style={styles.heroCard}>
        <View style={styles.heroTextSection}>
          <View style={styles.heroBadge}>
            <Ionicons name="sparkles" size={12} color="#f59e0b" style={{ marginRight: 4 }} />
            <Text style={styles.heroBadgeText}>OFFICIAL FEATURE ROADMAP</Text>
          </View>
          <Text style={styles.heroTitle}>Something Big is Coming! 🚀</Text>
          <Text style={styles.heroSub}>
            We are working on next-gen features for Customers & Partners. Check out what's arriving in upcoming app updates!
          </Text>
        </View>
      </View>

      {/* Segment Selector Chips */}
      <View style={styles.tabBar}>
        {[
          { key: "all", label: "All Previews 🌟" },
          { key: "customer", label: "For Customers ✨" },
          { key: "partner", label: "For Partners 💼" },
        ].map(tab => (
          <Pressable
            key={tab.key}
            style={[styles.tabBtn, activeTab === tab.key && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabBtnText, activeTab === tab.key && styles.tabBtnTextActive]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Feature List (Read-Only) */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Customer Section */}
        {(activeTab === "all" || activeTab === "customer") && (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="person" size={18} color="#7c3aed" />
              <Text style={styles.sectionTitle}>Customer Features</Text>
            </View>

            {CUSTOMER_FEATURES.map(item => (
              <View key={item.id} style={styles.featureCard}>
                <View style={[styles.iconBox, { backgroundColor: item.bgColor }]}>
                  <Ionicons name={item.icon} size={24} color={item.color} />
                </View>
                <View style={styles.featureBody}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.featureTitle}>{item.title}</Text>
                    <View style={[styles.badgePill, { backgroundColor: item.bgColor }]}>
                      <Text style={[styles.badgeText, { color: item.color }]}>{item.badge}</Text>
                    </View>
                  </View>
                  <Text style={styles.featureSub}>{item.subtitle}</Text>
                  <View style={styles.cardFooterRow}>
                    <Ionicons name="time-outline" size={14} color="#64748b" style={{ marginRight: 4 }} />
                    <Text style={styles.etaText}>{item.eta}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Partner Section */}
        {(activeTab === "all" || activeTab === "partner") && (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="briefcase" size={18} color="#0d9488" />
              <Text style={styles.sectionTitle}>Partner & Shop Features</Text>
            </View>

            {PARTNER_FEATURES.map(item => (
              <View key={item.id} style={styles.featureCard}>
                <View style={[styles.iconBox, { backgroundColor: item.bgColor }]}>
                  <Ionicons name={item.icon} size={24} color={item.color} />
                </View>
                <View style={styles.featureBody}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.featureTitle}>{item.title}</Text>
                    <View style={[styles.badgePill, { backgroundColor: item.bgColor }]}>
                      <Text style={[styles.badgeText, { color: item.color }]}>{item.badge}</Text>
                    </View>
                  </View>
                  <Text style={styles.featureSub}>{item.subtitle}</Text>
                  <View style={styles.cardFooterRow}>
                    <Ionicons name="time-outline" size={14} color="#64748b" style={{ marginRight: 4 }} />
                    <Text style={styles.etaText}>{item.eta}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Read Only Disclaimer Card */}
        <View style={styles.disclaimerCard}>
          <Ionicons name="information-circle" size={20} color="#64748b" style={{ marginRight: 10 }} />
          <Text style={styles.disclaimerText}>
            📌 Note: These upcoming features are read-only previews of our official roadmap. They will be automatically enabled in future app updates!
          </Text>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#ffffff", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#e2e8f0" },
  headerTitleContainer: { flex: 1, marginLeft: 12 },
  headerSub: { fontSize: 11, fontWeight: "800", color: "#7c3aed", letterSpacing: 1 },
  headerTitle: { fontSize: 18, fontWeight: "900", color: "#0f172a" },
  rocketBadge: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#f3e8ff", justifyContent: "center", alignItems: "center" },

  heroCard: { backgroundColor: "#0f172a", marginHorizontal: 20, borderRadius: 20, padding: 20, marginBottom: 16 },
  heroBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.1)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, alignSelf: "flex-start", marginBottom: 10 },
  heroBadgeText: { color: "#f59e0b", fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  heroTitle: { fontSize: 20, fontWeight: "900", color: "#ffffff", marginBottom: 6 },
  heroSub: { fontSize: 13, color: "#94a3b8", lineHeight: 18 },

  tabBar: { flexDirection: "row", paddingHorizontal: 20, gap: 8, marginBottom: 14 },
  tabBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#e2e8f0" },
  tabBtnActive: { backgroundColor: "#7c3aed", borderColor: "#7c3aed" },
  tabBtnText: { fontSize: 13, fontWeight: "700", color: "#64748b" },
  tabBtnTextActive: { color: "#ffffff" },

  scrollContent: { paddingHorizontal: 20, paddingBottom: 60 },
  sectionBlock: { marginBottom: 20 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: "#0f172a" },

  featureCard: { flexDirection: "row", backgroundColor: "#ffffff", borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "#e2e8f0" },
  iconBox: { width: 48, height: 48, borderRadius: 14, justifyContent: "center", alignItems: "center", marginRight: 12 },
  featureBody: { flex: 1 },
  cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 },
  featureTitle: { fontSize: 14, fontWeight: "800", color: "#0f172a", flex: 1, marginRight: 8 },
  badgePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 9, fontWeight: "900" },
  featureSub: { fontSize: 12, color: "#64748b", lineHeight: 17, marginBottom: 8 },
  cardFooterRow: { flexDirection: "row", alignItems: "center" },
  etaText: { fontSize: 11, fontWeight: "700", color: "#6d28d9" },

  disclaimerCard: { flexDirection: "row", backgroundColor: "#f1f5f9", padding: 14, borderRadius: 14, borderWidth: 1, borderColor: "#cbd5e1", alignItems: "center", marginTop: 8 },
  disclaimerText: { fontSize: 12, color: "#475569", flex: 1, lineHeight: 17, fontWeight: "500" }
});
