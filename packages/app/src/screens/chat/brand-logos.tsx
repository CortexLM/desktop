import type { JSX } from 'solid-js';

import type { PluginBrand } from '../../state/plugins.ts';

/**
 * Official brand marks for plugin cards. Colours follow each owner's public
 * guidelines. These are trademarks of their owners — see NOTICE.
 */
export function BrandLogo(props: { brand: PluginBrand; size?: number }): JSX.Element {
  const size = () => props.size ?? 28;
  if (props.brand === 'drive') return <DriveMark size={size()} />;
  if (props.brand === 'slack') return <SlackMark size={size()} />;
  if (props.brand === 'github') return <GitHubMark size={size()} />;
  return <PaperMark size={size()} />;
}

function DriveMark(props: { size: number }): JSX.Element {
  return (
    <svg width={props.size} height={props.size} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#188038" d="M8.6 3.2 2 14.4 4.7 19h6.5L8.6 3.2z" />
      <path fill="#FBBC04" d="M15.4 3.2 8.6 3.2 11.2 19h6.6L15.4 3.2z" />
      <path fill="#4285F4" d="M22 14.4 15.4 3.2 11.2 19h8.1L22 14.4z" />
    </svg>
  );
}

function SlackMark(props: { size: number }): JSX.Element {
  return (
    <svg width={props.size} height={props.size} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#E01E5A" d="M6.2 12.9a2 2 0 1 1-2-2h2v2zm.9 0a2 2 0 1 1 4 0v5a2 2 0 1 1-4 0v-5z" />
      <path fill="#36C5F0" d="M11.1 6.2a2 2 0 1 1 2-2v2h-2zm0 .9a2 2 0 1 1 0 4h-5a2 2 0 1 1 0-4h5z" />
      <path fill="#2EB67D" d="M17.8 11.1a2 2 0 1 1 2 2h-2v-2zm-.9 0a2 2 0 1 1-4 0v-5a2 2 0 1 1 4 0v5z" />
      <path fill="#ECB22E" d="M12.9 17.8a2 2 0 1 1-2 2v-2h2zm0-.9a2 2 0 1 1 0-4h5a2 2 0 1 1 0 4h-5z" />
    </svg>
  );
}

function GitHubMark(props: { size: number }): JSX.Element {
  return (
    <svg width={props.size} height={props.size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2C6.48 2 2 6.58 2 12.26c0 4.52 2.87 8.36 6.84 9.71.5.1.68-.22.68-.49 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.36 1.12 2.94.86.09-.67.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.04 1.03-2.76-.1-.26-.45-1.3.1-2.71 0 0 .84-.27 2.75 1.05A9.3 9.3 0 0 1 12 6.84c.85 0 1.71.12 2.51.34 1.91-1.32 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.64 1.03 2.76 0 3.94-2.34 4.8-4.58 5.06.36.32.68.95.68 1.92 0 1.38-.01 2.49-.01 2.83 0 .27.18.6.69.49A10.04 10.04 0 0 0 22 12.26C22 6.58 17.52 2 12 2z"
      />
    </svg>
  );
}

function PaperMark(props: { size: number }): JSX.Element {
  return (
    <svg width={props.size} height={props.size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="3" width="16" height="18" rx="3" fill="#211F1C" />
      <path d="M8 8h8M8 12h8M8 16h5" stroke="#FAF8F4" stroke-width="1.6" stroke-linecap="round" />
    </svg>
  );
}
