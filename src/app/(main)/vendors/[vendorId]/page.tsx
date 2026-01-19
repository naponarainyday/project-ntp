"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ChevronDown } from "lucide-react";

type ReceiptStatus = "uploaded" | "requested" | "needs_fix" | "completed";
type PaymentMethod = "cash" | "transfer";
type PeriodKey = "today" | "this_month" | "last_month" | "custom";

type VendorInfo = {
  id: string;
  name: string;
  stall_no: string | null;
  invoice_capability: "supported" | "not_supported" | null;
  markets?: { name: string | null } | null;
};

type ReceiptRow = {
  id: string;
  vendor_id: string;
  amount: number;
  status: ReceiptStatus;
  payment_method: PaymentMethod;
  deposit_date: string | null;
  receipt_date?: string | null;
  created_at: string;
  image_path: string | null;
  memo?: string | null;
};

const STATUS_ORDER: ReceiptStatus[] = ["needs_fix", "requested", "uploaded", "completed"];

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

function formatMoney(n: number) {
  try {
    return Number(n).toLocaleString("ko-KR");
  } catch {
    return String(n);
  }
}

function formatCount(n: number) {
  return n >= 99 ? "99+" : String(n);
}

function formatStallNo(stallNo: string | null) {
  if (!stallNo) return "";
  const t = `${stallNo}`.trim();
  if (!t) return "";
  return t.endsWith("호") ? t : `${t}호`;
}

function capabilityDot(cap: VendorInfo["invoice_capability"]) {
  return cap === "supported" ? "🔴" : "🔘";
}

function statusButtonStyle(s: ReceiptStatus) {
  if (s === "uploaded") return { border: "#000936", bg: "#FFFFFF", text: "#000000" };
  if (s === "requested") return { border: "#16A34A", bg: "#FFFFFF", text: "#01240E" };
  if (s === "needs_fix") return { border: "#F59E0B", bg: "#FFFFFF", text: "#92400E" };
  return { border: "#9CA3AF", bg: "#F3F3F3", text: "#374151" };
}

function parseDateKey(r: ReceiptRow) {
  const s = r.receipt_date ?? r.deposit_date ?? r.created_at;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : 0;
}

function truncateMemo(memo?: string | null, maxLen = 20) {
  if (!memo) return "";
  const t = memo.trim();
  if (!t) return "";
  return t.length > maxLen ? `${t.slice(0, maxLen)}…` : t;
}

function formatListDate(r: ReceiptRow) {
  const s = r.receipt_date ?? r.deposit_date ?? r.created_at;
  const d = new Date(s);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}.${mm}.${dd}`;
}

function lockBodyScroll(lock: boolean) {
  if (typeof document === "undefined") return;
  document.body.style.overflow = lock ? "hidden" : "";
}

function periodLabel(p: PeriodKey) {
  switch (p) {
    case "today":
      return "오늘";
    case "this_month":
      return "이번달";
    case "last_month":
      return "지난달";
    case "custom":
      return "직접설정";
    default:
      return "이번달";
  }
}

function getPeriodRange(p: PeriodKey, customFrom: string, customTo: string) {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
  const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

  if (p === "custom") {
    const from = customFrom ? new Date(customFrom) : null;
    const to = customTo ? new Date(customTo) : null;
    return { from, to };
  }
  if (p === "this_month") return { from: startOfMonth(now), to: endOfMonth(now) };
  if (p === "last_month") {
    const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return { from: startOfMonth(last), to: endOfMonth(last) };
  }

  return { from: startOfDay(now), to: endOfDay(now) };
}

export default function VendorReceiptsPage() {
  const params = useParams<{ vendorId: string }>();
  const vendorId = params.vendorId;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const [vendor, setVendor] = useState<VendorInfo | null>(null);
  const [rows, setRows] = useState<ReceiptRow[]>([]);

  // filter drawer
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [period, setPeriod] = useState<PeriodKey>("this_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [statusFilter, setStatusFilter] = useState<Set<ReceiptStatus>>(new Set());

  // expand row
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [imgUrlById, setImgUrlById] = useState<Record<string, string>>({});

  // selection + bulk
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<ReceiptStatus | null>(null);

  const selectedStatus = useMemo<ReceiptStatus | null>(() => {
    if (selectedIds.size === 0) return null;
    const first = rows.find((r) => selectedIds.has(r.id));
    return first?.status ?? null;
  }, [selectedIds, rows]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setMsg("");

      try {
        const { data: authData, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;

        const userId = authData?.user?.id ?? null;
        if (!userId) {
          router.push("/login");
          return;
        }

        const { data: v, error: vErr } = await supabase
          .from("vendors")
          .select("id, name, stall_no, invoice_capability, markets(name)")
          .eq("id", vendorId)
          .single();
        if (vErr) throw vErr;
        setVendor(v as any);

        const { data: r, error: rErr } = await supabase
          .from("receipts")
          .select("id, vendor_id, amount, status, payment_method, deposit_date, receipt_date, created_at, image_path, memo")
          .eq("vendor_id", vendorId)
          .order("created_at", { ascending: false });

        if (rErr) throw rErr;
        setRows((r ?? []) as ReceiptRow[]);
      } catch (e: any) {
        console.log("VENDOR RECEIPTS LOAD ERROR:", e);
        setMsg(e?.message ?? "불러오기 실패");
      } finally {
        setLoading(false);
      }
    })();
  }, [vendorId, router]);

  useEffect(() => {
    lockBodyScroll(isFilterOpen);
    return () => lockBodyScroll(false);
  }, [isFilterOpen]);

  const filterButtonText = useMemo(() => {
    const p = periodLabel(period);
    const s =
      statusFilter.size === 0
        ? "전체"
        : Array.from(statusFilter)
            .map((x) => statusLabel(x))
            .join(",");
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

    if (statusFilter.size > 0) list = list.filter((r) => statusFilter.has(r.status));

    list.sort((a, b) => parseDateKey(b) - parseDateKey(a));
    return list;
  }, [rows, period, customFrom, customTo, statusFilter]);

  const grouped = useMemo(() => {
    const map = new Map<ReceiptStatus, ReceiptRow[]>();
    for (const s of STATUS_ORDER) map.set(s, []);
    for (const r of filtered) map.get(r.status)?.push(r);
    return map;
  }, [filtered]);

  const clearSelection = () => {
    setSelectedIds(new Set());
    setPendingStatus(null);
  };

  const toggleSelect = (r: ReceiptRow) => {
    setMsg("");
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const isSelected = next.has(r.id);

      if (isSelected) {
        next.delete(r.id);
        return next;
      }

      // ✅ 같은 status만 묶어서 선택
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

  const ensureSignedUrl = async (row: ReceiptRow) => {
    if (!row.image_path) return;
    if (imgUrlById[row.id]) return;

    const { data, error } = await supabase.storage.from("receipts").createSignedUrl(row.image_path, 60 * 30);
    if (!error && data?.signedUrl) {
      setImgUrlById((prev) => ({ ...prev, [row.id]: data.signedUrl }));
    }
  };

  const toggleExpand = async (row: ReceiptRow) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(row.id)) next.delete(row.id);
      else next.add(row.id);
      return next;
    });
    await ensureSignedUrl(row);
  };

  // ✅ 홈과 같은 헤더 구성요소 (각각 스타일 따로)
  const marketName = vendor?.markets?.name ?? "-";
  const stallText = formatStallNo(vendor?.stall_no ?? null);
  const capDot = capabilityDot(vendor?.invoice_capability ?? "not_supported");

  return (
    <div style={{ maxWidth: 420, margin: "0 auto", padding: 6, paddingBottom: 90 }}>
      {/* ===== Header (홈 스타일로 분리) ===== */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 2px 10px",
          borderBottom: "1px solid #adadad",
        }}
      >
        {/* [market] */}
        <span style={{ fontSize: 12, opacity: 0.75, minWidth: 52 }}>[{marketName}]</span>

        {/* dot */}
        <span style={{ fontSize: 14, lineHeight: 1 }}>{capDot}</span>

        {/* name + stall_no */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 10,
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
              title={vendor?.name ?? ""}
            >
              {vendor?.name ?? "상가"}
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

        {/* filter */}
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
            padding: "7px 6px",
            display: "flex",
            alignItems: "center",
            gap: 6,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
          aria-label="필터"
        >
          <span>{filterButtonText}</span>
          <ChevronDown size={16} style={{ opacity: 0.9 }} />
        </button>
      </div>

      {msg ? <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9, whiteSpace: "pre-wrap" }}>{msg}</div> : null}

      {/* ===== Body ===== */}
      {loading ? (
        <div style={{ marginTop: 14, fontSize: 14, opacity: 0.8 }}>불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div style={{ marginTop: 14, fontSize: 14, opacity: 0.8 }}>조건에 맞는 영수증이 없어요.</div>
      ) : (
        <div style={{ marginTop: 6 }}>
          {STATUS_ORDER.map((s) => {
            const list = grouped.get(s) ?? [];
            if (list.length === 0) return null;

            const st = statusButtonStyle(s);

            return (
              <div key={s} style={{ marginTop: 10 }}>
                {/* ✅ 섹션 헤더: 홈처럼 (count + label) 한 박스 */}
                <div style={{ display: "flex", alignItems: "center", padding: "1px 0px" }}>
                  <span
                    style={{
                      fontSize: 12,
                      padding: "4px 8px",
                      borderRadius: 8,
                      border: `1px solid ${st.border}`,
                      background: st.bg,
                      color: st.text,
                      whiteSpace: "nowrap",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontWeight: 900,
                    }}
                    title={s}
                  >
                    <span style={{ opacity: 0.85 }}>({formatCount(list.length)})</span>
                    <span>{statusLabel(s)}</span>
                  </span>
                </div>

                {/* list */}
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {list.map((r) => {
                    const dateText = formatListDate(r);
                    const isSelected = selectedIds.has(r.id);
                    const isExpanded = expandedIds.has(r.id);
                    const isCompletedRow = r.status === "completed";

                    return (
                      <li
                        key={r.id}
                        style={{
                          borderBottom: "1px solid #CDCDCD",
                          background: isCompletedRow ? "#D9D9D9" : "#FFFFFF",
                          padding: "7px 1px",
                        }}
                      >
                        {/* ✅ 체크박스 + (체크박스 제외) 나머지 영역 클릭 = expand 토글 */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(r)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ width: 18, height: 18, cursor: "pointer" }}
                            aria-label="선택"
                          />

                          <div
                            onClick={() => toggleExpand(r)}
                            style={{
                              flex: 1,
                              minWidth: 0,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            {/* left: date + payment */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                                <div style={{ fontSize: 12, opacity: 0.85, minWidth: 62 }}>{dateText}</div>
                                {/* memo preview (1줄, ellipsis) */}
                                {r.memo ? (
                                  <div
                                    style={{
                                      flex: 1,
                                      minWidth: 0,
                                      fontSize: 14,
                                      fontWeight: 800,
                                      color: "#000000",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}
                                    title={r.memo}
                                  >
                                    {truncateMemo(r.memo)}
                                  </div>
                                ) : (
                                  <div style={{ flex: 1}} />
                                )}  
                                <div style={{ fontSize: 12, color: "#898b8e", fontWeight: 500, flexShrink: 0 }}>
                                  {paymentLabel(r.payment_method)}
                                </div>
                              </div>
                            </div>

                            {/* right: amount + caret */}
                            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                              <div style={{ fontSize: 15, fontWeight: 600 }}>{formatMoney(Number(r.amount || 0))}원</div>
                              <span style={{ fontSize: 18, lineHeight: 1, opacity: 0.8 }}>{isExpanded ? "⌄" : "›"}</span>
                            </div>
                          </div>
                        </div>

                        {/* ✅ expanded: 2열 레이아웃 (이미지 | memo + 상세보기) */}
                        {isExpanded ? (
                          <div style={{ marginTop: 10, paddingLeft: 26 }}>
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1.2fr 1fr",
                                gap: 10,
                                alignItems: "start",
                              }}
                            >
                              {/* image */}
                              <div>
                                {imgUrlById[r.id] ? (
                                  <img
                                    src={imgUrlById[r.id]}
                                    alt="영수증"
                                    style={{
                                      width: "100%",
                                      maxHeight: 260,
                                      objectFit: "contain",
                                      borderRadius: 12,
                                      border: "1px solid #eee",
                                      background: "#fff",
                                      display: "block",
                                    }}
                                  />
                                ) : (
                                  <div style={{ fontSize: 12, opacity: 0.7 }}>이미지 불러오는 중…</div>
                                )}
                              </div>

                              {/* memo + detail */}
                              <div style={{ minWidth: 0 }}>
                                <div
                                  style={{
                                    fontSize: 12,
                                    color: "#374151",
                                    whiteSpace: "pre-wrap",
                                    wordBreak: "break-word",
                                    minHeight: 80,
                                  }}
                                >
                                  {(r.memo ?? "").trim() ? (r.memo ?? "").trim() : <span style={{ opacity: 0.55 }}>메모 없음</span>}
                                </div>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/receipts/new?id=${r.id}`);
                                  }}
                                  style={{
                                    marginTop: 10,
                                    width: "100%",
                                    border: "1px solid #E5E7EB",
                                    background: "#FFFFFF",
                                    borderRadius: 12,
                                    padding: "10px 12px",
                                    fontSize: 13,
                                    fontWeight: 800,
                                    cursor: "pointer",
                                  }}
                                >
                                  자세히 보기
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {/* =========================
          Filter Drawer (Bottom Sheet)
          ========================= */}
      {isFilterOpen ? (
        <>
          <div
            onClick={() => setIsFilterOpen(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", zIndex: 50 }}
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
                style={{ marginLeft: "auto", border: "none", background: "transparent", fontSize: 14, cursor: "pointer", fontWeight: 800 }}
              >
                확인
              </button>
            </div>

            {/* period */}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 800, opacity: 0.9, marginBottom: 8 }}>조회기간</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                {(["today", "this_month", "last_month", "custom"] as PeriodKey[]).map((p) => {
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
                    style={{ padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13 }}
                  />
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    style={{ padding: 10, borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 13 }}
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
                {(STATUS_ORDER as ReceiptStatus[]).map((s) => {
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
                        fontWeight: active ? 900 : 800,
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
                    setPeriod("this_month");
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
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 40, padding: 12, background: "#FFFFFF", borderTop: "1px solid #E5E7EB" }}>
          <div style={{ maxWidth: 420, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 800 }}>
                {selectedIds.size}개 선택됨 · 현재 {selectedStatus ? statusLabel(selectedStatus) : "-"}
                {pendingStatus && pendingStatus !== selectedStatus ? (
                  <span style={{ marginLeft: 8, fontWeight: 800, opacity: 0.8 }}>→ {statusLabel(pendingStatus)}</span>
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
                  cursor: !pendingStatus || bulkUpdating || pendingStatus === selectedStatus ? "not-allowed" : "pointer",
                  opacity: !pendingStatus || bulkUpdating || pendingStatus === selectedStatus ? 0.35 : 0.95,
                }}
              >
                확인
              </button>
            </div>

            <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {(STATUS_ORDER as ReceiptStatus[]).map((s) => {
                const st = statusButtonStyle(s);
                const isDisabled = s === selectedStatus || bulkUpdating;
                const isPicked = pendingStatus === s;

                const pickedBg = s === "completed" ? "#E9ECEF" : `color-mix(in srgb, ${st.border} 14%, white)`;

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

            {bulkUpdating ? <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>상태 변경 중…</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
