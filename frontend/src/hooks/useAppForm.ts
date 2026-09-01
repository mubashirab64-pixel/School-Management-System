// hooks/useAppForm.ts
//
// Single wrapper around react-hook-form's useForm used by every migrated
// form. Always wires the Valibot resolver and the same validation timing,
// and scrolls the first invalid field into view when a submit fails.

import { useForm } from 'react-hook-form'
import type { FieldValues, SubmitErrorHandler, SubmitHandler, UseFormProps, UseFormReturn } from 'react-hook-form'
import { valibotResolver } from '@hookform/resolvers/valibot'
import type { GenericSchema } from 'valibot'

interface UseAppFormOptions<TFieldValues extends FieldValues>
  extends Omit<UseFormProps<TFieldValues>, 'resolver' | 'mode' | 'reValidateMode' | 'shouldFocusError'> {
  schema: GenericSchema<unknown, TFieldValues, any>
}

function scrollFirstErrorIntoView(errors: Record<string, unknown>) {
  const firstField = Object.keys(errors)[0]
  if (!firstField) return
  // register() puts the react-hook-form field path on the `name` attribute.
  const el = document.getElementsByName(firstField)[0] as HTMLElement | undefined
  if (el && typeof el.scrollIntoView === 'function') {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

export function useAppForm<TFieldValues extends FieldValues>({
  schema,
  ...rest
}: UseAppFormOptions<TFieldValues>): UseFormReturn<TFieldValues> {
  const form = useForm<TFieldValues>({
    ...rest,
    resolver: valibotResolver(schema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    shouldFocusError: true,
  })

  const originalHandleSubmit = form.handleSubmit
  form.handleSubmit = ((onValid: SubmitHandler<TFieldValues>, onInvalid?: SubmitErrorHandler<TFieldValues>) =>
    originalHandleSubmit(onValid, (errors, event) => {
      scrollFirstErrorIntoView(errors as Record<string, unknown>)
      onInvalid?.(errors, event)
    })) as typeof form.handleSubmit

  return form
}
