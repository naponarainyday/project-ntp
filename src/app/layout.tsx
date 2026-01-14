import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "NTP | 쉬운 세금계산서 증빙 관리", template: "%s | NTP" },
  description: "시장 상인과 꽃집 사장님을 위한 간편 영수증 관리 서비스",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen antialiased bg-gray-50">
        {children}
      </body>
    </html>
  );
}
