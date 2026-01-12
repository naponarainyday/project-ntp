"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type ReceiptStatus = "uploaded" | "requested" | "needs_fix" | "completed";
type PaymentMethod = "cash" | "transfer";
type ReceiptType = "standard" | "simple" | null;

type Market = { id: string; name: string | null; sort_order: number | null };
type Vendor = { id: string; name: string; stall_no: string | null; markets?: Market[] | Market | null };

type Row = {
  id: string;
  vendor_id: string;
  amount: number;
  status: ReceiptStatus;
  payment_method: PaymentMethod;
  deposit_date: string | null;
  receipt_type: ReceiptType;
  created_at: string;
  vendors?: Vendor[] | Vendor | null; // ✅ 배열/객체 둘 다
};

function statusLabel(s: ReceiptStatus) {
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
      return s;
  }
}

function formatMoney(n: number) {
  try {
    return Number(n).toLocaleString("ko-KR");
  } catch {
    return String(n);
  }
}

// join 결과(배열)에서 vendor/market을 안전하게 꺼내는 헬퍼
function pickVendor(r: Row): Vendor | null {
  const v = r.vendors as any;
  if (!v) return null;
  if (Array.isArray(v)) return v.length > 0 ? v[0] : null;
  return v; // 객체면 그대로 반환
}

function pickMarket(v: Vendor | null): Market | null {
  if (!v) return null;
  const ms: any = v.markets;
  if (!ms) return null;
  if (Array.isArray(ms)) return ms.length > 0 ? ms[0] : null;
  return ms; // 객체면 그대로 반환
}


export default function ReceiptsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [rows, setRows] = useState<Row[]>([]);

  // filters
  const [q, setQ] = useState("");
  const [market, setMarket] = useState<string>("all"); // market id or all
  const [status, setStatus] = useState<string>("all"); // status or all
  const [rtype, setRtype] = useState<string>("all"); // simple/standard/all
  const [pm, setPm] = useState<string>("all"); // cash/transfer/all
  const [sort, setSort] = useState<string>("new"); // new / amount_desc / amount_asc

  useEffect(() => {
    (async () => {
      setMsg("");
      setLoading(true);

      try {
        // 로그인 확인 (RLS)
        const { data: authData, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;

        const userId = authData?.user?.id ?? null;
        if (!userId) {
          router.push("/login");
          return;
        }

        // receipts + vendors + markets join
        // ✅ 여기서 vendors/markets가 배열로 내려올 수 있어 타입을 그렇게 잡았음
        const { data, error } = await supabase
          .from("receipts")
          .select(
            `
              id, vendor_id, amount, status, payment_method, deposit_date, receipt_type, created_at,
              vendors:vendors!receipts_vendor_id_fkey (
                id, name, stall_no,
                markets:markets!vendors_market_id_fkey (id, name, sort_order)
              )
            `
          )
          .order("created_at", { ascending: false });

        if (error) throw error;

        setRows((data ?? []) as unknown as Row[]);
      } catch (e: any) {
        console.log("P5 LOAD ERROR:", e);
        setMsg(e?.message ?? "불러오기 실패");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 시장 옵션 목록 (rows에서 추출)
  const marketOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; sort_order: number }>();

    for (const r of rows) {
      const v = pickVendor(r);
      const m = pickMarket(v);
      if (!m?.id) continue;
      map.set(m.id, { id: m.id, name: m.name ?? "-", sort_order: Number(m.sort_order ?? 999) });
    }

    return Array.from(map.values()).sort(
      (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)
    );
  }, [rows]);

  // 필터/검색/정렬 적용 (클라이언트)
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    let list = rows.slice();

    if (market !== "all") {
      list = list.filter((r) => {
        const v = pickVendor(r);
        const m = pickMarket(v);
        return m?.id === market;
      });
    }

    if (status !== "all") {
      list = list.filter((r) => r.status === status);
    }

    if (rtype !== "all") {
      list = list.filter((r) =>
        rtype === "simple" ? r.receipt_type === "simple" : r.receipt_type === "standard"
      );
    }

    if (pm !== "all") {
      list = list.filter((r) => r.payment_method === pm);
    }

    if (query) {
      list = list.filter((r) => {
        const v = pickVendor(r);
        const m = pickMarket(v);

        const name = (v?.name ?? "").toLowerCase();
        const stall = (v?.stall_no ?? "").toLowerCase();
        const marketName = (m?.name ?? "").toLowerCase();

        return name.includes(query) || stall.includes(query) || marketName.includes(query);
      });
    }

    if (sort === "amount_desc") {
      list.sort((a, b) => Number(b.amount) - Number(a.amount));
    } else if (sort === "amount_asc") {
      list.sort((a, b) => Number(a.amount) - Number(b.amount));
    } else {
      list.sort((a, b) => (a.created_at < b.created_at ? 1 : -1)); // 최신순
    }

    return list;
  }, [rows, q, market, status, rtype, pm, sort]);

  const totalSum = useMemo(
    () => filtered.reduce((acc, r) => acc + Number(r.amount || 0), 0),
    [filtered]
  );

  return (
    <div style={{ maxWidth: 420, margin: "0 auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <Link href="/vendors" style={{ textDecoration: "underline", fontSize: 14 }}>
          ← 상가
        </Link>
        <h1 style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>전체 영수증</h1>
      </div>

      {/* 검색 */}
      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="상가명/호수/시장 검색"
          style={{ padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
        />

        {/* 필터 */}
        <div style={{ display: "grid", gap: 8 }}>
          <select
            value={market}
            onChange={(e) => setMarket(e.target.value)}
            style={{ padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
          >
            <option value="all">시장: 전체</option>
            {marketOptions.map((m) => (
              <option key={m.id} value={m.id}>
                시장: {m.name}
              </option>
            ))}
          </select>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              style={{ padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
            >
              <option value="all">상태: 전체</option>
              <option value="needs_fix">상태: 수정</option>
              <option value="requested">상태: 요청</option>
              <option value="uploaded">상태: 업로드</option>
              <option value="completed">상태: 완료</option>
            </select>

            <select
              value={rtype}
              onChange={(e) => setRtype(e.target.value)}
              style={{ padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
            >
              <option value="all">유형: 전체</option>
              <option value="standard">유형: 일반</option>
              <option value="simple">유형: 간이</option>
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <select
              value={pm}
              onChange={(e) => setPm(e.target.value)}
              style={{ padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
            >
              <option value="all">지급: 전체</option>
              <option value="cash">지급: 현금</option>
              <option value="transfer">지급: 입금</option>
            </select>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              style={{ padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
            >
              <option value="new">정렬: 최신</option>
              <option value="amount_desc">정렬: 금액↓</option>
              <option value="amount_asc">정렬: 금액↑</option>
            </select>
          </div>
        </div>
      </div>

      {/* 요약 */}
      <div style={{ marginTop: 12, fontSize: 13, opacity: 0.8 }}>
        {loading ? "불러오는 중..." : `총 ${filtered.length}건 · 합계 ${formatMoney(totalSum)}원`}
      </div>

      {msg && (
        <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85, whiteSpace: "pre-wrap" }}>
          {msg}
        </div>
      )}

      <div style={{ marginTop: 12, borderTop: "1px solid #eee" }} />

      {/* 리스트 */}
      {loading ? null : filtered.length === 0 ? (
        <div style={{ marginTop: 12, fontSize: 14, opacity: 0.7 }}>조건에 맞는 영수증이 없어요.</div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {filtered.map((r) => {
            const v = pickVendor(r);
            const m = pickMarket(v);

            const vendorName = v?.name ?? "(상가)";
            const stall = v?.stall_no ? `[${v.stall_no}] ` : "";
            const marketName = m?.name ?? "-";

            return (
              <li
                key={r.id}
                onClick={() => router.push(`/vendors/${r.vendor_id}`)}
                style={{
                  padding: "12px 0",
                  borderBottom: "1px solid #f2f2f2",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 900 }}>
                    [{marketName}] {stall}
                    {vendorName}
                  </div>
                  <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.7 }}>
                    {new Date(r.created_at).toLocaleDateString("ko-KR")}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>
                    {formatMoney(Number(r.amount))}원
                  </div>

                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: 12,
                      padding: "4px 8px",
                      border: "1px solid #ddd",
                      borderRadius: 999,
                    }}
                  >
                    {statusLabel(r.status)}
                  </span>
                </div>

                <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span
                    style={{
                      fontSize: 12,
                      padding: "4px 8px",
                      border: "1px solid #eee",
                      borderRadius: 999,
                      opacity: 0.8,
                    }}
                  >
                    {r.payment_method === "transfer" ? "입금" : "현금"}
                    {r.payment_method === "transfer" && r.deposit_date ? ` · ${r.deposit_date}` : ""}
                  </span>

                  {r.receipt_type === "simple" ? (
                    <span
                      style={{
                        fontSize: 12,
                        padding: "4px 8px",
                        border: "1px solid #eee",
                        borderRadius: 999,
                        opacity: 0.8,
                      }}
                    >
                      간이영수증
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
