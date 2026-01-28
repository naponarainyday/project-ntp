"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ChevronDown, Search } from "lucide-react"; // ✅ (4) chevron 아이콘
import ReceiptLightbox from "@/components/ReceiptLightbox";

type ReceiptStatus = "uploaded" | "requested" | "needs_fix" | "completed";
type PaymentMethod = "cash" | "transfer" | "payable";
type ReceiptType = "standard" | "simple" | null;
type TaxType = "tax_free" | "tax" | "zero_rate";

type Market = { id: string; name: string | null; sort_order: number | null };
type Vendor = { id: string; name: string; stall_no: string | null; markets?: Market[] | Market | null };

type ReceiptImageLite = {
  path: string;
  sort_order: number;
};

type Row = {
  id: string;
  vendor_id: string;
  tax_type: TaxType | null;
  amount: number;
  vat_amount: number | null;
  total_amount: number | null;
  status: ReceiptStatus;
  payment_method: PaymentMethod;
  deposit_date: string | null;
  receipt_type: ReceiptType;
  created_at: string;
  receipt_date?: string | null;
  memo?: string | null;
  vendors?: Vendor[] | Vendor | null;
  image_path: string | null;
  receipt_images?: ReceiptImageLite[] | null
};

function formatMoney(n: number) {
  try {
    return Number(n).toLocaleString("ko-KR");
  } catch {
    return String(n);
  }
}

function taxTypeLabel(t: TaxType) {
  if (t === "tax_free") return "면세";
  if (t === "zero_rate") return "영세";
  return "과세";
}

function vatOf(r: Row) {
  return Number(r.vat_amount ?? 0);
}

function totalOf(r: Row) {
  return Number(r.total_amount ?? 0);
}

function statusLabel(s: ReceiptStatus) {
  switch (s) {
    case "uploaded":
      return "요청대기";
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
  if (pm === "transfer") return "입금";
  if (pm === "payable") return "미수";
  return "현금";
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

type PeriodKey = "today" | "this_month" | "last_month" | "custom";

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
  const endOfDay = (d:Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
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

  return { from: startOfDay(now), to: endOfDay(now)};
}

function statusButtonStyle(s: ReceiptStatus) {
  if (s === "uploaded") return { border: "#0e0e0e", bg: "#FFFFFF", text: "#000000" };
  if (s === "requested") return { border: "#8dafe6", bg: "#c1d2ee", text: "#000000" };
  if (s === "needs_fix") return { border: "#efa6a3", bg: "#f3cfce", text: "#000000" };
  return { border: "#9CA3AF", bg: "#eae9e9", text: "#050608" };
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
  const [period, setPeriod] = useState<PeriodKey>("this_month");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  // status filter (empty => all)
  const [statusFilter, setStatusFilter] = useState<Set<ReceiptStatus>>(new Set());
  
  // payment method filter (empty=> all)
  const [paymentFilter, setPaymentFilter] = useState<Set<PaymentMethod>>(new Set());

  // taxtype filter
  const [taxTypeFilter, setTaxTypeFilter] = useState<Set<TaxType>>(new Set());

  const statusDescriptions: Record<ReceiptStatus, string> = {
    uploaded: "영수증 업로드 후 아직 계산서 발행 요청을 하지 않은 상태입니다.",
    requested: "계산서 발행을 요청한 상태입니다.",
    needs_fix: "계산서 발행 요청에 문제가 있어 수정이 필요한 상태입니다.",
    completed: "세금계산서 발행이 완료된 상태입니다.",
  };

  // selection + bulk status drawer
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<ReceiptStatus | null>(null);

  // expand row
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [imgUrlsById, setImgUrlsById] = useState<Record<string, Array<string | null>>>({});
  const signingIdsRef = useRef<Set<string>>(new Set());

  // lightbox
  const [lightboxOpen, setLightboxOpen] = useState<{
    urls: string[];
    startIndex: number;
  } | null>(null);

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
              id, vendor_id, tax_type, amount, vat_amount, total_amount, status, payment_method, deposit_date, receipt_type, created_at, receipt_date, memo,
              image_path, receipt_images(path, sort_order), vendors:vendors!receipts_vendor_id_fkey (
                id, name, stall_no,
                markets:markets!vendors_market_id_fkey (id, name, sort_order)
              )
            `
          );

        if (error) throw error;

        setRows(
          ((data ?? []) as Row[]).map((x) => ({
            ...x,
            receipt_images: (x.receipt_images ?? []) as any,
          }))
        );
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

    if (paymentFilter.size > 0) {
      list = list.filter((r) => paymentFilter.has(r.payment_method));
    }

    if (taxTypeFilter.size > 0) {
      list = list.filter((r) => {
        if (!r.tax_type) return false;        // tax_type null은 제외(= vendorId와 동일)
        return taxTypeFilter.has(r.tax_type);
      });
    }

    const q = vendorQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const v = pickVendor(r);
        const name = (v?.name ?? "").toLowerCase();
        return name.includes(q);
      });
    }
    function parseCreatedAtKey(r: Row) {
      const t = Date.parse(r.created_at);
      return Number.isFinite(t) ? t : 0;
    }

    function compareReceiptDesc(a: Row, b: Row) {
      const d = parseDateKey(b) - parseDateKey(a);
      if (d !== 0) return d;

      const c = parseCreatedAtKey(b) - parseCreatedAtKey(a);
      if (c !== 0) return c;

      return String(b.id).localeCompare(String(a.id));
    }
    list.sort(compareReceiptDesc);
    return list;
  }, [rows, vendorQuery, period, customFrom, customTo, statusFilter, paymentFilter]);

  const allFilteredIds = useMemo(() => filtered.map((r) => r.id), [filtered]);

  const allChecked = useMemo(() => {
    if (allFilteredIds.length === 0) return false;
    return allFilteredIds.every((id) => selectedIds.has(id));
  }, [allFilteredIds, selectedIds]);

  const toggleSelectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allChecked) {
        // 현재 필터된 애들만 해제
        allFilteredIds.forEach((id) => next.delete(id));
      } else {
        // 현재 필터된 애들만 선택
        allFilteredIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const filteredBaseTotal = useMemo(() => {
    return filtered.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  }, [filtered]);

  const filteredVatTotal = useMemo(() => {
    return filtered.reduce((sum, r) => sum + vatOf(r), 0);
  }, [filtered]);

  const hasVat = filteredVatTotal > 0;

  // 필터 버튼에 보여줄 텍스트들 (3줄용)

  const periodText = useMemo(() => {
    return periodLabel(period);
  }, [period]);

    const ALL_STATUS = 4;   // uploaded, requested, needs_fix, completed
    const ALL_PAYMENT = 3;  // cash, transfer, payable
    const ALL_TAX = 3;      // tax_free, tax, zero_rate
  
    const statusText = useMemo(() => {
      return statusFilter.size === 0 || statusFilter.size === ALL_STATUS
        ? "전체"
        : Array.from(statusFilter).map((x) => statusLabel(x)).join(", ");
    }, [statusFilter]);
  
    const paymentText = useMemo(() => {
      return paymentFilter.size === 0 || paymentFilter.size === ALL_PAYMENT
        ? "전체"
        : Array.from(paymentFilter).map((x) => paymentLabel(x)).join(", ");
    }, [paymentFilter]);
  
    const taxTypeText = useMemo(() => {
      return taxTypeFilter.size === 0 || taxTypeFilter.size === ALL_TAX
        ? "전체"
        : Array.from(taxTypeFilter).map((x) => taxTypeLabel(x)).join(", ");
    }, [taxTypeFilter]);
  
  const toggleStatusFilter = (s: ReceiptStatus) => {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(s))
          next.delete(s);
        else {
        next.add(s);
      }
      return next;
    });
  };

  const togglePaymentFilter = (pm: PaymentMethod) => {
    setPaymentFilter((prev) => {
      const next = new Set(prev);
      if (next.has(pm)) next.delete(pm);
      else next.add(pm);
      return next;
    });
  };
  
  const toggleTaxTypeFilter = (tt: TaxType) => {
  setTaxTypeFilter((prev) => {
    const next = new Set(prev);
    if (next.has(tt)) next.delete(tt);
    else next.add(tt);
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

      next.add(r.id);
      return next;
    });
  };

  const selectedRows = useMemo(() => {
    if (selectedIds.size === 0) return [];
    const set = selectedIds;
    return rows.filter((r) => set.has(r.id));
  }, [rows, selectedIds]);

  const selectedBaseTotal = useMemo(() => {
    return selectedRows.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  }, [selectedRows]);

  const selectedVatTotal = useMemo(() => {
    return selectedRows.reduce((sum, r) => sum + vatOf(r), 0);
  }, [selectedRows]);

  const uniformSelectedStatus = useMemo<ReceiptStatus | null>(() => {
    if (selectedRows.length === 0) return null;
    const s = selectedRows[0].status;
    for (const r of selectedRows) if (r.status !== s) return null;
    return s;
  }, [selectedRows]);

  const statusDrawerDescription = useMemo(() => {
    const key = pendingStatus ?? uniformSelectedStatus;
    if (!key) return null;
    return statusDescriptions[key];
  }, [pendingStatus, uniformSelectedStatus]);
  
  const canOpenStatusDrawer = useMemo(() => {
    return selectedRows.length > 0 && !!uniformSelectedStatus;
  }, [selectedRows.length, uniformSelectedStatus]);

  const [isStatusDrawerOpen, setIsStatusDrawerOpen] = useState(false);

  const bulkUpdateStatus = async (newStatus: ReceiptStatus) => {
    if (!uniformSelectedStatus) return;
    if (newStatus === uniformSelectedStatus) return;

    setMsg("");
    setBulkUpdating(true);

    const ids = Array.from(selectedIds);
    try {
      const { error } = await supabase.from("receipts").update({ status: newStatus }).in("id", ids);
      if (error) throw error;

      setRows((prev) => prev.map((r) => (selectedIds.has(r.id) ? { ...r, status: newStatus } : r)));
      setIsStatusDrawerOpen(false);
      clearSelection();
    } catch (e: any) {
      console.log("BULK UPDATE ERROR:", e);
      setMsg(e?.message ?? "상태 변경 실패");
    } finally {
      setBulkUpdating(false);
    }
  };

  const ensureSignedUrls = async (row: Row) => {
  const id = row.id;

  // 이미 있으면 끝
  if (imgUrlsById[id]) return;

  // 중복 요청 방지
  if (signingIdsRef.current.has(id)) return;
  signingIdsRef.current.add(id);

  // 로딩 상태(3칸)
  setImgUrlsById((prev) => ({ ...prev, [id]: [] }));

  try {
    // 1) receipt_images 전부 가져오기 (정렬)
    const imgs = (row.receipt_images ?? [])
      .slice()
      .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));

    // 2) path 목록 만들기 (중복/빈값 제거)
    const paths:string[] = [];
    for (const it of imgs) {
      if (it?.path) paths.push(it.path);
    }

    // 3) fallback: 예전 image_path만 있는 경우
    if (paths.length === 0 && row.image_path) {
      paths.push(row.image_path);
    }

    const signed = await Promise.all(
      paths.map(async (p) => {
        if (!p) return null;
        const { data, error } = await supabase.storage.from("receipts").createSignedUrl(p, 60 * 30);
        if (error) {
          console.log("SIGNED URL ERROR:", { receiptId: id, path: p, error });
          return null;
        }
        return data?.signedUrl ?? null;
      })
    );
    // ✅ 결과 확정(실패한 건 null로 남음)
    setImgUrlsById((prev) => ({ ...prev, [id]: signed }));
  } catch (e) {
    console.log("ensureSignedUrls failed:", e);
    setImgUrlsById((prev) => ({ ...prev, [id]: [] }));
  } finally {
    signingIdsRef.current.delete(id);
  }
};

  const toggleExpand = async (row: Row) => {
    const id = row.id;
    const isOpen = expandedIds.has(id);
    const willOpen = !isOpen;

    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

    if (willOpen) await ensureSignedUrls(row);
  };

  return (
    <div style={{ margin: "0 auto", paddingBottom: 170 }}>
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
      {/* 전체 선택*/}
      <div style={{ display: "flex", alignItems: "center", gap:10, marginTop: 0 }}>
        <input
          type="checkbox"
          checked={allChecked}
          onChange={toggleSelectAllFiltered}
          style={{ width: 18, height: 18, cursor: "pointer"}}
          aria-label="전체 선택"
        />
  
      {/* search + filter row */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 8,
            border: "1px solid #D1D5DB",
            borderRadius: 14,
            padding: "10px 10px",
            background: "#fff",
            minWidth: 0,
          }}
        >
          <span style={{ fontSize: 15, opacity: 0.8, marginLeft: 3 }}> <Search size={18} /></span>
          <input
            value={vendorQuery}
            onChange={(e) => setVendorQuery(e.target.value)}
            placeholder="상가명 입력"
            style={{
              border: "none",
              outline: "none",
              width: "100%",
              marginLeft: 5,
              fontSize: 15,
              background: "transparent",
            }}
          />
        </div>

        <button
          type="button"
          onClick={() => {
            setIsFilterOpen(true);
          }}
          style={{
            border: "1px solid #ffffff",
            background: "#fff",
            borderRadius: 8,
            padding: "4px 6px",
            display: "flex",
            alignItems: "center",
            gap: 4,
            cursor: "pointer",
            whiteSpace: "nowrap",
            marginTop: 5
          }}
          aria-label="필터"
          >
          <div style={{ display: "grid", gap: 0, textAlign: "left" }}>
            <div style={{ fontSize: 12}}>
              기간: <span style={{ opacity: 0.8, fontWeight: 700 }}>{periodText}</span>
            </div>
            <div style={{ fontSize: 12}}>
              영수증 상태: <span style={{ opacity: 0.8, fontWeight: 700 }}>{statusText}</span>
            </div>
            <div style={{ fontSize: 12}}>
              지급방식: <span style={{ opacity: 0.8, fontWeight: 700 }}>{paymentText}</span>
            </div>
            <div style={{ fontSize: 12 }}>
              과세구분: <span style={{ opacity: 0.8, fontWeight: 700 }}>{taxTypeText}</span>
            </div>
          </div>

          <ChevronDown size={20} style={{ marginLeft: 1 }} />
          </button>
      </div>

      {msg ? (
        <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9, whiteSpace: "pre-wrap" }}>
          {msg}
        </div>
      ) : null}

      <div style={{ marginTop: 6, borderTop: "1px solid #E5E7EB" }} />

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
                  padding: "1px 1px",
                  background: isCompleted ? "#D9D9D9" : "#FFFFFF",
                  borderBottom: "1px solid #CDCDCD",
                }}>
                <div style= {{ display: "flex", alignItems: "center", gap: 8}}>
                  {/* checkbox */}
                  <div style={{ display: "flex", alignItems: "center", paddingLeft: 5 }}>
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
                    onClick={() => toggleExpand(r)}
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
                      <div style={{ fontSize: 12, opacity: 0.8 }}>
                        {paymentLabel(r.payment_method)}
                        {/* {r.tax_type ? `/${taxTypeLabel(r.tax_type)}` : ""} */}
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
                </div>
                  {/* ✅ expanded 영역 */}
                  {expandedIds.has(r.id) ? (
                    <div style={{ marginTop: 10, paddingLeft: 28, paddingRight: 6, paddingBottom: 10 }}>
                      {/* ✅ 이미지 캐러셀(가로 스크롤) */}
                      {(() => {
                        const list = imgUrlsById[r.id]; // Array<string | null> | undefined

                        if (!list) {
                          return <div style={{ fontSize: 12, opacity: 0.7 }}>이미지 불러오는 중…</div>;
                        }

                        const urls = list.filter((x): x is string => typeof x === "string");
                        if (urls.length === 0) {
                          return (
                            <div
                              style={{
                                border: "1px solid #eee",
                                borderRadius: 10,
                                padding: 14,
                                fontSize: 12,
                                opacity: 0.7,
                                background: "#fff",
                              }}
                            >
                              이미지 없음
                            </div>
                          );
                        }

                        return (
                          <div
                            style={{
                              display: "flex",
                              gap: 6,
                              overflowX: "auto",
                              overflowY: "hidden",
                              paddingBottom: 2, // 스크롤바 여유
                              scrollSnapType: "x mandatory",
                              WebkitOverflowScrolling: "touch",
                            }}
                          >
                            {urls.map((u, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLightboxOpen({ urls, startIndex: idx }); // ✅ 이제 idx가 바로 startIndex
                                }}
                                style={{
                                  border: "1px solid #eee",
                                  background: "#fff",
                                  borderRadius: 10,
                                  padding: 0,
                                  overflow: "hidden",
                                  cursor: "pointer",

                                  // ✅ 3.3장 보이게: 카드 폭을 컨테이너의 약 30%로
                                  // (3개 + 0.3개가 보이는 느낌)
                                  flex: "0 0 30%",
                                  maxWidth: 160, // 너무 커지는 거 방지(PC)
                                  aspectRatio: "1 / 1",

                                  scrollSnapAlign: "start",
                                }}
                                aria-label={`영수증 이미지 ${idx + 1} 크게보기`}
                              >
                                <img
                                  src={u}
                                  alt={`영수증 ${idx + 1}`}
                                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                />
                              </button>
                            ))}
                          </div>
                        );
                      })()}

                      <div style={{ marginTop: 10, borderTop: "1px solid #E5E7EB" }} />

                      {/* memo + 자세히 보기 */}
                      <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 120px", gap: 10 }}>
                        <div style={{ fontSize: 14, whiteSpace: "pre-wrap", wordBreak: "break-word", minHeight: 44 }}>
                          {(r.memo ?? "").trim() ? (r.memo ?? "").trim() : <span style={{ opacity: 0.55 }}>메모 없음</span>}
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/receipts/${r.id}`);
                          }}
                          style={{
                            width: "100%",
                            border: "1px solid #E5E7EB",
                            background: "#FFFFFF",
                            borderRadius: 12,
                            padding: "10px 10px",
                            fontSize: 13,
                            fontWeight: 800,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                          }}
                        >
                          자세히 보기
                        </button>
                      </div>
                    </div>
                  ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {/* ✅ 하단 고정: 필터된 전체 합계 */}
      <div
        style={{
          position: "fixed",
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: 448,
          bottom: 65,
          height: 60,
          zIndex: 30,
          background: "#efefef",
          borderTop: "1px solid #242424",
          padding: "6px 12px 8px",
          display: "flex",                // ✅ 추가
          alignItems: "stretch",
        }}
      >
        <div style={{ maxWidth: 420, width: "100%", marginLeft: "auto" }}>
          <div
            style={{
              height: "100%",              // ✅ 추가
              display: "flex",             // ✅ 추가
              flexDirection: "column",
              alignItems: "flex-end",
              justifyContent: hasVat ? "flex-end" : "center", // ✅ 핵심
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 900, lineHeight: "20px" }}>
              합계 (VAT 미포함)&nbsp;&nbsp;{formatMoney(filteredBaseTotal)} 원
            </div>

            {hasVat ? (
              <div style={{ fontSize: 14, fontWeight: 700, opacity: 0.85, marginTop: 5, lineHeight: "16px" }}>
                (부가세: {formatMoney(filteredVatTotal)} 원)
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {selectedRows.length > 0 ? (
        <div
          style={{
            position: "fixed",
            left: "50%",
            transform: "translateX(-50%)",
            width: "100%",
            maxWidth: 448,
            bottom: 125,
            height: 42,
            zIndex: 31,
            background: "#fafafa",
            borderTop: "1px solid #E5E7EB",
            padding: "2px 12px",
          }}
        >
          <div style={{ maxWidth: 420, margin: "0 auto", display: "flex", alignItems: "center", gap: 10, marginTop: 4, marginBottom: 2 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>
                선택 합계 {formatMoney(selectedBaseTotal)} 원
                {selectedVatTotal > 0 ? ` (부가세 ${formatMoney(selectedVatTotal)} 원)` : ""}
                
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setPendingStatus(uniformSelectedStatus);
                setIsStatusDrawerOpen(true);
              }}
              disabled={!canOpenStatusDrawer}
              style={{
                marginLeft: "auto",
                border: "1px solid #0B1F5B",
                background: canOpenStatusDrawer ? "#0B1F5B" : "#E5E7EB",
                color: canOpenStatusDrawer ? "#fff" : "#6B7280",
                borderRadius: 10,
                padding: "4px 10px",
                fontSize: 13,
                cursor: canOpenStatusDrawer ? "pointer" : "not-allowed",
              }}
              title={!canOpenStatusDrawer ? "같은 상태만 선택했을 때 변경 가능" : ""}
            >
              상태 변경
            </button>
          </div>
        </div>
      ) : null}

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
              paddingBottom: 24,
              boxShadow: "0 -10px 30px rgba(0,0,0,0.12)",
              maxWidth: 420,
              margin: "0 auto",
              maxHeight: "85vh",
              overflowY: "auto",
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
                        background: active ? "#cfcece" : "#F3F4F6",
                        fontSize: 13,
                        cursor: "pointer",
                        fontWeight: active ? 900 : undefined
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
                처리상태 <span style={{ fontSize: 12, fontWeight: 600, opacity: 0.65 }}>(미선택=전체)</span>
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
                        fontWeight: active ? 900 : undefined,
                      }}
                    >
                      {statusLabel(s)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 800, opacity: 0.9, marginBottom: 8 }}>
                지급구분 <span style={{ fontSize: 12, fontWeight: 600, opacity: 0.65 }}>(미선택=전체)</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {(["cash", "transfer", "payable"] as PaymentMethod[]).map((pm) => {
                  const active = paymentFilter.has(pm);

                  return (
                    <button
                      key={pm}
                      onClick={() => togglePaymentFilter(pm)}
                      style={{
                        padding: "10px 8px",
                        borderRadius: 10,
                        border: `2px solid ${active ? "#111827" : "#E5E7EB"}`,
                        background: "#FFFFFF",
                        color: "#111827",
                        fontSize: 13,
                        cursor: "pointer",
                        fontWeight: active ? 900 : undefined,
                      }}
                    >
                      {paymentLabel(pm)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 800, opacity: 0.9, marginBottom: 8 }}>
                과세구분 <span style={{ fontSize: 12, fontWeight: 600, opacity: 0.65 }}>(미선택=전체)</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {(["tax_free", "tax", "zero_rate"] as TaxType[]).map((tt) => {
                  const active = taxTypeFilter.has(tt);

                  return (
                    <button
                      key={tt}
                      onClick={() => toggleTaxTypeFilter(tt)}
                      style={{
                        padding: "10px 10px",
                        borderRadius: 10,
                        border: `2px solid ${active ? "#111827" : "#E5E7EB"}`,
                        background: "#FFFFFF",
                        color: "#111827",
                        fontSize: 13,
                        cursor: "pointer",
                        fontWeight: active ? 900 : undefined,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {taxTypeLabel(tt)}
                    </button>
                  );
                })}
              </div>
            </div>

              <div style={{ marginTop: 4, paddingTop: 12}}>  
                <button
                  onClick={() => {
                    setPeriod("this_month");
                    setCustomFrom("");
                    setCustomTo("");
                    setStatusFilter(new Set());
                    setPaymentFilter(new Set());
                    setTaxTypeFilter(new Set());
                  }}
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 12,
                    border: "1px solid #E5E7EB",
                    background: "#F9FAFB",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 800,
                  }}
                >
                  초기화
                </button>
            </div>        
          </div>
        </>
      ) : null}

      {isStatusDrawerOpen ? (
        <>
          <div
            onClick={() => setIsStatusDrawerOpen(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", zIndex: 70, }}
          />

        {/*drawer*/}
          <div
            style={{
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 80,
              background: "#fff",
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              padding: 16,
              boxShadow: "0 -10px 30px rgba(0,0,0,0.12)",
              maxWidth: 420,
              margin: "0 auto",
              maxHeight: "70vh",
              overflowY: "auto"
            }}
          >
            <div style={{ display: "flex", alignItems: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 900 }}>
                {selectedRows.length}개 · 현재 {uniformSelectedStatus ? statusLabel(uniformSelectedStatus) : "-"}
              </div>
              <button
                onClick={() => {
                  if (!pendingStatus) return;
                  bulkUpdateStatus(pendingStatus);
                }}
                disabled={
                  !pendingStatus ||
                  bulkUpdating ||
                  !uniformSelectedStatus ||
                  pendingStatus === uniformSelectedStatus
                }
                style={{
                  marginLeft: "auto",
                  border: "none",
                  background: "transparent",
                  fontSize: 14,
                  fontWeight: 900,
                  cursor:
                    !pendingStatus ||
                    bulkUpdating ||
                    !uniformSelectedStatus ||
                    pendingStatus === uniformSelectedStatus
                      ? "not-allowed"
                      : "pointer",
                  opacity:
                    !pendingStatus ||
                    bulkUpdating ||
                    !uniformSelectedStatus ||
                    pendingStatus === uniformSelectedStatus
                      ? 0.35
                      : 1,
                }}
              >
                확인
              </button>
            </div>

            {/* ✅ 상태 버튼 그리드 */}
            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {(["uploaded", "requested", "needs_fix", "completed"] as ReceiptStatus[]).map((s) => {
                const st = statusButtonStyle(s);
                const disabled = !uniformSelectedStatus || bulkUpdating || s === uniformSelectedStatus;

                return (
                  <button
                    key={s}
                    onClick={() => setPendingStatus(s)} // ✅ 기존 함수 그대로 재사용
                    disabled={!uniformSelectedStatus || bulkUpdating}
                    style={{
                      padding: "10px 8px",
                      borderRadius: 12,
                      border: `2px solid ${pendingStatus === s ? st.border : "#E5E7EB"}`,
                      background: "#fff",
                      color: st.text,
                      fontSize: 13,
                      fontWeight: 900,
                      cursor: disabled ? "not-allowed" : "pointer",
                      opacity: disabled ? 0.4 : 1,
                    }}
                  >
                    {statusLabel(s)}
                  </button>
                  
                );
              })}
            </div>
            {/* ✅ 설명 박스: map() 밖, 그리드 아래에 있어야 렌더됨 */}
            {statusDrawerDescription ? (
              <div
                style={{
                  marginTop: 12,
                  padding: "12px 14px",
                  borderRadius: 12,
                  background: "#f9f9f9",
                  border: "1px solid #e5e5e5",
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: "#333",
                }}
              >
                {statusDrawerDescription}
              </div>
            ) : null}

            {bulkUpdating ? (
              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>상태 변경 중…</div>
            ) : null}
                  {bulkUpdating ? <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>상태 변경 중…</div> : null}
                </div>
              </>
            ) : null}

      <ReceiptLightbox
        urls={lightboxOpen?.urls ?? []}
        startIndex={lightboxOpen?.startIndex ?? -1}
        onClose={() => setLightboxOpen(null)}
      />
    </div>
  );
}
