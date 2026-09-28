import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { getSocket } from "../api/socket";

export function NotificationModal({ visible, onClose, onUnreadCountChange }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [selectedNotifIds, setSelectedNotifIds] = useState([]);
  const [selectionMode, setSelectionMode] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user?._id && !user?.id) {
      setNotifications([]);
      if (onUnreadCountChange) onUnreadCountChange(0);
      return;
    }
    try {
      const res = await api.get("/auth/notifications");
      const list = res.data.notifications || [];
      const count = res.data.unreadCount || 0;
      setNotifications(list);
      if (onUnreadCountChange) onUnreadCountChange(count);
    } catch (err) {
      console.warn("NotificationModal fetch error:", err);
    }
  }, [user?._id, user?.id, onUnreadCountChange]);

  useEffect(() => {
    if (visible) {
      setSelectionMode(false);
      setSelectedNotifIds([]);
      setLoadingNotifs(true);
      (async () => {
        try {
          const res = await api.get("/auth/notifications");
          const list = res.data.notifications || [];
          const count = res.data.unreadCount || 0;
          setNotifications(list);
          if (count > 0) {
            await api.patch("/auth/notifications/read-all");
            setNotifications(list.map((n) => ({ ...n, isRead: true })));
            if (onUnreadCountChange) onUnreadCountChange(0);
          } else {
            if (onUnreadCountChange) onUnreadCountChange(0);
          }
        } catch (e) {
          console.warn("NotificationModal open fetch error:", e);
        } finally {
          setLoadingNotifs(false);
        }
      })();
    }
  }, [visible, onUnreadCountChange]);

  // Real-time socket listener for incoming notifications
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handleUpdate = () => {
      fetchNotifications();
    };
    socket.on("notification", handleUpdate);
    socket.on("notificationReceived", handleUpdate);
    socket.on("turnUpcoming", handleUpdate);
    socket.on("bookingUpdated", handleUpdate);
    socket.on("queueUpdated", handleUpdate);
    return () => {
      socket.off("notification", handleUpdate);
      socket.off("notificationReceived", handleUpdate);
      socket.off("turnUpcoming", handleUpdate);
      socket.off("bookingUpdated", handleUpdate);
      socket.off("queueUpdated", handleUpdate);
    };
  }, [fetchNotifications]);

  const markAllRead = async () => {
    try {
      await api.patch("/auth/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      if (onUnreadCountChange) onUnreadCountChange(0);
    } catch (err) {
      console.warn("markAllRead error:", err);
    }
  };

  const clearAllNotifications = () => {
    if (notifications.length === 0) return;
    Alert.alert(
      "Clear All Notifications",
      "Are you sure you want to permanently delete all notifications?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete("/auth/notifications");
              setNotifications([]);
              if (onUnreadCountChange) onUnreadCountChange(0);
              setSelectedNotifIds([]);
              setSelectionMode(false);
            } catch (err) {
              console.warn("clearAllNotifications error:", err);
            }
          },
        },
      ]
    );
  };

  const toggleSelectNotification = (notifId) => {
    setSelectedNotifIds((prev) => {
      if (prev.includes(notifId)) {
        const next = prev.filter((id) => id !== notifId);
        if (next.length === 0) setSelectionMode(false);
        return next;
      } else {
        return [...prev, notifId];
      }
    });
  };

  const startSelectionMode = (notifId) => {
    setSelectionMode(true);
    setSelectedNotifIds([notifId]);
  };

  const toggleSelectAll = () => {
    if (selectedNotifIds.length === notifications.length) {
      setSelectedNotifIds([]);
      setSelectionMode(false);
    } else {
      setSelectedNotifIds(notifications.map((n) => n._id));
      setSelectionMode(true);
    }
  };

  const confirmDeleteNotification = (notifId) => {
    Alert.alert(
      "Delete Notification",
      "Are you sure you want to delete this notification?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/auth/notifications/${notifId}`);
              setNotifications((prev) => prev.filter((n) => n._id !== notifId));
            } catch (err) {
              console.warn("Delete notification error:", err);
            }
          },
        },
      ]
    );
  };

  const deleteSelectedNotifications = () => {
    if (selectedNotifIds.length === 0) return;
    Alert.alert(
      "Delete Selected",
      `Are you sure you want to permanently delete ${selectedNotifIds.length} notification${selectedNotifIds.length > 1 ? "s" : ""}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await api.post("/auth/notifications/delete-bulk", { ids: selectedNotifIds });
              setNotifications((prev) => prev.filter((n) => !selectedNotifIds.includes(n._id)));
              setSelectedNotifIds([]);
              setSelectionMode(false);
            } catch (err) {
              console.warn("Bulk delete notifications error:", err);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBg}>
        <View style={styles.modalSheet}>
          <View style={styles.modalSheetHeader}>
            {selectionMode ? (
              <View style={styles.headerRow}>
                <View style={styles.leftRow}>
                  <Pressable
                    onPress={() => {
                      setSelectionMode(false);
                      setSelectedNotifIds([]);
                    }}
                    style={{ padding: 4, marginRight: 10 }}
                  >
                    <Ionicons name="close" size={24} color="#334155" />
                  </Pressable>
                  <Text style={[styles.modalSheetTitle, { fontSize: 16 }]}>
                    {selectedNotifIds.length} Selected
                  </Text>
                </View>
                <View style={styles.rightActions}>
                  <Pressable
                    onPress={toggleSelectAll}
                    style={styles.selectBtn}
                  >
                    <Text style={styles.selectBtnText}>
                      {selectedNotifIds.length === notifications.length ? "Deselect All" : "Select All"}
                    </Text>
                  </Pressable>
                  <Pressable onPress={deleteSelectedNotifications} style={{ padding: 4 }}>
                    <Ionicons name="trash" size={22} color="#ef4444" />
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.headerRow}>
                <View style={styles.leftRow}>
                  <Ionicons name="notifications" size={22} color="#7c3aed" style={{ marginRight: 8 }} />
                  <Text style={styles.modalSheetTitle}>Notifications 🔔</Text>
                </View>
                <View style={styles.rightActions}>
                  {notifications.length > 0 && (
                    <Pressable onPress={clearAllNotifications} style={styles.clearBtn}>
                      <Ionicons name="trash-outline" size={13} color="#dc2626" style={{ marginRight: 4 }} />
                      <Text style={styles.clearBtnText}>Clear All</Text>
                    </Pressable>
                  )}
                  <Pressable onPress={onClose}>
                    <Ionicons name="close-circle" size={26} color="#94a3b8" />
                  </Pressable>
                </View>
              </View>
            )}
          </View>

          <ScrollView style={styles.scrollList} showsVerticalScrollIndicator={false}>
            {loadingNotifs ? (
              <ActivityIndicator color="#7c3aed" style={{ marginVertical: 30 }} />
            ) : notifications.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="notifications-off-outline" size={48} color="#cbd5e1" />
                <Text style={styles.emptyTitle}>No Notifications Yet</Text>
                <Text style={styles.emptySub}>
                  You will receive instant updates here when bookings or shop activities progress!
                </Text>
              </View>
            ) : (
              notifications.map((item) => {
                const isSelected = selectedNotifIds.includes(item._id);
                return (
                  <Pressable
                    key={item._id}
                    onPress={() => {
                      if (selectionMode) {
                        toggleSelectNotification(item._id);
                      } else {
                        confirmDeleteNotification(item._id);
                      }
                    }}
                    onLongPress={() => {
                      if (!selectionMode) {
                        startSelectionMode(item._id);
                      }
                    }}
                    style={({ pressed }) => [
                      styles.notifCard,
                      {
                        backgroundColor: isSelected ? "#e0e7ff" : item.isRead ? "#f8fafc" : "#f5f3ff",
                        borderColor: isSelected ? "#4f46e5" : item.isRead ? "#e2e8f0" : "#c4b5fd",
                        opacity: pressed ? 0.75 : 1,
                      },
                    ]}
                  >
                    {selectionMode && (
                      <View style={{ marginRight: 12 }}>
                        <Ionicons
                          name={isSelected ? "checkbox" : "square-outline"}
                          size={20}
                          color={isSelected ? "#7c3aed" : "#94a3b8"}
                        />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <View style={styles.cardHeader}>
                        <Text style={styles.cardTitle}>{item.title}</Text>
                        <Text style={styles.cardTime}>
                          {item.createdAt ? new Date(item.createdAt).toLocaleDateString([], { month: "short", day: "numeric" }) : ""}
                        </Text>
                      </View>
                      <Text style={styles.cardBody}>{item.body}</Text>
                    </View>
                    {!selectionMode && (
                      <Pressable
                        onPress={() => confirmDeleteNotification(item._id)}
                        hitSlop={8}
                        style={{ padding: 6, marginLeft: 8 }}
                      >
                        <Ionicons name="trash-outline" size={17} color="#94a3b8" />
                      </Pressable>
                    )}
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "80%",
    paddingBottom: 20,
  },
  modalSheetHeader: {
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  leftRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  rightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  modalSheetTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
  },
  selectBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
  },
  selectBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#475569",
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fee2e2",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  clearBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#dc2626",
  },
  scrollList: {
    maxHeight: 400,
    paddingHorizontal: 18,
    marginTop: 10,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#334155",
    marginTop: 12,
  },
  emptySub: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
    marginTop: 4,
    lineHeight: 18,
    paddingHorizontal: 20,
  },
  notifCard: {
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0f172a",
    flex: 1,
    marginRight: 8,
  },
  cardTime: {
    fontSize: 10,
    color: "#94a3b8",
    fontWeight: "600",
  },
  cardBody: {
    fontSize: 12,
    color: "#475569",
    lineHeight: 17,
  },
  closeBtn: {
    marginHorizontal: 18,
    marginTop: 14,
    backgroundColor: "#f1f5f9",
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  closeBtnText: {
    fontWeight: "800",
    color: "#475569",
    fontSize: 13.5,
  },
});

export function NotificationBell({
  color = "#0f172a",
  size = 24,
  badgeColor = "#ef4444",
  style,
  badgeStyle,
}) {
  const { user } = useAuth();
  const [modalVisible, setModalVisible] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnread = useCallback(async () => {
    if (!user?._id && !user?.id) {
      setUnreadCount(0);
      return;
    }
    try {
      const res = await api.get("/auth/notifications");
      setUnreadCount(res.data?.unreadCount || 0);
    } catch (e) {
      // ignore
    }
  }, [user?._id, user?.id]);

  useEffect(() => {
    fetchUnread();
  }, [fetchUnread]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handleUpdate = () => {
      fetchUnread();
    };
    socket.on("notification", handleUpdate);
    socket.on("notificationReceived", handleUpdate);
    socket.on("turnUpcoming", handleUpdate);
    socket.on("bookingUpdated", handleUpdate);
    socket.on("queueUpdated", handleUpdate);
    return () => {
      socket.off("notification", handleUpdate);
      socket.off("notificationReceived", handleUpdate);
      socket.off("turnUpcoming", handleUpdate);
      socket.off("bookingUpdated", handleUpdate);
      socket.off("queueUpdated", handleUpdate);
    };
  }, [fetchUnread]);

  return (
    <>
      <Pressable
        style={({ pressed }) => [
          { position: "relative", justifyContent: "center", alignItems: "center" },
          style,
          pressed && { opacity: 0.7 },
        ]}
        onPress={() => setModalVisible(true)}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Ionicons name="notifications-outline" size={size} color={color} />
        {unreadCount > 0 && (
          <View
            style={[
              {
                position: "absolute",
                top: -2,
                right: -4,
                backgroundColor: badgeColor,
                minWidth: 16,
                height: 16,
                borderRadius: 8,
                justifyContent: "center",
                alignItems: "center",
                paddingHorizontal: 3,
                borderWidth: 1.5,
                borderColor: "#ffffff",
              },
              badgeStyle,
            ]}
          >
            <Text
              style={{
                color: "#ffffff",
                fontSize: 9,
                fontWeight: "800",
                textAlign: "center",
                lineHeight: 11,
              }}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Text>
          </View>
        )}
      </Pressable>

      <NotificationModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onUnreadCountChange={setUnreadCount}
      />
    </>
  );
}

export default NotificationModal;
