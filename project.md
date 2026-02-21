# NTP 프로젝트 개요

## 1) 프로젝트 목적
- `NTP (No "Tax invoice, Please")`는 상가별 영수증을 수집하고, 계산서 발행 요청 흐름을 관리하는 웹 앱이다.
- 핵심 사용자 시나리오는 다음 3가지다.
- `영수증 등록/수정`: 사진 업로드 + 금액/지급/과세 정보 입력
- `상태 관리`: `uploaded` -> `requested` -> `completed` 또는 `needs_fix`
- `내보내기`: 선택한 영수증 기반 요청 문구 생성 + 사진 ZIP 다운로드

## 2) 기술 스택
- Frontend: `Next.js (App Router)`, `React`, `TypeScript`
- Styling: `Tailwind CSS v4` + inline style 혼용
- Backend: `Supabase` (`Auth`, `Postgres`, `Storage`, `RLS`)
- 기타 라이브러리:
- `@supabase/ssr`, `@supabase/supabase-js`
- `heic2any` (HEIC/HEIF 변환)
- `jszip` (ZIP 다운로드)
- `lucide-react` (아이콘)

## 3) 실행/빌드 명령
- `npm run dev`: 개발 서버
- `npm run build`: 프로덕션 빌드
- `npm run start`: 프로덕션 실행
- `npm run lint`: ESLint

## 4) 주요 디렉터리 구조
- `src/app/(auth)`: 로그인/회원가입/OAuth callback
- `src/app/(main)`: 실제 앱 화면
- `src/app/(main)/receipts`: 영수증 목록/상세/등록/수정
- `src/app/(main)/vendors`: 상가 목록/상세/등록/내보내기
- `src/app/(main)/settings`: 계정/사업자 정보
- `src/components`: 공통 UI (`ReceiptLightbox`, `ErrorPopup`, `HeaderActionContext`)
- `src/lib/supabaseClient.ts`: Browser Supabase client
- `src/middleware.ts`: 인증 기반 route 보호
- `supabase/config.toml`: 로컬 Supabase 설정
- `data.sql`, `prod_schema.sql`, `prod_data.sql`: DB 관련 SQL 파일

## 5) 라우트 기능 요약
- `/login`, `/signup`, `/callback`
- Email/Password + Google OAuth 로그인
- `/` -> `/receipts` redirect
- `/receipts`
- 영수증 리스트, 검색, 기간/상태/지급/과세 필터
- 다중 선택 후 상태 일괄 변경
- row 확장 시 `receipt_images` signed URL 조회 + `ReceiptLightbox` 미리보기
- `/receipts/new`
- 단일 등록/수정 화면 (`edit` query 시 수정 모드)
- 상가 검색 선택 + 사진 업로드 + 금액/VAT/상태 입력
- `/receipts/[receiptId]`
- 영수증 상세 조회, 이미지 보기, 수정 화면으로 이동
- `/vendors`
- 상태별 상가 섹션 집계 뷰 (건수/금액 기반)
- `/vendors/all`
- 전체 상가 검색 + 시장 그룹 접기/펼치기
- `/vendors/[vendorId]`
- 특정 상가 영수증 리스트, 필터/선택/일괄 상태 변경
- 선택한 항목을 `vendor_export_payload`로 저장 후 export 화면 이동
- `/vendors/[vendorId]/receipts/new`
- 상가 고정 상태의 등록 화면 (기존 경로 유지)
- `/vendors/[vendorId]/export`
- 선택 영수증 기반 텍스트 자동 조합 + Clipboard 복사 + 사진 ZIP 다운로드
- `/settings`, `/settings/profile`
- 계정 확인, 로그아웃, `profiles` 정보 조회/저장

## 6) 데이터 모델(코드 기준)
- 주요 테이블/뷰
- `markets`
- `vendors`
- `receipts`
- `receipt_images` (코드에서 사용)
- `profiles` (코드에서 사용)
- `v_vendor_list_page2` (상가 목록/상태 요약용 view)
- 핵심 enum
- `ReceiptStatus`: `uploaded`, `requested`, `needs_fix`, `completed`
- `PaymentMethod`: `cash`, `transfer`, `payable`
- `TaxType`: `tax_free`, `tax`, `zero_rate`
- `ReceiptType`: `standard`, `simple`
- Storage
- bucket: `receipts`
- 파일 경로 패턴: `userId/vendorId/timestamp_index.webp` 계열

## 7) 인증/권한 구조
- `middleware.ts`에서 비인증 사용자를 `/login`으로 redirect
- 인증 완료 사용자가 `/login`, `/signup` 접근 시 `/`로 redirect
- Supabase RLS(`prod_schema.sql` 기준)
- `receipts`: 본인(`auth.uid`) 데이터만 `select/insert/update/delete`
- `vendors`, `markets`: 인증 사용자 조회 허용 정책 존재

## 8) 이미지 처리 흐름
- 업로드 시 HEIC/HEIF 포함 이미지를 `webp`로 변환 후 업로드
- 리스트/상세/내보내기에서 `createSignedUrl`로 접근 URL 생성
- 등록/수정 실패 시 업로드 파일 rollback 로직 일부 구현

## 9) Git 이력 요약 (최근)
- 현재 브랜치: `feature/ui-fix-1`
- 최근 커밋 흐름
- `영수증 내보내기`, `영수증 사진 내보내기` 기능 추가
- `tax_type`, `vat_amount`, `total_amount` 관련 기능 확장
- `receipts/new` 개편, 상세 페이지(`[receiptId]`) 추가
- `vendors`/`receipts` UI 개편, 필터/이미지 미리보기/업로드 개선
- `profiles` 기반 마이페이지 추가
- `middleware` 기반 인증 리다이렉트 적용

## 10) 현재 상태와 주의사항
- 워킹 트리에 기존 변경사항이 이미 존재한다.
- `prod_schema.sql`은 코드에서 사용하는 일부 객체(`profiles`, `receipt_images`, `tax_type` 등)와 불일치할 수 있다.
- `README.md`는 기본 `create-next-app` 템플릿 상태라 실제 운영 문서와 차이가 있다.
- 자동화 테스트 코드(`test`, `spec`)는 현재 저장소 기준으로 확인되지 않는다.
