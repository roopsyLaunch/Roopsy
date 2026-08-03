import React, { useRef, useEffect } from "react";
import { StyleSheet, View, Platform, Text } from "react-native";
import WebView from "react-native-webview";

export default function LeafletMap({
  lat = 26.8467,
  lng = 80.9462,
  zoom = 15,
  onLocationSelect,
  readOnly = false,
  shopTitle = "",
}) {
  const webViewRef = useRef(null);

  // Update map position when lat/lng props change
  useEffect(() => {
    if (webViewRef.current && lat && lng) {
      const script = `
        if (window.updateMapPosition) {
          window.updateMapPosition(${lat}, ${lng}, ${zoom});
        }
        true;
      `;
      if (Platform.OS === "web") {
        try {
          webViewRef.current.contentWindow?.postMessage(
            JSON.stringify({ type: "UPDATE_POS", lat, lng, zoom }),
            "*"
          );
        } catch (e) {
          console.log("Web postMessage error:", e);
        }
      } else {
        webViewRef.current.injectJavaScript(script);
      }
    }
  }, [lat, lng, zoom]);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
      <style>
        html, body, #map {
          height: 100%;
          width: 100%;
          margin: 0;
          padding: 0;
          background: #f8fafc;
        }
        .leaflet-container {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        .custom-pin {
          background-color: #7c3aed;
          width: 24px;
          height: 24px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          border: 3px solid #ffffff;
          box-shadow: 0 4px 12px rgba(124, 58, 237, 0.4);
          margin-top: -12px;
          margin-left: -12px;
        }
        .custom-pin::after {
          content: '';
          width: 8px;
          height: 8px;
          margin: 5px 0 0 5px;
          background: #ffffff;
          position: absolute;
          border-radius: 50%;
        }
        .leaflet-popup-content-wrapper {
          border-radius: 12px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
          padding: 4px;
        }
        .popup-title {
          font-weight: 700;
          color: #1e1b4b;
          font-size: 14px;
          margin: 0;
          padding: 4px;
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map', {
          zoomControl: false
        }).setView([${lat}, ${lng}], ${zoom});

        L.control.zoom({ position: 'bottomright' }).addTo(map);

        // OpenStreetMap Standard Tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        var customIcon = L.divIcon({
          className: 'custom-pin',
          iconSize: [24, 24],
          iconAnchor: [12, 24],
          popupAnchor: [0, -24]
        });

        var marker = L.marker([${lat}, ${lng}], {
          icon: customIcon,
          draggable: ${!readOnly}
        }).addTo(map);

        ${shopTitle ? `marker.bindPopup('<h4 class="popup-title">${shopTitle}</h4>').openPopup();` : ""}

        function sendMsg(type, payload) {
          var data = Object.assign({ type: type }, payload);
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify(data));
          } else if (window.parent) {
            window.parent.postMessage(JSON.stringify(data), "*");
          }
        }

        ${
          !readOnly
            ? `
          map.on('click', function(e) {
            var newLat = e.latlng.lat;
            var newLng = e.latlng.lng;
            marker.setLatLng([newLat, newLng]);
            sendMsg('MAP_CLICK', { lat: newLat, lng: newLng });
          });

          marker.on('dragend', function(e) {
            var position = marker.getLatLng();
            sendMsg('MAP_DRAG_END', { lat: position.lat, lng: position.lng });
          });
        `
            : ""
        }

        window.updateMapPosition = function(newLat, newLng, newZoom) {
          map.flyTo([newLat, newLng], newZoom || ${zoom}, {
            duration: 1.2
          });
          marker.setLatLng([newLat, newLng]);
        };

        window.addEventListener('message', function(event) {
          try {
            var data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
            if (data.type === 'UPDATE_POS') {
              window.updateMapPosition(data.lat, data.lng, data.zoom);
            }
          } catch(e) {}
        });
      </script>
    </body>
    </html>
  `;

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if ((data.type === "MAP_CLICK" || data.type === "MAP_DRAG_END") && onLocationSelect) {
        onLocationSelect({ lat: data.lat, lng: data.lng });
      }
    } catch (e) {
      console.log("Error parsing map webview message:", e);
    }
  };

  if (Platform.OS === "web") {
    return (
      <View style={styles.container}>
        <iframe
          ref={webViewRef}
          srcDoc={htmlContent}
          style={{ width: "100%", height: "100%", border: "none" }}
          title="OpenStreetMap Leaflet"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        originWhitelist={["*"]}
        source={{ html: htmlContent }}
        onMessage={handleMessage}
        style={styles.webView}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        scrollEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#f1f5f9",
  },
  webView: {
    flex: 1,
    backgroundColor: "transparent",
  },
});
