"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, Download, ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  urls: Array<string | null | undefined>;
  startIndex: number;
  onClose: () => void;
  setIndex?: (i: number) => void;

  meta?: {
    vendorName?: string | null;
    receiptDate?: string | null; // "YYYY-MM-DD" or "YY.MM.DD" or "YYMMDD"
  };
};

function normalizeReceiptDate(input?: string | null) {
  const digits = (input ?? "").replace(/\D/g, "");
  if (digits.length === 8) return digits.slice(2);
  if (digits.length === 6) return digits;
  return "000000";
}

function sanitizeVendorName(input?: string | null) {
  const base = (input ?? "").trim() || "vendor";
  return base.replace(/\s+/g, "_").replace(/[\\/:*?"<>|]/g, "");
}

function guessExtFromUrl(url: string) {
  const lower = url.toLowerCase();
  if (lower.includes(".png")) return "png";
  if (lower.includes(".webp")) return "webp";
  if (lower.includes(".jpeg")) return "jpeg";
  if (lower.includes(".jpg")) return "jpg";
  return "jpg";
}

function guessExtFromContentType(ct: string | null) {
  const c = (ct ?? "").toLowerCase();
  if (c.includes("image/png")) return "png";
  if (c.includes("image/webp")) return "webp";
  if (c.includes("image/jpeg")) return "jpg";
  return null;
}

export default function ReceiptLightbox({
  urls,
  startIndex,
  onClose,
  setIndex,
  meta,
}: Props) {
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

  // ✅ 파일명(미리보기) 만들기
  const label = useMemo(() => {
    const vendor = sanitizeVendorName(meta?.vendorName);
    const yymmdd = normalizeReceiptDate(meta?.receiptDate);
    return `${vendor}_${yymmdd}_${idx + 1}`;
  }, [meta?.vendorName, meta?.receiptDate, idx]);

  // ✅ 다운로드
  const [downloading, setDownloading] = useState(false);

  const onDownload = async () => {
    if (!currentUrl) return;
    if (downloading) return;

    setDownloading(true);
    try {
      const res = await fetch(currentUrl, { mode: "cors" });
      if (!res.ok) throw new Error(`다운로드 실패 (${res.status})`);

      const blob = await res.blob();
      const ct = res.headers.get("content-type");
      const ext = guessExtFromContentType(ct) ?? guessExtFromUrl(currentUrl);

      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `${label}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      URL.revokeObjectURL(objectUrl);
    } catch (e) {
      console.log("download error:", e);
      // 필요하면 여기서 토스트/에러 UI 추가
    } finally {
      setDownloading(false);
    }
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
        {/* ✅ sticky header */}
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 2,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: 8,
            backdropFilter: "blur(6px)",
            background: "rgba(0,0,0,0.20)",
          }}
        >
          {cleanUrls.length > 1 ? (
            <div style={{ color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: 900, whiteSpace: "nowrap" }}>
              {`${idx + 1} / ${cleanUrls.length}`}
            </div>
          ) : null}

          <div
            style={{
              color: "rgba(255,255,255,0.88)",
              fontSize: 12,
              fontWeight: 900,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
              minWidth: 0,
            }}
            title={label}
          >
            {label}
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDownload();
            }}
            disabled={downloading}
            style={{
              width: 36,
              height: 32,
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.18)",
              background: downloading ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.35)",
              color: "white",
              cursor: downloading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              opacity: downloading ? 0.6 : 1,
              marginRight: 60
            }}
            aria-label="다운로드"
            title="다운로드"
          >
            <Download size={18} />
          </button>
        </div>

        {/* Floating Close */}
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
        <div style={{ flex: 1, overflow: "auto", WebkitOverflowScrolling: "touch" }}>
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

        {/* Prev / Next */}
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
                cursor: canPrev ? "pointer" : "not-allowed",
                opacity: canPrev ? 1 : 0.35,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ChevronLeft size={22} strokeWidth={3} />
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
                cursor: canNext ? "pointer" : "not-allowed",
                opacity: canNext ? 1 : 0.35,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ChevronRight size={22} strokeWidth={3} />
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
