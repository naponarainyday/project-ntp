// src/app/(main)/receipts/new/ReceiptsNewClient.tsx

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Plus, Camera, X, Search } from "lucide-react";
import ReceiptLightbox from "@/components/ReceiptLightbox";

type TaxType = "tax_free" | "tax" | "zero_rate";
type PaymentMethod = "cash" | "transfer" | "payable";
type ReceiptStatus = "uploaded" | "requested" | "needs_fix" | "completed";
type ReceiptType = "standard" | "simple";
type InvoiceCapability = "supported" | "not_supported" | null;
type ReceiptImageRow = {
  id: string;
  receipt_id: string;
  user_id: string;
  path: string;
  sort_order: number; 
  created_at: string;
};

interface VendorOption {
  id: string;
  name: string;
  stall_no: string | null;
  market_name?: string | null;
  invoice_capability: InvoiceCapability;
  market_sort_order?: number | null;
  stall_no_num?: number | null;
}

type ReceiptRowForEdit = {
  id: string;
  vendor_id: string;
  tax_type: TaxType | null;
  amount: number;
  payment_method: PaymentMethod;
  deposit_date: string | null;
  receipt_date: string | null;
  receipt_type: ReceiptType;
  status: ReceiptStatus;
  memo: string | null;
  image_path: string | null;
};

type ExistingImage = {
  id: string;
  path: string;
  url: string | null;
  sort_order: number;
}

function todayYYYYMMDD() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function onlyDigits(s: string) {
  return s.replace(/[^\d]/g, "");
}

function formatNumberWithCommaFromDigits(digits: string) {
  if (!digits) return "";
  const n = Number(digits);
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat("ko-KR").format(n);
}

function formatStallNo(stallNo: string | null) {
  if (!stallNo) return "";
  const t = `${stallNo}`.trim();
  if (!t) return "";
  return t.endsWith("호") ? t : `${t}호`;
}

function capabilityDot(invoice_capability: InvoiceCapability) {
  return invoice_capability === "supported" ? "🔴" : "🔘";
}

// ✅ 업로드 전에 모든 이미지를 webp로 변환/리사이즈
const WEBP_MAX_SIDE = 1600;   // 긴 변 기준(원하면 1280~2048 사이로 조절)
const WEBP_QUALITY = 0.82;    // 0~1 (0.75~0.85 권장)

function getExtLower(name: string) {
  return (name.split(".").pop() || "").toLowerCase();
}

function isHeicLike(file: File) {
  const ext = getExtLower(file.name);
  return file.type === "image/heic" || file.type === "image/heif" || ext === "heic" || ext === "heif";
}

async function decodeToBitmap(file: File): Promise<ImageBitmap> {
  // HEIC/HEIF면 heic2any로 jpeg/png blob으로 변환 후 디코딩
  let blob: Blob = file;

  if (isHeicLike(file)) {
    const heic2any = (await import("heic2any")).default;
    const converted = await heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: 0.92,
    });

    // heic2any는 Blob 또는 Blob[]로 올 수 있음
    blob = Array.isArray(converted) ? converted[0] : converted;
  }

  // createImageBitmap이 가장 깔끔 (대부분 브라우저 OK)
  return await createImageBitmap(blob);
}

async function fileToWebpResized(file: File, slotIndex: number): Promise<File> {
  const bitmap = await decodeToBitmap(file);

  // 리사이즈 계산
  const w = bitmap.width;
  const h = bitmap.height;

  const maxSide = Math.max(w, h);
  const scale = maxSide > WEBP_MAX_SIDE ? WEBP_MAX_SIDE / maxSide : 1;

  const tw = Math.max(1, Math.round(w * scale));
  const th = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement("canvas");
  canvas.width = tw;
  canvas.height = th;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("이미지 변환에 실패했습니다.(canvas)");

  ctx.drawImage(bitmap, 0, 0, tw, th);
  bitmap.close?.();

  const webpBlob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("이미지 변환에 실패했습니다.(toBlob)"))),
      "image/webp",
      WEBP_QUALITY
    );
  });

  // 파일명은 webp로 고정
  const safeBase = (file.name || `image_${slotIndex + 1}`).replace(/\.[^/.]+$/, "");
  return new File([webpBlob], `${safeBase}.webp`, { type: "image/webp" });
}

export default function ReceiptsNewClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const editId = sp.get("edit"); // 있으면 수정모드
  const fromVendor = sp.get("fromVendor");

  const isEditMode = !!editId;

  // ---------- Vendor Search ----------
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVendor, setSelectedVendor] = useState<VendorOption | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const vendorPickerWrapRef = useRef<HTMLDivElement | null>(null);

  // ---------- Receipt Form ----------
  const IMAGE_ACCEPT = 
    "image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif";
  const filePickerRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);

  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [newPreviews, setNewPreviews] = useState<string[]>([]);

  const [existingImages, setExistingImages] = useState<ExistingImage[]>([]);
  const [existingRowsAll, setExistingRowsAll] = useState<ReceiptImageRow[]>([]);
  const [existingRows, setExistingRows] = useState<ReceiptImageRow[]>([]);

  const allPreviewItems = useMemo(() => {
    const existing = existingImages
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((x) => ({
        key: `ex_${x.path}`,
        src: x.url, // signed url
        kind: "existing" as const,
      }))
      .filter((x) => !!x.src);

    const news = newPreviews.map((src, idx) => ({
      key: `new_${idx}_${src}`,
      src,
      kind: "new" as const,
    }));

    return [...existing, ...news];
  }, [existingImages, newPreviews]);
  
  async function toSignedUrl(path: string) {
  const { data, error } = await supabase.storage.from("receipts").createSignedUrl(path, 60 * 10);
  if (error) return null;
  return data?.signedUrl ?? null;
  }

  useEffect(() => {
    if (!isEditMode) return;
    if (existingRows.length === 0) {
      setExistingImages([]);
      return;
    }

    (async () => {
      const urls = await Promise.all(existingRows.map((r) => toSignedUrl(r.path)));
      const next: ExistingImage[] = existingRows.map((r, idx) => ({
        id: r.id,
        path: r.path,
        url: urls[idx],
        sort_order: r.sort_order,
      }));
      setExistingImages(next);
    })();
  }, [isEditMode, existingRows]);


  // lightbox
  const [lbOpen, setLbOpen] = useState(false);
  const [lbIndex, setLbIndex] = useState(0);

  const [taxType, setTaxType] = useState<TaxType>("tax_free");
  const [amountDigits, setAmountDigits] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [depositDate, setDepositDate] = useState("");
  const [purchaseDate, setPurchaseDate] = useState<string>(todayYYYYMMDD());
  const [receiptType, setReceiptType] = useState<ReceiptType>("standard");
  const [status, setStatus] = useState<ReceiptStatus>("uploaded");
  const [memo, setMemo] = useState<string>("");

  const baseAmount = useMemo(() => {
    const n = Number(amountDigits || "0");
    return Number.isFinite(n) ? n : 0;
  }, [amountDigits]);
  
  const vatAmount = useMemo (() => {
    if (taxType !=="tax") return 0;
    // 공급가 기준 부가세 10% (원 단위 반올림)
    return Math.round(baseAmount * 0.1);
  }, [taxType, baseAmount])

  const totalAmount = useMemo(() => {
    if (taxType === "tax") return baseAmount + vatAmount;
    // 면세/영세는 합계 = 공급가(입력값)
    return baseAmount;
  }, [taxType, baseAmount, vatAmount]);

  const totalAmountDisplay = useMemo(
    () => new Intl.NumberFormat("ko-KR").format(totalAmount),
    [totalAmount]
  );

  const vatAmountDisplay = useMemo(
    () => new Intl.NumberFormat("ko-KR").format(vatAmount),
    [vatAmount]
  );

  const [sheetOpen, setSheetOpen] = useState(false);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // edit-mode helpers
  const [loadingEdit, setLoadingEdit] = useState(false);

  const effectiveStatus = useMemo<ReceiptStatus>(() => {
    return receiptType === "simple" ? "completed" : status;
  }, [receiptType, status]);

  const amountDisplay = useMemo(
    () => formatNumberWithCommaFromDigits(amountDigits),
    [amountDigits]
  );

  const hasAnyReceiptImage = useMemo(() => {
    if (newFiles.length > 0) return true; 
    if (isEditMode && existingImages.length > 0) return true;
    return false;
  }, [newFiles.length, isEditMode, existingImages.length]);


  // ---------- Load vendors ----------
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("v_vendor_list_page2")
        .select(
          "vendor_id, name, stall_no, invoice_capability, market_name, market_sort_order, stall_no_num"
        )
        .order("market_sort_order", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true })
        .order("stall_no_num", { ascending: true, nullsFirst: false })
        .order("stall_no", { ascending: true, nullsFirst: false });

      if (!error && data) {
        const formatted: VendorOption[] = (data ?? []).map((v: any) => ({
          id: v.vendor_id,
          name: v.name,
          stall_no: v.stall_no,
          market_name: v.market_name,
          invoice_capability: (v.invoice_capability as InvoiceCapability) ?? null,
          market_sort_order: v.market_sort_order ?? null,
          stall_no_num: v.stall_no_num ?? null,
        }));
        setVendors(formatted);
      }
    })();
  }, []);

  // ---------- edit: load receipt + hydrate form ----------
  useEffect(() => {
    if (!isEditMode) return;
    if (!editId) return;
    if (vendors.length === 0) return; // 벤더 목록 로드 후, selectedVendor 매핑

    let ignore = false;

    (async () => {
      setLoadingEdit(true);
      setMsg("");

      try {
        const { data: authData, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;

        const userId = authData?.user?.id ?? null;
        if (!userId) throw new Error("로그인이 필요합니다.");

        const { data, error } = await supabase
          .from("receipts")
          .select("id, vendor_id, amount, vat_amount, total_amount, tax_type, payment_method, deposit_date, receipt_date, receipt_type, status, memo, image_path")
          .eq("id", editId)
          .eq("user_id", userId)
          .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error("수정할 영수증을 찾을 수 없습니다.");

        if (ignore) return;

        const r = data as any as ReceiptRowForEdit;

        // vendor preselect
        const v = vendors.find((x) => x.id === r.vendor_id) ?? null;
        setSelectedVendor(v);
        setSearchQuery(v?.name ?? "");
        setTaxType((r as any).tax_type ?? "tax_free");
        setAmountDigits(String(r.amount ?? ""));
        setPaymentMethod((r.payment_method as PaymentMethod) ?? "cash");
        setDepositDate(r.deposit_date ?? "");
        setPurchaseDate(r.receipt_date ?? todayYYYYMMDD());
        setReceiptType((r.receipt_type as ReceiptType) ?? "standard");
        setStatus((r.status as ReceiptStatus) ?? "uploaded");
        setMemo(r.memo ?? "");

        // ✅ receipt_images 로드
        const { data: imgs, error: imgErr } = await supabase
          .from("receipt_images")
          .select("id, receipt_id, user_id, path, sort_order, created_at")
          .eq("receipt_id", editId)
          .eq("user_id", userId)
          .order("sort_order", { ascending: true });

        if (imgErr) throw imgErr;

        setExistingRowsAll(imgs ?? []);
        setExistingRows(imgs ?? []);

        const paths = (imgs ?? [])
          .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((x: any) => x.path)
          .filter(Boolean);
      
      } catch (e:any) {
        setMsg(e?.message ?? "수정 로드 오류");
      } finally {
        if (!ignore) setLoadingEdit(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [isEditMode, editId, vendors.length]);
          
  // ---------- Dropdown: outside click 닫기 ----------
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!showDropdown) return;
      const el = vendorPickerWrapRef.current;
      if (!el) return;
      if (el.contains(e.target as Node)) return;
      setShowDropdown(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [showDropdown]);

  // ---------- Filtering vendors ----------
  const filteredVendors = useMemo(() => {
    if (!searchQuery) return vendors;
    const lower = searchQuery.toLowerCase();
    return vendors.filter((v) => {
      const name = v.name.toLowerCase();
      const stall = (v.stall_no ?? "").toLowerCase();
      const market = (v.market_name ?? "").toLowerCase();
      return name.includes(lower) || stall.includes(lower) || market.includes(lower);
    });
  }, [searchQuery, vendors]);

  useEffect(() => {
  // 이전 url revoke
  newPreviews.forEach((u) => u && URL.revokeObjectURL(u));

  const next = newFiles.map((f) => URL.createObjectURL(f));
  setNewPreviews(next);

  return () => next.forEach((u) => u && URL.revokeObjectURL(u));
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [newFiles]);

  // ---------- Vendor select handler ----------
  const handleVendorSelect = (v: VendorOption) => {
    setSelectedVendor(v);
    setSearchQuery(v.name);
    setShowDropdown(false);
  };

// ---------- Image handlers (unlimited) ----------
function openAddSheet() {
  setSheetOpen(true);
}

function closeSheet() {
  setSheetOpen(false);
}

function removeNewAt(i: number) {
  setNewFiles((prev) => prev.filter((_, idx) => idx !== i));
}

function removeExistingByPath(path: string) {
  setExistingRows((prev) => prev.filter((r) => r.path !== path));
  setExistingImages((prev) => prev.filter((img) => img.path !== path));
}

// 여러 장 선택/촬영 → 전부 webp 변환 후 추가
async function addFilesAsWebp(list: FileList | null) {
  if (!list || list.length === 0) return;

  setMsg("");

  try {
    const rawList = Array.from(list);
    const converted: File[] = [];

    for (let i = 0; i < rawList.length; i++) {
      const webp = await fileToWebpResized(rawList[i], newFiles.length + i);
      converted.push(webp);
    }

    setNewFiles((prev) => [...prev, ...converted]);
  } catch (e: any) {
    console.error(e);
    setMsg(e?.message ?? "이미지 변환에 실패했습니다.");
  }
}

  // ---------- Save / Update ----------
  async function onSave() {
    setMsg("");

    if (loadingEdit) return;
    if (!selectedVendor) {
      setMsg("상가를 선택해 주세요.");
      return;
    }
    if (!purchaseDate) {
      setMsg("구매일자를 선택해 주세요.");
      return;
    }
    if (!hasAnyReceiptImage) {
      setMsg("최소 1장의 영수증 사진을 첨부해 주세요.");
      return;
    }
    const a = baseAmount;
    if (!Number.isFinite(a) || a <= 0) {
      setMsg("금액을 올바르게 입력해 주세요.");
      return;
    }
    if (paymentMethod === "transfer" && !depositDate) {
      setMsg("입금일을 선택해 주세요.");
      return;
    }
    setSaving(true);

    let uploadedNow: string[] = [];

    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;

      const userId = authData?.user?.id ?? null;
      if (!userId) throw new Error("로그인이 필요합니다.");

    // A) before / after (기존 이미지) path 계산
    const beforePaths = isEditMode ? (existingRowsAll.map(r => r.path).filter(Boolean)) : [];
    const afterExistingPaths = isEditMode ? (existingRows.map(r => r.path).filter(Boolean)) : [];

    // B) 새 파일 업로드 (무제한)
    const newPaths: string[] = [];
    if (newFiles.length > 0) {
      const ts = Date.now();
      for (let i = 0; i < newFiles.length; i++) {
        const f = newFiles[i];
        const path = `${userId}/${selectedVendor.id}/${ts}_${i + 1}.webp`;

        const { error: upErr } = await supabase.storage
          .from("receipts")
          .upload(path, f, {
            upsert: false,
            contentType: "image/webp",
            cacheControl: "3600",
          });

        if (upErr) throw upErr;

        newPaths.push(path);
        uploadedNow.push(path);
      }
    }

    // C) afterPaths = (기존 유지) + (새로 업로드)
    const afterPaths = [...afterExistingPaths, ...newPaths];

    const payload = {
      vendor_id: selectedVendor.id,
      tax_type: taxType,
      amount: baseAmount,
      vat_amount: vatAmount,
      total_amount: totalAmount,
      payment_method: paymentMethod,
      deposit_date: paymentMethod === "transfer" ? depositDate : null,
      receipt_type: receiptType,
      status: effectiveStatus,
      image_path: afterPaths[0] ?? null,
      receipt_date: purchaseDate,
      memo: memo,
    };

    // E) 등록
    if (!isEditMode) {
      const { data: inserted, error: insErr } = await supabase
        .from("receipts")
        .insert({ ...payload, user_id: userId })
        .select("id")
        .maybeSingle();

      if (insErr) throw insErr;
      const newReceiptId = inserted?.id;
      if (!newReceiptId) throw new Error("영수증 ID를 가져오지 못했습니다.");

      const rows = afterPaths.map((path, idx) => ({
        receipt_id: newReceiptId,
        user_id: userId,
        path,
        sort_order: idx + 1,
      }));

      if (rows.length > 0) {
        const { error: imgInsErr } = await supabase.from("receipt_images").insert(rows as any);
        if (imgInsErr) throw imgInsErr;
      }

      router.push("/receipts");
      router.refresh();
      return;
    }

    // F) 수정: receipts 업데이트
    const { error: upErr2 } = await supabase
      .from("receipts")
      .update(payload)
      .eq("id", editId!)
      .eq("user_id", userId);

    if (upErr2) throw upErr2;

    // G) 수정: 새로 추가된 이미지 rows만 append insert
    if (newPaths.length > 0) {
      const lastSortOrder =
        existingRows.length > 0
          ? Math.max(...existingRows.map((r) => r.sort_order ?? 0))
          : 0;

      const appendRows = newPaths.map((path, idx) => ({
        receipt_id: editId!,
        user_id: userId,
        path,
        sort_order: lastSortOrder + idx + 1,
      }));

      const { error: imgInsErr } = await supabase.from("receipt_images").insert(appendRows as any);
      if (imgInsErr) throw imgInsErr;
    }

    // H) 삭제된 기존 이미지 처리 (DB + storage)  ⭐️ 이게 네가 헷갈린 C 구간
    const pathsToDelete = beforePaths.filter((p) => !afterExistingPaths.includes(p));

    if (pathsToDelete.length > 0) {
      // DB row 삭제
      const { error: imgDelErr } = await supabase
        .from("receipt_images")
        .delete()
        .eq("receipt_id", editId!)
        .eq("user_id", userId)
        .in("path", pathsToDelete);

      if (imgDelErr) throw imgDelErr;

      // storage 파일 삭제
      const { error: rmErr } = await supabase.storage.from("receipts").remove(pathsToDelete);
      if (rmErr) console.error("storage remove failed", rmErr);
    }

    // I) 성공 후 상태 갱신
    setExistingRowsAll([...existingRows, ...newPaths.map((p, idx) => ({
      id: `new_${Date.now()}_${idx}`,
      receipt_id: editId!,
      user_id: userId,
      path: p,
      sort_order: (existingRows.length > 0 ? Math.max(...existingRows.map(r => r.sort_order ?? 0)) : 0) + idx + 1,
      created_at: new Date().toISOString(),
    }))]);

    setExistingRows((prev) => [...prev, ...newPaths.map((p, idx) => ({
      id: `new_${Date.now()}_${idx}`,
      receipt_id: editId!,
      user_id: userId,
      path: p,
      sort_order: (prev.length > 0 ? Math.max(...prev.map(r => r.sort_order ?? 0)) : 0) + idx + 1,
      created_at: new Date().toISOString(),
    }))]);

    // redirect
    if (fromVendor) router.push(`/vendors/${fromVendor}`);
    else router.push(`/receipts/${editId}`);
    return;

        } catch (e: any) {
      // 업로드만 되고 DB가 실패한 경우: 이번에 올린 것만 지움(최선의 노력)
      if (uploadedNow.length > 0) {
        try {
          const { error: rmErr } = await supabase.storage.from("receipts").remove(uploadedNow);
          if (rmErr) console.error("rollback remove failed", rmErr);
        } catch (err) {
          console.error("rollback remove exception", err);
        }
      }

      setMsg(e?.message ?? (isEditMode ? "수정 저장 오류" : "저장 오류"));
    } finally {
      setSaving(false);
    }
  }

  // ---------- UI bits ----------
  const pillBase: React.CSSProperties = {
    padding: "10px 12px",
    borderRadius: 999,
    border: "1px solid #ddd",
    background: "white",
    fontWeight: 800,
    fontSize: 13,
    lineHeight: "16px",
    whiteSpace: "nowrap",
  };

  const [hoverStatus, setHoverStatus] = useState<ReceiptStatus | null>(null);
    
  const statusDescriptions = useMemo<Record<ReceiptStatus, string>>(() => {
  const isSupported = selectedVendor?.invoice_capability === "supported";
    return {
      uploaded: isSupported
        ? "영수증을 업로드했지만 아직 세금계산서 발행 요청을 하지 않은 상태입니다. 준비가 되면 '계산서 발행 요청' 버튼을 누르세요."
        : "영수증을 업로드했지만 아직 세금계산서 발행 요청을 하지 않은 상태입니다. 준비가 끝나면 내보내기 버튼을 통해 상가에 계산서 발행을 요청하고 상태를 '요청중'으로 변경해 보세요. (발행 연동 미지원 상가)",
      requested: isSupported
        ? "세금계산서 발행을 요청한 상태입니다. 상가에서 처리 중입니다."
        : "세금계산서 발행을 요청한 상태입니다. 계산서 발행이 확인되면 상태를 '완료'로 변경해 주세요.",
      needs_fix: "세금계산서 발행 요청에 문제가 있어 수정이 필요한 상태입니다. 영수증 정보를 확인하고 수정해주세요.",
      completed: "세금계산서 발행이 완료된 상태입니다.",
    };
  }, [selectedVendor?.invoice_capability]);

  const activeStatusForDescription = hoverStatus ?? effectiveStatus;

  // ✅ 상가 선택 전에는 안내 문구(원하는 문구로 바꿔도 됨)
  const statusDescription = useMemo(() => {
    if (!selectedVendor) return "상태별 안내";
    return statusDescriptions[activeStatusForDescription];
  }, [selectedVendor, statusDescriptions, activeStatusForDescription]);

  const StatusButton = (key: ReceiptStatus, label: string, s: React.CSSProperties) => {
    const selected = effectiveStatus === key;
    const disabled = receiptType === "simple";
    return (
      <div style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => {setStatus(key)}}
          onMouseEnter={() => setHoverStatus(key)}
          onMouseLeave={() => setHoverStatus(null)}
          disabled={disabled}
          style={{
            ...pillBase,
            opacity: disabled ? 0.5 : 1,
            border: selected ? (s as any).border : "1px solid #ddd",
            color: selected ? (s as any).color : "#111",
            background: selected ? (s as any).background : "white",
          }}
        >
          {label}
        </button>
      </div>
    );
  };

  const marketBadgeStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 800,
    padding: "6px 10px",
    borderRadius: 10,
    background: "#ffffff",
    color: "#3d3d3d",
  };

  const stallText = selectedVendor ? formatStallNo(selectedVendor.stall_no) : "";

  const pageTitle = isEditMode ? "영수증 수정" : "영수증 등록";
  const primaryButtonText = saving
    ? "저장 중..."
    : isEditMode
    ? "수정 저장"
    : "저장";

  // existing + new를 한 배열로(원하면 existing 먼저, new 나중)
  const thumbItems = useMemo(() => {
    const existing = (isEditMode ? existingImages : [])
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((img, idx) => ({
        key: `ex_${img.path}`,
        kind: "existing" as const,
        src: img.url,
        index: idx, // lightbox index 계산용
        exists: !!img.url,
      }))
      .filter((x) => x.exists);

    const news = newPreviews.map((src, idx) => ({
      key: `new_${idx}_${src}`,
      kind: "new" as const,
      src,
      index: idx,
      exists: true,
    }));

    const merged = [...existing, ...news];

    // ✅ 최소 3칸 유지용 placeholder 채우기
    const fill = Math.max(0, 3 - merged.length);
    const placeholders = Array.from({ length: fill }).map((_, i) => ({
      key: `ph_${i}`,
      kind: "placeholder" as const,
      src: null as any,
      index: -1,
      exists: false,
    }));

    return [...merged, ...placeholders];
  }, [isEditMode, existingImages, newPreviews]);

  return (
    <div style={{ margin: "0 auto", padding: 0 }}>
      {/* 상단 타이틀/뒤로 */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 0 }}>
        {loadingEdit ? (
          <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.6, fontWeight: 800 }}>
            불러오는 중...
          </div>
        ) : null}
      </div>

      {/* hidden inputs */}
      <input
        ref={filePickerRef}
        type="file"
        accept={IMAGE_ACCEPT}
        style={{ display: "none" }}
        onChange={(e) => {
          addFilesAsWebp(e.target.files);
          if (filePickerRef.current) filePickerRef.current.value = "";
          closeSheet();
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept={IMAGE_ACCEPT}
        capture="environment"
        style={{ display: "none" }}
        onChange={(e) => {
          addFilesAsWebp(e.target.files);
          if (cameraRef.current) cameraRef.current.value = "";
          closeSheet();
        }}
      />

      <div style={{ marginTop: 0, display: "grid", gap: 14 }}>
        {/* ===== 상가명 ===== */}
        <div ref={vendorPickerWrapRef} style={{ position: "relative" }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>상가명</div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              border: "1px solid #ddd",
              borderRadius: 12,
              padding: "4px 12px",
              background: "white",
              opacity: loadingEdit ? 0.6 : 1,
            }}
          >
            <span style={{ flexShrink: 0, display: "flex", alignItems: "center", marginLeft: 5 }}>
              {selectedVendor ? capabilityDot(selectedVendor.invoice_capability) : <Search size={18} />}
            </span>
            <input
              placeholder="상가명 검색"
              value={searchQuery}
              disabled={loadingEdit}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
                setSelectedVendor(null);
              }}
              onFocus={() => setShowDropdown(true)}
              style={{
                width: "100%",
                padding: "6px 0",
                border: "none",
                outline: "none",
                marginLeft: 10,
                fontSize: 16,
                fontWeight: 600,
                background: "transparent",
              }}
            />
          </div>

          {selectedVendor && (
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10 }}>
              {stallText ? (
                <span style={{ fontSize: 13, opacity: 0.75, fontWeight: 700 }}>{stallText}</span>
              ) : null}
              {selectedVendor.market_name ? (
                <span style={marketBadgeStyle}>[{selectedVendor.market_name}]</span>
              ) : null}
              <button
                type="button"
                disabled={loadingEdit}
                onClick={() => {
                  setSelectedVendor(null);
                  setSearchQuery("");
                  setShowDropdown(true);
                }}
                style={{
                  marginLeft: "auto",
                  padding: "6px 10px",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  background: "white",
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: "pointer",
                  opacity: loadingEdit ? 0.6 : 1,
                }}
              >
                변경
              </button>
            </div>
          )}

          {showDropdown && !selectedVendor && filteredVendors.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                zIndex: 100,
                background: "white",
                border: "1px solid #ddd",
                borderRadius: 12,
                marginTop: 8,
                maxHeight: 260,
                overflowY: "auto",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              }}
            >
              {filteredVendors.map((v) => {
                const stall = formatStallNo(v.stall_no);
                return (
                  <div
                    key={v.id}
                    onClick={() => handleVendorSelect(v)}
                    style={{
                      padding: "12px 14px",
                      borderBottom: "1px solid #f2f2f2",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <span style={{ flexShrink: 0 }}>{capabilityDot(v.invoice_capability)}</span>
                      <div
                        style={{
                          fontWeight: 900,
                          fontSize: 15,
                          minWidth: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {v.name}
                      </div>
                      {stall ? (
                        <span style={{ fontWeight: 700, color: "#777", flexShrink: 0 }}>
                          {stall}
                        </span>
                      ) : null}
                      {v.market_name ? (
                        <span style={{ marginLeft: "auto", flexShrink: 0, ...marketBadgeStyle }}>
                          [{v.market_name}]
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 구매일 */}
        <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>구매일</div>
          <input
            type="date"
            value={purchaseDate}
            disabled={loadingEdit}
            onChange={(e) => setPurchaseDate(e.target.value)}
            style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd", fontSize: 14 }}
          />
        </div>

        {/* 영수증 사진 */}
        <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", alignItems: "start", gap: 12 }}>
          {/* 왼쪽 라벨 */}
          <div style={{ fontSize: 14, fontWeight: 800, paddingTop: 10, whiteSpace: "nowrap" }}>
            영수증 사진
          </div>

          {/* 오른쪽: 1) 헤더(카메라) 2) 썸네일 그리드 */}
          <div style={{ width: "100%" }}>
            {/* 1) 카메라 버튼 (영수증사진과 같은 행) */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", paddingTop: 10 }}>
              <button
                type="button"
                onClick={openAddSheet}
                disabled={loadingEdit}
                style={{
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  lineHeight: 0,
                  opacity: loadingEdit ? 0.4 : 0.9,
                  cursor: loadingEdit ? "default" : "pointer",
                }}
                aria-label="영수증 사진 추가"
              >
                <Camera size={22} />
              </button>
            </div>

            {/* 2) 썸네일: 카메라 아래에 3개씩 쌓이기 */}
            <div
              style={{
                marginTop: 10,
                display: "grid",
                gridTemplateColumns: "repeat(3, 100px)",
                gap: 8,
              }}
            >
              {newPreviews.map((src, i) => (
                <div
                  key={src}
                  style={{
                    width: "100%",
                    aspectRatio: "1 / 1",
                    borderRadius: 12,
                    overflow: "hidden",
                    border: "1px solid #ddd",
                    position: "relative",
                  }}
                >
                  <img
                    src={src}
                    alt={`new ${i + 1}`}
                    style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }}
                    onClick={() => {
                      const offset = allPreviewItems.filter((x) => x.kind === "existing").length;
                      setLbIndex(offset + i);
                      setLbOpen(true);
                    }}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeNewAt(i);
                    }}
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      width: 24,
                      height: 24,
                      borderRadius: 999,
                      border: "1px solid rgba(0,0,0,0.12)",
                      background: "rgba(255,255,255,0.92)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}

              {isEditMode &&
                existingImages
                  .slice()
                  .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                  .map((img, i) => (
                    <div
                      key={img.path}
                      style={{
                        width: "100%",
                        aspectRatio: "1 / 1",
                        borderRadius: 12,
                        overflow: "hidden",
                        border: "1px solid #ddd",
                        position: "relative",
                      }}
                    >
                      {img.url ? (
                        <img
                          src={img.url}
                          alt={`existing ${i + 1}`}
                          style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }}
                          onClick={() => {
                            setLbIndex(i); // existing은 앞쪽
                            setLbOpen(true);
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 12,
                            opacity: 0.6,
                          }}
                        >
                          로딩...
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeExistingByPath(img.path);
                        }}
                        style={{
                          position: "absolute",
                          top: 4,
                          right: 4,
                          width: 24,
                          height: 24,
                          borderRadius: 999,
                          border: "1px solid rgba(0,0,0,0.12)",
                          background: "rgba(255,255,255,0.92)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        title="기존 이미지 제거"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
            </div>
          </div>
        </div>

        {/* 과세/면세 */}
        <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>과세구분</div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              disabled={loadingEdit}
              onClick={() => setTaxType("tax_free")}
              style={{ ...pillBase, background: taxType === "tax_free" ? "#f2f2f2" : "white" }}
            >
              면세
            </button>

            <button
              type="button"
              disabled={loadingEdit}
              onClick={() => setTaxType("tax")}
              style={{ ...pillBase, background: taxType === "tax" ? "#f2f2f2" : "white" }}
            >
              과세
            </button>

            {/* <button
              type="button"
              disabled={loadingEdit}
              onClick={() => setTaxType("zero_rate")}
              style={{ ...pillBase, background: taxType === "zero_rate" ? "#f2f2f2" : "white" }}
              title="영세(0%)"
            >
              영세
            </button> */}
          </div>
        </div>

        {/* 금액 */}
        <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>금액</div>
          <div style={{ position: "relative" }}>
            <input
              value={amountDisplay}
              disabled={loadingEdit}
              onChange={(e) => setAmountDigits(onlyDigits(e.target.value).slice(0, 12))}
              placeholder="예: 45,000"
              inputMode="numeric"
              style={{ textAlign: "right", width: "90%", padding: 11, borderRadius: 12, border: "1px solid #ddd", fontSize: 15, fontWeight: 700 }}
            />
            <div
              style={{
                position: "absolute",
                right: 12,
                top: "50%",
                transform: "translateY(-54%)",
                fontSize: 14,
                opacity: 0.8,
                fontWeight: 800,
              }}
            >
              원
            </div>
          </div>
        </div>

        {/* 부가세, 합계금액 표시 */}
        {taxType === "tax" && (
        <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: 12 }}>
          <div />
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span>부가세(10%)</span>
              <span style={{ textAlign: "right", minWidth: 120, marginRight: 28 }}>{vatAmountDisplay} 원</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700 }}>
              <span>합계금액</span>
              <span style={{ textAlign: "right", minWidth: 120, marginRight: 28  }}>{totalAmountDisplay} 원</span>
            </div>
          </div>
        </div>
      )}

        {/* 지급 구분 */}
        <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>지급 구분</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", opacity: loadingEdit ? 0.6 : 1 }}>
            <button
              type="button"
              disabled={loadingEdit}
              onClick={() => setPaymentMethod("cash")}
              style={{ ...pillBase, background: paymentMethod === "cash" ? "#f2f2f2" : "white" }}
            >
              현금
            </button>
            <button
              type="button"
              disabled={loadingEdit}
              onClick={() => setPaymentMethod("transfer")}
              style={{ ...pillBase, background: paymentMethod === "transfer" ? "#f2f2f2" : "white" }}
            >
              입금
            </button>
            <button
              type="button"
              disabled={loadingEdit}
              onClick={() => setPaymentMethod("payable")}
              style={{ ...pillBase, background: paymentMethod === "payable" ? "#f2f2f2" : "white" }}
            >
              미수
            </button>
          </div>
        </div>

        {paymentMethod === "transfer" && (
          <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>입금일</div>
            <input
              type="date"
              value={depositDate}
              disabled={loadingEdit}
              onChange={(e) => setDepositDate(e.target.value)}
              style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd", fontSize: 14 }}
            />
          </div>
        )}

        {/* 영수증 유형 */}
        <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>영수증 유형</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", opacity: loadingEdit ? 0.6 : 1 }}>
            <button
              type="button"
              disabled={loadingEdit}
              onClick={() => setReceiptType("standard")}
              style={{ ...pillBase, background: receiptType === "standard" ? "#f2f2f2" : "white" }}
            >
              일반
            </button>
            <button
              type="button"
              disabled={loadingEdit}
              onClick={() => setReceiptType("simple")}
              style={{ ...pillBase, background: receiptType === "simple" ? "#f2f2f2" : "white" }}
            >
              간이(자동완료)
            </button>
          </div>
        </div>

        {/* 상태 */}
        <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", alignItems: "start", gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 800, paddingTop: 10 }}>상태</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", opacity: loadingEdit ? 0.6 : 1 }}>
              {StatusButton("uploaded", "요청대기", { border: "3px solid #0e0e0e", color: "#000000", background: "#ffffff" })}
              {StatusButton("requested", "요청중", { border: "3px solid #8dafe6", color: "#000000", background: "#c1d2ee" })}
              {StatusButton("needs_fix", "수정필요", { border: "3px solid #efa6a3", color: "#000000", background: "#f3cfce" })}
              {StatusButton("completed", "완료", { border: "3px solid #9CA3AF", color: "#000000", background: "#eae9e9" })}
            </div>
            {statusDescription && (
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 12,
                  background: "#f9f9f9",
                  border: "1px solid #e5e5e5",
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: "#333",
                }}
              >
                {statusDescription}
              </div>
            )}
          </div>
        </div>

        {/* 메모 */}
        <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", alignItems: "start", gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 800, paddingTop: 10 }}>메모</div>
          <textarea
            value={memo}
            disabled={loadingEdit}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="추가 전달사항이나 메모를 입력하세요."
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 12,
              border: "1px solid #ddd",
              fontSize: 14,
              minHeight: 80,
              resize: "none",
              fontFamily: "inherit",
            }}
          />
        </div>

        <button
          type="button"
          onClick={onSave}
          disabled={saving || loadingEdit}
          style={{
            marginTop: 4,
            padding: "14px 16px",
            borderRadius: 16,
            border: "1px solid #ddd",
            background: saving || loadingEdit ? "#f2f2f2" : "white",
            fontWeight: 900,
            fontSize: 16,
          }}
        >
          {primaryButtonText}
        </button>

        {msg && (
          <div style={{ fontSize: 13, opacity: 0.85, whiteSpace: "pre-wrap", textAlign: "center" }}>
            {msg}
          </div>
        )}
      </div>

      {/* iOS 느낌 액션시트 */}
      {sheetOpen && (
        <div
          onClick={closeSheet}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            zIndex: 9999,
            padding: 12,
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, borderRadius: 18, overflow: "hidden" }}>
            <div style={{ background: "rgba(245,245,245,0.98)", borderRadius: 18, overflow: "hidden", border: "1px solid rgba(0,0,0,0.06)" }}>
              <button
                type="button"
                onClick={() => {
                  cameraRef.current?.click();
                }}
                style={{ width: "100%", padding: "16px 14px", background: "transparent", border: "none", fontSize: 16, fontWeight: 800 }}
              >
                카메라로 촬영
              </button>
              <div style={{ height: 1, background: "rgba(0,0,0,0.08)" }} />
              <button
                type="button"
                onClick={() => {
                  filePickerRef.current?.click();
                }}
                style={{ width: "100%", padding: "16px 14px", background: "transparent", border: "none", fontSize: 16, fontWeight: 800 }}
              >
                파일 선택
              </button>
            </div>
            <div style={{ height: 10 }} />
            <div style={{ background: "rgba(245,245,245,0.98)", borderRadius: 18, overflow: "hidden", border: "1px solid rgba(0,0,0,0.06)" }}>
              <button
                type="button"
                onClick={closeSheet}
                style={{ width: "100%", padding: "16px 14px", background: "transparent", border: "none", fontSize: 16, fontWeight: 900 }}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
      {lbOpen && allPreviewItems.length > 0 && (
      <ReceiptLightbox
        urls={allPreviewItems.map((x) => x.src as string)}
        startIndex={lbIndex}
        onClose={() => setLbOpen(false)}
        setIndex={(i: number) => setLbIndex(i)}
      />
    )}
    </div>
  );
}