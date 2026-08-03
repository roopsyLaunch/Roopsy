import React, { useState, useEffect, useRef } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import LeafletMap from "./LeafletMap";
import {
  searchLocationsOSM,
  reverseGeocodeOSM,
  getCurrentGPSLocation,
} from "../services/locationService";

export default function LocationPickerModal({
  visible,
  onClose,
  onSelectLocation,
  initialCity = "Lucknow",
  initialAddress = "",
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isGettingGps, setIsGettingGps] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Selected Location State (Default: Lucknow, India)
  const [selectedLocation, setSelectedLocation] = useState({
    displayName: initialAddress || initialCity || "Lucknow, Uttar Pradesh, India",
    shortName: initialCity || "Lucknow",
    line1: initialAddress || "",
    city: initialCity || "Lucknow",
    state: "Uttar Pradesh",
    pincode: "",
    lat: 26.8467,
    lng: 80.9462,
  });

  const searchDebounceRef = useRef(null);

  useEffect(() => {
    if (visible) {
      setSearchQuery("");
      setSearchResults([]);
    }
  }, [visible]);

  // Handle Search Input Change with Debounce (300ms)
  const handleSearchTextChange = (text) => {
    setSearchQuery(text);
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    if (!text || text.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchDebounceRef.current = setTimeout(() => {
      handleSearch(text);
    }, 350);
  };

  const handleSearch = async (query) => {
    setIsSearching(true);
    try {
      const results = await searchLocationsOSM(query);
      setSearchResults(results);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  // Select item from autocomplete list
  const handleSelectSearchResult = (item) => {
    setSelectedLocation({
      displayName: item.displayName,
      shortName: item.shortName,
      line1: item.line1 || item.shortName,
      city: item.city || item.shortName,
      state: item.state,
      pincode: item.pincode,
      lat: item.lat,
      lng: item.lng,
    });
    setSearchResults([]);
    setSearchQuery("");
  };

  // When user taps on Leaflet Map pin point
  const handleMapPinSelect = async ({ lat, lng }) => {
    setIsGeocoding(true);
    try {
      const loc = await reverseGeocodeOSM(lat, lng);
      setSelectedLocation(loc);
    } catch (e) {
      console.error("Map pin reverse geocode failed", e);
    } finally {
      setIsGeocoding(false);
    }
  };

  // Click "Use Current Location" (GPS)
  const handleUseCurrentGPS = async () => {
    setIsGettingGps(true);
    try {
      const loc = await getCurrentGPSLocation();
      setSelectedLocation(loc);
      setSearchResults([]);
      setSearchQuery("");
    } catch (e) {
      Alert.alert(
        "Location Access",
        "Could not detect current GPS position. Please ensure location services are enabled."
      );
    } finally {
      setIsGettingGps(false);
    }
  };

  // Click "Confirm Location"
  const handleConfirm = () => {
    if (onSelectLocation) {
      onSelectLocation(selectedLocation);
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#334155" />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>Select Location</Text>
              <Text style={styles.headerSubtitle}>Powered by OpenStreetMap</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          {/* Search Box & GPS Button */}
          <View style={styles.searchSection}>
            <View style={styles.inputContainer}>
              <Ionicons name="search" size={20} color="#7c3aed" style={styles.searchIcon} />
              <TextInput
                style={styles.input}
                placeholder="Search area, city, landmark..."
                placeholderTextColor="#94a3b8"
                value={searchQuery}
                onChangeText={handleSearchTextChange}
              />
              {isSearching ? (
                <ActivityIndicator size="small" color="#7c3aed" />
              ) : searchQuery ? (
                <TouchableOpacity onPress={() => handleSearchTextChange("")}>
                  <Ionicons name="close-circle" size={18} color="#94a3b8" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* GPS Location Button */}
            <TouchableOpacity
              style={styles.gpsButton}
              onPress={handleUseCurrentGPS}
              disabled={isGettingGps}
              activeOpacity={0.7}
            >
              {isGettingGps ? (
                <ActivityIndicator size="small" color="#6d28d9" />
              ) : (
                <Ionicons name="navigate-circle" size={22} color="#6d28d9" style={{ marginRight: 6 }} />
              )}
              <Text style={styles.gpsButtonText}>
                {isGettingGps ? "Detecting GPS Position..." : "📍 Use Current GPS Location"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Search Results Dropdown List */}
          {searchResults.length > 0 && searchQuery.trim().length >= 2 ? (
            <View style={styles.searchResultsContainer}>
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.searchResultItem}
                    onPress={() => handleSelectSearchResult(item)}
                  >
                    <Ionicons name="location" size={18} color="#7c3aed" style={{ marginRight: 10 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.searchResultTitle} numberOfLines={1}>
                        {item.shortName}
                      </Text>
                      <Text style={styles.searchResultSub} numberOfLines={2}>
                        {item.displayName}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            </View>
          ) : null}

          {/* Leaflet + OpenStreetMap View */}
          <View style={styles.mapContainer}>
            <LeafletMap
              lat={selectedLocation.lat}
              lng={selectedLocation.lng}
              zoom={15}
              onLocationSelect={handleMapPinSelect}
            />
            {isGeocoding && (
              <View style={styles.geocodingBadge}>
                <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.geocodingBadgeText}>Updating location address...</Text>
              </View>
            )}
          </View>

          {/* Bottom Location Confirmation Card */}
          <View style={styles.bottomCard}>
            <View style={styles.selectedAddressRow}>
              <View style={styles.pinCircle}>
                <Ionicons name="location-sharp" size={22} color="#7c3aed" />
              </View>
              <View style={styles.addressTextContainer}>
                <Text style={styles.selectedCityText} numberOfLines={1}>
                  {selectedLocation.city || selectedLocation.shortName || "Lucknow"}
                </Text>
                <Text style={styles.selectedAddressFull} numberOfLines={2}>
                  {selectedLocation.displayName || `${selectedLocation.lat.toFixed(4)}, ${selectedLocation.lng.toFixed(4)}`}
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.confirmButtonTouchable} onPress={handleConfirm}>
              <LinearGradient
                colors={["#7c3aed", "#6d28d9"]}
                style={styles.confirmGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.confirmButtonText}>Confirm & Save Location</Text>
                <Ionicons name="checkmark-circle" size={20} color="#ffffff" style={{ marginLeft: 8 }} />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
  },
  headerTitleContainer: {
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: "500",
    color: "#64748b",
    marginTop: 2,
  },
  searchSection: {
    padding: 16,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: "#0f172a",
    paddingVertical: 0,
  },
  gpsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#f3e8ff",
    borderWidth: 1.5,
    borderColor: "#c4b5fd",
    borderRadius: 14,
    width: "100%",
  },
  gpsButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6d28d9",
  },
  searchResultsContainer: {
    position: "absolute",
    top: 135,
    left: 16,
    right: 16,
    zIndex: 999,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    maxHeight: 220,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  searchResultTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1e1b4b",
  },
  searchResultSub: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  mapContainer: {
    flex: 1,
    margin: 16,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  geocodingBadge: {
    position: "absolute",
    top: 12,
    alignSelf: "center",
    backgroundColor: "rgba(124, 58, 237, 0.9)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  geocodingBadgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
  bottomCard: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 10,
  },
  selectedAddressRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  pinCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f3e8ff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  addressTextContainer: {
    flex: 1,
  },
  selectedCityText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
  },
  selectedAddressFull: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
    lineHeight: 16,
  },
  confirmButtonTouchable: {
    borderRadius: 14,
    overflow: "hidden",
  },
  confirmGradient: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
  },
  confirmButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
});
