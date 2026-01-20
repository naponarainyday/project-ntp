"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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

function capabilityDot(v: VendorRow) {
  return v.invoice_capability === "supported" ? "🔴" : "🔘";
}

function formatStallNo(stallNo: string | null) {
  if (!stallNo) return "";
  const t = `${stallNo}`.trim();
  if (!t) return "";
  return t.endsWith("호") ? t : `${t}호`;
}

function NameLine({ name, stallNo }: { name: string; stallNo: string | null }) {
  const stallText = formatStallNo(stallNo);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 6,
        minWidth: 0,
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
        {name}
      </span>

      {/* stall_no: 보조 텍스트 (superscript 느낌) */}
      {stallText ? (
        <span
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: "#555",
            transform: "translateY(0px)", // 네가 현재 0으로 둔 상태 유지
            flexShrink: 0,
          }}
        >
          {stallText}
        </span>
      ) : null}
    </div>
  );
}

export default function VendorsPage() {
  const [rows, setRows] = useState<VendorRow[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("v_vendor_list_page2")
        .select("*")
        // .order("status_priority", { ascending: true })
        .order("market_sort_order", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true })
        .order("stall_no_num", { ascending: true, nullsFirst: false })
        .order("stall_no", { ascending: true, nullsFirst: false });

      if (error) {
        console.error(error);
        alert("데이터 로드 실패: 콘솔(F12) 확인");
        return;
      }
      setRows((data ?? []) as VendorRow[]);
    })();
  }, []);

  const filtered = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter((r) => {
      const hay = `${r.market_name ?? ""} ${r.stall_no ?? ""} ${r.name ?? ""}`.toLowerCase();
      return hay.includes(keyword);
    });
  }, [q, rows]);

  // 🔴 supported 상가만 상단 섹션으로 분리
  const supportedVendors = useMemo(() => {
    return filtered.filter((v) => v.invoice_capability === "supported")
    .slice() // 원본 배열 복사
    .sort((a, b) =>{
      // 1. status_priority 기준으로 먼저 정렬 (영수증 업로드 등 우선 순위)
      if (a.status_priority !==b.status_priority) {
        return a.status_priority - b.status_priority;
        }
        // 2. 우선순위가 같은면 이름순(가나다)
        return a.name.localeCompare(b.name,'ko')      
  });
 }, [filtered]);

  // 시장별 그룹 (드랍다운)
  const groupedByMarket = useMemo(() => {
    const map = new Map<string, VendorRow[]>();
    for (const v of filtered) {
      const key = v.market_name ?? "기타";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(v);
    }

    const groups = Array.from(map.entries()).map(([market, list]) => {
      const sortOrder = list.find((x) => x.market_name === market)?.market_sort_order ?? 999999;
      return { market, sortOrder, list };
    });

    groups.sort((a, b) => (a.sortOrder ?? 999999) - (b.sortOrder ?? 999999));
    return groups;
  }, [filtered]);

  return (
    <div style={{ maxWidth: 420, margin: "0 auto", padding: 16 }}>
      {/* 검색 */}
      <div style={{ marginTop: 0 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="🔍 상가명 / 호수 / 시장 검색"
          style={{
            width: "100%",
            padding: "12px 12px",
            borderRadius: 12,
            border: "1px solid #ddd",
            fontSize: 14,
          }}
        />
      </div>

      {/* 🔴 supported 섹션 */}
      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
          🔴 세금계산서 지원 상가
        </div>

        {supportedVendors.length === 0 ? (
          <div style={{ fontSize: 13, opacity: 0.7 }}>검색 조건에 해당하는 지원 상가가 없어요.</div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {supportedVendors.map((v) => (
              <li key={v.vendor_id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <Link
                  href={`/vendors/${v.vendor_id}/receipts/new`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 4px",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <span style={{ fontSize: 12, opacity: 0.75, minWidth: 52 }}>
                    [{v.market_name ?? "-"}]
                  </span>

                  <span style={{ fontSize: 14, lineHeight: 1 }}>{capabilityDot(v)}</span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <NameLine name={v.name} stallNo={v.stall_no} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ marginTop: 18, borderTop: "2px solid #ddd" }} />

      {/* 시장별 드랍다운: 기본 펼침 */}
      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>시장별 보기</div>

        {groupedByMarket.map((g) => (
          <details
            key={g.market}
            open
            className="market-details"
            style={{ border: "1px solid #eee", borderRadius: 12, marginBottom: 10 }}
          >
            <summary
              style={{
                padding: "10px 12px",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 700,
                listStyle: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              {/* 왼쪽: 시장명 + 카운트 */}
              <span style={{ display: "inline-flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {g.market}
                </span>
                <span style={{ fontSize: 12, opacity: 0.7, flexShrink: 0 }}>({g.list.length})</span>
              </span>

              {/* 오른쪽: 커스텀 화살표 */}
              <span
                className="market-chevron"
                aria-hidden
                style={{
                  fontSize: 14,
                  opacity: 0.7,
                  lineHeight: 1,
                  flexShrink: 0,
                }}
              >
                ▶︎
              </span>
            </summary>

            <div style={{ padding: "0 8px 8px 8px" }}>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {g.list.map((v) => (
                  <li key={v.vendor_id} style={{ borderBottom: "1px solid #f3f3f3" }}>
                    <Link
                      href={`/vendors/${v.vendor_id}/receipts/new`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 6px",
                        textDecoration: "none",
                        color: "inherit",
                      }}
                    >
                      <span style={{ fontSize: 14, lineHeight: 1 }}>{capabilityDot(v)}</span>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <NameLine name={v.name} stallNo={v.stall_no} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        ))}
      </div>

      {/* ✅ 변경점 2: 기본 marker 제거 + open 상태 회전 */}
      <style jsx>{`
        /* 1) 브라우저 기본 summary 화살표(marker) 제거 */
        .market-details summary {
          list-style: none;
        }
        .market-details summary::-webkit-details-marker {
          display: none;
        }

        /* 2) 아이콘 회전(닫힘=▶︎, 열림=▼처럼 보이게) */
        .market-chevron {
          display: inline-block;
          transition: transform 140ms ease;
        }
        .market-details[open] .market-chevron {
          transform: rotate(90deg);
        }
      `}</style>
    </div>
  );
}
