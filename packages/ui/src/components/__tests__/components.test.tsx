import { fireEvent, render, screen } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';

import { Badge, SESSION_STATUS_TONES, StatusBadge, type SessionStatus } from '../badge.tsx';
import { Button } from '../button.tsx';
import { Chip } from '../chip.tsx';
import { NavItem } from '../nav-item.tsx';
import { TextField } from '../text-field.tsx';

describe('Button', () => {
  it('defaults to type=button so it cannot submit the composer form', () => {
    // The HTML default is submit, which inside the composer would send the prompt on every
    // icon press.
    render(() => <Button>Save</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('lets a caller opt into submit', () => {
    render(() => <Button type="submit">Send</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });

  it('defaults to the secondary variant', () => {
    render(() => <Button>Cancel</Button>);
    expect(screen.getByRole('button')).toHaveClass('cx-button--secondary');
  });

  it.each(['primary', 'secondary', 'ghost', 'destructive'] as const)(
    'renders the %s variant',
    (variant) => {
      render(() => <Button variant={variant}>Go</Button>);
      expect(screen.getByRole('button')).toHaveClass(`cx-button--${variant}`);
    },
  );

  it('renders leading and trailing glyphs around the label', () => {
    const { container } = render(() => (
      <Button icon="plus" trailingIcon="chevronDown">
        New session
      </Button>
    ));
    expect(container.querySelectorAll('svg')).toHaveLength(2);
    expect(screen.getByRole('button')).toHaveTextContent('New session');
  });

  it('does not fire when disabled', () => {
    const onClick = vi.fn();
    render(() => (
      <Button disabled onClick={onClick}>
        Stop
      </Button>
    ));

    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('carries the icon-only, round and block modifiers', () => {
    render(() => <Button iconOnly round block icon="close" aria-label="Dismiss" />);
    const button = screen.getByRole('button', { name: 'Dismiss' });

    expect(button).toHaveClass('cx-button--icon');
    expect(button).toHaveClass('cx-button--round');
    expect(button).toHaveClass('cx-button--block');
  });
});

describe('Badge', () => {
  it('hides the dot from assistive technology, since the label already says the state', () => {
    const { container } = render(() => (
      <Badge tone="success" dot>
        PR ready
      </Badge>
    ));
    expect(container.querySelector('.cx-badge__dot')).toHaveAttribute('aria-hidden', 'true');
  });

  it('omits the dot unless asked for', () => {
    const { container } = render(() => <Badge tone="neutral">Draft</Badge>);
    expect(container.querySelector('.cx-badge__dot')).toBeNull();
  });

  it('defaults to the neutral tone', () => {
    const { container } = render(() => <Badge>Draft</Badge>);
    expect(container.querySelector('.cx-badge')).toHaveClass('cx-badge--neutral');
  });
});

describe('StatusBadge', () => {
  const statuses = Object.keys(SESSION_STATUS_TONES) as SessionStatus[];

  it.each(statuses)('pairs %s with the tone and copy the design gives it', (status) => {
    const spec = SESSION_STATUS_TONES[status];
    const { container } = render(() => <StatusBadge status={status} />);
    const badge = container.querySelector('.cx-badge')!;

    expect(badge).toHaveClass(`cx-badge--${spec.tone}`);
    expect(badge).toHaveTextContent(spec.label);
    expect(Boolean(container.querySelector('.cx-badge__dot'))).toBe(spec.dot);
  });

  it('shows the dot on live states and withholds it from settled ones', () => {
    // A dot signals something in motion; draft and merged describe a PR that is not.
    expect(SESSION_STATUS_TONES.running.dot).toBe(true);
    expect(SESSION_STATUS_TONES['pr-ready'].dot).toBe(true);
    expect(SESSION_STATUS_TONES.error.dot).toBe(true);
    expect(SESSION_STATUS_TONES.draft.dot).toBe(false);
    expect(SESSION_STATUS_TONES.merged.dot).toBe(false);
  });

  it('lets a call site append detail to the copy', () => {
    render(() => <StatusBadge status="running" label="Running · 4m 32s" />);
    expect(screen.getByText('Running · 4m 32s')).toBeInTheDocument();
  });
});

describe('Chip', () => {
  it('is a plain span when it is decoration', () => {
    // An inbox row's repo name is not a control and must not be in the tab order.
    const { container } = render(() => <Chip>forge/backend-api</Chip>);

    expect(container.querySelector('button')).toBeNull();
    expect(container.querySelector('span.cx-chip')).not.toBeNull();
  });

  it('becomes a button when it can be pressed', () => {
    const onPress = vi.fn();
    render(() => <Chip onPress={onPress}>Cloud</Chip>);

    fireEvent.click(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledOnce();
  });

  it('adds a trailing chevron for a picker', () => {
    const { container } = render(() => (
      <Chip picker onPress={() => undefined}>
        Sonnet 4.6 · High
      </Chip>
    ));
    expect(container.querySelectorAll('svg')).toHaveLength(1);
  });

  it('keeps a dismiss press from also triggering the chip', () => {
    // Both targets overlap, so without stopPropagation removing an attachment would also
    // open its picker.
    const onPress = vi.fn();
    const onDismiss = vi.fn();
    render(() => (
      <Chip onPress={onPress} onDismiss={onDismiss} dismissLabel="Remove DEPLOY_TOKEN">
        DEPLOY_TOKEN
      </Chip>
    ));

    fireEvent.click(screen.getByRole('button', { name: 'Remove DEPLOY_TOKEN' }));

    expect(onDismiss).toHaveBeenCalledOnce();
    expect(onPress).not.toHaveBeenCalled();
  });

  it('does not fire when disabled', () => {
    const onPress = vi.fn();
    render(() => (
      <Chip onPress={onPress} disabled>
        Cloud
      </Chip>
    ));

    fireEvent.click(screen.getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('carries the mono and outlined modifiers', () => {
    const { container } = render(() => (
      <Chip variant="outlined" mono>
        STRIPE_KEY
      </Chip>
    ));
    const chip = container.querySelector('.cx-chip')!;

    expect(chip).toHaveClass('cx-chip--outlined');
    expect(chip).toHaveClass('cx-chip--mono');
  });
});

describe('NavItem', () => {
  it('marks the active destination as the current page', () => {
    render(() => <NavItem icon="sessions" label="Sessions" active />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-current', 'page');
  });

  it('leaves aria-current off the inactive rows', () => {
    render(() => <NavItem icon="home" label="Home" />);
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-current');
  });

  it('always reserves the indicator slot', () => {
    // Collapsing it when empty would let the label reflow between rows and break the
    // vertical lane the sidebar reads along.
    const withDot = render(() => <NavItem icon="review" label="Review" unread />);
    expect(withDot.container.querySelector('.cx-nav-item__indicator')).not.toBeNull();
    withDot.unmount();

    const withoutDot = render(() => <NavItem icon="review" label="Review" />);
    expect(withoutDot.container.querySelector('.cx-nav-item__indicator')).not.toBeNull();
  });

  it('announces the unread dot and hides the empty slot', () => {
    const withDot = render(() => <NavItem icon="review" label="Review" unread />);
    const dot = withDot.container.querySelector('.cx-nav-item__indicator')!;
    expect(dot).toHaveClass('cx-nav-item__indicator--unread');
    expect(dot).toHaveAttribute('aria-label', 'Unread activity');
    withDot.unmount();

    const withoutDot = render(() => <NavItem icon="review" label="Review" />);
    expect(withoutDot.container.querySelector('.cx-nav-item__indicator')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });

  it('explains why a locked destination is unavailable', () => {
    // A row the plan does not include still advertises what signing in adds, so refusing
    // silently would be worse than not showing it at all.
    render(() => <NavItem icon="usage" label="Usage" lockedReason="Sign in to see usage" />);
    const button = screen.getByRole('button');

    // `aria-disabled`, deliberately not `disabled`. A disabled button is skipped by tab order
    // and suppresses its own tooltip, so the explanation was unreachable for keyboard and
    // screen-reader users — the very people who cannot see that the row is dimmed.
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute('title', 'Sign in to see usage');
  });

  it('keeps a locked destination reachable and out of its own label', () => {
    render(() => <NavItem icon="usage" label="Usage" lockedReason="Sign in to see usage" />);
    const button = screen.getByRole('button');

    // Focusable, so the reason can actually be reached.
    button.focus();
    expect(document.activeElement).toBe(button);

    // The reason lives in `title`, not inside the button: a hidden span there would make the
    // row read as "UsageSign in to see usage" to anything walking the DOM, and would join the
    // accessible name.
    expect(button.textContent?.trim()).toBe('Usage');
    expect(screen.getByRole('button', { name: 'Usage' })).toBe(button);
  });

  it('does not fire when locked', () => {
    const onClick = vi.fn();
    render(() => (
      <NavItem icon="usage" label="Usage" lockedReason="Sign in to see usage" onClick={onClick} />
    ));

    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('fires when unlocked', () => {
    const onClick = vi.fn();
    render(() => <NavItem icon="home" label="Home" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe('TextField', () => {
  it('ties the label to the control without the caller threading an id', () => {
    // Every field in this design has a visible label; requiring a manual id would
    // eventually produce one that points at nothing.
    render(() => <TextField label="Secret name" />);
    expect(screen.getByLabelText('Secret name')).toBeInTheDocument();
  });

  it('gives two fields on one screen distinct ids', () => {
    const { container } = render(() => (
      <>
        <TextField label="Base branch" />
        <TextField label="Branch prefix" />
      </>
    ));

    const ids = [...container.querySelectorAll('input')].map((input) => input.id);
    expect(new Set(ids).size).toBe(2);
  });

  it('describes the control with its hint', () => {
    render(() => <TextField label="Secret name" hint="Reference it with $NAME" />);
    const input = screen.getByLabelText('Secret name');

    expect(input).toHaveAttribute('aria-describedby');
    expect(screen.getByText('Reference it with $NAME')).toBeInTheDocument();
  });

  it('replaces the hint with the error and marks the control invalid', () => {
    render(() => <TextField label="Secret name" hint="Optional" error="Name already in use" />);

    expect(screen.getByLabelText('Secret name')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Name already in use')).toBeInTheDocument();
    expect(screen.queryByText('Optional')).toBeNull();
  });

  it('leaves aria-invalid off a valid control', () => {
    render(() => <TextField label="Secret name" />);
    expect(screen.getByLabelText('Secret name')).not.toHaveAttribute('aria-invalid');
  });

  it('sets the value in mono by default and in sans on request', () => {
    const mono = render(() => <TextField label="Key" />);
    expect(mono.container.querySelector('input')).not.toHaveClass('cx-field__input--prose');
    mono.unmount();

    const prose = render(() => <TextField label="Title" prose />);
    expect(prose.container.querySelector('input')).toHaveClass('cx-field__input--prose');
  });

  it('reports typing to the caller', () => {
    const onInput = vi.fn();
    render(() => <TextField label="Secret name" onInput={onInput} />);

    fireEvent.input(screen.getByLabelText('Secret name'), { target: { value: 'STRIPE_KEY' } });
    expect(onInput).toHaveBeenCalled();
  });
});
