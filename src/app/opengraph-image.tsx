import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { BRAND_LOGO_STACKED, BRAND_TEAL } from "@/lib/brand";
import { formatPrice } from "@/lib/format";
import { getSiteChrome } from "@/lib/storefront";

/** Default share image (links to pages without their own photo, e.g. New In, Sale): the logo plus text from Site settings. */

export const alt = "Aussient";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The logo doesn't change between requests, so it's read once.
const logoSrc = `data:image/png;base64,${await readFile(join(process.cwd(), "public", BRAND_LOGO_STACKED.src), "base64")}`;
const LOGO_HEIGHT = 300;

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
          background: BRAND_TEAL,
          color: "#f7f3ee",
          fontFamily: "sans-serif",
        }}
      >
        <img
          src={logoSrc}
          alt={storeName}
          height={LOGO_HEIGHT}
          width={Math.round((LOGO_HEIGHT * BRAND_LOGO_STACKED.width) / BRAND_LOGO_STACKED.height)}
        />
        {tagline && (
          <div style={{ marginTop: 28, fontSize: 34, color: "#f7f3ee", letterSpacing: 8 }}>{tagline.toUpperCase()}</div>
        )}
        {freeShippingThreshold !== null && (
          <div style={{ marginTop: 24, fontSize: 26, opacity: 0.75 }}>
            {`Free shipping over ${formatPrice(freeShippingThreshold)}`}
          </div>
        )}
      </div>
    ),
    size,
  );
}
