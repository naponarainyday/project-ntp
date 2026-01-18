"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ChevronDown } from "lucide-react"; // ✅ (4) chevron 아이콘

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
  receipt_date?: string | null; // ✅ 새로 사용 (없으면 created_at fallback)
  vendors?: Vendor[] | Vendor | null;
};

function formatMoney(n: number) {
  try {
    return Number(n).toLocaleString("ko-KR");
  } catch {
    return String(n);
  }
}

function statusLabel(s: ReceiptStatus) {
  switch (s) {
    case "uploaded":
      return "업로드";
    case "requested":
      return "요청중";
    case "needs_fix":
      return "수정필요";
    case "completed":
      return "완료";
    default:
      return s;
  }
}

function paymentLabel(pm: PaymentMethod) {
  return pm === "transfer" ? "입금" : "현금";
}

// join 결과(배열)에서 vendor/market을 안전하게 꺼내는 헬퍼
function pickVendor(r: Row): Vendor | null {
  const v = r.vendors as any;
  if (!v) return null;
  if (Array.isArray(v)) return v.length > 0 ? v[0] : null;
  return v;
}
function pickMarket(v: Vendor | null): Market | null {
  if (!v) return null;
  const ms: any = v.markets;
  if (!ms) return null;
  if (Array.isArray(ms)) return ms.length > 0 ? ms[0] : null;
  return ms;
}

function parseDateKey(r: Row) {
  const s = r.receipt_date ?? r.deposit_date ?? r.created_at;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : 0;
}

function formatListDate(r: Row) {
  const s = r.receipt_date ?? r.deposit_date ?? r.created_at;
  const d = new Date(s);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}.${mm}.${dd}`;
}

type PeriodKey = "3m" | "this_month" | "last_month" | "custom";

function periodLabel(p: PeriodKey) {
  switch (p) {
    case "3m":
      return "3개월";
    case "this_month":
      return "이번달";
    case "last_month":
      return "지난달";
    case "custom":
      return "직접설정";
    default:
      return "3개월";
  }
}

function getPeriodRange(p: PeriodKey, customFrom: string, customTo: string) {
  const now = new Date();
  const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
  const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

  if (p === "custom") {
    const from = customFrom ? new Date(customFrom) : null;
    const to = customTo ? new Date(customTo) : null;
    return { from, to };
  }

  if (p === "this_month") {
    return { from: startOfMonth(now), to: endOfMonth(now) };
  }

  if (p === "last_month") {
    const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return { from: startOfMonth(last), to: endOfMonth(last) };
  }

  const from = new Date(now);
  from.setMonth(from.getMonth() - 3);
  return { from, to: null };
}

function statusButtonStyle(s: ReceiptStatus) {
  if (s === "uploaded") return { border: "#000936", bg: "#FFFFFF", text: "#000000" };
  if (s === "requested") return { border: "#16A34A", bg: "#FFFFFF", text: "#01240E" };
  if (s === "needs_fix") return { border: "#F59E0B", bg: "#FFFFFF", text: "#92400E" };
  return { border: "#9CA3AF", bg: "#F3F3F3", text: "#374151" };
}

function lockBodyScroll(lock: boolean) {
  if (typeof document === "undefined") return;
  document.body.style.overflow = lock ? "hidden" : "";
}

export default function ReceiptsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [rows, setRows] = useState<Row[]>([]);

  // top search (vendor name only)
  const [vendorQuery, setVendorQuery] = useState("");

  // filter drawer state
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [period, setPeriod] = useState<PeriodKey>("3m");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  // status filter (empty => all)
  const [statusFilter, setStatusFilter] = useState<Set<ReceiptStatus>>(new Set());

  // selection + bulk status drawer
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectedStatus = useMemo<ReceiptStatus | null>(() => {
    if (selectedIds.size === 0) return null;
    const first = rows.find((r) => selectedIds.has(r.id));
    return first?.status ?? null;
  }, [selectedIds, rows]);

  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<ReceiptStatus | null>(null);

  useEffect(() => {
    (async () => {
      setMsg("");
      setLoading(true);

      try {
        const { data: authData, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;

        const userId = authData?.user?.id ?? null;
        if (!userId) {
          router.push("/login");
          return;
        }

        const { data, error } = await supabase
          .from("receipts")
          .select(
            `
              id, vendor_id, amount, status, payment_method, deposit_date, receipt_type, created_at, receipt_date,
              vendors:vendors!receipts_vendor_id_fkey (
                id, name, stall_no,
                markets:markets!vendors_market_id_fkey (id, name, sort_order)
              )
            `
          );

        if (error) throw error;

        setRows((data ?? []) as unknown as Row[]);
      } catch (e: any) {
        console.log("RECEIPTS LOAD ERROR:", e);
        setMsg(e?.message ?? "불러오기 실패");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    lockBodyScroll(isFilterOpen);
    return () => lockBodyScroll(false);
  }, [isFilterOpen]);

  const filtered = useMemo(() => {
    let list = rows.slice();

    const { from, to } = getPeriodRange(period, customFrom, customTo);
    if (from || to) {
      const fromT = from ? from.getTime() : null;
      const toT = to ? to.getTime() : null;

      list = list.filter((r) => {
        const t = parseDateKey(r);
        if (fromT !== null && t < fromT) return false;
        if (toT !== null && t > toT) return false;
        return true;
      });
    }

    if (statusFilter.size > 0) {
      list = list.filter((r) => statusFilter.has(r.status));
    }

    const q = vendorQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const v = pickVendor(r);
        const name = (v?.name ?? "").toLowerCase();
        return name.includes(q);
      });
    }

    list.sort((a, b) => parseDateKey(b) - parseDateKey(a));
    return list;
  }, [rows, vendorQuery, period, customFrom, customTo, statusFilter]);

  const filterButtonText = useMemo(() => {
    const p = periodLabel(period);
    const s =
      statusFilter.size === 0 ? "전체" : Array.from(statusFilter).map((x) => statusLabel(x)).join(",");
    return `${p}, ${s}`;
  }, [period, statusFilter]);

  const toggleStatusFilter = (s: ReceiptStatus) => {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setPendingStatus(null);
  };

  const toggleSelect = (r: Row) => {
    setMsg("");
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const isSelected = next.has(r.id);

      if (isSelected) {
        next.delete(r.id);
        return next;
      }

      if (next.size > 0) {
        const firstId = Array.from(next)[0];
        const first = rows.find((x) => x.id === firstId);
        if (first && first.status !== r.status) {
          setMsg("같은 상태의 건만 함께 선택할 수 있어요.");
          return next;
        }
      }

      next.add(r.id);
      return next;
    });
  };

  const canShowBulkDrawer = useMemo(() => {
    if (selectedIds.size === 0) return false;
    if (!selectedStatus) return false;

    for (const id of selectedIds) {
      const rr = rows.find((x) => x.id === id);
      if (!rr) continue;
      if (rr.status !== selectedStatus) return false;
    }
    return true;
  }, [selectedIds, selectedStatus, rows]);

  const bulkUpdateStatus = async (newStatus: ReceiptStatus) => {
    if (!selectedStatus) return;
    if (newStatus === selectedStatus) return;

    setMsg("");
    setBulkUpdating(true);

    const ids = Array.from(selectedIds);
    try {
      const { error } = await supabase.from("receipts").update({ status: newStatus }).in("id", ids);
      if (error) throw error;

      setRows((prev) => prev.map((r) => (selectedIds.has(r.id) ? { ...r, status: newStatus } : r)));
      clearSelection();
    } catch (e: any) {
      console.log("BULK UPDATE ERROR:", e);
      setMsg(e?.message ?? "상태 변경 실패");
    } finally {
      setBulkUpdating(false);
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: "0 auto", padding: 8, paddingBottom: 90 }}>
      {/* search + filter row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 0 }}>
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 8,
            border: "1px solid #D1D5DB",
            borderRadius: 14,
            padding: "10px 12px",
            background: "#fff",
          }}
        >
          <span style={{ fontSize: 16, opacity: 0.8 }}>🔎</span>
          <input
            value={vendorQuery}
            onChange={(e) => setVendorQuery(e.target.value)}
            placeholder="상가명 입력"
            style={{
              border: "none",
              outline: "none",
              width: "100%",
              fontSize: 14,
              background: "transparent",
            }}
          />
        </div>

        <button
          type="button"
          onClick={() => {
            if (canShowBulkDrawer) clearSelection();
            setIsFilterOpen(true);
          }}
          style={{
            border: "none",
            background: "transparent",
            fontSize: 13,
            padding: "8px 6px",
            display: "flex",
            alignItems: "center",
            gap: 6,
            cursor: "pointer",
            opacity: 1,
            whiteSpace: "nowrap",
          }}
          aria-label="필터"
        >
          <span>{filterButtonText}</span>
          {/* ✅ (4) ▼ -> ChevronDown */}
          <ChevronDown size={16} style={{ opacity: 0.9 }} />
        </button>
      </div>

      {msg ? (
        <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9, whiteSpace: "pre-wrap" }}>
          {msg}
        </div>
      ) : null}

      <div style={{ marginTop: 10, borderTop: "1px solid #E5E7EB" }} />

      {/* list */}
      {loading ? (
        <div style={{ marginTop: 14, fontSize: 14, opacity: 0.8 }}>불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div style={{ marginTop: 14, fontSize: 14, opacity: 0.8 }}>조건에 맞는 영수증이 없어요.</div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {filtered.map((r) => {
            const v = pickVendor(r);
            const vendorName = v?.name ?? "(상가)";
            const dateText = formatListDate(r);
            const isCompleted = r.status === "completed";
            const isSelected = selectedIds.has(r.id);
            const statusStyle = statusButtonStyle(r.status);

            return (
              <li
                key={r.id}
                style={{
                  display: "flex",
                  alignItems: "center", // ✅ (1) 행 전체를 세로 가운데로
                  gap: 7,
                  padding: "7px 1px",
                  background: isCompleted ? "#D9D9D9" : "#FFFFFF",
                  borderBottom: "1px solid #CDCDCD",
                }}
              >
                {/* checkbox */}
                <div style={{ display: "flex", alignItems: "center", paddingLeft: 0 }}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(r)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ width: 18, height: 18, cursor: "pointer" }}
                    aria-label="선택"
                  />
                </div>

                {/* main content (clickable) */}
                <div
                  onClick={() => router.push(`/vendors/${r.vendor_id}`)}
                  style={{
                    flex: 1,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center", // ✅ (1) 가운데 정렬 유지
                    minHeight: 40,
                  }}
                >
                  {/* left: date + vendor */}
                  <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <div style={{ fontSize: 12, opacity: 0.85, minWidth: 62 }}>{dateText}</div>
                    <div style={{ fontSize: 14, fontWeight: 800, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{vendorName}</div>
                  </div>

                  {/* right: payment + amount + status */}
                  <div
                    style={{
                      marginLeft: "auto",
                      display: "flex",
                      alignItems: "center", // ✅ (2) 한 줄로
                      gap: 8,
                    }}
                  >
                    {/* ✅ (2) payment method: amount 앞, 옅은 회색 */}
                    <div style={{ fontSize: 12, color: "#898b8e", fontWeight: 500 }}>
                      {paymentLabel(r.payment_method)}
                    </div>

                    <div style={{ fontSize: 15, fontWeight: 700 }}>{formatMoney(Number(r.amount || 0))} 원</div>

                    {/* ✅ (3) list에서만 status 버튼 “더 촘촘하게” */}
                    <button
                      type="button"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        fontSize: 11,
                        padding: "4px 4px", // ✅ 줄임
                        lineHeight: "14px",  // ✅ 줄임
                        borderRadius: 6,
                        border: `1px solid ${statusStyle.border}`,
                        background: statusStyle.bg,
                        color: statusStyle.text,
                        cursor: "default",
                      }}
                    >
                      {statusLabel(r.status)}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* =========================
          Filter Drawer (Bottom Sheet)
          ========================= */}
      {isFilterOpen ? (
        <>
          {/* backdrop */}
          <div
            onClick={() => setIsFilterOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.25)",
              zIndex: 50,
            }}
          />

          <div
            style={{
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 60,
              background: "#fff",
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              padding: 16,
              boxShadow: "0 -10px 30px rgba(0,0,0,0.12)",
              maxWidth: 420,
              margin: "0 auto",
            }}
          >
            <div style={{ display: "flex", alignItems: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 800, opacity: 0.9 }}>필터</div>
              <button
                onClick={() => setIsFilterOpen(false)}
                style={{
                  marginLeft: "auto",
                  border: "none",
                  background: "transparent",
                  fontSize: 14,
                  cursor: "pointer",
                  fontWeight: 800,
                }}
              >
                확인
              </button>
            </div>

            {/* period */}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 800, opacity: 0.9, marginBottom: 8 }}>
                조회기간
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                {(["3m", "this_month", "last_month", "custom"] as PeriodKey[]).map((p) => {
                  const active = period === p;
                  return (
                    <button
                      key={p}
                      onClick={() => setPeriod(p)}
                      style={{
                        padding: "10px 8px",
                        borderRadius: 10,
                        border: "1px solid #E5E7EB",
                        background: active ? "#E5E7EB" : "#F3F4F6",
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      {periodLabel(p)}
                    </button>
                  );
                })}
              </div>

              {period === "custom" ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      border: "1px solid #E5E7EB",
                      fontSize: 13,
                    }}
                  />
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      border: "1px solid #E5E7EB",
                      fontSize: 13,
                    }}
                  />
                </div>
              ) : null}
            </div>

            {/* status filter */}
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 800, opacity: 0.9, marginBottom: 8 }}>
                상태 <span style={{ fontSize: 12, fontWeight: 600, opacity: 0.65 }}>(미선택=전체)</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                {(["uploaded", "requested", "needs_fix", "completed"] as ReceiptStatus[]).map((s) => {
                  const active = statusFilter.has(s);
                  const st = statusButtonStyle(s);

                  return (
                    <button
                      key={s}
                      onClick={() => toggleStatusFilter(s)}
                      style={{
                        padding: "10px 8px",
                        borderRadius: 10,
                        border: `2px solid ${active ? st.border : "#E5E7EB"}`,
                        background: "#FFFFFF",
                        color: active ? st.text : "#111827",
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      {statusLabel(s)}
                    </button>
                  );
                })}
              </div>

              <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                <button
                  onClick={() => setStatusFilter(new Set())}
                  style={{
                    flex: 1,
                    padding: 10,
                    borderRadius: 12,
                    border: "1px solid #E5E7EB",
                    background: "#F9FAFB",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  상태 전체
                </button>

                <button
                  onClick={() => {
                    setPeriod("3m");
                    setCustomFrom("");
                    setCustomTo("");
                    setStatusFilter(new Set());
                  }}
                  style={{
                    flex: 1,
                    padding: 10,
                    borderRadius: 12,
                    border: "1px solid #E5E7EB",
                    background: "#F9FAFB",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  초기화
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {/* =========================
          Bulk Status Drawer (Sticky)
          ========================= */}
      {canShowBulkDrawer ? (
        <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 40,
            padding: 12,
            background: "#FFFFFF",
            borderTop: "1px solid #E5E7EB",
          }}
        >
          <div style={{ maxWidth: 420, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center"}}>
              <div style={{ fontSize: 13, fontWeight: 800 }}>
                {selectedIds.size}개 선택됨 · 현재 {selectedStatus ? statusLabel(selectedStatus) : "-"}
                {pendingStatus && pendingStatus !== selectedStatus ? (
                  <span style={{ marginLeft: 8, fontWeight: 800, opacity: 0.8}}>
                    → {statusLabel(pendingStatus)}
                  </span>
                ) : null}
              </div>

              <button
                onClick={() => {
                  if (!pendingStatus) return;
                  bulkUpdateStatus(pendingStatus);
                  setPendingStatus(null);
                }}
                disabled={!pendingStatus || bulkUpdating || pendingStatus === selectedStatus}
                style={{
                  marginLeft: "auto",
                  border: "none",
                  background: "transparent",
                  padding: "6px 8px",
                  fontSize: 13,
                  fontWeight: 900,
                  cursor:
                    !pendingStatus || bulkUpdating || pendingStatus === selectedStatus
                      ? "not-allowed"
                      : "pointer",
                  opacity:
                    !pendingStatus || bulkUpdating || pendingStatus === selectedStatus ? 0.35 : 0.95,
                }}
              >
                확인
              </button>
            </div>

            <div
              style={{
                marginTop: 10,
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 8,
              }}
            >
              {(["uploaded", "requested", "needs_fix", "completed"] as ReceiptStatus[]).map((s) => {
                const st = statusButtonStyle(s);

                const isDisabled = s === selectedStatus || bulkUpdating; // bulkUpdating도 같이 잠금
                const isPicked = pendingStatus === s; // ✅ “선택됨” 표시

                // ✅ 선택 시: border 두껍게 + 배경을 연하게 틴트 + 살짝 그림자
                // (완료만 보이던 문제 해결: 나머지 상태도 border 색으로 tint를 만들어 줌)
                const pickedBg =
                  s === "completed"
                    ? "#E9ECEF" // 완료는 원래 회색 계열이라 조금 더 진한 틴트
                    : `color-mix(in srgb, ${st.border} 14%, white)`; // 최신 브라우저 지원 (크롬/사파리/엣지 대부분 OK)

                return (
                  <button
                    key={s}
                    onClick={() => setPendingStatus(s)}
                    disabled={isDisabled}
                    style={{
                      padding: "10px 8px",
                      borderRadius: 12,

                      border: `${isPicked ? 2 : 1}px solid ${st.border}`,
                      background: isPicked ? pickedBg : "#FFFFFF",

                      color: st.text,
                      fontSize: 13,
                      fontWeight: isPicked ? 900 : 800,

                      cursor: isDisabled ? "not-allowed" : "pointer",
                      opacity: isDisabled ? 0.5 : 1,

                      // ✅ 선택감 강화(살짝 눌린 느낌)
                      boxShadow: isPicked ? `0 0 0 2px rgba(0,0,0,0.04)` : "none",
                      transform: isPicked ? "translateY(-1px)" : "none",
                      transition: "all 120ms ease",
                    }}
                  >
                    {statusLabel(s)}
                  </button>
                );
              })}
            </div>


            {bulkUpdating ? (
              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>상태 변경 중…</div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
