import type { ReactNode } from 'react'

type Props = {
  tag: string
  meta?: ReactNode
  title?: ReactNode
  /** Heading level of the title. The page's main heading should be 1. */
  level?: 1 | 2
  children?: ReactNode
  label?: string
}

/** The navy match-center board with the broadcast strip (tag on the left, meta on the right). */
export function Panel({ tag, meta, title, level = 1, children, label }: Props) {
  const Heading = level === 1 ? 'h1' : 'h2'
  return (
    <section className="panel" aria-label={label}>
      <div className="panel__strip">
        <span className="panel__tag">{tag}</span>
        {meta !== undefined && <span className="panel__meta">{meta}</span>}
      </div>
      <div className="panel__body">
        {title !== undefined && <Heading className="panel__title">{title}</Heading>}
        {children}
      </div>
    </section>
  )
}
