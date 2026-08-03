import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, Image, ActivityIndicator, Alert, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { api } from "../api/client";
import { uploadImageAsync } from "../api/upload";

import { useAuth } from "../context/AuthContext";

export function BarberProfileEditScreen({ navigation }) {
  const { user, tailor } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [categoryType, setCategoryType] = useState("");
  const [shopName, setShopName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [shopPosterUrl, setShopPosterUrl] = useState("");
  const [gallery, setGallery] = useState([]);
  const [offersHomeService, setOffersHomeService] = useState(false);
  const [homeServiceFee, setHomeServiceFee] = useState("0");
  const [workingHours, setWorkingHours] = useState({});
  const [lunchTime, setLunchTime] = useState({ isActive: false, startTime: "13:00", endTime: "14:00" });
  const [staff, setStaff] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        if (user?.role === "tailor" && tailor) {
          setCategoryType("Tailor");
          setShopName(tailor.shopName || "");
          setBio(tailor.bio || "");
          setAvatarUrl(tailor.avatarUrl || "");
          setShopPosterUrl(tailor.shopPosterUrl || "");
          setGallery(tailor.gallery || []);
          setOffersHomeService(tailor.offersHomeService || false);
          setHomeServiceFee(tailor.visitFee ? String(tailor.visitFee) : "0");
          setLoading(false);
          return;
        }

        const res = await api.get("/barbers/me");
        const b = res.data.barber;
        setCategoryType(b.categoryType || "");
        setShopName(b.shopName || "");
        setBio(b.bio || "");
        setAvatarUrl(b.avatarUrl || "");
        setShopPosterUrl(b.shopPosterUrl || "");
        setGallery(b.gallery || []);
        setOffersHomeService(b.offersHomeService || false);
        setHomeServiceFee(b.homeServiceFee ? String(b.homeServiceFee) : "0");
        setWorkingHours(b.workingHours || {
          mon: { open: "09:00", close: "18:00", isClosed: false },
          tue: { open: "09:00", close: "18:00", isClosed: false },
          wed: { open: "09:00", close: "18:00", isClosed: false },
          thu: { open: "09:00", close: "18:00", isClosed: false },
          fri: { open: "09:00", close: "18:00", isClosed: false },
          sat: { open: "09:00", close: "17:00", isClosed: false },
          sun: { open: "10:00", close: "16:00", isClosed: false },
        });
        setLunchTime(b.lunchTime || { isActive: false, startTime: "13:00", endTime: "14:00" });
        setStaff(b.staff || []);
      } catch (err) {
        if (err.response?.status !== 403) {
          console.error(err);
          Alert.alert("Error", "Failed to load shop profile");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [user, tailor]);

  const updateDayHour = (day, field, value) => {
    setWorkingHours(prev => {
      const currentDay = prev[day] || { open: "09:00", close: "18:00", isClosed: false };
      return {
        ...prev,
        [day]: {
          ...currentDay,
          [field]: value
        }
      };
    });
  };

  const updateStaff = (index, field, value) => {
    const newStaff = [...staff];
    newStaff[index][field] = value;
    setStaff(newStaff);
  };

  const removeStaff = (index) => {
    const newStaff = [...staff];
    newStaff.splice(index, 1);
    setStaff(newStaff);
  };

  const pickImage = async (type) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false, // Optional cropping - full image preserved
      quality: 1, // Full width/height resolution
    });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      if (type === "avatar") setAvatarUrl(uri);
      if (type === "poster") setShopPosterUrl(uri);
      if (type === "gallery") {
        if (gallery.length >= 5) {
          Alert.alert("Limit Reached", "You can only have up to 5 gallery images.");
          return;
        }
        setGallery([...gallery, uri]);
      }
    }
  };

  const removeGalleryImage = (index) => {
    const newGallery = [...gallery];
    newGallery.splice(index, 1);
    setGallery(newGallery);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let finalAvatar = avatarUrl;
      let finalPoster = shopPosterUrl;
      let finalGallery = [...gallery];

      if (avatarUrl && !avatarUrl.startsWith("http")) {
        finalAvatar = await uploadImageAsync(avatarUrl);
      }
      if (shopPosterUrl && !shopPosterUrl.startsWith("http")) {
        finalPoster = await uploadImageAsync(shopPosterUrl);
      }
      
      for (let i = 0; i < finalGallery.length; i++) {
        if (!finalGallery[i].startsWith("http")) {
          finalGallery[i] = await uploadImageAsync(finalGallery[i]);
        }
      }

      if (user?.role === "tailor") {
        await api.patch("/tailors/me", {
          shopName,
          bio,
          avatarUrl: finalAvatar,
          shopPosterUrl: finalPoster,
          gallery: finalGallery,
          offersHomeService,
          visitFee: Number(homeServiceFee) || 0,
        });
      } else {
        await api.patch("/barbers/me", {
          shopName,
          bio,
          avatarUrl: finalAvatar,
          shopPosterUrl: finalPoster,
          gallery: finalGallery,
          offersHomeService,
          homeServiceFee: Number(homeServiceFee) || 0,
          workingHours,
          lunchTime,
          staff
        });
      }

      Alert.alert("Success", "Shop profile updated successfully!");
      navigation.goBack();
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6d28d9" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </Pressable>
        <Text style={styles.headerTitle}>Edit Shop Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Unified Premium Profile Header Preview */}
        <View style={styles.assetHeaderCard}>
          <Pressable style={styles.coverBox} onPress={() => pickImage("poster")}>
            {shopPosterUrl ? (
              <Image source={{ uri: shopPosterUrl }} style={styles.coverImage} resizeMode="cover" />
            ) : (
              <View style={styles.coverPlaceholder}>
                <Ionicons name="image-outline" size={32} color="#94a3b8" />
                <Text style={styles.coverPlaceholderText}>Add Cover Photo</Text>
              </View>
            )}
            <View style={styles.editIconBadge}>
              <Ionicons name="camera" size={16} color="#ffffff" />
            </View>
          </Pressable>

          <View style={styles.avatarOverlapContainer}>
            <Pressable style={styles.avatarCircle} onPress={() => pickImage("avatar")}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={36} color="#94a3b8" />
                </View>
              )}
              <View style={styles.avatarEditBadge}>
                <Ionicons name="pencil" size={12} color="#ffffff" />
              </View>
            </Pressable>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Shop Information</Text>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Shop Name</Text>
          <TextInput style={styles.input} value={shopName} onChangeText={setShopName} placeholder="Enter shop name" />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Bio / Description</Text>
          <TextInput 
            style={[styles.input, { minHeight: 100, textAlignVertical: "top" }]} 
            value={bio} 
            onChangeText={setBio} 
            placeholder="Tell customers about your shop..." 
            multiline 
          />
        </View>

        <View style={[styles.inputGroup, styles.switchGroup]}>
          <View style={styles.switchTextCol}>
            <Text style={styles.label}>
              {categoryType === "Tailor" || user?.role === "tailor" ? "Offers Premium Service" : "Offers Home Service"}
            </Text>
            <Text style={styles.subLabel}>
              {categoryType === "Tailor" || user?.role === "tailor" ? "Provide exclusive door-to-door or VIP tailoring service" : "Visit customers at their home"}
            </Text>
          </View>
          <Switch 
            value={offersHomeService} 
            onValueChange={setOffersHomeService} 
            trackColor={{ false: "#e2e8f0", true: "#6d28d9" }}
            thumbColor="#ffffff"
          />
        </View>

        {offersHomeService && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              {categoryType === "Tailor" || user?.role === "tailor" ? "Premium Service Extra Fee (₹)" : "Home Service Extra Fee (₹)"}
            </Text>
            <TextInput 
              style={styles.input} 
              value={homeServiceFee} 
              onChangeText={setHomeServiceFee} 
              placeholder="e.g. 100" 
              keyboardType="number-pad" 
            />
          </View>
        )}

          <View style={{ backgroundColor: "#ffffff", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#e2e8f0", marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
              <Text style={[styles.label, { marginBottom: 0, fontSize: 15 }]}>Enable Daily Lunch Time</Text>
              <Switch 
                value={lunchTime.isActive} 
                onValueChange={(val) => setLunchTime(prev => ({ ...prev, isActive: val }))}
                trackColor={{ false: "#cbd5e1", true: "#6d28d9" }}
                thumbColor="#fff"
              />
            </View>
            {lunchTime.isActive && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={[styles.label, { fontSize: 11 }]}>Lunch Start (HH:MM)</Text>
                  <TextInput 
                    style={[styles.input, { padding: 10, fontSize: 14 }]} 
                    value={lunchTime.startTime} 
                    onChangeText={(val) => setLunchTime(prev => ({ ...prev, startTime: val }))}
                    placeholder="13:00"
                    maxLength={5}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { fontSize: 11 }]}>Lunch End (HH:MM)</Text>
                  <TextInput 
                    style={[styles.input, { padding: 10, fontSize: 14 }]} 
                    value={lunchTime.endTime} 
                    onChangeText={(val) => setLunchTime(prev => ({ ...prev, endTime: val }))}
                    placeholder="14:00"
                    maxLength={5}
                  />
                </View>
              </View>
            )}
          </View>

        <Text style={styles.sectionTitle}>Working Hours</Text>
        <View style={{ backgroundColor: "#ffffff", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#e2e8f0", marginBottom: 20 }}>
          {["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map(day => {
            const dayData = workingHours[day] || { open: "09:00", close: "18:00", isClosed: false };
            return (
              <View key={day} style={{ marginBottom: 15, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <Text style={[styles.label, { marginBottom: 0, fontSize: 15, textTransform: 'uppercase' }]}>{day}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ marginRight: 8, color: "#64748b", fontSize: 12 }}>Closed</Text>
                    <Switch 
                      value={dayData.isClosed} 
                      onValueChange={(val) => updateDayHour(day, 'isClosed', val)}
                      trackColor={{ false: "#cbd5e1", true: "#ef4444" }}
                      thumbColor="#fff"
                    />
                  </View>
                </View>
                {!dayData.isClosed && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text style={[styles.label, { fontSize: 11 }]}>Open (HH:MM AM/PM)</Text>
                      <TextInput 
                        style={[styles.input, { padding: 10, fontSize: 14 }]} 
                        value={dayData.open} 
                        onChangeText={(val) => updateDayHour(day, 'open', val)}
                        placeholder="09:00 AM"
                        maxLength={8}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.label, { fontSize: 11 }]}>Close (HH:MM AM/PM)</Text>
                      <TextInput 
                        style={[styles.input, { padding: 10, fontSize: 14 }]} 
                        value={dayData.close} 
                        onChangeText={(val) => updateDayHour(day, 'close', val)}
                        placeholder="06:00 PM"
                        maxLength={8}
                      />
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Staff Members</Text>
        <View style={{ backgroundColor: "#ffffff", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#e2e8f0", marginBottom: 20 }}>
          {staff.map((st, i) => (
             <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
               <TextInput style={[styles.input, {flex: 1, padding: 10}]} value={st.name} onChangeText={(t) => updateStaff(i, 'name', t)} placeholder="Name" />
               <TextInput style={[styles.input, {flex: 1, padding: 10}]} value={st.role} onChangeText={(t) => updateStaff(i, 'role', t)} placeholder="Role (e.g. Stylist)" />
               <Pressable onPress={() => removeStaff(i)} style={{justifyContent: 'center', padding: 8}}><Ionicons name="trash" size={20} color="#ef4444" /></Pressable>
             </View>
          ))}
          <Pressable style={{ padding: 12, backgroundColor: "#f1f5f9", borderRadius: 8, alignItems: "center" }} onPress={() => setStaff([...staff, { name: "", role: "", isActive: true }])}>
             <Text style={{ color: "#6d28d9", fontWeight: "600" }}>+ Add Staff Member</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Gallery (Up to 5)</Text>
        <View style={styles.galleryGrid}>
          {gallery.map((uri, index) => (
            <View key={index} style={styles.galleryItemBox}>
              <Image source={{ uri }} style={styles.galleryImage} />
              <Pressable style={styles.removeBtn} onPress={() => removeGalleryImage(index)}>
                <Ionicons name="close" size={16} color="#fff" />
              </Pressable>
            </View>
          ))}
          {gallery.length < 5 && (
            <Pressable style={styles.addGalleryBtn} onPress={() => pickImage("gallery")}>
              <Ionicons name="add" size={32} color="#6d28d9" />
            </Pressable>
          )}
        </View>

      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Profile</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f8fafc" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 16 },
  backBtn: { width: 40, height: 40, justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#0f172a" },
  scrollContent: { padding: 20, paddingBottom: 100 },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: "#475569", textTransform: "uppercase", marginTop: 24, marginBottom: 12 },
  
  // Unified Header Styles
  assetHeaderCard: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  coverBox: {
    width: "100%",
    height: 150,
    backgroundColor: "#f1f5f9",
    position: "relative",
  },
  coverImage: {
    width: "100%",
    height: "100%",
  },
  coverPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  coverPlaceholderText: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "700",
    marginTop: 6,
  },
  editIconBadge: {
    position: "absolute",
    bottom: 12,
    right: 12,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    padding: 8,
    borderRadius: 20,
  },
  avatarOverlapContainer: {
    width: "100%",
    alignItems: "center",
    marginTop: -45,
    paddingBottom: 15,
  },
  avatarCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#ffffff",
    borderWidth: 4,
    borderColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    position: "relative",
  },
  avatarImg: {
    width: "100%",
    height: "100%",
    borderRadius: 45,
  },
  avatarPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 45,
  },
  avatarEditBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    backgroundColor: "#6d28d9",
    padding: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#ffffff",
  },

  inputGroup: { marginBottom: 16 },
  switchGroup: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#ffffff", padding: 14, borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0" },
  switchTextCol: { flex: 1 },
  label: { fontSize: 13, fontWeight: "600", color: "#64748b", marginBottom: 8 },
  subLabel: { fontSize: 12, color: "#94a3b8", marginTop: -4 },
  input: { backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 12, padding: 14, fontSize: 15, color: "#0f172a" },

  galleryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  galleryItemBox: { width: 100, height: 100, borderRadius: 16, overflow: "hidden", position: "relative" },
  galleryImage: { width: "100%", height: "100%" },
  removeBtn: { position: "absolute", top: 6, right: 6, backgroundColor: "rgba(239, 68, 68, 0.9)", width: 24, height: 24, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  addGalleryBtn: { width: 100, height: 100, borderRadius: 16, borderWidth: 2, borderColor: "#c4b5fd", borderStyle: "dashed", backgroundColor: "#f5f3ff", justifyContent: "center", alignItems: "center" },

  footer: { padding: 20, backgroundColor: "#ffffff", borderTopWidth: 1, borderTopColor: "#f1f5f9" },
  saveBtn: { backgroundColor: "#6d28d9", height: 56, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  saveBtnText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
});
