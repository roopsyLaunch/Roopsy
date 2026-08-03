import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
  Alert, TextInput, Modal, Image, RefreshControl
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../api/client";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ALL_TAGS = ["VIP", "Bride", "Corporate", "Regular", "Repeat"];
const TAG_COLORS = {
  VIP:       { bg: "#fef9c3", text: "#92400e" },
  Bride:     { bg: "#fce7f3", text: "#be185d" },
  Corporate: { bg: "#dbeafe", text: "#1e40af" },
  Regular:   { bg: "#d1fae5", text: "#065f46" },
  Repeat:    { bg: "#ede9fe", text: "#5b21b6" },
};

const STATUS_COLORS = {
  pending: "#f59e0b", accepted: "#3b82f6", stitching: "#6d28d9",
  trial: "#f97316", ready: "#10b981", completed: "#059669",
  cancelled: "#ef4444", declined: "#ef4444",
};

export function TailorCRMDetailScreen({ route, navigation }) {
  const { customerId, customerName } = route.params;
  const insets = useSafeAreaInsets();

  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState("overview"); // overview | orders | measurements | log
  const [tagModal, setTagModal] = useState(false);
  const [noteModal, setNoteModal] = useState(false);
  const [logModal, setLogModal] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [logType, setLogType]   = useState("call");
  const [logMsg, setLogMsg]     = useState("");
  const [saving, setSaving]     = useState(false);
  const [loyalty, setLoyalty]   = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/tailor-crm/customers/${customerId}`);
      setData(res.data);
      setNoteText(res.data.crm?.privateNote || "");
      setLoyalty(res.data.crm?.loyaltyPoints || 0);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [customerId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const saveNote = async () => {
    setSaving(true);
    try {
      await api.patch(`/tailor-crm/customers/${customerId}`, { privateNote: noteText });
      setNoteModal(false);
      await load();
    } catch (err) { Alert.alert("Error", "Could not save note."); }
    finally { setSaving(false); }
  };

  const toggleTag = async (tag) => {
    const current = data?.crm?.tags || [];
    const updated = current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag];
    await api.patch(`/tailor-crm/customers/${customerId}`, { tags: updated });
    await load();
  };

  const toggleFlag = async () => {
    await api.patch(`/tailor-crm/customers/${customerId}`, { isFlagged: !data?.crm?.isFlagged });
    await load();
  };

  const addLoyalty = async (pts) => {
    const newPts = (data?.crm?.loyaltyPoints || 0) + pts;
    await api.patch(`/tailor-crm/customers/${customerId}`, { loyaltyPoints: newPts });
    await load();
  };

  const addLog = async () => {
    setSaving(true);
    try {
      await api.patch(`/tailor-crm/customers/${customerId}`, {
        logEntry: { type: logType, message: logMsg }
      });
      setLogModal(false);
      setLogMsg("");
      await load();
    } catch (err) { Alert.alert("Error", "Could not add log."); }
    finally { setSaving(false); }
  };

  if (loading || !data) return <View style={styles.centered}><ActivityIndicator size="large" color="#6d28d9" /></View>;

  const { orders = [], measurements = [], crm } = data;
  const customer = orders[0]?.customerId || { name: customerName };
  const totalSpend = orders.reduce((s, o) => s + (o.totalAmount || 0), 0);
  const initials = (customerName || "?").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  const TABS = [
    { key: "overview",     icon: "grid",         label: "Overview"     },
    { key: "orders",       icon: "document-text", label: `Orders (${orders.length})` },
    { key: "measurements", icon: "body",          label: "Vault"        },
    { key: "log",          icon: "chatbubbles",   label: "Log"          },
  ];

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#0f172a" />
        </Pressable>
        <Text style={styles.headerTitle}>{customerName}</Text>
        <Pressable style={styles.flagBtn} onPress={toggleFlag}>
          <Ionicons name="flag" size={20} color={crm?.isFlagged ? "#ef4444" : "#cbd5e1"} />
        </Pressable>
      </View>

      {/* Profile Hero */}
      <View style={styles.heroCard}>
        <View style={styles.heroLeft}>
          <View style={styles.heroAvatar}>
            <Text style={styles.heroInitials}>{initials}</Text>
          </View>
        </View>
        <View style={styles.heroBody}>
          <Text style={styles.heroName}>{customerName}</Text>
          <View style={styles.heroStats}>
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatValue}>{orders.length}</Text>
              <Text style={styles.heroStatLabel}>Orders</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatValue}>₹{totalSpend.toLocaleString()}</Text>
              <Text style={styles.heroStatLabel}>Spent</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatValue}>{crm?.loyaltyPoints || 0}</Text>
              <Text style={styles.heroStatLabel}>Points</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {TABS.map(tab => (
          <Pressable
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Ionicons name={tab.icon} size={14} color={activeTab === tab.key ? "#6d28d9" : "#94a3b8"} />
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <>
            {/* Tags */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionRow}>
                <Text style={styles.sectionTitle}>Tags</Text>
                <Pressable style={styles.editBtn} onPress={() => setTagModal(true)}>
                  <Text style={styles.editBtnText}>Edit</Text>
                </Pressable>
              </View>
              <View style={styles.tagsRow}>
                {(crm?.tags || []).length === 0 ? (
                  <Text style={styles.mutedText}>No tags assigned yet</Text>
                ) : (
                  (crm?.tags || []).map(tag => {
                    const c = TAG_COLORS[tag] || { bg: "#f1f5f9", text: "#475569" };
                    return (
                      <View key={tag} style={[styles.tag, { backgroundColor: c.bg }]}>
                        <Text style={[styles.tagText, { color: c.text }]}>{tag}</Text>
                      </View>
                    );
                  })
                )}
              </View>
            </View>

            {/* Private Note */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionRow}>
                <Text style={styles.sectionTitle}>Private Note</Text>
                <Pressable style={styles.editBtn} onPress={() => setNoteModal(true)}>
                  <Text style={styles.editBtnText}>Edit</Text>
                </Pressable>
              </View>
              <View style={styles.noteBox}>
                <Text style={styles.noteText}>{crm?.privateNote || "No private notes yet. Tap Edit to add."}</Text>
              </View>
            </View>

            {/* Loyalty */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Loyalty Points</Text>
              <View style={styles.loyaltyRow}>
                <View style={styles.loyaltyScore}>
                  <Ionicons name="star" size={24} color="#f59e0b" />
                  <Text style={styles.loyaltyValue}>{crm?.loyaltyPoints || 0} pts</Text>
                </View>
                <View style={styles.loyaltyBtns}>
                  {[10, 25, 50].map(pts => (
                    <Pressable key={pts} style={styles.loyaltyAddBtn} onPress={() => addLoyalty(pts)}>
                      <Text style={styles.loyaltyAddText}>+{pts}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          </>
        )}

        {/* ORDERS TAB */}
        {activeTab === "orders" && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Order History</Text>
            {orders.length === 0 ? (
              <Text style={styles.mutedText}>No orders found.</Text>
            ) : (
              orders.map(order => (
                <Pressable
                  key={order._id}
                  style={styles.orderRow}
                  onPress={() => navigation.navigate("PartnerOrderDetail", { orderId: order._id })}
                >
                  <View style={[styles.orderDot, { backgroundColor: STATUS_COLORS[order.status] || "#94a3b8" }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.orderServices}>{order.services.map(s => s.name).join(", ")}</Text>
                    <Text style={styles.orderDate}>{new Date(order.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}</Text>
                  </View>
                  <Text style={styles.orderAmt}>₹{order.totalAmount}</Text>
                </Pressable>
              ))
            )}
          </View>
        )}

        {/* MEASUREMENTS VAULT TAB */}
        {activeTab === "measurements" && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Measurement Vault</Text>
            {measurements.length === 0 ? (
              <View style={styles.emptyMeasure}>
                <Ionicons name="body-outline" size={36} color="#cbd5e1" />
                <Text style={styles.mutedText}>No saved measurement profiles from this customer.</Text>
              </View>
            ) : (
              measurements.map(profile => (
                <View key={profile._id} style={styles.measureCard}>
                  <View style={styles.measureHeader}>
                    <View>
                      <Text style={styles.measureName}>{profile.profileName}</Text>
                      <Text style={styles.measureMeta}>{profile.gender} • {profile.measurementType === "standard" ? `Size ${profile.standardSize}` : `Custom (${profile.unit})`}</Text>
                    </View>
                    <Text style={styles.measureDate}>
                      {new Date(profile.updatedAt).toLocaleDateString("en-IN", { dateStyle: "short" })}
                    </Text>
                  </View>
                  {profile.measurementType === "custom" && (
                    <View style={styles.measureGrid}>
                      {Object.entries(profile.measurements || {})
                        .filter(([, v]) => v !== undefined && v !== null)
                        .map(([key, val]) => (
                          <View key={key} style={styles.measureItem}>
                            <Text style={styles.measureKey}>{key.charAt(0).toUpperCase() + key.slice(1)}</Text>
                            <Text style={styles.measureVal}>{val} {profile.unit}</Text>
                          </View>
                        ))}
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        )}

        {/* COMMUNICATION LOG TAB */}
        {activeTab === "log" && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Communication Log</Text>
              <Pressable style={styles.editBtn} onPress={() => setLogModal(true)}>
                <Ionicons name="add" size={16} color="#6d28d9" />
                <Text style={styles.editBtnText}>Add</Text>
              </Pressable>
            </View>
            {(crm?.communicationLog || []).length === 0 ? (
              <Text style={styles.mutedText}>No communication logged yet.</Text>
            ) : (
              [...(crm?.communicationLog || [])].reverse().map((entry, i) => (
                <View key={i} style={styles.logEntry}>
                  <View style={[styles.logIcon, { backgroundColor: entry.type === "call" ? "#dbeafe" : entry.type === "whatsapp" ? "#d1fae5" : "#f1f5f9" }]}>
                    <Ionicons
                      name={entry.type === "call" ? "call" : entry.type === "whatsapp" ? "logo-whatsapp" : entry.type === "sms" ? "chatbox" : "document-text"}
                      size={14}
                      color={entry.type === "call" ? "#1e40af" : entry.type === "whatsapp" ? "#065f46" : "#475569"}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.logMessage}>{entry.message || "(no message)"}</Text>
                    <Text style={styles.logMeta}>
                      {entry.type.toUpperCase()} • {new Date(entry.loggedAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

      </ScrollView>

      {/* Tag Modal */}
      <Modal visible={tagModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Edit Tags</Text>
            <View style={styles.tagsRow}>
              {ALL_TAGS.map(tag => {
                const active = (crm?.tags || []).includes(tag);
                const c      = TAG_COLORS[tag];
                return (
                  <Pressable
                    key={tag}
                    style={[styles.tag, { backgroundColor: active ? c.bg : "#f8fafc", borderWidth: 2, borderColor: active ? c.text : "#e2e8f0" }]}
                    onPress={() => toggleTag(tag)}
                  >
                    <Text style={[styles.tagText, { color: active ? c.text : "#94a3b8" }]}>{tag}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable style={styles.doneBtn} onPress={() => setTagModal(false)}>
              <Text style={styles.doneBtnText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Note Modal */}
      <Modal visible={noteModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Private Note</Text>
            <TextInput
              style={styles.noteInput}
              multiline
              numberOfLines={5}
              placeholder="Add private notes about this customer..."
              value={noteText}
              onChangeText={setNoteText}
            />
            <View style={styles.modalBtns}>
              <Pressable style={styles.cancelBtn} onPress={() => setNoteModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={saveNote} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Save</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Log Modal */}
      <Modal visible={logModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Log Interaction</Text>
            <View style={styles.logTypeRow}>
              {["call", "whatsapp", "sms", "visit", "note"].map(t => (
                <Pressable
                  key={t}
                  style={[styles.logTypePill, logType === t && styles.logTypePillActive]}
                  onPress={() => setLogType(t)}
                >
                  <Text style={[styles.logTypePillText, logType === t && styles.logTypePillTextActive]}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={styles.noteInput}
              multiline
              numberOfLines={4}
              placeholder="Brief note about this interaction..."
              value={logMsg}
              onChangeText={setLogMsg}
            />
            <View style={styles.modalBtns}>
              <Pressable style={styles.cancelBtn} onPress={() => setLogModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={addLog} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Add Log</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:           { flex: 1, backgroundColor: "#f8fafc" },
  centered:            { flex: 1, justifyContent: "center", alignItems: "center" },
  header:              { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 14, backgroundColor: "#f8fafc" },
  backBtn:             { width: 40, height: 40, borderRadius: 20, backgroundColor: "#ffffff", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#e2e8f0", marginRight: 12 },
  headerTitle:         { flex: 1, fontSize: 18, fontWeight: "900", color: "#0f172a" },
  flagBtn:             { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },

  heroCard:            { flexDirection: "row", alignItems: "center", backgroundColor: "#0f172a", marginHorizontal: 16, marginBottom: 6, padding: 20, borderRadius: 20 },
  heroLeft:            { marginRight: 16 },
  heroAvatar:          { width: 60, height: 60, borderRadius: 30, backgroundColor: "#6d28d9", justifyContent: "center", alignItems: "center" },
  heroInitials:        { fontSize: 22, fontWeight: "900", color: "#ffffff" },
  heroBody:            { flex: 1 },
  heroName:            { fontSize: 18, fontWeight: "900", color: "#ffffff", marginBottom: 12 },
  heroStats:           { flexDirection: "row", alignItems: "center", gap: 12 },
  heroStatItem:        { alignItems: "center" },
  heroStatValue:       { fontSize: 16, fontWeight: "900", color: "#ffffff" },
  heroStatLabel:       { fontSize: 10, color: "rgba(255,255,255,0.6)", fontWeight: "600", marginTop: 2 },
  heroStatDivider:     { width: 1, height: 28, backgroundColor: "rgba(255,255,255,0.2)" },

  tabs:                { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  tab:                 { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#e2e8f0", gap: 6 },
  tabActive:           { backgroundColor: "#ede9fe", borderColor: "#6d28d9" },
  tabText:             { fontSize: 13, fontWeight: "600", color: "#94a3b8" },
  tabTextActive:       { color: "#6d28d9" },

  scroll:              { padding: 16, paddingBottom: 40 },
  sectionCard:         { backgroundColor: "#ffffff", borderRadius: 18, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: "#e2e8f0" },
  sectionRow:          { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  sectionTitle:        { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  mutedText:           { fontSize: 13, color: "#94a3b8", marginTop: 4 },
  editBtn:             { flexDirection: "row", alignItems: "center", backgroundColor: "#ede9fe", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, gap: 4 },
  editBtnText:         { fontSize: 13, fontWeight: "700", color: "#6d28d9" },

  tagsRow:             { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tag:                 { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  tagText:             { fontSize: 13, fontWeight: "700" },

  noteBox:             { backgroundColor: "#fffbeb", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#fde68a" },
  noteText:            { fontSize: 14, color: "#78350f", lineHeight: 20 },

  loyaltyRow:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  loyaltyScore:        { flexDirection: "row", alignItems: "center", gap: 8 },
  loyaltyValue:        { fontSize: 22, fontWeight: "900", color: "#0f172a" },
  loyaltyBtns:         { flexDirection: "row", gap: 8 },
  loyaltyAddBtn:       { backgroundColor: "#ede9fe", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  loyaltyAddText:      { fontSize: 14, fontWeight: "700", color: "#6d28d9" },

  orderRow:            { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f1f5f9", gap: 12 },
  orderDot:            { width: 10, height: 10, borderRadius: 5 },
  orderServices:       { fontSize: 14, fontWeight: "600", color: "#0f172a" },
  orderDate:           { fontSize: 12, color: "#94a3b8", marginTop: 2 },
  orderAmt:            { fontSize: 15, fontWeight: "800", color: "#0f172a" },

  emptyMeasure:        { alignItems: "center", paddingVertical: 20, gap: 10 },
  measureCard:         { backgroundColor: "#f8fafc", borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "#e2e8f0" },
  measureHeader:       { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  measureName:         { fontSize: 15, fontWeight: "800", color: "#0f172a" },
  measureMeta:         { fontSize: 12, color: "#64748b", marginTop: 3 },
  measureDate:         { fontSize: 11, color: "#94a3b8" },
  measureGrid:         { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  measureItem:         { width: "30%", backgroundColor: "#ffffff", borderRadius: 10, padding: 10, alignItems: "center", borderWidth: 1, borderColor: "#e2e8f0" },
  measureKey:          { fontSize: 11, fontWeight: "700", color: "#64748b", textTransform: "uppercase" },
  measureVal:          { fontSize: 15, fontWeight: "800", color: "#0f172a", marginTop: 4 },

  logEntry:            { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  logIcon:             { width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  logMessage:          { fontSize: 14, fontWeight: "600", color: "#0f172a" },
  logMeta:             { fontSize: 11, color: "#94a3b8", marginTop: 3 },

  modalOverlay:        { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet:          { backgroundColor: "#ffffff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36 },
  modalTitle:          { fontSize: 20, fontWeight: "900", color: "#0f172a", marginBottom: 18 },
  noteInput:           { backgroundColor: "#f8fafc", borderRadius: 12, padding: 14, fontSize: 15, color: "#0f172a", minHeight: 110, textAlignVertical: "top", borderWidth: 1, borderColor: "#e2e8f0", marginBottom: 18 },
  modalBtns:           { flexDirection: "row", gap: 12 },
  cancelBtn:           { flex: 1, height: 52, borderRadius: 14, justifyContent: "center", alignItems: "center", backgroundColor: "#f1f5f9" },
  cancelBtnText:       { fontWeight: "700", color: "#475569", fontSize: 15 },
  saveBtn:             { flex: 2, height: 52, borderRadius: 14, justifyContent: "center", alignItems: "center", backgroundColor: "#6d28d9" },
  saveBtnText:         { color: "#ffffff", fontWeight: "700", fontSize: 15 },
  doneBtn:             { height: 52, borderRadius: 14, justifyContent: "center", alignItems: "center", backgroundColor: "#0f172a", marginTop: 16 },
  doneBtnText:         { color: "#ffffff", fontWeight: "700", fontSize: 15 },
  logTypeRow:          { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  logTypePill:         { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0" },
  logTypePillActive:   { backgroundColor: "#0f172a", borderColor: "#0f172a" },
  logTypePillText:     { fontSize: 13, fontWeight: "600", color: "#64748b" },
  logTypePillTextActive: { color: "#ffffff" },
});
