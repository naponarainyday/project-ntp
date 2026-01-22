// src/app/(main)/receipts/new/ReceiptsNewClient.tsx

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type PaymentMethod = "cash" | "transfer" | "payable";
type ReceiptStatus = "uploaded" | "requested" | "needs_fix" | "completed";
type ReceiptType = "standard" | "simple";
type InvoiceCapability = "supported" | "not_supported" | null;
type ReceiptImageRow = {
  id: string;
  receipt_id: string;
  user_id: string;
  path: string;
  sort_order: number; // 1~3
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
  amount: number;
  payment_method: PaymentMethod;
  deposit_date: string | null;
  receipt_date: string | null;
  receipt_type: ReceiptType;
  status: ReceiptStatus;
  memo: string | null;
  image_path: string | null;
};

const MAX_IMAGES = 3;

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

  const [files, setFiles] = useState<Array<File | null>>([null, null, null]);
  const [previews, setPreviews] = useState<Array<string | undefined>>([
    undefined,
    undefined,
    undefined,
  ]);

  const [amountDigits, setAmountDigits] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [depositDate, setDepositDate] = useState("");
  const [purchaseDate, setPurchaseDate] = useState<string>(todayYYYYMMDD());
  const [receiptType, setReceiptType] = useState<ReceiptType>("standard");
  const [status, setStatus] = useState<ReceiptStatus>("uploaded");
  const [memo, setMemo] = useState<string>("");

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetSlot, setSheetSlot] = useState<number | null>(null);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // edit-mode helpers
  const [loadingEdit, setLoadingEdit] = useState(false);

// ✅ edit-mode: 기존 이미지(슬롯별 path + signedUrl)
const [existingPaths, setExistingPaths] = useState<Array<string | null>>([null, null, null]);
const [existingUrls, setExistingUrls] = useState<Array<string | null>>([null, null, null]);
const [originalPaths, setOriginalPaths] = useState<Array<string | null>>([null,null,null]);

  const effectiveStatus = useMemo<ReceiptStatus>(() => {
    return receiptType === "simple" ? "completed" : status;
  }, [receiptType, status]);

  const amountDisplay = useMemo(
    () => formatNumberWithCommaFromDigits(amountDigits),
    [amountDigits]
  );

  const selectedCount = useMemo(() => {
    const newCount = files.filter(Boolean).length;
    const existingCount = existingPaths.filter(Boolean).length;
    return newCount + existingCount;
  }, [files, existingPaths]);


  const hasAnyNewFile = useMemo(() => files.some(Boolean), [files]);

  const hasAnyReceiptImage = useMemo(() => {
    if (files.some(Boolean)) return true; // 새 파일 1개라도 있으면 OK
    // 수정모드에서 기존 슬롯 중 하나라도 남아있으면 OK
    if (isEditMode && existingPaths.some((p) => !!p)) return true;
    return false;
  }, [files, isEditMode, existingPaths]);


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
          .select("id, vendor_id, amount, payment_method, deposit_date, receipt_date, receipt_type, status, memo, image_path")
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

        setAmountDigits(String(r.amount ?? ""));
        setPaymentMethod((r.payment_method as PaymentMethod) ?? "cash");
        setDepositDate(r.deposit_date ?? "");
        setPurchaseDate(r.receipt_date ?? todayYYYYMMDD());
        setReceiptType((r.receipt_type as ReceiptType) ?? "standard");
        setStatus((r.status as ReceiptStatus) ?? "uploaded");
        setMemo(r.memo ?? "");

        // ✅ receipt_images에서 1~3 로드
        const { data: imgs, error: imgErr } = await supabase
          .from("receipt_images")
          .select("id, receipt_id, user_id, path, sort_order, created_at")
          .eq("receipt_id", editId)
          .eq("user_id", userId)
          .order("sort_order", { ascending: true });

        if (imgErr) throw imgErr;

        const nextPaths: Array<string | null> = [null, null, null];
        (imgs ?? []).forEach((it: any) => {
          const so = Number(it.sort_order);
          if (so >= 1 && so <= 3 && it.path) nextPaths[so - 1] = it.path;
        });
        setExistingPaths(nextPaths);
        setOriginalPaths(nextPaths);

        // signed url 3장 병렬 생성
        const signed = await Promise.all(
          nextPaths.map(async (p) => {
            if (!p) return null;
            const { data: s, error: sErr } = await supabase.storage
              .from("receipts")
              .createSignedUrl(p, 60 * 60);
            if (sErr) return null;
            return s?.signedUrl ?? null;
          })
        );
        setExistingUrls(signed);

        // 새 파일 선택 상태는 초기화
        setFiles([null, null, null]);
      } catch (e: any) {
        // 업로드는 됐는데 DB에서 실패한 경우 고아 파일 제거(최선의 노력)
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

  // ---------- Preview URLs (new files only) ----------
  useEffect(() => {
    previews.forEach((u) => u && URL.revokeObjectURL(u));
    const next = files.map((f) => (f && typeof window !== "undefined" ? URL.createObjectURL(f) : undefined));
    setPreviews(next);
    return () => next.forEach((u) => u && URL.revokeObjectURL(u));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  // ---------- Vendor select handler ----------
  const handleVendorSelect = (v: VendorOption) => {
    setSelectedVendor(v);
    setSearchQuery(v.name);
    setShowDropdown(false);
  };

  // ---------- Image handlers ----------
  function setFileAtSlot(slot: number, file: File) {
    setFiles((prev) => {
      const next = [...prev];
      next[slot] = file;
      return next;
    });
  }

  function removeImageAt(idx: number) {
    setFiles((prev) => {
      const next = [...prev];
      next[idx] = null;
      return next;
    });
  }

  function openSheetForSlot(slot: number) {
    if (files[slot]) return;
    setSheetSlot(slot);
    setSheetOpen(true);
  }

  function closeSheet() {
    setSheetOpen(false);
    setSheetSlot(null);
  }

  function findFirstEmptySlot() {
    for (let i = 0; i < 3; i++) {
      if (!files[i] && !existingPaths[i]) return i;
    }
    return -1;
  }

  function openCameraQuick() {
    if (selectedCount >= MAX_IMAGES) return;
    const slot = findFirstEmptySlot();
    if (slot === -1) return;
    setSheetSlot(slot);
    cameraRef.current?.click();
  }

  async function onPickFromFile(inputFiles: FileList | null) {
    if (!inputFiles || inputFiles.length === 0) return;
    if (sheetSlot === null) return;

    const f = inputFiles[0];
    if (filePickerRef.current) filePickerRef.current.value = "";
    closeSheet();

    await processPickedFile(sheetSlot, f);
  }

  async function onPickFromCamera(inputFiles: FileList | null) {
    if (!inputFiles || inputFiles.length === 0) return;
  
    const slot = sheetSlot ?? findFirstEmptySlot();
    if (slot === -1) {
      setMsg("이미지는 최대 3장까지 가능합니다.")
      return;
    }
  
    const f  = inputFiles[0];
    if (cameraRef.current) cameraRef.current.value = "";
    closeSheet();

    await processPickedFile(slot, f);
  }

  async function processPickedFile(slot: number, rawFile: File) {
    setMsg("");

    try {
      // ✅ webp 변환/리사이즈
      const webp = await fileToWebpResized(rawFile, slot);

      // ✅ 수정모드에서 기존 이미지가 있었다면 "교체"니까 기존 슬롯 비우기
      if (isEditMode) {
        setExistingPaths((prev) => {
          const next = [...prev];
          next[slot] = null;
          return next;
        });
        setExistingUrls((prev) => {
          const next = [...prev];
          next[slot] = null;
          return next;
        });
      }

      // ✅ 새 파일로 세팅 (previews는 files 기반으로 자동 생성됨)
      setFileAtSlot(slot, webp);
    } catch (e: any) {
      console.error("image convert error:", e);
      setMsg(e?.message ?? "이미지 변환에 실패했습니다.");
    }
  }

  // ---------- Save / Update ----------
  async function onSave() {
    setMsg("");

    if (loadingEdit) return;

    if (!selectedVendor) {
      setMsg("상가를 선택해줘.");
      return;
    }
    if (!purchaseDate) {
      setMsg("구매일자를 선택해줘.");
      return;
    }

    if (!hasAnyReceiptImage) {
      setMsg("영수증 사진을 최소 1장 첨부해줘.");
      return;
    }

    const a = Number(amountDigits || "0");
    if (!Number.isFinite(a) || a <= 0) {
      setMsg("금액을 올바르게 입력해줘.");
      return;
    }

    if (paymentMethod === "transfer" && !depositDate) {
      setMsg("입금일을 선택해줘.");
      return;
    }

    setSaving(true);

    let uploadedNow: string[] = [];
    const beforePaths = isEditMode ? [...originalPaths] : [null, null, null];

    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;

      const userId = authData?.user?.id ?? null;
      if (!userId) throw new Error("로그인이 필요합니다.");

      // 업로드(새 파일이 있으면 첫 장만 image_path로 사용)
      // 슬롯별 최종 path (1~3)
      let finalPaths: Array<string | null> = [null, null, null];

      // 수정모드에서는 기존 path를 기본으로 깔고 시작
      if (isEditMode) {
        finalPaths = [...existingPaths];
      }

      const actualFiles = files.filter((f): f is File => !!f);
      if (actualFiles.length > 0) {
        const ts = Date.now();

          for (let idx = 0; idx < 3; idx++) {
            const f = files[idx];
            if (!f) continue;
        
        const path = `${userId}/${selectedVendor.id}/${ts}_${idx + 1}.webp`;

        const { error: upErr } = await supabase.storage
          .from("receipts")
          .upload(path, f, { 
            upsert: false,
            contentType: "image/webp",
            cacheControl: "3600",
          });

        if (upErr) throw upErr;
        finalPaths[idx] = path;
        uploadedNow.push(path);
        }
      }

      const pathsToDelete: string[] = [];
      for (let i = 0; i < 3; i++) {
        const before = beforePaths[i];
        const after = finalPaths[i];

        // before가 있었는데 after가 없거나(after=null), 다른 파일로 바뀌면 삭제 대상
        if (before && (!after || before !== after)) {
          pathsToDelete.push(before);
        }
    }

      const payload = {
        vendor_id: selectedVendor.id,
        amount: a,
        payment_method: paymentMethod,
        deposit_date: paymentMethod === "transfer" ? depositDate : null,
        receipt_type: receiptType,
        status: effectiveStatus,
        image_path: finalPaths[0],
        receipt_date: purchaseDate,
        memo: memo,
      };

      if (!isEditMode) {
        const { data: inserted, error: insErr } = await supabase
          .from("receipts")
          .insert({ ...payload, user_id: userId })
          .select("id")
          .maybeSingle();

        if (insErr) throw insErr;
        const newReceiptId = inserted?.id;
        if (!newReceiptId) throw new Error("영수증 ID를 가져오지 못했습니다.");

        // receipt_images insert (있는 슬롯만)
        const rows = finalPaths
          .map((p, idx) => (p ? { receipt_id: newReceiptId, user_id: userId, path: p, sort_order: idx + 1 } : null))
          .filter(Boolean);

        if (rows.length > 0) {
          const { error: imgInsErr } = await supabase.from("receipt_images").insert(rows as any);
          if (imgInsErr) throw imgInsErr;
        }

        router.push("/receipts");
        router.refresh();
        return;
      }

      // UPDATE receipts
    const { error: upErr2 } = await supabase
      .from("receipts")
      .update(payload)
      .eq("id", editId!)
      .eq("user_id", userId);

    if (upErr2) throw upErr2;

    // receipt_images 반영
    for (let idx = 0; idx < 3; idx++) {
      const so = idx + 1;
      const path = finalPaths[idx];

      if (path) {
        // ✅ upsert: (receipt_id, sort_order) unique 가정
        const { error: imgUpErr } = await supabase
          .from("receipt_images")
          .upsert(
            { receipt_id: editId!, user_id: userId, path, sort_order: so },
            { onConflict: "receipt_id,sort_order" }
          );

        if (imgUpErr) throw imgUpErr;
      } else {
        // ✅ 슬롯 비워졌으면 해당 row 삭제
        const { error: imgDelErr } = await supabase
          .from("receipt_images")
          .delete()
          .eq("receipt_id", editId!)
          .eq("user_id", userId)
          .eq("sort_order", so);

        if (imgDelErr) throw imgDelErr;
      }
    }

    // C) DB 반영 성공 후 스토리지 파일 삭제
    if (pathsToDelete.length > 0) {
      const { error: rmErr } = await supabase.storage.from("receipts").remove(pathsToDelete);
      if (rmErr) console.error("storage remove failed", rmErr);
    }

    setOriginalPaths(finalPaths);
    setExistingPaths(finalPaths);

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

  const StatusButton = (key: ReceiptStatus, label: string, s: React.CSSProperties) => {
    const selected = effectiveStatus === key;
    const disabled = receiptType === "simple";
    return (
      <button
        type="button"
        onClick={() => setStatus(key)}
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
    );
  };

  function ThumbSlot({ idx }: { idx: number }) {
  const hasNewFile = !!files[idx];
  const previewUrl = previews[idx];
  const showNew = hasNewFile && previewUrl;

  const existingUrl = existingUrls[idx];
  const showExisting = !showNew && !!existingUrl; // 새 파일이 없을 때만 기존 노출

  const canPick = !hasNewFile; // 새 파일 있을 땐 클릭으로 교체 못하게(원하면 교체 허용도 가능)

  return (
    <div style={{ width: "33.3333%", boxSizing: "border-box" }}>
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "1 / 1",
          borderRadius: 14,
          border: "1px solid #ddd",
          background: "#fff",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: canPick ? "pointer" : "default",
        }}
        onClick={() => {
          // 슬롯에 새 파일이 없을 때만 선택 sheet
          if (!hasNewFile) openSheetForSlot(idx);
        }}
      >
        {showNew ? (
          <>
            <img
              src={previewUrl}
              alt={`영수증 ${idx + 1}`}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeImageAt(idx);
              }}
              style={{
                position: "absolute",
                top: 6,
                right: 6,
                width: 28,
                height: 28,
                borderRadius: 999,
                border: "1px solid #ddd",
                background: "rgba(255,255,255,0.92)",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              ×
            </button>
          </>
        ) : showExisting ? (
          <>
            <img
              src={existingUrl!}
              alt={`기존 영수증 ${idx + 1}`}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                // ✅ 기존 이미지 삭제(슬롯 비움)
                setExistingPaths((prev) => {
                  const next = [...prev];
                  next[idx] = null;
                  return next;
                });
                setExistingUrls((prev) => {
                  const next = [...prev];
                  next[idx] = null;
                  return next;
                });
              }}
              style={{
                position: "absolute",
                top: 6,
                right: 6,
                width: 28,
                height: 28,
                borderRadius: 999,
                border: "1px solid #ddd",
                background: "rgba(255,255,255,0.92)",
                fontWeight: 900,
                cursor: "pointer",
              }}
              title="기존 이미지 제거"
            >
              ×
            </button>

            {/* 기존 이미지일 때 교체 힌트 */}
            <div
              style={{
                position: "absolute",
                left: 8,
                bottom: 8,
                padding: "4px 8px",
                borderRadius: 999,
                border: "1px solid rgba(0,0,0,0.12)",
                background: "rgba(255,255,255,0.9)",
                fontSize: 12,
                fontWeight: 900,
                opacity: 0.9,
              }}
            >
              기존
            </div>
          </>
        ) : (
          <div style={{ fontSize: 28, fontWeight: 900, opacity: 0.55 }}>+</div>
        )}
      </div>
    </div>
  );
}


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

  return (
    <div style={{ margin: "0 auto", padding: 0 }}>
      {/* 상단 타이틀/뒤로 */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
        <button
          type="button"
          onClick={() => {
            // 수정모드면 상세로, 아니면 이전/벤더로
            if (isEditMode && editId) {
              router.push(`/receipts/${editId}`);
              return;
            }
            router.back();
          }}
          style={{
            padding: "8px 10px",
            borderRadius: 12,
            border: "1px solid #ddd",
            fontWeight: 900,
            fontSize: 13,
            background: "white",
          }}
        >
          ←
        </button>
        <div style={{ fontWeight: 900, fontSize: 15 }}>{pageTitle}</div>
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
        onChange={(e) => onPickFromFile(e.target.files)}
      />
      <input
        ref={cameraRef}
        type="file"
        accept={IMAGE_ACCEPT}
        capture="environment"
        style={{ display: "none" }}
        onChange={(e) => onPickFromCamera(e.target.files)}
      />

      <div style={{ marginTop: 9, display: "grid", gap: 14 }}>
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
            <span style={{ flexShrink: 0 }}>
              {selectedVendor ? capabilityDot(selectedVendor.invoice_capability) : "🔍"}
            </span>
            <input
              placeholder="상가명 또는 호수 검색"
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
                padding: "10px 0",
                border: "none",
                outline: "none",
                fontSize: 16,
                fontWeight: 800,
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
          <div style={{ fontSize: 14, fontWeight: 800, paddingTop: 10 }}>영수증 사진</div>
          <div style={{ width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginBottom: 8 }}>
              <button
                type="button"
                onClick={openCameraQuick}
                disabled={loadingEdit || selectedCount >= MAX_IMAGES}
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: 27,
                  opacity: loadingEdit || selectedCount >= MAX_IMAGES ? 0.35 : 0.9,
                  padding: 0,
                }}
              >
                📷
              </button>
            </div>

              <div style={{ display: "flex" }}>
                <ThumbSlot idx={0} />
                <ThumbSlot idx={1} />
                <ThumbSlot idx={2} />
              </div>

            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.65 }}>
              최대 3장 · +를 누르면 촬영/파일 선택
              {isEditMode ? " · (새 사진을 선택하면 기존 사진이 교체돼)" : ""}
            </div>
          </div>
        </div>

        {/* 금액 */}
        <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>금액</div>
          <div style={{ position: "relative" }}>
            <input
              value={amountDisplay}
              disabled={loadingEdit}
              onChange={(e) => setAmountDigits(onlyDigits(e.target.value).slice(0, 12))}
              placeholder="예: 45,000"
              inputMode="numeric"
              style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd", fontSize: 16, fontWeight: 700 }}
            />
            <div
              style={{
                position: "absolute",
                right: 12,
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: 14,
                opacity: 0.7,
                fontWeight: 800,
              }}
            >
              원
            </div>
          </div>
        </div>

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
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", opacity: loadingEdit ? 0.6 : 1 }}>
            {StatusButton("uploaded", "업로드", { border: "3px solid #000936", color: "#000936", background: "#ffffff" })}
            {StatusButton("requested", "요청중", { border: "3px solid #16A34A", color: "#001709", background: "#c9ffcf" })}
            {StatusButton("needs_fix", "수정필요", { border: "3px solid #ff3300", color: "#351400", background: "#fff2f2" })}
            {StatusButton("completed", "완료", { border: "3px solid #9CA3AF", color: "#050608", background: "#eae9e9" })}
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
                  const slot = sheetSlot ?? findFirstEmptySlot();
                    if (slot === -1) return;
                  setSheetSlot(slot);
                  closeSheet();
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
    </div>
  );
}