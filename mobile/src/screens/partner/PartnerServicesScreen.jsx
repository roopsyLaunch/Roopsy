import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Image,
  Modal,
  TouchableOpacity,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { promptServiceImagePicker } from "../../services/imagePickerService";

export function PartnerServicesScreen({ navigation, route }) {
  const category = route.params?.registrationData?.category || "Barber Shop";
  const isParlor = category === "Beauty Parlor";
  const isStitching = category === "Tailor" || category === "Stitching Center";

  const defaultServices = isParlor
    ? [
        { id: "1", name: "Makeup", price: "500", image: null },
        { id: "2", name: "Facial", price: "300", image: null },
        { id: "3", name: "Waxing", price: "200", image: null },
        { id: "4", name: "Hair Styling", price: "250", image: null },
        { id: "5", name: "Threading", price: "50", image: null },
      ]
    : isStitching
    ? [
        { id: "1", name: "Suit Stitching", price: "800", image: null },
        { id: "2", name: "Blouse Stitching", price: "400", image: null },
        { id: "3", name: "Kurta Stitching", price: "500", image: null },
        { id: "4", name: "Alteration", price: "100", image: null },
        { id: "5", name: "Pants Stitching", price: "300", image: null },
      ]
    : [
        { id: "1", name: "Haircut", price: "150", image: null },
        { id: "2", name: "Beard Trim", price: "100", image: null },
        { id: "3", name: "Shaving", price: "120", image: null },
        { id: "4", name: "Hair Wash & Spa", price: "200", image: null },
      ];

  const [services, setServices] = useState(defaultServices);
  // Track selected service IDs (optional selection)
  const [selectedIds, setSelectedIds] = useState(() => new Set(defaultServices.map((s) => s.id)));

  // Add Service Modal state
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newServiceName, setNewServiceName] = useState("");
  const [newServicePrice, setNewServicePrice] = useState("");
  const [newServiceDiscount, setNewServiceDiscount] = useState("");
  const [newServiceImage, setNewServiceImage] = useState(null);

  // Edit Service Modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [editServiceName, setEditServiceName] = useState("");
  const [editServicePrice, setEditServicePrice] = useState("");
  const [editServiceDiscount, setEditServiceDiscount] = useState("");
  const [editServiceImage, setEditServiceImage] = useState(null);

  const handlePickImageForNew = () => {
    promptServiceImagePicker((uri) => setNewServiceImage(uri));
  };

  const handlePickImageForEdit = () => {
    promptServiceImagePicker((uri) => setEditServiceImage(uri));
  };

  const handlePickImageForServiceRow = (serviceId) => {
    promptServiceImagePicker((uri) => {
      setServices((prev) =>
        prev.map((s) => (s.id === serviceId ? { ...s, image: uri } : s))
      );
    });
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedIds(new Set(services.map((s) => s.id)));
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  const openEditModal = (svc) => {
    setEditingService(svc);
    setEditServiceName(svc.name);
    setEditServicePrice(String(svc.originalPrice || svc.price));
    setEditServiceDiscount(svc.discountAmount ? String(svc.discountAmount) : "");
    setEditServiceImage(svc.image || null);
    setEditModalVisible(true);
  };

  const handleEditServiceSubmit = () => {
    if (!editServiceName.trim()) {
      Alert.alert("Input Error", "Please enter a service name.");
      return;
    }
    if (!editServicePrice.trim()) {
      Alert.alert("Input Error", "Please enter a service price.");
      return;
    }

    const orig = Number(editServicePrice) || 0;
    const disc = Number(editServiceDiscount) || 0;
    const final = Math.max(0, orig - disc);

    setServices((prev) =>
      prev.map((s) =>
        s.id === editingService.id
          ? {
              ...s,
              name: editServiceName.trim(),
              price: String(final),
              originalPrice: orig,
              discountAmount: disc,
              image: editServiceImage || null,
            }
          : s
      )
    );
    setEditModalVisible(false);
    setEditingService(null);
    setEditServiceDiscount("");
    setEditServiceImage(null);
  };

  const handleAddServiceSubmit = () => {
    if (!newServiceName.trim()) {
      Alert.alert("Input Error", "Please enter a service name.");
      return;
    }
    if (!newServicePrice.trim()) {
      Alert.alert("Input Error", "Please enter a service price.");
      return;
    }

    const orig = Number(newServicePrice) || 0;
    const disc = Number(newServiceDiscount) || 0;
    const final = Math.max(0, orig - disc);

    const newService = {
      id: Date.now().toString(),
      name: newServiceName.trim(),
      price: String(final),
      originalPrice: orig,
      discountAmount: disc,
      image: newServiceImage || null,
    };

    setServices((prev) => [...prev, newService]);
    setSelectedIds((prev) => new Set(prev).add(newService.id));
    setNewServiceName("");
    setNewServicePrice("");
    setNewServiceDiscount("");
    setNewServiceImage(null);
    setAddModalVisible(false);
  };

  // Continue to next step with selected services (or empty array if none selected)
  const onContinue = () => {
    const finalServices = services.filter((s) => selectedIds.has(s.id));
    navigation.navigate("PartnerGallery", {
      registrationData: { ...(route.params?.registrationData || {}), services: finalServices },
    });
  };

  // Direct skip without adding services
  const onSkip = () => {
    navigation.navigate("PartnerGallery", {
      registrationData: { ...(route.params?.registrationData || {}), services: [] },
    });
  };

  const StepIndicator = () => (
    <View style={styles.stepContainer}>
      {[1, 2, 3, 4].map((step) => (
        <React.Fragment key={step}>
          <View
            style={[
              styles.stepCircle,
              step === 2 && styles.stepActive,
              step < 2 && styles.stepDone,
            ]}
          >
            <Text
              style={[
                styles.stepText,
                step === 2 && styles.stepTextActive,
                step < 2 && styles.stepTextActive,
              ]}
            >
              {step}
            </Text>
          </View>
          {step < 4 && <View style={[styles.stepLine, step < 2 && styles.stepLineDone]} />}
        </React.Fragment>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </Pressable>
        <Text style={styles.headerTitle}>Add Services (Optional)</Text>
        <TouchableOpacity onPress={onSkip} style={styles.headerSkipBtn}>
          <Text style={styles.headerSkipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <StepIndicator />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>Set your service list and pricing</Text>

        {/* Helpful Info Banner explaining that services are optional */}
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle" size={22} color="#7c3aed" style={{ marginRight: 10, marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.infoBannerTitle}>Service selection is optional</Text>
            <Text style={styles.infoBannerSub}>
              If you do not wish to select any services right now, you can continue or skip. You can easily add or update your services anytime from your Partner Dashboard.
            </Text>
          </View>
        </View>

        {/* Quick select / deselect all row */}
        {services.length > 0 && (
          <View style={styles.quickSelectRow}>
            <Text style={styles.selectedCountText}>
              {selectedIds.size} of {services.length} selected
            </Text>
            <View style={styles.quickActionLinks}>
              <TouchableOpacity onPress={handleSelectAll} style={{ paddingHorizontal: 6 }}>
                <Text style={styles.quickActionText}>Select All</Text>
              </TouchableOpacity>
              <Text style={{ color: "#cbd5e1" }}>•</Text>
              <TouchableOpacity onPress={handleDeselectAll} style={{ paddingHorizontal: 6 }}>
                <Text style={styles.quickActionText}>Deselect All</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {services.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="cut-outline" size={40} color="#cbd5e1" />
            <Text style={styles.emptyText}>No services added yet.</Text>
            <Text style={styles.emptySub}>You can tap Continue directly or tap '+ Add New Service' to add your services.</Text>
          </View>
        ) : (
          services.map((svc, idx) => {
            const isSelected = selectedIds.has(svc.id);
            return (
              <View
                key={svc.id}
                style={[styles.serviceRow, !isSelected && styles.serviceRowUnselected]}
              >
                {/* Checkbox */}
                <TouchableOpacity
                  onPress={() => toggleSelect(svc.id)}
                  style={styles.checkboxTouch}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={isSelected ? "checkbox" : "square-outline"}
                    size={24}
                    color={isSelected ? "#7c3aed" : "#94a3b8"}
                  />
                </TouchableOpacity>

                {/* Service Photo / Empty Box */}
                <TouchableOpacity
                  onPress={() => handlePickImageForServiceRow(svc.id)}
                  style={styles.imgTouchWrapper}
                  activeOpacity={0.8}
                >
                  {svc.image ? (
                    <View style={styles.imageWrapperWithBadge}>
                      <Image source={{ uri: svc.image }} style={styles.serviceImg} />
                      <View style={styles.editImgBadge}>
                        <Ionicons name="camera" size={10} color="#ffffff" />
                      </View>
                    </View>
                  ) : (
                    <View style={styles.emptyImgBox}>
                      <Ionicons name="camera-outline" size={18} color="#94a3b8" />
                      <Text style={styles.emptyImgText}>+ Photo</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <Pressable style={styles.serviceInfo} onPress={() => toggleSelect(svc.id)}>
                  <Text style={[styles.serviceName, !isSelected && styles.serviceNameUnselected]}>
                    {svc.name}
                  </Text>
                  {svc.originalPrice && svc.discountAmount && svc.originalPrice > Number(svc.price) ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                      <Text style={{ fontSize: 11, color: "#94a3b8", textDecorationLine: "line-through" }}>₹{svc.originalPrice}</Text>
                      <Text style={{ fontSize: 11, color: "#16a34a", fontWeight: "700" }}>
                        {Math.round(((svc.originalPrice - Number(svc.price)) / svc.originalPrice) * 100)}% OFF
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.serviceSubText}>Tap price to edit</Text>
                  )}
                </Pressable>

                <View style={styles.priceContainer}>
                  <Text style={styles.currency}>₹</Text>
                  <TextInput
                    style={styles.priceInput}
                    value={svc.price}
                    keyboardType="number-pad"
                    onChangeText={(val) => {
                      const newArr = [...services];
                      newArr[idx].price = val;
                      setServices(newArr);
                    }}
                  />
                </View>

                <TouchableOpacity onPress={() => openEditModal(svc)} style={styles.editBtn}>
                  <Ionicons name="create-outline" size={18} color="#7c3aed" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setServices(services.filter((s) => s.id !== svc.id));
                    setSelectedIds((prev) => {
                      const next = new Set(prev);
                      next.delete(svc.id);
                      return next;
                    });
                  }}
                  style={styles.deleteBtn}
                >
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
              </View>
            );
          })
        )}

        {/* Add New Service Button */}
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setAddModalVisible(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="add-circle" size={22} color="#7c3aed" />
          <Text style={styles.addBtnText}>+ Add New Service</Text>
        </TouchableOpacity>

        {/* Continue Button */}
        <Pressable style={styles.btn} onPress={onContinue}>
          <Text style={styles.btnText}>
            {selectedIds.size > 0
              ? `Continue (${selectedIds.size} Services Selected)`
              : "Continue (Add Services Later)"}
          </Text>
        </Pressable>

        {/* Secondary Skip Button */}
        <TouchableOpacity style={styles.skipBtn} onPress={onSkip} activeOpacity={0.7}>
          <Ionicons
            name="arrow-forward-circle-outline"
            size={18}
            color="#7c3aed"
            style={{ marginRight: 6 }}
          />
          <Text style={styles.skipBtnText}>Skip for now (Add services later)</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Add Custom Service Modal */}
      <Modal
        visible={addModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setAddModalVisible(false);
          setNewServiceImage(null);
        }}
      >
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Custom Service</Text>
              <TouchableOpacity onPress={() => {
                setAddModalVisible(false);
                setNewServiceImage(null);
              }}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Service Name</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Hair Spa / Bridal Haircut"
              placeholderTextColor="#94a3b8"
              value={newServiceName}
              onChangeText={setNewServiceName}
            />

            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Price (₹)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. 350"
                  placeholderTextColor="#94a3b8"
                  keyboardType="number-pad"
                  value={newServicePrice}
                  onChangeText={setNewServicePrice}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Discount (₹)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="0 (Optional)"
                  placeholderTextColor="#94a3b8"
                  keyboardType="number-pad"
                  value={newServiceDiscount}
                  onChangeText={setNewServiceDiscount}
                />
              </View>
            </View>

            {/* Real-time converted discount percentage preview */}
            {(() => {
              const orig = parseFloat(newServicePrice || "0");
              const disc = parseFloat(newServiceDiscount || "0");
              const final = Math.max(0, orig - disc);
              const pct = orig > 0 && disc > 0 ? Math.round((disc / orig) * 100) : 0;
              return (
                <View style={{ backgroundColor: "#f0fdf4", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: "#bbf7d0", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 13, color: "#166534", fontWeight: "700" }}>
                    Customer Price: ₹{final}
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

            <Text style={styles.inputLabel}>Service Photo (Optional)</Text>
            {newServiceImage ? (
              <View style={styles.modalImagePreviewBox}>
                <Image source={{ uri: newServiceImage }} style={styles.modalImagePreview} />
                <View style={styles.modalImageActions}>
                  <TouchableOpacity style={styles.changeImageBtn} onPress={handlePickImageForNew}>
                    <Ionicons name="camera" size={14} color="#7c3aed" />
                    <Text style={styles.changeImageText}>Change</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.removeImageBtn} onPress={() => setNewServiceImage(null)}>
                    <Ionicons name="trash-outline" size={14} color="#ef4444" />
                    <Text style={styles.removeImageText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.modalPickImageBtn} onPress={handlePickImageForNew}>
                <Ionicons name="image-outline" size={22} color="#7c3aed" />
                <Text style={styles.modalPickImageText}>+ Choose Photo from Gallery</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.modalAddBtn} onPress={handleAddServiceSubmit}>
              <Text style={styles.modalAddBtnText}>Add Service</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit Service Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setEditModalVisible(false);
          setEditServiceImage(null);
        }}
      >
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Service Details</Text>
              <TouchableOpacity onPress={() => {
                setEditModalVisible(false);
                setEditServiceImage(null);
              }}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Service Name</Text>
            <TextInput
              style={styles.modalInput}
              value={editServiceName}
              placeholderTextColor="#94a3b8"
              onChangeText={setEditServiceName}
            />

            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Price (₹)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editServicePrice}
                  placeholderTextColor="#94a3b8"
                  keyboardType="number-pad"
                  onChangeText={setEditServicePrice}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Discount (₹)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editServiceDiscount}
                  placeholder="0 (Optional)"
                  placeholderTextColor="#94a3b8"
                  keyboardType="number-pad"
                  onChangeText={setEditServiceDiscount}
                />
              </View>
            </View>

            {/* Real-time converted discount percentage preview */}
            {(() => {
              const orig = parseFloat(editServicePrice || "0");
              const disc = parseFloat(editServiceDiscount || "0");
              const final = Math.max(0, orig - disc);
              const pct = orig > 0 && disc > 0 ? Math.round((disc / orig) * 100) : 0;
              return (
                <View style={{ backgroundColor: "#f0fdf4", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: "#bbf7d0", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 13, color: "#166534", fontWeight: "700" }}>
                    Customer Price: ₹{final}
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

            <Text style={styles.inputLabel}>Service Photo (Optional)</Text>
            {editServiceImage ? (
              <View style={styles.modalImagePreviewBox}>
                <Image source={{ uri: editServiceImage }} style={styles.modalImagePreview} />
                <View style={styles.modalImageActions}>
                  <TouchableOpacity style={styles.changeImageBtn} onPress={handlePickImageForEdit}>
                    <Ionicons name="camera" size={14} color="#7c3aed" />
                    <Text style={styles.changeImageText}>Change</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.removeImageBtn} onPress={() => setEditServiceImage(null)}>
                    <Ionicons name="trash-outline" size={14} color="#ef4444" />
                    <Text style={styles.removeImageText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.modalPickImageBtn} onPress={handlePickImageForEdit}>
                <Ionicons name="image-outline" size={22} color="#7c3aed" />
                <Text style={styles.modalPickImageText}>+ Choose Photo from Gallery</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.modalAddBtn} onPress={handleEditServiceSubmit}>
              <Text style={styles.modalAddBtnText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#ffffff" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  headerSkipBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  headerSkipText: { fontSize: 14, fontWeight: "700", color: "#7c3aed" },
  stepContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  stepActive: { backgroundColor: "#7c3aed" },
  stepDone: { backgroundColor: "#7c3aed" },
  stepText: { fontSize: 12, color: "#94a3b8", fontWeight: "600" },
  stepTextActive: { color: "#fff" },
  stepLine: { width: 20, height: 2, backgroundColor: "#e2e8f0", marginHorizontal: 4 },
  stepLineDone: { backgroundColor: "#7c3aed" },
  container: { padding: 20, paddingBottom: 40 },
  subtitle: { fontSize: 14, color: "#64748b", marginBottom: 14, textAlign: "center" },

  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#f5f3ff",
    borderWidth: 1,
    borderColor: "#ddd6fe",
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  infoBannerTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6d28d9",
    marginBottom: 2,
  },
  infoBannerSub: {
    fontSize: 11,
    color: "#5b21b6",
    lineHeight: 16,
  },

  quickSelectRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  selectedCountText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  quickActionLinks: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#7c3aed",
  },

  emptyContainer: {
    alignItems: "center",
    paddingVertical: 30,
    paddingHorizontal: 16,
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    marginBottom: 20,
  },
  emptyText: { fontSize: 15, fontWeight: "700", color: "#475569", marginTop: 8 },
  emptySub: { fontSize: 12, color: "#94a3b8", marginTop: 4, textAlign: "center" },
  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    padding: 10,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  serviceRowUnselected: {
    backgroundColor: "#f8fafc",
    borderColor: "#f1f5f9",
    opacity: 0.75,
  },
  checkboxTouch: {
    paddingRight: 8,
    paddingLeft: 2,
  },
  imgTouchWrapper: {
    marginRight: 10,
  },
  imageWrapperWithBadge: {
    position: "relative",
  },
  serviceImg: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
  },
  editImgBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: "#7c3aed",
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#ffffff",
  },
  emptyImgBox: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1.5,
    borderColor: "#cbd5e1",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },
  emptyImgText: {
    fontSize: 8,
    fontWeight: "700",
    color: "#94a3b8",
    marginTop: 1,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  serviceNameUnselected: { color: "#64748b" },
  serviceSubText: { fontSize: 10, color: "#94a3b8", marginTop: 2 },
  priceContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3e8ff",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    marginRight: 8,
  },
  currency: { fontSize: 14, fontWeight: "800", color: "#7c3aed", marginRight: 2 },
  priceInput: { width: 45, fontSize: 14, fontWeight: "800", color: "#7c3aed", textAlign: "right", paddingVertical: 0 },
  editBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: "#f3e8ff",
    marginRight: 6,
  },
  deleteBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: "#fee2e2",
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    backgroundColor: "#f5f3ff",
    borderWidth: 1.5,
    borderColor: "#c4b5fd",
    borderRadius: 14,
    marginTop: 8,
    marginBottom: 20,
  },
  addBtnText: { color: "#7c3aed", fontWeight: "700", fontSize: 14, marginLeft: 8 },
  btn: { backgroundColor: "#7c3aed", padding: 16, borderRadius: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  skipBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    marginTop: 10,
  },
  skipBtnText: {
    color: "#7c3aed",
    fontSize: 13,
    fontWeight: "700",
  },

  // Modal Styles
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 10,
  },
  modalTitle: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  inputLabel: { fontSize: 12, fontWeight: "700", color: "#64748b", marginBottom: 6, marginTop: 10 },
  modalInput: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: "#0f172a",
    backgroundColor: "#f8fafc",
  },
  modalAddBtn: {
    backgroundColor: "#7c3aed",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 20,
  },
  modalAddBtnText: { color: "#ffffff", fontWeight: "700", fontSize: 14 },

  modalPickImageBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f5f3ff",
    borderWidth: 1.5,
    borderColor: "#c4b5fd",
    borderStyle: "dashed",
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  modalPickImageText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#7c3aed",
  },
  modalImagePreviewBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  modalImagePreview: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
  },
  modalImageActions: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    paddingRight: 6,
  },
  changeImageBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3e8ff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
  },
  changeImageText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#7c3aed",
  },
  removeImageBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fee2e2",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
  },
  removeImageText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ef4444",
  },
});
