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
  return v.invoice_capability === "supported" ? "●" : "○";
}

function statusLabel(s: VendorRow["status_summary"]) {
  if (s === "needs_fix") return "수정";
  if (s === "requested") return "요청";
  if (s === "uploaded") return "업로드";
  if (s === "completed") return "완료";
  return "";
}

export default function VendorsPage() {
  const [rows, setRows] = useState<VendorRow[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("v_vendor_list_page2")
        .select("*")
        .order("status_priority", { ascending: true })
        .order("market_sort_order", { ascending: true, nullsFirst: false })
        .order("stall_no_num", { ascending: true, nullsFirst: false })
        .order("stall_no", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true });

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

  return (
    <div style={{ maxWidth: 420, margin: "0 auto", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>상가</h1>
        <Link href="/vendors/all" style={{ fontSize: 14, textDecoration: "underline" }}>
          전체 리스트 보기 →
        </Link>
      </div>

      <div style={{ marginTop: 12 }}>
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

      <div style={{ marginTop: 12, borderTop: "1px solid #eee" }} />

      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {filtered.map((r) => (
        <li key={r.vendor_id} style={{ borderBottom: "1px solid #f0f0f0" }}>
        <Link
        href={`/vendors/${r.vendor_id}/receipts/new`}
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
          [{r.market_name ?? "-"}]
        </span>

        {/* ●/○ */}
        <span style={{ fontSize: 14 }}>
          {capabilityDot(r)}
        </span>

        {/* (stall_no + name) */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {(r.stall_no ? `[${r.stall_no}] ` : "")}{r.name}
          </div>
        </div>

        {/* [status] */}
        <span
          style={{
            fontSize: 12,
            padding: "4px 8px",
            borderRadius: 999,
            border: "1px solid #ddd",
            whiteSpace: "nowrap",
          }}
          title={r.status_summary ?? ""}
        >
          {statusLabel(r.status_summary)}
        </span>
      </Link>
    </li>
  ))}
</ul>

    </div>
  );
}
