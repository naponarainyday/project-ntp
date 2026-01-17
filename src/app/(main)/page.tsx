"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type VendorRow = {
  vendor_id: string;
  name: string;
  stall_no: string | null;
  invoice_capability: "supported" | "not_supported" | null;
  market_name: string | null;
  market_sort_order: number | null;
  status_summary: "needs_fix" | "requested" | "uploaded" | "completed" | null;
  status_priority: number;
  stall_no_num: number | null;
};

type ReceiptLite = {
  vendor_id: string | null;
  status: "needs_fix" | "requested" | "uploaded" | "completed" | string | null;
};

function capabilityDot(v: VendorRow) {
  return v.invoice_capability === "supported" ? "🔴" : "🔘";
}

function statusLabel(s: VendorRow["status_summary"]) {
  if (s === "needs_fix") return "수정필요";
  if (s === "requested") return "요청";
  if (s === "uploaded") return "업로드";
  if (s === "completed") return "완료";
  return "";
}

function formatStallNo(stallNo: string | null) {
  if (!stallNo) return "";
  const t = `${stallNo}`.trim();
  if (!t) return "";
  return t.endsWith("호") ? t : `${t}호`;
}

function formatCount(n: number) {
  return n >= 99 ? "99+" : String(n);
}

export default function MainHomePage() {
  const router = useRouter();

  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [receiptCountsByVendor, setReceiptCountsByVendor] = useState<
    Record<string, Record<string, number>>
  >({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);

      // 1) vendor 목록
      const { data: vendorData, error: vendorError } = await supabase
        .from("v_vendor_list_page2")
        .select("*")
        .order("status_priority", { ascending: true })
        .order("market_sort_order", { ascending: true, nullsFirst: false })
        .order("stall_no_num", { ascending: true, nullsFirst: false })
        .order("stall_no", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true });

      if (vendorError) {
        console.error(vendorError);
        alert("상가 데이터 로드 실패: 콘솔(F12) 확인");
        setLoading(false);
        return;
      }

      const vendorRows = (vendorData ?? []) as VendorRow[];

      // 2) receipts 집계 (vendor_id, status)
      const { data: receiptData, error: receiptError } = await supabase
        .from("receipts")
        .select("vendor_id,status");

      if (receiptError) {
        console.error(receiptError);
        alert("영수증 데이터 로드 실패: 콘솔(F12) 확인");
        setLoading(false);
        return;
      }

      const counts: Record<string, Record<string, number>> = {};
      for (const r of (receiptData ?? []) as ReceiptLite[]) {
        if (!r.vendor_id) continue;
        const vid = r.vendor_id;
        const st = (r.status ?? "").toString();
        if (!st) continue;

        if (!counts[vid]) counts[vid] = {};
        counts[vid][st] = (counts[vid][st] ?? 0) + 1;
      }

      setVendors(vendorRows);
      setReceiptCountsByVendor(counts);
      setLoading(false);
    })();
  }, []);

  // ✅ 영수증이 1건이라도 있는 상가만
  const activeVendors = useMemo(() => {
    return vendors.filter((v) => {
      const countsByStatus = receiptCountsByVendor?.[v.vendor_id];
      if (!countsByStatus) return false;
      const total = Object.values(countsByStatus).reduce((sum, n) => sum + n, 0);
      return total > 0;
    });
  }, [vendors, receiptCountsByVendor]);

  return (
    <div style={{ maxWidth: 420, margin: "0 auto", padding: 10 }}>
      {/* 상단 CTA */}
      <button
        onClick={() => router.push("/receipts/new")}
        style={{
          width: "100%",
          marginTop: 0,
          padding: "12px 12px",
          borderRadius: 12,
          border: "1px solid #ddd",
          background: "#f3f3f3",
          fontSize: 15,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        + 새 영수증 등록하기
      </button>

      <div style={{ marginTop: 12, borderTop: "1px solid #eee" }} />

      {/* 활성 상가 리스트 */}
      {loading ? (
        <div style={{ padding: "12px 0", fontSize: 14, opacity: 0.7 }}>불러오는 중…</div>
      ) : activeVendors.length === 0 ? (
        <div style={{ padding: "12px 0", fontSize: 14, opacity: 0.7 }}>
          아직 등록된 영수증이 있는 상가가 없어요.
        </div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {activeVendors.map((v) => {
            const vid = v.vendor_id;

            // status_summary 기준 카운트 표시
            const summaryKey = v.status_summary ?? "";
            const summaryCount = summaryKey ? receiptCountsByVendor?.[vid]?.[summaryKey] ?? 0 : 0;

            const stallText = formatStallNo(v.stall_no);

            return (
              <li key={vid} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <Link
                  href={`/vendors/${vid}/receipts/new`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 4px",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  {/* [market] */}
                  <span style={{ fontSize: 12, opacity: 0.75, minWidth: 52 }}>
                    [{v.market_name ?? "-"}]
                  </span>

                  {/* 🔴 / 🔘 */}
                  <span style={{ fontSize: 14, lineHeight: 1 }}>{capabilityDot(v)}</span>

                  {/* ✅ name / stall_no 분리 + stall_no superscript 느낌 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: 6,
                        minWidth: 0, // 중요: 내부 ellipsis 동작
                        whiteSpace: "nowrap",
                      }}
                    >
                      {/* name: 주 텍스트 (ellipsis 대상) */}
                      <span
                        style={{
                          fontSize: 16,
                          fontWeight: 700,
                          color: "#111",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          minWidth: 0,
                        }}
                      >
                        {v.name}
                      </span>

                      {/* stall_no: 보조 텍스트 (살짝 위로, 덜 강조) */}
                      {stallText ? (
                        <span
                          style={{
                            fontSize: 14, // 너무 줄이지 않음 (가독성 유지)
                            fontWeight: 500,
                            color: "#555",
                            transform: "translateY(0px)", // superscript 느낌
                            flexShrink: 0, // name이 먼저 줄어들게
                          }}
                        >
                          {stallText}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* status pill */}
                  <span
                    style={{
                      fontSize: 12,
                      padding: "4px 8px",
                      borderRadius: 999,
                      border: "1px solid #ddd",
                      whiteSpace: "nowrap",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                    title={v.status_summary ?? ""}
                  >
                    <span style={{ opacity: 0.85 }}>({formatCount(summaryCount)})</span>
                    <span>{statusLabel(v.status_summary)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {/* 하단: 전체 상가 리스트 */}
      <div style={{ marginTop: 28 }}>
        <div style={{ borderTop: "2px solid #ddd" }} />
        <div style={{ height: 14 }} />

        <Link href="/vendors" style={{ fontSize: 14, textDecoration: "underline" }}>
          전체 리스트 보기 →
        </Link>
      </div>
    </div>
  );
}
