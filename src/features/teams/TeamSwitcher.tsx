import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router'
import type { Team } from '../../api/client.ts'
import { ROLE_LABELS } from './sports.ts'

/**
 * 所属するチームの切り替え(AC-001-13)。チームごとに URL が違う(ADR-0009)ので、
 * 選ぶとそのチームの画面に移る。Escape かメニューの外を押すと閉じ、ボタンにフォーカスを戻す。
 */
export function TeamSwitcher({ teams, currentId }: { teams: Team[]; currentId: string }) {
  const [open, setOpen] = useState(false)
  const listId = useId()
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (returnFocus: boolean) => {
      setOpen(false)
      if (returnFocus) button.current?.focus()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(true)
    }
    const onPointer = (e: PointerEvent) => {
      if (root.current !== null && !root.current.contains(e.target as Node)) close(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [open])

  return (
    <div className="switcher" ref={root}>
      <button
        ref={button}
        type="button"
        className="icon-button"
        aria-label="チームを切り替える"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
      >
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 4l-4 4 4 4" />
          <path d="M3 8h14" />
          <path d="M17 20l4-4-4-4" />
          <path d="M21 16H7" />
        </svg>
      </button>
      {open && (
        <nav id={listId} className="switcher__menu" aria-label="所属しているチーム">
          <ul className="switcher__list">
            {teams.map((team) => (
              <li key={team.id}>
                <Link
                  to={`/teams/${team.id}`}
                  className="switcher__item"
                  aria-current={team.id === currentId ? 'page' : undefined}
                  onClick={() => setOpen(false)}
                >
                  <span className="switcher__name">{team.name}</span>
                  <span className="switcher__role">{ROLE_LABELS[team.role]}</span>
                </Link>
              </li>
            ))}
          </ul>
          <Link to="/teams/new" className="switcher__create" onClick={() => setOpen(false)}>
            チームを作成する
          </Link>
        </nav>
      )}
    </div>
  )
}
