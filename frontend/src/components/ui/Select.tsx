import { forwardRef, SelectHTMLAttributes } from 'react'
import { clsx } from 'clsx'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  helperText?: string
  options: SelectOption[]
  placeholder?: string
  fullWidth?: boolean
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, helperText, options, placeholder, fullWidth = true, id, className, ...props },
  ref
) {
  const selectId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

  return (
    <div className={clsx('flex flex-col gap-1', fullWidth && 'w-full')}>
      {label && (
        <label htmlFor={selectId} className="form-label">
          {label}
          {props.required && <span className="ml-1 text-red-500">*</span>}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        className={clsx(
          'form-input cursor-pointer',
          error && 'border-red-500 focus:ring-red-500 focus:border-red-500',
          className
        )}
        aria-invalid={!!error}
        aria-describedby={
          error ? `${selectId}-error` : helperText ? `${selectId}-helper` : undefined
        }
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${selectId}-error`} className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {!error && helperText && (
        <p id={`${selectId}-helper`} className="text-sm text-gray-500">
          {helperText}
        </p>
      )}
    </div>
  )
})

export default Select
