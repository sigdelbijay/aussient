"use client";

import { useRef, useState } from "react";
import Script from "next/script";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signUploadAction } from "@/lib/admin/product-actions";

export type CloudinaryPublic = { cloudName: string; apiKey: string } | null;
export type Uploaded = { url: string; type: "IMAGE" | "VIDEO" };

type WidgetResult = { event: string; info: { secure_url: string; resource_type: string } };
type Widget = { open: () => void; destroy: () => void };
declare global {
  interface Window {
    cloudinary?: {
      createUploadWidget: (
        options: Record<string, unknown>,
        callback: (error: unknown, result: WidgetResult) => void,
      ) => Widget;
    };
  }
}

/**
 * Opens Cloudinary's Upload Widget. Uploads are SIGNED: the widget asks our
 * server (signUploadAction) to sign each request, so the API secret never
 * reaches the browser. Calls `onUploaded` once with everything uploaded.
 */
export function UploadButton({
  config,
  folder,
  onUploaded,
  multiple = true,
  accept = "media",
  label = "Upload",
}: {
  config: CloudinaryPublic;
  /** Sub-folder inside the shop's Cloudinary folder, e.g. "products". */
  folder: string;
  onUploaded: (files: Uploaded[]) => void | Promise<void>;
  multiple?: boolean;
  accept?: "media" | "image";
  label?: string;
}) {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const batch = useRef<Uploaded[]>([]);

  if (!config) {
    return <p className="text-xs text-destructive">Add the CLOUDINARY_* settings to .env to upload photos.</p>;
  }

  async function flush() {
    const files = batch.current;
    batch.current = [];
    if (!files.length) return;
    setBusy(true);
    try {
      await onUploaded(files);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the upload.");
    } finally {
      setBusy(false);
    }
  }

  function open() {
    if (!window.cloudinary || !config) return;
    setError(null);
    const widget = window.cloudinary.createUploadWidget(
      {
        cloudName: config.cloudName,
        apiKey: config.apiKey,
        folder: `aussient/${folder}`,
        uploadSignature: (callback: (signature: string) => void, paramsToSign: Record<string, unknown>) => {
          signUploadAction(paramsToSign)
            .then(callback)
            .catch(() => setError("Couldn't authorise the upload — are you still signed in?"));
        },
        multiple,
        resourceType: accept === "image" ? "image" : "auto",
        sources: ["local", "url", "camera"],
        clientAllowedFormats:
          accept === "image" ? ["jpg", "jpeg", "png", "webp", "avif", "gif"] : ["jpg", "jpeg", "png", "webp", "avif", "gif", "mp4", "mov", "webm"],
        maxImageFileSize: 15_000_000,
        maxVideoFileSize: 100_000_000,
      },
      (err, result) => {
        if (err) setError("Upload failed — please try again.");
        if (result?.event === "success") {
          batch.current.push({
            url: result.info.secure_url,
            type: result.info.resource_type === "video" ? "VIDEO" : "IMAGE",
          });
        }
        // Save everything once the queue finishes (or the widget is closed).
        if (result?.event === "queues-end" || result?.event === "close") {
          void flush();
          if (result.event === "close") widget.destroy();
        }
      },
    );
    widget.open();
  }

  return (
    <div className="grid gap-1">
      {/* Cloudinary's widget script (their documented URL). */}
      <Script src="https://upload-widget.cloudinary.com/latest/global/all.js" onReady={() => setReady(true)} />
      <Button type="button" variant="outline" onClick={open} disabled={!ready || busy} className="h-9 gap-2 px-3">
        {busy || !ready ? <Loader2 className="animate-spin" /> : <Upload />}
        {busy ? "Saving…" : label}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
