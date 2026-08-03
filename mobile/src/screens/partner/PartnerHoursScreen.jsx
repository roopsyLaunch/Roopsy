import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

export function PartnerHoursScreen({ navigation, route }) {
  const [hours, setHours] = useState({
    Monday: { open: true, start: "09:00 AM", end: "09:00 PM" },
    Tuesday: { open: true, start: "09:00 AM", end: "09:00 PM" },
    Wednesday: { open: true, start: "09:00 AM", end: "09:00 PM" },
    Thursday: { open: true, start: "09:00 AM", end: "09:00 PM" },
    Friday: { open: true, start: "09:00 AM", end: "09:00 PM" },
    Saturday: { open: true, start: "09:00 AM", end: "09:00 PM" },
    Sunday: { open: true, start: "10:00 AM", end: "06:00 PM" },
  });

  const onContinue = () => {
    navigation.navigate("PartnerGallery", {
      registrationData: { ...(route.params?.registrationData || {}), hours }
    });
  };

  const StepIndicator = () => (
    <View style={styles.stepContainer}>
      {[1,2,3,4,5,6].map(step => (
        <React.Fragment key={step}>
          <View style={[styles.stepCircle, step === 3 && styles.stepActive, step < 3 && styles.stepDone]}>
            <Text style={[styles.stepText, step === 3 && styles.stepTextActive, step < 3 && styles.stepTextActive]}>{step}</Text>
          </View>
          {step < 6 && <View style={[styles.stepLine, step < 3 && styles.stepLineDone]} />}
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
        <Text style={styles.headerTitle}>Business Hours</Text>
        <View style={{ width: 40 }} />
      </View>
      <StepIndicator />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.subtitle}>Set your working days and hours</Text>

        {Object.keys(hours).map(day => (
          <View key={day} style={styles.row}>
            <Text style={styles.dayText}>{day}</Text>
            {hours[day].open ? (
              <Text style={styles.timeText}>{hours[day].start} - {hours[day].end}</Text>
            ) : (
              <Text style={styles.closedText}>Closed</Text>
            )}
            <Switch 
              value={hours[day].open} 
              onValueChange={(val) => setHours(prev => ({ ...prev, [day]: { ...prev[day], open: val } }))}
              trackColor={{ false: "#e2e8f0", true: "#6d28d9" }}
              thumbColor={"#fff"}
            />
          </View>
        ))}

        <Pressable style={styles.btn} onPress={onContinue}>
          <Text style={styles.btnText}>Continue</Text>
        </Pressable>
      </ScrollView>
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
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  dayText: { flex: 1, fontSize: 15, fontWeight: "600", color: "#0f172a" },
  timeText: { fontSize: 14, color: "#475569", marginRight: 16 },
  closedText: { fontSize: 14, color: "#ef4444", marginRight: 16 },
  btn: { backgroundColor: "#6d28d9", padding: 16, borderRadius: 12, alignItems: "center", marginTop: 40 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
