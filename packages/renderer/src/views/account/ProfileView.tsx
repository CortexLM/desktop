/**
 * ProfileView - account profile for a product that has no accounts.
 *
 * HISTORY / WHY THE FIELDS ARE GONE:
 * This view previously presented an invented identity as the signed-in user —
 * "John Doe" / "john.doe@example.com" — in editable name and email fields, with
 * an avatar uploader, a theme picker, a language picker and a table of keyboard
 * shortcuts with Edit buttons. `handleSave` was a `console.log`: the "Unsaved
 * changes" badge cleared and nothing was written anywhere. Upload/Remove and
 * every shortcut Edit button had no handler at all.
 *
 * Measured on 2026-08-17: no `account:` or `profile:` IPC channels exist in
 * packages/main, none are in the preload allowlist, there is no auth backend,
 * and this file made zero `window.cortex` calls.
 *
 * The theme and language pickers were the more misleading part: those are real,
 * working preferences — but they are owned by views/settings/SettingsView.tsx,
 * which persists to `localStorage['cortex:settings']`. The copies here wrote to
 * local component state only, so changing the theme here appeared to work and
 * silently did nothing. Two controls that look identical and disagree about
 * whether they persist is worse than one control.
 *
 * So the duplicated controls are removed and this view points at the real one
 * instead of shadowing it.
 */

import React from 'react';
import { User } from 'lucide-react';
import { DemoNotice } from './DemoNotice';

export const ProfileView: React.FC = () => {
  return (
    <div className="flex flex-col h-full bg-page">
      {/* Header */}
      <div className="h-[40px] border-b border-border-soft flex items-center justify-between px-5">
        <div className="flex items-center gap-3">
          <User className="w-4 h-4 text-accent" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-text">Profile</h2>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-8 space-y-6">
          <DemoNotice feature="accounts or sign-in" />

          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-text">Identity</h3>
            <div
              className="border border-border rounded-sm bg-elevated p-6"
              data-testid="identity-empty"
            >
              <p className="text-sm text-text-secondary">
                There is no profile to edit. Cortex runs locally and has no account system, so
                there is no name, email or avatar stored for you anywhere.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-text">Preferences</h3>
            <div
              className="border border-border rounded-sm bg-elevated p-6"
              data-testid="preferences-pointer"
            >
              <p className="text-sm text-text-secondary">
                Theme, language, and keyboard shortcuts are configured in Settings, which is
                where they are actually saved. This screen previously showed a second copy of
                those controls that looked identical but discarded every change.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
