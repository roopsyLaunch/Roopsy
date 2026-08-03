import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator,
  Alert, TextInput, Modal, ScrollView, RefreshControl
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../api/client";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ROLES = [
  { key: "master_tailor",  label: "Master Tailor",  icon: "cut",          color: "#6d28d9" },
  { key: "junior_tailor",  label: "Junior Tailor",  icon: "construct",    color: "#8b5cf6" },
  { key: "cutter",         label: "Cutter",         icon: "crop",         color: "#0ea5e9" },
  { key: "designer",       label: "Designer",       icon: "brush",        color: "#ec4899" },
  { key: "embroidery",     label: "Embroidery",     icon: "flower",       color: "#be185d" },
  { key: "iron_staff",     label: "Iron Staff",     icon: "flame",        color: "#f97316" },
  { key: "packing",        label: "Packing",        icon: "cube",         color: "#059669" },
  { key: "delivery",       label: "Delivery",       icon: "bicycle",      color: "#0d9488" },
  { key: "manager",        label: "Manager",        icon: "shield",       color: "#1e40af" },
  { key: "receptionist",   label: "Receptionist",   icon: "headset",      color: "#d97706" },
  { key: "accountant",     label: "Accountant",     icon: "calculator",   color: "#475569" },
];

const SALARY_TYPES = ["monthly", "daily", "per_piece", "commission"];
const ATTENDANCE_OPTS = [
  { key: "present",  label: "Present",  color: "#059669" },
  { key: "absent",   label: "Absent",   color: "#ef4444" },
  { key: "half_day", label: "Half Day", color: "#f59e0b" },
  { key: "leave",    label: "Leave",    color: "#0ea5e9" },
];

const emptyMember = { name: "", phone: "", email: "", role: "junior_tailor", salaryType: "monthly", baseSalary: "", commissionPercent: "" };

export function TailorStaffScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [staff, setStaff]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [addModal, setAddModal]   = useState(false);
  const [form, setForm]           = useState(emptyMember);
  const [saving, setSaving]       = useState(false);

  // Attendance quick mark
  const [attModal, setAttModal]   = useState(false);
  const [attMember, setAttMember] = useState(null);
  const [attStatus, setAttStatus] = useState("present");
  const [attNote, setAttNote]     = useState("");
  const [checkIn, setCheckIn]     = useState("");
  const [checkOut, setCheckOut]   = useState("");

  // Assign task
  const [taskModal, setTaskModal] = useState(false);
  const [taskMember, setTaskMember] = useState(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskNote, setTaskNote]   = useState("");

  const load = useCallback(async () => {
    try {
      const res = await api.get("/tailor-staff");
      setStaff(res.data.staff || []);
    } catch (err) { console.error(err); }
  }, []);

  useFocusEffect(useCallback(() => {
    load().finally(() => setLoading(false));
  }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const addStaff = async () => {
    if (!form.name.trim() || !form.role) return Alert.alert("Required", "Name and role are required.");
    setSaving(true);
    try {
      await api.post("/tailor-staff", {
        ...form,
        baseSalary: Number(form.baseSalary) || 0,
        commissionPercent: Number(form.commissionPercent) || 0,
      });
      setAddModal(false);
      setForm(emptyMember);
      await load();
    } catch (err) { Alert.alert("Error", "Could not add staff member."); }
    finally { setSaving(false); }
  };

  const markToday = async () => {
    setSaving(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      await api.post(`/tailor-staff/${attMember._id}/attendance`, {
        date: today, status: attStatus, checkInTime: checkIn, checkOutTime: checkOut, note: attNote,
      });
      setAttModal(false);
      await load();
    } catch (err) { Alert.alert("Error", "Could not mark attendance."); }
    finally { setSaving(false); }
  };

  const assignTask = async () => {
    if (!taskTitle.trim()) return Alert.alert("Required", "Enter a task title.");
    setSaving(true);
    try {
      await api.post(`/tailor-staff/${taskMember._id}/tasks`, { title: taskTitle, note: taskNote });
      setTaskModal(false); setTaskTitle(""); setTaskNote("");
      await load();
    } catch (err) { Alert.alert("Error", "Could not assign task."); }
    finally { setSaving(false); }
  };

  const deactivate = (id) => {
    Alert.alert("Deactivate", "Mark this staff member as inactive?", [
      { text: "Cancel", style: "cancel" },
      { text: "Deactivate", style: "destructive", onPress: async () => { await api.delete(`/tailor-staff/${id}`); await load(); } }
    ]);
  };

  const todayStr = new Date().toDateString();
  const getTodayAtt = (member) => {
    return (member.attendance || []).find(a => new Date(a.date).toDateString() === todayStr);
  };

  const renderMember = ({ item }) => {
    const roleMeta  = ROLES.find(r => r.key === item.role) || ROLES[0];
    const todayAtt  = getTodayAtt(item);
    const pendingTasks = (item.tasks || []).filter(t => t.status !== "done").length;
    const initials  = item.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

    return (
      <Pressable
        style={styles.card}
        onPress={() => navigation.navigate("TailorStaffDetail", { staffId: item._id, staffName: item.name })}
      >
        <View style={styles.cardTop}>
          <View style={[styles.avatar, { backgroundColor: roleMeta.color + "20" }]}>
            <Text style={[styles.avatarText, { color: roleMeta.color }]}>{initials}</Text>
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.memberName}>{item.name}</Text>
            <View style={[styles.roleBadge, { backgroundColor: roleMeta.color + "15" }]}>
              <Ionicons name={roleMeta.icon} size={12} color={roleMeta.color} />
              <Text style={[styles.roleText, { color: roleMeta.color }]}>{roleMeta.label}</Text>
            </View>
          </View>
          <View style={styles.cardActions}>
            <Pressable style={styles.attBtn} onPress={() => { setAttMember(item); setAttStatus("present"); setAttNote(""); setCheckIn(""); setCheckOut(""); setAttModal(true); }}>
              <Ionicons name="calendar" size={16} color="#0ea5e9" />
            </Pressable>
            <Pressable style={styles.taskBtn} onPress={() => { setTaskMember(item); setTaskTitle(""); setTaskNote(""); setTaskModal(true); }}>
              <Ionicons name="add-circle" size={16} color="#059669" />
            </Pressable>
          </View>
        </View>

        <View style={styles.statRow}>
          {/* Today attendance */}
          <View style={styles.statChip}>
            <View style={[styles.attDot, { backgroundColor: todayAtt ? (ATTENDANCE_OPTS.find(a => a.key === todayAtt.status)?.color || "#94a3b8") : "#e2e8f0" }]} />
            <Text style={styles.statText}>{todayAtt ? todayAtt.status.replace("_", " ") : "Not marked"}</Text>
          </View>
          {/* Salary */}
          <View style={styles.statChip}>
            <Ionicons name="cash-outline" size={12} color="#64748b" />
            <Text style={styles.statText}>₹{item.baseSalary?.toLocaleString() || 0}/{item.salaryType === "monthly" ? "mo" : item.salaryType === "daily" ? "day" : "pc"}</Text>
          </View>
          {/* Tasks */}
          {pendingTasks > 0 && (
            <View style={[styles.statChip, { backgroundColor: "#fef3c7" }]}>
              <Ionicons name="checkbox-outline" size={12} color="#b45309" />
              <Text style={[styles.statText, { color: "#b45309" }]}>{pendingTasks} task{pendingTasks > 1 ? "s" : ""}</Text>
            </View>
          )}
        </View>
      </Pressable>
    );
  };

  const activeStaff   = staff.filter(s => s.isActive !== false);
  const inactiveStaff = staff.filter(s => s.isActive === false);

  // Attendance summary for today
  const presentToday  = staff.filter(s => getTodayAtt(s)?.status === "present").length;
  const absentToday   = staff.filter(s => getTodayAtt(s)?.status === "absent").length;
  const notMarked     = activeStaff.length - staff.filter(s => getTodayAtt(s)).length;

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLabel}>Staff ERP</Text>
          <Text style={styles.headerCount}>{activeStaff.length} Active Members</Text>
        </View>
        <Pressable style={styles.addBtn} onPress={() => setAddModal(true)}>
          <Ionicons name="person-add" size={20} color="#6d28d9" />
        </Pressable>
      </View>

      {/* Today Attendance Summary */}
      <View style={styles.attSummary}>
        <View style={[styles.attSummaryCard, { backgroundColor: "#d1fae5" }]}>
          <Text style={[styles.attSummaryValue, { color: "#059669" }]}>{presentToday}</Text>
          <Text style={styles.attSummaryLabel}>Present</Text>
        </View>
        <View style={[styles.attSummaryCard, { backgroundColor: "#fef2f2" }]}>
          <Text style={[styles.attSummaryValue, { color: "#ef4444" }]}>{absentToday}</Text>
          <Text style={styles.attSummaryLabel}>Absent</Text>
        </View>
        <View style={[styles.attSummaryCard, { backgroundColor: "#f1f5f9" }]}>
          <Text style={[styles.attSummaryValue, { color: "#64748b" }]}>{notMarked}</Text>
          <Text style={styles.attSummaryLabel}>Not Marked</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color="#6d28d9" /></View>
      ) : (
        <FlatList
          data={activeStaff}
          keyExtractor={i => i._id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6d28d9" />}
          renderItem={renderMember}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="people-outline" size={44} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No staff members yet</Text>
              <Text style={styles.emptyDesc}>Tap + to add your first staff member.</Text>
            </View>
          }
        />
      )}

      {/* Add Staff Modal */}
      <Modal visible={addModal} animationType="slide">
        <ScrollView style={styles.formModal} contentContainerStyle={styles.formContent}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>Add Staff Member</Text>
            <Pressable onPress={() => setAddModal(false)}><Ionicons name="close" size={24} color="#0f172a" /></Pressable>
          </View>

          {[
            { label: "Full Name *", key: "name", placeholder: "e.g. Ramesh Kumar" },
            { label: "Phone", key: "phone", placeholder: "+91 98765 43210" },
            { label: "Email (optional)", key: "email", placeholder: "staff@example.com" },
          ].map(f => (
            <View key={f.key}>
              <Text style={styles.fieldLabel}>{f.label}</Text>
              <TextInput style={styles.input} value={form[f.key]} onChangeText={v => setForm(p => ({ ...p, [f.key]: v }))} placeholder={f.placeholder} />
            </View>
          ))}

          <Text style={styles.fieldLabel}>Role *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 20 }}>
            {ROLES.map(r => (
              <Pressable key={r.key} style={[styles.catPill, form.role === r.key && { backgroundColor: r.color, borderColor: r.color }]} onPress={() => setForm(f => ({ ...f, role: r.key }))}>
                <Ionicons name={r.icon} size={13} color={form.role === r.key ? "#fff" : r.color} />
                <Text style={[styles.catPillText, form.role === r.key && { color: "#fff" }]}>{r.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.fieldLabel}>Salary Type</Text>
          <View style={styles.pillRow}>
            {SALARY_TYPES.map(t => (
              <Pressable key={t} style={[styles.unitPill, form.salaryType === t && styles.unitPillActive]} onPress={() => setForm(f => ({ ...f, salaryType: t }))}>
                <Text style={[styles.unitPillText, form.salaryType === t && { color: "#fff" }]}>{t}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.inputRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Base Salary (₹)</Text>
              <TextInput style={styles.input} value={form.baseSalary} onChangeText={v => setForm(f => ({ ...f, baseSalary: v }))} placeholder="0" keyboardType="numeric" />
            </View>
            {form.salaryType === "commission" && (
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.fieldLabel}>Commission %</Text>
                <TextInput style={styles.input} value={form.commissionPercent} onChangeText={v => setForm(f => ({ ...f, commissionPercent: v }))} placeholder="0" keyboardType="numeric" />
              </View>
            )}
          </View>

          <Pressable style={styles.saveBtn} onPress={addStaff} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Add Staff Member</Text>}
          </Pressable>
        </ScrollView>
      </Modal>

      {/* Attendance Modal */}
      <Modal visible={attModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Mark Attendance — {attMember?.name}</Text>
            <Text style={styles.fieldLabel}>Status</Text>
            <View style={styles.pillRow}>
              {ATTENDANCE_OPTS.map(opt => (
                <Pressable key={opt.key} style={[styles.unitPill, attStatus === opt.key && { backgroundColor: opt.color, borderColor: opt.color }]} onPress={() => setAttStatus(opt.key)}>
                  <Text style={[styles.unitPillText, attStatus === opt.key && { color: "#fff" }]}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
            {attStatus === "present" && (
              <View style={styles.inputRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Check-In</Text>
                  <TextInput style={styles.input} value={checkIn} onChangeText={setCheckIn} placeholder="09:00" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.fieldLabel}>Check-Out</Text>
                  <TextInput style={styles.input} value={checkOut} onChangeText={setCheckOut} placeholder="18:00" />
                </View>
              </View>
            )}
            <Text style={styles.fieldLabel}>Note (optional)</Text>
            <TextInput style={[styles.input, { marginBottom: 20 }]} value={attNote} onChangeText={setAttNote} placeholder="e.g. Left early for personal work" />
            <View style={styles.modalBtns}>
              <Pressable style={styles.cancelBtn} onPress={() => setAttModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.confirmBtn} onPress={markToday} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.confirmBtnText}>Save Attendance</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Task Modal */}
      <Modal visible={taskModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Assign Task — {taskMember?.name}</Text>
            <Text style={styles.fieldLabel}>Task Title *</Text>
            <TextInput style={styles.input} value={taskTitle} onChangeText={setTaskTitle} placeholder="e.g. Cut fabric for Order #3A9B2C" />
            <Text style={styles.fieldLabel}>Note (optional)</Text>
            <TextInput style={[styles.input, { marginBottom: 20 }]} value={taskNote} onChangeText={setTaskNote} placeholder="Additional details..." />
            <View style={styles.modalBtns}>
              <Pressable style={styles.cancelBtn} onPress={() => setTaskModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.confirmBtn} onPress={assignTask} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.confirmBtnText}>Assign Task</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: "#f8fafc" },
  centered:      { flex: 1, justifyContent: "center", alignItems: "center" },

  header:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 14 },
  headerLabel:   { fontSize: 12, fontWeight: "700", color: "#6d28d9", textTransform: "uppercase", letterSpacing: 1 },
  headerCount:   { fontSize: 24, fontWeight: "900", color: "#0f172a" },
  addBtn:        { width: 44, height: 44, borderRadius: 22, backgroundColor: "#ede9fe", justifyContent: "center", alignItems: "center" },

  attSummary:    { flexDirection: "row", paddingHorizontal: 16, gap: 12, marginBottom: 16 },
  attSummaryCard:{ flex: 1, padding: 14, borderRadius: 14, alignItems: "center" },
  attSummaryValue: { fontSize: 22, fontWeight: "900" },
  attSummaryLabel: { fontSize: 11, fontWeight: "600", color: "#64748b", marginTop: 3 },

  list:          { paddingHorizontal: 16, paddingBottom: 40 },
  card:          { backgroundColor: "#ffffff", borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#e2e8f0" },
  cardTop:       { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  avatar:        { width: 48, height: 48, borderRadius: 24, justifyContent: "center", alignItems: "center", marginRight: 12 },
  avatarText:    { fontSize: 17, fontWeight: "900" },
  cardBody:      { flex: 1 },
  memberName:    { fontSize: 16, fontWeight: "800", color: "#0f172a", marginBottom: 5 },
  roleBadge:     { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, gap: 5 },
  roleText:      { fontSize: 12, fontWeight: "700" },
  cardActions:   { flexDirection: "row", gap: 6 },
  attBtn:        { width: 34, height: 34, borderRadius: 10, backgroundColor: "#e0f2fe", justifyContent: "center", alignItems: "center" },
  taskBtn:       { width: 34, height: 34, borderRadius: 10, backgroundColor: "#d1fae5", justifyContent: "center", alignItems: "center" },

  statRow:       { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  statChip:      { flexDirection: "row", alignItems: "center", backgroundColor: "#f8fafc", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, gap: 5 },
  attDot:        { width: 8, height: 8, borderRadius: 4 },
  statText:      { fontSize: 12, fontWeight: "600", color: "#475569" },

  emptyBox:      { paddingVertical: 60, alignItems: "center" },
  emptyTitle:    { fontSize: 17, fontWeight: "700", color: "#64748b", marginTop: 12 },
  emptyDesc:     { fontSize: 13, color: "#94a3b8", marginTop: 6 },

  formModal:     { flex: 1, backgroundColor: "#f8fafc" },
  formContent:   { padding: 20, paddingBottom: 40 },
  formHeader:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  formTitle:     { fontSize: 22, fontWeight: "900", color: "#0f172a" },
  fieldLabel:    { fontSize: 13, fontWeight: "700", color: "#475569", marginBottom: 8 },
  input:         { backgroundColor: "#ffffff", borderRadius: 12, paddingHorizontal: 14, height: 50, fontSize: 15, color: "#0f172a", borderWidth: 1, borderColor: "#e2e8f0", marginBottom: 16 },
  inputRow:      { flexDirection: "row" },
  pillRow:       { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  catPill:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 100, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", gap: 5 },
  catPillText:   { fontSize: 12, fontWeight: "700", color: "#64748b" },
  unitPill:      { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0" },
  unitPillActive:{ backgroundColor: "#0f172a", borderColor: "#0f172a" },
  unitPillText:  { fontSize: 13, fontWeight: "600", color: "#64748b" },
  saveBtn:       { backgroundColor: "#6d28d9", height: 56, borderRadius: 16, justifyContent: "center", alignItems: "center", marginTop: 16 },
  saveBtnText:   { color: "#fff", fontSize: 16, fontWeight: "700" },

  modalOverlay:  { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet:    { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36 },
  modalTitle:    { fontSize: 18, fontWeight: "900", color: "#0f172a", marginBottom: 16 },
  modalBtns:     { flexDirection: "row", gap: 12 },
  cancelBtn:     { flex: 1, height: 52, borderRadius: 14, justifyContent: "center", alignItems: "center", backgroundColor: "#f1f5f9" },
  cancelBtnText: { fontWeight: "700", color: "#475569", fontSize: 15 },
  confirmBtn:    { flex: 2, height: 52, borderRadius: 14, justifyContent: "center", alignItems: "center", backgroundColor: "#0f172a" },
  confirmBtnText:{ color: "#fff", fontWeight: "700", fontSize: 15 },
});
