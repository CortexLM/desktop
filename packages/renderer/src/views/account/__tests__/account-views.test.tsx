/**
 * Tests for the account views.
 *
 * WHAT THESE TESTS ARE FOR, AND WHAT THEY DELIBERATELY DO NOT DO:
 *
 * These views are an unfinished interface with no backend (see README.md in
 * this directory). Before this suite they were at 0% coverage, and the obvious
 * way to raise that number would have been to assert the invented data they
 * used to render — that the invoice table shows `inv-001` at `$29.00`, that
 * Visa •••• 4242 is the default card, that John Doe is the owner. Those tests
 * would have passed forever, described nothing true, and turned a green
 * coverage number into evidence for a feature that does not exist.
 *
 * So these tests pin the opposite property: that no fabricated account state is
 * presented as the user's own, and that every empty region explains *why* it is
 * empty. That is a real invariant — it fails if someone re-adds mock invoices,
 * a mock roster, or random chart data — and it is the behaviour the views are
 * actually supposed to have today.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProfileView } from '../ProfileView';
import { TeamView } from '../TeamView';
import { BillingView } from '../BillingView';
import { DemoNotice } from '../DemoNotice';

/**
 * Strings that were previously rendered as if they were the signed-in user's
 * real account state. Each is checked as a regex against the full rendered
 * text, so a reappearance in any markup shape is caught.
 */
const FABRICATED_ACCOUNT_DATA = [
  // BillingView: invoice history
  /inv-00\d/i,
  /\$29\.00/,
  // BillingView: payment methods
  /4242/,
  /5555/,
  /Mastercard/i,
  /•••• /,
  // BillingView: quota counters
  /127/,
  /\$18\.45/,
  // TeamView / ProfileView: invented identities
  /John Doe/i,
  /Jane Smith/i,
  /Bob Wilson/i,
  /Alice Johnson/i,
  /newcomer@example\.com/i,
  /john\.doe@example\.com/i,
];

describe('account views', () => {
  describe('DemoNotice', () => {
    it('names the missing backend so the reason is on screen, not inferred', () => {
      render(<DemoNotice feature="billing backend" />);

      const notice = screen.getByTestId('demo-notice');
      expect(notice).toHaveTextContent('Not functional');
      expect(notice).toHaveTextContent(/Cortex has no billing backend/);
    });

    it('renders the alternative pointer only when one is given', () => {
      const { unmount } = render(
        <DemoNotice feature="billing backend" alternative="Use the Usage view." />
      );
      expect(screen.getByTestId('demo-notice')).toHaveTextContent('Use the Usage view.');
      unmount();

      render(<DemoNotice feature="billing backend" />);
      // Without an alternative the sentence must simply end, not render
      // "undefined" — which is what a bare `{alternative}` would have done.
      expect(screen.getByTestId('demo-notice')).not.toHaveTextContent(/undefined/);
    });

    it('is announced as a status', () => {
      render(<DemoNotice feature="billing backend" />);
      expect(screen.getByTestId('demo-notice')).toHaveAttribute('role', 'status');
    });

    it('keeps the decorative icon out of the accessibility tree', () => {
      const { container } = render(<DemoNotice feature="billing backend" />);

      // HONEST SCOPE: lucide-react sets aria-hidden="true" on its icons itself
      // (measured 2026-08-17 — a bare <Info /> renders it with no prop passed),
      // so this assertion pins the *rendered result*, not this file's own
      // prop. Deleting the explicit prop in DemoNotice.tsx would not fail this
      // test, and the mutation harness records that as an equivalent mutant.
      // It is kept because it would still catch swapping in an icon library
      // that does not do this, which is the outcome that matters for AT.
      expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe.each([
    ['ProfileView', ProfileView],
    ['TeamView', TeamView],
    ['BillingView', BillingView],
  ] as const)('%s', (_name, View) => {
    it('presents no fabricated account data as the user\'s own', () => {
      const { container } = render(<View />);
      const text = container.textContent ?? '';

      // Guard against the assertion silently passing on an empty render.
      expect(text.length).toBeGreaterThan(50);

      for (const pattern of FABRICATED_ACCOUNT_DATA) {
        expect(text).not.toMatch(pattern);
      }
    });

    it('marks itself non-functional on screen', () => {
      render(<View />);
      expect(screen.getByTestId('demo-notice')).toBeInTheDocument();
    });

    it('renders no control that would imply a working write path', () => {
      render(<View />);

      // The old views offered Save / Upload / Invite / Download / Add Payment
      // Method / Upgrade Plan buttons, none of which did anything. A button
      // that cannot act must not be offered.
      for (const label of [
        /save/i,
        /upload/i,
        /invite/i,
        /download/i,
        /add payment/i,
        /upgrade/i,
        /set default/i,
        /resend/i,
        /revoke/i,
      ]) {
        expect(screen.queryByRole('button', { name: label })).toBeNull();
      }
    });
  });

  describe('BillingView', () => {
    it('explains each empty financial section instead of showing a blank panel', () => {
      render(<BillingView />);

      // Every section states a reason. An empty panel whose source was never
      // wired is otherwise indistinguishable from one with nothing to show.
      expect(screen.getByTestId('usage-empty')).toHaveTextContent(
        /does not meter usage or enforce limits/i
      );
      expect(screen.getByTestId('payment-methods-empty')).toHaveTextContent(
        /does not process payments/i
      );
      expect(screen.getByTestId('invoices-empty')).toHaveTextContent(
        /No invoices exist/i
      );
    });

    it('points at the usage feature that does read real data', () => {
      render(<BillingView />);
      expect(screen.getByTestId('demo-notice')).toHaveTextContent(/Usage view under Agents/i);
    });

    it('renders no monetary amount at all', () => {
      const { container } = render(<BillingView />);
      const text = container.textContent ?? '';

      // No currency figure should appear anywhere: with no billing backend
      // there is no amount that could be correct. This also catches the
      // NaN/-1/undefined formatting classes, since any of them would have to
      // be rendered next to a `$` by this view's own formatters.
      expect(text).not.toMatch(/\$\s*[\d.]/);
      expect(text).not.toMatch(/NaN|Infinity|undefined|null/);
    });

    it('renders no chart, so no figure can vary between renders', () => {
      // The previous implementation regenerated every data point with
      // Math.random() on mount and on each time-range change, so the displayed
      // "Total spend" differed on every render. Rendering twice and comparing
      // is what catches a reintroduction of that.
      const first = render(<BillingView />);
      const firstText = first.container.textContent;
      first.unmount();

      const second = render(<BillingView />);
      expect(second.container.textContent).toBe(firstText);
    });

    it('offers no time-range selector for data it does not have', () => {
      render(<BillingView />);
      expect(screen.queryByRole('combobox')).toBeNull();
    });
  });

  describe('TeamView', () => {
    it('says why there are no members and no permissions', () => {
      render(<TeamView />);

      expect(screen.getByTestId('members-empty')).toHaveTextContent(
        /no accounts or sign-in/i
      );
      expect(screen.getByTestId('permissions-empty')).toHaveTextContent(
        /No permissions are enforced/i
      );
    });

    it('renders no member row and no search over an empty roster', () => {
      render(<TeamView />);

      expect(screen.queryAllByRole('row')).toHaveLength(0);
      expect(screen.queryByRole('textbox')).toBeNull();
    });
  });

  describe('ProfileView', () => {
    it('says there is no profile rather than showing an invented one', () => {
      render(<ProfileView />);
      expect(screen.getByTestId('identity-empty')).toHaveTextContent(
        /no account system/i
      );
    });

    it('directs preferences to Settings, which is where they persist', () => {
      render(<ProfileView />);
      expect(screen.getByTestId('preferences-pointer')).toHaveTextContent(/Settings/);
    });

    it('renders no editable field that would discard its input', () => {
      const { container } = render(<ProfileView />);

      // Name/email inputs and the theme/language selects used to accept edits,
      // set an "Unsaved changes" badge, and drop everything on save.
      expect(container.querySelectorAll('input')).toHaveLength(0);
      expect(container.querySelectorAll('select')).toHaveLength(0);
      expect(screen.queryByText(/unsaved changes/i)).toBeNull();
    });
  });
});
