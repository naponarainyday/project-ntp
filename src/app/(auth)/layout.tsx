import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* 상단 브랜딩 영역 */}
      <header className="flex flex-col items-center pt-20 pb-10 px-6 text-center">
        <Link href="/login" className="group">
          <div className="flex flex-col items-center">
            {/* 메인 로고 */}
            <span className="text-6xl font-black tracking-tighter text-black">
              NTP
            </span>
            {/* 영문 풀네임 (약간 연하게) */}
            <span className="mt-1 text-[20px] font-bold tracking-widest text-gray-400">
              No "Tax invoice, Please"
            </span>
          </div>
        </Link>
        
        {/* 한글 슬로건: 사장님의 공감을 이끌어내는 문구 */}
        {/* <div className="mt-6 space-y-1">
          <p className="text-lg font-bold text-gray-800">
            "사장님, 세금계산서 발행 부탁드려요"
          </p>
          <p className="text-sm font-medium text-blue-600">
            이제 번거로운 말 대신, NTP로 한 번에 끝내세요.
          </p>
        </div> */}
      </header>

      {/* 폼 영역 */}
      <main className="flex-1 px-6 pb-12 w-full max-w-md mx-auto">
        {children}
      </main>
    </div>
  );
}