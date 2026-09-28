import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Switch, Modal, TextInput } from "react-native";
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

  const [editingDay, setEditingDay] = useState(null);
  const [tempStart, setTempStart] = useState("09:00 AM");
  const [tempEnd, setTempEnd] = useState("09:00 PM");

  const openTimeEditor = (day) => {
    setEditingDay(day);
    setTempStart(hours[day]?.start || "09:00 AM");
    setTempEnd(hours[day]?.end || "09:00 PM");
  };

  const saveDayTime = (applyToAll = false) => {
    if (!editingDay) return;
    const cleanStart = tempStart.trim() || "09:00 AM";
    const cleanEnd = tempEnd.trim() || "09:00 PM";

    setHours((prev) => {
      const next = { ...prev };
      if (applyToAll) {
        Object.keys(next).forEach((d) => {
          if (next[d].open) {
            next[d] = { ...next[d], start: cleanStart, end: cleanEnd };
          }
        });
      } else {
        next[editingDay] = { ...next[editingDay], start: cleanStart, end: cleanEnd };
      }
      return next;
    });
    setEditingDay(null);
  };

  const applyPreset = (start, end) => {
    setTempStart(start);
    setTempEnd(end);
  };

  const onContinue = () => {
    navigation.navigate("PartnerGallery", {
      registrationData: { ...(route.params?.registrationData || {}), hours }
    });
  };

  const StepIndicator = () => (
    <View style={styles.stepContainer}>
      {[1, 2, 3, 4, 5, 6].map((step) => (
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
        <Text style={styles.subtitle}>Set your weekly schedule. Tap any time to customize open and close timing.</Text>

        {Object.keys(hours).map((day) => (
          <View key={day} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.dayText}>{day}</Text>
              {hours[day].open ? (
                <Pressable onPress={() => openTimeEditor(day)} style={styles.timeBadgePressable}>
                  <Text style={styles.timeText}>{hours[day].start} - {hours[day].end}</Text>
                  <Ionicons name="pencil-sharp" size={13} color="#6d28d9" style={{ marginLeft: 4 }} />
                </Pressable>
              ) : (
                <Text style={styles.closedText}>Closed (Weekly Off)</Text>
              )}
            </View>
            <Switch
              value={hours[day].open}
              onValueChange={(val) => setHours((prev) => ({ ...prev, [day]: { ...prev[day], open: val } }))}
              trackColor={{ false: "#e2e8f0", true: "#6d28d9" }}
              thumbColor={"#fff"}
            />
          </View>
        ))}

        <Pressable style={styles.btn} onPress={onContinue}>
          <Text style={styles.btnText}>Continue</Text>
        </Pressable>
      </ScrollView>

      {/* MODAL: TIME EDIT */}
      <Modal visible={!!editingDay} transparent animationType="slide" onRequestClose={() => setEditingDay(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Set {editingDay} Timing</Text>
              <Pressable onPress={() => setEditingDay(null)} hitSlop={8}>
                <Ionicons name="close-circle" size={26} color="#94a3b8" />
              </Pressable>
            </View>

            {/* Quick Presets */}
            <Text style={styles.presetLabel}>Quick Presets:</Text>
            <View style={styles.presetRow}>
              {[
                { label: "8 AM - 8 PM", s: "08:00 AM", e: "08:00 PM" },
                { label: "9 AM - 9 PM", s: "09:00 AM", e: "09:00 PM" },
                { label: "10 AM - 10 PM", s: "10:00 AM", e: "10:00 PM" },
                { label: "9 AM - 6 PM", s: "09:00 AM", e: "06:00 PM" },
              ].map((p, idx) => (
                <Pressable key={idx} style={styles.presetPill} onPress={() => applyPreset(p.s, p.e)}>
                  <Text style={styles.presetText}>{p.label}</Text>
                </Pressable>
              ))}
            </View>

            {/* Inputs */}
            <View style={styles.inputRow}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={styles.inputLabel}>Open Time (e.g. 09:00 AM)</Text>
                <TextInput
                  style={styles.timeInput}
                  value={tempStart}
                  onChangeText={setTempStart}
                  placeholder="09:00 AM"
                  maxLength={10}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Close Time (e.g. 09:00 PM)</Text>
                <TextInput
                  style={styles.timeInput}
                  value={tempEnd}
                  onChangeText={setTempEnd}
                  placeholder="09:00 PM"
                  maxLength={10}
                />
              </View>
            </View>

            {/* Actions */}
            <Pressable style={styles.applyBtn} onPress={() => saveDayTime(false)}>
              <Text style={styles.applyBtnText}>Apply for {editingDay}</Text>
            </Pressable>
            <Pressable style={styles.applyAllBtn} onPress={() => saveDayTime(true)}>
              <Text style={styles.applyAllBtnText}>Apply to All Open Days</Text>
            </Pressable>
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
  subtitle: { fontSize: 13, color: "#64748b", marginBottom: 20, textAlign: "center", lineHeight: 18 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  dayText: { fontSize: 15, fontWeight: "700", color: "#0f172a", marginBottom: 4 },
  timeBadgePressable: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", backgroundColor: "#f5f3ff", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  timeText: { fontSize: 13, color: "#6d28d9", fontWeight: "600" },
  closedText: { fontSize: 13, color: "#ef4444", fontWeight: "600" },
  btn: { backgroundColor: "#6d28d9", padding: 16, borderRadius: 12, alignItems: "center", marginTop: 32 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },

  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalBox: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: "700", color: "#0f172a" },
  presetLabel: { fontSize: 12, fontWeight: "600", color: "#64748b", marginBottom: 8 },
  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  presetPill: { backgroundColor: "#f1f5f9", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: "#e2e8f0" },
  presetText: { fontSize: 12, color: "#334155", fontWeight: "600" },
  inputRow: { flexDirection: "row", marginBottom: 20 },
  inputLabel: { fontSize: 12, color: "#475569", marginBottom: 6, fontWeight: "600" },
  timeInput: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, padding: 12, fontSize: 15, color: "#0f172a", fontWeight: "600" },
  applyBtn: { backgroundColor: "#6d28d9", paddingVertical: 14, borderRadius: 10, alignItems: "center", marginBottom: 10 },
  applyBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  applyAllBtn: { backgroundColor: "#f5f3ff", paddingVertical: 12, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: "#ddd6fe" },
  applyAllBtnText: { color: "#6d28d9", fontWeight: "700", fontSize: 14 },
});
