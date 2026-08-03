import * as Location from "expo-location";

const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org";

/**
 * Search locations using OpenStreetMap Nominatim API
 * @param {string} query Search string (e.g. "Hazratganj, Lucknow")
 * @returns {Promise<Array>} List of location objects
 */
export async function searchLocationsOSM(query) {
  if (!query || query.trim().length < 2) return [];
  try {
    const url = `${NOMINATIM_BASE_URL}/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=7&countrycodes=in`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "BarberApp/1.0 (LocationPicker; contact@barberapp.local)",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!response.ok) {
      throw new Error(`OSM search failed: ${response.status}`);
    }

    const data = await response.json();
    return data.map((item) => {
      const addr = item.address || {};
      const city =
        addr.city ||
        addr.town ||
        addr.village ||
        addr.suburb ||
        addr.county ||
        addr.state_district ||
        "";
      const state = addr.state || "";
      const pincode = addr.postcode || "";
      const name = item.display_name;

      return {
        id: item.place_id,
        displayName: name,
        shortName: item.name || city || name.split(",")[0],
        city,
        state,
        pincode,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        rawAddress: item.address,
      };
    });
  } catch (error) {
    console.error("Error searching locations with OSM:", error);
    return [];
  }
}

/**
 * Reverse geocode coordinates to get address using OpenStreetMap Nominatim API
 * @param {number} lat Latitude
 * @param {number} lng Longitude
 * @returns {Promise<Object>} Location object
 */
export async function reverseGeocodeOSM(lat, lng) {
  try {
    const url = `${NOMINATIM_BASE_URL}/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "BarberApp/1.0 (LocationPicker; contact@barberapp.local)",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!response.ok) {
      throw new Error(`OSM reverse geocode failed: ${response.status}`);
    }

    const item = await response.json();
    const addr = item.address || {};
    const city =
      addr.city ||
      addr.town ||
      addr.village ||
      addr.suburb ||
      addr.county ||
      addr.state_district ||
      "";
    const state = addr.state || "";
    const pincode = addr.postcode || "";
    const road = addr.road || addr.pedestrian || addr.suburb || addr.neighbourhood || "";
    const houseNumber = addr.house_number || addr.building || "";
    const line1 = [houseNumber, road, addr.suburb].filter(Boolean).join(", ") || city;

    return {
      id: item.place_id,
      displayName: item.display_name,
      shortName: line1 || city || item.display_name.split(",")[0],
      line1,
      city,
      state,
      pincode,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      rawAddress: addr,
    };
  } catch (error) {
    console.error("Error reverse geocoding with OSM:", error);
    return {
      displayName: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      shortName: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      line1: "",
      city: "",
      state: "",
      pincode: "",
      lat,
      lng,
    };
  }
}

/**
 * Get current device GPS location with address
 * @returns {Promise<Object>} Location object with lat, lng, and address details
 */
export async function getCurrentGPSLocation() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      throw new Error("Permission to access location was denied");
    }

    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const lat = loc.coords.latitude;
    const lng = loc.coords.longitude;

    // Use OSM Nominatim for rich address details
    const osmDetails = await reverseGeocodeOSM(lat, lng);
    return osmDetails;
  } catch (error) {
    console.error("Error getting GPS location:", error);
    throw error;
  }
}
