'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

function Skeleton() {
  return (
    <div className="p-6">
      <div className="max-w-xl space-y-4">
        <div className="h-7 w-40 rounded bg-gray-200" />
        <div className="h-4 w-64 rounded bg-gray-200" />
        <div className="h-20 w-full rounded bg-gray-200" />
        <div className="h-20 w-full rounded bg-gray-200" />
        <div className="h-20 w-full rounded bg-gray-200" />
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState<string>('')

  useEffect(() => {
    const init = async () => {
      setLoading(true)

      const { data, error } = await supabase.auth.getUser()
      const user = data?.user

      if (error || !user) {
        router.replace('/login')
        return
      }

      setEmail(user.email ?? '')
      setLoading(false)
    }

    init()
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (loading) return <Skeleton />

  return (
    <div className="p-6">
      <div className="max-w-xl space-y-6">
        <div>
          <h1 className="text-xl font-semibold">마이페이지</h1>
          <p className="mt-1 text-sm text-gray-500">
            계정과 세금계산서 발행에 필요한 정보를 관리합니다.
          </p>
        </div>

        {/* 계정 요약 */}
        <div className="rounded-lg border p-4">
          <div className="text-sm text-gray-500">로그인 계정</div>
          <div className="mt-1 font-medium">{email || '-'}</div>
        </div>

        {/* 메뉴 리스트 */}
        <div className="space-y-3">
          <Link
            href="/settings/profile"
            className="group flex items-center justify-between rounded-lg border p-4 hover:bg-gray-50 transition-colors"
          >
            <div>
              <div className="font-medium group-hover:text-blue-600 transition-colors">
                내 정보
              </div>
              <div className="mt-1 text-sm text-gray-500">
                상호명, 사업자번호, 이메일 등 세금계산서 발행 정보
              </div>
            </div>
            <div className="text-gray-400">→</div>
          </Link>

          {/* 준비 중 메뉴들 */}
          {[
            { title: '이메일 인증', desc: '세금계산서 수신 이메일 인증' },
            { title: '사업자 정보 유효성 확인', desc: '사업자등록번호/대표자명 검증' },
            { title: '공동인증서', desc: '공동인증서 인증 및 연결' },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-lg border bg-gray-50/50 p-4 cursor-not-allowed opacity-60"
              title="준비 중인 기능입니다"
            >
              <div className="flex items-center gap-2">
                <div className="font-medium text-gray-900">{item.title}</div>
                <span className="text-[10px] bg-gray-200 px-1.5 py-0.5 rounded text-gray-600">
                  준비 중
                </span>
              </div>
              <div className="mt-1 text-sm text-gray-500">{item.desc}</div>
            </div>
          ))}
        </div>

        {/* 로그아웃 */}
        <button
          onClick={handleLogout}
          className="w-full rounded-md border px-4 py-2 font-medium hover:bg-gray-50"
        >
          로그아웃
        </button>
      </div>
    </div>
  )
}
