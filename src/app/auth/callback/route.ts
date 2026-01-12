import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // supabase-js가 브라우저에서 자동 처리(PKCE 등)하는 케이스가 많아서,
  // MVP에선 콜백 도착 후 vendors로 보내는 것만 해도 충분.
  const url = new URL(request.url);
  const next = url.searchParams.get("next") ?? "/vendors";
  return NextResponse.redirect(new URL(next, url.origin));
}
