import type { ReactNode } from 'react'

type Props = {
  tag: string
  meta?: ReactNode
  /** The page's main heading (h1). */
  title?: ReactNode
  children?: ReactNode
  label?: string
}

/** The navy match-center board with the broadcast strip (tag on the left, meta on the right). */
export function Panel({ tag, meta, title, children, label }: Props) {
  return (
    <section className="panel" aria-label={label}>
      <div className="panel__strip">
        <span className="panel__tag">{tag}</span>
        {meta !== undefined && <span className="panel__meta">{meta}</span>}
      </div>
      <div className="panel__body">
        {title !== undefined && <h1 className="panel__title">{title}</h1>}
        {children}
      </div>
    </section>
  )
}
