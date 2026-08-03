import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../api/client";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function MeasurementFormScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const profileToEdit = route.params?.profile;
  const isEditing = !!profileToEdit;

  const [saving, setSaving] = useState(false);

  // Form State
  const [profileName, setProfileName] = useState(profileToEdit?.profileName || "");
  const [gender, setGender] = useState(profileToEdit?.gender || "male");
  const [measurementType, setMeasurementType] = useState(profileToEdit?.measurementType || "custom");
  const [standardSize, setStandardSize] = useState(profileToEdit?.standardSize || "M");
  const [unit, setUnit] = useState(profileToEdit?.unit || "inches");
  
  // Custom measurements state
  const initialMeasurements = profileToEdit?.measurements || {};
  const [measurements, setMeasurements] = useState({
    neck: initialMeasurements.neck?.toString() || "",
    chest: initialMeasurements.chest?.toString() || "",
    waist: initialMeasurements.waist?.toString() || "",
    hips: initialMeasurements.hips?.toString() || "",
    shoulder: initialMeasurements.shoulder?.toString() || "",
    sleeve: initialMeasurements.sleeve?.toString() || "",
    length: initialMeasurements.length?.toString() || "",
    inseam: initialMeasurements.inseam?.toString() || "",
    thigh: initialMeasurements.thigh?.toString() || "",
  });

  const handleMeasurementChange = (key, val) => {
    setMeasurements(prev => ({ ...prev, [key]: val }));
  };

  const handleSave = async () => {
    if (!profileName.trim()) {
      return Alert.alert("Error", "Profile name is required.");
    }

    setSaving(true);
    
    // Parse strings to numbers
    const parsedMeasurements = {};
    Object.keys(measurements).forEach(k => {
      if (measurements[k]) {
        parsedMeasurements[k] = parseFloat(measurements[k]);
      }
    });

    const payload = {
      profileName,
      gender,
      measurementType,
      standardSize,
      unit,
      measurements: parsedMeasurements
    };

    try {
      if (isEditing) {
        await api.put(`/measurements/${profileToEdit._id}`, payload);
      } else {
        await api.post("/measurements", payload);
      }
      navigation.goBack();
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color="#0f172a" />
      </Pressable>
      <Text style={styles.headerTitle}>{isEditing ? "Edit Profile" : "New Profile"}</Text>
      <View style={{ width: 44 }} />
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 20) }]}>
      {renderHeader()}
      
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Basic Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Info</Text>
          <View style={styles.inputWrapper}>
            <Text style={styles.label}>Profile Name</Text>
            <TextInput 
              style={styles.input} 
              placeholder="e.g., My Wedding Suit, Dad's Shirt"
              value={profileName}
              onChangeText={setProfileName}
            />
          </View>

          <Text style={styles.label}>Gender</Text>
          <View style={styles.toggleRow}>
            {["male", "female", "other"].map(g => (
              <Pressable 
                key={g} 
                style={[styles.toggleBtn, gender === g && styles.toggleBtnActive]}
                onPress={() => setGender(g)}
              >
                <Text style={[styles.toggleText, gender === g && styles.toggleTextActive]}>{g}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Measurement Type */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sizing Method</Text>
          <View style={styles.toggleRow}>
            <Pressable 
              style={[styles.toggleBtn, measurementType === "standard" && styles.toggleBtnActive]}
              onPress={() => setMeasurementType("standard")}
            >
              <Text style={[styles.toggleText, measurementType === "standard" && styles.toggleTextActive]}>Standard Size</Text>
            </Pressable>
            <Pressable 
              style={[styles.toggleBtn, measurementType === "custom" && styles.toggleBtnActive]}
              onPress={() => setMeasurementType("custom")}
            >
              <Text style={[styles.toggleText, measurementType === "custom" && styles.toggleTextActive]}>Custom (Manual)</Text>
            </Pressable>
          </View>
        </View>

        {/* Standard Sizing Form */}
        {measurementType === "standard" && (
          <View style={styles.section}>
            <Text style={styles.label}>Select Size</Text>
            <View style={styles.sizeGrid}>
              {["S", "M", "L", "XL", "XXL", "3XL"].map(sz => (
                <Pressable 
                  key={sz} 
                  style={[styles.sizeBtn, standardSize === sz && styles.sizeBtnActive]}
                  onPress={() => setStandardSize(sz)}
                >
                  <Text style={[styles.sizeBtnText, standardSize === sz && styles.sizeBtnTextActive]}>{sz}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Custom Measurements Form */}
        {measurementType === "custom" && (
          <View style={styles.section}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>Measurements</Text>
              <View style={styles.toggleRowSmall}>
                {["inches", "cm"].map(u => (
                  <Pressable 
                    key={u} 
                    style={[styles.toggleBtnSmall, unit === u && styles.toggleBtnSmallActive]}
                    onPress={() => setUnit(u)}
                  >
                    <Text style={[styles.toggleTextSmall, unit === u && styles.toggleTextSmallActive]}>{u}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.measurementGrid}>
              {[
                { key: "neck", label: "Neck" },
                { key: "chest", label: "Chest" },
                { key: "shoulder", label: "Shoulder" },
                { key: "sleeve", label: "Sleeve Length" },
                { key: "waist", label: "Waist" },
                { key: "hips", label: "Hips" },
                { key: "length", label: "Total Length" },
                { key: "inseam", label: "Inseam" },
                { key: "thigh", label: "Thigh" },
              ].map(field => (
                <View key={field.key} style={styles.measurementInputBox}>
                  <Text style={styles.measurementLabel}>{field.label}</Text>
                  <View style={styles.measurementInputWrapper}>
                    <TextInput 
                      style={styles.measurementInput}
                      keyboardType="numeric"
                      placeholder="0"
                      value={measurements[field.key]}
                      onChangeText={(val) => handleMeasurementChange(field.key, val)}
                    />
                    <Text style={styles.unitText}>{unit === "inches" ? "in" : "cm"}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <Pressable 
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Profile</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 16, backgroundColor: "#f8fafc" },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#ffffff", justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  headerTitle: { fontSize: 20, fontWeight: "900", color: "#0f172a" },
  
  scrollContent: { padding: 20, paddingBottom: 120 },
  section: { backgroundColor: "#ffffff", padding: 16, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: "#f1f5f9" },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: "#0f172a", marginBottom: 16 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  
  label: { fontSize: 13, fontWeight: "700", color: "#475569", marginBottom: 8, marginTop: 4 },
  inputWrapper: { marginBottom: 12 },
  input: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 12, paddingHorizontal: 16, height: 50, fontSize: 15, color: "#0f172a" },
  
  toggleRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  toggleBtn: { flex: 1, height: 44, borderRadius: 12, backgroundColor: "#f1f5f9", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "transparent" },
  toggleBtnActive: { backgroundColor: "#f5f3ff", borderColor: "#6d28d9" },
  toggleText: { fontSize: 14, fontWeight: "600", color: "#475569", textTransform: "capitalize" },
  toggleTextActive: { color: "#6d28d9" },
  
  toggleRowSmall: { flexDirection: "row", backgroundColor: "#f1f5f9", borderRadius: 8, padding: 4 },
  toggleBtnSmall: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  toggleBtnSmallActive: { backgroundColor: "#ffffff", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  toggleTextSmall: { fontSize: 12, fontWeight: "600", color: "#64748b" },
  toggleTextSmallActive: { color: "#0f172a" },

  sizeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  sizeBtn: { width: "31%", height: 50, borderRadius: 12, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", justifyContent: "center", alignItems: "center" },
  sizeBtnActive: { backgroundColor: "#0f172a", borderColor: "#0f172a" },
  sizeBtnText: { fontSize: 16, fontWeight: "700", color: "#475569" },
  sizeBtnTextActive: { color: "#ffffff" },

  measurementGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  measurementInputBox: { width: "48%", marginBottom: 16 },
  measurementLabel: { fontSize: 12, fontWeight: "600", color: "#64748b", marginBottom: 6 },
  measurementInputWrapper: { flexDirection: "row", alignItems: "center", backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 12, paddingHorizontal: 12, height: 48 },
  measurementInput: { flex: 1, fontSize: 16, fontWeight: "600", color: "#0f172a" },
  unitText: { fontSize: 12, color: "#94a3b8", fontWeight: "600", marginLeft: 4 },

  bottomBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#ffffff", paddingHorizontal: 24, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: "#f1f5f9",
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 10,
  },
  saveBtn: { backgroundColor: "#6d28d9", height: 56, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: "#ffffff", fontSize: 16, fontWeight: "700" }
});
