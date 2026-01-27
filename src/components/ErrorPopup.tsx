"use client";

import React, { useEffect } from "react";

export default function ErrorPopup({
  open,
  message,
  onClose,
}: {
  open: boolean;
  message: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.35)",
          zIndex: 120,
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: "fixed",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 121,
          width: "min(360px, calc(100vw - 32px))",
          background: "#fff",
          borderRadius: 14,
          border: "1px solid #e5e5e5",
          boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
          padding: 14,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 8 }}>안내</div>
        <div style={{ fontSize: 13, lineHeight: 1.5, color: "#333", whiteSpace: "pre-wrap" }}>
          {message}
        </div>

        <div style={{ display: "flex", marginTop: 14 }}>
          <button
            onClick={onClose}
            style={{
              marginLeft: "auto",
              border: "1px solid #111827",
              background: "#111827",
              color: "#fff",
              borderRadius: 10,
              padding: "8px 12px",
              fontSize: 13,
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            확인
          </button>
        </div>
      </div>
    </>
  );
}
