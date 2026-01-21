"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type PaymentMethod = "cash" | "transfer" | "payable";
type ReceiptStatus = "uploaded" | "requested" | "needs_fix" | "completed";
type ReceiptType = "standard" | "simple";
type InvoiceCapability = "supported" | "not_supported" | null;

type ReceiptRow = {
  id: string;
  vendor_id: string;
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

type ReceiptImageRow = {
  id: string;
  receipt_id: string;
  user_id: string;
  path: string;
  sort_order: number; // 1~3
  created_at: string;
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
  if (s === "uploaded") return "업로드";
  if (s === "requested") return "요청중";
  if (s === "needs_fix") return "수정필요";
  return "완료";
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

  const [images, setImages] = useState<Array<{ sort_order: number; path: string }>>([]);
  const [signedUrls, setSignedUrls] = useState<Array<{ sort_order: number; url: string }>>([]);

  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const marketBadgeStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 800,
    padding: "6px 10px",
    borderRadius: 10,
    background: "#ffffff",
    color: "#3d3d3d",
  };

  const cardStyle: React.CSSProperties = {
    border: "1px solid #ddd",
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

        // 1) receipt 본문 로드
        const { data: r, error: rErr } = await supabase
          .from("receipts")
          .select("id, vendor_id, amount, payment_method, deposit_date, receipt_date, receipt_type, status, memo, created_at")
          .eq("id", receiptId)
          .eq("user_id", userId)
          .maybeSingle();

        if (rErr) throw rErr;
        if (!r) throw new Error("영수증을 찾을 수 없습니다.");

        if (ignore) return;
        setReceipt(r as any);

        // 2) vendor 정보 로드 (vendors + markets 조합이 있으면 더 좋지만, 최소 필드만)
        // - 너의 schema에 vendors.markets 관계가 있던 흐름이 있어 보여서, 아래처럼 시도
        const { data: v, error: vErr } = await supabase
          .from("vendors")
          .select("id, name, stall_no, invoice_capability, markets(name)")
          .eq("id", (r as any).vendor_id)
          .maybeSingle();

        // markets(name) 조인이 안 되면 에러날 수 있으니, 실패하면 vendors 단독으로 재시도
        if (vErr) {
          const { data: v2, error: v2Err } = await supabase
            .from("vendors")
            .select("id, name, stall_no, invoice_capability")
            .eq("id", (r as any).vendor_id)
            .maybeSingle();

          if (v2Err) throw v2Err;

          if (!ignore) {
            setVendor({
              id: v2!.id,
              name: v2!.name,
              stall_no: v2!.stall_no,
              invoice_capability: (v2 as any).invoice_capability ?? null,
              market_name: null,
            });
          }
        } else {
          if (!ignore) {
            setVendor({
              id: (v as any).id,
              name: (v as any).name,
              stall_no: (v as any).stall_no,
              invoice_capability: (v as any).invoice_capability ?? null,
              market_name: (v as any)?.markets?.name ?? null,
            });
          }
        }

        // 3) receipt_images 로드 (1~3)
        const { data: imgs, error: imgErr } = await supabase
          .from("receipt_images")
          .select("id, receipt_id, user_id, path, sort_order, created_at")
          .eq("receipt_id", receiptId)
          .eq("user_id", userId)
          .order("sort_order", { ascending: true });

        if (imgErr) throw imgErr;

        const normalized = (imgs ?? [])
          .map((x: any) => ({ sort_order: Number(x.sort_order), path: x.path as string }))
          .filter((x) => x.path && Number.isFinite(x.sort_order))
          .sort((a, b) => a.sort_order - b.sort_order);

        if (!ignore) setImages(normalized);

        // 4) signed url 생성 (병렬)
        const signedResults = await Promise.all(
          normalized.map(async (it) => {
            const { data: s, error: sErr } = await supabase.storage
              .from("receipts")
              .createSignedUrl(it.path, 60 * 60);

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
    // 우선순위: fromVendor -> vendors page / from=receipts -> receipts list / default back()
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
    const vid = receipt.vendor_id;
    const qs = new URLSearchParams();
    qs.set("edit", receipt.id);

    // 수정 후 돌아갈 맥락을 남겨두기
    if (fromVendor) qs.set("fromVendor", fromVendor);
    else if (vid) qs.set("fromVendor", vid); // 기본은 해당 vendor로

    router.push(`/receipts/new?${qs.toString()}`);
  };

  return (
    <div style={{ margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
        <button
          type="button"
          onClick={onBack}
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

        <div style={{ fontWeight: 900, fontSize: 15 }}>{headerTitle}</div>

        <button
          type="button"
          onClick={onEdit}
          disabled={!receipt || loading}
          style={{
            marginLeft: "auto",
            padding: "8px 10px",
            borderRadius: 12,
            border: "1px solid #ddd",
            fontWeight: 900,
            fontSize: 13,
            background: "white",
            opacity: !receipt || loading ? 0.5 : 1,
          }}
        >
          수정
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 16, fontSize: 13, opacity: 0.7, fontWeight: 800 }}>불러오는 중…</div>
      ) : null}

      {msg ? (
        <div style={{ padding: 16, fontSize: 13, opacity: 0.85, whiteSpace: "pre-wrap", textAlign: "center" }}>
          {msg}
        </div>
      ) : null}

      {!loading && receipt ? (
        <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
          {/* Vendor summary */}
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ flexShrink: 0 }}>{vendor ? capabilityDot(vendor.invoice_capability) : "🔘"}</span>
              <div
                style={{
                  fontWeight: 900,
                  fontSize: 16,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {vendor?.name ?? "상가"}
              </div>
              {vendor?.stall_no ? (
                <span style={{ fontWeight: 700, color: "#777", flexShrink: 0 }}>
                  {formatStallNo(vendor.stall_no)}
                </span>
              ) : null}
              {vendor?.market_name ? (
                <span style={{ marginLeft: "auto", flexShrink: 0, ...marketBadgeStyle }}>[{vendor.market_name}]</span>
              ) : null}
            </div>
          </div>

          {/* Images grid (up to 3) */}
          <div style={cardStyle}>
            <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 10 }}>영수증 사진</div>

            {signedUrls.length === 0 ? (
              <div style={{ fontSize: 13, opacity: 0.7 }}>사진이 없습니다.</div>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                {signedUrls.map((it) => (
                  <div key={it.sort_order} style={{ width: "33.3333%" }}>
                    <div
                      onClick={() => setLightboxUrl(it.url)}
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
                      <img
                        src={it.url}
                        alt={`영수증 ${it.sort_order}`}
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      />
                    </div>
                  </div>
                ))}

                {/* 빈 슬롯을 placeholder로 맞춰서 레이아웃 균일하게 */}
                {signedUrls.length < 3
                  ? Array.from({ length: 3 - signedUrls.length }).map((_, idx) => (
                      <div key={`empty-${idx}`} style={{ width: "33.3333%" }}>
                        <div
                          style={{
                            width: "100%",
                            aspectRatio: "1 / 1",
                            borderRadius: 14,
                            border: "1px dashed #ddd",
                            background: "#fafafa",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 900,
                            opacity: 0.25,
                          }}
                        >
                          +
                        </div>
                      </div>
                    ))
                  : null}
              </div>
            )}

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.65 }}>
              탭하면 크게 볼 수 있어
            </div>
          </div>

          {/* Details */}
          <div style={cardStyle}>
            <div style={{ display: "grid", gap: 10 }}>
              <Row label="구매일" value={receipt.receipt_date ?? "-"} />
              <Row label="금액" value={`${formatWon(receipt.amount)}원`} />
              <Row label="지급" value={paymentLabel(receipt.payment_method)} />
              {receipt.payment_method === "transfer" ? (
                <Row label="입금일" value={receipt.deposit_date ?? "-"} />
              ) : null}
              <Row label="유형" value={receipt.receipt_type === "simple" ? "간이" : "일반"} />
              <Row label="상태" value={statusLabel(receipt.status)} />
              <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: 12, alignItems: "start" }}>
                <div style={{ fontSize: 14, fontWeight: 800, paddingTop: 2 }}>메모</div>
                <div style={{ fontSize: 14, opacity: 0.9, whiteSpace: "pre-wrap" }}>
                  {receipt.memo?.trim() ? receipt.memo : "-"}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Lightbox */}
      {lightboxUrl ? (
        <div
          onClick={() => setLightboxUrl(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 14,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 520,
              borderRadius: 14,
              overflow: "hidden",
              background: "#000",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", padding: 10 }}>
              <div style={{ color: "white", fontWeight: 900, fontSize: 13, opacity: 0.9 }}>
                미리보기
              </div>
              <button
                type="button"
                onClick={() => setLightboxUrl(null)}
                style={{
                  marginLeft: "auto",
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.25)",
                  color: "white",
                  fontWeight: 900,
                  borderRadius: 10,
                  padding: "6px 10px",
                  cursor: "pointer",
                }}
              >
                닫기
              </button>
            </div>
            <img
              src={lightboxUrl}
              alt="영수증 확대"
              style={{ width: "100%", height: "auto", display: "block" }}
            />
          </div>
        </div>
      ) : null}
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
