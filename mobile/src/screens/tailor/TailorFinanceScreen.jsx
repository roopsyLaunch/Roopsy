import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
  RefreshControl, Modal, TextInput, Alert, Dimensions
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../api/client";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

const EXPENSE_CATEGORIES = [
  "rent", "salary", "fabric", "utilities", "equipment",
  "marketing", "transport", "tax", "maintenance", "other"
];
const PAYMENT_MODES = ["cash", "upi", "card", "bank_transfer", "cheque"];

export function TailorFinanceScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState("overview"); // overview | expenses | cashbook | analytics
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving]       = useState(false);

  // Data
  const [summary, setSummary]     = useState(null);
  const [expenses, setExpenses]   = useState([]);
  const [cashbook, setCashbook]   = useState(null);
  const [analytics, setAnalytics] = useState(null);

  // Modals
  const [expModal, setExpModal]   = useState(false);
  const [expForm, setExpForm]     = useState({ title: "", amount: "", category: "other", paymentMode: "upi", note: "" });

  const [cbModal, setCbModal]     = useState(false);
  const [cbForm, setCbForm]       = useState({ type: "credit", amount: "", description: "", category: "other", paymentMode: "cash" });

  const loadAll = useCallback(async () => {
    try {
      const [sumRes, expRes, cbRes, anRes] = await Promise.all([
        api.get("/tailor-finance/summary"),
        api.get("/tailor-finance/expenses"),
        api.get("/tailor-finance/cashbook"),
        api.get("/tailor-finance/analytics")
      ]);
      setSummary(sumRes.data);
      setExpenses(expRes.data.expenses || []);
      setCashbook(cbRes.data);
      setAnalytics(anRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { loadAll(); }, [loadAll]));

  const onRefresh = () => { setRefreshing(true); loadAll(); };

  const addExpense = async () => {
    if (!expForm.title || !expForm.amount) return Alert.alert("Required", "Title and amount are required.");
    setSaving(true);
    try {
      await api.post("/tailor-finance/expenses", { ...expForm, amount: Number(expForm.amount) });
      setExpModal(false);
      setExpForm({ title: "", amount: "", category: "other", paymentMode: "upi", note: "" });
      loadAll();
    } catch (err) { Alert.alert("Error", "Could not add expense"); }
    finally { setSaving(false); }
  };

  const addCbEntry = async () => {
    if (!cbForm.description || !cbForm.amount) return Alert.alert("Required", "Description and amount are required.");
    setSaving(true);
    try {
      await api.post("/tailor-finance/cashbook", { ...cbForm, amount: Number(cbForm.amount) });
      setCbModal(false);
      setCbForm({ type: "credit", amount: "", description: "", category: "other", paymentMode: "cash" });
      loadAll();
    } catch (err) { Alert.alert("Error", "Could not add entry"); }
    finally { setSaving(false); }
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#059669" /></View>;

  const TABS = [
    { key: "overview",  icon: "pie-chart", label: "Overview" },
    { key: "cashbook",  icon: "wallet",    label: "Cashbook" },
    { key: "expenses",  icon: "receipt",   label: "Expenses" },
    { key: "analytics", icon: "bar-chart", label: "Analytics" },
  ];

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Finance & Growth</Text>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color="#0f172a" />
        </Pressable>
      </View>

      {/* Tabs */}
      <View style={styles.tabsWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {TABS.map(tab => (
            <Pressable
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Ionicons name={tab.icon} size={14} color={activeTab === tab.key ? "#fff" : "#64748b"} />
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#059669" />}
      >

        {/* ───────────────────────────────────────────────────────────────── */}
        {/* OVERVIEW TAB */}
        {activeTab === "overview" && summary && (
          <View>
            <View style={styles.heroCard}>
              <Text style={styles.heroLabel}>Total Revenue</Text>
              <Text style={styles.heroValue}>₹{(summary.revenue.total || 0).toLocaleString()}</Text>
              <View style={styles.heroRow}>
                <View style={styles.heroMini}>
                  <Text style={styles.heroMiniLabel}>This Month</Text>
                  <Text style={styles.heroMiniValue}>₹{(summary.revenue.month || 0).toLocaleString()}</Text>
                </View>
                <View style={styles.heroMiniDivider} />
                <View style={styles.heroMini}>
                  <Text style={styles.heroMiniLabel}>This Week</Text>
                  <Text style={styles.heroMiniValue}>₹{(summary.revenue.week || 0).toLocaleString()}</Text>
                </View>
              </View>
            </View>

            <View style={styles.sectionRow}>
              <View style={[styles.kpiCard, { backgroundColor: "#ecfdf5", borderColor: "#a7f3d0" }]}>
                <Ionicons name="trending-up" size={20} color="#059669" />
                <Text style={styles.kpiValue}>₹{((summary.profit?.month || 0)).toLocaleString()}</Text>
                <Text style={styles.kpiLabel}>Month Profit</Text>
              </View>
              <View style={[styles.kpiCard, { backgroundColor: "#fef2f2", borderColor: "#fecaca" }]}>
                <Ionicons name="receipt-outline" size={20} color="#ef4444" />
                <Text style={styles.kpiValue}>₹{(summary.expenses?.thisMonth || 0).toLocaleString()}</Text>
                <Text style={styles.kpiLabel}>Month Expense</Text>
              </View>
            </View>

            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>Top Services</Text>
              {(summary.topServices || []).map((svc, i) => (
                <View key={i} style={styles.listRow}>
                  <View style={styles.listIcon}><Ionicons name="star" size={14} color="#f59e0b" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listTitle}>{svc.name}</Text>
                    <Text style={styles.listSub}>{svc.count} orders</Text>
                  </View>
                  <Text style={styles.listAmount}>₹{svc.revenue.toLocaleString()}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ───────────────────────────────────────────────────────────────── */}
        {/* CASHBOOK TAB */}
        {activeTab === "cashbook" && cashbook && (
          <View>
            <View style={[styles.heroCard, { backgroundColor: "#0f172a" }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View>
                  <Text style={styles.heroLabel}>Net Balance</Text>
                  <Text style={styles.heroValue}>₹{(cashbook.balance || 0).toLocaleString()}</Text>
                </View>
                <Pressable style={styles.actionBtn} onPress={() => setCbModal(true)}>
                  <Ionicons name="add" size={20} color="#0f172a" />
                  <Text style={styles.actionBtnText}>Entry</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>Recent Transactions</Text>
              {(cashbook.entries || []).map(entry => (
                <View key={entry._id} style={styles.listRow}>
                  <View style={[styles.listIcon, { backgroundColor: entry.type === "credit" ? "#d1fae5" : "#fee2e2" }]}>
                    <Ionicons name={entry.type === "credit" ? "arrow-down" : "arrow-up"} size={16} color={entry.type === "credit" ? "#059669" : "#ef4444"} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listTitle}>{entry.description}</Text>
                    <Text style={styles.listSub}>{new Date(entry.date).toLocaleDateString("en-IN", { dateStyle: "short" })} • {entry.paymentMode}</Text>
                  </View>
                  <Text style={[styles.listAmount, { color: entry.type === "credit" ? "#059669" : "#0f172a" }]}>
                    {entry.type === "credit" ? "+" : "-"}₹{entry.amount.toLocaleString()}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ───────────────────────────────────────────────────────────────── */}
        {/* EXPENSES TAB */}
        {activeTab === "expenses" && (
          <View>
            <View style={[styles.heroCard, { backgroundColor: "#ef4444" }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View>
                  <Text style={styles.heroLabel}>Total Expenses (All Time)</Text>
                  <Text style={styles.heroValue}>₹{(summary?.expenses?.total || 0).toLocaleString()}</Text>
                </View>
                <Pressable style={styles.actionBtn} onPress={() => setExpModal(true)}>
                  <Ionicons name="add" size={20} color="#ef4444" />
                  <Text style={[styles.actionBtnText, { color: "#ef4444" }]}>Record</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>Expense History</Text>
              {expenses.length === 0 ? <Text style={styles.emptyText}>No expenses recorded yet.</Text> : null}
              {expenses.map(exp => (
                <View key={exp._id} style={styles.listRow}>
                  <View style={styles.listIcon}><Ionicons name="receipt" size={14} color="#64748b" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listTitle}>{exp.title}</Text>
                    <Text style={styles.listSub}>{exp.category.toUpperCase()} • {new Date(exp.date).toLocaleDateString("en-IN", { dateStyle: "short" })}</Text>
                  </View>
                  <Text style={styles.listAmount}>₹{exp.amount.toLocaleString()}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ───────────────────────────────────────────────────────────────── */}
        {/* ANALYTICS TAB */}
        {activeTab === "analytics" && analytics && (
          <View>
            <Text style={styles.sectionTitle}>Customer Retention</Text>
            <View style={styles.sectionRow}>
              <View style={[styles.kpiCard, { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" }]}>
                <Ionicons name="people" size={20} color="#2563eb" />
                <Text style={[styles.kpiValue, { color: "#1e3a8a" }]}>{analytics.customers.total}</Text>
                <Text style={[styles.kpiLabel, { color: "#3b82f6" }]}>Total Customers</Text>
              </View>
              <View style={[styles.kpiCard, { backgroundColor: "#fdf4ff", borderColor: "#fbcfe8" }]}>
                <Ionicons name="repeat" size={20} color="#c026d3" />
                <Text style={[styles.kpiValue, { color: "#86198f" }]}>{analytics.customers.repeatRate}%</Text>
                <Text style={[styles.kpiLabel, { color: "#d946ef" }]}>Repeat Rate</Text>
              </View>
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Order Status Distribution</Text>
            <View style={styles.sectionBlock}>
              {Object.entries(analytics.statusDist || {}).map(([status, count]) => (
                <View key={status} style={styles.distRow}>
                  <Text style={styles.distLabel}>{status.toUpperCase()}</Text>
                  <Text style={styles.distCount}>{count} orders</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* EXPENSE MODAL */}
      <Modal visible={expModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Record Expense</Text>
              <Pressable onPress={() => setExpModal(false)}><Ionicons name="close" size={24} color="#0f172a" /></Pressable>
            </View>
            <Text style={styles.fieldLabel}>Title *</Text>
            <TextInput style={styles.input} value={expForm.title} onChangeText={v => setExpForm(f => ({ ...f, title: v }))} placeholder="e.g. Shop Rent July" />
            <Text style={styles.fieldLabel}>Amount (₹) *</Text>
            <TextInput style={styles.input} value={expForm.amount} onChangeText={v => setExpForm(f => ({ ...f, amount: v }))} placeholder="0" keyboardType="numeric" />
            
            <Text style={styles.fieldLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
              {EXPENSE_CATEGORIES.map(c => (
                <Pressable key={c} style={[styles.pill, expForm.category === c && styles.pillActive]} onPress={() => setExpForm(f => ({ ...f, category: c }))}>
                  <Text style={[styles.pillText, expForm.category === c && styles.pillTextActive]}>{c}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.fieldLabel}>Payment Mode</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.pillRow, { marginBottom: 20 }]}>
              {PAYMENT_MODES.map(m => (
                <Pressable key={m} style={[styles.pill, expForm.paymentMode === m && styles.pillActive]} onPress={() => setExpForm(f => ({ ...f, paymentMode: m }))}>
                  <Text style={[styles.pillText, expForm.paymentMode === m && styles.pillTextActive]}>{m.replace("_", " ")}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Pressable style={styles.saveBtn} onPress={addExpense} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Expense</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* CASHBOOK MODAL */}
      <Modal visible={cbModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Cashbook Entry</Text>
              <Pressable onPress={() => setCbModal(false)}><Ionicons name="close" size={24} color="#0f172a" /></Pressable>
            </View>

            <View style={styles.cbTypeRow}>
              <Pressable style={[styles.cbTypeBtn, cbForm.type === "credit" && { backgroundColor: "#059669" }]} onPress={() => setCbForm(f => ({ ...f, type: "credit" }))}>
                <Text style={[styles.cbTypeText, cbForm.type === "credit" && { color: "#fff" }]}>IN (Credit)</Text>
              </Pressable>
              <Pressable style={[styles.cbTypeBtn, cbForm.type === "debit" && { backgroundColor: "#ef4444" }]} onPress={() => setCbForm(f => ({ ...f, type: "debit" }))}>
                <Text style={[styles.cbTypeText, cbForm.type === "debit" && { color: "#fff" }]}>OUT (Debit)</Text>
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>Amount (₹) *</Text>
            <TextInput style={styles.input} value={cbForm.amount} onChangeText={v => setCbForm(f => ({ ...f, amount: v }))} placeholder="0" keyboardType="numeric" />
            <Text style={styles.fieldLabel}>Description *</Text>
            <TextInput style={[styles.input, { marginBottom: 20 }]} value={cbForm.description} onChangeText={v => setCbForm(f => ({ ...f, description: v }))} placeholder="e.g. Received advance for suits" />

            <Pressable style={styles.saveBtn} onPress={addCbEntry} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Entry</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: "#f8fafc" },
  centered:     { flex: 1, justifyContent: "center", alignItems: "center" },

  header:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 10 },
  headerTitle:  { fontSize: 24, fontWeight: "900", color: "#0f172a" },
  backBtn:      { width: 40, height: 40, borderRadius: 20, backgroundColor: "#f1f5f9", justifyContent: "center", alignItems: "center" },

  tabsWrapper:  { paddingBottom: 12 },
  tabs:         { paddingHorizontal: 20, gap: 10 },
  tab:          { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#e2e8f0", gap: 6 },
  tabActive:    { backgroundColor: "#0f172a", borderColor: "#0f172a" },
  tabText:      { fontSize: 13, fontWeight: "700", color: "#64748b" },
  tabTextActive:{ color: "#ffffff" },

  scroll:       { padding: 16, paddingBottom: 40 },

  heroCard:     { backgroundColor: "#059669", borderRadius: 24, padding: 24, marginBottom: 16 },
  heroLabel:    { fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.8)", marginBottom: 4 },
  heroValue:    { fontSize: 36, fontWeight: "900", color: "#ffffff", marginBottom: 20 },
  heroRow:      { flexDirection: "row", alignItems: "center" },
  heroMini:     { flex: 1 },
  heroMiniLabel:{ fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.7)", textTransform: "uppercase" },
  heroMiniValue:{ fontSize: 18, fontWeight: "800", color: "#ffffff", marginTop: 2 },
  heroMiniDivider:{ width: 1, height: 30, backgroundColor: "rgba(255,255,255,0.2)", marginHorizontal: 16 },

  actionBtn:    { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, gap: 4 },
  actionBtnText:{ fontSize: 13, fontWeight: "800", color: "#0f172a" },

  sectionRow:   { flexDirection: "row", gap: 12, marginBottom: 16 },
  kpiCard:      { flex: 1, backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#e2e8f0", alignItems: "flex-start" },
  kpiValue:     { fontSize: 20, fontWeight: "900", color: "#0f172a", marginTop: 8 },
  kpiLabel:     { fontSize: 12, fontWeight: "600", color: "#64748b", marginTop: 2 },

  sectionBlock: { backgroundColor: "#ffffff", borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: "#e2e8f0" },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: "#0f172a", marginBottom: 16 },

  listRow:      { flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 12 },
  listIcon:     { width: 40, height: 40, borderRadius: 12, backgroundColor: "#f8fafc", justifyContent: "center", alignItems: "center" },
  listTitle:    { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  listSub:      { fontSize: 12, color: "#64748b", marginTop: 2 },
  listAmount:   { fontSize: 16, fontWeight: "900", color: "#0f172a" },

  distRow:      { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  distLabel:    { fontSize: 14, fontWeight: "700", color: "#475569" },
  distCount:    { fontSize: 14, fontWeight: "800", color: "#0f172a" },
  emptyText:    { fontSize: 14, color: "#94a3b8", fontStyle: "italic" },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet:   { backgroundColor: "#ffffff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle:   { fontSize: 20, fontWeight: "900", color: "#0f172a" },
  fieldLabel:   { fontSize: 13, fontWeight: "700", color: "#475569", marginBottom: 8 },
  input:        { backgroundColor: "#f8fafc", borderRadius: 12, paddingHorizontal: 14, height: 50, fontSize: 15, color: "#0f172a", borderWidth: 1, borderColor: "#e2e8f0", marginBottom: 16 },
  pillRow:      { gap: 8, marginBottom: 16 },
  pill:         { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0" },
  pillActive:   { backgroundColor: "#0f172a", borderColor: "#0f172a" },
  pillText:     { fontSize: 13, fontWeight: "600", color: "#64748b" },
  pillTextActive:{ color: "#fff" },
  cbTypeRow:    { flexDirection: "row", gap: 12, marginBottom: 20 },
  cbTypeBtn:    { flex: 1, height: 48, borderRadius: 12, backgroundColor: "#f1f5f9", justifyContent: "center", alignItems: "center" },
  cbTypeText:   { fontSize: 14, fontWeight: "800", color: "#475569" },
  saveBtn:      { backgroundColor: "#0f172a", height: 56, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  saveBtnText:  { color: "#fff", fontSize: 16, fontWeight: "800" },
});
