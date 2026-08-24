import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";

const { width } = Dimensions.get("window");

export function UserGuideScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  
  // Default tab can be passed via route params or default to "customer"
  const [activeTab, setActiveTab] = useState(route?.params?.defaultTab || "customer"); // "customer", "barber", "tailor", "beauty"

  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
      <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color="#0f172a" />
      </Pressable>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.headerTitle}>App Guide & How To Use 📘</Text>
        <Text style={styles.headerSubtitle}>Learn how to book services or manage your shop</Text>
      </View>
    </View>
  );

  const renderTabs = () => (
    <View style={styles.tabContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
        <Pressable
          style={[styles.tabPill, activeTab === "customer" && styles.tabPillActiveCustomer]}
          onPress={() => setActiveTab("customer")}
        >
          <Ionicons name="person-circle" size={18} color={activeTab === "customer" ? "#ffffff" : "#64748b"} />
          <Text style={[styles.tabText, activeTab === "customer" && styles.tabTextActive]}>Customer</Text>
        </Pressable>

        <Pressable
          style={[styles.tabPill, activeTab === "barber" && styles.tabPillActiveBarber]}
          onPress={() => setActiveTab("barber")}
        >
          <Ionicons name="cut" size={18} color={activeTab === "barber" ? "#ffffff" : "#64748b"} />
          <Text style={[styles.tabText, activeTab === "barber" && styles.tabTextActive]}>Barber Partner</Text>
        </Pressable>

        <Pressable
          style={[styles.tabPill, activeTab === "tailor" && styles.tabPillActiveTailor]}
          onPress={() => setActiveTab("tailor")}
        >
          <Ionicons name="shirt" size={18} color={activeTab === "tailor" ? "#ffffff" : "#64748b"} />
          <Text style={[styles.tabText, activeTab === "tailor" && styles.tabTextActive]}>Tailor Partner</Text>
        </Pressable>

        <Pressable
          style={[styles.tabPill, activeTab === "beauty" && styles.tabPillActiveBeauty]}
          onPress={() => setActiveTab("beauty")}
        >
          <Ionicons name="sparkles" size={18} color={activeTab === "beauty" ? "#ffffff" : "#64748b"} />
          <Text style={[styles.tabText, activeTab === "beauty" && styles.tabTextActive]}>Beauty Partner</Text>
        </Pressable>
      </ScrollView>
    </View>
  );

  // --- TAB 1: CUSTOMER GUIDE ---
  const renderCustomerGuide = () => (
    <View style={styles.guideWrapper}>
      {/* Hero Banner */}
      <View style={[styles.heroCard, { backgroundColor: "#7c3aed" }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroBadge}>CUSTOMER GUIDE 👤</Text>
          <Text style={styles.heroTitle}>How to Book Services Easily</Text>
          <Text style={styles.heroDesc}>
            Book Barber, Tailor & Beauty Parlor services in just a few simple taps!
          </Text>
        </View>
        <Ionicons name="bag-handle" size={54} color="rgba(255,255,255,0.25)" />
      </View>

      {/* 💈 Barber Booking Steps */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIconBg, { backgroundColor: "#f3e8ff" }]}>
            <Ionicons name="cut" size={22} color="#7c3aed" />
          </View>
          <View>
            <Text style={styles.sectionTitle}>💈 Barber & Salon Booking</Text>
            <Text style={styles.sectionSubtitle}>Haircut, Beard Trim & Grooming</Text>
          </View>
        </View>

        <View style={styles.stepItem}>
          <View style={[styles.stepNum, { backgroundColor: "#7c3aed" }]}>
            <Text style={styles.stepNumText}>1</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Browse & Choose Service</Text>
            <Text style={styles.stepDesc}>
              Search nearby barber shops or explore popular salons. Select Haircut, Beard Trim, Facial, or Combo packages.
            </Text>
          </View>
        </View>

        <View style={styles.stepItem}>
          <View style={[styles.stepNum, { backgroundColor: "#7c3aed" }]}>
            <Text style={styles.stepNumText}>2</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Select Slot or Home Visit</Text>
            <Text style={styles.stepDesc}>
              Choose your preferred date and time slot for visiting the shop, or select Home Service for haircut at home.
            </Text>
          </View>
        </View>

        <View style={styles.stepItem}>
          <View style={[styles.stepNum, { backgroundColor: "#7c3aed" }]}>
            <Text style={styles.stepNumText}>3</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Show 4-Digit OTP on Arrival</Text>
            <Text style={styles.stepDesc}>
              Track live queue position on your dashboard. When arriving at shop, share your 4-digit OTP code with barber to start service.
            </Text>
          </View>
        </View>

        <Pressable 
          style={[styles.actionBtn, { backgroundColor: "#7c3aed" }]}
          onPress={() => navigation.navigate("Home", { screen: "BarberList" })}
        >
          <Ionicons name="search" size={16} color="#ffffff" style={{ marginRight: 6 }} />
          <Text style={styles.actionBtnText}>Book Barber Now</Text>
        </Pressable>
      </View>

      {/* ✂️ Tailor Booking Steps */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIconBg, { backgroundColor: "#f3e8ff" }]}>
            <Ionicons name="shirt" size={22} color="#6d28d9" />
          </View>
          <View>
            <Text style={styles.sectionTitle}>✂️ Custom Tailoring & Stitching</Text>
            <Text style={styles.sectionSubtitle}>Shop Visit or Home Measurement</Text>
          </View>
        </View>

        <View style={styles.stepItem}>
          <View style={[styles.stepNum, { backgroundColor: "#6d28d9" }]}>
            <Text style={styles.stepNumText}>1</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Choose Service & Mode</Text>
            <Text style={styles.stepDesc}>
              Select Stitching type (Suits, Shirts, Kurta, Dresses). Choose Visit Shop or Home Visit (tailor comes home for measurements).
            </Text>
          </View>
        </View>

        <View style={styles.stepItem}>
          <View style={[styles.stepNum, { backgroundColor: "#6d28d9" }]}>
            <Text style={styles.stepNumText}>2</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Select Fabric & Custom Designs</Text>
            <Text style={styles.stepDesc}>
              Use your own fabric or pick fabric from shop catalog. Customize collar, fit (slim/regular), pockets, and sleeves.
            </Text>
          </View>
        </View>

        <View style={styles.stepItem}>
          <View style={[styles.stepNum, { backgroundColor: "#6d28d9" }]}>
            <Text style={styles.stepNumText}>3</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Share Initial OTP with Tailor</Text>
            <Text style={styles.stepDesc}>
              Once tailor accepts booking, show your 4-digit Initial OTP to tailor partner to start the stitching pipeline.
            </Text>
          </View>
        </View>

        <View style={styles.stepItem}>
          <View style={[styles.stepNum, { backgroundColor: "#059669" }]}>
            <Text style={styles.stepNumText}>4</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Delivery OTP & Rate Service ⭐️</Text>
            <Text style={styles.stepDesc}>
              When outfit is ready, tailor generates Delivery OTP. Share Delivery OTP upon receiving outfit. You will get a prompt to rate your experience or rate later anytime from My Bookings!
            </Text>
          </View>
        </View>

        <Pressable 
          style={[styles.actionBtn, { backgroundColor: "#6d28d9" }]}
          onPress={() => navigation.navigate("Home", { screen: "TailorList" })}
        >
          <Ionicons name="cut" size={16} color="#ffffff" style={{ marginRight: 6 }} />
          <Text style={styles.actionBtnText}>Book Tailor Now</Text>
        </Pressable>
      </View>

      {/* 💄 Beauty Parlor Steps */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIconBg, { backgroundColor: "#fce7f3" }]}>
            <Ionicons name="sparkles" size={22} color="#be185d" />
          </View>
          <View>
            <Text style={styles.sectionTitle}>💄 Beauty Parlor Services</Text>
            <Text style={styles.sectionSubtitle}>Bridal, Makeup & Skincare</Text>
          </View>
        </View>

        <View style={styles.stepItem}>
          <View style={[styles.stepNum, { backgroundColor: "#be185d" }]}>
            <Text style={styles.stepNumText}>1</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Explore Beauty Parlors</Text>
            <Text style={styles.stepDesc}>
              Browse top beauty parlors nearby or request home makeup/beauty services.
            </Text>
          </View>
        </View>

        <View style={styles.stepItem}>
          <View style={[styles.stepNum, { backgroundColor: "#be185d" }]}>
            <Text style={styles.stepNumText}>2</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Select Services & Confirm Slot</Text>
            <Text style={styles.stepDesc}>
              Pick makeup, facial, hair styling, or bridal packages and confirm booking timing.
            </Text>
          </View>
        </View>

        <Pressable 
          style={[styles.actionBtn, { backgroundColor: "#be185d" }]}
          onPress={() => navigation.navigate("Home", { screen: "BeautyParlorList" })}
        >
          <Ionicons name="sparkles" size={16} color="#ffffff" style={{ marginRight: 6 }} />
          <Text style={styles.actionBtnText}>Book Beauty Parlor Now</Text>
        </Pressable>
      </View>
    </View>
  );

  // --- TAB 2: BARBER PARTNER GUIDE ---
  const renderBarberGuide = () => (
    <View style={styles.guideWrapper}>
      <View style={[styles.heroCard, { backgroundColor: "#2563eb" }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroBadge}>BARBER PARTNER GUIDE 💈</Text>
          <Text style={styles.heroTitle}>Grow Your Barber Shop Business</Text>
          <Text style={styles.heroDesc}>
            Manage online bookings, live queue, customer OTPs, and instant earnings!
          </Text>
        </View>
        <Ionicons name="storefront" size={54} color="rgba(255,255,255,0.25)" />
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>How Barber Partner Mode Works</Text>
        <Text style={styles.sectionSubtitle}>Simple 4-step partner workflow</Text>

        <View style={[styles.stepItem, { marginTop: 14 }]}>
          <View style={[styles.stepNum, { backgroundColor: "#2563eb" }]}>
            <Text style={styles.stepNumText}>1</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Register Your Shop Profile</Text>
            <Text style={styles.stepDesc}>
              Login with phone number -> Go to Profile -> Tap "Become a Partner". Fill shop name, mobile number, full address, working hours, and shop photos.
            </Text>
          </View>
        </View>

        <View style={styles.stepItem}>
          <View style={[styles.stepNum, { backgroundColor: "#2563eb" }]}>
            <Text style={styles.stepNumText}>2</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Add Services & Price List</Text>
            <Text style={styles.stepDesc}>
              Add services such as Men's Haircut, Beard Trim, Head Massage, Shaving, and Facials along with prices and estimated duration.
            </Text>
          </View>
        </View>

        <View style={styles.stepItem}>
          <View style={[styles.stepNum, { backgroundColor: "#2563eb" }]}>
            <Text style={styles.stepNumText}>3</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Receive Bookings & Live Queue</Text>
            <Text style={styles.stepDesc}>
              Customers book slots or join your live shop queue. You get instant app notifications for incoming appointments.
            </Text>
          </View>
        </View>

        <View style={styles.stepItem}>
          <View style={[styles.stepNum, { backgroundColor: "#16a34a" }]}>
            <Text style={styles.stepNumText}>4</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Verify Customer 4-Digit OTP</Text>
            <Text style={styles.stepDesc}>
              When customer arrives at your salon, tap "Verify OTP" on your dashboard and enter their 4-digit OTP to start service and mark completion.
            </Text>
          </View>
        </View>

        <Pressable 
          style={[styles.actionBtn, { backgroundColor: "#2563eb" }]}
          onPress={() => navigation.navigate("PartnerEntry")}
        >
          <Ionicons name="storefront" size={16} color="#ffffff" style={{ marginRight: 6 }} />
          <Text style={styles.actionBtnText}>Register Shop as Barber Partner</Text>
        </Pressable>
      </View>
    </View>
  );

  // --- TAB 3: TAILOR PARTNER GUIDE ---
  const renderTailorGuide = () => (
    <View style={styles.guideWrapper}>
      <View style={[styles.heroCard, { backgroundColor: "#6d28d9" }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroBadge}>TAILOR PARTNER GUIDE ✂️</Text>
          <Text style={styles.heroTitle}>Manage Stitching Orders & Pipeline</Text>
          <Text style={styles.heroDesc}>
            Accept custom orders, manage production stages, verify delivery OTP, and build customer reviews!
          </Text>
        </View>
        <Ionicons name="cut" size={54} color="rgba(255,255,255,0.25)" />
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Complete Tailor Partner Guide</Text>
        <Text style={styles.sectionSubtitle}>From order acceptance to delivery completion</Text>

        <View style={[styles.stepItem, { marginTop: 14 }]}>
          <View style={[styles.stepNum, { backgroundColor: "#6d28d9" }]}>
            <Text style={styles.stepNumText}>1</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Register Tailor Shop Profile</Text>
            <Text style={styles.stepDesc}>
              Tap "Become a Partner" -> Select "Tailor Shop". Fill shop name, specialties (Suits, Shirts, Kurta, Dresses), and home service availability.
            </Text>
          </View>
        </View>

        <View style={styles.stepItem}>
          <View style={[styles.stepNum, { backgroundColor: "#6d28d9" }]}>
            <Text style={styles.stepNumText}>2</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Set Stitching Prices & Fabric Catalog</Text>
            <Text style={styles.stepDesc}>
              Add stitching services with prices, fabric options (Cotton, Silk, Linen) with per-meter rates, and custom collar/pocket options.
            </Text>
          </View>
        </View>

        <View style={styles.stepItem}>
          <View style={[styles.stepNum, { backgroundColor: "#6d28d9" }]}>
            <Text style={styles.stepNumText}>3</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Accept Order & Verify Initial OTP 🔒</Text>
            <Text style={styles.stepDesc}>
              When customer places order, review details and tap Accept. Enter customer's 4-digit Initial OTP to confirm identity and start production.
            </Text>
          </View>
        </View>

        <View style={styles.stepItem}>
          <View style={[styles.stepNum, { backgroundColor: "#d97706" }]}>
            <Text style={styles.stepNumText}>4</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Update Production Pipeline</Text>
            <Text style={styles.stepDesc}>
              Track outfit status through stages: Pattern Making -> Cutting -> Stitching -> Ironing -> Packing -> Ready.
            </Text>
          </View>
        </View>

        <View style={styles.stepItem}>
          <View style={[styles.stepNum, { backgroundColor: "#15803d" }]}>
            <Text style={styles.stepNumText}>5</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Generate & Verify Delivery OTP 📦</Text>
            <Text style={styles.stepDesc}>
              When outfit is ready, tap "Deliver Order" to generate 4-digit Delivery OTP. When delivering outfit to customer, enter customer's Delivery OTP to mark order completed. Customer will get a notification to rate your service! ⭐️
            </Text>
          </View>
        </View>

        <Pressable 
          style={[styles.actionBtn, { backgroundColor: "#6d28d9" }]}
          onPress={() => navigation.navigate("PartnerEntry")}
        >
          <Ionicons name="cut" size={16} color="#ffffff" style={{ marginRight: 6 }} />
          <Text style={styles.actionBtnText}>Register as Tailor Partner</Text>
        </Pressable>
      </View>
    </View>
  );

  // --- TAB 4: BEAUTY PARTNER GUIDE ---
  const renderBeautyGuide = () => (
    <View style={styles.guideWrapper}>
      <View style={[styles.heroCard, { backgroundColor: "#be185d" }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroBadge}>BEAUTY PARTNER GUIDE 💄</Text>
          <Text style={styles.heroTitle}>Manage Beauty Parlor & Home Visits</Text>
          <Text style={styles.heroDesc}>
            List makeup, bridal packages, skincare services, and manage client bookings smoothly!
          </Text>
        </View>
        <Ionicons name="sparkles" size={54} color="rgba(255,255,255,0.25)" />
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Beauty Parlor Partner Guide</Text>
        <Text style={styles.sectionSubtitle}>Simple setup for beauty professionals</Text>

        <View style={[styles.stepItem, { marginTop: 14 }]}>
          <View style={[styles.stepNum, { backgroundColor: "#be185d" }]}>
            <Text style={styles.stepNumText}>1</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Register Beauty Parlor Profile</Text>
            <Text style={styles.stepDesc}>
              Register as Partner -> Select Beauty Parlor category. Fill parlor name, address, photos, and indicate if home service is offered.
            </Text>
          </View>
        </View>

        <View style={styles.stepItem}>
          <View style={[styles.stepNum, { backgroundColor: "#be185d" }]}>
            <Text style={styles.stepNumText}>2</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Add Beauty & Bridal Packages</Text>
            <Text style={styles.stepDesc}>
              Add services like Party Makeup, Bridal Makeup, Cleanup, Facials, Hair Styling, and Waxing with clear prices.
            </Text>
          </View>
        </View>

        <View style={styles.stepItem}>
          <View style={[styles.stepNum, { backgroundColor: "#16a34a" }]}>
            <Text style={styles.stepNumText}>3</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Fulfill Bookings & Build Reputation</Text>
            <Text style={styles.stepDesc}>
              Accept incoming parlor or home visit bookings, verify arrival, provide high-quality beauty service, and build top customer ratings.
            </Text>
          </View>
        </View>

        <Pressable 
          style={[styles.actionBtn, { backgroundColor: "#be185d" }]}
          onPress={() => navigation.navigate("PartnerEntry")}
        >
          <Ionicons name="sparkles" size={16} color="#ffffff" style={{ marginRight: 6 }} />
          <Text style={styles.actionBtnText}>Register Beauty Parlor Partner</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {renderHeader()}
      {renderTabs()}

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {activeTab === "customer" && renderCustomerGuide()}
        {activeTab === "barber" && renderBarberGuide()}
        {activeTab === "tailor" && renderTailorGuide()}
        {activeTab === "beauty" && renderBeautyGuide()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  tabContainer: {
    backgroundColor: "#ffffff",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  tabScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tabPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    gap: 6,
  },
  tabPillActiveCustomer: {
    backgroundColor: "#7c3aed",
  },
  tabPillActiveBarber: {
    backgroundColor: "#2563eb",
  },
  tabPillActiveTailor: {
    backgroundColor: "#6d28d9",
  },
  tabPillActiveBeauty: {
    backgroundColor: "#be185d",
  },
  tabText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748b",
  },
  tabTextActive: {
    color: "#ffffff",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  guideWrapper: {
    gap: 16,
  },
  heroCard: {
    borderRadius: 20,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  heroBadge: {
    fontSize: 10,
    fontWeight: "800",
    color: "rgba(255,255,255,0.85)",
    letterSpacing: 1,
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#ffffff",
    marginBottom: 6,
  },
  heroDesc: {
    fontSize: 12,
    color: "rgba(255,255,255,0.9)",
    lineHeight: 18,
  },
  sectionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  sectionIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
  },
  sectionSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  stepItem: {
    flexDirection: "row",
    marginBottom: 16,
    gap: 12,
  },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  stepNumText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 13,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1e293b",
    marginBottom: 4,
  },
  stepDesc: {
    fontSize: 12.5,
    color: "#475569",
    lineHeight: 19,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginTop: 8,
    elevation: 2,
  },
  actionBtnText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 13.5,
  },
});
