/**
 * TeamView - team management for a product that has no team backend.
 *
 * HISTORY / WHY THIS IS EMPTY:
 * This view previously listed four invented people as if they were the user's
 * real teammates — John Doe (owner), Jane Smith (admin), Bob Wilson (member),
 * Alice Johnson (viewer), plus a pending invitation to
 * newcomer@example.com — with role dropdowns, a search box, Resend/Revoke
 * buttons and a 6x4 permission matrix. `handleInvite` was a `console.log`: the
 * invite dialog closed and reset itself, and no invitation was ever sent.
 *
 * Measured on 2026-08-17: no `team:` or `account:` IPC channels exist in
 * packages/main, none are in the preload allowlist, there is no auth or user
 * backend anywhere in the repo, and this file made zero `window.cortex` calls.
 * The roster was hardcoded and the controls were inert.
 *
 * Rather than test invented people into coverage, the fabricated roster and the
 * controls that pretended to act on it are removed. The empty state states the
 * reason, because a blank panel does not distinguish "not wired" from "nothing
 * to show".
 */

import React from 'react';
import { Users } from 'lucide-react';
import { DemoNotice } from './DemoNotice';

export const TeamView: React.FC = () => {
  return (
    <div className="flex flex-col h-full bg-page">
      {/* Header */}
      <div className="h-[40px] border-b border-border-soft flex items-center justify-between px-5">
        <div className="flex items-center gap-3">
          <Users className="w-4 h-4 text-accent" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-text">Team Management</h2>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        <DemoNotice feature="accounts, sign-in or team backend" />

        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-text">Members</h3>
          <div
            className="border border-border rounded-sm bg-elevated p-6"
            data-testid="members-empty"
          >
            <p className="text-sm text-text-secondary">
              There are no team members to show. Cortex has no accounts or sign-in, so it has
              no notion of a team, and members cannot be listed or invited.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-text">Roles &amp; Permissions</h3>
          <div
            className="border border-border rounded-sm bg-elevated p-6"
            data-testid="permissions-empty"
          >
            <p className="text-sm text-text-secondary">
              No permissions are enforced. Cortex runs locally with the privileges of the user
              who started it; there is no server-side authorization to configure here.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};
