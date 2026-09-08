import * as ImagePicker from "expo-image-picker";

export interface CapturedImage {
  uri: string;
  name: string;
  type: string;
}

/** Open the camera and return a normalized file descriptor, or null if the
 *  user cancels / denies permission. */
export async function capturePhoto(): Promise<CapturedImage | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;
  const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    name: asset.fileName ?? `capture-${Date.now()}.jpg`,
    type: asset.mimeType ?? "image/jpeg",
  };
}

export interface DocumentUploadFields {
  name: string;
  matterId: string;
  category: string;
}
