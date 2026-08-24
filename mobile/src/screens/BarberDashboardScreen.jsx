import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { api } from "../api/client";
import { uploadImageAsync } from "../api/upload";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../context/AuthContext";
import { TailorServicesScreen } from "./tailor/TailorServicesScreen";
import { getSocket } from "../api/socket";

const BACKEND_CATEGORIES = ["haircut", "beard", "massage", "facial", "makeup", "waxing", "manicure", "pedicure", "threading", "suit_stitching", "blouse_stitching", "kurta_stitching", "alteration", "combo", "other"];

const BEAUTY_PARLOR_CATEGORIES = [
  { name: "Bridal Makeup", services: ["HD Bridal Makeup", "Airbrush Bridal Makeup", "Waterproof Bridal Makeup", "Traditional Bridal Makeup", "Reception Bridal Makeup"] },
  { name: "Party Makeup", services: ["Light Party Makeup", "HD Party Makeup", "Glam Party Makeup", "Birthday Party Makeup", "Evening Party Makeup"] },
  { name: "Occasion Makeup", services: ["Engagement Makeup", "Haldi Makeup", "Mehendi Makeup", "Sangeet Makeup", "Reception Makeup", "Cocktail Makeup", "Baby Shower Makeup", "Anniversary Makeup", "Festival Makeup"] },
  { name: "Hair Styling", services: ["Bridal Hairstyle", "Party Hairstyle", "Bun Styling", "Curling", "Straightening", "Braiding"] },
  { name: "Saree & Dress Draping", services: ["Bridal Saree Draping", "Party Saree Draping", "Gujarati Saree Draping", "Bengali Saree Draping", "Lehenga Draping", "Dupatta Setting"] },
  { name: "Other Services", services: ["False Eyelash Fixing", "Contact Lens Setting", "Nail Polish Application", "Groom Makeup", "Touch-up Makeup"] }
];

const TAILOR_CATEGORIES = [
  { name: "👚 Blouse Stitching Services", services: ["Simple Blouse", "Designer Blouse", "Bridal Blouse", "Padded Blouse", "Princess Cut Blouse", "High Neck Blouse", "Boat Neck Blouse", "Backless Blouse", "Sleeveless Blouse", "Readymade Blouse Alteration"] },
  { name: "👗 Kurti Stitching Services", services: ["Straight Kurti", "A-Line Kurti", "Anarkali Kurti", "Flared Kurti", "Jacket Style Kurti", "Umbrella Kurti", "Angrakha Kurti", "High-Low Kurti", "Office Wear Kurti", "Designer Kurti"] },
  { name: "🥻 Salwar Suit Stitching Services", services: ["Punjabi Suit", "Churidar Suit", "Palazzo Suit", "Patiala Suit", "Sharara Suit", "Garara Suit", "Anarkali Suit", "Straight Suit", "Designer Suit", "Cotton Suit"] },
  { name: "👑 Lehenga Stitching Services", services: ["Bridal Lehenga", "Designer Lehenga", "Party Wear Lehenga", "Reception Lehenga", "Engagement Lehenga", "Kids Lehenga", "Semi-Stitched Lehenga", "Custom Lehenga"] },
  { name: "👗 Gown Stitching Services", services: ["Party Gown", "Bridal Gown", "Maxi Gown", "Evening Gown", "Indo-Western Gown", "Ball Gown", "A-Line Gown", "Mermaid Gown", "Designer Gown", "Kids Gown"] },
  { name: "🪡 Saree Services", services: ["Saree Fall", "Saree Pico", "Fall + Pico", "Saree Rolling", "Saree Tassel (Latkan)", "Saree Border Stitching", "Saree Repair", "Saree Finishing"] }
];

const BARBER_PRESETS = {
  "💇 Hair": [
    { name: "Haircut", price: "150", duration: "30" },
    { name: "Hair Styling", price: "200", duration: "20" },
    { name: "Hair Wash", price: "100", duration: "15" },
    { name: "Hair Color", price: "300", duration: "40" },
    { name: "Hair Spa", price: "500", duration: "45" },
    { name: "Keratin Treatment", price: "1500", duration: "90" }
  ],
  "🧔 Beard": [
    { name: "Beard Trim", price: "100", duration: "15" },
    { name: "Beard Styling", price: "120", duration: "20" },
    { name: "Clean Shave", price: "80", duration: "15" },
    { name: "Beard Color", price: "150", duration: "25" },
    { name: "Hot Towel Shave", price: "150", duration: "20" }
  ],
  "💆 Face": [
    { name: "Facial", price: "400", duration: "45" },
    { name: "Face Cleanup", price: "250", duration: "30" },
    { name: "Detan", price: "300", duration: "25" },
    { name: "Face Scrub", price: "150", duration: "20" }
  ],
  "💆 Massage": [
    { name: "Head Massage", price: "120", duration: "15" },
    { name: "Neck & Shoulder Massage", price: "150", duration: "20" },
    { name: "Oil Head Massage", price: "180", duration: "20" }
  ]
};

const DAYS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

export function BarberDashboardScreen() {
  const { refreshMe, barber, user } = useAuth();
  const navigation = useNavigation();

  if (user?.role === "tailor") {
    return <TailorServicesScreen />;
  }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("Overview"); // "Overview", "Shop Services", "Home Services", "Shop Setup"
  const [services, setServices] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [analyticsData, setAnalyticsData] = useState({
    todayRevenue: 0,
    todayCustomers: 0,
    activeQueue: 0,
    completedServices: 0,
    weeklyData: [0, 0, 0, 0, 0, 0, 0]
  });

  const [selectedRange, setSelectedRange] = useState("Today");
  const [reviews, setReviews] = useState([]);

  const loadAnalytics = async (rangeVal) => {
    try {
      const rangeParam = rangeVal.toLowerCase();
      const statsRes = await api.get(`/barbers/analytics?range=${rangeParam}&t=${Date.now()}`);
      setAnalyticsData(statsRes.data);

      const profileRes = await api.get(`/barbers/me?t=${Date.now()}`);
      if (profileRes.data?.barber?.id) {
        const revRes = await api.get(`/reviews/barber/${profileRes.data.barber.id}`);
        setReviews(revRes.data.reviews || []);
      }
    } catch (err) {
      console.error("Failed to load analytics", err);
    }
  };

  const handleRangeChange = async (range) => {
    setSelectedRange(range);
    await loadAnalytics(range);
  };

  // Shop Setup Form State
  const [form, setForm] = useState({
    shopName: "",
    bio: "",
    shopPosterUrl: "",
    addressLine1: "",
    city: "",
    state: "",
    pincode: "",
    isShopOpen: true,
    pauseBookings: false,
    offersHomeService: false,
    categoryType: "Barber / Salon",
    workingHours: {
      mon: { open: "09:00", close: "18:00", isClosed: false },
      tue: { open: "09:00", close: "18:00", isClosed: false },
      wed: { open: "09:00", close: "18:00", isClosed: false },
      thu: { open: "09:00", close: "18:00", isClosed: false },
      fri: { open: "09:00", close: "18:00", isClosed: false },
      sat: { open: "09:00", close: "17:00", isClosed: false },
      sun: { open: "10:00", close: "16:00", isClosed: false },
    }
  });

  const [serviceFilter, setServiceFilter] = useState("All");
  const [activeToggleStates, setActiveToggleStates] = useState({});

  // Modals
  const [serviceModalVisible, setServiceModalVisible] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [serviceForm, setServiceForm] = useState({
    name: "",
    category: "haircut",
    durationMinutes: "30",
    price: "200",
    images: [],
    isHomeService: false,
  });
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [showBusinessTypeOnboarding, setShowBusinessTypeOnboarding] = useState(false);

  // Beauty Parlor Bulk Add State
  const [beautyParlorModalVisible, setBeautyParlorModalVisible] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [selectedParlorServices, setSelectedParlorServices] = useState([]);
  const [customServiceName, setCustomServiceName] = useState("");
  const [customServicePrice, setCustomServicePrice] = useState("");
  const [customServiceDuration, setCustomServiceDuration] = useState("");

  const handleAddCustomServiceDirect = async () => {
    if (!customServiceName.trim()) return Alert.alert("Error", "Please enter a custom service name");
    try {
      const res = await api.get(`/barbers/me?t=${Date.now()}`);
      const bId = String(res.data.barber.id);

      await api.post("/services", {
        barberId: bId,
        name: customServiceName.trim(),
        category: "Custom",
        durationMinutes: Number(customServiceDuration || "60"),
        price: Number(customServicePrice || "500"),
        isHomeService: activeTab === "Home Services",
        images: [],
      });
      Alert.alert("Success", "Custom service added successfully!");
      setCustomServiceName("");
      setCustomServicePrice("");
      setCustomServiceDuration("");
      fetchData(); // refresh the main dashboard list
    } catch (e) {
      Alert.alert("Error", "Failed to add custom service");
    }
  };

  const toggleCategory = (catName) => {
    setExpandedCategory(expandedCategory === catName ? null : catName);
  };

  const handleToggleParlorService = (serviceName, catName) => {
    const exists = selectedParlorServices.find(s => s.name === serviceName);
    if (exists) {
      setSelectedParlorServices(selectedParlorServices.filter(s => s.name !== serviceName));
    } else {
      setSelectedParlorServices([...selectedParlorServices, { name: serviceName, category: catName, price: "500", durationMinutes: "60" }]);
    }
  };

  const updateParlorService = (serviceName, field, value) => {
    setSelectedParlorServices(selectedParlorServices.map(s => s.name === serviceName ? { ...s, [field]: value } : s));
  };

  const handleSaveParlorServices = async () => {
    if (selectedParlorServices.length === 0) return Alert.alert("Error", "No services selected.");
    try {
      if (form.categoryType === "Tailor" || user?.role === "tailor") {
        for (const svc of selectedParlorServices) {
          await api.post("/tailors/services", {
            name: svc.name,
            category: svc.category,
            price: Number(svc.price) || 0,
            estimatedDays: 3,
            isHomeService: activeTab === "Home Services",
          });
        }
      } else {
        const res = await api.get(`/barbers/me?t=${Date.now()}`);
        const barberId = String(res.data.barber.id);

        for (const svc of selectedParlorServices) {
          await api.post("/services", {
            barberId,
            name: svc.name,
            category: svc.category,
            durationMinutes: Number(svc.durationMinutes),
            price: Number(svc.price),
            isHomeService: activeTab === "Home Services",
            images: [],
          });
        }
      }

      setBeautyParlorModalVisible(false);
      setSelectedParlorServices([]);
      await load();
      Alert.alert("Success", "Services added successfully!");
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.error || e.message);
    }
  };

  const availableCategories = React.useMemo(() => {
    if (form.categoryType === "Tailor") {
      return ["suit_stitching", "blouse_stitching", "kurta_stitching", "alteration", "combo", "other"];
    } else if (form.categoryType === "Beauty Parlor") {
      return ["facial", "makeup", "waxing", "manicure", "pedicure", "threading", "massage", "haircut", "combo", "other"];
    } else {
      return ["💇 Hair", "🧔 Beard", "💆 Face", "💆 Massage", "combo", "other"];
    }
  }, [form.categoryType]);

  const load = useCallback(async () => {
    if (user?.role === "tailor") {
      setLoading(false);
      return;
    }
    try {
      const res = await api.get(`/barbers/me?t=${Date.now()}`);
      const b = res.data.barber;
      if (!b) return;

      const addr = b.address || {};
      let detectedCategory = "Barber / Salon";
      if (b.bio?.includes("Beauty Parlor") || b.shopName?.toLowerCase().includes("parlor") || b.shopName?.toLowerCase().includes("beauty") || b.businessCategory?.toLowerCase().includes("beauty")) {
        detectedCategory = "Beauty Parlor";
      } else if (b.bio?.includes("Stitching") || b.shopName?.toLowerCase().includes("stitch") || b.shopName?.toLowerCase().includes("tailor")) {
        detectedCategory = "Tailor";
      }

      navigation.setOptions({
        title: detectedCategory === "Beauty Parlor" ? "Beauty Parlor Dashboard" :
          detectedCategory === "Tailor" ? "Tailor Dashboard" : "Shop Dashboard"
      });

      setForm({
        shopName: b.shopName || "",
        bio: b.bio || "",
        shopPosterUrl: b.shopPosterUrl || "",
        addressLine1: addr.line1 || "",
        city: addr.city || "",
        state: addr.state || "",
        pincode: addr.pincode || "",
        isShopOpen: !!b.isShopOpen,
        pauseBookings: !!b.pauseBookings,
        offersHomeService: !!b.offersHomeService,
        categoryType: detectedCategory,
        workingHours: b.workingHours || form.workingHours,
      });

      if (!b.shopName) setShowBusinessTypeOnboarding(true);

      const rawServicesList = res.data.services || [];
      const servicesList = rawServicesList.map(s => {
        let mappedCat = s.category;
        if (s.category === "haircut") mappedCat = "💇 Hair";
        else if (s.category === "beard") mappedCat = "🧔 Beard";
        else if (s.category === "facial") mappedCat = "💆 Face";
        else if (s.category === "massage") mappedCat = "💆 Massage";
        return {
          ...s,
          category: mappedCat,
          originalPrice: s.originalPrice || s.price || 0,
          discountAmount: s.discountAmount || 0
        };
      });
      setServices(servicesList);

      const toggles = {};
      servicesList.forEach((s) => {
        toggles[s.id] = s.isActive !== false;
      });
      setActiveToggleStates(toggles);

      try {
        await loadAnalytics(selectedRange);
      } catch (err) {
        console.error("Failed to load analytics", err);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await load();
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  useEffect(() => {
    const barberId = barber?.id || barber?._id;
    if (!barberId) return;
    const socket = getSocket();
    if (socket) {
      socket.emit("joinBarberRoom", barberId);
      socket.on("slotsUpdated", load);
      socket.on("queueUpdated", load);
      socket.on("bookingUpdated", load);

      return () => {
        socket.emit("leaveBarberRoom", barberId);
        socket.off("slotsUpdated", load);
        socket.off("queueUpdated", load);
        socket.off("bookingUpdated", load);
      };
    }
  }, [barber, load]);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  const saveProfile = async (categoryOverride) => {
    setSaving(true);
    try {
      const finalCategoryType = categoryOverride || form.categoryType;
      let finalBio = form.bio;
      if (!finalBio.includes(finalCategoryType)) {
        finalBio = `${finalCategoryType}. ${finalBio}`;
      }

      await api.patch("/barbers/me", {
        shopName: form.shopName.trim(),
        bio: finalBio.trim(),
        shopPosterUrl: form.shopPosterUrl.trim(),
        address: {
          line1: form.addressLine1.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          pincode: form.pincode.trim(),
        },
        isShopOpen: form.isShopOpen,
        pauseBookings: form.pauseBookings,
        offersHomeService: form.offersHomeService,
        workingHours: form.workingHours,
      });

      await refreshMe();
      Alert.alert("Success", "Your profile has been updated!");
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChooseBusinessType = (type) => {
    setForm((prev) => ({ ...prev, categoryType: type }));
    setShowBusinessTypeOnboarding(false);
    saveProfile(type);
  };

  const handleOpenAddService = () => {
    if (form.categoryType === "Beauty Parlor" || form.categoryType === "Tailor" || user?.role === "tailor") {
      setBeautyParlorModalVisible(true);
      setSelectedParlorServices([]);
      return;
    }
    setEditingServiceId(null);
    const initialCategory = availableCategories[0] || "other";
    const isHome = activeTab === "Home Services";
    setServiceForm({ name: "", category: initialCategory, durationMinutes: "30", price: "200", originalPrice: "200", discountAmount: "0", images: [], isHomeService: isHome });
    setServiceModalVisible(true);
  };

  const handleOpenEditService = (service) => {
    setEditingServiceId(service.id);
    setServiceForm({
      name: service.name,
      category: service.category || "haircut",
      durationMinutes: String(service.durationMinutes || "30"),
      price: String(service.price || "200"),
      originalPrice: String(service.originalPrice || service.price || "200"),
      discountAmount: String(service.discountAmount || "0"),
      images: service.images || [],
      isHomeService: !!service.isHomeService,
    });
    setServiceModalVisible(true);
  };

  const handleSaveService = async () => {
    if (!serviceForm.name.trim()) return Alert.alert("Error", "Service name is required.");
    try {
      const res = await api.get(`/barbers/me?t=${Date.now()}`);
      const barberId = String(res.data.barber.id);
      const orig = Number(serviceForm.originalPrice || "0");
      const disc = Number(serviceForm.discountAmount || "0");
      const finalPrice = Math.max(0, orig - disc);

      const payload = {
        name: serviceForm.name.trim(),
        category: serviceForm.category,
        durationMinutes: Number(serviceForm.durationMinutes),
        price: finalPrice,
        originalPrice: orig,
        discountAmount: disc,
        isHomeService: serviceForm.isHomeService,
      };

      const finalImages = [...serviceForm.images];
      for (let i = 0; i < finalImages.length; i++) {
        if (!finalImages[i].startsWith("http")) {
          finalImages[i] = await uploadImageAsync(finalImages[i]);
        }
      }
      payload.images = finalImages;

      if (editingServiceId) {
        await api.patch(`/services/${editingServiceId}`, payload);
      } else {
        await api.post("/services", { ...payload, barberId });
      }

      setServiceModalVisible(false);
      await load();
      Alert.alert("Success", `Service ${editingServiceId ? "updated" : "added"} successfully!`);
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.error || e.message);
    }
  };

  const handleDeleteService = (id) => {
    Alert.alert("Delete Service", "Are you sure you want to delete this service?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/services/${id}`);
            await load();
          } catch (e) {
            Alert.alert("Error", e?.response?.data?.error || e.message);
          }
        },
      },
    ]);
  };

  const toggleServiceAvailability = async (id, value) => {
    setActiveToggleStates((prev) => ({ ...prev, [id]: value }));
    try {
      await api.patch(`/services/${id}`, { isActive: value });
    } catch (e) {
      setActiveToggleStates((prev) => ({ ...prev, [id]: !value }));
      Alert.alert("Error", "Could not update service status");
    }
  };

  const filteredServices = React.useMemo(() => {
    return services.filter((s) => {
      if (activeTab === "Shop Services" && s.isHomeService) return false;
      if (activeTab === "Home Services" && !s.isHomeService) return false;
      const isActive = activeToggleStates[s.id] !== false;
      if (serviceFilter === "Active") return isActive;
      if (serviceFilter === "Inactive") return !isActive;
      return true;
    });
  }, [services, serviceFilter, activeToggleStates, activeTab]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#6d28d9" size="large" />
      </View>
    );
  }

  // ONBOARDING
  if (showBusinessTypeOnboarding) {
    return (
      <SafeAreaView style={styles.mainContainer}>
        <View style={styles.onboardHeader}>
          <Text style={styles.onboardTitle}>Select Business Type</Text>
          <Text style={styles.onboardSub}>What kind of services do you offer?</Text>
        </View>
        <ScrollView contentContainerStyle={styles.onboardList}>
          {[
            { type: "Barber / Salon", icon: "cut-outline", color: "#db2777", bg: "#fce7f3", desc: "Haircuts & Styling" },
            { type: "Beauty Parlor", icon: "sparkles-outline", color: "#a855f7", bg: "#f3e8ff", desc: "Makeup & Skincare" },
            { type: "Tailor", icon: "shirt-outline", color: "#0ea5e9", bg: "#e0f2fe", desc: "Tailoring & Design" },
            { type: "Other Services", icon: "apps-outline", color: "#10b981", bg: "#d1fae5", desc: "Spa, Massage, etc." },
          ].map((item) => (
            <Pressable
              key={item.type}
              style={[styles.onboardCard, form.categoryType === item.type && styles.onboardCardSelected]}
              onPress={() => handleChooseBusinessType(item.type)}
            >
              <View style={[styles.onboardIconBg, { backgroundColor: item.bg }]}>
                <Ionicons name={item.icon} size={24} color={item.color} />
              </View>
              <View style={styles.onboardCardInfo}>
                <Text style={styles.onboardCardTitle}>{item.type}</Text>
                <Text style={styles.onboardCardDesc}>{item.desc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
            </Pressable>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.mainContainer}>

      {/* Top Header */}
      <View style={styles.headerTitleContainer}>
        <Text style={styles.headerTitleText}>Manage Shop</Text>
      </View>

      {barber?.approvalStatus === "pending" && (
        <View style={{ backgroundColor: "#fef3c7", padding: 12, marginHorizontal: 20, marginBottom: 16, borderRadius: 12, borderWidth: 1, borderColor: "#fde68a" }}>
          <Text style={{ color: "#92400e", fontWeight: "700", fontSize: 14, marginBottom: 4 }}>
            Verification Pending
          </Text>
          <Text style={{ color: "#b45309", fontSize: 12 }}>
            You can configure your shop here, but it will not appear to customers until an admin verifies your details.
          </Text>
        </View>
      )}

      {/* Segmented Control */}
      <View style={{ marginBottom: 10 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
          <View style={[styles.segmentedControl, { marginHorizontal: 0 }]}>
            {["Overview", "Shop Services", "Home Services", "Shop Setup"].map((tab) => {
              const isActive = activeTab === tab;
              return (
                <Pressable
                  key={tab}
                  style={[styles.segmentBtn, { flex: undefined, paddingHorizontal: 16 }, isActive && styles.segmentBtnActive]}
                  onPress={() => setActiveTab(tab)}
                >
                  <Text style={[styles.segmentBtnText, isActive && styles.segmentBtnTextActive]}>
                    {tab === "Shop Setup" ? "Profile" : (tab === "Home Services" && (form.categoryType === "Tailor" || user?.role === "tailor") ? "Premium Service" : tab)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {/* Main Content Area */}
      {activeTab === "Overview" ? (
        <ScrollView contentContainerStyle={styles.overviewContainer} showsVerticalScrollIndicator={false}>

          {/* Time Range Selector */}
          <View style={styles.rangeControlContainer}>
            {["Today", "Week", "Month"].map((r) => {
              const isActive = selectedRange === r;
              return (
                <Pressable
                  key={r}
                  style={[styles.rangeBtn, isActive && styles.rangeBtnActive]}
                  onPress={() => handleRangeChange(r)}
                >
                  <Text style={[styles.rangeBtnText, isActive && styles.rangeBtnTextActive]}>
                    {r}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Ionicons name="wallet" size={24} color="#16a34a" />
              <Text style={styles.statValue}>₹{analyticsData.todayRevenue}</Text>
              <Text style={styles.statLabel}>
                {selectedRange === "Today" ? "Today's Revenue" : selectedRange === "Week" ? "Weekly Revenue" : "Monthly Revenue"}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="people" size={24} color="#6d28d9" />
              <Text style={styles.statValue}>{analyticsData.todayCustomers}</Text>
              <Text style={styles.statLabel}>
                {selectedRange === "Today" ? "Total Customers" : selectedRange === "Week" ? "Weekly Customers" : "Monthly Customers"}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="hourglass" size={24} color="#ea580c" />
              <Text style={styles.statValue}>{analyticsData.activeQueue}</Text>
              <Text style={styles.statLabel}>
                {selectedRange === "Today" ? "Active Queue" : selectedRange === "Week" ? "Weekly Bookings" : "Monthly Bookings"}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="checkmark-done-circle" size={24} color="#0284c7" />
              <Text style={styles.statValue}>{analyticsData.completedServices}</Text>
              <Text style={styles.statLabel}>
                {selectedRange === "Today" ? "Completed" : selectedRange === "Week" ? "Weekly Completed" : "Monthly Completed"}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="time" size={24} color="#f59e0b" />
              <Text style={styles.statValue}>{analyticsData.avgWait || 0}m</Text>
              <Text style={styles.statLabel}>Avg Wait</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="walk" size={24} color="#10b981" />
              <Text style={styles.statValue}>{analyticsData.walkIns || 0}</Text>
              <Text style={styles.statLabel}>
                {selectedRange === "Today" ? "Walk-ins" : selectedRange === "Week" ? "Weekly Walk-ins" : "Monthly Walk-ins"}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="globe" size={24} color="#3b82f6" />
              <Text style={styles.statValue}>{analyticsData.onlineBookings || 0}</Text>
              <Text style={styles.statLabel}>
                {selectedRange === "Today" ? "Online" : selectedRange === "Week" ? "Weekly Online" : "Monthly Online"}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="close-circle" size={24} color="#ef4444" />
              <Text style={styles.statValue}>{analyticsData.noShows || 0}</Text>
              <Text style={styles.statLabel}>
                {selectedRange === "Today" ? "No Shows" : selectedRange === "Week" ? "Weekly No Shows" : "Monthly No Shows"}
              </Text>
            </View>
          </View>

          {/* Export Report */}
          {form.categoryType !== "Barber / Salon" && (
            <Pressable style={styles.exportBtn} onPress={async () => {
              try {
                const res = await api.get("/barbers/export?format=csv", { responseType: 'text' });
                const csvData = res.data;

                const fileUri = FileSystem.documentDirectory + "report.csv";
                await FileSystem.writeAsStringAsync(fileUri, csvData, { encoding: FileSystem.EncodingType.UTF8 });

                if (await Sharing.isAvailableAsync()) {
                  await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Share Bookings Report' });
                } else {
                  Alert.alert("Success", "Report downloaded, but sharing is not available on this device.");
                }
              } catch (e) {
                console.error(e);
                Alert.alert("Error", "Failed to export report");
              }
            }}>
              <Ionicons name="download" size={18} color="#ffffff" />
              <Text style={styles.exportBtnText}>Export Report (CSV)</Text>
            </Pressable>
          )}

          {/* Reviews Section */}
          <View style={{ marginTop: 24, paddingHorizontal: 20, marginBottom: 30 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: "#1e293b" }}>Recent Reviews</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Ionicons name="star" size={16} color="#fbbf24" />
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#475569" }}>
                  {reviews.length > 0
                    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
                    : "0.0"} ({reviews.length})
                </Text>
              </View>
            </View>

            {reviews.length === 0 ? (
              <View style={{ backgroundColor: "#f8fafc", padding: 20, borderRadius: 16, alignItems: "center", borderWidth: 1, borderColor: "#e2e8f0" }}>
                <Ionicons name="chatbubbles-outline" size={32} color="#94a3b8" style={{ marginBottom: 8 }} />
                <Text style={{ fontSize: 13, color: "#64748b", fontWeight: "600" }}>No reviews received yet.</Text>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                {reviews.slice(0, 5).map((rev) => (
                  <View key={rev._id || rev.id} style={{ backgroundColor: "#ffffff", padding: 14, borderRadius: 16, borderWidth: 1, borderColor: "#e2e8f0", shadowColor: "#0f172a", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: "#334155" }}>
                        {rev.userId?.name || "Anonymous"}
                      </Text>
                      <View style={{ flexDirection: "row", gap: 2 }}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Ionicons
                            key={star}
                            name={rev.rating >= star ? "star" : "star-outline"}
                            size={12}
                            color="#fbbf24"
                          />
                        ))}
                      </View>
                    </View>
                    {rev.comment ? (
                      <Text style={{ fontSize: 13, color: "#475569", lineHeight: 18 }}>
                        "{rev.comment}"
                      </Text>
                    ) : (
                      <Text style={{ fontSize: 12, color: "#94a3b8", fontStyle: "italic" }}>
                        No comment left
                      </Text>
                    )}
                    <Text style={{ fontSize: 10, color: "#94a3b8", marginTop: 6, alignSelf: "flex-end" }}>
                      {new Date(rev.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      ) : (activeTab === "Shop Services" || activeTab === "Home Services") ? (
        // SERVICES TAB
        <View style={{ flex: 1 }}>
          {activeTab === "Home Services" && (
            <View style={[styles.switchRow, { backgroundColor: "#fff", marginHorizontal: 20, marginTop: 10, borderRadius: 12, padding: 12 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchTitle}>{form.categoryType === "Tailor" || user?.role === "tailor" ? "Accepting Premium Bookings" : "Accepting Home Bookings"}</Text>
                <Text style={[styles.switchSub, { fontSize: 11 }]}>{form.offersHomeService ? "ON - Customers can book" : `OFF - ${form.categoryType === "Tailor" || user?.role === "tailor" ? "Premium" : "Home"} services disabled`}</Text>
              </View>
              <Switch
                value={form.offersHomeService}
                onValueChange={async (val) => {
                  setForm((prev) => ({ ...prev, offersHomeService: val }));
                  try {
                    await api.patch("/barbers/me", { offersHomeService: val });
                  } catch (e) {
                    Alert.alert("Error", "Could not update status.");
                    setForm((prev) => ({ ...prev, offersHomeService: !val }));
                  }
                }}
                thumbColor="#ffffff"
                trackColor={{ false: "#e2e8f0", true: "#6d28d9" }}
              />
            </View>
          )}
          <View style={styles.servicesToolbar}>
            <View style={styles.subFilters}>
              {["All", "Active", "Inactive"].map((f) => (
                <Pressable
                  key={f}
                  style={[styles.subFilterBtn, serviceFilter === f && styles.subFilterBtnActive]}
                  onPress={() => setServiceFilter(f)}
                >
                  <Text style={[styles.subFilterText, serviceFilter === f && styles.subFilterTextActive]}>{f}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={styles.addServiceBtn} onPress={handleOpenAddService}>
              <Ionicons name="add" size={18} color="#ffffff" />
              <Text style={styles.addServiceBtnText}>Add Service</Text>
            </Pressable>
          </View>

          <FlatList
            data={filteredServices}
            keyExtractor={(item) => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6d28d9" />}
            contentContainerStyle={styles.listContainer}
            renderItem={({ item }) => (
              <View style={styles.servicePremiumCard}>
                <View style={styles.svcHeader}>
                  <View style={styles.svcIconWrapper}>
                    {item.category?.includes("💇") || item.category?.includes("🧔") || item.category?.includes("💆") ? (
                      <Text style={{ fontSize: 20 }}>{item.category.split(" ")[0]}</Text>
                    ) : (
                      <Ionicons
                        name={item.category === "haircut" ? "cut" : item.category === "beard" ? "sparkles" : "grid"}
                        size={20} color="#6d28d9"
                      />
                    )}
                  </View>
                  <View style={styles.svcInfo}>
                    <Text style={styles.svcNameText}>{item.name}</Text>
                    {item.originalPrice > item.price ? (
                      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                        <Text style={{ fontSize: 13, color: "#64748b", fontWeight: "600" }}>{item.durationMinutes} mins  ·</Text>
                        <Text style={{ fontSize: 13, color: "#94a3b8", textDecorationLine: "line-through", fontWeight: "600" }}>₹{item.originalPrice}</Text>
                        <Text style={{ fontSize: 14, color: "#16a34a", fontWeight: "800" }}>₹{item.price}</Text>
                        <View style={{ backgroundColor: "#dcfce7", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                          <Text style={{ fontSize: 10, color: "#16a34a", fontWeight: "700" }}>{Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100)}% OFF</Text>
                        </View>
                      </View>
                    ) : (
                      <Text style={styles.svcMetaText}>{item.durationMinutes} mins  ·  ₹{item.price}</Text>
                    )}
                  </View>
                  <Switch
                    value={activeToggleStates[item.id] !== false}
                    onValueChange={(val) => toggleServiceAvailability(item.id, val)}
                    thumbColor="#ffffff"
                    trackColor={{ false: "#e2e8f0", true: "#6d28d9" }}
                    style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                  />
                </View>

                <View style={styles.svcFooter}>
                  <Pressable style={styles.svcFtBtn} onPress={() => handleOpenEditService(item)}>
                    <Ionicons name="pencil" size={14} color="#64748b" />
                    <Text style={styles.svcFtBtnText}>Edit Service</Text>
                  </Pressable>
                  <View style={styles.svcFtDivider} />
                  <Pressable style={styles.svcFtBtn} onPress={() => handleDeleteService(item.id)}>
                    <Ionicons name="trash" size={14} color="#ef4444" />
                    <Text style={[styles.svcFtBtnText, { color: "#ef4444" }]}>Remove</Text>
                  </Pressable>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyStateBox}>
                <Ionicons name="list-outline" size={48} color="#cbd5e1" />
                <Text style={styles.emptyTitle}>No Services Yet</Text>
                <Text style={styles.emptySub}>Create your first service to let customers book appointments.</Text>
                <Pressable style={styles.primarySolidBtn} onPress={handleOpenAddService}>
                  <Text style={styles.primarySolidBtnText}>+ Add Service</Text>
                </Pressable>
              </View>
            }
          />
        </View>
      ) : (
        // SHOP SETUP TAB
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.formContent} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6d28d9" />}>
          <View style={styles.coverImageContainer}>
            {form.shopPosterUrl ? (
              <Image source={{ uri: form.shopPosterUrl }} style={styles.coverImg} />
            ) : (
              <View style={[styles.coverImg, { backgroundColor: "#e2e8f0", justifyContent: "center", alignItems: "center" }]}>
                <Ionicons name="image-outline" size={48} color="#94a3b8" />
              </View>
            )}
            <View style={styles.coverOverlay} />
            <Pressable style={styles.changeCoverBadge} onPress={() => navigation.navigate("BarberProfileEdit")}>
              <Ionicons name="pencil" size={14} color="#0f172a" />
              <Text style={styles.changeCoverText}>Edit Profile</Text>
            </Pressable>
          </View>

          <View style={styles.formCard}>
            <View style={styles.profileHeaderRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.profileShopName}>{form.shopName || "Your Shop Name"}</Text>
                <Text style={styles.profileCategoryText}>{form.categoryType}</Text>
              </View>
              <Pressable style={styles.editCategoryBtn} onPress={() => setCategoryModalVisible(true)}>
                <Ionicons name="options-outline" size={16} color="#6d28d9" />
                <Text style={styles.editCategoryText}>Category</Text>
              </Pressable>
            </View>

            <Text style={styles.profileBioText}>
              {form.bio || "No description provided. Tap 'Edit Profile' to let customers know about your shop."}
            </Text>

            <View style={styles.sectionDivider} />

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchTitle}>Shop Status</Text>
                <Text style={styles.switchSub}>{form.isShopOpen ? "Open for bookings" : "Closed right now"}</Text>
              </View>
              <Switch
                value={form.isShopOpen}
                onValueChange={async (val) => {
                  setForm((prev) => ({ ...prev, isShopOpen: val }));
                  try {
                    await api.patch("/barbers/me", { isShopOpen: val, autoShopStatus: false });
                  } catch (e) {
                    Alert.alert("Error", "Could not update status.");
                  }
                }}
                thumbColor="#ffffff"
                trackColor={{ false: "#e2e8f0", true: "#10b981" }}
              />
            </View>

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchTitle}>{form.categoryType === "Tailor" || user?.role === "tailor" ? "Offers Premium Service" : "Offers Home Service"}</Text>
                <Text style={styles.switchSub}>{form.offersHomeService ? (form.categoryType === "Tailor" || user?.role === "tailor" ? "Customers can book premium service" : "Customers can book home visits") : (form.categoryType === "Tailor" || user?.role === "tailor" ? "Only standard shop services allowed" : "Only shop visits allowed")}</Text>
              </View>
              <Switch
                value={form.offersHomeService}
                onValueChange={async (val) => {
                  setForm((prev) => ({ ...prev, offersHomeService: val }));
                  try {
                    await api.patch("/barbers/me", { offersHomeService: val });
                  } catch (e) {
                    Alert.alert("Error", "Could not update status.");
                  }
                }}
                thumbColor="#ffffff"
                trackColor={{ false: "#e2e8f0", true: "#6d28d9" }}
              />
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoIconBg}>
                <Ionicons name="location" size={20} color="#6d28d9" />
              </View>
              <Text style={styles.infoText}>
                {form.addressLine1 ? `${form.addressLine1}, ${form.city}, ${form.state} - ${form.pincode}` : "Address not set. Edit profile to update."}
              </Text>
            </View>

            <View style={styles.sectionDivider} />

            <View style={styles.whHeaderRow}>
              <Text style={styles.sectionHeaderTxt}>Working Hours</Text>
              <Pressable onPress={() => navigation.navigate("BarberProfileEdit")}>
                <Text style={styles.whEditText}>Edit</Text>
              </Pressable>
            </View>

            <View style={styles.workingHoursContainer}>
              {DAYS.map((day) => {
                const d = form.workingHours[day.key];
                return (
                  <View key={day.key} style={styles.whDisplayRow}>
                    <Text style={styles.whDisplayDay}>{day.label}</Text>
                    {d.isClosed ? (
                      <Text style={styles.whClosedDisplay}>Closed</Text>
                    ) : (
                      <Text style={styles.whTimeText}>{d.open} - {d.close}</Text>
                    )}
                  </View>
                );
              })}
            </View>

          </View>
        </ScrollView>
      )}

      {/* MODAL: CATEGORY SELECTOR */}
      <Modal visible={categoryModalVisible} transparent animationType="fade" onRequestClose={() => setCategoryModalVisible(false)}>
        <Pressable style={styles.modalBg} onPress={() => setCategoryModalVisible(false)}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Business Category</Text>
            {["Barber / Salon", "Beauty Parlor", "Tailor", "Other Services"].map((type) => (
              <Pressable
                key={type}
                style={styles.modalOption}
                onPress={() => {
                  setForm((prev) => ({ ...prev, categoryType: type }));
                  setCategoryModalVisible(false);
                }}
              >
                <Text style={[styles.modalOptionText, form.categoryType === type && styles.modalOptionTextActive]}>{type}</Text>
                {form.categoryType === type && <Ionicons name="checkmark-circle" size={20} color="#6d28d9" />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* MODAL: ADD / EDIT SERVICE */}
      <Modal visible={serviceModalVisible} transparent animationType="slide" onRequestClose={() => setServiceModalVisible(false)}>
        <View style={styles.sheetBg}>
          <View style={styles.sheetBox}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{editingServiceId ? "Edit Service" : "New Service"}</Text>
              <Pressable onPress={() => setServiceModalVisible(false)}>
                <Ionicons name="close-circle" size={26} color="#cbd5e1" />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.sheetContent}>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Service Name</Text>
                <TextInput
                  style={styles.inputField}
                  value={serviceForm.name}
                  onChangeText={(t) => setServiceForm((prev) => ({ ...prev, name: t }))}
                  placeholder="e.g. Premium Haircut"
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Service Images (Up to 5)</Text>
                <View style={styles.galleryGrid}>
                  {serviceForm.images.map((uri, index) => (
                    <View key={index} style={styles.galleryItemBox}>
                      <Image source={{ uri }} style={styles.galleryImage} />
                      <Pressable
                        style={styles.removeBtn}
                        onPress={() => {
                          const newImages = [...serviceForm.images];
                          newImages.splice(index, 1);
                          setServiceForm(prev => ({ ...prev, images: newImages }));
                        }}
                      >
                        <Ionicons name="close" size={16} color="#fff" />
                      </Pressable>
                    </View>
                  ))}
                  {serviceForm.images.length < 5 && (
                    <Pressable
                      style={styles.addGalleryBtn}
                      onPress={async () => {
                        const result = await ImagePicker.launchImageLibraryAsync({
                          mediaTypes: ['images'],
                          allowsEditing: true,
                          aspect: [4, 3],
                          quality: 0.8,
                        });
                        if (!result.canceled) {
                          setServiceForm(prev => ({ ...prev, images: [...prev.images, result.assets[0].uri] }));
                        }
                      }}
                    >
                      <Ionicons name="add" size={32} color="#6d28d9" />
                    </Pressable>
                  )}
                </View>
              </View>

              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Category Type</Text>
                <View style={styles.tagRow}>
                  {availableCategories.map((cat) => (
                    <Pressable
                      key={cat}
                      style={[styles.tagBtn, serviceForm.category === cat && styles.tagBtnActive]}
                      onPress={() => setServiceForm((prev) => ({ ...prev, category: cat }))}
                    >
                      <Text style={[styles.tagBtnText, serviceForm.category === cat && styles.tagBtnTextActive]}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {BARBER_PRESETS[serviceForm.category] && (
                <View style={[styles.inputWrapper, { marginTop: 10 }]}>
                  <Text style={styles.inputLabel}>Quick Select Service</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetScroll}>
                    {BARBER_PRESETS[serviceForm.category].map((preset) => {
                      const isSelected = serviceForm.name === preset.name;
                      return (
                        <Pressable
                          key={preset.name}
                          style={[
                            styles.presetChip,
                            isSelected && styles.presetChipActive
                          ]}
                          onPress={() => {
                            setServiceForm(prev => ({
                              ...prev,
                              name: preset.name,
                              price: preset.price,
                              originalPrice: preset.price,
                              discountAmount: "0",
                              durationMinutes: preset.duration
                            }));
                          }}
                        >
                          <Text style={[
                            styles.presetChipText,
                            isSelected && styles.presetChipTextActive
                          ]}>
                            {preset.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              <View style={styles.rowInputs}>
                <View style={[styles.inputWrapper, { flex: 1, marginRight: 6 }]}>
                  <Text style={styles.inputLabel}>Duration (mins)</Text>
                  <TextInput
                    style={styles.inputField}
                    value={serviceForm.durationMinutes}
                    onChangeText={(t) => setServiceForm((prev) => ({ ...prev, durationMinutes: t }))}
                    placeholder="30"
                    keyboardType="number-pad"
                  />
                </View>
                <View style={[styles.inputWrapper, { flex: 1, marginLeft: 6 }]}>
                  <Text style={styles.inputLabel}>Base Price (₹)</Text>
                  <TextInput
                    style={styles.inputField}
                    value={serviceForm.originalPrice}
                    onChangeText={(t) => setServiceForm((prev) => ({ ...prev, originalPrice: t }))}
                    placeholder="250"
                    keyboardType="number-pad"
                  />
                </View>
              </View>

              <View style={styles.rowInputs}>
                <View style={[styles.inputWrapper, { flex: 1, marginRight: 6 }]}>
                  <Text style={styles.inputLabel}>Discount (₹)</Text>
                  <TextInput
                    style={styles.inputField}
                    value={serviceForm.discountAmount}
                    onChangeText={(t) => setServiceForm((prev) => ({ ...prev, discountAmount: t }))}
                    placeholder="e.g. 50"
                    keyboardType="number-pad"
                  />
                </View>
                <View style={[styles.inputWrapper, { flex: 1, marginLeft: 6 }]}>
                  <Text style={styles.inputLabel}>Final Price (₹)</Text>
                  <View style={[styles.inputField, { backgroundColor: "#f1f5f9", justifyContent: "center" }]}>
                    <Text style={{ color: "#475569" }}>
                      {(() => {
                        const orig = parseFloat(serviceForm.originalPrice || "0");
                        const disc = parseFloat(serviceForm.discountAmount || "0");
                        const final = Math.max(0, orig - disc);
                        const pct = orig > 0 ? Math.round((disc / orig) * 100) : 0;
                        return `₹${final} ${pct > 0 ? `(${pct}% OFF)` : ""}`;
                      })()}
                    </Text>
                  </View>
                </View>
              </View>


              <Pressable style={styles.primarySolidBtn} onPress={handleSaveService}>
                <Text style={styles.primarySolidBtnText}>Save Service</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL: BEAUTY PARLOR BULK ADD */}
      <Modal visible={beautyParlorModalVisible} transparent animationType="slide" onRequestClose={() => setBeautyParlorModalVisible(false)}>
        <View style={styles.sheetBg}>
          <View style={[styles.sheetBox, { maxHeight: "90%" }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Add {activeTab === "Home Services" ? (form.categoryType === "Tailor" || user?.role === "tailor" ? "Premium Service" : "Home Services") : "Shop Services"}</Text>
              <Pressable onPress={() => setBeautyParlorModalVisible(false)}>
                <Ionicons name="close-circle" size={26} color="#cbd5e1" />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.sheetContent}>
              <Text style={{ fontSize: 14, color: "#64748b", marginBottom: 20 }}>Select services from categories below to add them to your profile.</Text>

              {(form.categoryType === "Tailor" || user?.role === "tailor" ? TAILOR_CATEGORIES : BEAUTY_PARLOR_CATEGORIES).map((cat) => (
                <View key={cat.name} style={styles.accordionContainer}>
                  <Pressable style={styles.accordionHeader} onPress={() => toggleCategory(cat.name)}>
                    <Text style={styles.accordionTitle}>{cat.name}</Text>
                    <Ionicons name={expandedCategory === cat.name ? "chevron-up" : "chevron-down"} size={20} color="#6d28d9" />
                  </Pressable>

                  {expandedCategory === cat.name && (
                    <View style={styles.accordionContent}>
                      {cat.services.map(svcName => {
                        const isSelected = selectedParlorServices.find(s => s.name === svcName);
                        return (
                          <View key={svcName} style={styles.parlorServiceItem}>
                            <Pressable style={styles.checkboxContainer} onPress={() => handleToggleParlorService(svcName, cat.name)}>
                              <Ionicons
                                name={isSelected ? "checkbox" : "square-outline"}
                                size={24}
                                color={isSelected ? "#6d28d9" : "#cbd5e1"}
                              />
                              <Text style={styles.parlorServiceName}>{svcName}</Text>
                            </Pressable>

                            {isSelected && (
                              <View style={styles.parlorServiceInputs}>
                                <View style={styles.inputGroup}>
                                  <Text style={styles.inputLabel}>Price (₹)</Text>
                                  <TextInput
                                    style={styles.smallInput}
                                    value={isSelected.price}
                                    keyboardType="number-pad"
                                    onChangeText={(val) => updateParlorService(svcName, 'price', val)}
                                  />
                                </View>
                                {!(form.categoryType === "Tailor" || user?.role === "tailor") && (
                                  <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Time (Mins)</Text>
                                    <TextInput
                                      style={styles.smallInput}
                                      value={isSelected.durationMinutes}
                                      keyboardType="number-pad"
                                      onChangeText={(val) => updateParlorService(svcName, 'durationMinutes', val)}
                                    />
                                  </View>
                                )}
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              ))}

              <View style={[styles.accordionContainer, { padding: 16, marginTop: 10 }]}>
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#334155", marginBottom: 12 }}>Add Custom Service</Text>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Service Name (e.g., Full Makeup)</Text>
                  <TextInput
                    style={styles.smallInput}
                    placeholder="Enter service name"
                    value={customServiceName}
                    onChangeText={setCustomServiceName}
                  />
                </View>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>Price (₹)</Text>
                    <TextInput
                      style={styles.smallInput}
                      value={customServicePrice}
                      keyboardType="number-pad"
                      onChangeText={setCustomServicePrice}
                      placeholder="500"
                    />
                  </View>
                  {!(form.categoryType === "Tailor" || user?.role === "tailor") && (
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.inputLabel}>Time (Mins)</Text>
                      <TextInput
                        style={styles.smallInput}
                        value={customServiceDuration}
                        keyboardType="number-pad"
                        onChangeText={setCustomServiceDuration}
                        placeholder="60"
                      />
                    </View>
                  )}
                </View>
                <Pressable style={[styles.primarySolidBtn, { marginTop: 10 }]} onPress={handleAddCustomServiceDirect}>
                  <Text style={styles.primarySolidBtnText}>Add Custom Service</Text>
                </Pressable>
              </View>

              <Pressable style={[styles.primarySolidBtn, { backgroundColor: "#16a34a", marginTop: 20 }]} onPress={handleSaveParlorServices}>
                <Text style={styles.primarySolidBtnText}>Save Selected Services</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: "#f8fafc" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },

  headerTitleContainer: { paddingHorizontal: 20, paddingTop: 0, paddingBottom: 4 },
  headerTitleText: { fontSize: 28, fontWeight: "900", color: "#0f172a" },

  segmentedControl: {
    flexDirection: "row",
    backgroundColor: "#e2e8f0",
    borderRadius: 12,
    marginHorizontal: 20,
    padding: 4,
    marginBottom: 0,
  },
  segmentBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  segmentBtnActive: { backgroundColor: "#ffffff", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  segmentBtnText: { fontSize: 13, fontWeight: "600", color: "#64748b" },
  segmentBtnTextActive: { color: "#0f172a", fontWeight: "700" },

  // SERVICES TAB
  servicesToolbar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginBottom: 16 },
  subFilters: { flexDirection: "row", gap: 8 },
  subFilterBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#e2e8f0" },
  subFilterBtnActive: { backgroundColor: "#0f172a", borderColor: "#0f172a" },
  subFilterText: { fontSize: 12, fontWeight: "600", color: "#64748b" },
  subFilterTextActive: { color: "#ffffff" },

  addServiceBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#6d28d9", paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20 },
  addServiceBtnText: { fontSize: 13, fontWeight: "700", color: "#ffffff", marginLeft: 4 },

  listContainer: { paddingHorizontal: 20, paddingBottom: 100 },
  servicePremiumCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
    overflow: "hidden",
  },
  svcHeader: { flexDirection: "row", alignItems: "center", padding: 16 },
  svcIconWrapper: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#f3e8ff", justifyContent: "center", alignItems: "center" },
  svcInfo: { flex: 1, marginLeft: 14 },
  svcNameText: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  svcMetaText: { fontSize: 13, color: "#64748b", fontWeight: "600", marginTop: 4 },

  svcFooter: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#f1f5f9", backgroundColor: "#fafafa" },
  svcFtBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12 },
  svcFtDivider: { width: 1, backgroundColor: "#f1f5f9" },
  svcFtBtnText: { fontSize: 13, fontWeight: "600", color: "#64748b", marginLeft: 6 },

  emptyStateBox: { alignItems: "center", justifyContent: "center", paddingVertical: 60, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: "#0f172a", marginTop: 16 },
  emptySub: { fontSize: 14, color: "#64748b", textAlign: "center", marginTop: 8, lineHeight: 20 },

  // SHOP SETUP TAB
  formContent: { paddingBottom: 40 },
  coverImageContainer: { width: "100%", height: 220, position: "relative" },
  coverImg: { width: "100%", height: "100%" },
  coverOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.3)" },
  changeCoverBadge: { position: "absolute", top: 16, right: 16, backgroundColor: "#ffffff", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, flexDirection: "row", alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 4 },
  changeCoverText: { fontSize: 13, fontWeight: "700", color: "#0f172a", marginLeft: 6 },

  formCard: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: -40,
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 40,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 4,
  },

  profileHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  profileShopName: { fontSize: 24, fontWeight: "900", color: "#0f172a" },
  profileCategoryText: { fontSize: 14, color: "#6d28d9", fontWeight: "700", marginTop: 4 },
  editCategoryBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#f3e8ff", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  editCategoryText: { fontSize: 12, fontWeight: "700", color: "#6d28d9", marginLeft: 4 },

  profileBioText: { fontSize: 14, color: "#475569", lineHeight: 22, marginBottom: 20 },

  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f8fafc", padding: 16, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: "#f1f5f9" },
  switchTitle: { fontSize: 15, fontWeight: "800", color: "#0f172a" },
  switchSub: { fontSize: 13, color: "#64748b", marginTop: 2 },

  infoRow: { flexDirection: "row", alignItems: "center", marginBottom: 20, paddingRight: 20 },
  infoIconBg: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#f3e8ff", justifyContent: "center", alignItems: "center", marginRight: 12 },
  infoText: { flex: 1, fontSize: 14, color: "#475569", lineHeight: 20 },
  addGalleryBtn: { width: "100%", height: 100, backgroundColor: "#f8fafc", borderRadius: 12, borderWidth: 2, borderColor: "#e2e8f0", borderStyle: "dashed", justifyContent: "center", alignItems: "center", marginTop: 4 },
  addGalleryText: { fontSize: 13, color: "#64748b", fontWeight: "600", marginTop: 4 },

  overviewContainer: { padding: 20 },
  emergencyCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#fef2f2", padding: 16, borderRadius: 16, borderWidth: 1, borderColor: "#fecaca", marginBottom: 20 },
  emergencyInfo: { flex: 1, marginRight: 12 },
  emergencyTitle: { fontSize: 16, fontWeight: "800", color: "#991b1b", marginBottom: 4 },
  emergencyDesc: { fontSize: 13, color: "#b91c1c" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 12, marginBottom: 20 },
  statCard: { width: "48%", backgroundColor: "#ffffff", padding: 16, borderRadius: 16, borderWidth: 1, borderColor: "#e2e8f0", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, alignItems: "center" },
  statValue: { fontSize: 24, fontWeight: "900", color: "#0f172a", marginTop: 8, marginBottom: 4 },
  statLabel: { fontSize: 12, fontWeight: "600", color: "#64748b", textAlign: "center" },
  exportBtn: { flexDirection: "row", backgroundColor: "#0f172a", paddingVertical: 14, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 12 },
  exportBtnText: { color: "#ffffff", fontSize: 15, fontWeight: "700", marginLeft: 8 },

  sectionDivider: { height: 1, backgroundColor: "#e2e8f0", marginVertical: 20 },

  whHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  sectionHeaderTxt: { fontSize: 18, fontWeight: "800", color: "#0f172a" },
  whEditText: { fontSize: 14, fontWeight: "700", color: "#6d28d9" },

  workingHoursContainer: { backgroundColor: "#f8fafc", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#f1f5f9" },
  whDisplayRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  whDisplayDay: { fontSize: 14, fontWeight: "600", color: "#475569", width: 50 },
  whTimeText: { fontSize: 14, color: "#0f172a", fontWeight: "700" },
  whClosedDisplay: { fontSize: 14, color: "#ef4444", fontWeight: "700" },

  primarySolidBtn: { backgroundColor: "#6d28d9", borderRadius: 16, height: 56, paddingHorizontal: 24, alignItems: "center", justifyContent: "center", marginTop: 10 },
  primarySolidBtnText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },

  // ONBOARDING
  onboardHeader: { padding: 24, paddingBottom: 16 },
  onboardTitle: { fontSize: 26, fontWeight: "900", color: "#0f172a" },
  onboardSub: { fontSize: 15, color: "#64748b", marginTop: 6 },
  onboardList: { paddingHorizontal: 20, paddingBottom: 40 },
  onboardCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#ffffff", padding: 16, borderRadius: 20, marginBottom: 12, borderWidth: 2, borderColor: "transparent", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  onboardCardSelected: { borderColor: "#6d28d9" },
  onboardIconBg: { width: 52, height: 52, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  onboardCardInfo: { flex: 1, marginLeft: 16 },
  onboardCardTitle: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  onboardCardDesc: { fontSize: 13, color: "#64748b", marginTop: 2 },

  // MODALS
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" },
  modalBox: { width: "80%", backgroundColor: "#ffffff", borderRadius: 24, padding: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#0f172a", marginBottom: 16, textAlign: "center" },
  modalOption: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  modalOptionText: { fontSize: 15, color: "#475569", fontWeight: "600" },
  modalOptionTextActive: { color: "#6d28d9", fontWeight: "800" },

  sheetBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheetBox: { backgroundColor: "#ffffff", borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingBottom: 30, maxHeight: "85%" },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 24, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  sheetTitle: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  sheetContent: { padding: 24 },

  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tagBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#e2e8f0" },
  tagBtnActive: { backgroundColor: "#f3e8ff", borderColor: "#d8b4fe" },
  tagBtnText: { fontSize: 13, fontWeight: "600", color: "#64748b" },
  tagBtnTextActive: { color: "#7c3aed" },

  galleryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 4 },
  galleryItemBox: { width: 80, height: 80, borderRadius: 12, overflow: "hidden" },
  galleryImage: { width: "100%", height: "100%" },
  removeBtn: { position: "absolute", top: 4, right: 4, backgroundColor: "rgba(0,0,0,0.5)", width: 24, height: 24, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  addGalleryBtn: { width: 80, height: 80, borderRadius: 12, borderWidth: 2, borderColor: "#c4b5fd", borderStyle: "dashed", backgroundColor: "#f5f3ff", justifyContent: "center", alignItems: "center" },

  // Accordion styles for beauty parlor
  accordionContainer: { marginBottom: 12, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 12, overflow: "hidden" },
  accordionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, backgroundColor: "#f8fafc" },
  accordionTitle: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  accordionContent: { padding: 16, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#e2e8f0" },
  parlorServiceItem: { marginBottom: 16 },
  checkboxContainer: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  parlorServiceName: { fontSize: 14, fontWeight: "500", color: "#334155", marginLeft: 8 },
  parlorServiceInputs: { flexDirection: "row", marginLeft: 32, gap: 12 },
  inputGroup: { flex: 1 },
  inputLabel: { fontSize: 12, color: "#64748b", marginBottom: 4 },
  smallInput: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: "#0f172a" },
  presetScroll: {
    paddingVertical: 4,
    gap: 8,
  },
  presetChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  presetChipActive: {
    backgroundColor: "#f3e8ff",
    borderColor: "#a855f7",
  },
  presetChipText: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "500",
  },
  presetChipTextActive: {
    color: "#6d28d9",
    fontWeight: "600",
  },
  rangeControlContainer: {
    flexDirection: "row",
    backgroundColor: "#e2e8f0",
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  rangeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  rangeBtnActive: {
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  rangeBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
  },
  rangeBtnTextActive: {
    color: "#6d28d9",
    fontWeight: "700",
  }
});
