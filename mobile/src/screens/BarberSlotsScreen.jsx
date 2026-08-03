import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../api/client";
import { getSocket } from "../api/socket";
import { useAuth } from "../context/AuthContext";

export function BarberSlotsScreen({ navigation, isNested }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [barber, setBarber] = useState(null);
  const { user, tailor, refreshMe } = useAuth();
  const [seats, setSeats] = useState([]);
  const [activeBookings, setActiveBookings] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  const [selectedSeat, setSelectedSeat] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  
  // Seat Settings Modal
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [newSeatCount, setNewSeatCount] = useState("1");
  
  // Auto Settings Modal
  const [autoSettingsModalVisible, setAutoSettingsModalVisible] = useState(false);
  const [tempAutoStatus, setTempAutoStatus] = useState(false);
  const [tempOpenTime, setTempOpenTime] = useState("09:00");
  const [tempCloseTime, setTempCloseTime] = useState("21:00");

  const [saving, setSaving] = useState(false);
  
  // Walk-in Modal States
  const [walkInModalVisible, setWalkInModalVisible] = useState(false);
  const [walkInName, setWalkInName] = useState("");
  const [walkInPhone, setWalkInPhone] = useState("");
  const [services, setServices] = useState([]);
  const [selectedWalkInServices, setSelectedWalkInServices] = useState([]);
  const [submittingWalkIn, setSubmittingWalkIn] = useState(false);
  const loadData = useCallback(async () => {
    if (user?.role === "tailor") return;
    try {
      const res = await api.get("/barbers/me");
      setBarber(res.data.barber);
      setSeats(res.data.barber.seats || []);

      const bkRes = await api.get("/bookings/barber");
      const inProgress = (bkRes.data.bookings || []).filter(b => b.status === "in-progress" || b.status === "confirmed");
      setActiveBookings(inProgress);

      if (res.data.barber?.id) {
        const sRes = await api.get(`/services?barberId=${res.data.barber.id}`);
        setServices(sRes.data.services || []);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadData();
      setLoading(false);
    })();
  }, [loadData]);

  useEffect(() => {
    // Setup Socket.io
    const socket = getSocket();
    if (barber?.id) {
       socket.emit("joinBarberRoom", barber.id);
    }
    
    const handleSlotsUpdated = (data) => {
      if (data && data.seats) {
        setSeats(data.seats);
      }
    };
    socket.on("slotsUpdated", handleSlotsUpdated);
    
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => {
      clearInterval(interval);
      if (barber?.id) socket.emit("leaveBarberRoom", barber.id);
      socket.off("slotsUpdated", handleSlotsUpdated);
    };
  }, [barber?.id]);

  const toggleWalkInService = (id) => {
    setSelectedWalkInServices(prev => 
      prev.includes(id) ? prev.filter(sId => sId !== id) : [...prev, id]
    );
  };

  const handleWalkInSubmit = async () => {
    if (selectedWalkInServices.length === 0) {
      alert("Please select at least one service");
      return;
    }
    setSubmittingWalkIn(true);
    try {
      await api.post("/bookings/walk-in", {
        customerName: walkInName,
        customerPhone: walkInPhone,
        serviceIds: selectedWalkInServices
      });
      setWalkInModalVisible(false);
      setWalkInName("");
      setWalkInPhone("");
      setSelectedWalkInServices([]);
      await loadData();
    } catch(e) {
      console.error(e);
      alert(e.response?.data?.error || "Failed to add walk-in");
    } finally {
      setSubmittingWalkIn(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleUpdateSeat = async (isAvailable, additionalMinutes = 0, bookingStatusOverride = "completed") => {
    if (!selectedSeat) return;
    setSaving(true);
    try {
      if (isAvailable) {
        const booking = activeBookings.find(b => b.seatLabel === selectedSeat.label);
        if (booking) {
          await api.patch(`/bookings/${booking.id}`, { status: bookingStatusOverride });
        }
      }

      let occupiedUntil = null;
      if (!isAvailable && additionalMinutes > 0) {
        const d = new Date();
        d.setMinutes(d.getMinutes() + additionalMinutes);
        occupiedUntil = d.toISOString();
      }

      const updatedSeats = seats.map((s) => {
        if (s.index === selectedSeat.index) {
          return { ...s, isAvailable, occupiedUntil };
        }
        return s;
      });

      const res = await api.patch("/barbers/me", { seats: updatedSeats });
      setBarber(res.data.barber);
      setSeats(res.data.barber.seats || []);

      const bkRes = await api.get("/bookings/barber");
      const inProgress = (bkRes.data.bookings || []).filter(b => b.status === "in-progress" || b.status === "confirmed");
      setActiveBookings(inProgress);

      setModalVisible(false);
    } catch (err) {
      console.error(err);
      alert("Failed to update seat status.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateTotalSeats = async () => {
    const num = parseInt(newSeatCount, 10);
    if (isNaN(num) || num < 1 || num > 50) {
      alert("Please enter a valid number of seats (1-50)");
      return;
    }
    setSaving(true);
    try {
      const res = await api.patch("/barbers/me", { seatCount: num });
      setBarber(res.data.barber);
      setSeats(res.data.barber.seats || []);
      setSettingsModalVisible(false);
    } catch (e) {
      console.error(e);
      alert("Failed to update total seats");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleShopStatus = async (val) => {
    try {
      // Optimistic update
      setBarber(prev => ({ ...prev, isShopOpen: val, autoShopStatus: false }));
      const res = await api.patch("/barbers/me", { isShopOpen: val, autoShopStatus: false });
      setBarber(res.data.barber);
    } catch (e) {
      console.error(e);
      // Revert on error
      setBarber(prev => ({ ...prev, isShopOpen: !val }));
      alert("Failed to update shop status");
    }
  };

  const openAutoSettings = () => {
    setTempAutoStatus(barber?.autoShopStatus || false);
    setTempOpenTime(barber?.dailyOpenTime || "09:00");
    setTempCloseTime(barber?.dailyCloseTime || "21:00");
    setAutoSettingsModalVisible(true);
  };

  const handleSaveAutoSettings = async () => {
    const timeRegex = /^([01]\d|2[0-3]):?([0-5]\d)$/;
    if (!timeRegex.test(tempOpenTime) || !timeRegex.test(tempCloseTime)) {
      alert("Please enter valid times in HH:MM format (24-hour) (e.g. 09:00 or 18:30).");
      return;
    }
    setSaving(true);
    try {
      const res = await api.patch("/barbers/me", { 
        autoShopStatus: tempAutoStatus,
        dailyOpenTime: tempOpenTime,
        dailyCloseTime: tempCloseTime,
      });
      setBarber(res.data.barber);
      setAutoSettingsModalVisible(false);
    } catch (e) {
      console.error(e);
      alert("Failed to update auto settings");
    } finally {
      setSaving(false);
    }
  };

  const openSeatModal = (seat) => {
    setSelectedSeat(seat);
    setModalVisible(true);
  };

  const getSeatStatus = (seat) => {
    const booking = activeBookings.find(b => b.seatLabel === seat.label);
    
    if (booking) {
      const untilDate = new Date(booking.endTime || seat.occupiedUntil);
      const diffMins = Math.round((untilDate - currentTime) / 60000);
      const custName = booking.customer?.name 
        ? booking.customer.name.split(" ")[0] 
        : (booking.guestName ? booking.guestName.split(" ")[0] : "Walk-in");
      
      if (diffMins > 0) {
        return { status: `Free in ${diffMins}m`, subtitle: `by ${custName}`, color: "#f59e0b", bg: "#fef3c7" };
      } else {
        return { status: "Done soon", subtitle: `by ${custName}`, color: "#ef4444", bg: "#fee2e2" };
      }
    }

    if (seat.isAvailable) return { status: "Available", subtitle: "", color: "#16a34a", bg: "#dcfce7" };
    
    if (seat.occupiedUntil) {
      const untilDate = new Date(seat.occupiedUntil);
      if (untilDate > currentTime) {
        const diffMins = Math.round((untilDate - currentTime) / 60000);
        return { status: `Free in ${diffMins}m`, subtitle: "Manual block", color: "#f59e0b", bg: "#fef3c7" };
      }
    }
    
    return { status: "Occupied", subtitle: "", color: "#ef4444", bg: "#fee2e2" };
  };

  const totalSeats = seats.length;
  const availableSeats = seats.filter(s => s.isAvailable || (s.occupiedUntil && new Date(s.occupiedUntil) <= currentTime)).length;
  const occupiedSeats = totalSeats - availableSeats;

  if (user?.role === "tailor") {
    return (
      <View style={[styles.container, !isNested && { paddingTop: Math.max(insets.top, 10) }]}>
        {!isNested && (
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Tailor Service Modes</Text>
              <Text style={styles.headerSub}>Manage service mode availability for customers</Text>
            </View>
          </View>
        )}

        <FlatList
          data={[1]}
          keyExtractor={() => "tailor-modes"}
          contentContainerStyle={{ padding: 20 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6d28d9" />}
          renderItem={() => (
            <View>
              {/* Shop Status / Open Switch */}
              <View style={[styles.shopStatusContainer, { marginBottom: 16 }]}>
                <View style={styles.shopStatusInfo}>
                  <Text style={styles.shopStatusTitle}>Tailor Shop Open Status</Text>
                  <Text style={styles.shopStatusSub}>
                    {tailor?.isShopOpen ? "Open for customer bookings" : "Currently closed"}
                  </Text>
                </View>
                <Switch
                  value={!!tailor?.isShopOpen}
                  onValueChange={async (val) => {
                    try {
                      await api.patch("/tailors/me", { isShopOpen: val });
                      await refreshMe();
                    } catch(e) {
                      alert("Failed to update status");
                    }
                  }}
                  trackColor={{ false: "#e2e8f0", true: "#6d28d9" }}
                  thumbColor="#ffffff"
                />
              </View>

              {/* 1. Shop Service Switch */}
              <View style={[styles.shopStatusContainer, { marginBottom: 16 }]}>
                <View style={styles.shopStatusInfo}>
                  <View style={{flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2}}>
                    <Ionicons name="storefront" size={18} color="#0369a1" />
                    <Text style={styles.shopStatusTitle}>🏪 Shop Service (Visit Shop)</Text>
                  </View>
                  <Text style={styles.shopStatusSub}>
                    {tailor?.offersShopService !== false 
                      ? "ON - Customers can book shop visit" 
                      : "OFF - Shop service bookings disabled"}
                  </Text>
                </View>
                <Switch
                  value={tailor?.offersShopService !== false}
                  onValueChange={async (val) => {
                    try {
                      await api.patch("/tailors/me", { offersShopService: val });
                      await refreshMe();
                    } catch(e) {
                      alert("Failed to update shop service status");
                    }
                  }}
                  trackColor={{ false: "#e2e8f0", true: "#0369a1" }}
                  thumbColor="#ffffff"
                />
              </View>

              {/* 2. Home Service Switch */}
              <View style={[styles.shopStatusContainer, { marginBottom: 16 }]}>
                <View style={styles.shopStatusInfo}>
                  <View style={{flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2}}>
                    <Ionicons name="home" size={18} color="#6d28d9" />
                    <Text style={styles.shopStatusTitle}>🏡 Home Service (Doorstep Visit)</Text>
                  </View>
                  <Text style={styles.shopStatusSub}>
                    {tailor?.offersHomeService !== false 
                      ? "ON - Tailor provides doorstep home service" 
                      : "OFF - Home doorstep service disabled"}
                  </Text>
                </View>
                <Switch
                  value={tailor?.offersHomeService !== false}
                  onValueChange={async (val) => {
                    try {
                      await api.patch("/tailors/me", { offersHomeService: val });
                      await refreshMe();
                    } catch(e) {
                      alert("Failed to update home service status");
                    }
                  }}
                  trackColor={{ false: "#e2e8f0", true: "#6d28d9" }}
                  thumbColor="#ffffff"
                />
              </View>

              {/* 3. Premium Service Switch */}
              <View style={[styles.shopStatusContainer, { marginBottom: 16 }]}>
                <View style={styles.shopStatusInfo}>
                  <View style={{flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2}}>
                    <Ionicons name="star" size={18} color="#b45309" />
                    <Text style={styles.shopStatusTitle}>⭐ Premium Service (VIP / Express)</Text>
                  </View>
                  <Text style={styles.shopStatusSub}>
                    {tailor?.offersPremiumService !== false 
                      ? "ON - Customers can book VIP/Express premium service" 
                      : "OFF - Premium service disabled"}
                  </Text>
                </View>
                <Switch
                  value={tailor?.offersPremiumService !== false}
                  onValueChange={async (val) => {
                    try {
                      await api.patch("/tailors/me", { offersPremiumService: val });
                      await refreshMe();
                    } catch(e) {
                      alert("Failed to update premium service status");
                    }
                  }}
                  trackColor={{ false: "#e2e8f0", true: "#b45309" }}
                  thumbColor="#ffffff"
                />
              </View>
            </View>
          )}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, !isNested && { paddingTop: Math.max(insets.top, 10) }]}>
      {!isNested && (
        <View style={[styles.header, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}>
          <View>
            <Text style={styles.headerTitle}>Live Slots</Text>
            <Text style={styles.headerSub}>Manage your shop seats in real-time</Text>
          </View>
          <Pressable onPress={() => setWalkInModalVisible(true)} style={styles.walkInBtn}>
             <Ionicons name="person-add" size={16} color="#fff" />
             <Text style={styles.walkInBtnText}>Walk-In</Text>
          </Pressable>
        </View>
      )}

      {barber && (
        <>
        <View style={[styles.shopStatusContainer, { marginBottom: 10 }]}>
          <View style={styles.shopStatusInfo}>
            <Text style={styles.shopStatusTitle}>Shop Status</Text>
            <Text style={styles.shopStatusSub}>
              {barber.autoShopStatus 
                ? (barber.isShopOpen ? "Auto-managed (OPEN)" : "Auto-managed (CLOSED)")
                : (barber.isShopOpen ? "Open for bookings" : "Currently closed")}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Pressable onPress={openAutoSettings} style={{ padding: 8, backgroundColor: "#f1f5f9", borderRadius: 8 }}>
              <Ionicons name="time" size={20} color="#6d28d9" />
            </Pressable>
            <Switch
              value={barber.isShopOpen}
              onValueChange={handleToggleShopStatus}
              trackColor={{ false: "#e2e8f0", true: "#6d28d9" }}
              thumbColor="#ffffff"
              style={{ transform: [{ scaleX: 1.1 }, { scaleY: 1.1 }] }}
            />
          </View>
        </View>

        <View style={[styles.shopStatusContainer, { marginBottom: 20 }]}>
          <View style={styles.shopStatusInfo}>
            <Text style={styles.shopStatusTitle}>Home Service</Text>
            <Text style={styles.shopStatusSub}>
              {barber.offersHomeService ? "Accepting home bookings" : "Home service off"}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Switch
              value={barber.offersHomeService}
              onValueChange={async (val) => {
                try {
                  setBarber(prev => ({ ...prev, offersHomeService: val }));
                  await api.patch("/barbers/me", { offersHomeService: val });
                } catch(e) {
                  setBarber(prev => ({ ...prev, offersHomeService: !val }));
                  alert("Failed to update home service status");
                }
              }}
              trackColor={{ false: "#e2e8f0", true: "#6d28d9" }}
              thumbColor="#ffffff"
              style={{ transform: [{ scaleX: 1.1 }, { scaleY: 1.1 }] }}
            />
          </View>
        </View>
        </>
      )}

      <View style={styles.statsRow}>
        <Pressable 
          style={[styles.statBox, { borderColor: "#6d28d9", backgroundColor: "#f5f3ff", borderWidth: 2 }]} 
          onPress={() => {
            setNewSeatCount(totalSeats.toString());
            setSettingsModalVisible(true);
          }}
        >
          <Ionicons name="settings-outline" size={14} color="#6d28d9" style={{ position: "absolute", top: 8, right: 8 }} />
          <Text style={[styles.statNum, { color: "#6d28d9" }]}>{totalSeats}</Text>
          <Text style={[styles.statLabel, { color: "#6d28d9" }]}>Total Seats</Text>
        </Pressable>
        <View style={[styles.statBox, { borderColor: "#86efac", backgroundColor: "#f0fdf4" }]}>
          <Text style={[styles.statNum, { color: "#16a34a" }]}>{availableSeats}</Text>
          <Text style={[styles.statLabel, { color: "#16a34a" }]}>Available</Text>
        </View>
        <View style={[styles.statBox, { borderColor: "#fca5a5", backgroundColor: "#fef2f2" }]}>
          <Text style={[styles.statNum, { color: "#ef4444" }]}>{occupiedSeats}</Text>
          <Text style={[styles.statLabel, { color: "#ef4444" }]}>Occupied</Text>
        </View>
      </View>

      <FlatList
        data={seats}
        keyExtractor={(item) => item.index.toString()}
        numColumns={2}
        contentContainerStyle={styles.listContainer}
        columnWrapperStyle={styles.row}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6d28d9" />}
        renderItem={({ item }) => {
          const info = getSeatStatus(item);
          return (
            <Pressable
              style={[styles.seatCard, { backgroundColor: info.bg, borderColor: info.color }]}
              onPress={() => openSeatModal(item)}
            >
              <View style={styles.seatHeader}>
                <Text style={[styles.seatLabel, { color: info.color }]}>{item.label}</Text>
                <Ionicons name={item.isAvailable ? "checkmark-circle" : "time"} size={20} color={info.color} />
              </View>
              <View style={styles.seatIconWrapper}>
                <Ionicons name="person" size={40} color={info.color} style={{ opacity: item.isAvailable ? 0.2 : 0.8 }} />
              </View>
              <View style={[styles.statusBadge, { backgroundColor: info.color }]}>
                <Text style={styles.statusText}>{info.status}</Text>
              </View>
              {info.subtitle ? (
                <Text style={{ fontSize: 10, color: info.color, marginTop: 6, fontWeight: '800' }}>{info.subtitle}</Text>
              ) : null}
            </Pressable>
          );
        }}
      />

      {/* UPDATE MODAL */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Update {selectedSeat?.label}</Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <Ionicons name="close-circle" size={26} color="#cbd5e1" />
              </Pressable>
            </View>

            <View style={styles.modalBody}>
              {(() => {
                const activeBooking = activeBookings.find(b => b.seatLabel === selectedSeat?.label);
                if (activeBooking) {
                  return (
                    <View>
                      <Text style={styles.modalDesc}>This seat is currently occupied by a booking.</Text>
                      <Pressable
                        style={[styles.actionBtn, { backgroundColor: "#16a34a", marginBottom: 12 }]}
                        onPress={() => handleUpdateSeat(true, 0, "completed")}
                        disabled={saving}
                      >
                        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionBtnText}>Finish Service & Free Chair</Text>}
                      </Pressable>
                      <Pressable
                        style={[styles.actionBtn, { backgroundColor: "#ef4444" }]}
                        onPress={() => handleUpdateSeat(true, 0, "cancelled")}
                        disabled={saving}
                      >
                        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionBtnText}>Cancel Booking & Free Chair</Text>}
                      </Pressable>
                    </View>
                  );
                } else {
                  return (
                    <View>
                      <Text style={styles.modalDesc}>Set the current status of this seat.</Text>

                      <Pressable
                        style={[styles.actionBtn, { backgroundColor: "#16a34a" }]}
                        onPress={() => handleUpdateSeat(true)}
                        disabled={saving}
                      >
                        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionBtnText}>Mark as Available Now</Text>}
                      </Pressable>

                      <Text style={styles.dividerText}>OR MARK OCCUPIED FOR</Text>

                      <View style={styles.timeGrid}>
                        {[15, 30, 45, 60].map(mins => (
                          <Pressable
                            key={mins}
                            style={styles.timeBtn}
                            onPress={() => handleUpdateSeat(false, mins)}
                            disabled={saving}
                          >
                            <Text style={styles.timeBtnText}>{mins} mins</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  );
                }
              })()}
            </View>
          </View>
        </View>
      </Modal>

      {/* AUTO SETTINGS MODAL */}
      <Modal visible={autoSettingsModalVisible} transparent animationType="fade" onRequestClose={() => setAutoSettingsModalVisible(false)}>
        <View style={[styles.modalBg, { justifyContent: "center", alignItems: "center" }]}>
          <View style={[styles.modalSheet, { borderRadius: 24, padding: 24, width: "90%" }]}>
            <Text style={[styles.modalTitle, { textAlign: "center", marginBottom: 8 }]}>Auto Open/Close Shop</Text>
            <Text style={[styles.modalDesc, { textAlign: "center", marginBottom: 20 }]}>
              Automatically set your shop as OPEN during these hours.
            </Text>

            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#334155" }}>Enable Auto Manage</Text>
              <Switch
                value={tempAutoStatus}
                onValueChange={setTempAutoStatus}
                trackColor={{ false: "#e2e8f0", true: "#6d28d9" }}
                thumbColor="#ffffff"
              />
            </View>

            <View style={{ flexDirection: "row", gap: 16, marginBottom: 24, opacity: tempAutoStatus ? 1 : 0.4 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#64748b", marginBottom: 8 }}>Opening (HH:MM)</Text>
                <TextInput
                  style={{ backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 12, height: 48, paddingHorizontal: 12, fontSize: 16, color: "#0f172a" }}
                  placeholder="09:00"
                  value={tempOpenTime}
                  onChangeText={setTempOpenTime}
                  editable={tempAutoStatus}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#64748b", marginBottom: 8 }}>Closing (HH:MM)</Text>
                <TextInput
                  style={{ backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 12, height: 48, paddingHorizontal: 12, fontSize: 16, color: "#0f172a" }}
                  placeholder="21:00"
                  value={tempCloseTime}
                  onChangeText={setTempCloseTime}
                  editable={tempAutoStatus}
                />
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable
                style={[styles.actionBtn, { flex: 1, backgroundColor: "#f1f5f9" }]}
                onPress={() => setAutoSettingsModalVisible(false)}
                disabled={saving}
              >
                <Text style={[styles.actionBtnText, { color: "#64748b" }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.actionBtn, { flex: 1, backgroundColor: "#6d28d9" }]}
                onPress={handleSaveAutoSettings}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionBtnText}>Save</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* UPDATE TOTAL SEATS MODAL */}
      <Modal visible={settingsModalVisible} transparent animationType="fade" onRequestClose={() => setSettingsModalVisible(false)}>
        <View style={[styles.modalBg, { justifyContent: "center", alignItems: "center" }]}>
          <View style={[styles.modalSheet, { borderRadius: 24, padding: 24, width: "90%" }]}>
            <Text style={[styles.modalTitle, { textAlign: "center", marginBottom: 8 }]}>Update Total Seats</Text>
            <Text style={[styles.modalDesc, { textAlign: "center", marginBottom: 20 }]}>
              How many chairs do you have in your shop?
            </Text>

            <View style={styles.stepperContainer}>
              <Pressable 
                style={styles.stepperBtn} 
                onPress={() => setNewSeatCount(Math.max(1, parseInt(newSeatCount || "1", 10) - 1).toString())}
              >
                <Ionicons name="remove" size={24} color="#64748b" />
              </Pressable>
              
              <Text style={styles.stepperValue}>{newSeatCount}</Text>
              
              <Pressable 
                style={styles.stepperBtn} 
                onPress={() => setNewSeatCount(Math.min(50, parseInt(newSeatCount || "0", 10) + 1).toString())}
              >
                <Ionicons name="add" size={24} color="#64748b" />
              </Pressable>
            </View>

            <View style={{ flexDirection: "row", gap: 12, marginTop: 30 }}>
              <Pressable
                style={[styles.actionBtn, { flex: 1, backgroundColor: "#f1f5f9" }]}
                onPress={() => setSettingsModalVisible(false)}
                disabled={saving}
              >
                <Text style={[styles.actionBtnText, { color: "#64748b" }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.actionBtn, { flex: 1, backgroundColor: "#6d28d9" }]}
                onPress={handleUpdateTotalSeats}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionBtnText}>Save</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* WALK-IN MODAL */}
      <Modal visible={walkInModalVisible} transparent animationType="slide" onRequestClose={() => setWalkInModalVisible(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Walk-In Customer</Text>
              <Pressable onPress={() => setWalkInModalVisible(false)}>
                <Ionicons name="close-circle" size={26} color="#cbd5e1" />
              </Pressable>
            </View>
            <View style={styles.modalBody}>
              <TextInput
                style={styles.input}
                placeholder="Customer Name (Optional)"
                value={walkInName}
                onChangeText={setWalkInName}
                placeholderTextColor="#94a3b8"
              />
              <TextInput
                style={[styles.input, { marginTop: 12 }]}
                placeholder="Phone Number (Optional)"
                value={walkInPhone}
                onChangeText={setWalkInPhone}
                keyboardType="phone-pad"
                placeholderTextColor="#94a3b8"
              />
              <Text style={[styles.sectionTitle, { marginTop: 24, marginBottom: 12 }]}>Select Services</Text>
              
              {availableSeats === 0 && (
                <View style={{ backgroundColor: "#fef3c7", padding: 12, borderRadius: 12, marginBottom: 16 }}>
                  <Text style={{ color: "#d97706", fontSize: 13, fontWeight: "600" }}>⚠️ No chairs are currently available. This walk-in will be added to the queue.</Text>
                </View>
              )}
              
              {services.length === 0 ? (
                <Text style={{ color: "#ef4444", fontSize: 14, marginBottom: 16 }}>No services added to your shop yet. Please add services from the Manage tab first.</Text>
              ) : (
              <View style={styles.servicesGrid}>
                {services.map(s => {
                  const isSelected = selectedWalkInServices.includes(s.id || s._id);
                  return (
                    <Pressable
                      key={s.id || s._id}
                      style={[styles.servicePill, isSelected && styles.servicePillSelected]}
                      onPress={() => toggleWalkInService(s.id || s._id)}
                    >
                      <Text style={[styles.servicePillText, isSelected && styles.servicePillTextSelected]}>{s.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
              )}
              
              <Pressable 
                style={[styles.actionBtn, { backgroundColor: services.length === 0 ? "#94a3b8" : "#6d28d9", marginTop: 32 }]} 
                onPress={handleWalkInSubmit} 
                disabled={submittingWalkIn || services.length === 0}
              >
                {submittingWalkIn ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionBtnText}>{availableSeats === 0 ? "Add Walk-In to Queue" : "Add Walk-In & Lock Chair"}</Text>}
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
  
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  headerTitle: { fontSize: 28, fontWeight: "900", color: "#0f172a" },
  headerSub: { fontSize: 14, color: "#64748b", marginTop: 4 },

  shopStatusContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#f1f5f9",
  },
  shopStatusInfo: { flex: 1 },
  shopStatusTitle: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  shopStatusSub: { fontSize: 13, color: "#64748b", marginTop: 2 },

  statsRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 20 },
  statBox: { flex: 1, backgroundColor: "#ffffff", borderWidth: 1, borderRadius: 16, padding: 12, alignItems: "center", marginHorizontal: 4 },
  statNum: { fontSize: 22, fontWeight: "900", color: "#334155" },
  statLabel: { fontSize: 11, fontWeight: "700", color: "#64748b", textTransform: "uppercase", marginTop: 4 },

  listContainer: { paddingHorizontal: 16, paddingBottom: 100 },
  row: { justifyContent: "space-between" },
  seatCard: { 
    width: "48%", 
    borderWidth: 2, 
    borderRadius: 20, 
    padding: 16, 
    marginBottom: 16,
    alignItems: "center" 
  },
  seatHeader: { flexDirection: "row", justifyContent: "space-between", width: "100%", alignItems: "center", marginBottom: 12 },
  seatLabel: { fontSize: 16, fontWeight: "800" },
  seatIconWrapper: { height: 60, justifyContent: "center", alignItems: "center", marginBottom: 12 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: "700", color: "#ffffff" },

  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#ffffff", borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingBottom: 30 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 24, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  modalBody: { padding: 24 },
  modalDesc: { fontSize: 15, color: "#64748b", marginBottom: 24, textAlign: "center" },
  actionBtn: { width: "100%", height: 56, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  actionBtnText: { fontSize: 16, fontWeight: "700", color: "#ffffff" },
  dividerText: { fontSize: 12, fontWeight: "800", color: "#94a3b8", textAlign: "center", marginVertical: 24, letterSpacing: 1 },
  timeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  timeBtn: { flex: 1, minWidth: "45%", height: 56, backgroundColor: "#fff1f2", borderWidth: 1, borderColor: "#fda4af", borderRadius: 16, justifyContent: "center", alignItems: "center" },
  timeBtnText: { fontSize: 16, fontWeight: "700", color: "#e11d48" },

  stepperContainer: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#f8fafc", borderRadius: 20, padding: 10, borderWidth: 1, borderColor: "#e2e8f0" },
  stepperBtn: { width: 50, height: 50, borderRadius: 16, backgroundColor: "#ffffff", justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  stepperValue: { flex: 1, textAlign: "center", fontSize: 28, fontWeight: "900", color: "#0f172a" },

  walkInBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#0f172a", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, gap: 6 },
  walkInBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  input: { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 12, padding: 16, fontSize: 16, color: "#0f172a" },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  servicesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  servicePill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#e2e8f0" },
  servicePillSelected: { backgroundColor: "#6d28d9", borderColor: "#6d28d9" },
  servicePillText: { fontSize: 14, fontWeight: "600", color: "#475569" },
  servicePillTextSelected: { color: "#ffffff" },
});
