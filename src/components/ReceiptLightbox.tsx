"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  /** 이미지 배열 (null/빈문자/undefined는 자동 제거됨) */
  urls: Array<string | null | undefined>;
  /** 최초로 열릴 이미지 index */
  startIndex: number;
  onClose: () => void;
};

export default function ReceiptLightbox({ urls, startIndex, onClose }: Props) {
  const cleanUrls = useMemo(
    () => (urls ?? []).filter((u): u is string => !!u && typeof u === "string"),
    [urls]
  );

  // urls가 없으면 렌더 안 함
  const shouldOpen = cleanUrls.length > 0 && startIndex >= 0;
  const [idx, setIdx] = useState(startIndex);

  // 열릴 때 startIndex 동기화
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

  // 키보드: ESC 닫기, ←/→ 이동
  useEffect(() => {
    if (!shouldOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };

    window.addEventListener("keydown", onKeyDown);
    // 배경 스크롤 잠금
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldOpen, idx, cleanUrls.length]);

  // 스와이프(모바일): 좌/우
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

    // 너무 작은 스와이프는 무시
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
          overflow: "hidden",
          background: "transparent",
          position: "relative",
        }}
      >
        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", padding: 5 }}>
          <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: 800 }}>
            {cleanUrls.length > 1 ? `${idx + 1} / ${cleanUrls.length}` : ""}
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              marginLeft: "auto",
              background: "transparent",
              color: "white",
              fontSize: 30,
              fontWeight: 900,
              borderRadius: 10,
              padding: "2px 10px",
              cursor: "pointer",
              border: "none",
            }}
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {/* Image */}
        <img
          src={currentUrl}
          alt="영수증 확대"
          style={{
            width: "100%",
            height: "auto",
            display: "block",
            borderRadius: 10,
          }}
        />

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
