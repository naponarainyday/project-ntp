// // src/middleware.ts
// import { createServerClient, type CookieOptions } from "@supabase/ssr";
// import { NextResponse, type NextRequest } from "next/server";

// export async function middleware(request: NextRequest) {
//   let response = NextResponse.next({
//     request: { headers: request.headers },
//   });

//   const supabase = createServerClient(
//     process.env.NEXT_PUBLIC_SUPABASE_URL!,
//     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
//     {
//       cookies: {
//         get(name) {
//           return request.cookies.get(name)?.value;
//         },
//         set(name, value, options: CookieOptions) {
//           request.cookies.set({ name, value, ...options });
//           response = NextResponse.next({ request: { headers: request.headers } });
//           response.cookies.set({ name, value, ...options });
//         },
//         remove(name, options: CookieOptions) {
//           request.cookies.set({ name, value: "", ...options });
//           response = NextResponse.next({ request: { headers: request.headers } });
//           response.cookies.set({ name, value: "", ...options });
//         },
//       },
//     }
//   );

//   const { data: { user } } = await supabase.auth.getUser();
//   const pathname = request.nextUrl.pathname;

//   const isPublic =
//     pathname === "/login" ||
//     pathname === "/signup" ||
//     pathname === "/callback" ||
//     pathname.startsWith("/callback/");

//   if (!user && !isPublic) {
//     const url = request.nextUrl.clone();
//     url.pathname = "/login";
//     url.searchParams.set("next", pathname);
//     return NextResponse.redirect(url);
//   }

//   if (user && (pathname === "/login" || pathname === "/signup")) {
//     const url = request.nextUrl.clone();
//     url.pathname = "/";
//     return NextResponse.redirect(url);
//   }

//   return response;
// }

// export const config = {
//   matcher: [
//     "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
//   ],
// };

// src/middleware.ts
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // 1️⃣ 초기 응답 객체 생성
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  // 2️⃣ Supabase 클라이언트 설정
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return request.cookies.get(name)?.value;
        },
        set(name, value, options: CookieOptions) {
          // 요청과 응답 양쪽에 쿠키를 동기화하여 
          // 미들웨어 이후의 서버 컴포넌트에서도 최신 세션을 읽을 수 있게 합니다.
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  // 3️⃣ 사용자 세션 확인 (보안을 위해 getUser 권장)
  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  // 4️⃣ 경로 분류 로직 정리
  const isAuthPage = pathname === "/login" || pathname === "/signup";
  const isCallback = pathname.startsWith("/callback"); // /callback, /callback/etc 모두 포함

  // 5️⃣ 리다이렉트 로직
  // 로그인 안 된 유저가 보호된 페이지에 접근할 때
  if (!user && !isAuthPage && !isCallback) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // 로그인 된 유저가 로그인/회원가입 페이지에 접근할 때
  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/"; // 대시보드 주소가 있다면 그곳으로 설정 가능
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * 아래 경로를 제외한 모든 요청에 미들웨어 적용:
     * - _next/static (정적 파일)
     * - _next/image (이미지 최적화)
     * - favicon.ico (파비콘)
     * - public 폴더 내의 정적 이미지들 (.svg, .png 등)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};