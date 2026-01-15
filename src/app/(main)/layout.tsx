// src/app/(main)/layout.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabaseClient";

function cn(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const isSettings = pathname?.startsWith('/settings')
  const isVendors = pathname?.startsWith('/vendors') || pathname === '/'
  const isReceipts = pathname?.startsWith('/receipts')

  const title =
    isSettings ? '마이페이지' :
    isReceipts ? '영수증 내역' :
    '영수증 신규 등록'


  // ✅ ESC로 닫기 + Drawer 열렸을 때 스크롤 잠금
  useEffect(() => {
    if (!isDrawerOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsDrawerOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [isDrawerOpen]);

  // ✅ 페이지 이동 시 Drawer 자동 닫기
  useEffect(() => {
    setIsDrawerOpen(false);
  }, [pathname]);


  // ✅ 로그아웃
  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      setIsDrawerOpen(false);
      router.replace("/login");
      router.refresh();
    } catch (e: any) {
      alert(e?.message ?? "로그아웃 중 오류가 발생했어요.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 컨테이너 */}
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-white shadow-sm relative">
        {/* 1) 헤더 */}
        <header className="sticky top-0 z-10 flex h-14 items-center justify-center border-b bg-white/90 backdrop-blur px-4">
          <span className="font-bold text-gray-800 tracking-tight text-lg">
            {title}
          </span>
        </header>

        {/* 2) 콘텐츠 */}
        <main className="flex-1 p-4 pb-24">{children}</main>

        {/* 3) Drawer (Overlay & Panel) */}
        {isDrawerOpen && (
          <>
            {/* Overlay (클릭 시 닫힘) */}
            <button
              className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
              aria-label="메뉴 닫기"
              onClick={() => setIsDrawerOpen(false)}
            />

            {/* Drawer Panel */}
            <aside
              className="
                fixed bottom-0 left-1/2 z-40 w-full max-w-md -translate-x-1/2
                flex flex-col bg-white rounded-t-2xl shadow-2xl
                pb-[env(safe-area-inset-bottom)]
                animate-in slide-in-from-bottom duration-300
              "
              role="dialog"
              aria-modal="true"
              aria-label="전체 메뉴"
            >
              {/* 손잡이 */}
              <div className="mx-auto my-3 h-1.5 w-12 rounded-full bg-gray-300" />

              <div className="px-6 py-4">
                <h2 className="mb-6 text-lg font-bold text-gray-900">전체 메뉴</h2>

                <nav className="space-y-2">
                  <Link
                    href="/vendors"
                    onClick={() => setIsDrawerOpen(false)}
                    className={cn(
                      "flex items-center gap-4 rounded-xl p-4 text-base font-medium transition-colors",
                      isVendors
                        ? "bg-blue-50 text-blue-600"
                        : "text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    <span className="text-xl" aria-hidden>
                      🏠
                    </span>
                    영수증 신규 등록
                  </Link>

                  <Link
                    href="/receipts"
                    onClick={() => setIsDrawerOpen(false)}
                    className={cn(
                      "flex items-center gap-4 rounded-xl p-4 text-base font-medium transition-colors",
                      isReceipts
                        ? "bg-blue-50 text-blue-600"
                        : "text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    <span className="text-xl" aria-hidden>
                      📄
                    </span>
                    영수증 내역
                  </Link>
                  <Link
                    href="/settings"
                    onClick={() => setIsDrawerOpen(false)}
                    className={cn(
                      "flex items-center gap-4 rounded-xl p-4 text-base font-medium transition-colors",
                      isSettings
                        ? "bg-blue-50 text-blue-600"
                        : "text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    <span className="text-xl" aria-hidden>
                      👤
                    </span>
                    마이페이지
                  </Link>

                </nav>

                <div className="my-6 border-t border-gray-100" />

                {/* 로그아웃 (하단 여백 mb-4 적용) */}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="mb-4 flex w-full items-center gap-4 rounded-xl p-4 text-base font-medium text-red-500 hover:bg-red-50"
                >
                  <span className="text-xl" aria-hidden>
                    🚪
                  </span>
                  <span>로그아웃</span>
                </button>
              </div>
            </aside>
          </>
        )}

        {/* 4) 하단 네비: 컨테이너 폭에 맞춰 중앙 고정 + safe-area */}
        <nav
          className="
            fixed bottom-0 left-1/2 z-20 w-full max-w-md -translate-x-1/2
            border-t bg-white
            pb-[env(safe-area-inset-bottom)]
          "
          aria-label="하단 내비게이션"
        >
          <div className="flex h-16 items-center justify-between px-4">
            {/* 메뉴 */}
            <button
              type="button"
              className={cn(
                "flex flex-col items-center",
                isDrawerOpen ? "text-blue-600" : "text-gray-500"
              )}
              aria-label={isDrawerOpen ? "메뉴 닫기" : "메뉴 열기"}
              onClick={() => setIsDrawerOpen((v) => !v)}
            >
              <span className="text-2xl" aria-hidden>
                ☰
              </span>
              <span className="text-[10px]">메뉴</span>
            </button>

            {/* 홈 */}
            <Link
              href="/vendors"
              className={cn(
                "flex flex-col items-center",
                isVendors && !isDrawerOpen ? "text-blue-600" : "text-gray-500"
              )}
              aria-current={isVendors ? "page" : undefined}
            >
              <span className="text-2xl" aria-hidden>
                🏠
              </span>
              <span className="text-[10px]">홈</span>
            </Link>

            {/* 내역 */}
            <Link
              href="/receipts"
              className={cn(
                "flex flex-col items-center",
                isReceipts && !isDrawerOpen ? "text-blue-600" : "text-gray-500"
              )}
              aria-current={isReceipts ? "page" : undefined}
            >
              <span className="text-2xl" aria-hidden>
                📄
              </span>
              <span className="text-[10px]">내역</span>
            </Link>
            {/* 마이 */}
            <Link
              href="/settings"
              className={cn(
                "flex flex-col items-center",
                isSettings && !isDrawerOpen ? "text-blue-600" : "text-gray-500"
              )}
              aria-current={isSettings ? "page" : undefined}
            >
              <span className="text-2xl" aria-hidden>
                👤
              </span>
              <span className="text-[10px]">마이</span>
            </Link>

          </div>
        </nav>
      </div>
    </div>
  );
}
