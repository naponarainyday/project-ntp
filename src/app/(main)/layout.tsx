// src/app/(main)/layout.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function cn(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isVendors = pathname?.startsWith("/vendors") || pathname === "/";
  const isReceipts = pathname?.startsWith("/receipts");

  const title = isReceipts ? "영수증 내역" : "내 상가";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 컨테이너 */}
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-white shadow-sm">
        {/* 1) 헤더 */}
        <header className="sticky top-0 z-10 flex h-14 items-center justify-center border-b bg-white/90 backdrop-blur px-4">
          <span className="font-bold text-gray-800 tracking-tight text-lg">
            {title}
          </span>
        </header>

        {/* 2) 콘텐츠 */}
        <main className="flex-1 p-4 pb-24">{children}</main>

        {/* 3) 하단 네비: 컨테이너 폭에 맞춰 중앙 고정 + safe-area */}
        <nav
          className="
            fixed bottom-0 left-1/2 z-20 w-full max-w-md -translate-x-1/2
            border-t bg-white
            pb-[env(safe-area-inset-bottom)]
          "
          aria-label="하단 내비게이션"
        >
          <div className="flex h-16 items-center justify-between px-6">
            {/* 메뉴 */}
            <button
              type="button"
              className="flex flex-col items-center text-gray-500"
              aria-label="메뉴 열기"
              onClick={() => {
                // TODO: Drawer open
              }}
            >
              <span className="text-2xl" aria-hidden>☰</span>
              <span className="text-[10px]">메뉴</span>
            </button>

            {/* 홈 */}
            <Link
              href="/vendors"
              className={cn(
                "flex flex-col items-center",
                isVendors ? "text-blue-600" : "text-gray-500"
              )}
              aria-current={isVendors ? "page" : undefined}
            >
              <span className="text-2xl" aria-hidden>🏠</span>
              <span className="text-[10px]">홈</span>
            </Link>

            {/* 내역 */}
            <Link
              href="/receipts"
              className={cn(
                "flex flex-col items-center",
                isReceipts ? "text-blue-600" : "text-gray-500"
              )}
              aria-current={isReceipts ? "page" : undefined}
            >
              <span className="text-2xl" aria-hidden>📄</span>
              <span className="text-[10px]">내역</span>
            </Link>
          </div>
        </nav>
      </div>
    </div>
  );
}
