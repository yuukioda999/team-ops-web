import { useEffect, useState } from 'react'
import { api, type TeamRole } from '../../api/client.ts'

/** デモでログインできる役割と、画面での呼び名(AC-007-01) */
export const DEMO_ROLES: { role: TeamRole; label: string; note: string }[] = [
  { role: 'representative', label: '代表', note: 'すべての操作ができます' },
  { role: 'officer', label: '役員', note: '名簿の管理や、お知らせの送信ができます' },
  { role: 'coach', label: 'コーチ', note: 'お知らせを送れます。名簿は見るだけです' },
  { role: 'parent', label: '保護者', note: 'お知らせを読み、自分の子どもの情報を見ます' },
]

let demoMode: Promise<boolean> | null = null

/**
 * API がデモモードで動いているか(AC-007-01・17)。デモモードでなければ GET /api/demo は 404。
 * 起動している間は変わらないので、1回だけ問い合わせる。
 */
export function loadDemoMode(): Promise<boolean> {
  demoMode ??= api
    .GET('/api/demo')
    .then(({ data }) => data?.enabled === true)
    .catch(() => {
      demoMode = null
      return false
    })
  return demoMode
}

/** テストのために、覚えた答えを消す */
export function forgetDemoMode(): void {
  demoMode = null
}

/** デモモードか。分かるまでは null */
export function useDemoMode(): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  useEffect(() => {
    let active = true
    void loadDemoMode().then((on) => {
      if (active) setEnabled(on)
    })
    return () => {
      active = false
    }
  }, [])
  return enabled
}
