import { createSignal } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';

import { Composer, type ComposerControl } from '../composer.tsx';

/**
 * Renders a controlled composer so typing behaves as it does in the app.
 *
 * The three controlled props are pulled out of `overrides` before the spread. Left in, the
 * spread would land after `value={value()}` and replace the reactive accessor with the
 * static seed, so the field would never update.
 */
function renderComposer(overrides: Partial<Parameters<typeof Composer>[0]> = {}) {
  const { value: seed, onValueChange, onSubmit: submitOverride, ...rest } = overrides;

  const [value, setValue] = createSignal(seed ?? '');
  const fallbackSubmit = vi.fn();
  const onSubmit = submitOverride ?? fallbackSubmit;

  const result = render(() => (
    <Composer
      value={value()}
      onValueChange={(next) => {
        setValue(next);
        onValueChange?.(next);
      }}
      onSubmit={onSubmit}
      {...rest}
    />
  ));

  return { ...result, onSubmit, value, setValue };
}

describe('Composer submission', () => {
  it('sends on Enter', () => {
    const { onSubmit } = renderComposer({ value: 'Fix the flaky auth tests' });
    fireEvent.keyDown(screen.getByLabelText('Prompt'), { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('inserts a newline on Shift+Enter instead of sending', () => {
    // The textarea default is the reverse; every chat surface has trained the opposite.
    const { onSubmit } = renderComposer({ value: 'line one' });
    fireEvent.keyDown(screen.getByLabelText('Prompt'), { key: 'Enter', shiftKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('refuses to send an empty prompt', () => {
    // Sending nothing would start a session with no instruction.
    const { onSubmit } = renderComposer({ value: '' });
    fireEvent.keyDown(screen.getByLabelText('Prompt'), { key: 'Enter' });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('refuses to send whitespace', () => {
    const { onSubmit } = renderComposer({ value: '   \n  ' });
    fireEvent.keyDown(screen.getByLabelText('Prompt'), { key: 'Enter' });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('disables the send button until there is something to send', () => {
    const { setValue } = renderComposer({ value: '' });
    const send = screen.getByRole('button', { name: 'Start session' });

    expect(send).toBeDisabled();
    setValue('Do the thing');
    expect(send).not.toBeDisabled();
  });

  it('sends when the send button is pressed', () => {
    const { onSubmit } = renderComposer({ value: 'Do the thing' });
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('does not send while disabled, even with a prompt', () => {
    const { onSubmit } = renderComposer({ value: 'Do the thing', disabled: true });
    fireEvent.keyDown(screen.getByLabelText('Prompt'), { key: 'Enter' });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not reload the page on native form submit', () => {
    // The composer is a real form so Enter works natively; the default action has to be
    // suppressed or Electron navigates away from the app.
    const { container, onSubmit } = renderComposer({ value: 'Do the thing' });
    const submitted = fireEvent.submit(container.querySelector('form')!);

    expect(submitted).toBe(false);
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('lets a caller name the send action', () => {
    renderComposer({ value: 'x', sendLabel: 'Send follow-up' });
    expect(screen.getByRole('button', { name: 'Send follow-up' })).toBeInTheDocument();
  });
});

describe('Composer prompt', () => {
  it('reports typing to the caller', () => {
    const { value } = renderComposer();
    fireEvent.input(screen.getByLabelText('Prompt'), { target: { value: 'hello' } });
    expect(value()).toBe('hello');
  });

  it('shows the placeholder the caller supplies', () => {
    renderComposer({ placeholder: 'Ask a follow-up or adjust the plan…' });
    expect(screen.getByPlaceholderText('Ask a follow-up or adjust the plan…')).toBeInTheDocument();
  });

  it('renders the repo mention ahead of the prompt', () => {
    const { container } = renderComposer({ mention: 'backend-api' });
    expect(container.querySelector('.cx-composer__mention')).toHaveTextContent('@backend-api');
  });

  it('omits the mention when no repo is bound', () => {
    const { container } = renderComposer();
    expect(container.querySelector('.cx-composer__mention')).toBeNull();
  });

  it('describes the prompt with the reason it cannot submit', () => {
    // A disabled composer that says nothing looks broken; the Limits screens rely on this.
    renderComposer({ disabled: true, disabledReason: 'Monthly limit reached' });
    const prompt = screen.getByLabelText('Prompt');

    expect(prompt).toHaveAttribute('aria-describedby', 'composer-disabled-reason');
    expect(screen.getByText('Monthly limit reached')).toBeInTheDocument();
  });
});

describe('Composer attachments', () => {
  it('omits the attachment row entirely when there is nothing attached', () => {
    // An empty row would still consume the 12px column gap the design only draws when
    // there is content.
    const { container } = renderComposer();
    expect(container.querySelector('.cx-composer__attachments')).toBeNull();
  });

  it('renders each attachment as an outlined chip', () => {
    const { container } = renderComposer({
      attachments: [
        { id: 'a', label: 'DEPLOY_TOKEN', mono: true },
        { id: 'b', label: 'spec.md' },
      ],
    });

    const chips = container.querySelectorAll('.cx-composer__attachments .cx-chip');
    expect(chips).toHaveLength(2);
    expect(chips[0]).toHaveClass('cx-chip--mono');
    expect(chips[1]).not.toHaveClass('cx-chip--mono');
  });

  it('reports a removal with the attachment id', () => {
    const onRemoveAttachment = vi.fn();
    renderComposer({
      attachments: [{ id: 'token-1', label: 'DEPLOY_TOKEN' }],
      onRemoveAttachment,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Remove DEPLOY_TOKEN' }));
    expect(onRemoveAttachment).toHaveBeenCalledWith('token-1');
  });

  it('omits the dismiss control when removal is not offered', () => {
    renderComposer({ attachments: [{ id: 'a', label: 'spec.md' }] });
    expect(screen.queryByRole('button', { name: 'Remove spec.md' })).toBeNull();
  });
});

describe('Composer controls', () => {
  const controls: ComposerControl[] = [
    { id: 'repo', label: 'forge/backend-api', icon: 'repo', onPress: vi.fn(), picker: true },
    { id: 'branch', label: 'main', icon: 'branch', onPress: vi.fn(), picker: true },
    { id: 'model', label: 'Sonnet 4.6 · High', onPress: vi.fn(), picker: true },
  ];

  it('renders each picker in order', () => {
    renderComposer({ controls });

    expect(screen.getByRole('button', { name: /forge\/backend-api/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /main/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sonnet 4.6/ })).toBeInTheDocument();
  });

  it('opens a picker when pressed', () => {
    const onPress = vi.fn();
    renderComposer({ controls: [{ id: 'runtime', label: 'Cloud', onPress, picker: true }] });

    fireEvent.click(screen.getByRole('button', { name: /Cloud/ }));
    expect(onPress).toHaveBeenCalledOnce();
  });

  it('disables every picker when the composer is disabled', () => {
    // A reached limit should not let the user keep reconfiguring a session they cannot start.
    renderComposer({ controls, disabled: true });
    expect(screen.getByRole('button', { name: /main/ })).toBeDisabled();
  });

  it('disables one picker without disabling the rest', () => {
    renderComposer({
      controls: [
        { id: 'repo', label: 'forge/backend-api', onPress: vi.fn(), picker: true },
        { id: 'runtime', label: 'Cloud', onPress: vi.fn(), picker: true, disabled: true },
      ],
    });

    expect(screen.getByRole('button', { name: /forge\/backend-api/ })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /Cloud/ })).toBeDisabled();
  });

  it('shows attach and dictate only when the caller handles them', () => {
    const withActions = renderComposer({ onAttach: vi.fn(), onDictate: vi.fn() });
    expect(screen.getByRole('button', { name: 'Attach' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dictate' })).toBeInTheDocument();
    withActions.unmount();

    renderComposer();
    expect(screen.queryByRole('button', { name: 'Attach' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Dictate' })).toBeNull();
  });

  it('invokes attach and dictate', () => {
    const onAttach = vi.fn();
    const onDictate = vi.fn();
    renderComposer({ onAttach, onDictate });

    fireEvent.click(screen.getByRole('button', { name: 'Attach' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dictate' }));

    expect(onAttach).toHaveBeenCalledOnce();
    expect(onDictate).toHaveBeenCalledOnce();
  });

  it('shows the trailing model picker only when a label is supplied', () => {
    const onPickModel = vi.fn();
    renderComposer({ modelLabel: 'Cortex 2 · Thinking High', onPickModel });

    const picker = screen.getByRole('button', { name: /Cortex 2/ });
    expect(picker).not.toBeDisabled();
    fireEvent.click(picker);
    expect(onPickModel).toHaveBeenCalledOnce();
  });

  it('disables the trailing model picker when there is no handler', () => {
    renderComposer({ modelLabel: 'Cortex 2 · Thinking High' });
    expect(screen.getByRole('button', { name: /Cortex 2/ })).toBeDisabled();
  });
});
