// src/app/(main)/receipts/new/page.tsx
import { Suspense } from "react";
import ReceiptsNewClient from "./ReceiptsNewClient";

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 16, fontWeight: 800 }}>불러오는 중...</div>}>
      <ReceiptsNewClient />
    </Suspense>
  );
}