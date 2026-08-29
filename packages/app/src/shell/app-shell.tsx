import { type JSX, Show, splitProps } from 'solid-js';

import './app-shell.css';

export interface AppShellProps {
  sidebar: JSX.Element;
  children: JSX.Element;
}

/**
 * The two-pane frame. The sidebar is passed in rather than rendered here so a screen that
 * owns its whole surface - the auth screens - can use the same page primitives without a
 * sidebar it has no data for.
 */
export function AppShell(props: AppShellProps): JSX.Element {
  return (
    <div class="cx-app">
      {props.sidebar}
      <main class="cx-app__main">{props.children}</main>
    </div>
  );
}

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: JSX.Element;
  mark?: JSX.Element;
}

export function PageHeader(props: PageHeaderProps): JSX.Element {
  return (
    <header class="cx-page-header">
      <div class="cx-page-header__lead">
        <Show when={props.mark}>{(mark) => <div class="cx-page-header__mark">{mark()}</div>}</Show>
        <div class="cx-page-header__titles">
          <h1 class="cx-page-header__title">{props.title}</h1>
          <Show when={props.subtitle}>
            {(subtitle) => <p class="cx-page-header__subtitle">{subtitle()}</p>}
          </Show>
        </div>
      </div>
      <Show when={props.actions}>
        <div class="cx-page-header__actions">{props.actions}</div>
      </Show>
    </header>
  );
}

/** Content-column width, taken from the artboard each family of screens is drawn at. */
export type PageWidth = 'list' | 'settings' | 'usage' | 'centred' | 'bleed';

export interface PageBodyProps extends JSX.HTMLAttributes<HTMLDivElement> {
  width?: PageWidth;
}

export function PageBody(props: PageBodyProps): JSX.Element {
  const [local, rest] = splitProps(props, ['width', 'class', 'children']);

  const classes = () =>
    ['cx-page-body', `cx-page-body--${local.width ?? 'list'}`, local.class ?? '']
      .filter(Boolean)
      .join(' ');

  return (
    <div class={classes()} {...rest}>
      {local.children}
    </div>
  );
}
