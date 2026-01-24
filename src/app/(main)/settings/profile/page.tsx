"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type ProfileForm = {
  company_name: string;
  tax_id: string; // ✅ 상태/DB는 숫자만
  email: string;
  rep_name: string;
  business_type: string;
  business_item: string;
};

// ✅ 하이픈 추가 유틸 (시각화 전용)
const formatTaxId = (val: string) => {
  const s = val.replace(/\D/g, "");
  if (s.length <= 3) return s;
  if (s.length <= 5) return `${s.slice(0, 3)}-${s.slice(3)}`;
  return `${s.slice(0, 3)}-${s.slice(3, 5)}-${s.slice(5, 10)}`;
};

// ✅ 숫자만 추출
const onlyDigits = (val: string) => val.replace(/\D/g, "");

export default function ProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState<ProfileForm>({
    company_name: "",
    tax_id: "",
    email: "",
    rep_name: "",
    business_type: "",
    business_item: "",
  });

  // ✅ 시각화 값(하이픈 포함)은 파생값으로
  const taxIdDisplay = useMemo(() => formatTaxId(form.tax_id), [form.tax_id]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setMsg("");

      try {
        // 1) 세션 확인
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;

        const user = data?.user;
        if (!user) {
          router.replace("/login");
          return;
        }

        // 2) 프로필 로딩 (신규 유저 406은 정상)
        const { data: profile, error: profileError, status } = await supabase
          .from("profiles")
          .select("company_name,tax_id,email,rep_name,business_type,business_item")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError && status !== 406) {
          console.error("프로필 로딩 에러:", profileError.message);
          // 그래도 화면은 보여주되, 빈 폼 유지
        }

        if (profile) {
          setForm({
            company_name: profile.company_name ?? "",
            tax_id: profile.tax_id ?? "",
            email: profile.email ?? "",
            rep_name: profile.rep_name ?? "",
            business_type: profile.business_type ?? "",
            business_item: profile.business_item ?? "",
          });
        }
      } catch (e: any) {
        console.log("PROFILE LOAD ERROR:", e);
        setMsg(e?.message ?? "불러오기 실패");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const validate = () => {
    if (!form.company_name.trim()) return "상호명을 입력해주세요.";
    if (!form.rep_name.trim()) return "대표자명을 입력해주세요.";
    if (!form.email.trim()) return "이메일을 입력해주세요.";
    if (form.tax_id.length !== 10) return "사업자등록번호는 10자리 숫자여야 합니다.";
    return null;
  };

  const handleSave = async () => {
    setMsg("");

    const errMsg = validate();
    if (errMsg) {
      setMsg(errMsg);
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;

      const user = data?.user;
      if (!user) {
        setMsg("로그인이 필요합니다.");
        router.replace("/login");
        return;
      }

      const { error: upsertError } = await supabase.from("profiles").upsert({
        id: user.id,
        company_name: form.company_name.trim(),
        tax_id: form.tax_id, // ✅ 숫자 10자리만 저장
        email: form.email.trim(),
        rep_name: form.rep_name.trim(),
        business_type: form.business_type?.trim() || null,
        business_item: form.business_item?.trim() || null,
      });

      if (upsertError) throw upsertError;

      setMsg("저장되었습니다.");
    } catch (e: any) {
      console.log("PROFILE SAVE ERROR:", e);
      setMsg(e?.message ?? "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ margin: "0 auto" }}>
      <div style={{ marginTop: 6 }}>
        <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 4 }}>사업자 정보</div>
        <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 14 }}>
          아래 정보는 세금계산서 발행에 사용됩니다.
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 16, fontSize: 14, opacity: 0.8, fontWeight: 800 }}>불러오는 중...</div>
      ) : null}

      {msg ? (
        <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9, whiteSpace: "pre-wrap", textAlign: "center" }}>
          {msg}
        </div>
      ) : null}

      {!loading ? (
        <div style={{ marginTop: 10, display: "grid", gap: 14 }}>
          {/* 상호명 */}
          <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>상호명</div>
            <input
              placeholder="예: NTP"
              value={form.company_name}
              onChange={(e) => setForm({ ...form, company_name: e.target.value })}
              disabled={saving}
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 12,
                border: "1px solid #ddd",
                fontSize: 14,
                background: saving ? "#f5f5f5" : "white",
              }}
            />
          </div>

          {/* 사업자등록번호 */}
          <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", alignItems: "start", gap: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 800, paddingTop: 10 }}>사업자등록번호</div>
            <div>
              <input
                type="text"
                inputMode="numeric"
                placeholder="예: 123-45-67890"
                value={taxIdDisplay} // ✅ 시각화: 하이픈 포함
                onChange={(e) => {
                  // ✅ 상태: 숫자만 저장 + 10자리 제한
                  const digits = onlyDigits(e.target.value);
                  if (digits.length <= 10) {
                    setForm({ ...form, tax_id: digits });
                  }
                }}
                disabled={saving}
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid #ddd",
                  fontSize: 14,
                  background: saving ? "#f5f5f5" : "white",
                }}
              />
              <p style={{ marginTop: 6, fontSize: 12, opacity: 0.65 }}>
                숫자 10자리만 저장되며, 화면에서는 하이픈으로 보기 좋게 표시됩니다.
              </p>
            </div>
          </div>

          {/* 이메일 */}
          <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", alignItems: "start", gap: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 800, paddingTop: 10 }}>이메일</div>
            <div>
              <input
                type="email"
                placeholder="세금계산서 발행 시 통지 받을 이메일"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                disabled={saving}
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid #ddd",
                  fontSize: 14,
                  background: saving ? "#f5f5f5" : "white",
                }}
              />
              <p style={{ marginTop: 6, fontSize: 12, opacity: 0.65 }}>
                📩 세금계산서 발행 시 해당 이메일로 발행 내역이 전송됩니다. 정확한 이메일을 입력해주세요.
              </p>
            </div>
          </div>

          {/* 대표자명 */}
          <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>대표자명</div>
            <input
              placeholder="예: 홍길동"
              value={form.rep_name}
              onChange={(e) => setForm({ ...form, rep_name: e.target.value })}
              disabled={saving}
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 12,
                border: "1px solid #ddd",
                fontSize: 14,
                background: saving ? "#f5f5f5" : "white",
              }}
            />
          </div>

          {/* 업태 */}
          <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>업태 (선택)</div>
            <input
              placeholder="예: 도소매"
              value={form.business_type}
              onChange={(e) => setForm({ ...form, business_type: e.target.value })}
              disabled={saving}
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 12,
                border: "1px solid #ddd",
                fontSize: 14,
                background: saving ? "#f5f5f5" : "white",
              }}
            />
          </div>

          {/* 종목 */}
          <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>종목 (선택)</div>
            <input
              placeholder="예: 화훼"
              value={form.business_item}
              onChange={(e) => setForm({ ...form, business_item: e.target.value })}
              disabled={saving}
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 12,
                border: "1px solid #ddd",
                fontSize: 14,
                background: saving ? "#f5f5f5" : "white",
              }}
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              marginTop: 4,
              padding: "14px 16px",
              borderRadius: 16,
              border: "1px solid #ddd",
              background: saving ? "#f2f2f2" : "white",
              fontWeight: 900,
              fontSize: 16,
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
