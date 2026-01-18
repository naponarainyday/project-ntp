// src/middleware.ts
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // 1. 먼저 빈 응답(NextResponse.next)을 생성합니다.
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // 2. Supabase 클라이언트를 설정합니다.
  // 이 과정에서 쿠키를 set/remove할 때 응답 객체(response)에 자동으로 반영합니다.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return request.cookies.get(name)?.value;
        },
        set(name, value, options: CookieOptions) {
          // 서버 컴포넌트에서 읽을 수 있도록 요청 쿠키 업데이트
          request.cookies.set({ name, value, ...options });
          // 브라우저에 저장될 수 있도록 응답 쿠키 업데이트
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({ name, value, ...options });
        },
        remove(name, options: CookieOptions) {
          // 서버 컴포넌트에서 읽을 수 있도록 요청 쿠키 업데이트
          request.cookies.set({ name, value: "", ...options });
          // 브라우저에서 삭제되도록 응답 쿠키 업데이트
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  // 3. 사용자 정보를 가져옵니다. (getSession 대신 getUser 권장)
  // 이 호출이 일어날 때 세션이 만료되었다면 위에서 정의한 set 쿠키 로직이 자동으로 실행됩니다.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // 4. 경로 보호 로직
  const isAuthPage = pathname === "/login" || pathname === "/signup";
  const isCallback = pathname.startsWith("/callback");

  // 로그인하지 않은 사용자가 보호된 페이지에 접근할 경우
  if (!user && !isAuthPage && !isCallback) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // 이미 로그인한 사용자가 로그인/회원가입 페이지에 접근할 경우
  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // 최종적으로 쿠키가 설정된 response 객체를 반환합니다.
  return response;
}

export const config = {
  matcher: [
    /*
     * 아래 경로들을 제외한 모든 요청에 미들웨어 적용:
     * - _next/static (정적 파일)
     * - _next/image (이미지 최적화)
     * - favicon.ico (파비콘)
     * - .svg, .png, .jpg 등 이미지 파일
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};