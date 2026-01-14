import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* 상단 브랜딩 */}
      <header className="flex justify-center pt-16 pb-8">
        <Link href="/login" aria-label="NTP 로그인으로 이동">
          <span className="text-3xl font-black tracking-tighter text-primary">
            NTP
          </span>
        </Link>
      </header>

      {/* 폼 영역 */}
      <main className="flex-1 px-6 pb-12">
        {children}
      </main>
    </div>
  );
}
