# Codex 작업 지침 (NTP)

## 1) 문서 목적
- 이 문서는 `AI coding agent`가 NTP 저장소를 빠르게 이해하고, 안전하게 변경하기 위한 내부 작업 가이드다.
- 제품 설명 중심 내용은 `project.md`를 기준으로 보고, 여기서는 구현/유지보수 규칙을 우선한다.

## 2) 작업 시작 체크리스트
- `git status --short`로 기존 변경사항 존재 여부 먼저 확인
- `src/app/(main)/receipts/new/ReceiptsNewClient.tsx`와 `src/app/(main)/vendors/[vendorId]/receipts/new/page.tsx` 중 어떤 경로를 수정해야 하는지 먼저 결정
- DB 스키마 변경이 포함되면 SQL 문서(`prod_schema.sql` 또는 별도 migration) 동기화 계획을 같이 작성

## 3) 핵심 구현 규칙
- 상태/유형 enum(`ReceiptStatus`, `PaymentMethod`, `TaxType`, `ReceiptType`)은 여러 페이지에서 중복 선언되어 있으므로 변경 시 전역 검색으로 동시 반영
- 이미지 업로드 로직 수정 시 다음 3개를 항상 세트로 확인
- `webp` 변환 (`heic2any` 포함)
- `supabase.storage.from("receipts").upload(...)`
- 실패 rollback (`remove(...)`) 경로
- 리스트에서 이미지 로딩은 signed URL 캐시(`imgUrlsById`, `signingIdsRef`) 패턴을 유지해서 중복 호출/무한 로딩을 방지
- 일괄 상태 변경은 `selectedIds` + `uniformSelectedStatus` 검증 로직을 유지

## 4) DB/Schema 관련 주의
- 코드 기준으로 `profiles`, `receipt_images`, `tax_type`, `vat_amount`, `total_amount`가 실제 사용된다.
- 현재 `prod_schema.sql`과 코드 모델이 불일치할 수 있으니, DB 관련 변경 시 코드/SQL 둘 중 하나만 갱신하지 않도록 주의
- `RLS` 정책 변경 시 `middleware` 인증 흐름과 함께 검증

## 5) 라우트별 수정 포인트
- 인증: `src/app/(auth)/*`, `src/app/(auth)/callback/route.ts`, `src/middleware.ts`
- 영수증 목록: `src/app/(main)/receipts/page.tsx`
- 영수증 등록/수정 통합: `src/app/(main)/receipts/new/ReceiptsNewClient.tsx`
- 상가 상세/내보내기: `src/app/(main)/vendors/[vendorId]/page.tsx`, `src/app/(main)/vendors/[vendorId]/export/page.tsx`
- 사업자 정보: `src/app/(main)/settings/profile/page.tsx`

## 6) 우선 정리 권장 항목 (Tech Debt)
- `types/constants` 공통화
- 현재 enum/type이 페이지별 중복 선언됨
- 등록 화면 단일화
- `receipts/new`와 `vendors/[vendorId]/receipts/new`의 중복 로직이 커서 장기적으로 유지비가 큼
- schema 문서 정합성 복구
- 코드에서 쓰는 컬럼/테이블 기준으로 SQL 문서 재생성 필요
- `README.md` 실사용 문서화
- 실행 방법 외에 도메인 모델, 환경변수, 배포 절차 추가 필요

## 7) 변경 후 검증 루틴
- 최소 검증
- `npm run lint`
- 주요 경로 수동 점검
- `/login` -> `/receipts`
- `/receipts/new` 등록/수정
- `/vendors/[vendorId]` 필터/선택/상태변경
- `/vendors/[vendorId]/export` 복사/ZIP
- DB 반영이 필요한 변경이면 `Supabase` 정책/권한 오류(`401`, `403`) 로그까지 확인

## 8) 커밋 가이드
- 기능 단위로 커밋 분리
- UI 변경과 DB 변경은 가능한 분리 커밋
- 커밋 메시지는 `feat:`, `fix:`, `refactor:`, `docs:` prefix 유지 권장
