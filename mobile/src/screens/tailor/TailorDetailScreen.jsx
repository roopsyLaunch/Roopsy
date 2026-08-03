import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Image, ScrollView, ActivityIndicator, Pressable, Linking, Dimensions, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const SALON_FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1598522325754-046dd13ac1c0?w=800&q=80",
];

export function TailorDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { favorites, toggleFavorite } = useAuth();
  const { tailorId, shopName } = route.params || {};
  
  const [tailor, setTailor] = useState(null);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedServices, setSelectedServices] = useState([]);
  const [activeSlide, setActiveSlide] = useState(0);
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [zoomModalVisible, setZoomModalVisible] = useState(false);
  const [zoomImageUrl, setZoomImageUrl] = useState("");

  const normalServices = React.useMemo(() => {
    return services.filter(s => s.serviceMode !== "premium");
  }, [services]);

  const premiumServices = React.useMemo(() => {
    return services.filter(s => s.serviceMode === "premium");
  }, [services]);

  const groupedNormalServices = React.useMemo(() => {
    return normalServices.reduce((acc, s) => {
      const cat = s.category || "Other Services";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(s);
      return acc;
    }, {});
  }, [normalServices]);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    (async () => {
      try {
        const [tailorRes, servicesRes] = await Promise.all([
          api.get(`/tailors/${tailorId}`),
          api.get(`/tailors/${tailorId}/services`)
        ]);
        setTailor(tailorRes.data.tailor);
        setServices(servicesRes.data.services || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [tailorId]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0d9488" />
      </View>
    );
  }

  if (!tailor) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Tailor not found</Text>
      </View>
    );
  }

  const toggleService = (svc) => {
    setSelectedServices(prev => {
      if (prev.find(s => s._id === svc._id)) {
        return prev.filter(s => s._id !== svc._id);
      }
      return [...prev, svc];
    });
  };

  const handleProceed = () => {
    navigation.navigate("TailorServiceMode", { 
      tailor, 
      services: selectedServices 
    });
  };

  function openMap() {
    if (tailor.location?.lat != null && tailor.location?.lng != null) {
      const q = `${tailor.location.lat},${tailor.location.lng}`;
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`);
    }
  }

  const heroImages = [];
  if (tailor.shopPosterUrl) heroImages.push(tailor.shopPosterUrl);
  if (tailor.gallery && tailor.gallery.length > 0) heroImages.push(...tailor.gallery);
  if (heroImages.length === 0) heroImages.push(SALON_FALLBACK_IMAGES[0]);

  const screenWidth = Dimensions.get("window").width;
  const addr = tailor.address || {};

  return (
    <View style={styles.mainWrapper}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Parallax Hero Header */}
        <View style={styles.heroContainer}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => {
              const slide = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
              setActiveSlide(slide);
            }}
            scrollEventThrottle={16}
          >
            {heroImages.map((img, i) => (
              <Pressable key={i} onPress={() => { setZoomImageUrl(img); setZoomModalVisible(true); }}>
                <Image 
                  source={{ uri: img }} 
                  style={[styles.heroImage, { width: screenWidth }]} 
                  resizeMode="contain"
                />
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.heroOverlay} pointerEvents="none" />
          
          {/* Pagination Dots */}
          {heroImages.length > 1 && (
            <View style={styles.paginationContainer} pointerEvents="none">
              {heroImages.map((_, i) => (
                <View key={i} style={[styles.dot, activeSlide === i ? styles.activeDot : null]} />
              ))}
            </View>
          )}
          
          {/* Custom Nav Bar */}
          <View style={[styles.navBar, { top: Math.max(insets.top, 20) }]}>
            <Pressable style={styles.navBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={24} color="#0f172a" />
            </Pressable>
            <Pressable style={styles.navBtn} onPress={() => toggleFavorite(tailorId)}>
              <Ionicons name={favorites.includes(tailorId) ? "heart" : "heart-outline"} size={24} color={favorites.includes(tailorId) ? "#ef4444" : "#0f172a"} />
            </Pressable>
          </View>
        </View>

        {/* Info Card (Pulls up over the image) */}
        <View style={styles.infoSheet}>
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.shopTitle}>{tailor.shopName || shopName || "Premium Tailor"}</Text>
              <Text style={styles.shopCategory}>{tailor.specialties?.join(", ") || "Custom Stitching"}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.metaInfoRow}>
            <View style={styles.metaItem}>
              <Ionicons name="time" size={20} color="#0d9488" />
              <View style={styles.metaTextCol}>
                <Text style={styles.metaLabel}>Status</Text>
                <Text style={[styles.metaValue, { color: tailor.isShopOpen ? "#16a34a" : "#ef4444" }]}>
                  {tailor.isShopOpen ? "Open Now" : "Closed"}
                </Text>
              </View>
            </View>
            
            <View style={styles.metaItem}>
              <Ionicons name="person" size={20} color="#0d9488" />
              <View style={styles.metaTextCol}>
                <Text style={styles.metaLabel}>Tailor</Text>
                <Text style={styles.metaValue}>{tailor.ownerName || "Expert Tailor"}</Text>
              </View>
            </View>
          </View>

          {(addr.line1 || addr.city) && (
            <Pressable onPress={openMap} style={styles.locationBox}>
              <View style={styles.locIconWrap}>
                <Ionicons name="location" size={20} color="#0d9488" />
              </View>
              <View style={styles.locTextWrap}>
                <Text style={styles.locTitle}>Shop Location</Text>
                <Text style={styles.locAddress}>{[addr.line1, addr.city, addr.pincode].filter(Boolean).join(", ")}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
            </Pressable>
          )}

          {tailor.bio && (
            <View style={styles.aboutSection}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.bioText}>{tailor.bio}</Text>
            </View>
          )}

          {/* Services Selection (FIRST) */}
          <View style={styles.servicesSection}>
            <Text style={styles.sectionTitle}>Tailoring Services</Text>
            {services.length === 0 ? (
              <View style={styles.warningBox}>
                <Ionicons name="alert-circle" size={20} color="#b45309" />
                <Text style={styles.warningText}>No services available for this tailor.</Text>
              </View>
            ) : (
              <>
                {/* 1. Premium VIP Services Accordion (Rendered at top if there are any premium services) */}
                {premiumServices.length > 0 && (() => {
                  const isExpanded = collapsedCategories["Premium VIP Services"] !== true;
                  return (
                    <View style={{ marginBottom: 16, backgroundColor: "#faf5ff", borderRadius: 16, borderWidth: 1.5, borderColor: "#d8b4fe", overflow: "hidden" }}>
                      <Pressable
                        style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f3e8ff", paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: isExpanded ? 1 : 0, borderBottomColor: "#d8b4fe" }}
                        onPress={() => {
                          setCollapsedCategories(prev => ({
                            ...prev,
                            "Premium VIP Services": isExpanded
                          }));
                        }}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                          <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: "#7c3aed", justifyContent: "center", alignItems: "center" }}>
                            <Ionicons name="ribbon" size={16} color="#ffffff" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 15, fontWeight: "900", color: "#6b21a8" }}>👑 Premium VIP Services</Text>
                            <Text style={{ fontSize: 12, color: "#7c3aed", fontWeight: "700", marginTop: 1 }}>{premiumServices.length} Express VIP Options</Text>
                          </View>
                        </View>
                        <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color="#6b21a8" />
                      </Pressable>

                      {isExpanded && (
                        <View style={{ padding: 12 }}>
                          {premiumServices.map((s) => {
                            const isSelected = !!selectedServices.find(svc => svc._id === s._id);
                            return (
                              <Pressable
                                key={s._id}
                                style={[
                                  styles.serviceCard, 
                                  isSelected && styles.serviceCardActive,
                                  isSelected && { borderColor: "#7c3aed", backgroundColor: "#faf5ff" }
                                ]}
                                onPress={() => toggleService(s)}
                              >
                                <View style={styles.serviceMainRow}>
                                  <View style={[styles.svcIconBox, isSelected && { backgroundColor: "#f3e8ff" }]}>
                                    <Ionicons name="shirt" size={20} color={isSelected ? "#7c3aed" : "#64748b"} />
                                  </View>
                                  <View style={styles.svcInfo}>
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                      <Text style={[styles.svcName, isSelected && { color: "#7c3aed" }]}>{s.name}</Text>
                                      <View style={{ backgroundColor: "#7c3aed", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                                        <Text style={{ fontSize: 9, fontWeight: "900", color: "#ffffff" }}>VIP EXPRESS</Text>
                                      </View>
                                    </View>
                                  </View>
                                  <View style={styles.svcPriceBox}>
                                    <Text style={[styles.svcPrice, isSelected && { color: "#7c3aed" }]}>₹{s.price}</Text>
                                    <View style={[styles.radioCircle, isSelected && { borderColor: "#7c3aed" }]}>
                                      {isSelected && <View style={[styles.radioDot, { backgroundColor: "#7c3aed" }]} />}
                                    </View>
                                  </View>
                                </View>
                              </Pressable>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  );
                })()}

                {/* 2. Normal Stitching Services Categories */}
                {Object.keys(groupedNormalServices).map(category => {
                  const categoryList = groupedNormalServices[category];
                  const isExpanded = collapsedCategories[category] !== true;

                  return (
                    <View key={category} style={{ marginBottom: 16, backgroundColor: "#ffffff", borderRadius: 16, borderWidth: 1, borderColor: "#e2e8f0", overflow: "hidden" }}>
                      <Pressable
                        style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f8fafc", paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: isExpanded ? 1 : 0, borderBottomColor: "#e2e8f0" }}
                        onPress={() => {
                          setCollapsedCategories(prev => ({
                            ...prev,
                            [category]: isExpanded
                          }));
                        }}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                          <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: "#e6f7f2", justifyContent: "center", alignItems: "center" }}>
                            <Ionicons name="cut" size={16} color="#0d9488" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 15, fontWeight: "800", color: "#0f172a" }}>{category}</Text>
                            <Text style={{ fontSize: 12, color: "#64748b", marginTop: 1 }}>{categoryList.length} Options</Text>
                          </View>
                        </View>
                        <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color="#0f172a" />
                      </Pressable>

                      {isExpanded && (
                        <View style={{ padding: 12 }}>
                          {categoryList.map((s) => {
                            const isSelected = !!selectedServices.find(svc => svc._id === s._id);
                            return (
                              <Pressable
                                key={s._id}
                                style={[styles.serviceCard, isSelected && styles.serviceCardActive]}
                                onPress={() => toggleService(s)}
                              >
                                <View style={styles.serviceMainRow}>
                                  <View style={styles.svcIconBox}>
                                    <Ionicons name="shirt" size={20} color={isSelected ? "#0d9488" : "#64748b"} />
                                  </View>
                                  <View style={styles.svcInfo}>
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                      <Text style={[styles.svcName, isSelected && styles.svcNameActive]}>{s.name}</Text>
                                    </View>
                                  </View>
                                  <View style={styles.svcPriceBox}>
                                    <Text style={[styles.svcPrice, isSelected && styles.svcPriceActive]}>₹{s.price}</Text>
                                    <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                                      {isSelected && <View style={styles.radioDot} />}
                                    </View>
                                  </View>
                                </View>
                              </Pressable>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  );
                })}
              </>
            )}
          </View>

          {/* Working Hours (BELOW SERVICES) */}
          {tailor.workingHours && (
            <View style={styles.workingHoursSection}>
              <Text style={styles.sectionTitle}>Working Hours</Text>
              <View style={styles.workingHoursCard}>
                {["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map(day => {
                  const dayData = tailor.workingHours[day];
                  if (!dayData) return null;
                  const dayName = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" }[day];
                  
                  const formatTime = (timeStr) => {
                    if (!timeStr) return "";
                    const [h, m] = timeStr.split(":");
                    const hour = parseInt(h, 10);
                    const ampm = hour >= 12 ? "PM" : "AM";
                    const formattedHour = hour % 12 || 12;
                    return `${formattedHour}:${m} ${ampm}`;
                  };

                  return (
                    <View key={day} style={styles.whRow}>
                      <Text style={styles.whDay}>{dayName}</Text>
                      <Text style={[styles.whTime, dayData.isClosed && styles.whClosed]}>
                        {dayData.isClosed ? "Closed" : `${formatTime(dayData.open)} - ${formatTime(dayData.close)}`}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Floating Bottom Bar for Booking */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <View style={styles.bottomSummary}>
          {selectedServices.length > 0 ? (
            <View>
              <Text style={styles.summaryLabel}>{selectedServices.length} Items Selected</Text>
              <Text style={[styles.summaryPrice, { fontSize: 18 }]}>
                Total Price: ₹{selectedServices.reduce((acc, s) => acc + s.price, 0)}
              </Text>
            </View>
          ) : (
            <View>
              <Text style={styles.summaryLabel}>0 Items Selected</Text>
              <Text style={styles.summaryPrice}>₹0</Text>
            </View>
          )}
        </View>
        <Pressable 
          style={[styles.bookBtn, selectedServices.length === 0 && styles.bookBtnDisabled]}
          disabled={selectedServices.length === 0}
          onPress={handleProceed}
        >
          <Text style={styles.bookBtnText}>Place Order</Text>
        </Pressable>
      </View>

      {/* Zoomable Image Viewer Modal */}
      <Modal
        visible={zoomModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setZoomModalVisible(false)}
      >
        <View style={styles.zoomModalBg}>
          <Pressable style={styles.zoomCloseBtn} onPress={() => setZoomModalVisible(false)}>
            <Ionicons name="close" size={28} color="#ffffff" />
          </Pressable>
          <ScrollView
            minimumZoomScale={1}
            maximumZoomScale={5}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.zoomScrollContent}
          >
            <Image source={{ uri: zoomImageUrl }} style={styles.zoomImage} resizeMode="contain" />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  mainWrapper: { flex: 1, backgroundColor: "#ffffff" },
  container: { flex: 1, backgroundColor: "#ffffff" },
  scrollContent: { paddingBottom: 120 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#ffffff" },
  errorText: { fontSize: 16, color: "#64748b" },
  
  heroContainer: { width: "100%", height: 320, position: "relative", backgroundColor: "#0f172a" },
  heroImage: { width: "100%", height: "100%", resizeMode: "contain" },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.15)" },
  zoomModalBg: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  zoomCloseBtn: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 999,
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 25,
  },
  zoomScrollContent: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100%",
  },
  zoomImage: {
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height * 0.75,
  },
  paginationContainer: {
    position: "absolute",
    bottom: 40,
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(255, 255, 255, 0.5)" },
  activeDot: { width: 20, backgroundColor: "#ffffff" },
  
  navBar: {
    position: "absolute",
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  navBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.9)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },

  infoSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -40,
    paddingHorizontal: 24,
    paddingTop: 30,
  },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  shopTitle: { fontSize: 26, fontWeight: "900", color: "#0f172a", marginBottom: 4 },
  shopCategory: { fontSize: 14, fontWeight: "600", color: "#0d9488" },

  divider: { height: 1, backgroundColor: "#f1f5f9", marginVertical: 20 },

  metaInfoRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  metaItem: { flexDirection: "row", alignItems: "center", flex: 1 },
  metaTextCol: { marginLeft: 10 },
  metaLabel: { fontSize: 12, color: "#64748b", fontWeight: "600" },
  metaValue: { fontSize: 14, color: "#0f172a", fontWeight: "700", marginTop: 2 },

  locationBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#f8fafc", padding: 16, borderRadius: 20, marginBottom: 24, borderWidth: 1, borderColor: "#f1f5f9" },
  locIconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#e6f7f2", justifyContent: "center", alignItems: "center" },
  locTextWrap: { flex: 1, marginHorizontal: 12 },
  locTitle: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  locAddress: { fontSize: 13, color: "#64748b", marginTop: 2, lineHeight: 18 },

  aboutSection: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: "#0f172a", marginBottom: 16 },
  bioText: { fontSize: 14, color: "#475569", lineHeight: 22 },

  workingHoursSection: { marginBottom: 24 },
  workingHoursCard: { backgroundColor: "#f8fafc", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#f1f5f9" },
  whRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  whDay: { fontSize: 14, color: "#334155", fontWeight: "600", textTransform: "capitalize" },
  whTime: { fontSize: 14, color: "#0f172a", fontWeight: "700" },
  whClosed: { color: "#ef4444" },

  servicesSection: { marginBottom: 24 },
  serviceCard: { padding: 16, borderRadius: 20, backgroundColor: "#ffffff", borderWidth: 2, borderColor: "#f1f5f9", marginBottom: 12 },
  serviceCardActive: { borderColor: "#0d9488", backgroundColor: "#f0fdf4" },
  serviceMainRow: { flexDirection: "row", alignItems: "center" },
  svcIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#f1f5f9", justifyContent: "center", alignItems: "center" },
  svcInfo: { flex: 1, marginLeft: 12 },
  svcName: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  svcNameActive: { color: "#0d9488" },
  svcMeta: { fontSize: 13, color: "#64748b", marginTop: 4 },
  svcPriceBox: { alignItems: "flex-end" },
  svcPrice: { fontSize: 16, fontWeight: "800", color: "#0f172a", marginBottom: 6 },
  svcPriceActive: { color: "#0d9488" },
  radioCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: "#cbd5e1", justifyContent: "center", alignItems: "center" },
  radioCircleActive: { borderColor: "#0d9488" },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#0d9488" },
  
  warningBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#fef3c7", padding: 16, borderRadius: 16 },
  warningText: { fontSize: 13, color: "#92400e", flex: 1, marginLeft: 10, lineHeight: 20 },

  bottomBar: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 10,
  },
  bottomSummary: { flex: 1 },
  summaryLabel: { fontSize: 12, color: "#64748b", fontWeight: "600" },
  summaryPrice: { fontSize: 22, fontWeight: "900", color: "#0f172a", marginTop: 2 },
  
  bookBtn: { flex: 1.5, backgroundColor: "#0d9488", height: 56, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  bookBtnDisabled: { backgroundColor: "#cbd5e1" },
  bookBtnText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
});
