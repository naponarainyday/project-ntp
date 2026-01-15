'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type ProfileForm = {
  company_name: string
  tax_id: string // ✅ 상태/DB는 숫자만
  email: string
  rep_name: string
  business_type: string
  business_item: string
}

// ✅ 하이픈 추가 유틸 (시각화 전용)
const formatTaxId = (val: string) => {
  const s = val.replace(/\D/g, '')
  if (s.length <= 3) return s
  if (s.length <= 5) return `${s.slice(0, 3)}-${s.slice(3)}`
  return `${s.slice(0, 3)}-${s.slice(3, 5)}-${s.slice(5, 10)}`
}

// ✅ 숫자만 추출
const onlyDigits = (val: string) => val.replace(/\D/g, '')

// ✅ 간단 스켈레톤
function Skeleton() {
  return (
    <div className="p-6">
      <div className="max-w-xl space-y-4">
        <div className="h-7 w-40 rounded bg-gray-200" />
        <div className="h-4 w-64 rounded bg-gray-200" />
        <div className="h-10 w-full rounded bg-gray-200" />
        <div className="h-10 w-full rounded bg-gray-200" />
        <div className="h-10 w-full rounded bg-gray-200" />
        <div className="h-10 w-full rounded bg-gray-200" />
        <div className="h-10 w-full rounded bg-gray-200" />
        <div className="h-10 w-full rounded bg-gray-200" />
        <div className="h-10 w-full rounded bg-gray-200" />
      </div>
    </div>
  )
}

export default function ProfilePage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<ProfileForm>({
    company_name: '',
    tax_id: '',
    email: '',
    rep_name: '',
    business_type: '',
    business_item: '',
  })

  // ✅ 시각화 값(하이픈 포함)은 파생값으로
  const taxIdDisplay = useMemo(() => formatTaxId(form.tax_id), [form.tax_id])

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true)

      // 1) 세션 확인
      const { data, error } = await supabase.auth.getUser()
      const user = data?.user

      if (error || !user) {
        // ✅ 로그인 세션 없으면 로그인으로 이동
        router.replace('/login')
        return
      }

      // 2) 프로필 로딩 (신규 유저 406은 정상)
      const { data: profile, error: profileError, status } = await supabase
        .from('profiles')
        .select('company_name,tax_id,email,rep_name,business_type,business_item')
        .eq('id', user.id)
        .single()

      if (profileError && status !== 406) {
        console.error('프로필 로딩 에러:', profileError.message)
        // 그래도 화면은 보여주되, 빈 폼 유지
      }

      if (profile) {
        setForm({
          company_name: profile.company_name ?? '',
          tax_id: profile.tax_id ?? '',
          email: profile.email ?? '',
          rep_name: profile.rep_name ?? '',
          business_type: profile.business_type ?? '',
          business_item: profile.business_item ?? '',
        })
      }

      setLoading(false)
    }

    fetchProfile()
  }, [router])

  const validate = () => {
    if (!form.company_name.trim()) return '상호명을 입력해주세요.'
    if (!form.rep_name.trim()) return '대표자명을 입력해주세요.'
    if (!form.email.trim()) return '이메일을 입력해주세요.'
    if (form.tax_id.length !== 10) return '사업자등록번호는 10자리 숫자여야 합니다.'
    return null
  }

  const handleSave = async () => {
    const errMsg = validate()
    if (errMsg) {
      alert(errMsg)
      return
    }

    setSaving(true)
    try {
      const { data, error } = await supabase.auth.getUser()
      const user = data?.user

      if (error || !user) {
        alert('로그인이 필요합니다.')
        router.replace('/login')
        return
      }

      const { error: upsertError } = await supabase.from('profiles').upsert({
        id: user.id,
        company_name: form.company_name.trim(),
        tax_id: form.tax_id, // ✅ 숫자 10자리만 저장
        email: form.email.trim(),
        rep_name: form.rep_name.trim(),
        business_type: form.business_type?.trim() || null,
        business_item: form.business_item?.trim() || null,
      })

      if (upsertError) {
        alert(`저장 실패: ${upsertError.message}`)
        return
      }

      alert('저장되었습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Skeleton />

  return (
    <div className="p-6">
      <div className="max-w-xl space-y-5">
        <div>
          <h1 className="text-xl font-semibold">사업자 정보</h1>
          <p className="mt-1 text-sm text-gray-500">
            아래 정보는 세금계산서 발행에 사용됩니다.
          </p>
        </div>

        {/* 상호명 */}
        <div className="space-y-2">
          <label className="text-sm font-medium">상호명</label>
          <input
            className="w-full rounded-md border px-3 py-2"
            placeholder="예: NTP"
            value={form.company_name}
            onChange={(e) => setForm({ ...form, company_name: e.target.value })}
          />
        </div>

        {/* 사업자등록번호 */}
        <div className="space-y-2">
          <label className="text-sm font-medium">사업자등록번호</label>
          <input
            className="w-full rounded-md border px-3 py-2"
            type="text"
            inputMode="numeric"
            placeholder="예: 123-45-67890"
            value={taxIdDisplay} // ✅ 시각화: 하이픈 포함
            onChange={(e) => {
              // ✅ 상태: 숫자만 저장 + 10자리 제한
              const digits = onlyDigits(e.target.value)
              if (digits.length <= 10) {
                setForm({ ...form, tax_id: digits })
              }
            }}
          />
          <p className="text-xs text-gray-500">숫자 10자리만 저장되며, 화면에서는 하이픈으로 보기 좋게 표시됩니다.</p>
        </div>

        {/* 이메일 */}
        <div className="space-y-2">
          <label className="text-sm font-medium">이메일</label>
          <input
            className="w-full rounded-md border px-3 py-2"
            type="email"
            placeholder="세금계산서 발행 시 통지 받을 이메일"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <p className="text-xs text-gray-500">
            📩 세금계산서 발행 시 해당 이메일로 발행 내역이 전송됩니다. 정확한 이메일을 입력해주세요.
          </p>
        </div>

        {/* 대표자명 */}
        <div className="space-y-2">
          <label className="text-sm font-medium">대표자명</label>
          <input
            className="w-full rounded-md border px-3 py-2"
            placeholder="예: 홍길동"
            value={form.rep_name}
            onChange={(e) => setForm({ ...form, rep_name: e.target.value })}
          />
        </div>

        {/* 업태 */}
        <div className="space-y-2">
          <label className="text-sm font-medium">업태 (선택)</label>
          <input
            className="w-full rounded-md border px-3 py-2"
            placeholder="예: 도소매"
            value={form.business_type}
            onChange={(e) => setForm({ ...form, business_type: e.target.value })}
          />
        </div>

        {/* 종목 */}
        <div className="space-y-2">
          <label className="text-sm font-medium">종목 (선택)</label>
          <input
            className="w-full rounded-md border px-3 py-2"
            placeholder="예: 화훼"
            value={form.business_item}
            onChange={(e) => setForm({ ...form, business_item: e.target.value })}
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-md bg-black px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  )
}
