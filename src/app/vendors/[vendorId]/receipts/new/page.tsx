"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type PaymentMethod = "cash" | "transfer";
type ReceiptStatus = "uploaded" | "requested" | "needs_fix" | "completed";
type ReceiptType = "standard" | "simple";

export default function NewReceiptPage() {
  const router = useRouter();
  const params = useParams<{ vendorId: string }>();
  const vendorId = params.vendorId;

  // UI states
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [vendorLabel, setVendorLabel] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string>("");

  // form states
  const [file, setFile] = useState<File | null>(null);
  const [amount, setAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [depositDate, setDepositDate] = useState<string>(""); // YYYY-MM-DD
  const [receiptType, setReceiptType] = useState<ReceiptType>("standard");
  const [status, setStatus] = useState<ReceiptStatus>("uploaded");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string>("");

  // 간이영수증이면 status는 completed로 강제
  const effectiveStatus = useMemo<ReceiptStatus>(() => {
    return receiptType === "simple" ? "completed" : status;
  }, [receiptType, status]);

  // vendor label 로드
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("name, stall_no")
        .eq("id", vendorId)
        .single();

      if (error) {
        console.log("VENDOR LOAD ERROR:", error);
        setVendorLabel("");
        return;
      }

      if (data) {
        const label = `${data.stall_no ? `[${data.stall_no}] ` : ""}${data.name}`;
        setVendorLabel(label);
      }
    })();
  }, [vendorId]);

  // 이미지 미리보기 URL 생성/정리
  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function validate(): string | null {
    if (!vendorId) return "vendorId가 없습니다. URL을 확인하세요.";
    if (!file) return "영수증 사진을 선택해줘.";

    const a = Number(String(amount).replaceAll(",", "").trim());
    if (!Number.isFinite(a) || a <= 0) return "금액을 올바르게 입력해줘.";

    if (paymentMethod === "transfer" && !depositDate) return "입금일을 선택해줘.";
    return null;
  }

  async function onSave() {
    setMsg("");
    const vErr = validate();
    if (vErr) {
      setMsg(vErr);
      return;
    }

    setSaving(true);

    try {
      // 로그인 확인 (RLS 통과 필수)
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;

      const userId = authData?.user?.id ?? null;
      console.log("USER ID (client):", userId);

      if (!userId) {
        setMsg("영수증 저장은 로그인 후 가능해요.");
        router.push("/login");
        return;
      }
      
      // 1) Storage 업로드
      const ext = (file!.name.split(".").pop() || "jpg").toLowerCase();
      const ts = Date.now();
      const path = `${userId}/${vendorId}/${ts}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("receipts")
        .upload(path, file!, { upsert: false });

      if (upErr) throw upErr;

      // 2) DB insert (user_id는 default auth.uid()로 자동 채워짐)
      const a = Number(String(amount).replaceAll(",", "").trim());

      const payload = {
        user_id: userId,
        vendor_id: vendorId,
        amount: a,
        payment_method: paymentMethod,
        deposit_date: paymentMethod === "transfer" ? depositDate : null,
        receipt_type: receiptType, // "standard" | "simple"
        status: effectiveStatus,   // simple이면 completed
        image_path: path,
        receipt_date: null as any, // 지금은 안 쓰면 NULL 유지(원하면 오늘날짜로 자동도 가능)
        memo: null as any,
      };

      const { error: insErr } = await supabase.from("receipts").insert(payload);
      if (insErr) throw insErr;

      setMsg("저장 완료!");
      router.push(`/vendors/${vendorId}`);
    } catch (e: any) {
      console.log("SAVE ERROR:", e);
      setMsg(e?.message ?? "저장 중 오류가 발생했어.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "0 auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <Link href={`/vendors/${vendorId}`} style={{ textDecoration: "underline", fontSize: 14 }}>
          ← 상가 상세
        </Link>
        <h1 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>영수증 업로드</h1>
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        {/* 상가명 */}
        <label style={{ fontSize: 13, fontWeight: 700 }}>상가명</label>
        <div style={{ padding: 12, borderRadius: 12, border: "1px solid #eee", fontSize: 14 }}>
          {vendorLabel || "(상가명 없음)"}
        </div>

        {/* 영수증 사진 */}
        <label style={{ fontSize: 13, fontWeight: 700 }}>영수증 사진</label>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid #ddd",
            background: "white",
            fontWeight: 700,
            textAlign: "left",
          }}
        >
          {file ? `파일 선택됨: ${file.name}` : "파일 선택"}
        </button>

        {previewUrl && (
          <div style={{ marginTop: 8 }}>
            <img
              src={previewUrl}
              alt="미리보기"
              style={{ width: "100%", borderRadius: 12, border: "1px solid #eee", display: "block" }}
            />
          </div>
        )}

        {/* 금액 */}
        <label style={{ fontSize: 13, fontWeight: 700 }}>금액</label>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="예: 45000"
          inputMode="numeric"
          style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
        />

        {/* 지급구분 */}
        <label style={{ fontSize: 13, fontWeight: 700 }}>지급구분</label>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={() => setPaymentMethod("cash")}
            style={{
              padding: "10px 12px",
              borderRadius: 999,
              border: "1px solid #ddd",
              background: paymentMethod === "cash" ? "#f2f2f2" : "white",
              fontWeight: 700,
            }}
          >
            현금
          </button>
          <button
            type="button"
            onClick={() => setPaymentMethod("transfer")}
            style={{
              padding: "10px 12px",
              borderRadius: 999,
              border: "1px solid #ddd",
              background: paymentMethod === "transfer" ? "#f2f2f2" : "white",
              fontWeight: 700,
            }}
          >
            입금
          </button>
        </div>

        {paymentMethod === "transfer" && (
          <>
            <label style={{ fontSize: 13, fontWeight: 700 }}>입금일</label>
            <input
              type="date"
              value={depositDate}
              onChange={(e) => setDepositDate(e.target.value)}
              style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
            />
          </>
        )}

        {/* 영수증 유형 */}
        <label style={{ fontSize: 13, fontWeight: 700 }}>영수증 유형</label>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={() => setReceiptType("standard")}
            style={{
              padding: "10px 12px",
              borderRadius: 999,
              border: "1px solid #ddd",
              background: receiptType === "standard" ? "#f2f2f2" : "white",
              fontWeight: 700,
            }}
          >
            일반
          </button>
          <button
            type="button"
            onClick={() => setReceiptType("simple")}
            style={{
              padding: "10px 12px",
              borderRadius: 999,
              border: "1px solid #ddd",
              background: receiptType === "simple" ? "#f2f2f2" : "white",
              fontWeight: 700,
            }}
          >
            간이(자동완료)
          </button>
        </div>

        {/* 상태(간이영수증이면 숨김) */}
        {receiptType !== "simple" && (
          <>
            <label style={{ fontSize: 13, fontWeight: 700 }}>상태</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ReceiptStatus)}
              style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
            >
              <option value="needs_fix">수정</option>
              <option value="requested">요청</option>
              <option value="uploaded">업로드</option>
              <option value="completed">완료</option>
            </select>
          </>
        )}

        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          style={{
            marginTop: 6,
            padding: "12px 14px",
            borderRadius: 14,
            border: "1px solid #ddd",
            background: saving ? "#f2f2f2" : "white",
            fontWeight: 900,
          }}
        >
          {saving ? "저장 중..." : "저장"}
        </button>

        {msg && <div style={{ fontSize: 13, opacity: 0.85, whiteSpace: "pre-wrap" }}>{msg}</div>}
      </div>

      <div style={{ marginTop: 14, fontSize: 12, opacity: 0.6 }}>vendorId: {vendorId}</div>
    </div>
  );
}
