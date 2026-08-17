/**
 * ValidatedInput - text input with inline validation and visual state.
 *
 * Wraps the base Input with a label, a validity affordance (green check /
 * red alert), and an error message wired up via aria-describedby so the
 * failure reason reaches screen readers rather than only being visible.
 */

import * as React from 'react';
import { AlertCircle, Check } from 'lucide-react';
import { Input, type InputProps } from './ui/input';
import { cn } from '../lib/utils';

/** Returns an error message, or null when the value is acceptable. */
export type Validator = (value: string) => string | null;

export interface ValidatedInputProps extends Omit<InputProps, 'onChange' | 'value'> {
  label?: string;
  /** Current value. Supply together with `onChange` to control the input. */
  value?: string;
  validate?: Validator;
  /** Fires on every keystroke with the new value and whether it passes validation. */
  onChange?: (value: string, isValid: boolean) => void;
  /** Fires only when the value is valid. Convenient for committing to state. */
  onValidChange?: (value: string) => void;
  /** Guidance shown under the field while there is no error. */
  hint?: string;
}

export const ValidatedInput = React.forwardRef<HTMLInputElement, ValidatedInputProps>(
  (
    { label, validate, onChange, onValidChange, hint, className, id, value, ...props },
    ref
  ) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;

    const [internalValue, setInternalValue] = React.useState(value ?? '');
    // Errors stay hidden until interaction so a pristine form isn't a wall of red.
    const [touched, setTouched] = React.useState(false);

    // Controlled usage: follow the parent when it drives the value.
    const isControlled = value !== undefined;
    const currentValue = isControlled ? value : internalValue;

    const error = React.useMemo(
      () => (validate ? validate(currentValue) : null),
      [validate, currentValue]
    );

    const showError = touched && !!error;
    const showValid = touched && !error && currentValue.length > 0;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;

      if (!isControlled) setInternalValue(newValue);
      setTouched(true);

      const validationError = validate ? validate(newValue) : null;
      onChange?.(newValue, !validationError);
      if (!validationError) onValidChange?.(newValue);
    };

    const describedBy = showError ? errorId : hint ? hintId : undefined;

    return (
      <div className="space-y-2">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-text">
            {label}
            {props.required && (
              <span className="text-red ml-1" aria-hidden="true">
                *
              </span>
            )}
          </label>
        )}

        <div className="relative">
          <Input
            {...props}
            id={inputId}
            ref={ref}
            value={currentValue}
            onChange={handleChange}
            onBlur={(e) => {
              setTouched(true);
              props.onBlur?.(e);
            }}
            aria-invalid={showError}
            aria-describedby={describedBy}
            aria-required={props.required}
            className={cn(
              // Room for the status icon so long values don't slide under it.
              (showError || showValid) && 'pr-9',
              showError && 'border-red focus-visible:ring-red',
              showValid && 'border-green',
              className
            )}
          />

          {(showError || showValid) && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              {showError ? (
                <AlertCircle className="w-4 h-4 text-red" aria-hidden="true" />
              ) : (
                <Check className="w-4 h-4 text-green" aria-hidden="true" />
              )}
            </div>
          )}
        </div>

        {showError ? (
          <p id={errorId} role="alert" className="text-xs text-red flex items-center gap-1">
            <AlertCircle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
            {error}
          </p>
        ) : (
          hint && (
            <p id={hintId} className="text-xs text-text-tertiary">
              {hint}
            </p>
          )
        )}
      </div>
    );
  }
);

ValidatedInput.displayName = 'ValidatedInput';

/**
 * Reusable validators. Each is a factory so the message can be customised at
 * the call site: `validators.required('Pick a folder')`.
 */
export const validators = {
  required:
    (message = 'This field is required'): Validator =>
    (value) =>
      value.trim() === '' ? message : null,

  minLength:
    (min: number, message?: string): Validator =>
    (value) =>
      value.length < min ? message ?? `Must be at least ${min} characters` : null,

  maxLength:
    (max: number, message?: string): Validator =>
    (value) =>
      value.length > max ? message ?? `Must be at most ${max} characters` : null,

  pattern:
    (pattern: RegExp, message: string): Validator =>
    (value) =>
      !pattern.test(value) ? message : null,

  email:
    (message = 'Invalid email address'): Validator =>
    (value) =>
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? message : null,

  /**
   * Absolute filesystem path. Rejects `..` segments: paths reaching outside the
   * intended directory are a traversal risk once handed to the main process.
   */
  path:
    (message = 'Enter an absolute path'): Validator =>
    (value) => {
      const trimmed = value.trim();
      if (!trimmed) return message;

      const isAbsolute = trimmed.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(trimmed);
      if (!isAbsolute) return message;

      const segments = trimmed.split(/[\\/]/);
      if (segments.includes('..')) return 'Path cannot contain ".."';

      return null;
    },

  /** Runs validators in order and reports the first failure. */
  compose:
    (...list: Validator[]): Validator =>
    (value) => {
      for (const validator of list) {
        const error = validator(value);
        if (error) return error;
      }
      return null;
    },
};
