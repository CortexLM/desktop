import { type JSX, splitProps } from 'solid-js';

import './toast.css';

export type ToastTone = 'success' | 'error';

export interface ToastProps extends JSX.HTMLAttributes<HTMLDivElement> {
  message: string;
  tone?: ToastTone;
}

/**
 * The status mark: a filled disc with a knocked-out glyph.
 *
 * Drawn here rather than pulled from the icon registry because the glyph is painted in the
 * toast's *background* colour, not a foreground one. A `currentColor` icon cannot express
 * that, and the extracted geometry normalises exactly that distinction away.
 */
function ToastMark(props: { tone: ToastTone }): JSX.Element {
  return (
    <svg
      class="cx-toast__mark"
      width="14"
      height="14"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle
        cx="8"
        cy="8"
        r="7"
        fill={props.tone === 'error' ? 'var(--color-error)' : 'var(--color-toast-accent)'}
      />
      {props.tone === 'error' ? (
        <path
          d="M5.5 5.5l5 5M10.5 5.5l-5 5"
          fill="none"
          stroke="var(--color-toast-bg)"
          stroke-width="1.8"
          stroke-linecap="round"
        />
      ) : (
        <path
          d="M5 8.2l2 2 4-4.5"
          fill="none"
          stroke="var(--color-toast-bg)"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      )}
    </svg>
  );
}

/**
 * A transient confirmation.
 *
 * `role="status"` with `aria-live="polite"` rather than `alert`: these confirm something the
 * user just did, so interrupting a screen reader mid-sentence would be worse than waiting
 * for a pause. An error toast here is still a confirmation of a completed action, not an
 * unprompted warning.
 */
export function Toast(props: ToastProps): JSX.Element {
  const [local, rest] = splitProps(props, ['message', 'tone', 'class']);

  return (
    <div
      class={local.class ? `cx-toast ${local.class}` : 'cx-toast'}
      role="status"
      aria-live="polite"
      {...rest}
    >
      <ToastMark tone={local.tone ?? 'success'} />
      <span class="cx-toast__message">{local.message}</span>
    </div>
  );
}
