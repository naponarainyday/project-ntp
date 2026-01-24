"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";

type Props = {
  urls: Array<string | null | undefined>;
  startIndex: number;
  onClose: () => void;
  setIndex?: (i: number) => void;
};

export default function ReceiptLightbox({ urls, startIndex, onClose, setIndex }: Props) {
  const cleanUrls = useMemo(
    () => (urls ?? []).filter((u): u is string => !!u && typeof u === "string"),
    [urls]
  );

  const shouldOpen = cleanUrls.length > 0 && startIndex >= 0;
  const [idx, setIdx] = useState(startIndex);

  useEffect(() => {
    setIndex?.(idx);
  }, [idx, setIndex]);

  useEffect(() => {
    if (!shouldOpen) return;
    const safe = Math.min(Math.max(startIndex, 0), cleanUrls.length - 1);
    setIdx(safe);
  }, [shouldOpen, startIndex, cleanUrls.length]);

  const currentUrl = cleanUrls[idx] ?? null;

  const canPrev = idx > 0;
  const canNext = idx < cleanUrls.length - 1;

  const goPrev = () => {
    if (!canPrev) return;
    setIdx((p) => Math.max(0, p - 1));
  };

  const goNext = () => {
    if (!canNext) return;
    setIdx((p) => Math.min(cleanUrls.length - 1, p + 1));
  };

  useEffect(() => {
    if (!shouldOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };

    window.addEventListener("keydown", onKeyDown);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldOpen, idx, cleanUrls.length]);

  const startXRef = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const startX = startXRef.current;
    startXRef.current = null;
    if (startX === null) return;

    const endX = e.changedTouches[0]?.clientX ?? startX;
    const dx = endX - startX;

    if (Math.abs(dx) < 40) return;
    if (dx > 0) goPrev();
    else goNext();
  };

  if (!shouldOpen || !currentUrl) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.50)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 14,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{
          width: "100%",
          maxWidth: 420,
          maxHeight: "calc(100dvh - 28px)",
          display: "flex",
          flexDirection: "column",
          background: "transparent",
          position: "relative",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        {/* ✅ 카운터는 sticky로 두되, X는 floating으로 분리 */}
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 2,
            display: "flex",
            alignItems: "center",
            padding: 8,
            backdropFilter: "blur(6px)",
            background: "rgba(0,0,0,0.20)",
          }}
        >
          <div style={{ color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: 800 }}>
            {cleanUrls.length > 1 ? `${idx + 1} / ${cleanUrls.length}` : ""}
          </div>
        </div>

        {/* ✅ Floating Close (항상 보임) */}
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            zIndex: 5,
            width: 40,
            height: 40,
            borderRadius: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",

            // ✅ 가시성 확보 (어떤 이미지 위에서도)
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(6px)",
            border: "1px solid rgba(255,255,255,0.18)",
            color: "white",

            cursor: "pointer",
          }}
        >
          <X size={22} strokeWidth={3} />
        </button>

        {/* Image scroller */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <img
            src={currentUrl}
            alt="영수증 확대"
            style={{
              width: "100%",
              height: "auto",
              display: "block",
            }}
          />
        </div>

        {/* Prev / Next buttons */}
        {cleanUrls.length > 1 ? (
          <>
            <button
              type="button"
              onClick={goPrev}
              disabled={!canPrev}
              aria-label="이전 이미지"
              style={{
                position: "absolute",
                left: 6,
                top: "50%",
                transform: "translateY(-50%)",
                width: 40,
                height: 40,
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.35)",
                background: "rgba(0,0,0,0.35)",
                color: "white",
                fontSize: 22,
                fontWeight: 900,
                cursor: canPrev ? "pointer" : "not-allowed",
                opacity: canPrev ? 1 : 0.35,
              }}
            >
              ‹
            </button>

            <button
              type="button"
              onClick={goNext}
              disabled={!canNext}
              aria-label="다음 이미지"
              style={{
                position: "absolute",
                right: 6,
                top: "50%",
                transform: "translateY(-50%)",
                width: 40,
                height: 40,
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.35)",
                background: "rgba(0,0,0,0.35)",
                color: "white",
                fontSize: 22,
                fontWeight: 900,
                cursor: canNext ? "pointer" : "not-allowed",
                opacity: canNext ? 1 : 0.35,
              }}
            >
              ›
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
