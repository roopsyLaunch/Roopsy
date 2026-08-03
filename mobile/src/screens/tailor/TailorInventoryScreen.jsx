import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator,
  Alert, TextInput, Modal, ScrollView, RefreshControl, Switch
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../api/client";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const CATEGORIES = [
  { key: "all",        label: "All",       icon: "grid",              color: "#64748b" },
  { key: "fabric",     label: "Fabric",    icon: "color-palette",     color: "#6d28d9" },
  { key: "thread",     label: "Thread",    icon: "infinite",          color: "#0ea5e9" },
  { key: "button",     label: "Buttons",   icon: "ellipse",           color: "#f59e0b" },
  { key: "zip",        label: "Zip",       icon: "git-commit",        color: "#ec4899" },
  { key: "elastic",    label: "Elastic",   icon: "resize",            color: "#10b981" },
  { key: "lining",     label: "Lining",    icon: "layers",            color: "#8b5cf6" },
  { key: "packaging",  label: "Packaging", icon: "cube",              color: "#be185d" },
  { key: "accessory",  label: "Accessory", icon: "sparkles",          color: "#d97706" },
  { key: "other",      label: "Other",     icon: "apps",              color: "#475569" },
];

const UNITS = ["meters", "yards", "pcs", "rolls", "kg", "grams", "box", "set"];

const emptyForm = {
  name: "", category: "fabric", sku: "", color: "", supplier: "",
  unit: "meters", currentStock: "", lowStockThreshold: "5",
  costPerUnit: "", sellingPricePerUnit: "", description: "",
};

export function TailorInventoryScreen() {
  const insets = useSafeAreaInsets();
  const [items, setItems]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");
  const [lowStockOnly, setLowStockOnly]     = useState(false);
  const [search, setSearch]         = useState("");

  // Add/Edit modal
  const [formModal, setFormModal]   = useState(false);
  const [form, setForm]             = useState(emptyForm);
  const [editId, setEditId]         = useState(null);
  const [saving, setSaving]         = useState(false);

  // Transaction modal
  const [txModal, setTxModal]       = useState(false);
  const [txItem, setTxItem]         = useState(null);
  const [txType, setTxType]         = useState("in");
  const [txQty, setTxQty]           = useState("");
  const [txNote, setTxNote]         = useState("");

  const load = useCallback(async () => {
    try {
      const res = await api.get("/tailor-inventory");
      setItems(res.data.items || []);
    } catch (err) { console.error(err); }
  }, []);

  useFocusEffect(useCallback(() => {
    load().finally(() => setLoading(false));
  }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const filtered = items.filter(item => {
    const matchCat    = activeCategory === "all" || item.category === activeCategory;
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase()) ||
                        (item.sku || "").toLowerCase().includes(search.toLowerCase());
    const matchLow    = !lowStockOnly || item.currentStock <= item.lowStockThreshold;
    return matchCat && matchSearch && matchLow;
  });

  const lowStockCount = items.filter(i => i.currentStock <= i.lowStockThreshold).length;

  const openAdd = () => { setForm(emptyForm); setEditId(null); setFormModal(true); };
  const openEdit = (item) => {
    setForm({
      name: item.name, category: item.category, sku: item.sku || "",
      color: item.color || "", supplier: item.supplier || "",
      unit: item.unit, currentStock: String(item.currentStock),
      lowStockThreshold: String(item.lowStockThreshold),
      costPerUnit: String(item.costPerUnit || ""),
      sellingPricePerUnit: String(item.sellingPricePerUnit || ""),
      description: item.description || "",
    });
    setEditId(item._id);
    setFormModal(true);
  };

  const saveItem = async () => {
    if (!form.name.trim() || !form.category) return Alert.alert("Required", "Name and category are required.");
    setSaving(true);
    try {
      const payload = {
        ...form,
        currentStock:       Number(form.currentStock)       || 0,
        lowStockThreshold:  Number(form.lowStockThreshold)  || 5,
        costPerUnit:        Number(form.costPerUnit)         || 0,
        sellingPricePerUnit:Number(form.sellingPricePerUnit) || 0,
      };
      if (editId) await api.patch(`/tailor-inventory/${editId}`, payload);
      else        await api.post("/tailor-inventory", payload);
      setFormModal(false);
      await load();
    } catch (err) { Alert.alert("Error", "Could not save item."); }
    finally { setSaving(false); }
  };

  const deleteItem = (id) => {
    Alert.alert("Delete", "Remove this inventory item?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        await api.delete(`/tailor-inventory/${id}`);
        await load();
      }}
    ]);
  };

  const openTx = (item) => { setTxItem(item); setTxQty(""); setTxNote(""); setTxType("in"); setTxModal(true); };

  const saveTx = async () => {
    if (!txQty || Number(txQty) <= 0) return Alert.alert("Required", "Enter a valid quantity.");
    setSaving(true);
    try {
      await api.post(`/tailor-inventory/${txItem._id}/transaction`, {
        type: txType, qty: Number(txQty), note: txNote,
      });
      setTxModal(false);
      await load();
    } catch (err) { Alert.alert("Error", "Could not save transaction."); }
    finally { setSaving(false); }
  };

  const renderItem = ({ item }) => {
    const isLow  = item.currentStock <= item.lowStockThreshold;
    const catMeta = CATEGORIES.find(c => c.key === item.category) || CATEGORIES[0];
    return (
      <View style={[styles.card, isLow && styles.cardLow]}>
        {isLow && (
          <View style={styles.lowBadge}>
            <Ionicons name="warning" size={12} color="#fff" />
            <Text style={styles.lowBadgeText}>LOW STOCK</Text>
          </View>
        )}
        <View style={styles.cardTop}>
          <View style={[styles.catIcon, { backgroundColor: catMeta.color + "20" }]}>
            <Ionicons name={catMeta.icon} size={22} color={catMeta.color} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemMeta}>{catMeta.label}{item.color ? ` • ${item.color}` : ""}{item.sku ? ` • SKU: ${item.sku}` : ""}</Text>
            {item.supplier ? <Text style={styles.itemSupplier}>📦 {item.supplier}</Text> : null}
          </View>
          <View style={styles.cardMenuBtns}>
            <Pressable onPress={() => openEdit(item)} style={styles.iconBtn}>
              <Ionicons name="create-outline" size={18} color="#6d28d9" />
            </Pressable>
            <Pressable onPress={() => deleteItem(item._id)} style={styles.iconBtn}>
              <Ionicons name="trash-outline" size={18} color="#ef4444" />
            </Pressable>
          </View>
        </View>

        <View style={styles.stockRow}>
          <View style={styles.stockBlock}>
            <Text style={[styles.stockValue, isLow && { color: "#ef4444" }]}>{item.currentStock}</Text>
            <Text style={styles.stockLabel}>{item.unit} in stock</Text>
          </View>
          <View style={styles.stockBlock}>
            <Text style={styles.stockValue}>₹{item.costPerUnit || 0}</Text>
            <Text style={styles.stockLabel}>cost/{item.unit}</Text>
          </View>
          <View style={styles.stockBlock}>
            <Text style={styles.stockValue}>{item.lowStockThreshold}</Text>
            <Text style={styles.stockLabel}>alert at</Text>
          </View>
          <Pressable style={styles.txBtn} onPress={() => openTx(item)}>
            <Ionicons name="swap-vertical" size={14} color="#6d28d9" />
            <Text style={styles.txBtnText}>Stock</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLabel}>Inventory ERP</Text>
          <Text style={styles.headerCount}>{items.length} Items</Text>
        </View>
        <View style={styles.headerRight}>
          {lowStockCount > 0 && (
            <View style={styles.alertBadge}>
              <Ionicons name="warning" size={14} color="#ef4444" />
              <Text style={styles.alertBadgeText}>{lowStockCount} low</Text>
            </View>
          )}
          <Pressable style={styles.addBtn} onPress={openAdd}>
            <Ionicons name="add" size={22} color="#6d28d9" />
          </Pressable>
        </View>
      </View>

      {/* Search + Low Stock toggle */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color="#94a3b8" />
          <TextInput style={styles.searchInput} placeholder="Search name or SKU..." value={search} onChangeText={setSearch} />
        </View>
        <View style={styles.lowToggle}>
          <Text style={styles.lowToggleText}>Low Only</Text>
          <Switch
            value={lowStockOnly}
            onValueChange={setLowStockOnly}
            trackColor={{ false: "#e2e8f0", true: "#fca5a5" }}
            thumbColor={lowStockOnly ? "#ef4444" : "#94a3b8"}
          />
        </View>
      </View>

      {/* Category Pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catPills}>
        {CATEGORIES.map(c => (
          <Pressable
            key={c.key}
            style={[styles.catPill, activeCategory === c.key && { backgroundColor: c.color, borderColor: c.color }]}
            onPress={() => setActiveCategory(c.key)}
          >
            <Ionicons name={c.icon} size={14} color={activeCategory === c.key ? "#fff" : c.color} />
            <Text style={[styles.catPillText, activeCategory === c.key && { color: "#fff" }]}>{c.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color="#6d28d9" /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i._id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6d28d9" />}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="cube-outline" size={44} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No inventory items</Text>
              <Text style={styles.emptyDesc}>Tap + to add fabric, threads, and more.</Text>
            </View>
          }
        />
      )}

      {/* Add/Edit Modal */}
      <Modal visible={formModal} animationType="slide">
        <ScrollView style={styles.formModal} contentContainerStyle={styles.formContent}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>{editId ? "Edit Item" : "Add Inventory Item"}</Text>
            <Pressable onPress={() => setFormModal(false)}>
              <Ionicons name="close" size={24} color="#0f172a" />
            </Pressable>
          </View>

          <Text style={styles.fieldLabel}>Name *</Text>
          <TextInput style={styles.input} value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))} placeholder="e.g. Italian Cotton - Blue" />

          <Text style={styles.fieldLabel}>Category *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 20 }}>
            {CATEGORIES.filter(c => c.key !== "all").map(c => (
              <Pressable key={c.key} style={[styles.catPill, form.category === c.key && { backgroundColor: c.color, borderColor: c.color }]} onPress={() => setForm(f => ({ ...f, category: c.key }))}>
                <Ionicons name={c.icon} size={13} color={form.category === c.key ? "#fff" : c.color} />
                <Text style={[styles.catPillText, form.category === c.key && { color: "#fff" }]}>{c.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {[
            { label: "SKU / Barcode (optional)", key: "sku", placeholder: "e.g. FAB-001" },
            { label: "Color", key: "color", placeholder: "e.g. Navy Blue" },
            { label: "Supplier", key: "supplier", placeholder: "e.g. Sharma Textiles" },
            { label: "Description", key: "description", placeholder: "Optional notes" },
          ].map(f => (
            <View key={f.key}>
              <Text style={styles.fieldLabel}>{f.label}</Text>
              <TextInput style={styles.input} value={form[f.key]} onChangeText={v => setForm(p => ({ ...p, [f.key]: v }))} placeholder={f.placeholder} />
            </View>
          ))}

          <Text style={styles.fieldLabel}>Unit</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 20 }}>
            {UNITS.map(u => (
              <Pressable key={u} style={[styles.unitPill, form.unit === u && styles.unitPillActive]} onPress={() => setForm(f => ({ ...f, unit: u }))}>
                <Text style={[styles.unitPillText, form.unit === u && styles.unitPillTextActive]}>{u}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.inputRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Current Stock</Text>
              <TextInput style={styles.input} value={form.currentStock} onChangeText={v => setForm(f => ({ ...f, currentStock: v }))} placeholder="0" keyboardType="numeric" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.fieldLabel}>Low Stock Alert</Text>
              <TextInput style={styles.input} value={form.lowStockThreshold} onChangeText={v => setForm(f => ({ ...f, lowStockThreshold: v }))} placeholder="5" keyboardType="numeric" />
            </View>
          </View>

          <View style={styles.inputRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Cost Price (₹)</Text>
              <TextInput style={styles.input} value={form.costPerUnit} onChangeText={v => setForm(f => ({ ...f, costPerUnit: v }))} placeholder="0" keyboardType="numeric" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.fieldLabel}>Selling Price (₹)</Text>
              <TextInput style={styles.input} value={form.sellingPricePerUnit} onChangeText={v => setForm(f => ({ ...f, sellingPricePerUnit: v }))} placeholder="0" keyboardType="numeric" />
            </View>
          </View>

          <Pressable style={styles.saveBtn} onPress={saveItem} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{editId ? "Update Item" : "Add to Inventory"}</Text>}
          </Pressable>
        </ScrollView>
      </Modal>

      {/* Transaction Modal */}
      <Modal visible={txModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Update Stock — {txItem?.name}</Text>

            {/* Transaction Type */}
            <View style={styles.txTypeRow}>
              {[
                { key: "in",         label: "Stock In",    color: "#059669" },
                { key: "out",        label: "Stock Out",   color: "#6d28d9" },
                { key: "waste",      label: "Waste",       color: "#f97316" },
                { key: "adjustment", label: "Set Total",   color: "#0ea5e9" },
              ].map(t => (
                <Pressable key={t.key} style={[styles.txTypePill, txType === t.key && { backgroundColor: t.color }]} onPress={() => setTxType(t.key)}>
                  <Text style={[styles.txTypeText, txType === t.key && { color: "#fff" }]}>{t.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Quantity ({txItem?.unit})</Text>
            <TextInput style={styles.input} value={txQty} onChangeText={setTxQty} placeholder="0" keyboardType="numeric" />
            <Text style={styles.fieldLabel}>Note (optional)</Text>
            <TextInput style={[styles.input, { marginBottom: 20 }]} value={txNote} onChangeText={setTxNote} placeholder="e.g. Received from Sharma Textiles" />

            <View style={styles.modalBtns}>
              <Pressable style={styles.cancelBtn} onPress={() => setTxModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.confirmBtn} onPress={saveTx} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.confirmBtnText}>Confirm</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  centered:  { flex: 1, justifyContent: "center", alignItems: "center" },

  header:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 14 },
  headerLabel:  { fontSize: 12, fontWeight: "700", color: "#6d28d9", textTransform: "uppercase", letterSpacing: 1 },
  headerCount:  { fontSize: 24, fontWeight: "900", color: "#0f172a" },
  headerRight:  { flexDirection: "row", alignItems: "center", gap: 10 },
  alertBadge:   { flexDirection: "row", alignItems: "center", backgroundColor: "#fef2f2", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 100, gap: 4, borderWidth: 1, borderColor: "#fecaca" },
  alertBadgeText: { fontSize: 12, fontWeight: "700", color: "#ef4444" },
  addBtn:       { width: 44, height: 44, borderRadius: 22, backgroundColor: "#ede9fe", justifyContent: "center", alignItems: "center" },

  searchRow:    { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, gap: 10, marginBottom: 14 },
  searchBox:    { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#ffffff", paddingHorizontal: 12, height: 44, borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0" },
  searchInput:  { flex: 1, marginLeft: 8, fontSize: 14, color: "#0f172a" },
  lowToggle:    { alignItems: "center" },
  lowToggleText:{ fontSize: 10, fontWeight: "700", color: "#ef4444", marginBottom: 2 },

  catPills:     { paddingHorizontal: 20, paddingBottom: 16, gap: 8 },
  catPill:      { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 100, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", gap: 5 },
  catPillText:  { fontSize: 12, fontWeight: "700", color: "#64748b" },

  list:         { paddingHorizontal: 16, paddingBottom: 40 },
  card:         { backgroundColor: "#ffffff", borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#e2e8f0", overflow: "hidden" },
  cardLow:      { borderColor: "#fca5a5", borderWidth: 2 },
  lowBadge:     { flexDirection: "row", alignItems: "center", backgroundColor: "#ef4444", alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100, marginBottom: 10, gap: 4 },
  lowBadgeText: { fontSize: 10, fontWeight: "800", color: "#fff" },
  cardTop:      { flexDirection: "row", alignItems: "flex-start", marginBottom: 14 },
  catIcon:      { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center", marginRight: 12 },
  cardInfo:     { flex: 1 },
  itemName:     { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  itemMeta:     { fontSize: 12, color: "#64748b", marginTop: 2 },
  itemSupplier: { fontSize: 12, color: "#94a3b8", marginTop: 2 },
  cardMenuBtns: { flexDirection: "row", gap: 4 },
  iconBtn:      { width: 34, height: 34, borderRadius: 10, backgroundColor: "#f8fafc", justifyContent: "center", alignItems: "center" },

  stockRow:      { flexDirection: "row", alignItems: "center", backgroundColor: "#f8fafc", borderRadius: 12, padding: 12, gap: 8 },
  stockBlock:    { flex: 1, alignItems: "center" },
  stockValue:    { fontSize: 16, fontWeight: "900", color: "#0f172a" },
  stockLabel:    { fontSize: 10, fontWeight: "600", color: "#94a3b8", marginTop: 2 },
  txBtn:         { flexDirection: "row", alignItems: "center", backgroundColor: "#ede9fe", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, gap: 4 },
  txBtnText:     { fontSize: 12, fontWeight: "700", color: "#6d28d9" },

  emptyBox:      { paddingVertical: 60, alignItems: "center" },
  emptyTitle:    { fontSize: 17, fontWeight: "700", color: "#64748b", marginTop: 12 },
  emptyDesc:     { fontSize: 13, color: "#94a3b8", marginTop: 6 },

  // Form Modal
  formModal:    { flex: 1, backgroundColor: "#f8fafc" },
  formContent:  { padding: 20, paddingBottom: 40 },
  formHeader:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  formTitle:    { fontSize: 22, fontWeight: "900", color: "#0f172a" },
  fieldLabel:   { fontSize: 13, fontWeight: "700", color: "#475569", marginBottom: 8 },
  input:        { backgroundColor: "#ffffff", borderRadius: 12, paddingHorizontal: 14, height: 50, fontSize: 15, color: "#0f172a", borderWidth: 1, borderColor: "#e2e8f0", marginBottom: 16 },
  inputRow:     { flexDirection: "row", marginBottom: 0 },
  unitPill:     { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0" },
  unitPillActive:{ backgroundColor: "#0f172a", borderColor: "#0f172a" },
  unitPillText:  { fontSize: 13, fontWeight: "600", color: "#64748b" },
  unitPillTextActive: { color: "#fff" },
  saveBtn:      { backgroundColor: "#6d28d9", height: 56, borderRadius: 16, justifyContent: "center", alignItems: "center", marginTop: 16 },
  saveBtnText:  { color: "#fff", fontSize: 16, fontWeight: "700" },

  // Transaction Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet:   { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle:   { fontSize: 18, fontWeight: "900", color: "#0f172a", marginBottom: 16 },
  txTypeRow:    { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  txTypePill:   { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#e2e8f0" },
  txTypeText:   { fontSize: 13, fontWeight: "700", color: "#475569" },
  modalBtns:    { flexDirection: "row", gap: 12, marginTop: 4 },
  cancelBtn:    { flex: 1, height: 52, borderRadius: 14, justifyContent: "center", alignItems: "center", backgroundColor: "#f1f5f9" },
  cancelBtnText:{ fontWeight: "700", color: "#475569", fontSize: 15 },
  confirmBtn:   { flex: 2, height: 52, borderRadius: 14, justifyContent: "center", alignItems: "center", backgroundColor: "#0f172a" },
  confirmBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
