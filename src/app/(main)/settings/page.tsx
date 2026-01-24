"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setMsg("");

      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;

        const user = data?.user;
        if (!user) {
          router.replace("/login");
          return;
        }

        setEmail(user.email ?? "");
      } catch (e: any) {
        console.log("SETTINGS LOAD ERROR:", e);
        setMsg(e?.message ?? "불러오기 실패");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const handleLogout = async () => {
    setMsg("");
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.replace("/login");
    } catch (e: any) {
      setMsg(e?.message ?? "로그아웃 실패");
    }
  };

  const cardStyle: React.CSSProperties = {
    border: "1px solid #ddd",
    borderRadius: 14,
    padding: 12,
    background: "white",
  };

  return (
    <div style={{ margin: "0 auto" }}>
      <div style={{ marginTop: 0 }}>
        <div style={{ fontSize: 15, marginBottom: 14 }}>
          계정과 세금계산서 발행에 필요한 정보를 관리합니다.
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 16, fontSize: 14, opacity: 0.8, fontWeight: 800 }}>불러오는 중...</div>
      ) : null}

      {msg ? (
        <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9, whiteSpace: "pre-wrap" }}>{msg}</div>
      ) : null}

      {!loading ? (
        <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
          {/* 계정 요약 */}
          <div style={cardStyle}>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>로그인 계정</div>
            <div style={{ fontSize: 15, fontWeight: 800 }}>{email || "-"}</div>
          </div>

          {/* 메뉴 리스트 */}
          <div style={{ display: "grid", gap: 10 }}>
            <Link
              href="/settings/profile"
              style={{
                ...cardStyle,
                textDecoration: "none",
                color: "inherit",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>내 정보</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    상호명, 사업자번호, 이메일 등 세금계산서 발행 정보
                  </div>
                </div>
                <div style={{ fontSize: 16, opacity: 0.5, marginLeft: 12 }}>→</div>
              </div>
            </Link>

            {/* 준비 중 메뉴들 */}
            {[
              { title: "이메일 인증", desc: "세금계산서 수신 이메일 인증" },
              { title: "사업자 정보 유효성 확인", desc: "사업자등록번호/대표자명 검증" },
              { title: "공동인증서", desc: "공동인증서 인증 및 연결" },
            ].map((item) => (
              <div
                key={item.title}
                style={{
                  ...cardStyle,
                  background: "#f9f9f9",
                  opacity: 0.6,
                  cursor: "not-allowed",
                }}
                title="준비 중인 기능입니다"
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>{item.title}</div>
                  <span
                    style={{
                      fontSize: 10,
                      background: "#e5e5e5",
                      padding: "2px 6px",
                      borderRadius: 6,
                      fontWeight: 700,
                    }}
                  >
                    준비 중
                  </span>
                </div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>{item.desc}</div>
              </div>
            ))}
          </div>

          {/* 로그아웃 */}
          <button
            onClick={handleLogout}
            style={{
              width: "100%",
              marginTop: 4,
              padding: "12px 16px",
              borderRadius: 12,
              border: "1px solid #ddd",
              background: "white",
              fontSize: 14,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            로그아웃
          </button>
        </div>
      ) : null}
    </div>
  );
}
