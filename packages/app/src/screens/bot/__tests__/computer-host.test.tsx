import { fireEvent, render, screen } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';

import { ANONYMOUS_CAPABILITIES, AUTHENTICATED_CAPABILITIES } from '@cortex-ide/cortex-api';

import { computerHostLock, computerHostOptions, defaultComputerKind } from '../computer-host.ts';
import { ComputerHostPicker } from '../computer-host-picker.tsx';

describe('computer hosts', () => {
  it('locks This PC in the browser and Cloud/SSH without an account', () => {
    expect(computerHostLock('local', AUTHENTICATED_CAPABILITIES, 'browser')).toMatch(/desktop app/);
    expect(computerHostLock('cloud', ANONYMOUS_CAPABILITIES, 'electron')).toMatch(/account/);
    expect(computerHostLock('ssh', ANONYMOUS_CAPABILITIES, 'electron')).toMatch(/account/);
    expect(computerHostLock('local', ANONYMOUS_CAPABILITIES, 'electron')).toBeUndefined();
    expect(computerHostLock('cloud', AUTHENTICATED_CAPABILITIES, 'browser')).toBeUndefined();
  });

  it('prefers This PC on desktop and Cloud on the web', () => {
    expect(defaultComputerKind(AUTHENTICATED_CAPABILITIES, 'electron')).toBe('local');
    expect(defaultComputerKind(AUTHENTICATED_CAPABILITIES, 'browser')).toBe('cloud');
    expect(defaultComputerKind(ANONYMOUS_CAPABILITIES, 'browser')).toBeUndefined();
  });

  it('does not select a locked host', () => {
    const onChange = vi.fn();
    const options = computerHostOptions(ANONYMOUS_CAPABILITIES, 'browser');
    render(() => <ComputerHostPicker value="cloud" options={options} onChange={onChange} />);
    expect(screen.getByRole('radio', { name: 'This PC' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Cloud' })).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: 'Cloud' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByText(/Sprite|Finch|Pebble/i)).toBeNull();
  });
});
