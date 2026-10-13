import { ImageResponse } from "next/og";

/** Default share image (links to pages without their own photo, e.g. New In, Sale). */

export const alt = "Aussient — Fashion Jewellery";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
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
        <div style={{ fontSize: 120, fontWeight: 900, letterSpacing: -4 }}>AUSSIENT</div>
        <div style={{ marginTop: 16, fontSize: 36, color: "#c9a961", letterSpacing: 8 }}>
          FASHION JEWELLERY
        </div>
        <div style={{ marginTop: 48, fontSize: 28, opacity: 0.7 }}>
          New drops weekly · Free shipping over $50
        </div>
      </div>
    ),
    size,
  );
}
