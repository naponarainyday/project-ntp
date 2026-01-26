"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import ReceiptLightbox from "@/components/ReceiptLightbox";

type PaymentMethod = "cash" | "transfer" | "payable";
type ReceiptStatus = "uploaded" | "requested" | "needs_fix" | "completed";
type ReceiptType = "standard" | "simple";
type InvoiceCapability = "supported" | "not_supported" | null;
type TaxType = "tax_free" | "tax" | "zero_rate";

type ReceiptRow = {
  id: string;
  vendor_id: string;
  tax_type: TaxType | null;
  vat_amount: number | null;
  total_amount: number | null;
  amount: number;
  payment_method: PaymentMethod;
  deposit_date: string | null;
  receipt_date: string | null;
  receipt_type: ReceiptType;
  status: ReceiptStatus;
  memo: string | null;
  created_at: string;
};

type VendorInfo = {
  id: string;
  name: string;
  stall_no: string | null;
  invoice_capability: InvoiceCapability;
  market_name?: string | null;
};

function formatWon(n: number) {
  try {
    return new Intl.NumberFormat("ko-KR").format(n);
  } catch {
    return String(n);
  }
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

function paymentLabel(pm: PaymentMethod) {
  if (pm === "cash") return "현금";
  if (pm === "transfer") return "입금";
  return "미수";
}

function statusLabel(s: ReceiptStatus) {
  if (s === "uploaded") return "요청대기";
  if (s === "requested") return "요청중";
  if (s === "needs_fix") return "수정필요";
  return "완료";
}

function taxTypeLabel(t: TaxType | null) {
  if (t === "tax") return "과세";
  if (t === "zero_rate") return "영세(0%)";
  return "면세";
}

export default function ReceiptDetailPage() {
  const router = useRouter();
  const params = useParams<{ receiptId: string }>();
  const sp = useSearchParams();

  const receiptId = params?.receiptId;

  const fromVendor = sp.get("fromVendor");
  const from = sp.get("from");

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const [receipt, setReceipt] = useState<ReceiptRow | null>(null);
  const [vendor, setVendor] = useState<VendorInfo | null>(null);

  const taxType = (receipt?.tax_type ?? "tax_free") as TaxType;

  // receipts/new와 동일한 의미:
  // - amount: 공급가(입력값)
  // - vat_amount: tax일 때만 10% (없으면 계산)
  // - total_amount: tax일 때 공급가+VAT (없으면 계산)
  const baseAmount = receipt?.amount ?? 0;

  const vatAmount = useMemo(() => {
    if (!receipt) return 0;
    if (taxType !== "tax") return 0;

    // DB에 vat_amount가 저장되어 있으면 그걸 우선 사용
    if (typeof receipt.vat_amount === "number" && Number.isFinite(receipt.vat_amount)) {
      return receipt.vat_amount;
    }

    // fallback: 10% 계산
    return Math.round(baseAmount * 0.1);
  }, [receipt, taxType, baseAmount]);

  const totalAmount = useMemo(() => {
    if (!receipt) return 0;

    // DB total_amount 우선
    if (typeof receipt.total_amount === "number" && Number.isFinite(receipt.total_amount)) {
      return receipt.total_amount;
    }

    if (taxType === "tax") return baseAmount + vatAmount;
    return baseAmount;
  }, [receipt, taxType, baseAmount, vatAmount]);

  const [signedUrls, setSignedUrls] = useState<Array<{ sort_order: number; url: string }>>([]);
  const [lightboxOpen, setLightboxOpen] = useState<{ startIndex: number } | null>(null);

  const marketBadgeStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 800,
    padding: "2px 6px",
    borderRadius: 10,
    background: "#ffffff",
    color: "#3d3d3d",
  };

  const cardStyle: React.CSSProperties = {
    border: "1px solid #9f9f9f",
    borderRadius: 14,
    padding: 12,
    background: "white",
  };

  useEffect(() => {
    if (!receiptId) return;

    let ignore = false;

    (async () => {
      setLoading(true);
      setMsg("");

      try {
        const { data: authData, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;

        const userId = authData?.user?.id ?? null;
        if (!userId) throw new Error("로그인이 필요합니다.");

        const { data: r, error: rErr } = await supabase
          .from("receipts")
          .select("id, vendor_id, tax_type, amount, vat_amount, total_amount, payment_method, deposit_date, receipt_date, receipt_type, status, memo, created_at")
          .eq("id", receiptId)
          .eq("user_id", userId)
          .maybeSingle();

        if (rErr) throw rErr;
        if (!r) throw new Error("영수증을 찾을 수 없습니다.");
        if (ignore) return;

        setReceipt(r as any);

        const { data: v, error: vErr } = await supabase
          .from("vendors")
          .select("id, name, stall_no, invoice_capability, markets(name)")
          .eq("id", (r as any).vendor_id)
          .maybeSingle();

        if (!ignore) {
          if (vErr) {
            const { data: v2, error: v2Err } = await supabase
              .from("vendors")
              .select("id, name, stall_no, invoice_capability")
              .eq("id", (r as any).vendor_id)
              .maybeSingle();
            if (v2Err) throw v2Err;

            setVendor({
              id: v2!.id,
              name: v2!.name,
              stall_no: v2!.stall_no,
              invoice_capability: (v2 as any).invoice_capability ?? null,
              market_name: null,
            });
          } else {
            setVendor({
              id: (v as any).id,
              name: (v as any).name,
              stall_no: (v as any).stall_no,
              invoice_capability: (v as any).invoice_capability ?? null,
              market_name: (v as any)?.markets?.name ?? null,
            });
          }
        }

        const { data: imgs, error: imgErr } = await supabase
          .from("receipt_images")
          .select("path, sort_order")
          .eq("receipt_id", receiptId)
          .eq("user_id", userId)
          .order("sort_order", { ascending: true });

        if (imgErr) throw imgErr;

        const normalized = (imgs ?? [])
          .map((x: any) => ({ sort_order: Number(x.sort_order), path: x.path as string }))
          .filter((x) => x.path && Number.isFinite(x.sort_order))
          .sort((a, b) => a.sort_order - b.sort_order);

        const signedResults = await Promise.all(
          normalized.map(async (it) => {
            const { data: s, error: sErr } = await supabase.storage.from("receipts").createSignedUrl(it.path, 60 * 60);
            if (sErr) return null;
            const url = s?.signedUrl ?? null;
            if (!url) return null;
            return { sort_order: it.sort_order, url };
          })
        );

        const finalSigned = signedResults.filter(Boolean) as Array<{ sort_order: number; url: string }>;
        finalSigned.sort((a, b) => a.sort_order - b.sort_order);

        if (!ignore) setSignedUrls(finalSigned);
      } catch (e: any) {
        if (!ignore) setMsg(e?.message ?? "로드 오류");
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [receiptId]);

  const headerTitle = useMemo(() => {
    if (!receipt) return "영수증";
    const d = receipt.receipt_date ? receipt.receipt_date : "";
    return d ? `영수증 · ${d}` : "영수증";
  }, [receipt]);

  const backTarget = useMemo(() => {
    if (fromVendor) return `/vendors/${fromVendor}`;
    if (from === "receipts") return `/receipts`;
    return null;
  }, [fromVendor, from]);

  const onBack = () => {
    if (backTarget) router.push(backTarget);
    else router.back();
  };

  const onEdit = () => {
    if (!receipt) return;
    const qs = new URLSearchParams();
    qs.set("edit", receipt.id);
    if (fromVendor) qs.set("fromVendor", fromVendor);
    else if (receipt.vendor_id) qs.set("fromVendor", receipt.vendor_id);
    router.push(`/receipts/new?${qs.toString()}`);
  };

  return (
    <div style={{ margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          type="button"
          onClick={onBack}
          style={{ padding: "0px 4px", fontWeight: 900, fontSize: 13, background: "white" }}
        >
          ←
        </button>
        <div style={{ fontWeight: 900, fontSize: 15 }}>{headerTitle}</div>
        <button
          type="button"
          onClick={onEdit}
          disabled={!receipt || loading}
          style={{
            marginLeft: "auto",
            padding: "8px 10px",
            borderRadius: 12,
            border: "1px solid #0B1F5B",
            background: "white",
            fontWeight: 700,
            fontSize: 13,
            opacity: !receipt || loading ? 0.5 : 1,
          }}
        >
          수정
        </button>
      </div>

      {loading ? <div style={{ padding: 16, fontSize: 13, opacity: 0.7, fontWeight: 800 }}>불러오는 중…</div> : null}

      {msg ? <div style={{ padding: 16, fontSize: 13, opacity: 0.85, whiteSpace: "pre-wrap", textAlign: "center" }}>{msg}</div> : null}

      {!loading && receipt ? (
        <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ flexShrink: 0 }}>{vendor ? capabilityDot(vendor.invoice_capability) : "🔘"}</span>
              <div style={{ fontWeight: 900, fontSize: 16, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {vendor?.name ?? "상가"}
              </div>
              {vendor?.stall_no ? <span style={{ fontWeight: 700, color: "#777", flexShrink: 0 }}>{formatStallNo(vendor.stall_no)}</span> : null}
              {vendor?.market_name ? <span style={{ marginLeft: "auto", flexShrink: 0, ...marketBadgeStyle }}>[{vendor.market_name}]</span> : null}
            </div>
          </div>

          

          <div style={cardStyle}>
            <div style={{ display: "grid", gap: 15, marginLeft: 5 }}>
              <Row label="구매일" value={receipt.receipt_date ?? "-"} />
              <Row label="과세구분" value={taxTypeLabel(receipt.tax_type)} />              
              <Row label="금액" value={`${formatWon(baseAmount)}원`} />
              {taxType === "tax" ? (
                <>
                  <Row label="부가세(10%)" value={`${formatWon(vatAmount)}원`} />
                  <Row label="합계금액" value={`${formatWon(totalAmount)}원`} />
                </>
              ) : null}
              <Row label="지급" value={paymentLabel(receipt.payment_method)} />
              {receipt.payment_method === "transfer" ? <Row label="입금일" value={receipt.deposit_date ?? "-"} /> : null}
              <Row label="유형" value={receipt.receipt_type === "simple" ? "간이" : "일반"} />
              <Row label="상태" value={statusLabel(receipt.status)} />
              <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: 12, alignItems: "start" }}>
                <div style={{ fontSize: 14, fontWeight: 800, paddingTop: 2 }}>메모</div>
                <div style={{ fontSize: 14, opacity: 0.9, whiteSpace: "pre-wrap" }}>{receipt.memo?.trim() ? receipt.memo : "-"}</div>
              </div>
            </div>
          </div>

          <div style={cardStyle}>
              <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 10, marginLeft: 5 }}>영수증 사진</div>

              {signedUrls.length === 0 ? (
                <div style={{ fontSize: 13, opacity: 0.7 }}>사진이 없습니다.</div>
              ) : (
                <div style={{ display: "flex", gap: 4, overflowX: "auto" }}>
                  {signedUrls.map((it, idx) => (
                    <div key={it.sort_order} style={{ width: "33.3333%" }}>
                      <div
                        onClick={() => setLightboxOpen({ startIndex: idx })}
                        style={{
                          width: "100%",
                          aspectRatio: "1 / 1",
                          borderRadius: 14,
                          border: "1px solid #ddd",
                          overflow: "hidden",
                          background: "#fff",
                          cursor: "pointer",
                        }}
                      >
                        <img src={it.url} alt={`영수증 ${it.sort_order}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
        </div>
      ) : null}

      {/* ✅ Lightbox는 return 내부 맨 아래 */}
      <ReceiptLightbox
        urls={signedUrls.map((x) => x.url)}
        startIndex={lightboxOpen?.startIndex ?? -1}
        onClose={() => setLightboxOpen(null)}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: 12, alignItems: "center" }}>
      <div style={{ fontSize: 14, fontWeight: 800 }}>{label}</div>
      <div style={{ fontSize: 14, opacity: 0.9 }}>{value}</div>
    </div>
  );
}
