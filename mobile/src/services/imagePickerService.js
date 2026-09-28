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
