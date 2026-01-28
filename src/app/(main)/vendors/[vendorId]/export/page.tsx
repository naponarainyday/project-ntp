"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Copy, ArrowLeft } from "lucide-react";

type ReceiptStatus = "uploaded" | "requested" | "needs_fix" | "completed";
type PaymentMethod = "cash" | "transfer" | "payable";
type TaxType = "tax_free" | "tax" | "zero_rate";

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
  memo?: string | null;
};

type ExportPayload = {
  vendorId: string;
  receiptIds: string[];
  status?: ReceiptStatus;
  taxType?: TaxType;
};

type ProfileLite = {
  company_name?: string | null; // 상호명
  tax_id?: string | null;   // 사업자등록번호
  rep_name?: string | null;      // 대표자명
  email?: string | null;         // 수신 이메일(또는 로그인 이메일)
};

function paymentLabel(pm: PaymentMethod) {
  if (pm === "transfer") return "입금";
  if (pm === "payable") return "미수";
  return "현금";
}

function formatMoney(n: number) {
  try {
    return Number(n).toLocaleString("ko-KR");
  } catch {
    return String(n);
  }
}

function toDateObj(s?: string | null) {
  if (!s) return null;
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return null;
  return new Date(t);
}

function pickRowDate(r: ReceiptRow) {
  // 구매일(우선) → 입금일 → 생성일
  return r.receipt_date ?? r.deposit_date ?? r.created_at;
}

function fmtMMslashDD(d: Date) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}`;
}

function fmtYYdashMMdashDD(d: Date) {
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function fmtShortDate(d: Date, yearMixed: boolean) {
  return yearMixed ? fmtYYdashMMdashDD(d) : fmtMMslashDD(d);
}

export default function VendorExportPage() {
  const params = useParams<{ vendorId: string | string[] }>();
  const vendorId = Array.isArray(params.vendorId) ? params.vendorId[0] : params.vendorId;

  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const [payload, setPayload] = useState<ExportPayload | null>(null);
  const [rows, setRows] = useState<ReceiptRow[]>([]);
  const [profile, setProfile] = useState<ProfileLite | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [bizNameOn, setBizNameOn] = useState(true);
  const [bizNoOn, setBizNoOn] = useState(true);
  const [ceoOn, setCeoOn] = useState(true);

  function formatBizNo(v?: string | null) {
    if (!v) return null;
    const digits = String(v).replace(/[^\d]/g, "");
    if (digits.length !== 10) return v; // 10자 아니면 원문 유지
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
  }


  // ✅ 체크 옵션들
  const [optBiz, setOptBiz] = useState(true);
  const [optDate, setOptDate] = useState(true);
  const [optAmount, setOptAmount] = useState(true);
  const [optPay, setOptPay] = useState(true);
  const [optReceiverEmail, setOptReceiverEmail] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setMsg("");

      try {
        // 1) payload 로드
        const raw = sessionStorage.getItem("vendor_export_payload");
        if (!raw) {
          setMsg("내보내기 정보가 없습니다. 상가 페이지에서 영수증을 선택한 뒤 내보내기를 눌러주세요.");
          setLoading(false);
          return;
        }

        const parsed = JSON.parse(raw) as ExportPayload;
        if (!parsed?.receiptIds?.length || parsed.vendorId !== vendorId) {
          setMsg("내보내기 정보가 유효하지 않습니다. 다시 선택해 주세요.");
          setLoading(false);
          return;
        }
        setPayload(parsed);

        // 2) 로그인
        const { data: authData, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;

        const user = authData?.user ?? null;
        if (!user?.id) {
          router.push("/login");
          return;
        }
        setUserEmail(user.email ?? null);

        // 3) profile 로드 (컬럼명은 너희 테이블에 맞게 조정)
        //    - 일단 가능한 컬럼들을 select 해보고, 없으면 null로 처리되게 작성
        const { data: p, error: pErr } = await supabase
          .from("profiles")
          .select("company_name, tax_id, rep_name, email")
          .eq("id", user.id)
          .maybeSingle();

        if (pErr) {
          // profile 컬럼명이 다를 수 있으니, 에러여도 페이지는 살려둠
          console.log("profile load error:", pErr);
        } else {
          setProfile((p ?? null) as any);
        }

        // 4) receipts 로드 (선택된 id만)
        const { data: r, error: rErr } = await supabase
          .from("receipts")
          .select("id, vendor_id, amount, tax_type, vat_amount, total_amount, status, payment_method, deposit_date, receipt_date, created_at, memo")
          .eq("vendor_id", vendorId)
          .in("id", parsed.receiptIds);

        if (rErr) throw rErr;

        const list = ((r ?? []) as ReceiptRow[]).slice();
        // 날짜 기준 정렬(오름차순이 읽기 편함)
        list.sort((a, b) => {
          const ta = Date.parse(pickRowDate(a));
          const tb = Date.parse(pickRowDate(b));
          return (Number.isFinite(ta) ? ta : 0) - (Number.isFinite(tb) ? tb : 0);
        });
        setRows(list);
      } catch (e: any) {
        console.log("EXPORT LOAD ERROR:", e);
        setMsg(e?.message ?? "불러오기 실패");
      } finally {
        setLoading(false);
      }
    })();
  }, [vendorId, router]);

  const yearMixed = useMemo(() => {
    if (rows.length <= 1) return false;
    const years = new Set<number>();
    for (const r of rows) {
      const d = toDateObj(pickRowDate(r));
      if (d) years.add(d.getFullYear());
    }
    return years.size >= 2;
  }, [rows]);

  const sumBase = useMemo(() => rows.reduce((acc, r) => acc + Number(r.amount || 0), 0), [rows]);
  const sumVat = useMemo(() => rows.reduce((acc, r) => acc + Number(r.vat_amount || 0), 0), [rows]);
  const hasVat = sumVat > 0;

  const bizBlock = useMemo(() => {
    const bn = profile?.company_name ?? null;
    const bnoRaw = profile?.tax_id ?? null;
    const ceo = profile?.rep_name ?? null;

    const bno = formatBizNo(bnoRaw);

    const emptyAll = !bn && !bnoRaw && !ceo;
    if (emptyAll) return `사업자정보: 없음 (설정에서 입력 필요)`;

    const lines: string[] = [];
    lines.push("사업자정보:");

    // ✅ 하위 체크박스 반영
    if (bizNameOn) lines.push(`- 상호명: ${bn ?? "없음"}`);
    if (bizNoOn) lines.push(`- 사업자번호: ${bno ?? "없음"}`);
    if (ceoOn) lines.push(`- 대표자명: ${ceo ?? "없음"}`);

    // ✅ 전부 꺼버리면 안내
    if (lines.length === 1) lines.push("- (선택된 항목 없음)");

    return lines.join("\n");
  }, [profile, bizNameOn, bizNoOn, ceoOn]);

  const receiverEmailText = useMemo(() => {
    // ✅ profile.email 우선, 없으면 로그인 이메일, 그것도 없으면 user id 느낌으로(원문 요구)
    const pEmail = profile?.email ?? null;
    return pEmail || userEmail || "(email 없음)";
  }, [profile, userEmail]);

  const listLines = useMemo(() => {
    const lines: string[] = [];
    for (const r of rows) {
      const d = toDateObj(pickRowDate(r));
      const dateText = d ? fmtShortDate(d, yearMixed) : "-";

      const amountText = `${formatMoney(Number(r.amount || 0))}원`;
      const pay = paymentLabel(r.payment_method);

      let right = pay;
      if (r.payment_method === "transfer") {
        const dep = toDateObj(r.deposit_date);
        if (dep) right = `${pay} (${fmtShortDate(dep, yearMixed)})`;
      }

      const parts: string[] = [];
      if (optDate) parts.push(dateText);
      if (optAmount) parts.push(amountText);
      if (optPay) parts.push(right);

      if (parts.length === 0) parts.push(dateText, amountText, right);

      lines.push(parts.join("  "));
    }
    return lines;
  }, [rows, optDate, optAmount, optPay, yearMixed]);


  const titleLine = useMemo(() => {
    const n = rows.length;
    return `영수증 ${n}건 세금계산서 발행 요청드립니다.`;
  }, [rows.length]);

  const composedText = useMemo(() => {
    const blocks: string[] = [];
    blocks.push(titleLine);

    if (optBiz) {
      blocks.push("");
      blocks.push(bizBlock);
      // 사업자정보가 없을 때 “설정으로 이동” 유도는 UI에서 버튼으로 처리
    }

    blocks.push("");
    blocks.push(listLines.join("\n"));

    blocks.push("");
    blocks.push(`합계: ${formatMoney(sumBase)} 원 (부가세 미포함)`);
    if (hasVat) blocks.push(`부가세 합계: ${formatMoney(sumVat)} 원`);

    if (optReceiverEmail) {
      blocks.push("");
      blocks.push(`수신 이메일: ${receiverEmailText}`);
    }

    return blocks.join("\n");
  }, [titleLine, optBiz, bizBlock, listLines, sumBase, hasVat, sumVat, optReceiverEmail, receiverEmailText]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(composedText);
      setMsg("복사 완료!");
      setTimeout(() => setMsg(""), 1200);
    } catch (e) {
      console.log("clipboard error:", e);
      setMsg("복사에 실패했습니다. (브라우저 권한/HTTPS 확인)");
    }
  };

  const bizEmpty = useMemo(() => {
    const bn = profile?.company_name ?? null;
    const bno = profile?.tax_id ?? null;
    const ceo = profile?.rep_name ?? null;
    return !bn && !bno && !ceo;
  }, [profile]);

  return (
    <div style={{ margin: "0 auto",  }}>
      {/* top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            background: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
          aria-label="뒤로"
          title="뒤로"
        >
          <ArrowLeft size={18} />
        </button>

        <div style={{ fontSize: 16, fontWeight: 900 }}>내보내기</div>

        <button
          type="button"
          onClick={copyToClipboard}
          disabled={loading || rows.length === 0}
          style={{
            marginLeft: "auto",
            height: 36,
            borderRadius: 12,
            border: "1px solid #0B1F5B",
            background: loading || rows.length === 0 ? "#E5E7EB" : "#334155",
            color: loading || rows.length === 0 ? "#6B7280" : "#ffffff",
            padding: "0 12px",
            fontSize: 14,
            fontWeight: 700,
            cursor: loading || rows.length === 0 ? "not-allowed" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            whiteSpace: "nowrap",
          }}
        >
          <Copy size={16} />
          복사
        </button>
      </div>

      {msg ? (
        <div style={{ marginBottom: 10, fontSize: 13, fontWeight: 800, opacity: 0.85, whiteSpace: "pre-wrap" }}>
          {msg}
        </div>
      ) : null}

      {loading ? (
        <div style={{ marginTop: 12, fontSize: 14, opacity: 0.75 }}>불러오는 중...</div>
      ) : rows.length === 0 ? (
        <div style={{ marginTop: 12, fontSize: 14, opacity: 0.75 }}>
          선택된 영수증이 없습니다. 상가 페이지에서 다시 선택해 주세요.
        </div>
      ) : (
        <>
          {/* 텍스트보드 */}
          <div
            style={{
              border: "1px solid #c6c6c6",
              background: "#fff",
              borderRadius: 14,
              padding: 12,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.7, marginBottom: 8 }}>
              체크박스 선택에 따라 자동 구성됩니다
            </div>

            <textarea
              value={composedText}
              readOnly
              style={{
                width: "100%",
                minHeight: 250,
                resize: "vertical",
                borderRadius: 12,
                border: "1px solid #555555",
                padding: 12,
                fontSize: 14,
                lineHeight: 1.3,
                outline: "none",
              }}
            />
          </div>

          {/* 옵션 체크박스 */}
          <div style={{ marginTop: 12 }}>
            {/* 사업자정보 */}
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
              <input type="checkbox" checked={optBiz} onChange={(e) => setOptBiz(e.target.checked)} />
              <div style={{ display: "grid", gap: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 900 }}>사업자정보</div>
                <div style={{ fontSize: 12, opacity: 0.75, whiteSpace: "pre-wrap" }}>
                  {bizEmpty ? "없음 (설정에서 입력 필요)" : ""}
                </div>

                {bizEmpty ? (
                  <button
                    type="button"
                    onClick={() => router.push("/settings/profile")}
                    style={{
                      width: "fit-content",
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: "1px solid #E5E7EB",
                      background: "#F9FAFB",
                      fontSize: 12,
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    사업자정보 입력하러 가기
                  </button>
                ) : null}
                {optBiz && !bizEmpty ? (
                  <div style={{ marginTop: 8, paddingLeft: 10, display: "grid", gap: 6 }}>
                    <label style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer" }}>
                      <input type="checkbox" checked={bizNameOn} onChange={(e) => setBizNameOn(e.target.checked)} />
                      <div style={{ fontSize: 13, fontWeight: 800 }}>상호명</div>
                    </label>

                    <label style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer" }}>
                      <input type="checkbox" checked={bizNoOn} onChange={(e) => setBizNoOn(e.target.checked)} />
                      <div style={{ fontSize: 13, fontWeight: 800 }}>사업자번호</div>
                    </label>

                    <label style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer" }}>
                      <input type="checkbox" checked={ceoOn} onChange={(e) => setCeoOn(e.target.checked)} />
                      <div style={{ fontSize: 13, fontWeight: 800 }}>대표자명</div>
                    </label>
                  </div>
                ) : null}
              </div>
            </label>

            <div style={{ height: 10 }} />

            <label style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer" }}>
              <input type="checkbox" checked={optDate} onChange={(e) => setOptDate(e.target.checked)} />
              <div style={{ fontSize: 14, fontWeight: 900 }}>구매일</div>
            </label>

            <div style={{ height: 8 }} />

            <label style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer" }}>
              <input type="checkbox" checked={optAmount} onChange={(e) => setOptAmount(e.target.checked)} />
              <div style={{ fontSize: 14, fontWeight: 900 }}>금액</div>
            </label>

            <div style={{ height: 8 }} />

            <label style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer" }}>
              <input type="checkbox" checked={optPay} onChange={(e) => setOptPay(e.target.checked)} />
              <div style={{ fontSize: 14, fontWeight: 900 }}>지급방식 (입금이면 날짜 포함)</div>
            </label>

            <div style={{ height: 8 }} />

            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={optReceiverEmail}
                onChange={(e) => setOptReceiverEmail(e.target.checked)}
                style= {{marginTop: 4}}
              />
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ fontSize: 14, fontWeight: 900 }}>수신 이메일</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  {receiverEmailText}
                </div>
              </div>
            </label>
          </div>
        </>
      )}
    </div>
  );
}
