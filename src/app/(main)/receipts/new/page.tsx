"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type PaymentMethod = "cash" | "transfer";
type ReceiptStatus = "uploaded" | "requested" | "needs_fix" | "completed";
type ReceiptType = "standard" | "simple";
type InvoiceCapability = "supported" | "not_supported" | null;

interface VendorOption {
  id: string;
  name: string;
  stall_no: string | null;
  market_name?: string | null;
  invoice_capability: InvoiceCapability;
  market_sort_order?: number | null;
  stall_no_num?: number | null;
}

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

export default function ReceiptsNewPage() {
  const router = useRouter();

  // ---------- Vendor Search (요 UI를 따름) ----------
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVendor, setSelectedVendor] = useState<VendorOption | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const vendorPickerWrapRef = useRef<HTMLDivElement | null>(null);

  // ---------- Receipt Form (vendorId/new UI 그대로) ----------
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

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetSlot, setSheetSlot] = useState<number | null>(null);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const effectiveStatus = useMemo<ReceiptStatus>(() => {
    return receiptType === "simple" ? "completed" : status;
  }, [receiptType, status]);

  const amountDisplay = useMemo(
    () => formatNumberWithCommaFromDigits(amountDigits),
    [amountDigits]
  );

  const selectedCount = useMemo(() => files.filter(Boolean).length, [files]);

  // ---------- Load vendors (v_vendor_list_page2) ----------
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("v_vendor_list_page2")
        .select(
            "vendor_id, name, stall_no, invoice_capability, market_name, market_sort_order, stall_no_num"
        )
        .order("market_sort_order", { ascending: true, nullsFirst: false })
        .order("stall_no_num", { ascending: true, nullsFirst: false })
        .order("stall_no", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true });

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

  // ---------- Preview URLs ----------
  useEffect(() => {
    previews.forEach((u) => u && URL.revokeObjectURL(u));
    const next = files.map((f) => (f ? URL.createObjectURL(f) : undefined));
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

  function openCameraQuick() {
    if (selectedCount >= MAX_IMAGES) return;
    const slot = files.findIndex((f) => !f);
    if (slot === -1) return;
    setSheetSlot(slot);
    cameraRef.current?.click();
  }

  function onPickFromFile(inputFiles: FileList | null) {
    if (!inputFiles || inputFiles.length === 0) return;
    if (sheetSlot === null) return;
    setFileAtSlot(sheetSlot, inputFiles[0]);
    if (filePickerRef.current) filePickerRef.current.value = "";
    closeSheet();
  }

  function onPickFromCamera(inputFiles: FileList | null) {
    if (!inputFiles || inputFiles.length === 0) return;
    const slot = sheetSlot ?? files.findIndex((f) => !f);
    if (slot === -1) return;
    setFileAtSlot(slot, inputFiles[0]);
    if (cameraRef.current) cameraRef.current.value = "";
    closeSheet();
  }

  // ---------- Save ----------
  async function onSave() {
    setMsg("");

    if (!selectedVendor) {
      setMsg("상가를 선택해줘.");
      return;
    }
    if (!purchaseDate) {
      setMsg("구매일자를 선택해줘.");
      return;
    }
    if (selectedCount === 0) {
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

    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;

      const userId = authData?.user?.id ?? null;
      if (!userId) throw new Error("로그인이 필요합니다.");

      const actualFiles = files.filter((f): f is File => !!f);
      const ts = Date.now();
      const uploadedPaths: string[] = [];

      for (let i = 0; i < actualFiles.length; i++) {
        const f = actualFiles[i];
        const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${userId}/${selectedVendor.id}/${ts}_${i + 1}.${ext}`;

        const { error: upErr } = await supabase.storage
          .from("receipts")
          .upload(path, f, { upsert: false });

        if (upErr) throw upErr;
        uploadedPaths.push(path);
      }

      const payload = {
        user_id: userId,
        vendor_id: selectedVendor.id,
        amount: a,
        payment_method: paymentMethod,
        deposit_date: paymentMethod === "transfer" ? depositDate : null,
        receipt_type: receiptType,
        status: effectiveStatus,
        image_path: uploadedPaths[0],
        receipt_date: purchaseDate,
      };

      const { error: insErr } = await supabase.from("receipts").insert(payload);
      if (insErr) throw insErr;

      router.push(`/vendors/${selectedVendor.id}`);
    } catch (e: any) {
      setMsg(e?.message ?? "저장 오류");
    } finally {
      setSaving(false);
    }
  }

  // ---------- UI bits (vendorId/new 그대로) ----------
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

  const StatusButton = (
    key: ReceiptStatus,
    label: string,
    s: React.CSSProperties
  ) => {
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
    const hasFile = !!files[idx];
    const previewUrl = previews[idx];
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

  const marketBadgeStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 800,
    padding: "6px 10px",
    borderRadius: 10,
    background: "#f2f2f2",
    color: "#3d3d3d",
  };

  const stallText = selectedVendor ? formatStallNo(selectedVendor.stall_no) : "";

  return (
    <div style={{ maxWidth: 420, margin: "0 auto", padding: 10 }}>

      {/* hidden inputs */}
      <input
        ref={filePickerRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => onPickFromFile(e.target.files)}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={(e) => onPickFromCamera(e.target.files)}
      />

      <div style={{ marginTop: 12, display: "grid", gap: 14 }}>
        {/* ===== 상가명: 검색 UI(요 UI 그대로) ===== */}
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
            }}
          >
            <span style={{ flexShrink: 0 }}>
              {selectedVendor ? capabilityDot(selectedVendor.invoice_capability) : "🔍"}
            </span>
            <input
              placeholder="상가명 또는 호수 검색"
              value={searchQuery}
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
              }}
            />
          </div>

          {/* 선택된 상가 부가정보: stall_no / market */}
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
                }}
              >
                변경
              </button>
            </div>
          )}

          {/* 드롭다운 */}
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
                      <div style={{ fontWeight: 900, fontSize: 15, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {v.name}
                      </div>
                      {stall ? (
                        <span style={{ fontWeight: 700, color: "#777", flexShrink: 0 }}>{stall}</span>
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

        {/* ===== 아래부터는 [vendorId]/receipts/new UI 그대로 ===== */}
        <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>구매일</div>
          <input
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
            style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd", fontSize: 14 }}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", alignItems: "start", gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 800, paddingTop: 10 }}>영수증 사진</div>
          <div style={{ width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginBottom: 10 }}>
              <button
                type="button"
                onClick={openCameraQuick}
                disabled={selectedCount >= MAX_IMAGES}
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: 27,
                  opacity: selectedCount >= MAX_IMAGES ? 0.35 : 0.9,
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
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>금액</div>
          <div style={{ position: "relative" }}>
            <input
              value={amountDisplay}
              onChange={(e) => setAmountDigits(onlyDigits(e.target.value).slice(0, 12))}
              placeholder="예: 45,000"
              inputMode="numeric"
              style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd", fontSize: 16, fontWeight: 800 }}
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

        <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>지급 구분</div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={() => setPaymentMethod("cash")}
              style={{ ...pillBase, background: paymentMethod === "cash" ? "#f2f2f2" : "white" }}
            >
              현금
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod("transfer")}
              style={{ ...pillBase, background: paymentMethod === "transfer" ? "#f2f2f2" : "white" }}
            >
              입금
            </button>
          </div>
        </div>

        {paymentMethod === "transfer" && (
          <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>입금일</div>
            <input
              type="date"
              value={depositDate}
              onChange={(e) => setDepositDate(e.target.value)}
              style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd", fontSize: 14 }}
            />
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>영수증 유형</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setReceiptType("standard")}
              style={{ ...pillBase, background: receiptType === "standard" ? "#f2f2f2" : "white" }}
            >
              일반
            </button>
            <button
              type="button"
              onClick={() => setReceiptType("simple")}
              style={{ ...pillBase, background: receiptType === "simple" ? "#f2f2f2" : "white" }}
            >
              간이(자동완료)
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", alignItems: "start", gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 800, paddingTop: 10 }}>상태</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {StatusButton("uploaded", "업로드", { border: "2px solid #e11d48", color: "#e11d48", background: "#fff1f2" })}
            {StatusButton("completed", "완료", { border: "2px solid #9ca3af", color: "#374151", background: "#f3f4f6" })}
            {StatusButton("requested", "요청", { border: "2px solid #16a34a", color: "#166534", background: "#ecfdf5" })}
            {StatusButton("needs_fix", "수정필요", { border: "2px solid #f59e0b", color: "#92400e", background: "#fffbeb" })}
          </div>
        </div>

        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          style={{
            marginTop: 4,
            padding: "14px 16px",
            borderRadius: 16,
            border: "1px solid #ddd",
            background: saving ? "#f2f2f2" : "white",
            fontWeight: 900,
            fontSize: 16,
          }}
        >
          {saving ? "저장 중..." : "저장"}
        </button>

        {msg && (
          <div style={{ fontSize: 13, opacity: 0.85, whiteSpace: "pre-wrap", textAlign: "center" }}>
            {msg}
          </div>
        )}
      </div>

      {/* iOS 느낌 액션시트 (vendorId/new와 동일) */}
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
