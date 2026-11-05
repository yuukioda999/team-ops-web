import { useId, type InputHTMLAttributes } from 'react'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  label: string
  hint?: string
  error?: string
}

/** A labelled input. The hint and error are linked to the input for screen readers. */
export function TextField({ label, hint, error, ...input }: Props) {
  const id = useId()
  const hintId = hint !== undefined ? `${id}-hint` : undefined
  const errorId = error !== undefined ? `${id}-error` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <input
        {...input}
        id={id}
        className="field__input"
        aria-invalid={error !== undefined ? true : undefined}
        aria-describedby={describedBy}
      />
      {error !== undefined && (
        <p id={errorId} className="field__error">
          {error}
        </p>
      )}
      {hint !== undefined && (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      )}
    </div>
  )
}
