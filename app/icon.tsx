import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#09090b",
          borderRadius: "7px",
        }}
      >
        {/* Miniature dumbbell */}
        <div style={{ display: "flex", alignItems: "center", gap: "1.5px" }}>
          {/* Left weight */}
          <div
            style={{
              width: 6,
              height: 22,
              background: "#71717a",
              borderRadius: 3,
            }}
          />
          {/* Bar */}
          <div
            style={{
              width: 11,
              height: 6,
              background: "#d4d4d8",
              borderRadius: 2,
            }}
          />
          {/* Right weight */}
          <div
            style={{
              width: 6,
              height: 22,
              background: "#71717a",
              borderRadius: 3,
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  );
}
