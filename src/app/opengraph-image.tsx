import { ImageResponse } from "next/og";
import { formatPrice } from "@/lib/format";
import { getSiteChrome } from "@/lib/storefront";

/** Default share image (links to pages without their own photo, e.g. New In, Sale), from Site settings. */

export const alt = "Shop";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const { storeName, tagline, freeShippingThreshold } = (await getSiteChrome()).settings;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#141217",
          color: "#f7f3ee",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 120, fontWeight: 900, letterSpacing: -4 }}>{storeName.toUpperCase()}</div>
        {tagline && (
          <div style={{ marginTop: 16, fontSize: 36, color: "#c9a961", letterSpacing: 8 }}>{tagline.toUpperCase()}</div>
        )}
        {freeShippingThreshold !== null && (
          <div style={{ marginTop: 48, fontSize: 28, opacity: 0.7 }}>
            {`Free shipping over ${formatPrice(freeShippingThreshold)}`}
          </div>
        )}
      </div>
    ),
    size,
  );
}
