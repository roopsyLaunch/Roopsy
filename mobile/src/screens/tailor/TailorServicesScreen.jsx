import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable,
  RefreshControl, Alert, TextInput, ScrollView, Modal, Switch
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../api/client";
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
  const [newEstDays, setNewEstDays] = useState("3");
  const [customName, setCustomName] = useState("");
  const [customCategory, setCustomCategory] = useState("Custom Stitching");
  const [submittingAdd, setSubmittingAdd] = useState(false);

  // Edit Modal State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editDays, setEditDays] = useState("3");
  const [editMode, setEditMode] = useState("shop");
  const [editIsActive, setEditIsActive] = useState(true);
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Section Toggle States
  const [togglingSection, setTogglingSection] = useState(false);

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
      await api.patch("/tailors/me", { [modeKey]: !currentValue });
      await refreshMe();
      Alert.alert("Success", "Service mode updated successfully.");
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Could not update service mode setting.");
    } finally {
      setTogglingSection(false);
    }
  };

  const handleOpenAdd = () => {
    setTargetMode(activeSection);
    setIsAdding(true);
    setSelectedCategory(null);
    setSelectedService(null);
    setCustomName("");
    setNewPrice("");
  };

  const handleAddService = async () => {
    const nameToSave = addMode === "preset" ? selectedService : customName.trim();
    const categoryToSave = addMode === "preset" ? selectedCategory : customCategory.trim();
    
    if (!nameToSave || !newPrice) {
      return Alert.alert("Required Fields", "Please enter a service name and price.");
    }
    
    setSubmittingAdd(true);
    try {
      await api.post("/tailors/services", {
        name: nameToSave,
        price: Number(newPrice) || 0,
        category: categoryToSave || "Stitching Services",
        estimatedDays: Number(newEstDays) || 3,
        serviceMode: targetMode,
        isActive: true,
        genderCategory: "unisex"
      });
      
      setIsAdding(false);
      setSelectedCategory(null);
      setSelectedService(null);
      setCustomName("");
      setNewPrice("");
      setNewEstDays("3");
      await loadServices();
      Alert.alert("Success", `Service added to ${targetMode.toUpperCase()} catalog successfully!`);
    } catch (err) {
      console.error(err);
      Alert.alert("Error", err?.response?.data?.error || "Could not add service.");
    } finally {
      setSubmittingAdd(false);
    }
  };

  const handleOpenEdit = (svc) => {
    setEditingService(svc);
    setEditName(svc.name || "");
    setEditPrice(String(svc.price || ""));
    setEditCategory(svc.category || "Custom Stitching");
    setEditDays(String(svc.estimatedDays || 3));
    setEditMode(svc.serviceMode || "shop");
    setEditIsActive(svc.isActive !== false);
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editName.trim() || !editPrice) {
      return Alert.alert("Required Fields", "Please provide a valid service name and price.");
    }
    setSubmittingEdit(true);
    try {
      await api.patch(`/tailors/services/${editingService._id}`, {
        name: editName.trim(),
        price: Number(editPrice) || 0,
        category: editCategory.trim(),
        estimatedDays: Number(editDays) || 3,
        serviceMode: editMode,
        isActive: editIsActive
      });
      setEditModalVisible(false);
      setEditingService(null);
      await loadServices();
      Alert.alert("Updated ✅", "Service updated successfully!");
    } catch (err) {
      console.error(err);
      Alert.alert("Error", err?.response?.data?.error || "Could not update service.");
    } finally {
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
        </View>
      ) : (
        <View style={styles.modeConfigBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.modeConfigTitle}>Premium VIP Stitching Service</Text>
            <Text style={styles.modeConfigDesc}>Offer priority rush stitching & custom designer embroidery.</Text>
          </View>
          <Switch
            value={Boolean(tailor?.offersPremiumService)}
            onValueChange={() => handleToggleModeOffer("offersPremiumService", Boolean(tailor?.offersPremiumService))}
            disabled={togglingSection}
            trackColor={{ false: "#cbd5e1", true: "#c4b5fd" }}
            thumbColor={tailor?.offersPremiumService ? "#6d28d9" : "#94a3b8"}
          />
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
                              <Text style={styles.servicePrice}>₹{item.price}</Text>
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
      {isAdding && (
        <View style={styles.addPanel}>
          <View style={styles.panelHeader}>
            <View>
              <Text style={styles.panelTitle}>Add New Service</Text>
              <Text style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                Adding to <Text style={{ fontWeight: "800", color: "#6d28d9" }}>{activeSection.toUpperCase()}</Text> catalog
              </Text>
            </View>
            <Pressable onPress={() => setIsAdding(false)}>
              <Ionicons name="close" size={24} color="#64748b" />
            </Pressable>
          </View>

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
            <ScrollView style={styles.serviceSelectionList} showsVerticalScrollIndicator={false}>
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
            </ScrollView>
          ) : (
            <ScrollView style={styles.serviceSelectionList} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Enter Service Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Designer Kurti, Embroidery Suit, Saree Pico"
                placeholderTextColor="#94a3b8"
                value={customName}
                onChangeText={setCustomName}
              />
            </ScrollView>
          )}

          {(selectedService || (addMode === "custom" && customName.trim())) && (
            <View style={styles.priceInputBlock}>
              <Text style={styles.selectedServiceLabel}>
                Selected Service: <Text style={{ fontWeight: "900", color: "#0f172a" }}>{addMode === "preset" ? selectedService : customName}</Text>
              </Text>
              
              <Text style={styles.inputLabel}>Enter Service Price (Paisa ₹)</Text>
              <TextInput
                style={[styles.input, { fontSize: 18, fontWeight: "800", color: "#6d28d9" }]}
                placeholder="₹ 0.00"
                placeholderTextColor="#94a3b8"
                value={newPrice}
                onChangeText={setNewPrice}
                keyboardType="numeric"
              />

              <Pressable style={styles.submitBtn} onPress={handleAddService} disabled={submittingAdd}>
                {submittingAdd ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Add Service {newPrice ? `(₹${newPrice})` : ""} ✂️</Text>
                )}
              </Pressable>
            </View>
          )}
        </View>
      )}

      {/* Edit Service Modal */}
      <Modal visible={editModalVisible} transparent animationType="slide" onRequestClose={() => setEditModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Edit Service</Text>
              <Pressable onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </Pressable>
            </View>

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

            <Text style={styles.inputLabel}>Price (₹)</Text>
            <TextInput
              style={styles.input}
              value={editPrice}
              onChangeText={setEditPrice}
              keyboardType="numeric"
            />

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
  modalSaveText: { fontSize: 15, fontWeight: "800", color: "#ffffff" }
});
