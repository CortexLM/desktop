import { afterEach, describe, expect, it } from 'vitest';

import { dialogMock } from '../../../../../test/electron-mock';
import {
  FOLDER_PICKER,
  isRemoteRuntime,
  pickLocalFolder,
  requireThisPcFolder,
  THIS_PC_NEEDS_FOLDER,
} from '../session-this-pc';

afterEach(() => {
  dialogMock.showOpenDialog.mockReset();
  dialogMock.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });
});

describe('This PC workspace', () => {
  it('refuses to run against process.cwd when no folder is open', () => {
    expect(() => requireThisPcFolder(undefined)).toThrow(THIS_PC_NEEDS_FOLDER);
    expect(() => requireThisPcFolder('  ')).toThrow(THIS_PC_NEEDS_FOLDER);
  });

  it('binds the agent to the chosen folder path', () => {
    expect(requireThisPcFolder('/Users/ada/src/app')).toBe('/Users/ada/src/app');
    expect(requireThisPcFolder('/tmp/project with trailing space ')).toBe('/tmp/project with trailing space ');
  });

  it('treats Cloud and SSH as remote, never as This PC', () => {
    expect(isRemoteRuntime('local')).toBe(false);
    expect(isRemoteRuntime('cloud')).toBe(true);
    expect(isRemoteRuntime('ssh')).toBe(true);
  });
});

describe('pickLocalFolder', () => {
  it('opens a native directory picker, not a file picker', async () => {
    dialogMock.showOpenDialog.mockResolvedValueOnce({
      canceled: false,
      filePaths: ['/Users/ada/src/app'],
    });
    await expect(pickLocalFolder()).resolves.toBe('/Users/ada/src/app');
    expect(dialogMock.showOpenDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        properties: [...FOLDER_PICKER.properties],
        title: FOLDER_PICKER.title,
      }),
    );
    expect(FOLDER_PICKER.properties).toContain('openDirectory');
    expect(FOLDER_PICKER.properties).not.toContain('openFile');
  });

  it('returns nothing when the user cancels, rather than a fake path', async () => {
    dialogMock.showOpenDialog.mockResolvedValueOnce({ canceled: true, filePaths: [] });
    await expect(pickLocalFolder()).resolves.toBeUndefined();
  });
});
