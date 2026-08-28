import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  NotificationMock,
  notificationInstances,
  registeredHandlers,
  resetElectronMock,
} from '../../../../../../test/electron-mock';
import { registerNotifyHandlers, unregisterNotifyHandlers } from '../notify-handlers';

beforeEach(() => {
  resetElectronMock();
  registerNotifyHandlers();
});

afterEach(() => {
  unregisterNotifyHandlers();
});

describe('notify handlers', () => {
  it('registers and unregisters the channel', () => {
    expect(registeredHandlers.has('notify:show')).toBe(true);
    unregisterNotifyHandlers();
    expect(registeredHandlers.has('notify:show')).toBe(false);
    registerNotifyHandlers();
  });

  it('skips the banner when notifications are unsupported', async () => {
    NotificationMock.isSupported.mockReturnValue(false);
    const handler = registeredHandlers.get('notify:show');
    const response = await handler?.({}, { title: 'Done', body: 'ok' });
    expect(response).toEqual({ success: true, data: { shown: false } });
    expect(NotificationMock).not.toHaveBeenCalled();
  });

  it('shows a banner when the OS supports it', async () => {
    NotificationMock.isSupported.mockReturnValue(true);
    const handler = registeredHandlers.get('notify:show');
    const response = await handler?.({}, { title: 'Done', body: 'ok' });
    expect(response).toEqual({ success: true, data: { shown: true } });
    expect(NotificationMock).toHaveBeenCalledWith({ title: 'Done', body: 'ok', silent: false });
    expect(notificationInstances[0]?.show).toHaveBeenCalled();
  });
});
