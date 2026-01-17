"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");

  async function signUp() {
    setMsg("");
    const { data, error } = await supabase.auth.signUp({ email, password: pw });
    if (error) return setMsg(error.message);

    // Confirm email ON이면 session이 null일 수 있음 (정상)
    if (data.session) {
      router.replace("/");
    } else {
      setMsg("가입 완료!");
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "0 auto", padding: 16 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
        <Link href="/login" style={{ textDecoration: "underline", fontSize: 14 }}>
          ← 로그인
        </Link>
        <h1 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>회원가입</h1>
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="이메일"
          style={{ padding: 12, borderRadius: 12, border: "1px solid #ddd" }} />
        <input value={pw} onChange={(e) => setPw(e.target.value)} placeholder="비밀번호" type="password"
          style={{ padding: 12, borderRadius: 12, border: "1px solid #ddd" }} />

        <button onClick={signUp}
          style={{ padding: 12, borderRadius: 12, border: "1px solid #ddd", fontWeight: 800, background: "white" }}>
          가입하기
        </button>

        {msg && <div style={{ fontSize: 13, opacity: 0.85 }}>{msg}</div>}
      </div>
    </div>
  );
}
