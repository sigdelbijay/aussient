import "server-only";
import { signParams } from "./cloudinary-sign";

/**
 * Cloudinary helpers. The API secret never leaves the server: the browser's
 * Upload Widget asks us to sign each upload (see signUploadAction).
 */

export { signParams };

export const MEDIA_FOLDER = "aussient";

export function cloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret };
}

export type CloudinaryAsset = {
  publicId: string;
  url: string;
  type: "image" | "video";
  format: string;
  bytes: number;
  width: number | null;
  height: number | null;
  createdAt: string;
};

/** Lists uploads in our folder via the Admin API (newest first, one page). */
export async function listAssets(
  type: "image" | "video",
  cursor?: string,
): Promise<{ assets: CloudinaryAsset[]; next: string | null }> {
  const config = cloudinaryConfig();
  if (!config) return { assets: [], next: null };

  const url = new URL(`https://api.cloudinary.com/v1_1/${config.cloudName}/resources/${type}/upload`);
  url.searchParams.set("prefix", `${MEDIA_FOLDER}/`);
  url.searchParams.set("max_results", "60");
  url.searchParams.set("direction", "desc");
  if (cursor) url.searchParams.set("next_cursor", cursor);

  const res = await fetch(url, {
    headers: { Authorization: `Basic ${Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString("base64")}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Cloudinary list failed (${res.status})`);
  const data = (await res.json()) as {
    resources: {
      public_id: string;
      secure_url: string;
      format: string;
      bytes: number;
      width?: number;
      height?: number;
      created_at: string;
    }[];
    next_cursor?: string;
  };
  return {
    assets: data.resources.map((r) => ({
      publicId: r.public_id,
      url: r.secure_url,
      type,
      format: r.format,
      bytes: r.bytes,
      width: r.width ?? null,
      height: r.height ?? null,
      createdAt: r.created_at,
    })),
    next: data.next_cursor ?? null,
  };
}
