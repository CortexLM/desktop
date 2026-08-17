/**
 * BillingView - billing surface for a product that has no billing.
 *
 * HISTORY / WHY THIS IS MOSTLY EMPTY:
 * This view previously rendered invented account state as if it were the user's
 * own: three "paid" $29.00 invoices, two saved cards (Visa •••• 4242,
 * Mastercard •••• 5555), quota counters (127/200 sessions, $18.45/$50), and
 * three charts whose every point came from `Math.random()` — so the "Total
 * spend" figure changed on each render and on every time-range change.
 *
 * Measured on 2026-08-17: there are no `billing:`, `account:`, `subscription:`
 * or `payment:` IPC channels in packages/main, no entry for any of them in the
 * preload allowlist, and this file made zero `window.cortex` calls. Nothing was
 * ever fetched. The numbers were literals and random noise.
 *
 * That is worse than an empty screen: a fabricated "paid $29.00" row is
 * indistinguishable from a real charge to the person reading it. The invented
 * data is therefore removed rather than tested. The remaining sections state
 * why they are empty, which an empty panel alone does not.
 *
 * Real per-model/provider cost and token usage from the local database is a
 * feature that exists — see views/agents/UsageTracking.tsx, which queries
 * `window.cortex.db`. This view is not that, and does not duplicate it.
 */

import React from 'react';
import { CreditCard } from 'lucide-react';
import { DemoNotice } from './DemoNotice';

export const BillingView: React.FC = () => {
  return (
    <div className="flex flex-col h-full bg-page">
      {/* Header */}
      <div className="h-[40px] border-b border-border-soft flex items-center justify-between px-5">
        <div className="flex items-center gap-3">
          <CreditCard className="w-4 h-4 text-accent" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-text" data-testid="billing-plan">
            Billing &amp; Usage
          </h2>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        <DemoNotice
          feature="subscription or billing backend"
          alternative="For real token and cost usage measured from your local sessions, use the Usage view under Agents."
        />

        <EmptySection
          title="Usage and Limits"
          testId="usage-empty"
          reason="There are no plans or quotas to report against. Cortex does not meter usage or enforce limits."
        />

        <EmptySection
          title="Payment Methods"
          testId="payment-methods-empty"
          reason="No payment methods can be stored. Cortex does not process payments and is not connected to a payment provider."
        />

        <EmptySection
          title="Invoice History"
          testId="invoices-empty"
          reason="No invoices exist. Cortex does not bill for usage, so there is nothing to list or download."
        />
      </div>
    </div>
  );
};

interface EmptySectionProps {
  title: string;
  reason: string;
  testId: string;
}

/**
 * An empty state that says *why* it is empty.
 *
 * A panel that is blank because its source was never wired reads identically to
 * a panel that is blank because there is genuinely nothing in it. That ambiguity
 * hid two real bugs in this repo, so the reason is always rendered.
 */
const EmptySection: React.FC<EmptySectionProps> = ({ title, reason, testId }) => (
  <section className="space-y-4">
    <h3 className="text-sm font-semibold text-text">{title}</h3>
    <div
      className="border border-border rounded-sm bg-elevated p-6"
      data-testid={testId}
    >
      <p className="text-sm text-text-secondary">{reason}</p>
    </div>
  </section>
);
