import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Image, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function TailorDesignScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { 
    tailor, 
    services, 
    isHomeService,
    homeServiceAddress,
    visitDate,
    visitFee,
    fabricSource, 
    fabricDetails 
  } = route.params;

  const [fit, setFit] = useState("Regular");
  const [collar, setCollar] = useState("Standard");
  const [sleeves, setSleeves] = useState("Full");
  const [pockets, setPockets] = useState("None");
  const [referenceImage, setReferenceImage] = useState(null);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      setReferenceImage(result.assets[0].uri);
    }
  };

  const handleNext = () => {
    const designPreferences = {
      fit,
      collar,
      sleeves,
      pockets,
      referenceImageUrl: referenceImage // Note: In a real app, this should be uploaded to S3/Cloudinary first
    };

    navigation.navigate("TailorMeasurementSelect", { 
      tailor, 
      services, 
      isHomeService,
      homeServiceAddress,
      visitDate,
      visitFee,
      fabricSource, 
      fabricDetails,
      designPreferences
    });
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color="#0f172a" />
      </Pressable>
      <View>
        <Text style={styles.headerTitle}>Step 2 of 3</Text>
        <Text style={styles.headerSubtitle}>Design Library</Text>
      </View>
      <View style={{ width: 44 }} />
    </View>
  );

  const PillGroup = ({ title, options, selected, onSelect }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.pillContainer}>
        {options.map(opt => {
          const isActive = selected === opt;
          return (
            <Pressable 
              key={opt} 
              style={[styles.pill, isActive && styles.pillActive]}
              onPress={() => onSelect(opt)}
            >
              <Text style={[styles.pillText, isActive && styles.pillTextActive]}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 20) }]}>
      {renderHeader()}
      
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <View style={styles.uploadSection}>
          <Text style={styles.sectionTitle}>Reference Image (Optional)</Text>
          <Text style={styles.sectionDesc}>Have a Pinterest or Instagram reference? Upload it here.</Text>
          <Pressable style={styles.uploadBox} onPress={pickImage}>
            {referenceImage ? (
              <Image source={{ uri: referenceImage }} style={styles.uploadedImg} />
            ) : (
              <View style={styles.uploadPlaceholder}>
                <Ionicons name="cloud-upload-outline" size={32} color="#94a3b8" />
                <Text style={styles.uploadText}>Tap to upload photo</Text>
              </View>
            )}
            {referenceImage && (
              <Pressable style={styles.removeBtn} onPress={(e) => { e.stopPropagation(); setReferenceImage(null); }}>
                <Ionicons name="close" size={16} color="#fff" />
              </Pressable>
            )}
          </Pressable>
        </View>

        <View style={styles.divider} />

        <PillGroup 
          title="Fit Preference" 
          options={["Slim", "Regular", "Loose / Relaxed"]} 
          selected={fit} 
          onSelect={setFit} 
        />
        
        <PillGroup 
          title="Collar Style" 
          options={["Standard", "Mandarin", "Spread", "Button Down", "None"]} 
          selected={collar} 
          onSelect={setCollar} 
        />
        
        <PillGroup 
          title="Sleeves" 
          options={["Full", "Half", "Sleeveless", "3/4th"]} 
          selected={sleeves} 
          onSelect={setSleeves} 
        />
        
        <PillGroup 
          title="Pockets" 
          options={["None", "Left Chest", "Both Chest", "Hidden"]} 
          selected={pockets} 
          onSelect={setPockets} 
        />

      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <Pressable style={styles.nextBtn} onPress={handleNext}>
          <Text style={styles.nextBtnText}>Continue to Measurements</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 16, backgroundColor: "#ffffff", borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#f8fafc", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#e2e8f0" },
  headerTitle: { fontSize: 13, fontWeight: "700", color: "#0d9488", textAlign: "center", textTransform: "uppercase", letterSpacing: 1 },
  headerSubtitle: { fontSize: 18, fontWeight: "900", color: "#0f172a", textAlign: "center" },
  
  scrollContent: { padding: 20, paddingBottom: 120 },
  divider: { height: 1, backgroundColor: "#f1f5f9", marginVertical: 20 },
  
  uploadSection: { marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: "#0f172a", marginBottom: 6 },
  sectionDesc: { fontSize: 13, color: "#64748b", marginBottom: 16 },
  
  uploadBox: { width: "100%", height: 160, borderRadius: 16, backgroundColor: "#f8fafc", borderWidth: 2, borderColor: "#e2e8f0", borderStyle: "dashed", justifyContent: "center", alignItems: "center", overflow: "hidden" },
  uploadPlaceholder: { alignItems: "center" },
  uploadText: { fontSize: 14, fontWeight: "600", color: "#64748b", marginTop: 8 },
  uploadedImg: { width: "100%", height: "100%" },
  removeBtn: { position: "absolute", top: 10, right: 10, backgroundColor: "rgba(0,0,0,0.5)", width: 28, height: 28, borderRadius: 14, justifyContent: "center", alignItems: "center" },

  section: { marginBottom: 24 },
  pillContainer: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  pill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0" },
  pillActive: { backgroundColor: "#0d9488", borderColor: "#0d9488" },
  pillText: { fontSize: 14, fontWeight: "600", color: "#475569" },
  pillTextActive: { color: "#ffffff" },

  bottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#ffffff", paddingHorizontal: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: "#f1f5f9", shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 10 },
  nextBtn: { backgroundColor: "#0d9488", height: 56, borderRadius: 16, flexDirection: "row", justifyContent: "center", alignItems: "center" },
  nextBtnText: { color: "#ffffff", fontSize: 16, fontWeight: "700", marginRight: 8 }
});
