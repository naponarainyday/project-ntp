"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ChevronDown, Copy } from "lucide-react";
import ReceiptLightbox from "@/components/ReceiptLightbox"
import ErrorPopup from "@/components/ErrorPopup";
import { useHeaderAction } from "@/components/HeaderActionContext";

type ReceiptStatus = "uploaded" | "requested" | "needs_fix" | "completed";
type PaymentMethod = "cash" | "transfer" | "payable";
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
  tax_type: TaxType | null;
  vat_amount: number | null;
  total_amount: number | null;
  status: ReceiptStatus;
  payment_method: PaymentMethod;
  deposit_date: string | null;
  receipt_date?: string | null;
  created_at: string;
  image_path: string | null;
  memo?: string | null;
  receipt_images?: ReceiptImageLite[] | null;
};

type ReceiptImageLite = {
  path: string;
  sort_order: number; // 1~3
};

type TaxType = "tax_free" | "tax" | "zero_rate";

function taxTypeLabel(t: TaxType) {
  if (t === "tax_free") return "면세";
  if (t === "zero_rate") return "영세";
  return "과세";
}

const STATUS_ORDER: ReceiptStatus[] = ["needs_fix", "uploaded", "requested", "completed"];

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
  if (pm==="transfer") return "입금";
  if (pm==="payable") return "미수";
  return "현금";
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
  if (s === "requested") return { border: "#8dafe6", bg: "#c1d2ee", text: "#000000" };
  if (s === "needs_fix") return { border: "#efa6a3", bg: "#f3cfce", text: "#000000" };
  return { border: "#9CA3AF", bg: "#eae9e9", text: "#000000" };
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
  const params = useParams<{ vendorId: string | string[] }>();
  const vendorId = Array.isArray(params.vendorId) ? params.vendorId[0] : params.vendorId;
  const router = useRouter();
  const { setAction } = useHeaderAction();

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
  const [paymentFilter, setPaymentFilter] = useState<Set<PaymentMethod>>(new Set());
  const [taxTypeFilter, setTaxTypeFilter] = useState<Set<TaxType>>(new Set()); // ✅ 추가

  // error popup
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const openError = (m: string) => {
    setErrorMsg(m);
    setErrorOpen(true);
  };  

  const statusDescriptions: Record<ReceiptStatus, string> = {
    uploaded: "영수증 업로드 후 아직 계산서 발행 요청을 하지 않은 상태입니다.",
    requested: "계산서 발행을 요청한 상태입니다.",
    needs_fix: "계산서 발행 요청에 문제가 있어 수정이 필요한 상태입니다.",
    completed: "세금계산서 발행이 완료된 상태입니다.",
  };

  // expand row
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  // 변경: 3장 배열로 저장
  const [imgUrlsById, setImgUrlsById] = useState<Record<string, Array<string | null>>>({});

  // ✅ 같은 row에 대해 createSignedUrl 중복 호출 방지 (로딩 무한 방지 핵심)
  const signingIdsRef = useRef<Set<string>>(new Set());

  // lightbox
  const [lightboxOpen, setLightboxOpen] = useState<{
  urls: string[];
  startIndex: number;
} | null>(null);

  // selection + bulk
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [isStatusDrawerOpen, setIsStatusDrawerOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<ReceiptStatus | null>(null);

  const selectedRows = useMemo(() => {
    if (selectedIds.size === 0) return [];
    return rows.filter((r) => selectedIds.has(r.id));
  }, [rows, selectedIds]);

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
          .select(`
            id, vendor_id, tax_type, amount, vat_amount, total_amount, status, payment_method, deposit_date, receipt_date, created_at, image_path, memo,
            receipt_images(path, sort_order)
          `)
          .eq("vendor_id", vendorId)
          .order("created_at", { ascending: false });

        if (rErr) throw rErr;
        setRows(
          ((r ?? []) as ReceiptRow[]).map((x) => ({
            ...x,
            receipt_images: (x.receipt_images ?? []) as any,
          }))
        );
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

  const periodText = useMemo(() => periodLabel(period), [period]);

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
      if (next.has(s)) next.delete(s);
      else next.add(s);
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

  const uniformSelectedTaxType = useMemo<TaxType | null>(() => {
    if (selectedRows.length === 0) return null;
    const t0 = selectedRows[0].tax_type ?? null;
    if (!t0) return null;
    for (const r of selectedRows) if (r.tax_type !== t0) return null;
    return t0;
  }, [selectedRows]);

  const onClickCopy = useCallback(() => {
      if (selectedRows.length === 0) {
        openError("내보낼 영수증을 선택해 주세요.");
        return;
      }

      if (!uniformSelectedStatus || !uniformSelectedTaxType) {
        openError(
          "같은 과세구분, 영수증 상태 끼리만 내보내기 가능합니다."
        );
        return;
      }

      sessionStorage.setItem(
        "vendor_export_payload",
        JSON.stringify({
          vendorId,
          receiptIds: Array.from(selectedIds),
          status: uniformSelectedStatus,
          taxType: uniformSelectedTaxType,
        })
      );

      router.push(`/vendors/${vendorId}/export`);
    }, [selectedRows.length, uniformSelectedStatus, uniformSelectedTaxType, vendorId, selectedIds, router]);

    useEffect(() => {
      setAction(
        <button
          type="button"
          onClick={onClickCopy}
          className="
            h-8 w-8 rounded-lg
            text-slate-300
            hover:bg-slate-800 hover:text-white
            transition
            flex items-center justify-center
          "
          aria-label="복사"
          title="복사"
        >
          <Copy size={18} />
        </button>
      );

      return () => {
        // ✅ 페이지 벗어나면 헤더 버튼 제거
        setAction(null);
      };
    }, [setAction, onClickCopy]);
  
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
    if (paymentFilter.size > 0) list = list.filter((r) => paymentFilter.has(r.payment_method));
    if (taxTypeFilter.size > 0) {
      list = list.filter((r) => {
        // r.tax_type 이 null 인 데이터는 필터 대상에서 제외
        if (!r.tax_type) return false;
        return taxTypeFilter.has(r.tax_type);
      });
    }

    list.sort((a, b) => parseDateKey(b) - parseDateKey(a));
    return list;
  }, [rows, period, customFrom, customTo, statusFilter, paymentFilter, taxTypeFilter]);

  const filteredBaseTotal = useMemo(() => {
    return filtered.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  }, [filtered]);

  const filteredVatTotal = useMemo(() => {
    return filtered.reduce((sum, r) => sum + Number(r.vat_amount || 0), 0);
  }, [filtered]);

  const selectedBaseTotal = useMemo(() => {
    return selectedRows.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  }, [selectedRows]);

  const selectedVatTotal = useMemo(() => {
    return selectedRows.reduce((sum, r) => sum + Number(r.vat_amount || 0), 0);
  }, [selectedRows]);

  const hasVat = filteredVatTotal > 0;

  const allFilteredIds = useMemo(() => filtered.map((r) => r.id), [filtered]);

  const allChecked = useMemo(() => {
    if (allFilteredIds.length === 0) return false;
    return allFilteredIds.every((id) => selectedIds.has(id));
  }, [allFilteredIds, selectedIds]);

  const toggleSelectAllFiltered = () => {
    setMsg("");
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allChecked) {
        allFilteredIds.forEach((id) => next.delete(id));
      } else {
        allFilteredIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const selectedTotal = useMemo(() => {
    return selectedRows.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  }, [selectedRows]);

  const selectedStatusText = useMemo(() => {
    if (selectedRows.length === 0) return null;
    const s0 = selectedRows[0].status;
    for (const r of selectedRows) {
      if (r.status !== s0) return "혼합";
    }
    return statusLabel(s0);
  }, [selectedRows]);

  const grouped = useMemo(() => {
    const map = new Map<ReceiptStatus, ReceiptRow[]>();
    for (const s of STATUS_ORDER) map.set(s, []);
    for (const r of filtered) map.get(r.status)?.push(r);
    return map;
  }, [filtered]);

 const filteredTotal = useMemo(() => {
    return filtered.reduce((sum, r) => sum + Number(r.amount || 0), 0);
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

      if (isSelected) next.delete(r.id);
      else next.add(r.id);

      return next;
    });
  };

  const bulkUpdateStatus = async (newStatus: ReceiptStatus) => {
    if (selectedIds.size ===0) return;
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

    const ensureSignedUrls = async (row: ReceiptRow) => {
    const id = row.id;

    // 이미 값이 있으면 끝 (null 3개라도 값이 있으면 "로딩중"이 안 뜸)
    if (imgUrlsById[id]) return;

    // ✅ 이미 요청 중이면 중복 요청 방지
    if (signingIdsRef.current.has(id)) return;
    signingIdsRef.current.add(id);

    // ✅ 로딩 상태를 먼저 박아둔다 (이게 "무한 로딩"을 끊는 핵심)
    setImgUrlsById((prev) => ({ ...prev, [id]: [] }));

    try {
      const imgs = (row.receipt_images ?? [])
        .slice()
        .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));

      const paths: string[] = [];
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
      
        const { data, error } = await supabase.storage
          .from("receipts")
          .createSignedUrl(p, 60 * 30);

        if (error) {
          console.log("SIGNED URL ERROR:", { receiptId: id, path: p, error });
          return null;
        }
        return data?.signedUrl ?? null;
      })
    );

      // ✅ 성공/실패 상관없이 결과를 확정 set (null이어도 OK)
      setImgUrlsById((prev) => ({ ...prev, [id]: signed }));
    } catch (e) {
      console.log("ensureSignedUrls failed:", e);
      // ✅ 실패해도 "로딩중"에서 빠져나오게 확정 set
      setImgUrlsById((prev) => ({ ...prev, [id]: [] }));
    } finally {
      signingIdsRef.current.delete(id);
    }
  };

  const toggleExpand = async (row: ReceiptRow) => {
    const id = row.id;
    const isAlreadyOpen = expandedIds.has(id);
    const nextWillOpen = !isAlreadyOpen;

    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

    if (nextWillOpen) await ensureSignedUrls(row);
  };

  // ✅ 홈과 같은 헤더 구성요소 (각각 스타일 따로)
  const marketName = vendor?.markets?.name ?? "-";
  const stallText = formatStallNo(vendor?.stall_no ?? null);
  const capDot = capabilityDot(vendor?.invoice_capability ?? "not_supported");

  return (
    <div style={{ margin: "0 auto", paddingBottom: 190 }}>

      {/* 상단 CTA */}
      <button
        onClick={() => router.push(`/vendors/${vendorId}/receipts/new`)}
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

      {/* ===== Header (홈 스타일로 분리) ===== */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          borderBottom: "1px solid #adadad",
        }}
      >
        {/* ✅ 전체 선택 (현재 선택 가능한 섹션 기준) */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
          <input
            type="checkbox"
            checked={allChecked}
            onChange={toggleSelectAllFiltered}
            style={{ width: 18, height: 18, cursor: "pointer" }}
            aria-label="전체 선택"
          />
        </div>
        
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
            setIsStatusDrawerOpen(false);
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
            {/* ✅ 섹션 헤더: status별 전체 선택 체크박스 추가 */}
            <div style={{ display: "flex", alignItems: "center", padding: "1px 0px", gap: 8 }}>
            {(() => {
              const groupIds = list.map((x) => x.id);

              const selectedCount = groupIds.reduce((acc, id) => acc + (selectedIds.has(id) ? 1 : 0), 0);
              const allSelected = groupIds.length > 0 && selectedCount === groupIds.length;
              const someSelected = selectedCount > 0 && !allSelected;

              const toggleGroup = () => {
                setMsg("");
                setSelectedIds((prev) => {
                  const next = new Set(prev);

                  if (allSelected) {
                    // ✅ 전부 선택된 상태면 이 그룹만 전부 해제
                    groupIds.forEach((id) => next.delete(id));
                  } else {
                    // ✅ 미선택/부분선택이면 이 그룹 전부 추가 선택(기존 선택 유지)
                    groupIds.forEach((id) => next.add(id));
                  }

                  return next;
                });
                setPendingStatus(null);
              };

              return (
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (!el) return;
                    el.indeterminate = someSelected; // ✅ 일부 선택이면 회색(대시) 상태
                  }}
                  onChange={toggleGroup}
                  style={{ width: 18, height: 18, cursor: groupIds.length ? "pointer" : "not-allowed" }}
                  disabled={groupIds.length === 0}
                  aria-label={`${statusLabel(s)} 전체 선택`}
                />
              );
            })()}

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
                                <div style={{ fontSize: 12, opacity: 0.8, marginRight: 4 }}>
                                  {paymentLabel(r.payment_method)}
                                  {r.tax_type ? `/${taxTypeLabel(r.tax_type)}` : ""}
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
                            {/* 1) 이미지 3장 1행 */}
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
                                    paddingBottom: 2,
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
                                        setLightboxOpen({ urls, startIndex: idx });
                                      }}
                                      style={{
                                        border: "1px solid #eee",
                                        background: "#fff",
                                        borderRadius: 10,
                                        padding: 0,
                                        overflow: "hidden",
                                        cursor: "pointer",

                                        // ✅ 3.3장 보이게
                                        flex: "0 0 30%",
                                        maxWidth: 160,
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


                            {/* 2) 구분선 */}
                            <div style={{ marginTop: 10, borderTop: "1px solid #E5E7EB" }} />

                            {/* 3) 메모 | 자세히 보기 2열 */}
                            <div
                              style={{
                                marginTop: 10,
                                display: "grid",
                                gridTemplateColumns: "1fr 120px",
                                gap: 10,
                                alignItems: "start",
                              }}
                            >
                              {/* memo */}
                              <div
                                style={{
                                  fontSize: 14,
                                  whiteSpace: "pre-wrap",
                                  wordBreak: "break-word",
                                  minHeight: 44,
                                }}
                              >
                                {(r.memo ?? "").trim() ? (r.memo ?? "").trim() : <span style={{ opacity: 0.55 }}>메모 없음</span>}
                              </div>

                              {/* detail button */}
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
              </div>
            );
          })}
        </div>
      )}

              {/* ✅ 선택 합계 + 상태 변경 안내 (합계바 위) */}
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
                  <div style={{ maxWidth: 420, margin: "0 auto", display: "flex", alignItems: "center", gap: 10, height: "100%" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, lineHeight: "16px" }}>
                      선택 합계 {formatMoney(selectedBaseTotal)} 원
                      {selectedVatTotal > 0 ? ` (부가세 ${formatMoney(selectedVatTotal)} 원)` : ""}
                    </div>

                    {/* ✅ vendorId 페이지에 상태 변경 버튼이 원래 있으면 여기 오른쪽에 유지 */}
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
                        whiteSpace: "nowrap",
                      }}
                    >
                      상태 변경
                    </button>
                  </div>
                </div>
              ) : null}

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
                  display: "flex",
                  alignItems: "stretch",
                }}
              >
                <div style={{ maxWidth: 420, width: "100%", marginLeft: "auto" }}>
                  <div
                    style={{
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      justifyContent: hasVat ? "flex-end" : "center",
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

      {/* Status Drawer */}
      {isStatusDrawerOpen ? (
        <>
          <div
            onClick={() => {
              setIsStatusDrawerOpen(false);
              setPendingStatus(null);
            }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", zIndex: 70 }}
          />

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

              // ✅ 여기(드로어 본체)에 스크롤/높이
              maxHeight: "70vh",
              overflowY: "auto",
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

            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {(["uploaded", "requested", "needs_fix", "completed"] as ReceiptStatus[]).map((s) => {
                const st = statusButtonStyle(s);
                const disabled = !uniformSelectedStatus || bulkUpdating || s === uniformSelectedStatus;

                return (
                  <button
                    key={s}
                    onClick={() => setPendingStatus(s)}
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

            {/* ✅ 설명 박스: map 밖, grid 아래 */}
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

            {bulkUpdating ? <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>상태 변경 중…</div> : null}
          </div>
        </>
      ) : null}


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
            {/* payment filter */}
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
            {/* tax type filter */}
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
              <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
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

      <ReceiptLightbox
        urls={lightboxOpen?.urls ?? []}
        startIndex={lightboxOpen?.startIndex ?? -1}
        onClose={() => setLightboxOpen(null)}
      />
      <ErrorPopup
        open={errorOpen}
        message={errorMsg}
        onClose={() => setErrorOpen(false)}
      />
    </div>
  );
}
