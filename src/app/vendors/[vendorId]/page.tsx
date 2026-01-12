"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type VendorInfo = {
  id: string;
  name: string;
  stall_no: string | null;
  invoice_capability: "supported" | "not_supported" | null;
  markets?: { name: string | null } | null;
};

type ReceiptRow = {
  id: string;
  user_id: string;
  vendor_id: string;
  amount: number;
  status: "uploaded" | "requested" | "needs_fix" | "completed";
  payment_method: "cash" | "transfer";
  deposit_date: string | null;
  receipt_type: "standard" | "simple" | null;
  image_path: string | null;
  created_at: string;
};

function dot(cap: VendorInfo["invoice_capability"]) {
  return cap === "supported" ? "●" : "○";
}

function statusLabel(s: ReceiptRow["status"]) {
  switch (s) {
    case "needs_fix":
      return "수정";
    case "requested":
      return "요청";
    case "uploaded":
      return "업로드";
    case "completed":
      return "완료";
    default:
      return s;
  }
}

function formatMoney(n: number) {
  try {
    return Number(n).toLocaleString("ko-KR");
  } catch {
    return String(n);
  }
}

export default function VendorDetailPage() {
  const params = useParams<{ vendorId: string }>();
  const vendorId = params.vendorId;

  const [vendor, setVendor] = useState<VendorInfo | null>(null);
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [imgUrlById, setImgUrlById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  async function load() {
    setMsg("");
    setLoading(true);

    try {
      // 0) 로그인 유저 확인 (RLS + 필터용)
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;

      const userId = authData?.user?.id ?? null;
      if (!userId) {
        setMsg("로그인이 필요해요. /login에서 로그인 후 다시 시도해줘.");
        setReceipts([]);
        setVendor(null);
        return;
      }

      // 1) vendor 정보 로드
      // markets join은 vendors.market_id FK가 있으면 동작
      const { data: v, error: vErr } = await supabase
        .from("vendors")
        .select("id, name, stall_no, invoice_capability, markets(name)")
        .eq("id", vendorId)
        .single();

      if (vErr) throw vErr;
      setVendor(v as any);

      // 2) receipts 로드 (내 것만 확실히)
      const { data: r, error: rErr } = await supabase
        .from("receipts")
        .select("id, user_id, vendor_id, amount, status, payment_method, deposit_date, receipt_type, image_path, created_at")
        .eq("vendor_id", vendorId)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (rErr) throw rErr;

      const rows = (r ?? []) as ReceiptRow[];
      setReceipts(rows);

      // 3) 이미지 signed URL 생성 (최대 20개만)
      const urlMap: Record<string, string> = {};

      for (const row of rows.slice(0, 20)) {
        if (!row.image_path) continue;
        const { data, error } = await supabase.storage
          .from("receipts")
          .createSignedUrl(row.image_path, 60 * 30); // 30분

        if (!error && data?.signedUrl) {
          urlMap[row.id] = data.signedUrl;
        }
      }

      setImgUrlById(urlMap);
    } catch (e: any) {
      console.log("P4 LOAD ERROR:", e);
      setMsg(e?.message ?? "불러오기 실패");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId]);

  const vendorTitle = useMemo(() => {
    if (!vendor) return "";
    return `${vendor.stall_no ? `[${vendor.stall_no}] ` : ""}${vendor.name}`;
  }, [vendor]);

  async function updateStatus(receiptId: string, newStatus: ReceiptRow["status"]) {
    setMsg("");

    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id ?? null;
    if (!userId) {
      setMsg("로그인이 필요해요.");
      return;
    }

    const { error } = await supabase
      .from("receipts")
      .update({ status: newStatus })
      .eq("id", receiptId)
      .eq("user_id", userId);

    if (error) {
      console.log("STATUS UPDATE ERROR:", error);
      setMsg(error.message ?? "상태 변경 실패");
      return;
    }

    setReceipts((prev) =>
      prev.map((r) => (r.id === receiptId ? { ...r, status: newStatus } : r))
    );
  }

  return (
    <div style={{ maxWidth: 420, margin: "0 auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <Link href="/vendors" style={{ textDecoration: "underline", fontSize: 14 }}>
          ← 상가
        </Link>
        <Link
          href={`/vendors/${vendorId}/receipts/new`}
          style={{ marginLeft: "auto", textDecoration: "underline", fontSize: 14 }}
        >
          + 영수증 업로드
        </Link>
      </div>

      <div style={{ marginTop: 12 }}>
        <h1 style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>
          {vendorTitle || "상가 상세"}
        </h1>
        {vendor && (
          <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>
            [{vendor.markets?.name ?? "-"}] {dot(vendor.invoice_capability)}{" "}
            {vendor.invoice_capability ?? "not_supported"}
          </div>
        )}
      </div>

      {msg && (
        <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85, whiteSpace: "pre-wrap" }}>
          {msg}
        </div>
      )}

      <div style={{ marginTop: 12, borderTop: "1px solid #eee" }} />

      {loading ? (
        <div style={{ marginTop: 12, fontSize: 14, opacity: 0.7 }}>불러오는 중...</div>
      ) : receipts.length === 0 ? (
        <div style={{ marginTop: 12, fontSize: 14, opacity: 0.7 }}>
          아직 영수증이 없어요. 우측 상단에서 업로드해봐.
        </div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {receipts.map((r) => (
            <li
              key={r.id}
              style={{
                padding: "12px 0",
                borderBottom: "1px solid #f2f2f2",
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <div style={{ fontSize: 16, fontWeight: 800 }}>
                  {formatMoney(Number(r.amount))}원
                </div>
                <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.7 }}>
                  {new Date(r.created_at).toLocaleDateString("ko-KR")}
                </div>
              </div>

              <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, padding: "4px 8px", border: "1px solid #ddd", borderRadius: 999 }}>
                  {statusLabel(r.status)}
                </span>

                <span style={{ fontSize: 12, padding: "4px 8px", border: "1px solid #eee", borderRadius: 999, opacity: 0.8 }}>
                  {r.payment_method === "transfer" ? "입금" : "현금"}
                  {r.payment_method === "transfer" && r.deposit_date ? ` · ${r.deposit_date}` : ""}
                </span>

                {r.receipt_type === "simple" ? (
                  <span style={{ fontSize: 12, padding: "4px 8px", border: "1px solid #eee", borderRadius: 999, opacity: 0.8 }}>
                    간이영수증
                  </span>
                ) : null}
              </div>

              {/* 이미지 미리보기 */}
              {imgUrlById[r.id] && (
                <div style={{ marginTop: 8 }}>
                  <img
                    src={imgUrlById[r.id]}
                    alt="영수증"
                    style={{ width: "100%", borderRadius: 12, border: "1px solid #eee", display: "block" }}
                  />
                </div>
              )}

              {/* 상태 변경 */}
              <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => updateStatus(r.id, "needs_fix")}
                  style={{ padding: "8px 10px", borderRadius: 12, border: "1px solid #ddd", background: "white" }}
                >
                  수정
                </button>
                <button
                  type="button"
                  onClick={() => updateStatus(r.id, "requested")}
                  style={{ padding: "8px 10px", borderRadius: 12, border: "1px solid #ddd", background: "white" }}
                >
                  요청
                </button>
                <button
                  type="button"
                  onClick={() => updateStatus(r.id, "uploaded")}
                  style={{ padding: "8px 10px", borderRadius: 12, border: "1px solid #ddd", background: "white" }}
                >
                  업로드
                </button>
                <button
                  type="button"
                  onClick={() => updateStatus(r.id, "completed")}
                  style={{ padding: "8px 10px", borderRadius: 12, border: "1px solid #ddd", background: "white", fontWeight: 800 }}
                >
                  완료
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
