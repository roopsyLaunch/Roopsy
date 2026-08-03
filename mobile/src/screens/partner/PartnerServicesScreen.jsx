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

export function PartnerServicesScreen({ navigation, route }) {
  const category = route.params?.registrationData?.category || "Barber Shop";
  const isParlor = category === "Beauty Parlor";
  const isStitching = category === "Tailor" || category === "Stitching Center";

  const defaultServices = isParlor
    ? [
        {
          id: "1",
          name: "Makeup",
          price: "500",
          image: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=200&auto=format&fit=crop&q=80",
        },
        {
          id: "2",
          name: "Facial",
          price: "300",
          image: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=200&auto=format&fit=crop&q=80",
        },
        {
          id: "3",
          name: "Waxing",
          price: "200",
          image: "https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=200&auto=format&fit=crop&q=80",
        },
        {
          id: "4",
          name: "Hair Styling",
          price: "250",
          image: "https://images.unsplash.com/photo-1562322140-8baeececf3df?w=200&auto=format&fit=crop&q=80",
        },
        {
          id: "5",
          name: "Threading",
          price: "50",
          image: "https://images.unsplash.com/photo-1604654894610-df63bc536371?w=200&auto=format&fit=crop&q=80",
        },
      ]
    : isStitching
    ? [
        {
          id: "1",
          name: "Suit Stitching",
          price: "800",
          image: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=200&auto=format&fit=crop&q=80",
        },
        {
          id: "2",
          name: "Blouse Stitching",
          price: "400",
          image: "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=200&auto=format&fit=crop&q=80",
        },
        {
          id: "3",
          name: "Kurta Stitching",
          price: "500",
          image: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=200&auto=format&fit=crop&q=80",
        },
        {
          id: "4",
          name: "Alteration",
          price: "100",
          image: "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=200&auto=format&fit=crop&q=80",
        },
        {
          id: "5",
          name: "Pants Stitching",
          price: "300",
          image: "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=200&auto=format&fit=crop&q=80",
        },
      ]
    : [
        {
          id: "1",
          name: "Haircut",
          price: "150",
          image: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=200&auto=format&fit=crop&q=80",
        },
        {
          id: "2",
          name: "Beard Trim",
          price: "100",
          image: "https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=200&auto=format&fit=crop&q=80",
        },
        {
          id: "3",
          name: "Shaving",
          price: "120",
          image: "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=200&auto=format&fit=crop&q=80",
        },
        {
          id: "4",
          name: "Hair Wash & Spa",
          price: "200",
          image: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=200&auto=format&fit=crop&q=80",
        },
      ];

  const fallbackImage = isParlor
    ? "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=200&auto=format&fit=crop&q=80"
    : isStitching
    ? "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=200&auto=format&fit=crop&q=80"
    : "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=200&auto=format&fit=crop&q=80";

  const [services, setServices] = useState(defaultServices);

  // Add Service Modal state
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newServiceName, setNewServiceName] = useState("");
  const [newServicePrice, setNewServicePrice] = useState("");

  // Edit Service Modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [editServiceName, setEditServiceName] = useState("");
  const [editServicePrice, setEditServicePrice] = useState("");

  const openEditModal = (svc) => {
    setEditingService(svc);
    setEditServiceName(svc.name);
    setEditServicePrice(svc.price);
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

    setServices((prev) =>
      prev.map((s) =>
        s.id === editingService.id
          ? { ...s, name: editServiceName.trim(), price: editServicePrice.trim() }
          : s
      )
    );
    setEditModalVisible(false);
    setEditingService(null);
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

    const newService = {
      id: Date.now().toString(),
      name: newServiceName.trim(),
      price: newServicePrice.trim(),
      image: fallbackImage,
    };

    setServices((prev) => [...prev, newService]);
    setNewServiceName("");
    setNewServicePrice("");
    setAddModalVisible(false);
  };

  const onContinue = () => {
    if (services.length === 0) {
      Alert.alert("Services Required", "Please add at least one service to continue.");
      return;
    }
    navigation.navigate("PartnerHours", {
      registrationData: { ...(route.params?.registrationData || {}), services },
    });
  };

  const StepIndicator = () => (
    <View style={styles.stepContainer}>
      {[1, 2, 3, 4, 5, 6].map((step) => (
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
          {step < 6 && <View style={[styles.stepLine, step < 2 && styles.stepLineDone]} />}
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
        <Text style={styles.headerTitle}>Add Services</Text>
        <View style={{ width: 40 }} />
      </View>

      <StepIndicator />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>Set your service list and pricing</Text>

        {services.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="cut-outline" size={40} color="#cbd5e1" />
            <Text style={styles.emptyText}>No services added yet.</Text>
            <Text style={styles.emptySub}>Tap '+ Add New Service' below to add services.</Text>
          </View>
        ) : (
          services.map((svc, idx) => (
            <View key={svc.id} style={styles.serviceRow}>
              <Image source={{ uri: svc.image || fallbackImage }} style={styles.serviceImg} />
              
              <View style={styles.serviceInfo}>
                <Text style={styles.serviceName}>{svc.name}</Text>
                <Text style={styles.serviceSubText}>Tap price to edit</Text>
              </View>

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

              <TouchableOpacity
                onPress={() => openEditModal(svc)}
                style={styles.editBtn}
              >
                <Ionicons name="create-outline" size={18} color="#7c3aed" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setServices(services.filter((s) => s.id !== svc.id))}
                style={styles.deleteBtn}
              >
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ))
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

        <Pressable style={styles.btn} onPress={onContinue}>
          <Text style={styles.btnText}>Continue</Text>
        </Pressable>
      </ScrollView>

      {/* Add Custom Service Modal */}
      <Modal
        visible={addModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Custom Service</Text>
              <TouchableOpacity onPress={() => setAddModalVisible(false)}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Service Name</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Hair Spa / Bridal Haircut"
              value={newServiceName}
              onChangeText={setNewServiceName}
            />

            <Text style={styles.inputLabel}>Price (₹)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. 350"
              keyboardType="number-pad"
              value={newServicePrice}
              onChangeText={setNewServicePrice}
            />

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
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Service Details</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Service Name</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Service Name"
              value={editServiceName}
              onChangeText={setEditServiceName}
            />

            <Text style={styles.inputLabel}>Price (₹)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Price"
              keyboardType="number-pad"
              value={editServicePrice}
              onChangeText={setEditServicePrice}
            />

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
  stepContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
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
  container: { padding: 24, paddingBottom: 40 },
  subtitle: { fontSize: 14, color: "#64748b", marginBottom: 20, textAlign: "center" },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 30,
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    marginBottom: 20,
  },
  emptyText: { fontSize: 15, fontWeight: "700", color: "#475569", marginTop: 8 },
  emptySub: { fontSize: 12, color: "#94a3b8", marginTop: 2 },
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
  serviceImg: {
    width: 48,
    height: 48,
    borderRadius: 12,
    marginRight: 12,
    backgroundColor: "#f1f5f9",
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
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
    marginBottom: 24,
  },
  addBtnText: { color: "#7c3aed", fontWeight: "700", fontSize: 14, marginLeft: 8 },
  btn: { backgroundColor: "#7c3aed", padding: 16, borderRadius: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
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
});
