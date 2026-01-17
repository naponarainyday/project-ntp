// // src/app/(auth)/callback/route.ts
// import { NextResponse } from "next/server";
// import { cookies } from "next/headers";
// import { createServerClient, type CookieOptions } from "@supabase/ssr";

// export async function GET(request: Request) {
//   const url = new URL(request.url);
//   const code = url.searchParams.get("code");
//   const next = url.searchParams.get("next") || "/";

//   // ✅ Next 버전에 따라 cookies()가 Promise일 수 있어서 await
//   const cookieStore = await cookies();

//   const supabase = createServerClient(
//     process.env.NEXT_PUBLIC_SUPABASE_URL!,
//     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
//     {
//       cookies: {
//         get(name: string) {
//           return cookieStore.get(name)?.value;
//         },
//         set(name: string, value: string, options: CookieOptions) {
//           cookieStore.set({ name, value, ...options });
//         },
//         remove(name: string, options: CookieOptions) {
//           cookieStore.set({ name, value: "", ...options });
//         },
//       },
//     }
//   );

//   if (code) {
//     await supabase.auth.exchangeCodeForSession(code);
//   }

//   return NextResponse.redirect(new URL(next, url.origin));
// }


// src/app/(auth)/callback/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/";

  // 1️⃣ 변경 포인트: cookies() 앞에 await를 추가합니다.
  // Next.js 15부터 cookies()는 Promise를 반환하므로 동기적으로 호출하면 에러가 발생합니다.
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          // 이제 cookieStore는 실제 쿠키 객체이므로 .get()을 바로 사용할 수 있습니다.
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // 서버 컴포넌트 환경 등에서 set이 호출될 경우 에러가 발생할 수 있으므로
            // 안전하게 처리하거나 무시하도록 구성할 수 있습니다.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch (error) {
            // 위와 동일하게 안전 장치 추가
          }
        },
      },
    }
  );

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      // 인증 실패 시 에러 처리 (로그인 페이지로 돌려보내는 등)
      return NextResponse.redirect(new URL('/login?error=auth_failed', url.origin));
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}