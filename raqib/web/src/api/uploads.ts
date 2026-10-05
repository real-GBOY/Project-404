import { putWithProgress } from "@/services/upload";
import { evidenceApi } from "./resources/evidence";

/**
 * Put a file into private storage: presign, send the bytes straight to the target with progress, confirm it landed.
 * Resolves with the stored file's id, which the caller then links to a record (evidence, a confidential report).
 */
export async function uploadToStorage(
  file: File,
  onProgress: (pct: number) => void,
): Promise<string> {
  const p = await evidenceApi.presign({ name: file.name, type: file.type, size: file.size });
  await putWithProgress(file, p.upload, onProgress);
  await evidenceApi.confirm(p.fileId);
  return p.fileId;
}
