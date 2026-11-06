import { useEffect, useState } from 'react'
import { api, type Team } from '../../api/client.ts'

export type TeamState = { status: 'loading' } | { status: 'ready'; team: Team } | { status: 'not-found' } | { status: 'error' }

/** Loads a team the user belongs to. Another team is "not-found", the same as a missing one (AC-000-01). */
export function useTeam(teamId: string): TeamState {
  const [state, setState] = useState<TeamState>({ status: 'loading' })

  useEffect(() => {
    let active = true
    void api.GET('/api/teams/{team}', { params: { path: { team: teamId } } }).then(({ data, response }) => {
      if (!active) return
      if (data !== undefined) setState({ status: 'ready', team: data })
      else setState({ status: response.status === 404 ? 'not-found' : 'error' })
    })
    return () => {
      active = false
    }
  }, [teamId])

  return state
}
