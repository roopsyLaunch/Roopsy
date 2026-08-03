import React, { useCallback, useState, useEffect } from "react";
import {
  ActivityIndicator, Alert, FlatList, Pressable, RefreshControl,
  StyleSheet, Text, View, Modal, TextInput, ScrollView, Linking
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api/client";

function formatDateLabel(isoDate) {
  const d = new Date(isoDate);
  return `${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

const LiveCountdown = ({ targetDate }) => {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const update = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("Late");
        return;
      }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${m}m ${s < 10 ? '0' : ''}${s}s`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (!timeLeft) return null;

  return (
    <View style={styles.countdownBadge}>
      <Text style={styles.countdownText}>
        {timeLeft === "Late" ? "Overdue" : `In ${timeLeft}`}
      </Text>
    </View>
  );
};

export function BarberQueueScreen() {
  const [queue, setQueue] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  
  const [walkInModalVisible, setWalkInModalVisible] = useState(false);
  const [walkInName, setWalkInName] = useState("");
  const [walkInPhone, setWalkInPhone] = useState("");
  const [selectedServices, setSelectedServices] = useState([]);

  const [confirmHomeModalVisible, setConfirmHomeModalVisible] = useState(false);
  const [confirmETA, setConfirmETA] = useState("");
  const [confirmingBookingId, setConfirmingBookingId] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const [qRes, sRes] = await Promise.all([
        api.get(`/bookings/queue?date=${selectedDate}`),
        api.get("/barbers/me")
      ]);
      setQueue(qRes.data.queue || []);
      setServices(sRes.data.services || []);
    } catch (e) {
      console.error(e);
    }
  }, [selectedDate]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      (async () => {
        if (queue.length === 0) setLoading(true);
        try { if (isActive) await loadData(); } finally { if (isActive) setLoading(false); }
      })();
      return () => { isActive = false; };
    }, [loadData])
  );

  async function onRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  async function setStatus(id, status, startTime = null, isHomeService = false) {
    if (status === "confirmed" && isHomeService) {
      setConfirmingBookingId(id);
      setConfirmETA("");
      setConfirmHomeModalVisible(true);
      return;
    }
    
    if (status === "confirmed" && startTime) {
      const d = new Date(startTime);
      const timeStr = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      Alert.alert("Confirm Booking", `Confirm this booking for arrival at ${timeStr}?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Confirm", onPress: async () => {
          try {
            await api.patch(`/bookings/${id}`, { status });
            await loadData();
          } catch (e) {
            Alert.alert("Error", e?.response?.data?.error || e.message);
          }
        }}
      ]);
      return;
    }

    try {
      await api.patch(`/bookings/${id}`, { status });
      await loadData();
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.error || e.message);
    }
  }

  async function handleWalkIn() {
    if (selectedServices.length === 0) return Alert.alert("Error", "Select at least one service");
    try {
      await api.post("/bookings/walk-in", {
        serviceIds: selectedServices,
        customerName: walkInName,
        customerPhone: walkInPhone
      });
      setWalkInModalVisible(false);
      setWalkInName("");
      setWalkInPhone("");
      setSelectedServices([]);
      await loadData();
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.error || e.message);
    }
  }

  const toggleService = (id) => {
    setSelectedServices(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case "in-progress": return <View style={[styles.statusBadge, {backgroundColor:"#dcfce7"}]}><Text style={{color:"#15803d", fontSize:11, fontWeight:"700"}}>In Progress</Text></View>;
      case "arrived": return <View style={[styles.statusBadge, {backgroundColor:"#e0f2fe"}]}><Text style={{color:"#0369a1", fontSize:11, fontWeight:"700"}}>Arrived</Text></View>;
      case "confirmed": return <View style={[styles.statusBadge, {backgroundColor:"#fef08a"}]}><Text style={{color:"#ca8a04", fontSize:11, fontWeight:"700"}}>Confirmed</Text></View>;
      case "pending": return <View style={[styles.statusBadge, {backgroundColor:"#ffedd5"}]}><Text style={{color:"#c2410c", fontSize:11, fontWeight:"700"}}>Pending</Text></View>;
      case "cancelled": return <View style={[styles.statusBadge, {backgroundColor:"#fee2e2"}]}><Text style={{color:"#ef4444", fontSize:11, fontWeight:"700"}}>Cancelled</Text></View>;
      default: return null;
    }
  };

  const renderItem = ({ item }) => {
    const isWalkIn = item.isWalkIn;
    const name = item.customer?.name || item.guestName || "Customer";
    
    return (
      <View style={[styles.card, item.status === 'in-progress' && styles.cardActive]}>
        <View style={styles.cardHeader}>
           <View style={{flexDirection:"row", alignItems:"center"}}>
             <View style={[styles.avatarCircle, item.status === 'in-progress' && {backgroundColor:"#10b981"}]}>
               <Text style={[styles.avatarText, item.status === 'in-progress' && {color:"#fff"}]}>{name.charAt(0).toUpperCase()}</Text>
             </View>
             <View style={{marginLeft: 12, flex: 1}}>
               <Text style={styles.customerName}>{name} {isWalkIn && <Text style={{color:"#64748b", fontSize:12, fontWeight:"normal"}}>(Walk-In)</Text>}</Text>
               <Text style={styles.serviceText}>{item.services?.map(s => s.name).join(", ")} ({item.expectedDuration}m) - ₹{item.services?.reduce((sum, s) => sum + (s.price || 0), 0) || 0}</Text>
               {item.isHomeService ? (
                 <View style={{ marginTop: 6, backgroundColor: "#f3e8ff", padding: 8, borderRadius: 8, borderWidth: 1, borderColor: "#e9d5ff" }}>
                   <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
                     <Ionicons name="home" size={12} color="#6d28d9" style={{ marginRight: 4 }} />
                     <Text style={{ fontSize: 12, fontWeight: "700", color: "#6d28d9" }}>Home Service Request</Text>
                   </View>
                   <Text style={{ fontSize: 11, color: "#4c1d95", fontWeight: "500" }}>
                     {item.homeServiceAddress || "Address not provided"}
                   </Text>
                   {item.customer?.phone && (
                     <Pressable style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }} onPress={() => Linking.openURL(`tel:${item.customer.phone}`)}>
                       <Ionicons name="call" size={12} color="#6d28d9" style={{ marginRight: 4 }} />
                       <Text style={{ fontSize: 11, color: "#6d28d9", textDecorationLine: 'underline', fontWeight: 'bold' }}>{item.customer.phone}</Text>
                     </Pressable>
                   )}
                 </View>
               ) : (
                 <View style={{ marginTop: 6, backgroundColor: "#f0fdf4", padding: 8, borderRadius: 8, borderWidth: 1, borderColor: "#bbf7d0", flexDirection: "row", alignItems: "center", alignSelf: "flex-start" }}>
                   <Ionicons name="storefront" size={12} color="#16a34a" style={{ marginRight: 4 }} />
                   <Text style={{ fontSize: 12, fontWeight: "700", color: "#16a34a" }}>Shop Service</Text>
                 </View>
               )}
             </View>
           </View>
             <View style={{alignItems:"flex-end", maxWidth: 100}}>
             {getStatusBadge(item.status)}
             <Text style={styles.timeText}>{formatDateLabel(item.arrivalTime || item.startTime)}</Text>
             {!item.isHomeService && (item.status === 'pending' || item.status === 'confirmed') && (
               <LiveCountdown targetDate={item.arrivalTime || item.startTime} />
             )}
             {item.isHomeService && item.status === 'confirmed' && item.barberArrivalTime && (
               <LiveCountdown targetDate={item.barberArrivalTime} />
             )}
             {item.queuePosition > 0 && <Text style={styles.queuePos}>Queue #{item.queuePosition}</Text>}
             {item.delayMinutes > 0 && <Text style={styles.delayText}>Delayed {item.delayMinutes}m</Text>}
           </View>
        </View>

        <View style={styles.actionRow}>
          {item.status === 'pending' && (
            <Pressable style={[styles.btn, {backgroundColor:"#0ea5e9"}]} onPress={() => setStatus(item.id, "confirmed", item.startTime, item.isHomeService)}>
              <Text style={styles.btnText}>Confirm</Text>
            </Pressable>
          )}
          {item.status === 'confirmed' && (
            <Pressable style={[styles.btn, {backgroundColor:"#0ea5e9"}]} onPress={() => setStatus(item.id, "arrived")}>
              <Text style={styles.btnText}>Mark Arrived</Text>
            </Pressable>
          )}
          {item.status === 'arrived' && (
            <Pressable style={[styles.btn, {backgroundColor:"#10b981"}]} onPress={() => setStatus(item.id, "in-progress")}>
              <Text style={styles.btnText}>Start Service</Text>
            </Pressable>
          )}
          {item.status === 'in-progress' && (
            <Pressable style={[styles.btn, {backgroundColor:"#6d28d9"}]} onPress={() => setStatus(item.id, "completed")}>
              <Text style={styles.btnText}>Complete</Text>
            </Pressable>
          )}
          {(item.status === 'confirmed' || item.status === 'arrived' || item.status === 'pending') && (
            <Pressable style={[styles.btn, {backgroundColor:"#ef4444"}]} onPress={() => setStatus(item.id, "no-show")}>
              <Text style={styles.btnText}>No-Show</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator color="#6d28d9" size="large" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Live Queue</Text>
        <Pressable style={styles.walkInBtn} onPress={() => setWalkInModalVisible(true)}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.walkInBtnText}>Walk-In</Text>
        </Pressable>
      </View>

      <View style={styles.datePickerContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateScroll}>
          {[...Array(30)].map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() + i);
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            const isSelected = selectedDate === dateStr;
            const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
            return (
              <Pressable
                key={dateStr}
                style={[styles.dateBubble, isSelected && styles.dateBubbleActive]}
                onPress={() => setSelectedDate(dateStr)}
              >
                <Text style={[styles.dateDayText, isSelected && styles.dateTextActive]}>{dayName}</Text>
                <Text style={[styles.dateNumText, isSelected && styles.dateTextActive]}>{d.getDate()}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={queue}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.listContent}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={60} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>Queue is empty</Text>
          </View>
        }
      />

      <Modal visible={walkInModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Walk-In</Text>
            <TextInput style={styles.input} placeholder="Guest Name (Optional)" value={walkInName} onChangeText={setWalkInName} />
            <TextInput style={styles.input} placeholder="Guest Phone (Optional)" value={walkInPhone} onChangeText={setWalkInPhone} keyboardType="phone-pad" />
            
            <Text style={styles.subTitle}>Select Services</Text>
            <ScrollView style={styles.serviceList}>
              {services.map(s => (
                <Pressable key={s.id} style={[styles.serviceRow, selectedServices.includes(s.id) && styles.serviceRowActive]} onPress={() => toggleService(s.id)}>
                  <Text style={[styles.serviceRowText, selectedServices.includes(s.id) && {color:"#fff"}]}>{s.name} ({s.durationMinutes}m)</Text>
                  <Text style={[styles.serviceRowText, selectedServices.includes(s.id) && {color:"#fff"}]}>₹{s.price}</Text>
                </Pressable>
              ))}
            </ScrollView>
            
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setWalkInModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.submitBtn} onPress={handleWalkIn}>
                <Text style={styles.submitBtnText}>Add to Queue</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={confirmHomeModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirm Home Service</Text>
            <Text style={styles.subTitle}>ETA to Customer (Minutes)</Text>
            <TextInput 
              style={styles.input} 
              placeholder="e.g. 15" 
              value={confirmETA} 
              onChangeText={setConfirmETA} 
              keyboardType="number-pad" 
            />
            
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setConfirmHomeModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.submitBtn} onPress={async () => {
                if (!confirmETA) return Alert.alert("Error", "Please enter ETA in minutes");
                try {
                  await api.patch(`/bookings/${confirmingBookingId}`, { status: "confirmed", barberETA: parseInt(confirmETA, 10) });
                  setConfirmHomeModalVisible(false);
                  await loadData();
                } catch (e) {
                  Alert.alert("Error", e?.response?.data?.error || e.message);
                }
              }}>
                <Text style={styles.submitBtnText}>Confirm Booking</Text>
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
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  title: { fontSize: 20, fontWeight: "bold", color: "#0f172a" },
  walkInBtn: { flexDirection: "row", backgroundColor: "#6d28d9", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, alignItems: "center" },
  walkInBtnText: { color: "#fff", fontWeight: "600", marginLeft: 4 },
  datePickerContainer: { backgroundColor: "#fff", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  dateScroll: { paddingHorizontal: 16, gap: 12 },
  dateBubble: { width: 52, height: 60, borderRadius: 16, backgroundColor: "#f1f5f9", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#e2e8f0" },
  dateBubbleActive: { backgroundColor: "#6d28d9", borderColor: "#6d28d9" },
  dateDayText: { fontSize: 11, color: "#64748b", fontWeight: "600", marginBottom: 2 },
  dateNumText: { fontSize: 16, color: "#0f172a", fontWeight: "bold" },
  dateTextActive: { color: "#fff" },
  listContent: { padding: 16, paddingBottom: 100 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#e2e8f0" },
  cardActive: { borderColor: "#10b981", borderWidth: 2, backgroundColor: "#f0fdf4" },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  avatarCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#f1f5f9", justifyContent: "center", alignItems: "center" },
  avatarText: { fontSize: 16, fontWeight: "700", color: "#475569" },
  customerName: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  serviceText: { fontSize: 13, color: "#64748b", marginTop: 2 },
  timeText: { fontSize: 13, fontWeight: "600", color: "#334155", marginTop: 4 },
  queuePos: { fontSize: 12, fontWeight: "700", color: "#ea580c", marginTop: 2 },
  delayText: { fontSize: 12, fontWeight: "700", color: "#ef4444", marginTop: 2 },
  etaBadge: { backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fca5a5", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4 },
  etaBadgeText: { fontSize: 11, fontWeight: "700", color: "#dc2626" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  countdownBadge: { backgroundColor: "#f3e8ff", borderWidth: 1, borderColor: "#d8b4fe", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginTop: 6, alignItems: "center" },
  countdownText: { fontSize: 12, fontWeight: "700", color: "#7e22ce" },
  actionRow: { flexDirection: "row", marginTop: 16, gap: 8 },
  btn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  emptyContainer: { alignItems: "center", paddingVertical: 60 },
  emptyTitle: { fontSize: 16, color: "#94a3b8", marginTop: 12 },
  
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "80%" },
  modalTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 16, color: "#0f172a" },
  subTitle: { fontSize: 16, fontWeight: "600", marginTop: 16, marginBottom: 8, color: "#334155" },
  input: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, padding: 12, marginBottom: 12 },
  serviceList: { maxHeight: 200 },
  serviceRow: { flexDirection: "row", justifyContent: "space-between", padding: 12, borderRadius: 8, backgroundColor: "#f1f5f9", marginBottom: 8 },
  serviceRowActive: { backgroundColor: "#6d28d9" },
  serviceRowText: { fontSize: 14, fontWeight: "500", color: "#334155" },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 20 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: "#f1f5f9", alignItems: "center" },
  cancelBtnText: { color: "#475569", fontWeight: "600" },
  submitBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: "#6d28d9", alignItems: "center" },
  submitBtnText: { color: "#fff", fontWeight: "600" }
});
