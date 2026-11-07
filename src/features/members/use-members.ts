import { useCallback, useEffect, useState } from 'react'
import { api, errorMessage, type Member } from '../../api/client.ts'

function fetchMembers(teamId: string) {
  return api.GET('/api/teams/{team}/members', { params: { path: { team: teamId } } })
}

/** メンバー一覧を読み込む。reload で読み直す */
export function useMembers(teamId: string) {
  const [members, setMembers] = useState<Member[] | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  const apply = useCallback((result: Awaited<ReturnType<typeof fetchMembers>>) => {
    if (result.data !== undefined) {
      setMembers(result.data.members)
      setFailure(null)
    } else setFailure(errorMessage(result.error))
  }, [])

  useEffect(() => {
    let active = true
    void fetchMembers(teamId).then((result) => {
      if (active) apply(result)
    })
    return () => {
      active = false
    }
  }, [teamId, apply])

  const reload = useCallback(async () => apply(await fetchMembers(teamId)), [teamId, apply])

  return { members, failure, reload }
}

/** この相手を除名できるか(画面の表示用)。最終的な判定は API(TeamPolicy、AC-004-07) */
export function canRemove(viewerIsRepresentative: boolean, member: Member): boolean {
  if (member.is_me) return false
  if (viewerIsRepresentative) return true
  return !member.roles.includes('representative') && !member.roles.includes('officer')
}
