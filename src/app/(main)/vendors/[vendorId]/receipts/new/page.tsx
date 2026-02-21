"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Camera, X } from "lucide-react";
import ReceiptLightbox from "@/components/ReceiptLightbox"

type PaymentMethod = "cash" | "transfer" | "payable";
type ReceiptStatus = "uploaded" | "requested" | "needs_fix" | "completed";
type ReceiptType = "standard" | "simple";
type TaxType = "tax_free" | "tax" | "zero_rate";
type InvoiceCapability = "supported" | "not_supported" | null;

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

const WEBP_MAX_SIDE = 1600;
const WEBP_QUALITY = 0.82;

function getExtLower(name: string) {
  return (name.split(".").pop() || "").toLowerCase();
}

function isHeicLike(file: File) {
  const ext = getExtLower(file.name);
  return file.type === "image/heic" || file.type === "image/heif" || ext === "heic" || ext === "heif";
}

async function decodeToBitmap(file: File): Promise<ImageBitmap> {
  let blob: Blob = file;

  if (isHeicLike(file)) {
    const heic2any = (await import("heic2any")).default;
    const converted = await heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: 0.92,
    });
    blob = Array.isArray(converted) ? converted[0] : converted;
  }

  return await createImageBitmap(blob);
}

async function fileToWebpResized(file: File, slotIndex: number): Promise<File> {
  const bitmap = await decodeToBitmap(file);

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

  const safeBase = (file.name || `image_${slotIndex + 1}`).replace(/\.[^/.]+$/, "");
  return new File([webpBlob], `${safeBase}.webp`, { type: "image/webp" });
}

export default function NewReceiptPage() {
  const router = useRouter();
  const params = useParams<{ vendorId: string | string[] }>();
  const vendorId = Array.isArray(params.vendorId) ? params.vendorId[0] : params.vendorId;

  const filePickerRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);

  const [vendorName, setVendorName] = useState<string>("");
  const [stallNo, setStallNo] = useState<string | null>(null);
  const [marketName, setMarketName] = useState<string | null>(null);
  const [invoiceCapability, setInvoiceCapability] = useState<InvoiceCapability>(null);

  const IMAGE_ACCEPT =
    "image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif";

  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [newPreviews, setNewPreviews] = useState<string[]>([]);

  const [sheetOpen, setSheetOpen] = useState(false);

  // lightbox
  const [lightboxOpen, setLightboxOpen] = useState<{
    urls: string[];
    startIndex: number;
    meta?: {
      vendorName?: string | null;
      receiptDate?: string | null;
    };
  } | null>(null);

  const [amountDigits, setAmountDigits] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [depositDate, setDepositDate] = useState<string>("");
  const [purchaseDate, setPurchaseDate] = useState<string>(todayYYYYMMDD());
  const [receiptType, setReceiptType] = useState<ReceiptType>("standard");
  const [status, setStatus] = useState<ReceiptStatus>("uploaded");
  const [memo, setMemo] = useState<string>("");
  const [taxType, setTaxType] = useState<TaxType>("tax_free");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const effectiveStatus = useMemo<ReceiptStatus>(() => {
    return receiptType === "simple" ? "completed" : status;
  }, [receiptType, status]);

  const amountDisplay = useMemo(
    () => formatNumberWithCommaFromDigits(amountDigits),
    [amountDigits]
  );

  const baseAmount = useMemo(() => {
    const n = Number(amountDigits || "0");
    return Number.isFinite(n) ? n : 0;
  }, [amountDigits]);

  const vatAmount = useMemo(() => {
    if (taxType !== "tax") return 0;
    return Math.round(baseAmount * 0.1);
  }, [taxType, baseAmount]);

  const totalAmount = useMemo(() => {
    if (taxType === "tax") return baseAmount + vatAmount;
    return baseAmount; // 면세/영세
  }, [taxType, baseAmount, vatAmount]);

  const vatAmountDisplay = useMemo(
    () => new Intl.NumberFormat("ko-KR").format(vatAmount),
    [vatAmount]
  );

  const totalAmountDisplay = useMemo(
    () => new Intl.NumberFormat("ko-KR").format(totalAmount),
    [totalAmount]
  );

  useEffect(() => {
    (async () => {
      if (!vendorId) return;
      const { data, error } = await supabase
        .from("v_vendor_list_page2")
        .select("vendor_id, name, stall_no, invoice_capability, market_name")
        .eq("vendor_id", vendorId)
        .single();

      if (!error && data) {
        setVendorName(data.name ?? "");
        setStallNo(data.stall_no ?? null);
        setInvoiceCapability((data.invoice_capability as InvoiceCapability) ?? null);
        setMarketName((data.market_name as string | null) ?? null);
        return;
      }

      const { data: vData, error: vErr } = await supabase
        .from("vendors")
        .select("name, stall_no, invoice_capability, markets(name)")
        .eq("id", vendorId)
        .single();

      if (vErr) return;

      if (vData) {
        setVendorName((vData as any).name ?? "");
        setStallNo((vData as any).stall_no ?? null);
        setInvoiceCapability(((vData as any).invoice_capability as InvoiceCapability) ?? null);
        const m: any = (vData as any).markets;
        const mName = (Array.isArray(m) ? m?.[0]?.name : m?.name) ?? null;
        setMarketName(mName);
      }
    })();
  }, [vendorId]);

  useEffect(() => {
    // 이전 url revoke
    newPreviews.forEach((u) => u && URL.revokeObjectURL(u));

    const next = newFiles.map((f) => URL.createObjectURL(f));
    setNewPreviews(next);

    return () => next.forEach((u) => u && URL.revokeObjectURL(u));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newFiles]);

  function openAddSheet() {
    setSheetOpen(true);
  }

  function closeSheet() {
    setSheetOpen(false);
  }

  function removeNewAt(i: number) {
    setNewFiles((prev) => prev.filter((_, idx) => idx !== i));
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

  const hasAnyReceiptImage = useMemo(() => {
    return newFiles.length > 0;
  }, [newFiles.length]);

  const allPreviewItems = useMemo(() => {
    return newPreviews.map((src, idx) => ({
      key: `new_${idx}_${src}`,
      src,
      kind: "new" as const,
    }));
  }, [newPreviews]);

  
  async function onSave() {
    setMsg("");
    if (!vendorId) { setMsg("vendorId가 없습니다."); return; }
    if (!purchaseDate) { setMsg("구매일자를 선택해 주세요."); return; }
    if (!hasAnyReceiptImage) { setMsg("영수증 사진을 최소 1장 첨부해 주세요."); return; }

    const a = baseAmount;
    if (!Number.isFinite(a) || a <= 0) { setMsg("금액을 올바르게 입력해 주세요."); return; }
    if (paymentMethod === "transfer" && !depositDate) { setMsg("입금일을 선택해 주세요."); return; }

    setSaving(true);

    try {
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user?.id; // ✅ 추가
      if (!userId) {
        setMsg("로그인이 필요합니다");
        router.push("/login");
        return;
      }

      const ts = Date.now();
      const targetVendorId = vendorId;

      const uploadedPaths: string[] = [];

      try {
        for (let i = 0; i < newFiles.length; i++) {
          const f = newFiles[i];

          const key =
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `${Date.now()}_${Math.random().toString(16).slice(2)}`;

          const path = `${userId}/${targetVendorId}/${ts}_${i + 1}_${key}.webp`;

          const { error: upErr } = await supabase.storage
            .from("receipts")
            .upload(path, f, {
              upsert: false,
              contentType: "image/webp",
              cacheControl: "3600",
            });

          if (upErr) throw upErr;
          uploadedPaths.push(path);
        }
      } catch (e) {
        if (uploadedPaths.length > 0) {
          await supabase.storage.from("receipts").remove(uploadedPaths);
        }
        throw e;
      }

      const payload = {
        user_id: userId,
        vendor_id: vendorId,
        tax_type: taxType,
        amount: baseAmount,
        vat_amount: vatAmount,
        total_amount: totalAmount,
        payment_method: paymentMethod,
        deposit_date: paymentMethod === "transfer" ? depositDate : null,
        receipt_type: receiptType,
        status: effectiveStatus,
        image_path: uploadedPaths[0],
        receipt_date: purchaseDate,
        memo,
      };

      const { data: inserted, error: insErr } = await supabase
        .from("receipts")
        .insert(payload)
        .select("id")
        .maybeSingle();

      if (insErr) {
        // ✅ DB insert 실패하면 업로드 파일 롤백
        await supabase.storage.from("receipts").remove(uploadedPaths);
        throw insErr;
      }

      const newReceiptId = inserted?.id;
      if (!newReceiptId) {
        await supabase.storage.from("receipts").remove(uploadedPaths);
        throw new Error("영수증 ID를 가져오지 못했습니다.");
      }

      const imgRows = uploadedPaths.map((path, idx) => ({
        receipt_id: newReceiptId,
        user_id: userId,
        path,
        sort_order: idx+1,
      }));

      if (imgRows.length>0) {
        const { error : imgInsErr } = await supabase.from("receipt_images").insert(imgRows as any);
        if (imgInsErr) {
          // 최선: storage 롤백+receipt 롤백은 여기선 생략
          await supabase.storage.from("receipts").remove(uploadedPaths);
          throw imgInsErr;
        }
      }

      router.replace(`/vendors/${vendorId}`);
    } catch (e: any) {
      setMsg(e?.message ?? "저장 오류");
    } finally {
      setSaving(false);
    }
  }


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
    const isSupported = invoiceCapability === "supported";
    
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
  }, [invoiceCapability]);

  const activeStatusForDescription = hoverStatus ?? effectiveStatus;

  // ✅ vendor 페이지는 invoiceCapability가 로딩 전(null)일 수 있으니 기본 문구 처리
  const statusDescription = useMemo(() => {
    if (invoiceCapability === null) return "상태별 안내";
    return statusDescriptions[activeStatusForDescription];
  }, [invoiceCapability, statusDescriptions, activeStatusForDescription]);

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
            border: selected ? s.border : "3px solid #ddd",
            color: selected ? s.color : "#111",
            background: selected ? s.background : "white",
          }}
        >
          {label}
        </button>
      </div>
    );
  };

  const stallText = formatStallNo(stallNo);

  return (
    <div style={{ maxWidth: 420, margin: "0 auto", padding: 8 }}>
      <input
        ref={filePickerRef}
        type="file"
        accept={IMAGE_ACCEPT}
        multiple
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
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          addFilesAsWebp(e.target.files);
          if (cameraRef.current) cameraRef.current.value = "";
          closeSheet();
        }}
      />

      <div style={{ marginTop: 0, display: "grid", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>상가명</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>
              {capabilityDot(invoiceCapability)}
            </span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0, whiteSpace: "nowrap" }}>
              <span style={{ fontSize: 18, fontWeight: 900, color: "#111", overflow: "hidden", textOverflow: "ellipsis" }}>
                {vendorName || "(상가명 없음)"}
              </span>
              {stallText && (
                <span style={{ fontSize: 14, fontWeight: 500, color: "#555", opacity: 0.75 }}>
                  {stallText}
                </span>
              )}
            </div>
            <div style={{ marginLeft: "auto", flexShrink: 0 }}>
              {marketName && (
                <span style={{ fontSize: 13, fontWeight: 800, padding: "6px 10px", borderRadius: 10, background: "#ffffff", color: "#3d3d3d" }}>
                  [{marketName}]
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>구매일</div>
          <input
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
            style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd", fontSize: 14 }}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", alignItems: "start", gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 800, paddingTop: 10, whiteSpace: "nowrap" }}>영수증 사진</div>
          <div style={{ width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", paddingTop: 10 }}>
              <button
                type="button"
                onClick={openAddSheet}
                style={{ border: "none", background: "transparent", padding: 0, lineHeight: 0, opacity: 0.9, cursor: "pointer" }}
              >
                <Camera size={22} />
              </button>
            </div>
            <div style={{ 
              marginTop: 10,
              display: "grid",
              gridTemplateColumns: "repeat(3, 100px)",
              gap: 8,
              }}
              >
                {newPreviews.map((src, i) => (
                  <div
                    key= {src}
                    style={{
                      width: "100%",
                      aspectRatio: "1 / 1",
                      borderRadius: 12,
                      overflow: "hidden",
                      border: "1px solid #ddd",
                      position: "relative"
                    }}
                  >
                    <img
                      src={src}
                      alt={`new ${i + 1}`}
                      style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }}
                      onClick={() => {
                        setLightboxOpen({
                          urls: allPreviewItems.map((x) => x.src),
                          startIndex: i,
                          meta: {
                            vendorName: vendorName || "vendor",
                            receiptDate: purchaseDate, // 여기선 구매일 기준이 자연스러움
                          },
                        });
                      }}
                    />
                    <button
                      type="button"
                      onClick={(e)=> {
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
            </div>
          </div>
        </div>

        {/* 과세/면세 */}
        <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>과세구분</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setTaxType("tax_free")}
              style={{ ...pillBase, background: taxType === "tax_free" ? "#f2f2f2" : "white" }}
            >
              면세
            </button>
            <button
              type="button"
              onClick={() => setTaxType("tax")}
              style={{ ...pillBase, background: taxType === "tax" ? "#f2f2f2" : "white" }}
            >
              과세
            </button>
            {/* <button
              type="button"
              onClick={() => setTaxType("zero_rate")}
              title="영세(0%)"
              style={{ ...pillBase, background: taxType === "zero_rate" ? "#f2f2f2" : "white" }}
            >
              영세
            </button> */}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>금액</div>
          <div style={{ position: "relative" }}>
            <input
              value={amountDisplay}
              onChange={(e) => setAmountDigits(onlyDigits(e.target.value).slice(0, 12))}
              placeholder="예: 45,000"
              inputMode="numeric"
              style={{ textAlign: "right", width: "90%", padding: 11, borderRadius: 12, border: "1px solid #ddd", fontSize: 15, fontWeight: 700 }}
            />
            <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, opacity: 0.8, fontWeight: 700 }}>
              원
            </div>
          </div>
        </div>

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
                <span style={{ textAlign: "right", minWidth: 120, marginRight: 28 }}>{totalAmountDisplay} 원</span>
              </div>
            </div>
          </div>
        )}


        <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>지급 구분</div>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={() => setPaymentMethod("cash")} style={{ ...pillBase, background: paymentMethod === "cash" ? "#f2f2f2" : "white" }}>현금</button>
            <button type="button" onClick={() => setPaymentMethod("transfer")} style={{ ...pillBase, background: paymentMethod === "transfer" ? "#f2f2f2" : "white" }}>입금</button>
            <button type="button" onClick={() => setPaymentMethod("payable")} style={{ ...pillBase, background: paymentMethod === "payable" ? "#f2f2f2" : "white" }}>미수</button>
          </div>
        </div>

        {paymentMethod === "transfer" && (
          <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>입금일</div>
            <input
              type="date"
              value={depositDate}
              onChange={(e) => setDepositDate(e.target.value)}
              style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd", fontSize: 14 }}
            />
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>영수증 유형</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={() => setReceiptType("standard")} style={{ ...pillBase, background: receiptType === "standard" ? "#f2f2f2" : "white" }}>일반</button>
            <button type="button" onClick={() => setReceiptType("simple")} style={{ ...pillBase, background: receiptType === "simple" ? "#f2f2f2" : "white" }}>간이(자동완료)</button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", alignItems: "start", gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 800, paddingTop: 10 }}>상태</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {StatusButton("uploaded", "요청대기", { border: "3px solid #333333", color: "#000000", background: "#ffffff" })}
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

        <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", alignItems: "start", gap: 12}}>
          <div style={{ fontSize: 14, fontWeight: 800, paddingTop: 10}}>메모</div>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="구매내역 등 메모 (ex. 맨스필드 4단)"
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 12,
              border: "1px solid #ddd",
              fontSize: 14,
              minHeight: 80,
              resize: "none",
              fontFamily: "inherit"
            }}
          />
        </div>

        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          style={{ marginTop: 4, padding: "14px 16px", borderRadius: 16, border: "1px solid #ddd", background: saving ? "#f2f2f2" : "white", fontWeight: 900, fontSize: 16 }}
        >
          {saving ? "저장 중..." : "저장"}
        </button>

        {msg && (
          <div style={{ fontSize: 13, opacity: 0.85, whiteSpace: "pre-wrap", textAlign: "center" }}>
            {msg}
          </div>
        )}
      </div>

      {sheetOpen && (
        <div
          onClick={closeSheet}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 9999, padding: 12 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, borderRadius: 18, overflow: "hidden" }}>
            <div style={{ background: "rgba(245,245,245,0.98)", borderRadius: 18, overflow: "hidden", border: "1px solid rgba(0,0,0,0.06)" }}>
              <button
                type="button"
                onClick={() => {
                  cameraRef.current?.click();
                }}
                style={{
                  width: "100%",
                  padding: "16px 14px",
                  background: "transparent",
                  border: "none",
                  fontSize: 16,
                  fontWeight: 800,
                }}
              >
                카메라로 촬영
              </button>

              <div style={{ height: 1, background: "rgba(0,0,0,0.08)" }} />

              <button
                type="button"
                onClick={() => {
                  filePickerRef.current?.click();
                }}
                style={{
                  width: "100%",
                  padding: "16px 14px",
                  background: "transparent",
                  border: "none",
                  fontSize: 16,
                  fontWeight: 800,
                }}
              >
                파일 선택
              </button>
            </div>
            <div style={{ height: 10 }} />
            <div style={{ background: "rgba(245,245,245,0.98)", borderRadius: 18, overflow: "hidden", border: "1px solid rgba(0,0,0,0.06)" }}>
              <button type="button" onClick={closeSheet} style={{ width: "100%", padding: "16px 14px", background: "transparent", border: "none", fontSize: 16, fontWeight: 900 }}>취소</button>
            </div>
          </div>
        </div>
      )}
      {lightboxOpen && (
        <ReceiptLightbox
          urls={lightboxOpen.urls}
          startIndex={lightboxOpen.startIndex}
          meta={lightboxOpen.meta}
          onClose={() => setLightboxOpen(null)}
        />
      )}
    </div>
  );
}