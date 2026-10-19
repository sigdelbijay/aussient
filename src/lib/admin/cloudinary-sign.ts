import { createHash } from "node:crypto";

/** Cloudinary's signature: SHA-1 of the sorted "key=value" params joined by &, plus the secret. */
export function signParams(params: Record<string, unknown>, apiSecret: string) {
  const toSign = Object.keys(params)
    .filter((k) => !["file", "cloud_name", "resource_type", "api_key"].includes(k))
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== "")
    .sort()
    .map((k) => `${k}=${Array.isArray(params[k]) ? (params[k] as unknown[]).join(",") : String(params[k])}`)
    .join("&");
  return createHash("sha1").update(toSign + apiSecret).digest("hex");
}
