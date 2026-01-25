"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type ReceiptStatus = "needs_fix" | "requested" | "uploaded" | "completed";

type VendorRow = {
  vendor_id: string;
  name: string;
  stall_no: string | null;
  invoice_capability: "supported" | "not_supported" | null;
  market_name: string | null;
  market_sort_order: number | null;
  status_summary: ReceiptStatus | null;
  status_priority: number;
  stall_no_num: number | null;
};

type ReceiptLite = {
  vendor_id: string | null;
  status: ReceiptStatus | string | null;
  amount: number | null;
};

const STATUS_ORDER: ReceiptStatus[] = [ "needs_fix", "uploaded", "requested", "completed"];

function capabilityDot(v: VendorRow) {
  return v.invoice_capability === "supported" ? "🔴" : "🔘";
}

function statusLabel(s: ReceiptStatus) {
  if (s === "needs_fix") return "수정필요";
  if (s === "requested") return "요청중";
  if (s === "uploaded") return "요청대기";
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

function formatKRW(n: number) {
  // 합계 표시: 1,234,567원
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}

export default function MainHomePage() {
  const router = useRouter();

  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [receiptCountsByVendor, setReceiptCountsByVendor] = useState<
    Record<string, Record<string, number>>
  >({});
  const [receiptAmountSumByVendor, setReceiptAmountSumByVendor] = useState<
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
        .order("name", { ascending: true })
        .order("stall_no_num", { ascending: true, nullsFirst: false })
        .order("stall_no", { ascending: true, nullsFirst: false });

      if (vendorError) {
        console.error(vendorError);
        alert("상가 데이터 로드 실패: 콘솔(F12) 확인");
        setLoading(false);
        return;
      }

      const vendorRows = (vendorData ?? []) as VendorRow[];

      // 2) receipts 집계 (vendor_id, status, amount)
      const { data: receiptData, error: receiptError } = await supabase
        .from("receipts")
        .select("vendor_id,status,amount");

      if (receiptError) {
        console.error(receiptError);
        alert("영수증 데이터 로드 실패: 콘솔(F12) 확인");
        setLoading(false);
        return;
      }

      const counts: Record<string, Record<string, number>> = {};
      const sums: Record<string, Record<string, number>> = {};

      for (const r of (receiptData ?? []) as ReceiptLite[]) {
        if (!r.vendor_id) continue;
        const vid = r.vendor_id;

        const st = (r.status ?? "").toString();
        if (!st) continue;

        const amt = Number(r.amount ?? 0);

        if (!counts[vid]) counts[vid] = {};
        if (!sums[vid]) sums[vid] = {};

        counts[vid][st] = (counts[vid][st] ?? 0) + 1;
        sums[vid][st] = (sums[vid][st] ?? 0) + amt;
      }

      setVendors(vendorRows);
      setReceiptCountsByVendor(counts);
      setReceiptAmountSumByVendor(sums);
      setLoading(false);
    })();
  }, []);

  // ✅ status별 섹션 구성 (상가가 status마다 중복 노출될 수 있음)
  const sections = useMemo(() => {
    const byStatus: Record<
      ReceiptStatus,
      {
        status: ReceiptStatus;
        totalCount: number;
        totalAmount: number;
        vendors: Array<{ v: VendorRow; count: number }>;
      }
    > = {
      needs_fix: { status: "needs_fix", totalCount: 0, totalAmount: 0, vendors: [] },
      requested: { status: "requested", totalCount: 0, totalAmount: 0, vendors: [] },
      uploaded: { status: "uploaded", totalCount: 0, totalAmount: 0, vendors: [] },
      completed: { status: "completed", totalCount: 0, totalAmount: 0, vendors: [] },
    };

    for (const st of STATUS_ORDER) {
      let totalCount = 0;
      let totalAmount = 0;

      const list: Array<{ v: VendorRow; count: number }> = [];

      // vendors의 기존 정렬 순서 유지한 채로 status별로 필터
      for (const v of vendors) {
        const vid = v.vendor_id;
        const c = receiptCountsByVendor?.[vid]?.[st] ?? 0;
        if (c <= 0) continue;

        const s = receiptAmountSumByVendor?.[vid]?.[st] ?? 0;

        totalCount += c;
        totalAmount += s;

        list.push({ v, count: c });
      }

      byStatus[st] = { status: st, totalCount, totalAmount, vendors: list };
    }

    // 영수증이 1건이라도 있는 섹션만 노출
    return STATUS_ORDER.map((st) => byStatus[st]).filter((sec) => sec.totalCount > 0);
  }, [vendors, receiptCountsByVendor, receiptAmountSumByVendor]);

  return (
    <div style={{ margin: "0 auto", padding: 0 }}>
      <div style={{ marginTop: 0}} />

      {loading ? (
        <div style={{ padding: "12px 0", fontSize: 14, opacity: 0.7 }}>불러오는 중…</div>
      ) : sections.length === 0 ? (
        <div style={{ padding: "12px 0", fontSize: 14, opacity: 0.7 }}>
          아직 등록된 영수증이 없어요.
        </div>
      ) : (
        <div>
          {sections.map((sec, idx) => (
            <div key={sec.status} 
                  style={{ 
                    paddingTop: idx === 0? 2 : 14, // 🔻 첫 섹션 위 갭 줄이기 / 이후 섹션은 띄우기
                    marginBottom: 0,
                    }}>
              {/* ✅ status 헤더: /vendors/[vendorId] 느낌으로 (count+label 박스 유지)
                  - 여기 박스는 "해당 status의 내 영수증 전체 합계"로 표시
              */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "2px 4px",
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#111" }}>
                    {statusLabel(sec.status)}
                  </div>
                  <div style={{ fontSize: 16, opacity: 0.9 }}>
                    {formatCount(sec.totalCount)}건
                  </div>
                </div>

                {/* 합계 박스 (유지)
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "baseline",
                    gap: 14,
                    padding: "6px 10px",
                    borderRadius: 12,
                    background: "#eeeeee",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span style={{ fontSize: 12, opacity: 0.9 }}>합계</span>
                  <span style={{ fontSize: 14, fontWeight: 800 }}>{formatKRW(sec.totalAmount)}</span>
                </div> */}
              </div>

              <div style={{ borderTop: "1px solid #f0f0f0" }} />

              {/* ✅ status 아래 상가 리스트 */}
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {sec.vendors.map(({ v, count }) => {
                  const vid = v.vendor_id;
                  const stallText = formatStallNo(v.stall_no);

                  return (
                    <li key={`${vid}-${sec.status}`} style={{ borderBottom: "1px solid #f0f0f0" }}>
                      <Link
                        href={`/vendors/${vid}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "6px 4px",
                          textDecoration: "none",
                          color: "inherit",
                        }}
                      >
                        {/* [market] */}
                        <span style={{ fontSize: 12, opacity: 0.75, minWidth: 52 }}>
                          [{v.market_name ?? "-"}]
                        </span>

                        {/* 🔴 / 🔘 */}
                        <span style={{ fontSize: 12, lineHeight: 1 }}>{capabilityDot(v)}</span>

                        {/* name / stall_no */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "baseline",
                              gap: 6,
                              minWidth: 0,
                              whiteSpace: "nowrap",
                            }}
                          >
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

                            {stallText ? (
                              <span
                                style={{
                                  fontSize: 14,
                                  fontWeight: 500,
                                  color: "#555",
                                  transform: "translateY(0px)",
                                  flexShrink: 0,
                                }}
                              >
                                {stallText}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        {/* ✅ 홈화면 row 오른쪽: 박스 제거, count만 */}
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 800,
                            color: "#111",
                            minWidth: 36,
                            textAlign: "right",
                          }}
                          title={`${statusLabel(sec.status)} ${count}건`}
                        >
                          {formatCount(count)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* 하단: 전체 상가 리스트 */}
      <div style={{ marginTop: 10 }}>
        <div style={{ borderTop: "2px solid #ddd" }} />
        <div style={{ height: 6 }} />

        <Link href="/vendors/all" style={{ fontSize: 14, textDecoration: "underline" }}>
          전체 리스트 보기 →
        </Link>
      </div>
    </div>
  );
}
