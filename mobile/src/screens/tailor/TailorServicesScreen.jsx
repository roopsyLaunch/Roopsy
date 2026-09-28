import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable,
  RefreshControl, Alert, TextInput, ScrollView, Modal, Switch, Image
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { promptServiceImagePicker } from "../../services/imagePickerService";
import { api } from "../../api/client";
import { uploadImageAsync } from "../../api/upload";
import { useAuth } from "../../context/AuthContext";
import { useFocusEffect } from "@react-navigation/native";

const PREDEFINED_SERVICES = {
  "👚 Blouse Stitching Services": [
    "Simple Blouse", "Designer Blouse", "Bridal Blouse", "Padded Blouse", "Princess Cut Blouse", "High Neck Blouse", "Boat Neck Blouse", "Backless Blouse", "Sleeveless Blouse", "Readymade Blouse Alteration"
  ],
  "👗 Kurti Stitching Services": [
    "Straight Kurti", "A-Line Kurti", "Anarkali Kurti", "Flared Kurti", "Jacket Style Kurti", "Umbrella Kurti", "Angrakha Kurti", "High-Low Kurti", "Office Wear Kurti", "Designer Kurti"
  ],
  "🥻 Salwar Suit Stitching Services": [
    "Punjabi Suit", "Churidar Suit", "Palazzo Suit", "Patiala Suit", "Sharara Suit", "Garara Suit", "Anarkali Suit", "Straight Suit", "Designer Suit", "Cotton Suit"
  ],
  "👑 Lehenga Stitching Services": [
    "Bridal Lehenga", "Designer Lehenga", "Party Wear Lehenga", "Reception Lehenga", "Engagement Lehenga", "Kids Lehenga", "Semi-Stitched Lehenga", "Custom Lehenga"
  ],
  "👗 Gown Stitching Services": [
    "Party Gown", "Bridal Gown", "Maxi Gown", "Evening Gown", "Indo-Western Gown", "Ball Gown", "A-Line Gown", "Mermaid Gown", "Designer Gown", "Kids Gown"
  ],
  "🪡 Saree Services": [
    "Saree Fall", "Saree Pico", "Fall + Pico", "Saree Rolling", "Saree Tassel (Latkan)", "Saree Border Stitching", "Saree Repair", "Saree Finishing"
  ]
};

export function TailorServicesScreen() {
  const { tailor, refreshMe } = useAuth();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Active Section Mode: "shop", "premium", "home"
  const [activeSection, setActiveSection] = useState("shop");
  // Status Filter: "all", "active", "inactive"
  const [statusFilter, setStatusFilter] = useState("all");
  // Expanded Categories Accordions State
  const [expandedCategories, setExpandedCategories] = useState({});

  // Add Panel State
  const [isAdding, setIsAdding] = useState(false);
  const [targetMode, setTargetMode] = useState("shop");
  const [addMode, setAddMode] = useState("preset"); // "preset" or "custom"
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [newPrice, setNewPrice] = useState("");
  const [newDiscount, setNewDiscount] = useState("");
  const [newEstDays, setNewEstDays] = useState("3");
  const [newCompletionTime, setNewCompletionTime] = useState("24 Hours");
  const [newTimeVal, setNewTimeVal] = useState("24");
  const [newTimeUnit, setNewTimeUnit] = useState("Hours");
  const [customName, setCustomName] = useState("");
  const [customCategory, setCustomCategory] = useState("Custom Stitching");
  const [newImage, setNewImage] = useState(null);
  const [submittingAdd, setSubmittingAdd] = useState(false);
  const submittingAddRef = useRef(false);

  // Edit Modal State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editDiscount, setEditDiscount] = useState("0");
  const [editCategory, setEditCategory] = useState("");
  const [editDays, setEditDays] = useState("3");
  const [editCompletionTime, setEditCompletionTime] = useState("");
  const [editTimeVal, setEditTimeVal] = useState("24");
  const [editTimeUnit, setEditTimeUnit] = useState("Hours");
  const [editMode, setEditMode] = useState("shop");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editImage, setEditImage] = useState(null);
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const submittingEditRef = useRef(false);

  // Section Toggle States
  const [togglingSection, setTogglingSection] = useState(false);

  // Home & Premium Service Fee states
  const [homeFee, setHomeFee] = useState(String(tailor?.homeServiceFee ?? tailor?.visitFee ?? "0"));
  const [premiumFee, setPremiumFee] = useState(String(tailor?.premiumServiceFee ?? "0"));
  const [savingHomeFee, setSavingHomeFee] = useState(false);
  const [savingPremiumFee, setSavingPremiumFee] = useState(false);

  useEffect(() => {
    if (tailor) {
      if (tailor.homeServiceFee !== undefined || tailor.visitFee !== undefined) {
        setHomeFee(String(tailor.homeServiceFee ?? tailor.visitFee ?? "0"));
      }
      if (tailor.premiumServiceFee !== undefined) {
        setPremiumFee(String(tailor.premiumServiceFee ?? "0"));
      }
    }
  }, [tailor?.homeServiceFee, tailor?.visitFee, tailor?.premiumServiceFee]);

  const handleSaveHomeFee = async () => {
    const feeNum = Math.max(0, parseInt(homeFee, 10) || 0);
    setSavingHomeFee(true);
    try {
      await api.patch("/tailors/me", { homeServiceFee: feeNum, visitFee: feeNum });
      await refreshMe();
      setHomeFee(String(feeNum));
      Alert.alert(
        "Home Visit Charge Saved! 🏡",
        feeNum > 0
          ? `Customers will be charged ₹${feeNum} visit fee for home orders.`
          : "Home service visit is now set to FREE (₹0 charge) for customers."
      );
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Could not save home service charge.");
    } finally {
      setSavingHomeFee(false);
    }
  };

  const handleSavePremiumFee = async () => {
    const feeNum = Math.max(0, parseInt(premiumFee, 10) || 0);
    setSavingPremiumFee(true);
    try {
      await api.patch("/tailors/me", { premiumServiceFee: feeNum });
      await refreshMe();
      setPremiumFee(String(feeNum));
      Alert.alert(
        "Premium VIP Fee Saved! 👑",
        feeNum > 0
          ? `Customers will be charged ₹${feeNum} extra fee for VIP premium stitching.`
          : "Premium VIP service is now set to FREE (₹0 extra fee) for customers."
      );
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Could not save premium VIP service fee.");
    } finally {
      setSavingPremiumFee(false);
    }
  };

  const loadServices = useCallback(async () => {
    try {
      const res = await api.get("/tailors/me/services").catch(async () => {
        const tailorId = tailor?.id || tailor?._id;
        if (tailorId) {
          return await api.get(`/tailors/${tailorId}/services`);
        }
        return { data: { services: [] } };
      });
      setServices(res.data.services || []);
    } catch (err) {
      console.error("Error loading tailor services:", err);
    }
  }, [tailor]);

  useFocusEffect(
    useCallback(() => {
      loadServices().finally(() => setLoading(false));
    }, [loadServices])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadServices();
    await refreshMe().catch(() => {});
    setRefreshing(false);
  };

  const handleToggleModeOffer = async (modeKey, currentValue) => {
    setTogglingSection(true);
    try {
      const nextVal = !currentValue;
      const payload = { [modeKey]: nextVal };
      if (modeKey === "offersShopService") {
        payload.isShopOpen = nextVal;
      }
      await api.patch("/tailors/me", payload);
      await refreshMe();
      Alert.alert("Success", "Service mode updated successfully.");
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Could not update service mode setting.");
    } finally {
      setTogglingSection(false);
    }
  };

  const handleUpdateNewDuration = (val, unit) => {
    const cleanVal = String(val).replace(/[^0-9]/g, "");
    setNewTimeVal(cleanVal);
    const targetUnit = unit || newTimeUnit;
    if (unit) setNewTimeUnit(unit);

    if (!cleanVal) {
      setNewCompletionTime("");
      return;
    }
    const num = parseInt(cleanVal, 10);
    const unitLabel = targetUnit === "Hours" ? (num === 1 ? "Hour" : "Hours") : (num === 1 ? "Day" : "Days");
    const formatted = `${num} ${unitLabel}`;
    setNewCompletionTime(formatted);
    if (targetUnit === "Days") {
      setNewEstDays(String(Math.max(1, num)));
    } else {
      setNewEstDays("1");
    }
  };

  const applyPresetNew = (timeOpt) => {
    setNewCompletionTime(timeOpt);
    const parts = timeOpt.split(" ");
    const num = parts[0] || "24";
    const unit = timeOpt.includes("Day") ? "Days" : "Hours";
    setNewTimeVal(num);
    setNewTimeUnit(unit);
    const daysNum = unit === "Days" ? parseInt(num, 10) : 1;
    setNewEstDays(String(daysNum));
  };

  const handleUpdateEditDuration = (val, unit) => {
    const cleanVal = String(val).replace(/[^0-9]/g, "");
    setEditTimeVal(cleanVal);
    const targetUnit = unit || editTimeUnit;
    if (unit) setEditTimeUnit(unit);

    if (!cleanVal) {
      setEditCompletionTime("");
      return;
    }
    const num = parseInt(cleanVal, 10);
    const unitLabel = targetUnit === "Hours" ? (num === 1 ? "Hour" : "Hours") : (num === 1 ? "Day" : "Days");
    const formatted = `${num} ${unitLabel}`;
    setEditCompletionTime(formatted);
    if (targetUnit === "Days") {
      setEditDays(String(Math.max(1, num)));
    } else {
      setEditDays("1");
    }
  };

  const applyPresetEdit = (timeOpt) => {
    setEditCompletionTime(timeOpt);
    const parts = timeOpt.split(" ");
    const num = parts[0] || "24";
    const unit = timeOpt.includes("Day") ? "Days" : "Hours";
    setEditTimeVal(num);
    setEditTimeUnit(unit);
    const daysNum = unit === "Days" ? parseInt(num, 10) : 1;
    setEditDays(String(daysNum));
  };

  const handleOpenAdd = () => {
    setTargetMode(activeSection);
    setIsAdding(true);
    setSelectedCategory(null);
    setSelectedService(null);
    setCustomName("");
    setNewPrice("");
    setNewDiscount("");
    setNewCompletionTime(activeSection === "premium" ? "24 Hours" : "");
    setNewTimeVal(activeSection === "premium" ? "24" : "");
    setNewTimeUnit("Hours");
    setNewEstDays(activeSection === "premium" ? "1" : "3");
    setNewImage(null);
  };

  const handleAddService = async () => {
    if (submittingAddRef.current || submittingAdd) return;
    const nameToSave = addMode === "preset" ? selectedService : customName.trim();
    const categoryToSave = addMode === "preset" ? selectedCategory : customCategory.trim();
    
    if (!nameToSave || !newPrice) {
      return Alert.alert("Required Fields", "Please enter a service name and price.");
    }
    
    submittingAddRef.current = true;
    setSubmittingAdd(true);
    try {
      let uploadedImages = [];
      if (newImage) {
        try {
          const url = await uploadImageAsync(newImage);
          if (url) uploadedImages.push(url);
        } catch (e) {
          console.error("Failed to upload service image:", e);
        }
      }

      const orig = Number(newPrice) || 0;
      const disc = Number(newDiscount) || 0;
      const finalPrice = Math.max(0, orig - disc);

      await api.post("/tailors/services", {
        name: nameToSave,
        price: finalPrice,
        originalPrice: orig,
        discountAmount: disc,
        category: categoryToSave || "Stitching Services",
        estimatedDays: Number(newEstDays) || 3,
        completionTime: targetMode === "premium" ? (newCompletionTime.trim() || "24 Hours") : "",
        serviceMode: targetMode,
        isActive: true,
        genderCategory: "unisex",
        images: uploadedImages,
      });
      
      setIsAdding(false);
      setSelectedCategory(null);
      setSelectedService(null);
      setCustomName("");
      setNewPrice("");
      setNewDiscount("");
      setNewEstDays("3");
      setNewCompletionTime("24 Hours");
      setNewTimeVal("24");
      setNewTimeUnit("Hours");
      setNewImage(null);
      await loadServices();
      Alert.alert("Success", `Service added to ${targetMode.toUpperCase()} catalog successfully!`);
    } catch (err) {
      console.error(err);
      Alert.alert("Error", err?.response?.data?.error || "Could not add service.");
    } finally {
      submittingAddRef.current = false;
      setSubmittingAdd(false);
    }
  };

  const handleOpenEdit = (svc) => {
    setEditingService(svc);
    setEditName(svc.name || "");
    setEditPrice(String(svc.originalPrice || svc.price || ""));
    setEditDiscount(String(svc.discountAmount || "0"));
    setEditCategory(svc.category || "Custom Stitching");
    setEditDays(String(svc.estimatedDays || 3));
    const comp = svc.completionTime || (svc.serviceMode === "premium" ? "24 Hours" : "");
    setEditCompletionTime(comp);

    if (comp) {
      const match = comp.match(/(\d+)\s*(hour|day)/i);
      if (match) {
        setEditTimeVal(match[1]);
        setEditTimeUnit(match[2].toLowerCase().startsWith("day") ? "Days" : "Hours");
      } else {
        setEditTimeVal("24");
        setEditTimeUnit("Hours");
      }
    } else {
      setEditTimeVal("24");
      setEditTimeUnit("Hours");
    }

    setEditMode(svc.serviceMode || "shop");
    setEditIsActive(svc.isActive !== false);
    setEditImage(svc.images?.[0] || null);
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (submittingEditRef.current || submittingEdit) return;
    if (!editName.trim() || !editPrice) {
      return Alert.alert("Required Fields", "Please provide a valid service name and price.");
    }
    submittingEditRef.current = true;
    setSubmittingEdit(true);
    try {
      let uploadedImages = [];
      if (editImage) {
        if (editImage.startsWith("http")) {
          uploadedImages.push(editImage);
        } else {
          try {
            const url = await uploadImageAsync(editImage);
            if (url) uploadedImages.push(url);
          } catch (e) {
            console.error("Failed to upload service photo:", e);
          }
        }
      }

      const orig = Number(editPrice) || 0;
      const disc = Number(editDiscount) || 0;
      const finalPrice = Math.max(0, orig - disc);

      await api.patch(`/tailors/services/${editingService._id}`, {
        name: editName.trim(),
        price: finalPrice,
        originalPrice: orig,
        discountAmount: disc,
        category: editCategory.trim(),
        estimatedDays: Number(editDays) || 3,
        completionTime: editMode === "premium" ? (editCompletionTime.trim() || "24 Hours") : "",
        serviceMode: editMode,
        isActive: editIsActive,
        images: uploadedImages,
      });
      setEditModalVisible(false);
      setEditingService(null);
      setEditImage(null);
      await loadServices();
      Alert.alert("Updated ✅", "Service updated successfully!");
    } catch (err) {
      console.error(err);
      Alert.alert("Error", err?.response?.data?.error || "Could not update service.");
    } finally {
      submittingEditRef.current = false;
      setSubmittingEdit(false);
    }
  };

  const handleToggleActiveQuick = async (svc) => {
    try {
      await api.patch(`/tailors/services/${svc._id}`, {
        isActive: !svc.isActive
      });
      await loadServices();
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Could not toggle service status.");
    }
  };

  const handleDelete = (svc) => {
    Alert.alert(
      "Delete Service",
      `Are you sure you want to remove "${svc.name}" from your catalog?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/tailors/services/${svc._id}`);
              await loadServices();
              Alert.alert("Removed", "Service removed from catalog.");
            } catch (err) {
              console.error(err);
              Alert.alert("Error", "Could not delete service.");
            }
          }
        }
      ]
    );
  };

  const toggleCategory = (cat) => {
    if (selectedCategory === cat) {
      setSelectedCategory(null);
    } else {
      setSelectedCategory(cat);
    }
  };

  // Filter services by Section (shop, premium, home) and Status (all, active, inactive)
  const sectionServices = services.filter(s => (s.serviceMode || "shop") === activeSection);
  
  const filteredServices = sectionServices.filter(s => {
    const isAct = s.isActive !== false;
    if (statusFilter === "active") return isAct;
    if (statusFilter === "inactive") return !isAct;
    return true;
  });

  const activeCount = sectionServices.filter(s => s.isActive !== false).length;
  const inactiveCount = sectionServices.filter(s => s.isActive === false).length;

  if (loading && services.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6d28d9" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <Text style={styles.mainTitle}>Manage Shop Services</Text>
        <Text style={styles.mainSubtitle}>Configure & manage your stitching catalog</Text>
      </View>

      {/* Service Mode Tabs: Shop | Premium */}
      <View style={styles.sectionTabsWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sectionTabsContainer}>
          {[
            { key: "shop", label: "Shop Services", icon: "storefront", color: "#0369a1" },
            { key: "premium", label: "Premium Service", icon: "ribbon", color: "#7c3aed" }
          ].map(tab => {
            const isActive = activeSection === tab.key;
            return (
              <Pressable
                key={tab.key}
                style={[styles.sectionTab, isActive && styles.sectionTabActive]}
                onPress={() => setActiveSection(tab.key)}
              >
                <Ionicons name={tab.icon} size={16} color={isActive ? "#ffffff" : tab.color} style={{ marginRight: 6 }} />
                <Text style={[styles.sectionTabText, isActive && styles.sectionTabTextActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Mode Enable/Disable Banners */}
      {activeSection === "shop" ? (
        <View style={{ gap: 10, marginHorizontal: 20, marginBottom: 14 }}>
          {/* Shop Visit Toggle */}
          <View style={[styles.modeConfigBanner, { marginHorizontal: 0, marginBottom: 0 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modeConfigTitle}>Shop Visit Booking</Text>
              <Text style={styles.modeConfigDesc}>Allow customers to visit your shop for measurement & orders.</Text>
            </View>
            <Switch
              value={tailor?.offersShopService !== false}
              onValueChange={() => handleToggleModeOffer("offersShopService", tailor?.offersShopService !== false)}
              disabled={togglingSection}
              trackColor={{ false: "#cbd5e1", true: "#c4b5fd" }}
              thumbColor={tailor?.offersShopService !== false ? "#6d28d9" : "#94a3b8"}
            />
          </View>

          {/* Home Service Delivery Toggle */}
          <View style={[styles.modeConfigBanner, { marginHorizontal: 0, marginBottom: 0, backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" }]}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="home" size={16} color="#059669" />
                <Text style={[styles.modeConfigTitle, { color: "#065f46" }]}>Home Service & Delivery Option</Text>
              </View>
              <Text style={[styles.modeConfigDesc, { color: "#166534" }]}>
                {tailor?.offersHomeService ? "ON: Customers CAN select Home Service & doorstep visit." : "OFF: Home Service option HIDDEN from customer booking."}
              </Text>
            </View>
            <Switch
              value={Boolean(tailor?.offersHomeService)}
              onValueChange={() => handleToggleModeOffer("offersHomeService", Boolean(tailor?.offersHomeService))}
              disabled={togglingSection}
              trackColor={{ false: "#cbd5e1", true: "#86efac" }}
              thumbColor={tailor?.offersHomeService ? "#059669" : "#94a3b8"}
            />
          </View>

          {/* Home Service Visit Charge Card */}
          {Boolean(tailor?.offersHomeService) && (
            <View style={styles.feeConfigCard}>
              <View style={styles.feeConfigHeader}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.feeConfigTitle}>Doorstep Visit Charge</Text>
                  <Text style={styles.feeConfigSubtitle}>
                    {Number(homeFee) > 0 ? `Customers pay ₹${homeFee} visit fee when ordering home service.` : "Home service is set to FREE (₹0 charge) for customers."}
                  </Text>
                </View>
                <View style={[styles.feeStatusBadge, Number(homeFee) > 0 ? styles.feeStatusBadgePaid : styles.feeStatusBadgeFree]}>
                  <Text style={[styles.feeStatusText, Number(homeFee) > 0 ? styles.feeStatusTextPaid : styles.feeStatusTextFree]}>
                    {Number(homeFee) > 0 ? `₹${homeFee} Visit Charge` : "FREE VISIT"}
                  </Text>
                </View>
              </View>

              {/* Quick Preset Buttons */}
              <View style={styles.quickPresetRow}>
                {[0, 50, 100, 150, 200].map((amt) => {
                  const isSelected = String(amt) === String(homeFee || 0);
                  return (
                    <Pressable
                      key={amt}
                      style={[styles.presetChip, isSelected && styles.presetChipActive]}
                      onPress={() => setHomeFee(String(amt))}
                    >
                      <Text style={[styles.presetChipText, isSelected && styles.presetChipTextActive]}>
                        {amt === 0 ? "FREE (₹0)" : `₹${amt}`}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Custom Input & Save Button */}
              <View style={styles.feeInputRow}>
                <View style={styles.inputWrapper}>
                  <Text style={styles.currencyPrefix}>₹</Text>
                  <TextInput
                    style={styles.feeInput}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#94a3b8"
                    value={homeFee}
                    onChangeText={setHomeFee}
                  />
                </View>
                <Pressable
                  style={[styles.saveFeeBtn, savingHomeFee && { opacity: 0.7 }]}
                  onPress={handleSaveHomeFee}
                  disabled={savingHomeFee}
                >
                  {savingHomeFee ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={16} color="#ffffff" style={{ marginRight: 4 }} />
                      <Text style={styles.saveFeeBtnText}>Save Charge</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          )}
        </View>
      ) : (
        <View style={{ gap: 10, marginHorizontal: 20, marginBottom: 14 }}>
          <View style={[styles.modeConfigBanner, { marginHorizontal: 0, marginBottom: 0, backgroundColor: "#faf5ff", borderColor: "#e9d5ff" }]}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="ribbon" size={16} color="#7c3aed" />
                <Text style={[styles.modeConfigTitle, { color: "#581c87" }]}>Premium VIP Stitching Service</Text>
              </View>
              <Text style={[styles.modeConfigDesc, { color: "#6b21a8" }]}>
                {tailor?.offersPremiumService ? "ON: Customers CAN select Premium VIP stitching." : "OFF: Premium VIP option HIDDEN from customer booking."}
              </Text>
            </View>
            <Switch
              value={Boolean(tailor?.offersPremiumService)}
              onValueChange={() => handleToggleModeOffer("offersPremiumService", Boolean(tailor?.offersPremiumService))}
              disabled={togglingSection}
              trackColor={{ false: "#cbd5e1", true: "#c4b5fd" }}
              thumbColor={tailor?.offersPremiumService ? "#7c3aed" : "#94a3b8"}
            />
          </View>

          {/* Premium VIP Fee Card */}
          {Boolean(tailor?.offersPremiumService) && (
            <View style={[styles.feeConfigCard, { borderColor: "#ddd6fe", backgroundColor: "#faf5ff" }]}>
              <View style={styles.feeConfigHeader}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.feeConfigTitle, { color: "#581c87" }]}>Premium VIP Service Fee</Text>
                  <Text style={[styles.feeConfigSubtitle, { color: "#6b21a8" }]}>
                    {Number(premiumFee) > 0 ? `Customers pay ₹${premiumFee} extra fee for VIP priority stitching.` : "Premium VIP service is set to FREE (₹0 extra fee) for customers."}
                  </Text>
                </View>
                <View style={[styles.feeStatusBadge, Number(premiumFee) > 0 ? { backgroundColor: "#f3e8ff", borderColor: "#c084fc" } : styles.feeStatusBadgeFree]}>
                  <Text style={[styles.feeStatusText, Number(premiumFee) > 0 ? { color: "#7c3aed" } : styles.feeStatusTextFree]}>
                    {Number(premiumFee) > 0 ? `₹${premiumFee} VIP Fee` : "FREE VIP"}
                  </Text>
                </View>
              </View>

              {/* Quick Preset Buttons */}
              <View style={styles.quickPresetRow}>
                {[0, 100, 200, 250, 500].map((amt) => {
                  const isSelected = String(amt) === String(premiumFee || 0);
                  return (
                    <Pressable
                      key={amt}
                      style={[styles.presetChip, isSelected && { backgroundColor: "#7c3aed", borderColor: "#7c3aed" }]}
                      onPress={() => setPremiumFee(String(amt))}
                    >
                      <Text style={[styles.presetChipText, isSelected && styles.presetChipTextActive]}>
                        {amt === 0 ? "FREE (₹0)" : `₹${amt}`}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Custom Input & Save Button */}
              <View style={styles.feeInputRow}>
                <View style={styles.inputWrapper}>
                  <Text style={[styles.currencyPrefix, { color: "#7c3aed" }]}>₹</Text>
                  <TextInput
                    style={styles.feeInput}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#94a3b8"
                    value={premiumFee}
                    onChangeText={setPremiumFee}
                  />
                </View>
                <Pressable
                  style={[styles.saveFeeBtn, { backgroundColor: "#7c3aed" }, savingPremiumFee && { opacity: 0.7 }]}
                  onPress={handleSavePremiumFee}
                  disabled={savingPremiumFee}
                >
                  {savingPremiumFee ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={16} color="#ffffff" style={{ marginRight: 4 }} />
                      <Text style={styles.saveFeeBtnText}>Save Fee</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Status Filter Chips & Add Service Button */}
      <View style={styles.filterBar}>
        <View style={styles.chipsGroup}>
          <Pressable
            style={[styles.chip, statusFilter === "all" && styles.chipActive]}
            onPress={() => setStatusFilter("all")}
          >
            <Text style={[styles.chipText, statusFilter === "all" && styles.chipTextActive]}>
              All ({sectionServices.length})
            </Text>
          </Pressable>
          <Pressable
            style={[styles.chip, statusFilter === "active" && styles.chipActive]}
            onPress={() => setStatusFilter("active")}
          >
            <Text style={[styles.chipText, statusFilter === "active" && styles.chipTextActive]}>
              Active ({activeCount})
            </Text>
          </Pressable>
          <Pressable
            style={[styles.chip, statusFilter === "inactive" && styles.chipActive]}
            onPress={() => setStatusFilter("inactive")}
          >
            <Text style={[styles.chipText, statusFilter === "inactive" && styles.chipTextActive]}>
              Inactive ({inactiveCount})
            </Text>
          </Pressable>
        </View>

        <Pressable style={styles.addServiceBtn} onPress={handleOpenAdd}>
          <Ionicons name="add" size={18} color="#ffffff" style={{ marginRight: 4 }} />
          <Text style={styles.addServiceBtnText}>+ Add Service</Text>
        </Pressable>
      </View>

      {/* Services Category Accordion List */}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6d28d9" />}
      >
        {filteredServices.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="list-outline" size={42} color="#94a3b8" />
            </View>
            <Text style={styles.emptyTitle}>No Services Yet</Text>
            <Text style={styles.emptySubtitle}>
              Create your first service under {activeSection.toUpperCase()} section to let customers book appointments.
            </Text>
            <Pressable style={styles.emptyAddBtn} onPress={handleOpenAdd}>
              <Ionicons name="add" size={18} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={styles.emptyAddBtnText}>+ Add Service</Text>
            </Pressable>
          </View>
        ) : (
          (() => {
            // Group services by Category
            const categoriesMap = {};
            filteredServices.forEach(s => {
              const cat = s.category || "Custom Stitching Services";
              if (!categoriesMap[cat]) categoriesMap[cat] = [];
              categoriesMap[cat].push(s);
            });

            return Object.keys(categoriesMap).map(categoryName => {
              const categoryServices = categoriesMap[categoryName];
              const isExpanded = expandedCategories[categoryName] !== false; // expanded by default

              return (
                <View key={categoryName} style={styles.categoryAccordionCard}>
                  {/* Category Accordion Header */}
                  <Pressable
                    style={styles.categoryAccordionHeader}
                    onPress={() => {
                      setExpandedCategories(prev => ({
                        ...prev,
                        [categoryName]: !isExpanded
                      }));
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                      <View style={styles.categoryIconBadge}>
                        <Ionicons name="cut" size={16} color="#6d28d9" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.categoryAccordionTitle}>{categoryName}</Text>
                        <Text style={styles.categoryAccordionCount}>
                          {categoryServices.length} Service{categoryServices.length !== 1 ? "s" : ""} Available
                        </Text>
                      </View>
                    </View>
                    <View style={styles.chevronBox}>
                      <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color="#0f172a" />
                    </View>
                  </Pressable>

                  {/* Expanded Category Items List */}
                  {isExpanded && (
                    <View style={styles.categoryAccordionBody}>
                      {categoryServices.map(item => {
                        const isAct = item.isActive !== false;
                        return (
                          <View key={item._id} style={[styles.card, !isAct && styles.cardInactive]}>
                            <View style={{ flexDirection: "row", alignItems: "center" }}>
                              {item.images && item.images.length > 0 && item.images[0] ? (
                                <Image source={{ uri: item.images[0] }} style={{ width: 44, height: 44, borderRadius: 10, marginRight: 12, backgroundColor: "#f1f5f9" }} />
                              ) : (
                                <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: "#f1f5f9", justifyContent: "center", alignItems: "center", marginRight: 12 }}>
                                  <Ionicons name="cut-outline" size={20} color="#6d28d9" />
                                </View>
                              )}
                              <View style={styles.cardInfo}>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                  <Text style={styles.serviceName}>{item.name}</Text>
                                  <View style={[styles.statusBadge, { backgroundColor: isAct ? "#d1fae5" : "#f1f5f9" }]}>
                                    <Text style={[styles.statusBadgeText, { color: isAct ? "#047857" : "#64748b" }]}>
                                      {isAct ? "ACTIVE" : "INACTIVE"}
                                    </Text>
                                  </View>
                                </View>
                                <Text style={styles.serviceCategory}>Category: {item.category || "General"}</Text>
                                {item.originalPrice > item.price ? (
                                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                                    <Text style={{ fontSize: 13, color: "#94a3b8", textDecorationLine: "line-through", fontWeight: "600" }}>₹{item.originalPrice}</Text>
                                    <Text style={[styles.servicePrice, { color: "#059669" }]}>₹{item.price}</Text>
                                    <View style={{ backgroundColor: "#dcfce7", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                                      <Text style={{ fontSize: 11, color: "#16a34a", fontWeight: "700" }}>
                                        {Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100)}% OFF
                                      </Text>
                                    </View>
                                  </View>
                                ) : (
                                  <Text style={styles.servicePrice}>₹{item.price}</Text>
                                )}
                                {item.serviceMode === "premium" && (
                                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5, backgroundColor: "#faf5ff", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: "flex-start", borderWidth: 1, borderColor: "#e9d5ff" }}>
                                    <Ionicons name="flash" size={12} color="#7c3aed" />
                                    <Text style={{ fontSize: 11, fontWeight: "800", color: "#7c3aed" }}>
                                      ⚡ Ready in {item.completionTime || `${item.estimatedDays || 1} Days`}
                                    </Text>
                                  </View>
                                )}
                              </View>
                            </View>

                            <View style={styles.cardActionsRow}>
                              {/* Quick Active Toggle */}
                              <Pressable onPress={() => handleToggleActiveQuick(item)} style={styles.actionBtnIcon}>
                                <Ionicons name={isAct ? "eye" : "eye-off"} size={18} color={isAct ? "#059669" : "#94a3b8"} />
                              </Pressable>

                              {/* Edit Service Button */}
                              <Pressable onPress={() => handleOpenEdit(item)} style={[styles.actionBtn, styles.editBtn]}>
                                <Ionicons name="pencil" size={14} color="#6d28d9" style={{ marginRight: 4 }} />
                                <Text style={styles.editBtnText}>Edit</Text>
                              </Pressable>

                              {/* Remove Service Button */}
                              <Pressable onPress={() => handleDelete(item)} style={[styles.actionBtn, styles.deleteBtn]}>
                                <Ionicons name="trash-outline" size={14} color="#ef4444" style={{ marginRight: 4 }} />
                                <Text style={styles.deleteBtnText}>Remove</Text>
                              </Pressable>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            });
          })()
        )}
      </ScrollView>

      {/* Add Service Modal */}
      <Modal visible={isAdding} transparent animationType="slide" onRequestClose={() => setIsAdding(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: "92%", paddingBottom: 0 }]}>
            <View style={styles.panelHeader}>
              <View>
                <Text style={styles.panelTitle}>Add New Service</Text>
                <Text style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                  Adding to <Text style={{ fontWeight: "800", color: "#6d28d9" }}>{targetMode.toUpperCase()}</Text> catalog
                </Text>
              </View>
              <Pressable onPress={() => setIsAdding(false)} hitSlop={12} style={{ padding: 4 }}>
                <Ionicons name="close-circle" size={26} color="#64748b" />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 40 }}
            >
              {/* Mode Switcher: Preset vs Custom */}
              <View style={styles.modeTabs}>
                <Pressable
                  style={[styles.modeTab, addMode === "preset" && styles.modeTabActive]}
                  onPress={() => { setAddMode("preset"); setSelectedService(null); }}
                >
                  <Text style={[styles.modeTabText, addMode === "preset" && styles.modeTabTextActive]}>Choose Preset Service</Text>
                </Pressable>
                <Pressable
                  style={[styles.modeTab, addMode === "custom" && styles.modeTabActive]}
                  onPress={() => { setAddMode("custom"); setSelectedService(null); }}
                >
                  <Text style={[styles.modeTabText, addMode === "custom" && styles.modeTabTextActive]}>Custom Name</Text>
                </Pressable>
              </View>

              {addMode === "preset" ? (
                <View style={{ marginBottom: 10 }}>
                  {Object.keys(PREDEFINED_SERVICES).map(category => (
                    <View key={category} style={styles.categoryBlock}>
                      <Pressable style={styles.categoryHeader} onPress={() => toggleCategory(category)}>
                        <Text style={styles.categoryTitle}>{category}</Text>
                        <Ionicons name={selectedCategory === category ? "chevron-up" : "chevron-down"} size={20} color="#0f172a" />
                      </Pressable>

                      {selectedCategory === category && (
                        <View style={styles.serviceItems}>
                          {PREDEFINED_SERVICES[category].map(service => (
                            <Pressable
                              key={service}
                              style={[styles.servicePill, selectedService === service && styles.servicePillActive]}
                              onPress={() => setSelectedService(service)}
                            >
                              <Text style={[styles.servicePillText, selectedService === service && styles.servicePillTextActive]}>{service}</Text>
                            </Pressable>
                          ))}
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              ) : (
                <View style={{ marginBottom: 12 }}>
                  <Text style={styles.inputLabel}>Enter Service Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Designer Kurti, Embroidery Suit, Saree Pico"
                    placeholderTextColor="#94a3b8"
                    value={customName}
                    onChangeText={setCustomName}
                  />
                </View>
              )}

              {(selectedService || (addMode === "custom" && customName.trim())) && (
                <View style={styles.priceInputBlock}>
                  <Text style={styles.selectedServiceLabel}>
                    Selected Service: <Text style={{ fontWeight: "900", color: "#0f172a" }}>{addMode === "preset" ? selectedService : customName}</Text>
                  </Text>
                  
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>Price (₹)</Text>
                      <TextInput
                        style={[styles.input, { fontSize: 18, fontWeight: "800", color: "#6d28d9" }]}
                        placeholder="₹ 0.00"
                        placeholderTextColor="#94a3b8"
                        value={newPrice}
                        onChangeText={setNewPrice}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>Discount (₹)</Text>
                      <TextInput
                        style={[styles.input, { fontSize: 18, fontWeight: "800", color: "#059669" }]}
                        placeholder="0 (Optional)"
                        placeholderTextColor="#94a3b8"
                        value={newDiscount}
                        onChangeText={setNewDiscount}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>

                  {/* Real-time converted discount percentage preview */}
                  {(() => {
                    const orig = parseFloat(newPrice || "0");
                    const disc = parseFloat(newDiscount || "0");
                    const final = Math.max(0, orig - disc);
                    const pct = orig > 0 && disc > 0 ? Math.round((disc / orig) * 100) : 0;
                    return (
                      <View style={{ backgroundColor: "#f0fdf4", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: "#bbf7d0", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <Text style={{ fontSize: 13, color: "#166534", fontWeight: "700" }}>
                          Customer Pays: ₹{final}
                        </Text>
                        {pct > 0 ? (
                          <View style={{ backgroundColor: "#dcfce7", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                            <Text style={{ fontSize: 12, color: "#15803d", fontWeight: "800" }}>{pct}% OFF</Text>
                          </View>
                        ) : (
                          <Text style={{ fontSize: 12, color: "#64748b" }}>No Discount</Text>
                        )}
                      </View>
                    );
                  })()}

                  {/* VIP Completion / Delivery Time (Only for Premium Services) */}
                  {targetMode === "premium" && (
                    <View style={styles.vipTimeBox}>
                      <View style={styles.vipTimeHeader}>
                        <View style={styles.vipBadgeIcon}>
                          <Ionicons name="flash" size={16} color="#7c3aed" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.vipTimeTitle}>
                            ⚡ VIP Completion / Delivery Time
                          </Text>
                          <Text style={styles.vipTimeSub}>
                            Highlights the estimated completion or delivery time for customers.
                          </Text>
                        </View>
                      </View>

                      {/* Quick Presets */}
                      <Text style={styles.subInputLabel}>Quick Presets:</Text>
                      <View style={styles.presetChipsRow}>
                        {["12 Hours", "24 Hours", "2 Days", "3 Days", "5 Days"].map((timeOpt) => {
                          const isSelected = newCompletionTime === timeOpt;
                          return (
                            <Pressable
                              key={timeOpt}
                              style={[
                                styles.vipPresetChip,
                                isSelected && styles.vipPresetChipActive
                              ]}
                              onPress={() => applyPresetNew(timeOpt)}
                            >
                              <Text style={[styles.vipPresetChipText, isSelected && styles.vipPresetChipTextActive]}>
                                ⚡ {timeOpt}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>

                      {/* Manual Duration */}
                      <Text style={styles.subInputLabel}>Custom Duration (Hours or Days):</Text>
                      <View style={styles.manualTimeRow}>
                        <View style={styles.manualInputWrapper}>
                          <TextInput
                            style={styles.manualNumberInput}
                            placeholder="24"
                            placeholderTextColor="#a855f7"
                            keyboardType="numeric"
                            value={newTimeVal}
                            onChangeText={(val) => handleUpdateNewDuration(val, newTimeUnit)}
                            maxLength={4}
                          />
                        </View>

                        <View style={styles.unitToggleGroup}>
                          <Pressable
                            style={[
                              styles.unitToggleBtn,
                              newTimeUnit === "Hours" && styles.unitToggleBtnActive
                            ]}
                            onPress={() => handleUpdateNewDuration(newTimeVal || "24", "Hours")}
                          >
                            <Ionicons name="time" size={14} color={newTimeUnit === "Hours" ? "#ffffff" : "#7c3aed"} />
                            <Text style={[styles.unitToggleText, newTimeUnit === "Hours" && styles.unitToggleTextActive]}>
                              Hours
                            </Text>
                          </Pressable>
                          <Pressable
                            style={[
                              styles.unitToggleBtn,
                              newTimeUnit === "Days" && styles.unitToggleBtnActive
                            ]}
                            onPress={() => handleUpdateNewDuration(newTimeVal || "2", "Days")}
                          >
                            <Ionicons name="calendar" size={14} color={newTimeUnit === "Days" ? "#ffffff" : "#7c3aed"} />
                            <Text style={[styles.unitToggleText, newTimeUnit === "Days" && styles.unitToggleTextActive]}>
                              Days
                            </Text>
                          </Pressable>
                        </View>
                      </View>

                      {/* Customer Preview Tag */}
                      <View style={styles.customerPreviewBadge}>
                        <Ionicons name="eye-outline" size={15} color="#7c3aed" style={{ marginRight: 6 }} />
                        <Text style={styles.customerPreviewLabel}>Customer Tag:</Text>
                        <View style={styles.customerPreviewPill}>
                          <Text style={styles.customerPreviewPillText}>
                            ⚡ Ready in {newCompletionTime || "24 Hours"}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}

                  <Text style={styles.inputLabel}>Service Photo (Optional)</Text>
                  {newImage ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 }}>
                      <Image source={{ uri: newImage }} style={{ width: 54, height: 54, borderRadius: 10 }} />
                      <Pressable onPress={() => setNewImage(null)} style={{ padding: 8, backgroundColor: "#fee2e2", borderRadius: 8 }}>
                        <Ionicons name="trash-outline" size={16} color="#ef4444" />
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#f8fafc", padding: 12, borderRadius: 12, marginBottom: 14, borderWidth: 1, borderColor: "#e2e8f0", borderStyle: "dashed" }}
                      onPress={() => {
                        promptServiceImagePicker((uri) => {
                          setNewImage(uri);
                        });
                      }}
                    >
                      <Ionicons name="camera-outline" size={20} color="#6d28d9" />
                      <Text style={{ fontSize: 13, color: "#6d28d9", fontWeight: "700" }}>+ Add Service Photo (Optional)</Text>
                    </Pressable>
                  )}

                  <Pressable style={styles.submitBtn} onPress={handleAddService} disabled={submittingAdd}>
                    {submittingAdd ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.submitBtnText}>Add Service {newPrice ? `(₹${newPrice})` : ""} ✂️</Text>
                    )}
                  </Pressable>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Service Modal */}
      <Modal visible={editModalVisible} transparent animationType="slide" onRequestClose={() => setEditModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: "92%", paddingBottom: 0 }]}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Edit Service</Text>
              <Pressable onPress={() => setEditModalVisible(false)} hitSlop={12} style={{ padding: 4 }}>
                <Ionicons name="close-circle" size={26} color="#64748b" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={true} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 35 }}>
              <Text style={styles.inputLabel}>Service Name</Text>
              <TextInput
                style={styles.input}
                value={editName}
                onChangeText={setEditName}
              />

              <Text style={styles.inputLabel}>Category</Text>
              <TextInput
                style={styles.input}
                value={editCategory}
                onChangeText={setEditCategory}
              />

              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Price (₹)</Text>
                  <TextInput
                    style={styles.input}
                    value={editPrice}
                    onChangeText={setEditPrice}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Discount (₹)</Text>
                  <TextInput
                    style={styles.input}
                    value={editDiscount}
                    onChangeText={setEditDiscount}
                    placeholder="0 (Optional)"
                    placeholderTextColor="#94a3b8"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Real-time converted discount percentage preview */}
              {(() => {
                const orig = parseFloat(editPrice || "0");
                const disc = parseFloat(editDiscount || "0");
                const final = Math.max(0, orig - disc);
                const pct = orig > 0 && disc > 0 ? Math.round((disc / orig) * 100) : 0;
                return (
                  <View style={{ backgroundColor: "#f0fdf4", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: "#bbf7d0", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 13, color: "#166534", fontWeight: "700" }}>
                      Customer Pays: ₹{final}
                    </Text>
                    {pct > 0 ? (
                      <View style={{ backgroundColor: "#dcfce7", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                        <Text style={{ fontSize: 12, color: "#15803d", fontWeight: "800" }}>{pct}% OFF</Text>
                      </View>
                    ) : (
                      <Text style={{ fontSize: 12, color: "#64748b" }}>No Discount</Text>
                    )}
                  </View>
                );
              })()}

              {/* Service Mode Selector */}
              <Text style={styles.inputLabel}>Service Mode</Text>
              <View style={styles.modeTabs}>
                {[
                  { key: "shop", label: "Shop Visit" },
                  { key: "premium", label: "Premium VIP" },
                  { key: "home", label: "Home Visit" }
                ].map(m => (
                  <Pressable
                    key={m.key}
                    style={[styles.modeTab, editMode === m.key && styles.modeTabActive]}
                    onPress={() => setEditMode(m.key)}
                  >
                    <Text style={[styles.modeTabText, editMode === m.key && styles.modeTabTextActive]}>{m.label}</Text>
                  </Pressable>
                ))}
              </View>

              {/* VIP Completion / Delivery Time (Only for Premium Services) */}
              {editMode === "premium" && (
                <View style={styles.vipTimeBox}>
                  <View style={styles.vipTimeHeader}>
                    <View style={styles.vipBadgeIcon}>
                      <Ionicons name="flash" size={16} color="#7c3aed" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.vipTimeTitle}>
                        ⚡ VIP Completion / Delivery Time
                      </Text>
                      <Text style={styles.vipTimeSub}>
                        Highlights the estimated completion or delivery time for customers.
                      </Text>
                    </View>
                  </View>

                  {/* Quick Presets */}
                  <Text style={styles.subInputLabel}>Quick Presets:</Text>
                  <View style={styles.presetChipsRow}>
                    {["12 Hours", "24 Hours", "2 Days", "3 Days", "5 Days"].map((timeOpt) => {
                      const isSelected = editCompletionTime === timeOpt;
                      return (
                        <Pressable
                          key={timeOpt}
                          style={[
                            styles.vipPresetChip,
                            isSelected && styles.vipPresetChipActive
                          ]}
                          onPress={() => applyPresetEdit(timeOpt)}
                        >
                          <Text style={[styles.vipPresetChipText, isSelected && styles.vipPresetChipTextActive]}>
                            ⚡ {timeOpt}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {/* Manual Duration */}
                  <Text style={styles.subInputLabel}>Custom Duration (Hours or Days):</Text>
                  <View style={styles.manualTimeRow}>
                    <View style={styles.manualInputWrapper}>
                      <TextInput
                        style={styles.manualNumberInput}
                        placeholder="24"
                        placeholderTextColor="#a855f7"
                        keyboardType="numeric"
                        value={editTimeVal}
                        onChangeText={(val) => handleUpdateEditDuration(val, editTimeUnit)}
                        maxLength={4}
                      />
                    </View>

                    <View style={styles.unitToggleGroup}>
                      <Pressable
                        style={[
                          styles.unitToggleBtn,
                          editTimeUnit === "Hours" && styles.unitToggleBtnActive
                        ]}
                        onPress={() => handleUpdateEditDuration(editTimeVal || "24", "Hours")}
                      >
                        <Ionicons name="time" size={14} color={editTimeUnit === "Hours" ? "#ffffff" : "#7c3aed"} />
                        <Text style={[styles.unitToggleText, editTimeUnit === "Hours" && styles.unitToggleTextActive]}>
                          Hours
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[
                          styles.unitToggleBtn,
                          editTimeUnit === "Days" && styles.unitToggleBtnActive
                        ]}
                        onPress={() => handleUpdateEditDuration(editTimeVal || "2", "Days")}
                      >
                        <Ionicons name="calendar" size={14} color={editTimeUnit === "Days" ? "#ffffff" : "#7c3aed"} />
                        <Text style={[styles.unitToggleText, editTimeUnit === "Days" && styles.unitToggleTextActive]}>
                          Days
                        </Text>
                      </Pressable>
                    </View>
                  </View>

                  {/* Customer Preview Tag */}
                  <View style={styles.customerPreviewBadge}>
                    <Ionicons name="eye-outline" size={15} color="#7c3aed" style={{ marginRight: 6 }} />
                    <Text style={styles.customerPreviewLabel}>Customer Tag:</Text>
                    <View style={styles.customerPreviewPill}>
                      <Text style={styles.customerPreviewPillText}>
                        ⚡ Ready in {editCompletionTime || "24 Hours"}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Service Photo */}
              <Text style={styles.inputLabel}>Service Photo (Optional)</Text>
              {editImage ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <Image source={{ uri: editImage }} style={{ width: 50, height: 50, borderRadius: 10 }} />
                  <Pressable
                    style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#f3e8ff", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}
                    onPress={() => {
                      promptServiceImagePicker((uri) => {
                        setEditImage(uri);
                      });
                    }}
                  >
                    <Ionicons name="camera" size={14} color="#6d28d9" />
                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#6d28d9" }}>Change</Text>
                  </Pressable>
                  <Pressable onPress={() => setEditImage(null)} style={{ padding: 6, backgroundColor: "#fee2e2", borderRadius: 8 }}>
                    <Ionicons name="trash-outline" size={16} color="#ef4444" />
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#f8fafc", padding: 10, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: "#e2e8f0", borderStyle: "dashed" }}
                  onPress={() => {
                    promptServiceImagePicker((uri) => {
                      setEditImage(uri);
                    });
                  }}
                >
                  <Ionicons name="camera-outline" size={18} color="#6d28d9" />
                  <Text style={{ fontSize: 12, color: "#6d28d9", fontWeight: "700" }}>+ Add Photo</Text>
                </Pressable>
              )}

              {/* Active Switch */}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginVertical: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#0f172a" }}>Active in Shop Catalog</Text>
                <Switch
                  value={editIsActive}
                  onValueChange={setEditIsActive}
                  trackColor={{ false: "#cbd5e1", true: "#c4b5fd" }}
                  thumbColor={editIsActive ? "#6d28d9" : "#94a3b8"}
                />
              </View>

              <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
                <Pressable style={styles.modalCancelBtn} onPress={() => setEditModalVisible(false)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.modalSaveBtn} onPress={handleSaveEdit} disabled={submittingEdit}>
                  {submittingEdit ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalSaveText}>Update Service</Text>}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  topHeader: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6 },
  mainTitle: { fontSize: 22, fontWeight: "800", color: "#0f172a" },
  mainSubtitle: { fontSize: 13, color: "#64748b", marginTop: 2 },

  sectionTabsWrapper: { paddingVertical: 10 },
  sectionTabsContainer: { paddingHorizontal: 20, gap: 10 },
  sectionTab: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#e2e8f0" },
  sectionTabActive: { backgroundColor: "#6d28d9", borderColor: "#6d28d9" },
  sectionTabText: { fontSize: 14, fontWeight: "700", color: "#475569" },
  sectionTabTextActive: { color: "#ffffff" },

  modeConfigBanner: { marginHorizontal: 20, marginBottom: 14, backgroundColor: "#ffffff", padding: 14, borderRadius: 14, borderWidth: 1, borderColor: "#e2e8f0", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modeConfigTitle: { fontSize: 14, fontWeight: "800", color: "#0f172a" },
  modeConfigDesc: { fontSize: 12, color: "#64748b", marginTop: 2 },

  filterBar: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", marginHorizontal: 20, marginBottom: 14, gap: 10 },
  chipsGroup: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#e2e8f0" },
  chipActive: { backgroundColor: "#0f172a", borderColor: "#0f172a" },
  chipText: { fontSize: 12, fontWeight: "700", color: "#64748b" },
  chipTextActive: { color: "#ffffff" },

  addServiceBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#6d28d9", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  addServiceBtnText: { color: "#ffffff", fontWeight: "800", fontSize: 13 },
  categoryAccordionCard: { backgroundColor: "#ffffff", borderRadius: 16, marginBottom: 14, borderWidth: 1, borderColor: "#e2e8f0", overflow: "hidden" },
  categoryAccordionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, backgroundColor: "#f8fafc", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  categoryIconBadge: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#ede9fe", justifyContent: "center", alignItems: "center" },
  categoryAccordionTitle: { fontSize: 15, fontWeight: "800", color: "#0f172a" },
  categoryAccordionCount: { fontSize: 12, color: "#64748b", marginTop: 2 },
  chevronBox: { padding: 4 },
  categoryAccordionBody: { padding: 12, backgroundColor: "#ffffff" },
  card: { backgroundColor: "#ffffff", padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: "#e2e8f0" },
  cardInactive: { backgroundColor: "#f8fafc", opacity: 0.7 },
  cardInfo: { flex: 1 },
  serviceName: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  statusBadgeText: { fontSize: 10, fontWeight: "800" },
  serviceCategory: { fontSize: 12, color: "#64748b", marginTop: 2 },
  servicePrice: { fontSize: 17, fontWeight: "900", color: "#6d28d9", marginTop: 6 },

  cardActionsRow: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 8, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#f1f5f9" },
  actionBtnIcon: { padding: 8, borderRadius: 8, backgroundColor: "#f1f5f9" },
  actionBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  editBtn: { backgroundColor: "#ede9fe" },
  editBtnText: { color: "#6d28d9", fontWeight: "700", fontSize: 12 },
  deleteBtn: { backgroundColor: "#fef2f2" },
  deleteBtnText: { color: "#ef4444", fontWeight: "700", fontSize: 12 },

  emptyContainer: { padding: 40, alignItems: "center" },
  emptyIconBox: { width: 70, height: 70, borderRadius: 35, backgroundColor: "#f1f5f9", justifyContent: "center", alignItems: "center", marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: "#0f172a" },
  emptySubtitle: { fontSize: 13, color: "#64748b", textAlign: "center", marginTop: 6, marginBottom: 20 },
  emptyAddBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#6d28d9", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  emptyAddBtnText: { color: "#ffffff", fontWeight: "800", fontSize: 14 },

  addPanel: { position: "absolute", bottom: 0, left: 0, right: 0, height: "85%", backgroundColor: "#fff", padding: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24, shadowColor: "#000", shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 15 },
  panelHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  panelTitle: { fontSize: 18, fontWeight: "800", color: "#0f172a" },
  
  modeTabs: { flexDirection: "row", backgroundColor: "#f1f5f9", borderRadius: 10, padding: 4, marginBottom: 10 },
  modeTab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  modeTabActive: { backgroundColor: "#ffffff", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, elevation: 1 },
  modeTabText: { fontSize: 13, fontWeight: "600", color: "#64748b" },
  modeTabTextActive: { color: "#6d28d9", fontWeight: "700" },

  serviceSelectionList: { flex: 1, marginBottom: 10 },
  categoryBlock: { marginBottom: 10, backgroundColor: "#f8fafc", borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "#e2e8f0" },
  categoryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14, backgroundColor: "#f1f5f9" },
  categoryTitle: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  serviceItems: { flexDirection: "row", flexWrap: "wrap", padding: 12, gap: 10 },
  servicePill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1, borderColor: "#cbd5e1" },
  servicePillActive: { backgroundColor: "#6d28d9", borderColor: "#6d28d9" },
  servicePillText: { fontSize: 13, fontWeight: "600", color: "#475569" },
  servicePillTextActive: { color: "#fff" },
  
  priceInputBlock: { marginTop: 10, paddingTop: 14, borderTopWidth: 1, borderTopColor: "#e2e8f0" },
  selectedServiceLabel: { fontSize: 14, fontWeight: "700", color: "#6d28d9", marginBottom: 10 },
  inputLabel: { fontSize: 13, fontWeight: "700", color: "#475569", marginBottom: 6, marginTop: 4 },
  input: { backgroundColor: "#f8fafc", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: "#0f172a", marginBottom: 12, borderWidth: 1, borderColor: "#e2e8f0" },
  submitBtn: { backgroundColor: "#0f172a", padding: 14, borderRadius: 12, alignItems: "center" },
  submitBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.6)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalCancelBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: "#f1f5f9", alignItems: "center" },
  modalCancelText: { fontSize: 15, fontWeight: "700", color: "#475569" },
  modalSaveBtn: { flex: 2, padding: 14, borderRadius: 12, backgroundColor: "#6d28d9", alignItems: "center" },
  modalSaveText: { fontSize: 15, fontWeight: "800", color: "#ffffff" },

  feeConfigCard: { backgroundColor: "#ffffff", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#bbf7d0", marginTop: 8 },
  feeConfigHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  feeConfigTitle: { fontSize: 14, fontWeight: "800", color: "#065f46" },
  feeConfigSubtitle: { fontSize: 11, color: "#166534", marginTop: 2, lineHeight: 15 },
  feeStatusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  feeStatusBadgeFree: { backgroundColor: "#f0fdf4", borderColor: "#86efac" },
  feeStatusBadgePaid: { backgroundColor: "#ecfdf5", borderColor: "#34d399" },
  feeStatusText: { fontSize: 11, fontWeight: "800" },
  feeStatusTextFree: { color: "#16a34a" },
  feeStatusTextPaid: { color: "#059669" },
  quickPresetRow: { flexDirection: "row", gap: 6, marginBottom: 10, flexWrap: "wrap" },
  presetChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#cbd5e1" },
  presetChipActive: { backgroundColor: "#059669", borderColor: "#059669" },
  presetChipText: { fontSize: 12, fontWeight: "700", color: "#475569" },
  presetChipTextActive: { color: "#ffffff" },
  feeInputRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  inputWrapper: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#f8fafc", borderRadius: 10, borderWidth: 1, borderColor: "#cbd5e1", paddingHorizontal: 10, height: 42 },
  currencyPrefix: { fontSize: 15, fontWeight: "800", color: "#059669", marginRight: 4 },
  feeInput: { flex: 1, fontSize: 15, fontWeight: "700", color: "#0f172a", padding: 0 },
  saveFeeBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#059669", paddingHorizontal: 14, height: 42, borderRadius: 10, justifyContent: "center" },
  saveFeeBtnText: { color: "#ffffff", fontWeight: "800", fontSize: 13 },

  vipTimeBox: {
    marginBottom: 14,
    backgroundColor: "#faf5ff",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#e9d5ff",
  },
  vipTimeHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },
  vipBadgeIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#ede9fe",
    justifyContent: "center",
    alignItems: "center",
  },
  vipTimeTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#581c87",
  },
  vipTimeSub: {
    fontSize: 11,
    color: "#7e22ce",
    marginTop: 2,
    lineHeight: 15,
  },
  subInputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6b21a8",
    marginBottom: 6,
    marginTop: 4,
  },
  presetChipsRow: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
    marginBottom: 10,
  },
  vipPresetChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d8b4fe",
  },
  vipPresetChipActive: {
    backgroundColor: "#7c3aed",
    borderColor: "#7c3aed",
  },
  vipPresetChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6b21a8",
  },
  vipPresetChipTextActive: {
    color: "#ffffff",
  },
  manualTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  manualInputWrapper: {
    width: 80,
    height: 42,
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#c084fc",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  manualNumberInput: {
    width: "100%",
    fontSize: 18,
    fontWeight: "900",
    color: "#581c87",
    textAlign: "center",
    padding: 0,
  },
  unitToggleGroup: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#f3e8ff",
    borderRadius: 10,
    padding: 3,
    height: 42,
  },
  unitToggleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 8,
  },
  unitToggleBtnActive: {
    backgroundColor: "#7c3aed",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    elevation: 2,
  },
  unitToggleText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#7c3aed",
  },
  unitToggleTextActive: {
    color: "#ffffff",
  },
  customerPreviewBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f3ff",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd6fe",
  },
  customerPreviewLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6b21a8",
    marginRight: 6,
  },
  customerPreviewPill: {
    backgroundColor: "#7c3aed",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  customerPreviewPillText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#ffffff",
  },
});
