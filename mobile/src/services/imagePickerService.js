import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";

/**
 * Prompts the partner to either upload the full uncropped image or crop the image.
 *
 * @param {Function} onImagePicked - Callback function with selected image URI
 */
export function promptServiceImagePicker(onImagePicked) {
  Alert.alert(
    "Service Photo",
    "Choose how you want to upload this photo:",
    [
      {
        text: "Full Photo (No Crop)",
        onPress: async () => {
          try {
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: false,
              quality: 0.9,
            });
            if (!result.canceled && result.assets?.[0]?.uri) {
              onImagePicked(result.assets[0].uri);
            }
          } catch (err) {
            console.error("Image pick error:", err);
            Alert.alert("Error", "Could not pick image.");
          }
        },
      },
      {
        text: "Crop Photo",
        onPress: async () => {
          try {
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              quality: 0.9,
            });
            if (!result.canceled && result.assets?.[0]?.uri) {
              onImagePicked(result.assets[0].uri);
            }
          } catch (err) {
            console.error("Image crop error:", err);
            Alert.alert("Error", "Could not crop image.");
          }
        },
      },
      {
        text: "Cancel",
        style: "cancel",
      },
    ]
  );
}

/**
 * Prompts user to click photo with Camera or pick from Gallery
 *
 * @param {Object} options
 * @param {string} options.title
 * @param {string} options.message
 * @returns {Promise<string|null>} Selected/captured image URI or null
 */
export async function pickOrCaptureImage({
  title = "Upload Photo",
  message = "Choose an option to upload photo:"
} = {}) {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        {
          text: "📷 Take Photo (Camera)",
          onPress: async () => {
            try {
              const { status } = await ImagePicker.requestCameraPermissionsAsync();
              if (status !== "granted") {
                Alert.alert("Permission Required", "Camera permission is required to click photo.");
                resolve(null);
                return;
              }
              const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                quality: 0.8,
              });
              if (!result.canceled && result.assets?.[0]?.uri) {
                resolve(result.assets[0].uri);
              } else {
                resolve(null);
              }
            } catch (err) {
              console.error("Camera capture error:", err);
              Alert.alert("Error", "Could not capture photo.");
              resolve(null);
            }
          }
        },
        {
          text: "🖼️ Choose from Gallery",
          onPress: async () => {
            try {
              const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (status !== "granted") {
                Alert.alert("Permission Required", "Gallery permission is required to choose photo.");
                resolve(null);
                return;
              }
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                quality: 0.8,
              });
              if (!result.canceled && result.assets?.[0]?.uri) {
                resolve(result.assets[0].uri);
              } else {
                resolve(null);
              }
            } catch (err) {
              console.error("Gallery pick error:", err);
              Alert.alert("Error", "Could not pick image.");
              resolve(null);
            }
          }
        },
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => resolve(null)
        }
      ]
    );
  });
}
