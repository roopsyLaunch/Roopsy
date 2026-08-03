import { api, getStoredToken } from "./client";
import { Platform } from "react-native";

export async function uploadImageAsync(imageUri) {
  try {
    const filename = imageUri.split("/").pop();
    const match = /\.(\w+)$/.exec(filename);
    let type = match ? `image/${match[1]}` : `image/jpeg`;
    if (type === "image/jpg") type = "image/jpeg";

    const formData = new FormData();
    formData.append("image", {
      uri: Platform.OS === "ios" ? imageUri.replace("file://", "") : imageUri,
      name: filename,
      type,
    });

    const token = await getStoredToken();
    const url = `${api.defaults.baseURL}/upload`;

    const res = await fetch(url, {
      method: "POST",
      body: formData,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Upload failed with status: ${res.status}`);
    }

    const data = await res.json();
    return data.url;
  } catch (err) {
    console.error("Image upload failed:", err);
    throw err;
  }
}
