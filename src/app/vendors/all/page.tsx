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
  stall_no_num: number | null;
};

function capabilityDot(v: VendorRow) {
  return v.invoice_capability === "supported" ? "●" : "○";
}

function statusLabel(s: VendorRow["status_summary"]) {
  switch (s) {
    case "needs_fix":
      return "수정";
    case "requested":
      return "요청";
    case "uploaded":
      return "업로드";
    case "completed":
      return "완료";
    default:
      return "";
  }
}

export default function VendorsAllPage() {
  const [rows, setRows] = useState<VendorRow[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("v_vendor_list_page2")
        .select("*")
        .order("market_sort_order", { ascending: true, nullsFirst: false })
        .order("stall_no_num", { ascending: true, nullsFirst: false })
        .order("stall_no", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true });

      if (error) {
        console.log("ERROR:", error);
        alert(error.message ?? "데이터 로드 실패");
        return;
      }

      const d = (data ?? []) as VendorRow[];
      setRows(d);

      const markets = Array.from(new Set(d.map((x) => x.market_name ?? "기타")));
      const init: Record<string, boolean> = {};
      for (const m of markets) init[m] = false;
      setOpen(init);
    })();
  }, []);

  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (!k) return rows;
    return rows.filter((r) => {
      const hay = `${r.market_name ?? ""} ${r.stall_no ?? ""} ${r.name ?? ""}`.toLowerCase();
      return hay.includes(k);
    });
  }, [q, rows]);

  const grouped = useMemo(() => {
    const map: Record<string, VendorRow[]> = {};
    for (const r of filtered) {
      const key = r.market_name ?? "기타";
      if (!map[key]) map[key] = [];
      map[key].push(r);
    }
    return map;
  }, [filtered]);

  const marketKeys = useMemo(() => {
    const keys = Object.keys(grouped);
    keys.sort((a, b) => {
      const aa = rows.find((x) => (x.market_name ?? "기타") === a)?.market_sort_order ?? 9999;
      const bb = rows.find((x) => (x.market_name ?? "기타") === b)?.market_sort_order ?? 9999;
      return aa - bb;
    });
    return keys;
  }, [grouped, rows]);

  return (
    <div style={{ maxWidth: 420, margin: "0 auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <Link href="/vendors" style={{ textDecoration: "underline", fontSize: 14 }}>
          ← 돌아가기
        </Link>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>상가 전체 리스트</h1>
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

      {marketKeys.map((mk) => {
        const isOpen = open[mk] ?? false;
        const list = grouped[mk] ?? [];

        return (
          <div key={mk} style={{ marginTop: 10 }}>
            <button
              onClick={() => setOpen((p) => ({ ...p, [mk]: !isOpen }))}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "10px 8px",
                borderRadius: 12,
                border: "1px solid #eee",
                background: "white",
                fontSize: 14,
                fontWeight: 700,
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>{mk}</span>
              <span style={{ opacity: 0.6 }}>
                {isOpen ? "▴" : "▾"} ({list.length})
              </span>
            </button>

            {isOpen && (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {list.map((r) => (
                  <li
                    key={r.vendor_id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 4px",
                      borderBottom: "1px solid #f3f3f3",
                    }}
                  >
                    <span style={{ fontSize: 14 }}>{capabilityDot(r)}</span>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {(r.stall_no ? `[${r.stall_no}] ` : "")}
                        {r.name}
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.65 }}>[{mk}]</div>
                    </div>

                    <span
                      style={{
                        fontSize: 12,
                        padding: "4px 8px",
                        borderRadius: 999,
                        border: "1px solid #ddd",
                      }}
                    >
                      {statusLabel(r.status_summary)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
