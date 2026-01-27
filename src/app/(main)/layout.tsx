// src/app/(main)/layout.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Menu, FileText, Store, User, LogOut } from "lucide-react";
import { HeaderActionContext } from "@/components/HeaderActionContext";

function cn(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  
  const [headerActions, setHeaderActions] = useState<React.ReactNode>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  const isHome = pathname === "/";
  const isSettings = pathname?.startsWith("/settings");
  const isVendors = pathname?.startsWith("/vendors");
  const isReceipts = pathname?.startsWith("/receipts");

  // ✅ 타이틀을 경로별로 좀 더 정확히
  const title = useMemo(() => {
    if (isReceipts) return "영수증 내역";
    if (isVendors) return "상가별 영수증 현황";
    if (isSettings) return "마이페이지";

    // vendors 영역
    if (pathname === "/vendors") return "전체 상가 리스트";
    if (pathname?.startsWith("/vendors/") && pathname?.includes("/receipts/new")) return "영수증 업로드";
    if (pathname?.startsWith("/vendors/all")) return "상가 상세";
    if (pathname?.startsWith("/receipts/new")) return "영수증 업로드";

    // fallback
    return "NTP";
  }, [isSettings, isReceipts, isHome, pathname]);

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
    <HeaderActionContext.Provider value={{ setAction: setHeaderActions }}>
      <div className="min-h-screen bg-gray-50">
        {/* 컨테이너 */}
        <div className="mx-auto flex min-h-screen max-w-md flex-col bg-white shadow-sm relative">
        {/* 1) 헤더 */}
        <header className="sticky top-0 z-10 bg-slate-700">
          <div className="flex h-12 items-center justify-between px-6">
            {/* 왼쪽: 타이틀 */}
            <span className="font-bold tracking-tight text-lg text-white">
              {title}
            </span>

            {/* 오른쪽: 액션 아이콘 자리(최대 2~3개) */}
            <div className="flex items-center gap-2 text-slate-200">
              {headerActions}
            </div>
          </div>
        </header>

        {/* 2) 콘텐츠 */}
        <main className="flex-1 px-3 pt-3 pb-24">{children}</main>

        {/* 3) Drawer (Overlay & Panel) */}
        {isDrawerOpen && (
          <>
            <button
              className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
              aria-label="메뉴 닫기"
              onClick={() => setIsDrawerOpen(false)}
            />

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
              <div className="mx-auto my-3 h-1.5 w-12 rounded-full bg-gray-300" />

              <div className="px-6 py-4">
                <h2 className="mb-6 text-lg font-bold text-gray-900">전체 메뉴</h2>

                <nav className="space-y-2">
                  <Link
                    href="/receipts"
                    onClick={() => setIsDrawerOpen(false)}
                    className={cn(
                      "flex items-center gap-4 rounded-xl p-4 text-base font-medium transition-colors",
                      isReceipts ? "bg-blue-100 text-blue-700" : "text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    <FileText size={20} />
                    영수증 내역
                  </Link>

                  <Link
                    href="/vendors"
                    onClick={() => setIsDrawerOpen(false)}
                    className={cn(
                      "flex items-center gap-4 rounded-xl p-4 text-base font-medium transition-colors",
                      isVendors ? "bg-blue-100 text-blue-700" : "text-gray-700 hover:bg-gray-100"
                    )}
                  >
                  <Store size={20} />
                    상가별 영수증 현황
                  </Link>

                  <Link
                    href="/settings"
                    onClick={() => setIsDrawerOpen(false)}
                    className={cn(
                      "flex items-center gap-4 rounded-xl p-4 text-base font-medium transition-colors",
                      isSettings ? "bg-blue-100 text-blue-700" : "text-gray-700 hover:bg-gray-100"
                    )}
                  >
                  <User size={20} />
                    마이페이지
                  </Link>
                </nav>

                <div className="my-6 border-t border-gray-100" />

                <button
                  type="button"
                  onClick={handleLogout}
                  className="mb-4 flex w-full items-center gap-4 rounded-xl p-4 text-base font-medium text-red-700 hover:bg-red-100"
                >
                <LogOut size={20} />
                  <span>로그아웃</span>
                </button>
              </div>
            </aside>
          </>
        )}

        {/* 4) 하단 네비 */}
        <nav
          className="
            fixed bottom-0 left-1/2 z-20 w-full max-w-md -translate-x-1/2
            border-t bg-white
            pb-[env(safe-area-inset-bottom)]
          "
          aria-label="하단 내비게이션"
        >
          <div className="flex h-16 items-center justify-between pl-4 pr-6">
            {/* 메뉴 */}
            <button
              type="button"
              className={cn(
                "flex flex-col items-center",
                isDrawerOpen ? "text-blue-600" : "text-slate-400"
              )}
              aria-label={isDrawerOpen ? "메뉴 닫기" : "메뉴 열기"}
              onClick={() => setIsDrawerOpen((v) => !v)}
            >
              <Menu size={30} />
            </button>

            {/* ✅ 내역 */}
            <Link
              href="/receipts"
              className={cn(
                "flex flex-col items-center",
                isReceipts && !isDrawerOpen ? "text-slate-800" : "text-slate-400"
              )}
            >
              <FileText size={30} />
            </Link>


            {/* ✅ 상가별 영수증 현황 */}
            <Link
            href="/vendors"
            className={cn(
              "flex flex-col items-center",
              isVendors && !isDrawerOpen ? "text-slate-800" : "text-slate-400"
            )}
          >
            <Store size={30} />
          </Link>


            {/* ✅ 마이 */}
            <Link
              href="/settings"
              className={cn(
                "flex flex-col items-center",
                isSettings && !isDrawerOpen ? "text-slate-800" : "text-slate-400"
              )}
            >
              <User size={30} />
              {/* <span className="text-[10px]">마이</span> */}
            </Link>
          </div>
        </nav>
      </div>
    </div>
    </HeaderActionContext.Provider>
  );
}
