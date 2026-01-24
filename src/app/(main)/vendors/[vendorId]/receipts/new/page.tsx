"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type PaymentMethod = "cash" | "transfer" | "payable";
type ReceiptStatus = "uploaded" | "requested" | "needs_fix" | "completed";
type ReceiptType = "standard" | "simple";

type InvoiceCapability = "supported" | "not_supported" | null;

const MAX_IMAGES = 3;
const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif";

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

  const [files, setFiles] = useState<Array<File | null>>([null, null, null]);
  // ✅ 초기값을 빈 문자열 대신 undefined로 설정
  const [previews, setPreviews] = useState<Array<string | undefined>>([undefined, undefined, undefined]);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetSlot, setSheetSlot] = useState<number | null>(null);

  const [amountDigits, setAmountDigits] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [depositDate, setDepositDate] = useState<string>("");
  const [purchaseDate, setPurchaseDate] = useState<string>(todayYYYYMMDD());
  const [receiptType, setReceiptType] = useState<ReceiptType>("standard");
  const [status, setStatus] = useState<ReceiptStatus>("uploaded");
  const [memo, setMemo] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const effectiveStatus = useMemo<ReceiptStatus>(() => {
    return receiptType === "simple" ? "completed" : status;
  }, [receiptType, status]);

  const amountDisplay = useMemo(
    () => formatNumberWithCommaFromDigits(amountDigits),
    [amountDigits]
  );

  const selectedCount = useMemo(() => files.filter(Boolean).length, [files]);

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
    previews.forEach((u) => {
      if (u) URL.revokeObjectURL(u);
    });

    // ✅ File 객체가 있을 때만 ObjectURL 생성, 없으면 undefined
    const next = files.map((f) => (f ? URL.createObjectURL(f) : undefined));
    setPreviews(next);

    return () => {
      next.forEach((u) => {
        if (u) URL.revokeObjectURL(u);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  function setFileAtSlot(slot: number, file: File) {
    setFiles((prev) => {
      const next = [...prev];
      next[slot] = file;
      return next;
    });
  }

  async function processPickedFile(slot: number, rawFile: File) {
    setMsg("");

    try {
      const webp = await fileToWebpResized(rawFile, slot);
      setFileAtSlot(slot, webp);
    } catch (e: any) {
      console.error("image convert error:", e);
      setMsg(e?.message ?? "이미지 변환에 실패했습니다.");
    } finally {
      setSheetSlot(null);
    }
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
  }

  function findFirstEmptySlot() {
  for (let i = 0; i < 3; i++) {
    if (!files[i]) return i;
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

    const slot = sheetSlot ?? files.findIndex((f) => !f);
    if (slot === -1) return;

    const f = inputFiles[0];
    if (cameraRef.current) cameraRef.current.value = "";
    closeSheet();

    await processPickedFile(slot, f);
  }

    async function onSave() {

      setMsg("");
    if (!vendorId) { setMsg("vendorId가 없습니다."); return; }
    if (!purchaseDate) { setMsg("구매일자를 선택해줘."); return; }
    if (selectedCount === 0) { setMsg("영수증 사진을 최소 1장 첨부해줘."); return; }

    const a = Number(amountDigits || "0");
    if (!Number.isFinite(a) || a <= 0) { setMsg("금액을 올바르게 입력해줘."); return; }
    if (paymentMethod === "transfer" && !depositDate) { setMsg("입금일을 선택해줘."); return; }

    setSaving(true);

    try {
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user?.id; // ✅ 추가
      if (!userId) {
        setMsg("로그인이 필요합니다");
        router.push("/login");
        return;
      }

      const actualFiles = files.filter((f): f is File => !!f);
      const ts = Date.now();
      const targetVendorId = vendorId;

      const uploadedPaths: string[] = [];

      try {
        for (let idx = 0; idx < 3; idx++) {
          const f = files[idx];
          if (!f) continue;

          const key =
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `${Date.now()}_${Math.random().toString(16).slice(2)}`;

          const path = `${userId}/${targetVendorId}/${ts}_${idx + 1}_${key}.webp`;

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
        amount: a,
        payment_method: paymentMethod,
        deposit_date: paymentMethod === "transfer" ? depositDate : null,
        receipt_type: receiptType,
        status: effectiveStatus,
        image_path: uploadedPaths[0],
        receipt_date: purchaseDate,
        memo,
      };

      const { error: insErr } = await supabase.from("receipts").insert(payload);

      if (insErr) {
        // ✅ DB insert 실패하면 업로드 파일 롤백
        await supabase.storage.from("receipts").remove(uploadedPaths);
        throw insErr;
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
            border: selected ? s.border : "1px solid #ddd",
            color: selected ? s.color : "#111",
            background: selected ? s.background : "white",
          }}
        >
          {label}
        </button>
      </div>
    );
  };

  function ThumbSlot({ idx }: { idx: number }) {
    const hasFile = !!files[idx];
    const previewUrl = previews[idx];
    // ✅ 파일도 있고, 프리뷰 URL도 생성된 상태여야만 img 태그를 렌더링함
    const showImage = hasFile && previewUrl;

    return (
      <div style={{ width: "33.3333%", paddingRight: 10, boxSizing: "border-box" }}>
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
            cursor: !hasFile ? "pointer" : "default",
          }}
          onClick={() => {
            if (!hasFile) openSheetForSlot(idx);
          }}
        >
          {showImage ? (
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
          ) : (
            <div style={{ fontSize: 28, fontWeight: 900, opacity: 0.55 }}>+</div>
          )}
        </div>
      </div>
    );
  }

  const stallText = formatStallNo(stallNo);

  return (
    <div style={{ maxWidth: 420, margin: "0 auto", padding: 8 }}>
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

      <div style={{ marginTop: 6, display: "grid", gap: 14 }}>
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
          <div style={{ fontSize: 14, fontWeight: 800, paddingTop: 10 }}>영수증 사진</div>
          <div style={{ width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginBottom: 10 }}>
              <button
                type="button"
                onClick={openCameraQuick}
                disabled={selectedCount >= MAX_IMAGES}
                style={{ border: "none", background: "transparent", fontSize: 27, opacity: selectedCount >= MAX_IMAGES ? 0.35 : 0.9, padding: 0 }}
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
            </div>
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
              style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd", fontSize: 16, fontWeight: 700 }}
            />
            <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, opacity: 0.7, fontWeight: 700 }}>
              원
            </div>
          </div>
        </div>

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
              <button type="button" onClick={() => { 
                const slot = sheetSlot ?? files.findIndex((f) => !f);
                if (slot === -1) return;
                setSheetSlot(slot);
                closeSheet(); cameraRef.current?.click(); }} style={{ width: "100%", padding: "16px 14px", background: "transparent", border: "none", fontSize: 16, fontWeight: 800 }}>카메라로 촬영</button>
              <div style={{ height: 1, background: "rgba(0,0,0,0.08)" }} />
              <button type="button" onClick={() => { 
                const slot = sheetSlot ?? files.findIndex((f) => !f);
                if (slot === -1) return;
                setSheetSlot(slot);
                closeSheet();
                filePickerRef.current?.click(); }} style={{ width: "100%", padding: "16px 14px", background: "transparent", border: "none", fontSize: 16, fontWeight: 800 }}>파일 선택</button>
            </div>
            <div style={{ height: 10 }} />
            <div style={{ background: "rgba(245,245,245,0.98)", borderRadius: 18, overflow: "hidden", border: "1px solid rgba(0,0,0,0.06)" }}>
              <button type="button" onClick={closeSheet} style={{ width: "100%", padding: "16px 14px", background: "transparent", border: "none", fontSize: 16, fontWeight: 900 }}>취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}