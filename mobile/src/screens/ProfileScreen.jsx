import React from "react";
import { Pressable, StyleSheet, Text, View, ScrollView, Dimensions, Modal, TextInput, Image, ActivityIndicator, RefreshControl, Switch, Alert, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../context/AuthContext";
import { uploadImageAsync } from "../api/upload";
import { api } from "../api/client";
import LocationPickerModal from "../components/LocationPickerModal";

const { width } = Dimensions.get("window");

export function ProfileScreen() {
  const navigation = useNavigation();
  const { user, barber, tailor, logout, refreshMe } = useAuth();
  const isBarber = user?.role === "barber" || user?.role === "admin";
  const isTailor = user?.role === "tailor";
  const isPartner = isBarber || isTailor;

  let partnerTypeStr = "PARTNER";
  if (isTailor) {
    partnerTypeStr = "TAILOR PARTNER";
  } else if (isBarber && barber) {
    const bio = barber.bio || "";
    const shopName = (barber.shopName || "").toLowerCase();
    const bCat = (barber.businessCategory || "").toLowerCase();

    if (bio.includes("Beauty Parlor") || shopName.includes("parlor") || shopName.includes("beauty") || bCat.includes("beauty")) {
      partnerTypeStr = "BEAUTY PARLOR PARTNER";
    } else if (bio.includes("Stitching") || bio.includes("Tailor") || shopName.includes("tailor") || shopName.includes("stitch") || bCat.includes("tailor") || bCat.includes("stitching")) {
      partnerTypeStr = "TAILOR PARTNER";
    } else {
      partnerTypeStr = "BARBER PARTNER";
    }
  }

  const getInitial = () => {
    return user?.name ? user.name.charAt(0).toUpperCase() : "U";
  };

  const [editModalVisible, setEditModalVisible] = React.useState(false);
  const [editName, setEditName] = React.useState("");
  const [editPhone, setEditPhone] = React.useState("");
  const [editAvatar, setEditAvatar] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  const [workingHoursModalVisible, setWorkingHoursModalVisible] = React.useState(false);
  const [editWorkingHours, setEditWorkingHours] = React.useState({});
  const [savingWH, setSavingWH] = React.useState(false);

  // New Modals State
  const [paymentModalVisible, setPaymentModalVisible] = React.useState(false);
  const [savedUpi, setSavedUpi] = React.useState(user?.bank?.upiId || "user@upi");
  const [codEnabled, setCodEnabled] = React.useState(true);

  const [notifSettingsModalVisible, setNotifSettingsModalVisible] = React.useState(false);
  const [pushEnabled, setPushEnabled] = React.useState(true);
  const [smsEnabled, setSmsEnabled] = React.useState(true);
  const [tailorAlertsEnabled, setTailorAlertsEnabled] = React.useState(true);
  const [promoEnabled, setPromoEnabled] = React.useState(false);

  const [aboutModalVisible, setAboutModalVisible] = React.useState(false);
  const [contactModalVisible, setContactModalVisible] = React.useState(false);

  const [supportModalVisible, setSupportModalVisible] = React.useState(false);
  const [expandedFaq, setExpandedFaq] = React.useState(null);

  const [privacyModalVisible, setPrivacyModalVisible] = React.useState(false);

  const [locationModalVisible, setLocationModalVisible] = React.useState(false);
  const [editAddressLine, setEditAddressLine] = React.useState(user?.address?.line1 || barber?.address?.line1 || tailor?.address?.line1 || "");
  const [editCity, setEditCity] = React.useState(user?.address?.city || barber?.address?.city || tailor?.address?.city || "");
  const [editPincode, setEditPincode] = React.useState(user?.address?.pincode || barber?.address?.pincode || tailor?.address?.pincode || "");
  const [savingLocation, setSavingLocation] = React.useState(false);

  const [verificationModalVisible, setVerificationModalVisible] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    if (!refreshMe) return;
    setRefreshing(true);
    try {
      await refreshMe();
    } catch (error) {
      console.error(error);
    } finally {
      setRefreshing(false);
    }
  }, [refreshMe]);

  const openEditModal = () => {
    setEditName(user?.name || "");
    setEditPhone(user?.phone || "");
    setEditAvatar(user?.avatarUrl || "");
    setEditModalVisible(true);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      setEditAvatar(result.assets[0].uri);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      let finalAvatarUrl = user?.avatarUrl;
      // If editAvatar is a local file URI (from image picker), upload it
      if (editAvatar && editAvatar !== user?.avatarUrl) {
        if (!editAvatar.startsWith("http")) {
          finalAvatarUrl = await uploadImageAsync(editAvatar);
        } else {
          finalAvatarUrl = editAvatar;
        }
      }

      const res = await api.patch("/auth/me", {
        name: editName,
        phone: editPhone,
        avatarUrl: finalAvatarUrl,
      });

      // Update the user context via a refresh or set user
      // Actually, since AuthContext doesn't expose setUser directly, we can just reload the app or if we have a refresh function
      // Let's assume auth context updates if we fetch /auth/me or we can just alert them to restart
      alert("Profile updated successfully! Pull to refresh to see changes (or restart app).");
      setEditModalVisible(false);
    } catch (e) {
      console.error(e);
      alert("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const openWorkingHoursModal = () => {
    const defaultWH = {
      mon: { open: "09:00", close: "18:00", isClosed: false },
      tue: { open: "09:00", close: "18:00", isClosed: false },
      wed: { open: "09:00", close: "18:00", isClosed: false },
      thu: { open: "09:00", close: "18:00", isClosed: false },
      fri: { open: "09:00", close: "18:00", isClosed: false },
      sat: { open: "09:00", close: "17:00", isClosed: false },
      sun: { open: "10:00", close: "16:00", isClosed: false },
    };
    
    setEditWorkingHours(barber?.workingHours ? JSON.parse(JSON.stringify(barber.workingHours)) : defaultWH);
    setWorkingHoursModalVisible(true);
  };

  const saveWorkingHours = async () => {
    setSavingWH(true);
    try {
      await api.patch("/barbers/me", {
        workingHours: editWorkingHours,
      });
      if (refreshMe) await refreshMe();
      alert("Working hours updated successfully!");
      setWorkingHoursModalVisible(false);
    } catch (e) {
      console.error(e);
      alert("Failed to update working hours");
    } finally {
      setSavingWH(false);
    }
  };

  const updateDayHour = (day, field, value) => {
    setEditWorkingHours(prev => {
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

  const openLocationModal = () => {
    setLocationModalVisible(true);
  };

  const handleSelectLocation = async (loc) => {
    setSavingLocation(true);
    try {
      const payload = {
        address: {
          line1: loc.line1 || loc.shortName || "",
          city: loc.city || loc.shortName || "Lucknow",
          pincode: loc.pincode || "",
          lat: loc.lat,
          lng: loc.lng,
        },
      };

      if (isBarber) {
        await api.patch("/barbers/me", payload);
      } else if (isTailor) {
        await api.patch("/tailors/me", payload);
      } else {
        await api.patch("/auth/me", payload);
      }

      if (refreshMe) await refreshMe();
      Alert.alert("Success ✅", "Location updated successfully!");
      setLocationModalVisible(false);
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Could not save location.");
    } finally {
      setSavingLocation(false);
    }
  };

  const OptionRow = ({ icon, label, value, color = "#64748b", isDanger = false, onPress }) => (
    <Pressable style={styles.optionRow} onPress={onPress}>
      <View style={[styles.iconWrapper, { backgroundColor: isDanger ? "#fee2e2" : "#f1f5f9" }]}>
        <Ionicons name={icon} size={20} color={isDanger ? "#ef4444" : color} />
      </View>
      <View style={styles.optionContent}>
        <Text style={[styles.optionLabel, isDanger && { color: "#ef4444" }]}>{label}</Text>
        {value ? <Text style={styles.optionValue} numberOfLines={1}>{value}</Text> : null}
      </View>
      {!isDanger && <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />}
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView 
        contentContainerStyle={styles.scrollContainer} 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6d28d9" />}
      >
        
        {/* Top Header Background */}
        <View style={styles.headerBackground}>
          <View style={styles.headerDecoration1} />
          <View style={styles.headerDecoration2} />
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <Pressable style={styles.editBtn} onPress={openEditModal}>
            <Ionicons name="pencil" size={18} color="#6d28d9" />
          </Pressable>

          <View style={styles.avatarContainer}>
            {user?.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{getInitial()}</Text>
            )}
            {isPartner && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
              </View>
            )}
          </View>
          
          <Text style={styles.userName}>{user?.name || "Premium User"}</Text>
          <Text style={styles.userEmail}>{user?.email || "user@example.com"}</Text>
          
          <View style={styles.roleBadge}>
            <Ionicons name={isPartner ? "star" : "person"} size={12} color="#ffffff" />
            <Text style={styles.roleText}>
              {isPartner ? partnerTypeStr : "CUSTOMER"}
            </Text>
          </View>
        </View>

        {/* Shop Dashboard Section (Only for Partners) */}
        {isBarber && barber && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Shop Dashboard</Text>
            <View style={styles.cardGroup}>
              <OptionRow 
                icon="storefront-outline" 
                label="Shop Name" 
                value={barber.shopName || "Not set"} 
                color="#6d28d9" 
                onPress={openEditModal}
              />
              <OptionRow 
                icon="shield-checkmark-outline" 
                label="Verification Status" 
                value={barber.approvalStatus} 
                color="#22c55e" 
                onPress={() => setVerificationModalVisible(true)}
              />
              <OptionRow 
                icon="location-outline" 
                label="Location Settings" 
                color="#0284c7" 
                onPress={openLocationModal}
              />
              <OptionRow 
                icon="time-outline" 
                label="Working Hours" 
                color="#f59e0b"
                onPress={openWorkingHoursModal}
              />
            </View>
          </View>
        )}

        {isTailor && tailor && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Shop Dashboard</Text>
            <View style={styles.cardGroup}>
              <OptionRow 
                icon="storefront-outline" 
                label="Shop Name" 
                value={tailor.shopName || "Not set"} 
                color="#0d9488" 
                onPress={openEditModal}
              />
              <OptionRow 
                icon="shield-checkmark-outline" 
                label="Verification Status" 
                value={tailor.approvalStatus} 
                color="#22c55e" 
                onPress={() => setVerificationModalVisible(true)}
              />
              <OptionRow 
                icon="location-outline" 
                label="Location Settings" 
                color="#0284c7" 
                onPress={openLocationModal}
              />
            </View>
          </View>
        )}

        {/* Account Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Settings</Text>
          <View style={styles.cardGroup}>
            <OptionRow icon="person-outline" label="Personal Information" color="#0f172a" onPress={openEditModal} />
            <OptionRow icon="wallet-outline" label="Payment Methods" color="#0f172a" onPress={() => setPaymentModalVisible(true)} />
            <OptionRow icon="notifications-outline" label="Notifications" color="#0f172a" onPress={() => setNotifSettingsModalVisible(true)} />
          </View>
        </View>

        {/* Help & Support */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Help & Support</Text>
          <View style={styles.cardGroup}>
            <OptionRow 
              icon="book-outline" 
              label="App User Guide & How To Use 📘" 
              color="#7c3aed" 
              onPress={() => navigation.navigate("UserGuide")} 
            />
            <OptionRow icon="help-circle-outline" label="FAQ & Support" color="#64748b" onPress={() => setSupportModalVisible(true)} />
            <OptionRow icon="information-circle-outline" label="About Us" color="#3b82f6" onPress={() => setAboutModalVisible(true)} />
            <OptionRow icon="mail-outline" label="Contact Us" color="#10b981" onPress={() => setContactModalVisible(true)} />
            <OptionRow icon="lock-closed-outline" label="Privacy Policy" color="#64748b" onPress={() => setPrivacyModalVisible(true)} />
          </View>
        </View>

        {user?.role === "admin" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Admin</Text>
            <View style={styles.cardGroup}>
              <OptionRow 
                icon="shield-checkmark" 
                label="Admin Panel" 
                color="#0f172a" 
                onPress={() => navigation.navigate("AdminWorkspace")} 
              />
            </View>
          </View>
        )}

        {/* Log Out */}
        <View style={[styles.section, { paddingBottom: 40 }]}>
          <View style={styles.cardGroup}>
            <OptionRow 
              icon="log-out-outline" 
              label="Log Out" 
              isDanger={true} 
              onPress={logout} 
            />
          </View>
        </View>

      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={editModalVisible} transparent animationType="slide" onRequestClose={() => setEditModalVisible(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <Pressable onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={28} color="#94a3b8" />
              </Pressable>
            </View>

            <View style={styles.modalBody}>
              <View style={{ alignItems: "center", marginBottom: 20 }}>
                <Pressable onPress={pickImage} style={styles.editAvatarWrapper}>
                  {editAvatar ? (
                    <Image source={{ uri: editAvatar }} style={styles.editAvatarImage} />
                  ) : (
                    <View style={styles.editAvatarPlaceholder}>
                      <Text style={styles.editAvatarText}>{getInitial()}</Text>
                    </View>
                  )}
                  <View style={styles.editAvatarIconBox}>
                    <Ionicons name="camera" size={16} color="#fff" />
                  </View>
                </Pressable>
              </View>

              <Text style={styles.inputLabel}>Name</Text>
              <TextInput style={styles.inputBox} value={editName} onChangeText={setEditName} placeholder="Your name" />

              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput style={styles.inputBox} value={editPhone} onChangeText={setEditPhone} placeholder="Phone number" keyboardType="phone-pad" />

              <Pressable style={styles.saveBtn} onPress={saveProfile} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Working Hours Modal */}
      <Modal visible={workingHoursModalVisible} transparent animationType="slide" onRequestClose={() => setWorkingHoursModalVisible(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalSheet, { height: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Working Hours</Text>
              <Pressable onPress={() => setWorkingHoursModalVisible(false)}>
                <Ionicons name="close" size={28} color="#94a3b8" />
              </Pressable>
            </View>
            <ScrollView style={styles.modalBody}>
              {["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map(day => {
                const dayData = editWorkingHours[day] || { open: "09:00", close: "18:00", isClosed: false };
                return (
                  <View key={day} style={{ marginBottom: 20, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <Text style={[styles.inputLabel, { marginBottom: 0, fontSize: 16 }]}>{day}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ marginRight: 8, color: "#64748b" }}>Closed</Text>
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
                          <Text style={styles.inputLabel}>Open (HH:MM AM/PM)</Text>
                          <TextInput 
                            style={[styles.inputBox, { marginBottom: 0 }]} 
                            value={dayData.open} 
                            onChangeText={(val) => updateDayHour(day, 'open', val)}
                            placeholder="09:00 AM"
                            maxLength={8}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.inputLabel}>Close (HH:MM AM/PM)</Text>
                          <TextInput 
                            style={[styles.inputBox, { marginBottom: 0 }]} 
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
              <Pressable style={styles.saveBtn} onPress={saveWorkingHours} disabled={savingWH}>
                {savingWH ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Working Hours</Text>}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Payment Methods Modal */}
      <Modal visible={paymentModalVisible} transparent animationType="slide" onRequestClose={() => setPaymentModalVisible(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalSheet, { maxHeight: "85%" }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="wallet" size={24} color="#6d28d9" style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Payment Methods 💳</Text>
              </View>
              <Pressable onPress={() => setPaymentModalVisible(false)}>
                <Ionicons name="close" size={26} color="#94a3b8" />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>Manage your preferred payment options for instant salon & tailor bookings.</Text>

              {/* UPI Section */}
              <View style={{ backgroundColor: "#f8fafc", padding: 16, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: "#e2e8f0" }}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                  <Ionicons name="qr-code" size={20} color="#7c3aed" style={{ marginRight: 8 }} />
                  <Text style={{ fontSize: 15, fontWeight: "800", color: "#0f172a" }}>UPI Payment (GPay, PhonePe, Paytm)</Text>
                </View>
                <Text style={styles.inputLabel}>Saved UPI ID</Text>
                <TextInput 
                  style={[styles.inputBox, { marginBottom: 10 }]} 
                  value={savedUpi} 
                  onChangeText={setSavedUpi} 
                  placeholder="yourname@upi" 
                />
                <Pressable style={[styles.saveBtn, { paddingVertical: 10 }]} onPress={() => Alert.alert("UPI Saved ✅", "Your UPI ID has been updated.")}>
                  <Text style={[styles.saveBtnText, { fontSize: 13 }]}>Save UPI ID</Text>
                </Pressable>
              </View>

              {/* Cash on Delivery */}
              <View style={{ backgroundColor: "#f8fafc", padding: 16, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: "#e2e8f0", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flexDirection: "row", alignItems: "center", flex: 1, marginRight: 10 }}>
                  <Ionicons name="cash" size={22} color="#16a34a" style={{ marginRight: 10 }} />
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: "800", color: "#0f172a" }}>Pay at Salon / Shop (COD)</Text>
                    <Text style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>Pay in cash or UPI directly after service completion.</Text>
                  </View>
                </View>
                <Switch 
                  value={codEnabled} 
                  onValueChange={setCodEnabled}
                  trackColor={{ false: "#cbd5e1", true: "#86efac" }}
                  thumbColor={codEnabled ? "#16a34a" : "#fff"}
                />
              </View>

              {/* Supported Badges */}
              <Text style={[styles.inputLabel, { marginTop: 10 }]}>Supported Payment Gateway Options</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
                {["Google Pay", "PhonePe", "Paytm UPI", "Credit/Debit Card", "NetBanking"].map((method, i) => (
                  <View key={i} style={{ backgroundColor: "#f1f5f9", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: "#cbd5e1" }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#334155" }}>✓ {method}</Text>
                  </View>
                ))}
              </View>

              <Pressable style={[styles.saveBtn, { backgroundColor: "#f1f5f9" }]} onPress={() => setPaymentModalVisible(false)}>
                <Text style={[styles.saveBtnText, { color: "#475569" }]}>Close</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Notification Settings Modal */}
      <Modal visible={notifSettingsModalVisible} transparent animationType="slide" onRequestClose={() => setNotifSettingsModalVisible(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalSheet, { maxHeight: "85%" }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="notifications" size={24} color="#7c3aed" style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Notification Settings 🔔</Text>
              </View>
              <Pressable onPress={() => setNotifSettingsModalVisible(false)}>
                <Ionicons name="close" size={26} color="#94a3b8" />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={{ backgroundColor: "#f8fafc", padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: "#e2e8f0", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={{ fontSize: 14, fontWeight: "800", color: "#0f172a" }}>Push Notifications</Text>
                  <Text style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>Real-time alerts for booking confirmation & queue status.</Text>
                </View>
                <Switch value={pushEnabled} onValueChange={setPushEnabled} trackColor={{ false: "#cbd5e1", true: "#c4b5fd" }} thumbColor={pushEnabled ? "#7c3aed" : "#fff"} />
              </View>

              <View style={{ backgroundColor: "#f8fafc", padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: "#e2e8f0", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={{ fontSize: 14, fontWeight: "800", color: "#0f172a" }}>SMS Reminders</Text>
                  <Text style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>SMS alerts with 4-digit OTP codes for appointment arrival.</Text>
                </View>
                <Switch value={smsEnabled} onValueChange={setSmsEnabled} trackColor={{ false: "#cbd5e1", true: "#c4b5fd" }} thumbColor={smsEnabled ? "#7c3aed" : "#fff"} />
              </View>

              <View style={{ backgroundColor: "#f8fafc", padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: "#e2e8f0", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={{ fontSize: 14, fontWeight: "800", color: "#0f172a" }}>Tailor Delivery & OTP Alerts</Text>
                  <Text style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>Notifications when tailor generates Delivery OTP.</Text>
                </View>
                <Switch value={tailorAlertsEnabled} onValueChange={setTailorAlertsEnabled} trackColor={{ false: "#cbd5e1", true: "#c4b5fd" }} thumbColor={tailorAlertsEnabled ? "#7c3aed" : "#fff"} />
              </View>

              <View style={{ backgroundColor: "#f8fafc", padding: 16, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: "#e2e8f0", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={{ fontSize: 14, fontWeight: "800", color: "#0f172a" }}>Promotional Offers & Deals</Text>
                  <Text style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>Special discounts from top salons & tailors near you.</Text>
                </View>
                <Switch value={promoEnabled} onValueChange={setPromoEnabled} trackColor={{ false: "#cbd5e1", true: "#c4b5fd" }} thumbColor={promoEnabled ? "#7c3aed" : "#fff"} />
              </View>

              <Pressable 
                style={[styles.saveBtn, { backgroundColor: "#7c3aed", marginBottom: 10 }]} 
                onPress={() => {
                  setNotifSettingsModalVisible(false);
                  navigation.navigate("Home", { screen: "HomeMain" });
                }}
              >
                <Text style={styles.saveBtnText}>View Notifications Inbox 📩</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* FAQ & Support Modal */}
      <Modal visible={supportModalVisible} transparent animationType="slide" onRequestClose={() => setSupportModalVisible(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalSheet, { maxHeight: "85%" }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="help-circle" size={24} color="#0284c7" style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Help & Support ❓</Text>
              </View>
              <Pressable onPress={() => setSupportModalVisible(false)}>
                <Ionicons name="close" size={26} color="#94a3b8" />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>Find answers to common questions or reach our 24/7 customer support team.</Text>

              {/* FAQs */}
              {[
                { q: "How do I book a barber or salon service?", a: "Go to Home Dashboard -> Select Barber -> Choose your service & slot -> Confirm booking." },
                { q: "How does 4-digit OTP verification work?", a: "After booking, a 4-digit OTP is shown on your booking card. Show this code to the barber/tailor partner upon arrival to start your service." },
                { q: "How do Tailor Home Measurements work?", a: "Select Tailor -> Choose Home Visit -> Tailor partner visits your location to collect outfit measurements & fabric." },
                { q: "What is Tailor Delivery OTP?", a: "When your stitched outfit is ready, the tailor generates a 4-digit Delivery OTP. Share it upon receiving your outfit to complete the order." },
                { q: "How do I cancel a booking?", a: "Go to My Bookings -> Find your active booking -> Tap Cancel. (Note: Bookings cannot be cancelled after tailor OTP is verified)." },
              ].map((faq, idx) => (
                <Pressable 
                  key={idx} 
                  style={{ backgroundColor: "#f8fafc", padding: 14, borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: "#e2e8f0" }}
                  onPress={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ fontSize: 13.5, fontWeight: "800", color: "#0f172a", flex: 1 }}>{faq.q}</Text>
                    <Ionicons name={expandedFaq === idx ? "chevron-up" : "chevron-down"} size={18} color="#64748b" />
                  </View>
                  {expandedFaq === idx && (
                    <Text style={{ fontSize: 12, color: "#475569", marginTop: 8, lineHeight: 18, borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingTop: 8 }}>{faq.a}</Text>
                  )}
                </Pressable>
              ))}

              <Text style={[styles.inputLabel, { marginTop: 14 }]}>Contact Support Team</Text>
              <View style={{ gap: 10, marginBottom: 20 }}>
                <Pressable 
                  style={{ backgroundColor: "#0284c7", paddingVertical: 12, borderRadius: 12, flexDirection: "row", justifyContent: "center", alignItems: "center" }}
                  onPress={() => Linking.openURL("tel:1800123456")}
                >
                  <Ionicons name="call" size={18} color="#ffffff" style={{ marginRight: 8 }} />
                  <Text style={{ color: "#ffffff", fontWeight: "800", fontSize: 13.5 }}>Call Customer Support (Toll Free)</Text>
                </Pressable>

                <Pressable 
                  style={{ backgroundColor: "#16a34a", paddingVertical: 12, borderRadius: 12, flexDirection: "row", justifyContent: "center", alignItems: "center" }}
                  onPress={() => Linking.openURL("https://wa.me/919876543210")}
                >
                  <Ionicons name="logo-whatsapp" size={18} color="#ffffff" style={{ marginRight: 8 }} />
                  <Text style={{ color: "#ffffff", fontWeight: "800", fontSize: 13.5 }}>Chat on WhatsApp</Text>
                </Pressable>
              </View>

              <Pressable style={[styles.saveBtn, { backgroundColor: "#f1f5f9" }]} onPress={() => setSupportModalVisible(false)}>
                <Text style={[styles.saveBtnText, { color: "#475569" }]}>Close</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Privacy Policy Modal */}
      <Modal visible={privacyModalVisible} transparent animationType="slide" onRequestClose={() => setPrivacyModalVisible(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalSheet, { maxHeight: "85%" }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="shield-checkmark" size={24} color="#6d28d9" style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Privacy Policy & Terms 🔒</Text>
              </View>
              <Pressable onPress={() => setPrivacyModalVisible(false)}>
                <Ionicons name="close" size={26} color="#94a3b8" />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={{ fontSize: 13, color: "#64748b", marginBottom: 14 }}>Your privacy and data security are our top priorities.</Text>

              <View style={{ backgroundColor: "#f8fafc", padding: 14, borderRadius: 14, marginBottom: 12, borderWidth: 1, borderColor: "#e2e8f0" }}>
                <Text style={{ fontSize: 14, fontWeight: "800", color: "#0f172a", marginBottom: 4 }}>1. Personal Information Security</Text>
                <Text style={{ fontSize: 12, color: "#475569", lineHeight: 18 }}>We securely encrypt your personal profile data, mobile numbers, and service locations. We never share your data with unauthorized third parties.</Text>
              </View>

              <View style={{ backgroundColor: "#f8fafc", padding: 14, borderRadius: 14, marginBottom: 12, borderWidth: 1, borderColor: "#e2e8f0" }}>
                <Text style={{ fontSize: 14, fontWeight: "800", color: "#0f172a", marginBottom: 4 }}>2. 4-Digit OTP Code Security</Text>
                <Text style={{ fontSize: 12, color: "#475569", lineHeight: 18 }}>Your 4-digit booking OTP and Delivery OTP are unique single-use passcodes generated to protect your appointments and outfit deliveries.</Text>
              </View>

              <View style={{ backgroundColor: "#f8fafc", padding: 14, borderRadius: 14, marginBottom: 20, borderWidth: 1, borderColor: "#e2e8f0" }}>
                <Text style={{ fontSize: 14, fontWeight: "800", color: "#0f172a", marginBottom: 4 }}>3. Ratings & Reviews Policy</Text>
                <Text style={{ fontSize: 12, color: "#475569", lineHeight: 18 }}>Reviews submitted after tailor/barber service completion represent genuine verified customer experiences.</Text>
              </View>

              <Pressable style={[styles.saveBtn, { backgroundColor: "#6d28d9" }]} onPress={() => setPrivacyModalVisible(false)}>
                <Text style={styles.saveBtnText}>I Understand & Agree</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Leaflet & OpenStreetMap Location Picker Modal */}
      <LocationPickerModal
        visible={locationModalVisible}
        onClose={() => setLocationModalVisible(false)}
        onSelectLocation={handleSelectLocation}
        initialCity={user?.address?.city || barber?.address?.city || tailor?.address?.city || "Lucknow"}
        initialAddress={user?.address?.line1 || barber?.address?.line1 || tailor?.address?.line1 || ""}
      />

      {/* Verification Status Modal */}
      <Modal visible={verificationModalVisible} transparent animationType="slide" onRequestClose={() => setVerificationModalVisible(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="shield-checkmark" size={24} color="#22c55e" style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Partner Status 🛡️</Text>
              </View>
              <Pressable onPress={() => setVerificationModalVisible(false)}>
                <Ionicons name="close" size={26} color="#94a3b8" />
              </Pressable>
            </View>

            <View style={styles.modalBody}>
              <View style={{ alignItems: "center", marginVertical: 16 }}>
                <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "#dcfce7", justifyContent: "center", alignItems: "center", marginBottom: 12 }}>
                  <Ionicons name="checkmark-circle" size={40} color="#16a34a" />
                </View>
                <Text style={{ fontSize: 18, fontWeight: "900", color: "#0f172a" }}>Verified Partner Shop ✅</Text>
                <Text style={{ fontSize: 13, color: "#64748b", textAlign: "center", marginTop: 8, lineHeight: 20 }}>
                  Your shop profile is approved and active. You can receive live customer bookings, manage queues, and process tailoring orders.
                </Text>
              </View>

              <Pressable style={[styles.saveBtn, { backgroundColor: "#16a34a" }]} onPress={() => setVerificationModalVisible(false)}>
                <Text style={styles.saveBtnText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* About Us Modal */}
      <Modal visible={aboutModalVisible} transparent animationType="slide" onRequestClose={() => setAboutModalVisible(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalSheet, { maxHeight: "80%" }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="information-circle" size={24} color="#3b82f6" style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>About Us ℹ️</Text>
              </View>
              <Pressable onPress={() => setAboutModalVisible(false)}>
                <Ionicons name="close" size={26} color="#94a3b8" />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={{ alignItems: "center", marginBottom: 20 }}>
                <View style={{ width: 80, height: 80, borderRadius: 20, backgroundColor: "#ede9fe", justifyContent: "center", alignItems: "center", marginBottom: 12, overflow: "hidden" }}>
                  <Image source={require("../../assets/logo.jpeg")} style={{ width: "100%", height: "100%", borderRadius: 20 }} />
                </View>
                <Text style={{ fontSize: 20, fontWeight: "900", color: "#0f172a" }}>ROOPSY</Text>
                <Text style={{ fontSize: 13, color: "#6d28d9", fontWeight: "700", marginTop: 4 }}>Version 1.0.0</Text>
              </View>

              <Text style={{ fontSize: 13.5, color: "#475569", lineHeight: 22, textAlign: "justify", marginBottom: 16 }}>
                Welcome to our premium Barber, Beauty Parlour & Stitching (Tailor) platform. We connect clients directly with certified local grooming experts and custom designers.
              </Text>

              <View style={{ backgroundColor: "#f8fafc", padding: 16, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: "#e2e8f0" }}>
                <Text style={{ fontSize: 14, fontWeight: "800", color: "#0f172a", marginBottom: 6 }}>🎯 Our Mission</Text>
                <Text style={{ fontSize: 12, color: "#475569", lineHeight: 18 }}>
                  To save customer time through smart scheduling, coordinate GPS location detection, and verify only highly-rated expert professionals.
                </Text>
              </View>

              <View style={{ backgroundColor: "#f8fafc", padding: 16, borderRadius: 16, marginBottom: 24, borderWidth: 1, borderColor: "#e2e8f0" }}>
                <Text style={{ fontSize: 14, fontWeight: "800", color: "#0f172a", marginBottom: 6 }}>✨ Core Features</Text>
                <Text style={{ fontSize: 12, color: "#475569", lineHeight: 18 }}>
                  • GPS locator with automatic one-click reverse-geocoding.{"\n"}
                  • Real-time queue management & custom styling options.{"\n"}
                  • Secure 4-digit verification codes for client safety.
                </Text>
              </View>

              <Pressable style={styles.saveBtn} onPress={() => setAboutModalVisible(false)}>
                <Text style={styles.saveBtnText}>Close</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Contact Us Modal */}
      <Modal visible={contactModalVisible} transparent animationType="slide" onRequestClose={() => setContactModalVisible(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="mail" size={24} color="#10b981" style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Contact Us 📞</Text>
              </View>
              <Pressable onPress={() => setContactModalVisible(false)}>
                <Ionicons name="close" size={26} color="#94a3b8" />
              </Pressable>
            </View>

            <View style={styles.modalBody}>
              <Text style={{ fontSize: 14, color: "#475569", marginBottom: 20, textAlign: "center", lineHeight: 22 }}>
                Have questions or need assistance? Our customer support team is available 24/7.
              </Text>

              {/* Info Rows */}
              <View style={{ gap: 14, marginBottom: 24 }}>
                <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#f8fafc", padding: 14, borderRadius: 12 }}>
                  <Ionicons name="mail-outline" size={20} color="#6d28d9" style={{ marginRight: 12 }} />
                  <View>
                    <Text style={{ fontSize: 10, color: "#94a3b8", fontWeight: "700" }}>SUPPORT EMAIL</Text>
                    <Text style={{ fontSize: 14, color: "#0f172a", fontWeight: "600" }}>support@starpriyanshu.com</Text>
                  </View>
                </View>

                <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#f8fafc", padding: 14, borderRadius: 12 }}>
                  <Ionicons name="call-outline" size={20} color="#6d28d9" style={{ marginRight: 12 }} />
                  <View>
                    <Text style={{ fontSize: 10, color: "#94a3b8", fontWeight: "700" }}>TOLL FREE CALL</Text>
                    <Text style={{ fontSize: 14, color: "#0f172a", fontWeight: "600" }}>1800-123-456</Text>
                  </View>
                </View>

                <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#f8fafc", padding: 14, borderRadius: 12 }}>
                  <Ionicons name="time-outline" size={20} color="#6d28d9" style={{ marginRight: 12 }} />
                  <View>
                    <Text style={{ fontSize: 10, color: "#94a3b8", fontWeight: "700" }}>BUSINESS HOURS</Text>
                    <Text style={{ fontSize: 14, color: "#0f172a", fontWeight: "600" }}>Mon - Sun (9:00 AM - 9:00 PM)</Text>
                  </View>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={{ gap: 10, marginBottom: 10 }}>
                <Pressable 
                  style={{ backgroundColor: "#10b981", paddingVertical: 14, borderRadius: 14, flexDirection: "row", justifyContent: "center", alignItems: "center" }}
                  onPress={() => Linking.openURL("mailto:support@starpriyanshu.com")}
                >
                  <Ionicons name="mail" size={18} color="#ffffff" style={{ marginRight: 8 }} />
                  <Text style={{ color: "#ffffff", fontWeight: "800", fontSize: 14 }}>Send Support Email</Text>
                </Pressable>

                <Pressable 
                  style={{ backgroundColor: "#0284c7", paddingVertical: 14, borderRadius: 14, flexDirection: "row", justifyContent: "center", alignItems: "center" }}
                  onPress={() => Linking.openURL("tel:1800123456")}
                >
                  <Ionicons name="call" size={18} color="#ffffff" style={{ marginRight: 8 }} />
                  <Text style={{ color: "#ffffff", fontWeight: "800", fontSize: 14 }}>Call Toll Free</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  scrollContainer: {
    paddingBottom: 100,
  },
  headerBackground: {
    backgroundColor: "#6d28d9",
    height: 160,
    width: "100%",
    position: "absolute",
    top: 0,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: "hidden",
  },
  headerDecoration1: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.1)",
    top: -50,
    right: -50,
  },
  headerDecoration2: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(255,255,255,0.05)",
    top: 60,
    left: -40,
  },
  profileCard: {
    backgroundColor: "#ffffff",
    marginHorizontal: 20,
    marginTop: 80,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  avatarContainer: {
    position: "relative",
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 3,
    borderColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarText: {
    fontSize: 36,
    fontWeight: "800",
    color: "#6d28d9",
  },
  editBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    backgroundColor: "#f1f5f9",
    padding: 8,
    borderRadius: 12,
  },
  verifiedBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 2,
  },
  userName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 16,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f172a",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  roleText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginLeft: 6,
  },
  section: {
    marginTop: 24,
    marginHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#334155",
    marginBottom: 12,
    marginLeft: 4,
  },
  cardGroup: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f8fafc",
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0f172a",
  },
  optionValue: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
    textTransform: "capitalize",
  },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#ffffff", borderTopLeftRadius: 30, borderTopRightRadius: 30 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 24, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  modalBody: { padding: 24, paddingBottom: 40 },
  editAvatarWrapper: { width: 100, height: 100, borderRadius: 50, marginBottom: 10 },
  editAvatarPlaceholder: { width: "100%", height: "100%", backgroundColor: "#f1f5f9", borderRadius: 50, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#e2e8f0" },
  editAvatarImage: { width: "100%", height: "100%", borderRadius: 50, borderWidth: 2, borderColor: "#e2e8f0" },
  editAvatarText: { fontSize: 40, fontWeight: "800", color: "#94a3b8" },
  editAvatarIconBox: { position: "absolute", bottom: 0, right: 0, backgroundColor: "#6d28d9", width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center", borderWidth: 3, borderColor: "#fff" },
  inputLabel: { fontSize: 13, fontWeight: "700", color: "#475569", marginBottom: 8, textTransform: "uppercase" },
  inputBox: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 12, padding: 14, fontSize: 16, color: "#0f172a", marginBottom: 20 },
  saveBtn: { backgroundColor: "#6d28d9", padding: 16, borderRadius: 16, alignItems: "center", marginTop: 10 },
  saveBtnText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
});
