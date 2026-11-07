import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { AuditLogEntry, Member } from '../../api/client.ts'
import { permissions, renderAt, signedIn, team } from '../../test/render.tsx'

const U10 = team()
const officerTeam = team({ roles: ['officer'], permissions: permissions({ manage_invitation: true, review_join_requests: true, manage_players: true, view_players: true, view_all_players: true, view_members: true, remove_members: true }) })
const parentTeam = team({ roles: ['parent'], permissions: permissions({ view_players: true }) })
const BASE = `/api/teams/${U10.id}`

const rep: Member = { membership_id: 1, display_name: '代表 太郎', roles: ['representative'], is_me: true }
const officer: Member = { membership_id: 2, display_name: '佐藤 役員', roles: ['officer', 'parent'], is_me: false }
const parent: Member = { membership_id: 3, display_name: '山田 花子', roles: ['parent'], is_me: false }
const list = (members: Member[]) => ({ status: 200, body: { members } })

describe('チームのホームの導線', () => {
  it('AC-004-01 the representative sees members, team settings and the audit log', async () => {
    renderAt(`/teams/${U10.id}`, { 'GET /api/me': signedIn({ teams: [U10] }), [`GET ${BASE}`]: { status: 200, body: U10 } })

    expect(await screen.findByRole('link', { name: 'メンバー一覧' })).toHaveAttribute('href', `/teams/${U10.id}/members`)
    expect(screen.getByRole('link', { name: 'チーム名・競技を変える' })).toHaveAttribute('href', `/teams/${U10.id}/settings`)
    expect(screen.getByRole('link', { name: '監査ログを見る' })).toHaveAttribute('href', `/teams/${U10.id}/audit-logs`)
  })

  it('AC-004-01 a parent sees none of them', async () => {
    renderAt(`/teams/${U10.id}`, { 'GET /api/me': signedIn({ teams: [parentTeam] }), [`GET ${BASE}`]: { status: 200, body: parentTeam } })

    await screen.findByRole('link', { name: 'お子さんの情報を見る' })
    expect(screen.queryByRole('link', { name: 'メンバー一覧' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '監査ログを見る' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'チームの管理' })).not.toBeInTheDocument()
  })
})

describe('メンバー一覧', () => {
  it('shows each member with their roles and marks yourself', async () => {
    renderAt(`/teams/${U10.id}/members`, {
      'GET /api/me': signedIn({ teams: [U10] }),
      [`GET ${BASE}`]: { status: 200, body: U10 },
      [`GET ${BASE}/members`]: list([rep, officer, parent]),
    })

    const items = within(await screen.findByRole('list', { name: 'メンバー' })).getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveTextContent('代表 太郎あなた代表')
    expect(within(items[1]).getByRole('link')).toHaveAttribute('href', `/teams/${U10.id}/members/2`)
    expect(items[1]).toHaveTextContent('役員・保護者')
    expect(screen.getByText('3人')).toBeInTheDocument()
  })

  it('AC-004-01 a coach cannot open the member list', async () => {
    const coachTeam = team({ roles: ['coach'], permissions: permissions({ view_players: true, view_all_players: true }) })
    renderAt(`/teams/${U10.id}/members`, { 'GET /api/me': signedIn({ teams: [coachTeam] }), [`GET ${BASE}`]: { status: 200, body: coachTeam } })

    expect(await screen.findByRole('heading', { name: 'この画面を開く権限がありません' })).toBeInTheDocument()
  })
})

describe('役割の変更・代表の交代・除名', () => {
  it('AC-004-03 the representative changes roles and the member is told by email', async () => {
    const { calls } = renderAt(`/teams/${U10.id}/members/3`, {
      'GET /api/me': signedIn({ teams: [U10] }),
      [`GET ${BASE}`]: { status: 200, body: U10 },
      [`GET ${BASE}/members`]: list([rep, officer, parent]),
      [`PUT ${BASE}/members/3/roles`]: { status: 200, body: { member: { ...parent, roles: ['coach', 'parent'] } } },
    })

    expect(await screen.findByRole('checkbox', { name: '保護者' })).toBeChecked()
    await userEvent.click(screen.getByRole('checkbox', { name: 'コーチ' }))
    await userEvent.click(screen.getByRole('button', { name: '役割を保存する' }))

    expect(await screen.findByText('役割を「コーチ・保護者」にしました。本人にメールで知らせました。')).toBeInTheDocument()
    expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ roles: ['coach', 'parent'] })
  })

  it('AC-004-03 removing the parent role warns that player links are removed too', async () => {
    renderAt(`/teams/${U10.id}/members/2`, {
      'GET /api/me': signedIn({ teams: [U10] }),
      [`GET ${BASE}`]: { status: 200, body: U10 },
      [`GET ${BASE}/members`]: list([rep, officer, parent]),
    })

    await userEvent.click(await screen.findByRole('checkbox', { name: '保護者' }))
    expect(screen.getByText('保護者を外すと、このメンバーと選手との紐づけも外れます。')).toBeInTheDocument()
  })

  it('AC-004-09 unchecking every role turns into a removal with a confirmation', async () => {
    const { calls, router } = renderAt(`/teams/${U10.id}/members/3`, {
      'GET /api/me': signedIn({ teams: [U10] }),
      [`GET ${BASE}`]: { status: 200, body: U10 },
      [`GET ${BASE}/members`]: list([rep, officer, parent]),
      [`DELETE ${BASE}/members/3`]: { status: 204 },
    })

    await userEvent.click(await screen.findByRole('checkbox', { name: '保護者' }))

    const roles = screen.getByRole('region', { name: '役割' })
    expect(within(roles).getByText(/役割をすべて外すと、除名になります。/)).toBeInTheDocument()
    expect(within(roles).queryByRole('button', { name: '役割を保存する' })).not.toBeInTheDocument()
    await userEvent.click(within(roles).getByRole('button', { name: '除名する' }))
    expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(0)
    await userEvent.click(within(roles).getByRole('button', { name: '山田 花子さんを除名する' }))

    expect(await screen.findByText('山田 花子さんを除名しました。')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(`/teams/${U10.id}/members`)
    expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(0)
  })

  it('AC-004-04 the representative hands over to an officer after a confirmation', async () => {
    const { calls, router } = renderAt(`/teams/${U10.id}/members/2`, {
      'GET /api/me': signedIn({ teams: [U10] }),
      [`GET ${BASE}`]: { status: 200, body: U10 },
      [`GET ${BASE}/members`]: list([rep, officer, parent]),
      [`POST ${BASE}/representative`]: { status: 200, body: { member: { ...officer, roles: ['representative', 'parent'] } } },
    })

    const section = await screen.findByRole('region', { name: '代表を交代する' })
    expect(within(section).getByText('佐藤 役員さんが代表になり、あなたは役員になります。お二人にメールで知らせます。')).toBeInTheDocument()
    await userEvent.click(within(section).getByRole('button', { name: '代表を交代する' }))
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0)
    await userEvent.click(within(section).getByRole('button', { name: '佐藤 役員さんに代表を交代する' }))

    await screen.findByRole('heading', { name: U10.name, level: 1 })
    expect(router.state.location.pathname).toBe(`/teams/${U10.id}`)
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ membership_id: 2 })
    // 自分の役割が変わるので、セッション(チームの一覧)を読み直す
    expect(calls.filter((c) => c.path === '/api/me').length).toBeGreaterThanOrEqual(2)
  })

  it('AC-004-05 a member who is not an officer cannot be made representative and the screen says why', async () => {
    renderAt(`/teams/${U10.id}/members/3`, {
      'GET /api/me': signedIn({ teams: [U10] }),
      [`GET ${BASE}`]: { status: 200, body: U10 },
      [`GET ${BASE}/members`]: list([rep, officer, parent]),
    })

    const section = await screen.findByRole('region', { name: '代表を交代する' })
    expect(within(section).getByText('代表にできるのは役員のメンバーだけです。交代するときは、先に役員に任命してください。')).toBeInTheDocument()
    expect(within(section).queryByRole('button')).not.toBeInTheDocument()
  })

  it('AC-004-06 the representative cannot remove themselves and is told to hand over first', async () => {
    renderAt(`/teams/${U10.id}/members/1`, {
      'GET /api/me': signedIn({ teams: [U10] }),
      [`GET ${BASE}`]: { status: 200, body: U10 },
      [`GET ${BASE}/members`]: list([rep, officer, parent]),
    })

    expect(await screen.findByText('代表は自分を除名できません。チームを離れるときは、先に役員のメンバーに代表を交代してください。')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '除名する' })).not.toBeInTheDocument()
    expect(screen.getByText('代表の役割は、代表の交代でだけ変わります。ほかの役割は、あわせて持てます。')).toBeInTheDocument()
  })

  it.each([
    ['the representative', rep],
    ['another officer', officer],
  ])('AC-004-07 an officer is not offered removal of %s', async (_, target) => {
    renderAt(`/teams/${U10.id}/members/${target.membership_id}`, {
      'GET /api/me': signedIn({ teams: [officerTeam] }),
      [`GET ${BASE}`]: { status: 200, body: officerTeam },
      [`GET ${BASE}/members`]: list([{ ...rep, is_me: false }, officer, parent]),
    })

    await screen.findByRole('heading', { name: target.display_name ?? '', level: 1 })
    expect(screen.queryByRole('region', { name: '除名する' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '役割' })).not.toBeInTheDocument()
  })

  it('AC-004-08 an officer removes a parent after a confirmation', async () => {
    const { calls, router } = renderAt(`/teams/${U10.id}/members/3`, {
      'GET /api/me': signedIn({ teams: [officerTeam] }),
      [`GET ${BASE}`]: { status: 200, body: officerTeam },
      [`GET ${BASE}/members`]: list([{ ...rep, is_me: false }, { ...officer, is_me: true }, parent]),
      [`DELETE ${BASE}/members/3`]: { status: 204 },
    })

    const section = await screen.findByRole('region', { name: '除名する' })
    expect(within(section).getByText(/すぐにチームの情報を見られなくなり、選手との紐づけも外れます/)).toBeInTheDocument()
    await userEvent.click(within(section).getByRole('button', { name: '除名する' }))
    expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(0)
    await userEvent.click(within(section).getByRole('button', { name: '山田 花子さんを除名する' }))

    expect(await screen.findByText('山田 花子さんを除名しました。')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(`/teams/${U10.id}/members`)
  })

  it('AC-004-07 when the API refuses the removal, the reason is shown', async () => {
    renderAt(`/teams/${U10.id}/members/3`, {
      'GET /api/me': signedIn({ teams: [officerTeam] }),
      [`GET ${BASE}`]: { status: 200, body: officerTeam },
      [`GET ${BASE}/members`]: list([{ ...rep, is_me: false }, { ...officer, is_me: true }, parent]),
      [`DELETE ${BASE}/members/3`]: { status: 403, body: { message: 'この操作を行う権限がありません' } },
    })

    const section = await screen.findByRole('region', { name: '除名する' })
    await userEvent.click(within(section).getByRole('button', { name: '除名する' }))
    await userEvent.click(within(section).getByRole('button', { name: '山田 花子さんを除名する' }))

    expect(await within(section).findByRole('alert')).toHaveTextContent('この操作を行う権限がありません')
  })

  it('AC-004-09 the removal confirmation can be cancelled', async () => {
    const { calls } = renderAt(`/teams/${U10.id}/members/3`, {
      'GET /api/me': signedIn({ teams: [U10] }),
      [`GET ${BASE}`]: { status: 200, body: U10 },
      [`GET ${BASE}/members`]: list([rep, officer, parent]),
    })

    await userEvent.click(await screen.findByRole('checkbox', { name: '保護者' }))
    const roles = screen.getByRole('region', { name: '役割' })
    await userEvent.click(within(roles).getByRole('button', { name: '除名する' }))
    await userEvent.click(within(roles).getByRole('button', { name: 'やめる' }))
    await userEvent.click(within(roles).getByRole('checkbox', { name: 'コーチ' }))

    expect(within(roles).getByRole('button', { name: '役割を保存する' })).toBeInTheDocument()
    expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(0)
  })

  it('AC-004-08 when the member was already removed, the screen says so instead of claiming success', async () => {
    renderAt(`/teams/${U10.id}/members/3`, {
      'GET /api/me': signedIn({ teams: [officerTeam] }),
      [`GET ${BASE}`]: { status: 200, body: officerTeam },
      [`GET ${BASE}/members`]: list([{ ...rep, is_me: false }, { ...officer, is_me: true }, parent]),
      [`DELETE ${BASE}/members/3`]: { status: 404, body: { message: '見つかりません' } },
    })

    const section = await screen.findByRole('region', { name: '除名する' })
    await userEvent.click(within(section).getByRole('button', { name: '除名する' }))
    await userEvent.click(within(section).getByRole('button', { name: '山田 花子さんを除名する' }))

    expect(await screen.findByText('山田 花子さんは、すでにチームにいません。')).toBeInTheDocument()
  })

  it('a member who is no longer in the team is shown as not found', async () => {
    renderAt(`/teams/${U10.id}/members/9`, {
      'GET /api/me': signedIn({ teams: [U10] }),
      [`GET ${BASE}`]: { status: 200, body: U10 },
      [`GET ${BASE}/members`]: list([rep]),
    })

    expect(await screen.findByRole('heading', { name: 'メンバーが見つかりません' })).toBeInTheDocument()
  })
})

describe('チームの設定', () => {
  it('AC-004-11 the representative renames the team and the session is reloaded', async () => {
    const { calls } = renderAt(`/teams/${U10.id}/settings`, {
      'GET /api/me': signedIn({ teams: [U10] }),
      [`GET ${BASE}`]: { status: 200, body: U10 },
      [`PATCH ${BASE}`]: { status: 200, body: { ...U10, name: 'あおば台FC U-12', sport: 'baseball' } },
    })

    const name = await screen.findByLabelText('チーム名')
    expect(name).toHaveValue('あおば台FC U-10')
    await userEvent.clear(name)
    await userEvent.type(name, 'あおば台FC U-12')
    await userEvent.click(screen.getByRole('radio', { name: '野球' }))
    await userEvent.click(screen.getByRole('button', { name: '保存する' }))

    expect(await screen.findByText('保存しました。メンバー全員の画面に、新しいチーム名が表示されます。')).toBeInTheDocument()
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ name: 'あおば台FC U-12', sport: 'baseball' })
    expect(calls.filter((c) => c.path === '/api/me').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByRole('heading', { name: 'あおば台FC U-12', level: 1 })).toBeInTheDocument()
  })

  it('AC-004-11 shows the field errors from the API', async () => {
    renderAt(`/teams/${U10.id}/settings`, {
      'GET /api/me': signedIn({ teams: [U10] }),
      [`GET ${BASE}`]: { status: 200, body: U10 },
      [`PATCH ${BASE}`]: { status: 422, body: { message: '入力内容を確認してください', errors: { name: ['チーム名は、1文字から50文字にしてください。'] } } },
    })

    await userEvent.clear(await screen.findByLabelText('チーム名'))
    await userEvent.click(screen.getByRole('button', { name: '保存する' }))

    expect(await screen.findByText('チーム名は、1文字から50文字にしてください。')).toBeInTheDocument()
    expect(screen.getByLabelText('チーム名')).toHaveAttribute('aria-invalid', 'true')
  })

  it('AC-004-11 an officer cannot open the team settings', async () => {
    renderAt(`/teams/${U10.id}/settings`, { 'GET /api/me': signedIn({ teams: [officerTeam] }), [`GET ${BASE}`]: { status: 200, body: officerTeam } })

    expect(await screen.findByText('チーム名と競技は、チームの代表だけが変えられます。')).toBeInTheDocument()
  })
})

describe('監査ログ', () => {
  const entry = (overrides: Partial<AuditLogEntry>): AuditLogEntry => ({
    id: 1,
    created_at: '2026-11-07T06:30:00+00:00',
    action: 'member.roles_changed',
    action_label: 'メンバーの役割を変更',
    actor: 'member',
    actor_display_name: '代表 太郎',
    ...overrides,
  })

  it('AC-004-12 lists time, actor and action, and loads older records', async () => {
    const { calls } = renderAt(`/teams/${U10.id}/audit-logs`, {
      'GET /api/me': signedIn({ teams: [U10] }),
      [`GET ${BASE}`]: { status: 200, body: U10 },
      [`GET ${BASE}/audit-logs`]: {
        status: 200,
        body: {
          logs: [entry({ id: 5 }), entry({ id: 4, action_label: '名簿を閲覧', actor: 'former', actor_display_name: null }), entry({ id: 3, action_label: '参加申請を却下', actor: 'former', actor_display_name: null })],
          next_before: 3,
        },
      },
    })

    const items = within(await screen.findByRole('list', { name: '記録' })).getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('メンバーの役割を変更2026/11/7 15:30 / 代表 太郎')
    expect(items[1]).toHaveTextContent('名簿を閲覧')
    expect(items[1]).toHaveTextContent('(退会したメンバー)')
    expect(items[2]).toHaveTextContent('(退会したメンバー)')

    await userEvent.click(screen.getByRole('button', { name: 'さらに古い記録を見る' }))
    await screen.findAllByText('メンバーの役割を変更')
    expect(new URLSearchParams(calls.filter((c) => c.path === `${BASE}/audit-logs`).at(-1)?.search).get('before')).toBe('3')
  })

  it('AC-004-12 an officer cannot open the audit log', async () => {
    renderAt(`/teams/${U10.id}/audit-logs`, { 'GET /api/me': signedIn({ teams: [officerTeam] }), [`GET ${BASE}`]: { status: 200, body: officerTeam } })

    expect(await screen.findByText('監査ログは、チームの代表だけが見られます。')).toBeInTheDocument()
  })
})
