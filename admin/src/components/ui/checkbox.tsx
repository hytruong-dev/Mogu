import * as React from 'react'
import { Check, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CheckboxProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked?: boolean | 'indeterminate'
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  name?: string
  value?: string
}

export const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  (
    {
      className,
      checked: controlledChecked,
      defaultChecked = false,
      onCheckedChange,
      onChange,
      disabled = false,
      name,
      value,
      id,
      ...props
    },
    ref
  ) => {
    const [uncontrolledChecked, setUncontrolledChecked] = React.useState<
      boolean | 'indeterminate'
    >(defaultChecked)
    const isControlled = controlledChecked !== undefined
    const isChecked = isControlled ? controlledChecked : uncontrolledChecked

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault()
      if (disabled) return
      const nextChecked = isChecked === true ? false : true
      if (!isControlled) {
        setUncontrolledChecked(nextChecked)
      }
      onCheckedChange?.(nextChecked)

      if (onChange) {
        const syntheticEvent = {
          target: { checked: nextChecked, name, value, id },
          currentTarget: { checked: nextChecked, name, value, id },
        } as unknown as React.ChangeEvent<HTMLInputElement>
        onChange(syntheticEvent)
      }
    }

    const state =
      isChecked === 'indeterminate'
        ? 'indeterminate'
        : isChecked
          ? 'checked'
          : 'unchecked'

    return (
      <button
        ref={ref}
        type="button"
        role="checkbox"
        aria-checked={isChecked === 'indeterminate' ? 'mixed' : Boolean(isChecked)}
        data-state={state}
        disabled={disabled}
        id={id}
        onClick={handleClick}
        className={cn(
          'peer h-4 w-4 shrink-0 rounded-[4px] border border-input shadow-xs transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          isChecked && 'border-primary bg-primary text-primary-foreground',
          className
        )}
        {...props}
      >
        <span className="flex items-center justify-center text-current">
          {isChecked === 'indeterminate' ? (
            <Minus className="h-3 w-3 stroke-[3]" />
          ) : isChecked ? (
            <Check className="h-3 w-3 stroke-[3]" />
          ) : null}
        </span>
      </button>
    )
  }
)

Checkbox.displayName = 'Checkbox'
