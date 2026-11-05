import { useEffect, type RefObject } from 'react'

/**
 * After a submit is rejected, moves focus to the first field marked invalid, so screen reader
 * users hear which field to fix (its error is linked with aria-describedby).
 */
export function useFocusFirstInvalid(form: RefObject<HTMLFormElement | null>, errors: unknown): void {
  useEffect(() => {
    form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  }, [form, errors])
}
