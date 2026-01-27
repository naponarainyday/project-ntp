"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";


export default function VendorExportPage() {
  const params = useParams<{ vendorId: string | string[] }>();
  const vendorId = Array.isArray(params.vendorId) ? params.vendorId[0] : params.vendorId;
  const router = useRouter();

  const [payload, setPayload] = useState<any>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("vendor_export_payload");
      setPayload(raw ? JSON.parse(raw) : null);
    } catch {
      setPayload(null);
    }
  }, []);

  const summary = useMemo(() => {
    if (!payload) return null;
    return {
      count: (payload?.receiptIds ?? []).length,
      status: payload?.status,
      taxType: payload?.taxType,
    };
  }, [payload]);

  return (
    <div style={{ margin: "0 auto", padding: "14px 12px", maxWidth: 448 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          onClick={() => router.back()}
          style={{
            border: "1px solid #E5E7EB",
            background: "#fff",
            borderRadius: 10,
            padding: "8px 10px",
            fontSize: 13,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          ← 뒤로
        </button>

        <div style={{ fontSize: 16, fontWeight: 900 }}>내보내기(복사) · 임시</div>
      </div>

      <div style={{ marginTop: 12, border: "1px solid #E5E7EB", borderRadius: 12, padding: 12, background: "#fff" }}>
        <div style={{ fontSize: 13, opacity: 0.8 }}>vendorId</div>
        <div style={{ fontSize: 14, fontWeight: 800 }}>{vendorId}</div>

        <div style={{ marginTop: 10, fontSize: 13, opacity: 0.8 }}>선택 요약</div>
        {summary ? (
          <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.6 }}>
            {summary.count}건 / 상태: {String(summary.status)} / 과세구분: {String(summary.taxType)}
          </div>
        ) : (
          <div style={{ fontSize: 13, opacity: 0.7 }}>payload 없음 (세션이 만료되었거나 직접 진입)</div>
        )}
      </div>

      <div style={{ marginTop: 12, fontSize: 13, opacity: 0.75 }}>
        ※ 이 페이지 내부는 다음 단계에서 구체화하자. (지금은 라우팅만)
      </div>
    </div>
  );
}
