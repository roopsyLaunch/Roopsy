import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";

import { Modal } from "react-native";

export function PartnerReviewScreen({ navigation, route }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const { upgradeToPartner, upgradeToTailor } = useAuth();
  const data = route.params?.registrationData || {};

  const onSubmit = async () => {
    setBusy(true);
    setProgress(5);
    setProgressText("Initializing registration application...");
    
    try {
      if (data.category === "Stitching Center") {
        // Upload gallery photos first
        const images = data.images || [];
        const totalImages = images.length;
        const uploadedImages = [];

        for (let i = 0; i < totalImages; i++) {
          const uri = images[i];
          const displayIdx = i + 1;
          setProgressText(`Uploading tailor shop photo ${displayIdx} of ${totalImages}...`);

          if (uri.startsWith('http')) {
            uploadedImages.push(uri);
            const stepPercent = 10 + (displayIdx / (totalImages + 1)) * 30;
            setProgress(Math.round(stepPercent));
          } else {
            try {
              const formData = new FormData();
              formData.append("image", {
                uri,
                name: `tailor_photo_${Date.now()}_${i}.jpg`,
                type: "image/jpeg"
              });

              const uploadRes = await api.post("/upload", formData, {
                headers: { "Content-Type": "multipart/form-data" },
                onUploadProgress: (progressEvent) => {
                  const percentCompleted = progressEvent.total
                    ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
                    : 0;
                  
                  const imageWeight = 30 / (totalImages + 1);
                  const baseProgress = 10 + (i / (totalImages + 1)) * 30;
                  const chunkProgress = (percentCompleted / 100) * imageWeight;
                  setProgress(Math.round(baseProgress + chunkProgress));
                }
              });

              if (uploadRes.data && uploadRes.data.url) {
                uploadedImages.push(uploadRes.data.url);
              }
            } catch (err) {
              console.error("Failed to upload tailor image:", err);
            }
          }
        }

        setProgress(45);
        setProgressText("Registering tailor account details...");
        
        const payload = await upgradeToTailor({
          shopName: data.shopName,
          category: data.category,
          ownerName: data.ownerName,
          mobileNumber: data.mobileNumber,
          address: {
            line1: data.addressLine,
            city: data.city,
            pincode: data.pincode,
          },
          location: data.lat && data.lng ? { lat: Number(data.lat), lng: Number(data.lng) } : undefined,
          workingHours: data.hours,
          gallery: uploadedImages,
          seatCount: Number(data.seatCount) || 1,
        });

        // Register services
        const services = data.services || [];
        const totalServices = services.length;
        for (let idx = 0; idx < totalServices; idx++) {
          const svc = services[idx];
          const stepPercent = 50 + ((idx + 1) / totalServices) * 45;
          setProgress(Math.round(stepPercent));
          setProgressText(`Configuring stitching service: ${svc.name}...`);
          
          await api.post("/tailors/services", {
            name: svc.name,
            price: Number(svc.price) || 0,
            category: "Custom Stitching",
            estimatedDays: 3,
            genderCategory: "unisex"
          });
        }
        
        setProgress(100);
        setProgressText("Stitching Center successfully configured!");
        setTimeout(() => {
          navigation.navigate("PartnerSubmitted");
        }, 500);
        return;
      }

      // Barber / Salon Flow
      setProgress(15);
      setProgressText("Creating barber salon profile...");
      const payload = await upgradeToPartner(data.category || "Barber Shop");
      const newBarberId = payload.barber.id;

      // Post services
      const services = data.services || [];
      const totalServices = services.length;
      for (let idx = 0; idx < totalServices; idx++) {
        const svc = services[idx];
        const stepPercent = 15 + ((idx + 1) / (totalServices + 1)) * 30;
        setProgress(Math.round(stepPercent));
        setProgressText(`Adding salon service: ${svc.name}...`);
        
        await api.post("/services", {
          barberId: newBarberId,
          name: svc.name,
          durationMinutes: 30,
          price: Number(svc.price) || 0,
        });
      }

      // Upload gallery photos with real-time Axios upload progress
      const images = data.images || [];
      const totalImages = images.length;
      const uploadedImages = [];

      for (let i = 0; i < totalImages; i++) {
        const uri = images[i];
        const displayIdx = i + 1;
        setProgressText(`Uploading gallery photo ${displayIdx} of ${totalImages}...`);

        if (uri.startsWith('http')) {
          uploadedImages.push(uri);
          const stepPercent = 45 + (displayIdx / (totalImages + 1)) * 45;
          setProgress(Math.round(stepPercent));
        } else {
          try {
            const formData = new FormData();
            formData.append("image", {
              uri,
              name: `shop_photo_${Date.now()}_${i}.jpg`,
              type: "image/jpeg"
            });

            const uploadRes = await api.post("/upload", formData, {
              headers: { "Content-Type": "multipart/form-data" },
              onUploadProgress: (progressEvent) => {
                const percentCompleted = progressEvent.total
                  ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
                  : 0;
                
                const imageWeight = 45 / (totalImages + 1);
                const baseProgress = 45 + (i / (totalImages + 1)) * 45;
                const chunkProgress = (percentCompleted / 100) * imageWeight;
                setProgress(Math.round(baseProgress + chunkProgress));
              }
            });

            if (uploadRes.data && uploadRes.data.url) {
              uploadedImages.push(uploadRes.data.url);
            }
          } catch (err) {
            console.error("Failed to upload image:", err);
          }
        }
      }

      // Finally patch barber gallery profile
      setProgress(95);
      setProgressText("Finalizing salon profile gallery...");
      await api.patch("/barbers/me", {
        shopName: data.shopName,
        businessCategory: data.category,
        ownerName: data.ownerName,
        mobileNumber: data.mobileNumber,
        address: {
          line1: data.addressLine,
          city: data.city,
          pincode: data.pincode,
        },
        location: data.lat && data.lng ? { lat: Number(data.lat), lng: Number(data.lng) } : undefined,
        workingHours: data.hours,
        gallery: uploadedImages,
        seatCount: Number(data.seatCount) || 1,
        maxAdvanceBookingDays: (data.category === "Beauty Parlor" || data.category === "Salon") ? 30 : 1,
      });

      setProgress(100);
      setProgressText("All set! Shop registration completed.");
      setTimeout(() => {
        navigation.navigate("PartnerSubmitted");
      }, 500);
    } catch (e) {
      console.error(e);
      Alert.alert("Application Submission Failed", e?.response?.data?.error || "We encountered an error while processing your partner registration. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const StepIndicator = () => (
    <View style={styles.stepContainer}>
      {[1,2,3,4,5,6].map(step => (
        <React.Fragment key={step}>
          <View style={[styles.stepCircle, step === 5 && styles.stepActive, step < 5 && styles.stepDone]}>
            <Text style={[styles.stepText, step === 5 && styles.stepTextActive, step < 5 && styles.stepTextActive]}>{step}</Text>
          </View>
          {step < 6 && <View style={[styles.stepLine, step < 5 && styles.stepLineDone]} />}
        </React.Fragment>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </Pressable>
        <Text style={styles.headerTitle}>Review & Submit</Text>
        <View style={{ width: 40 }} />
      </View>
      <StepIndicator />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.subtitle}>Please review your details before submitting</Text>

        <View style={styles.summaryCard}>
          <View style={styles.row}>
            <Ionicons name="briefcase-outline" size={20} color="#64748b" style={styles.icon} />
            <View style={styles.textCol}>
              <Text style={styles.label}>Business Type</Text>
              <Text style={styles.val}>{data.category || "Barber Shop"}</Text>
            </View>
            <Pressable onPress={() => navigation.navigate("PartnerCategory")}><Text style={styles.editBtn}>Edit</Text></Pressable>
          </View>

          <View style={styles.row}>
            <Ionicons name="storefront-outline" size={20} color="#64748b" style={styles.icon} />
            <View style={styles.textCol}>
              <Text style={styles.label}>Shop Name</Text>
              <Text style={styles.val}>{data.shopName || "N/A"}</Text>
            </View>
            <Pressable onPress={() => navigation.navigate("PartnerBasicInfo")}><Text style={styles.editBtn}>Edit</Text></Pressable>
          </View>

          <View style={styles.row}>
            <Ionicons name="location-outline" size={20} color="#64748b" style={styles.icon} />
            <View style={styles.textCol}>
              <Text style={styles.label}>Address</Text>
              <Text style={styles.val}>{data.addressLine ? `${data.addressLine}, ${data.city}` : "N/A"}</Text>
            </View>
            <Pressable onPress={() => navigation.navigate("PartnerBasicInfo")}><Text style={styles.editBtn}>Edit</Text></Pressable>
          </View>

          <View style={styles.row}>
            <Ionicons name="cut-outline" size={20} color="#64748b" style={styles.icon} />
            <View style={styles.textCol}>
              <Text style={styles.label}>Services</Text>
              <Text style={styles.val}>{data.services?.length || 0} Services</Text>
            </View>
            <Pressable onPress={() => navigation.navigate("PartnerServices")}><Text style={styles.editBtn}>Edit</Text></Pressable>
          </View>

          <View style={styles.row}>
            <Ionicons name="time-outline" size={20} color="#64748b" style={styles.icon} />
            <View style={styles.textCol}>
              <Text style={styles.label}>Business Hours</Text>
              <Text style={styles.val}>7 Days a Week</Text>
            </View>
            <Pressable onPress={() => navigation.navigate("PartnerHours")}><Text style={styles.editBtn}>Edit</Text></Pressable>
          </View>

          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <Ionicons name="image-outline" size={20} color="#64748b" style={styles.icon} />
            <View style={styles.textCol}>
              <Text style={styles.label}>Photos</Text>
              <Text style={styles.val}>{data.images?.length || 0} Photos</Text>
            </View>
            <Pressable onPress={() => navigation.navigate("PartnerGallery")}><Text style={styles.editBtn}>Edit</Text></Pressable>
          </View>
        </View>

        <Pressable style={[styles.btn, busy && styles.btnDisabled]} onPress={onSubmit} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Submit for Review</Text>}
        </Pressable>
      </ScrollView>

      {/* Upload & Setup Progress Modal */}
      <Modal
        visible={busy}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.progressModalBg}>
          <View style={styles.progressCard}>
            <Ionicons name="cloud-upload" size={44} color="#7c3aed" style={styles.progressIcon} />
            <Text style={styles.progressTitle}>Submitting Application</Text>
            
            <View style={styles.progressBarContainer}>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
              </View>
              <Text style={styles.progressPercent}>{progress}%</Text>
            </View>

            <Text style={styles.progressText}>{progressText}</Text>
            <Text style={styles.progressSub}>Please do not close the app or lock your screen</Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#ffffff" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 16, fontWeight: "700" },
  stepContainer: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16 },
  stepCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#f1f5f9", justifyContent: "center", alignItems: "center" },
  stepActive: { backgroundColor: "#6d28d9" },
  stepDone: { backgroundColor: "#6d28d9" },
  stepText: { fontSize: 12, color: "#94a3b8", fontWeight: "600" },
  stepTextActive: { color: "#fff" },
  stepLine: { width: 20, height: 2, backgroundColor: "#e2e8f0", marginHorizontal: 4 },
  stepLineDone: { backgroundColor: "#6d28d9" },
  container: { padding: 24 },
  subtitle: { fontSize: 14, color: "#64748b", marginBottom: 24, textAlign: "center" },
  summaryCard: { backgroundColor: "#f8fafc", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#e2e8f0", marginBottom: 30 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  icon: { width: 24, marginRight: 12 },
  textCol: { flex: 1 },
  label: { fontSize: 12, color: "#64748b", marginBottom: 2 },
  val: { fontSize: 14, fontWeight: "600", color: "#0f172a" },
  editBtn: { fontSize: 13, fontWeight: "600", color: "#6d28d9", padding: 4 },
  btn: { backgroundColor: "#6d28d9", padding: 16, borderRadius: 12, alignItems: "center" },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  // Progress Modal styles
  progressModalBg: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  progressCard: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  progressIcon: {
    marginBottom: 16,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 20,
  },
  progressBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: 16,
  },
  progressBarBg: {
    flex: 1,
    height: 10,
    backgroundColor: "#f1f5f9",
    borderRadius: 5,
    overflow: "hidden",
    marginRight: 12,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#7c3aed",
    borderRadius: 5,
  },
  progressPercent: {
    fontSize: 16,
    fontWeight: "800",
    color: "#7c3aed",
    minWidth: 45,
    textAlign: "right",
  },
  progressText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#475569",
    textAlign: "center",
    marginBottom: 8,
  },
  progressSub: {
    fontSize: 11.5,
    color: "#94a3b8",
    textAlign: "center",
  },
});
