import { forwardRef, InputHTMLAttributes } from 'react'
import { clsx } from 'clsx'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  fullWidth?: boolean
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, helperText, fullWidth = true, id, className, ...props },
  ref
) {
  const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

  return (
    <div className={clsx('flex flex-col gap-1', fullWidth && 'w-full')}>
      {label && (
        <label htmlFor={inputId} className="form-label">
          {label}
          {props.required && <span className="ml-1 text-red-500">*</span>}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={clsx(
          'form-input',
          error && 'border-red-500 focus:ring-red-500 focus:border-red-500',
          className
        )}
        aria-invalid={!!error}
        aria-describedby={
          error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
        }
        {...props}
      />
      {error && (
        <p id={`${inputId}-error`} className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {!error && helperText && (
        <p id={`${inputId}-helper`} className="text-sm text-gray-500">
          {helperText}
        </p>
      )}
    </div>
  )
})

export default Input
