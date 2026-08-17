/**
 * Honest "not functional" banner for the account views.
 *
 * WHY THIS EXISTS: the three reachable account views (Profile, Team, Billing)
 * were built as UI demos against invented data — a $29.00 "paid" invoice
 * history, two saved credit cards, a four-person team, and usage charts filled
 * by `Math.random()`. None of it came from anywhere: there is no auth backend,
 * no team backend, and no billing backend in this repo (measured 2026-08-17 —
 * zero `account:`/`billing:`/`team:` IPC channels in packages/main, zero
 * `window.cortex` calls in this directory).
 *
 * Showing invented invoices and payment methods as if they were the user's own
 * account state is a correctness problem, not a cosmetic one: a user cannot
 * tell a fabricated "paid $29.00" row from a real charge. The fabricated data
 * has been removed and each view now states why it is empty. This banner makes
 * the status legible at the top of the view rather than leaving the reader to
 * infer it from an empty panel — an empty panel whose source is not wired is
 * otherwise indistinguishable from an empty panel that has nothing to show.
 */
import React from 'react';
import { Info } from 'lucide-react';

interface DemoNoticeProps {
  /** What is not connected, phrased for a user, e.g. "billing backend". */
  feature: string;
  /** Optional pointer to the feature that *is* real, if one exists. */
  alternative?: string;
}

export const DemoNotice: React.FC<DemoNoticeProps> = ({ feature, alternative }) => (
  <div
    className="border border-border bg-tint rounded-sm p-4 flex items-start gap-3"
    role="status"
    data-testid="demo-notice"
  >
    <Info className="w-5 h-5 text-text-secondary flex-shrink-0 mt-0.5" aria-hidden="true" />
    <div className="flex-1">
      <p className="text-sm font-semibold text-text">Not functional</p>
      <p className="text-xs text-text-secondary mt-1">
        Cortex has no {feature}. This screen is an unfinished interface, not a view of your
        account, and nothing here is connected to a real service.
        {alternative ? ` ${alternative}` : ''}
      </p>
    </div>
  </div>
);
