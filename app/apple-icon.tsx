import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
        }}
      >
        {/* Dumbbell */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {/* Left weight plate */}
          <div
            style={{
              width: 40,
              height: 90,
              background: "#71717a",
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 14,
                height: 60,
                background: "#52525b",
                borderRadius: 5,
              }}
            />
          </div>

          {/* Bar */}
          <div
            style={{
              width: 60,
              height: 22,
              background: "#d4d4d8",
              borderRadius: 6,
            }}
          />

          {/* Right weight plate */}
          <div
            style={{
              width: 40,
              height: 90,
              background: "#71717a",
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 14,
                height: 60,
                background: "#52525b",
                borderRadius: 5,
              }}
            />
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
