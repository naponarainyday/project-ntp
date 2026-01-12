"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");

  async function signIn() {
    setMsg("");
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: pw,
    });
    if (error) return setMsg(error.message);
    router.push("/vendors");
  }

  async function signInWithGoogle() {
    setMsg("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/vendors`,
      },
    });
    if (error) setMsg(error.message);
  }

  return (
    <div style={{ maxWidth: 420, margin: "0 auto", padding: 16 }}>
      <h1 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>로그인</h1>

      <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
        {/* 이메일 로그인 */}
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="이메일"
          style={{
            padding: 12,
            borderRadius: 12,
            border: "1px solid #ddd",
          }}
        />
        <input
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="비밀번호"
          type="password"
          style={{
            padding: 12,
            borderRadius: 12,
            border: "1px solid #ddd",
          }}
        />

        <button
          type="button"
          onClick={signIn}
          style={{
            padding: 12,
            borderRadius: 12,
            border: "1px solid #ddd",
            fontWeight: 800,
            background: "white",
          }}
        >
          이메일로 로그인
        </button>

        {/* 구분선 */}
        <div
          style={{
            textAlign: "center",
            fontSize: 12,
            opacity: 0.6,
            margin: "6px 0",
          }}
        >
          또는
        </div>

        {/* Google 로그인 */}
        <button
          type="button"
          onClick={signInWithGoogle}
          style={{
            padding: 12,
            borderRadius: 12,
            border: "1px solid #ddd",
            fontWeight: 800,
            background: "white",
          }}
        >
          Google로 계속
        </button>

        {/* 회원가입 링크 */}
        <Link
          href="/signup"
          style={{
            marginTop: 8,
            display: "block",
            textAlign: "center",
            fontSize: 14,
            textDecoration: "underline",
          }}
        >
          아직 계정이 없나요? 회원가입
        </Link>

        {msg && (
          <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
            {msg}
          </div>
        )}
      </div>
    </div>
  );
}
