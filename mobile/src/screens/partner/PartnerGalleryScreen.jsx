import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import * as ImagePicker from "expo-image-picker";

export function PartnerGalleryScreen({ navigation, route }) {
  const [images, setImages] = React.useState(route.params?.registrationData?.images || []);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false, // Crop optional - full image preserved
      quality: 1, // Full width/height resolution
      allowsMultipleSelection: true, // Select multiple photos at once
      selectionLimit: 10,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const newUris = result.assets.map((asset) => asset.uri);
      setImages((prev) => [...prev, ...newUris]);
    }
  };

  const removeImage = (indexToRemove) => {
    setImages((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const onContinue = () => {
    navigation.navigate("PartnerReview", {
      registrationData: { ...(route.params?.registrationData || {}), images },
    });
  };

  const StepIndicator = () => (
    <View style={styles.stepContainer}>
      {[1, 2, 3, 4, 5, 6].map((step) => (
        <React.Fragment key={step}>
          <View
            style={[
              styles.stepCircle,
              step === 4 && styles.stepActive,
              step < 4 && styles.stepDone,
            ]}
          >
            <Text
              style={[
                styles.stepText,
                step === 4 && styles.stepTextActive,
                step < 4 && styles.stepTextActive,
              ]}
            >
              {step}
            </Text>
          </View>
          {step < 6 && <View style={[styles.stepLine, step < 4 && styles.stepLineDone]} />}
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
        <Text style={styles.headerTitle}>Shop Gallery</Text>
        <View style={{ width: 40 }} />
      </View>
      <StepIndicator />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>Upload full width/height photos of your shop</Text>

        {images.length > 0 && (
          <View style={styles.grid}>
            {images.map((img, i) => (
              <View key={i} style={styles.imageBox}>
                <Image source={{ uri: img }} style={styles.image} resizeMode="contain" />
                <Pressable style={styles.removeBtn} onPress={() => removeImage(i)}>
                  <Ionicons name="trash-outline" size={16} color="#ef4444" />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <Pressable style={styles.uploadBox} onPress={pickImage}>
          <Ionicons name="images-outline" size={36} color="#7c3aed" />
          <Text style={styles.uploadText}>Select Shop Photos from Gallery</Text>
          <Text style={styles.uploadSub}>Full resolution • Select multiple photos • No mandatory cropping</Text>
        </Pressable>

        <Pressable style={styles.btn} onPress={onContinue}>
          <Text style={styles.btnText}>Continue</Text>
        </Pressable>
      </ScrollView>
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
  grid: { marginBottom: 20 },
  imageBox: {
    width: "100%",
    height: 210,
    marginBottom: 16,
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  image: { width: "100%", height: "100%" },
  removeBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  uploadBox: {
    borderWidth: 1.5,
    borderColor: "#c4b5fd",
    borderStyle: "dashed",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 24,
    backgroundColor: "#f5f3ff",
  },
  uploadText: { fontSize: 15, fontWeight: "700", color: "#7c3aed", marginTop: 8 },
  uploadSub: { fontSize: 11.5, color: "#64748b", marginTop: 4, textAlign: "center" },
  btn: { backgroundColor: "#7c3aed", padding: 16, borderRadius: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
