/**
 * Update Notification Component
 * Displays notifications for app updates
 */

import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Progress } from './ui/progress';

// Reuse the preload's payload types instead of redeclaring them: the local
// `releaseNotes?: string` was narrower than what electron-updater sends.
import type {
  UpdateInfo,
  UpdateDownloadProgress as DownloadProgress,
} from '../../../preload/src/index';

type UpdateState = 
  | { type: 'idle' }
  | { type: 'checking' }
  | { type: 'available'; info: UpdateInfo }
  | { type: 'downloading'; progress: DownloadProgress }
  | { type: 'downloaded'; info: UpdateInfo }
  | { type: 'error'; message: string };

export function UpdateNotification() {
  const [updateState, setUpdateState] = useState<UpdateState>({ type: 'idle' });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Each `on*` helper returns its own unsubscribe function.
    const unsubscribers = [
      window.cortex.update.onChecking(() => {
        setUpdateState({ type: 'checking' });
        setDismissed(false);
      }),
      window.cortex.update.onAvailable((info) => {
        setUpdateState({ type: 'available', info });
        setDismissed(false);
      }),
      window.cortex.update.onNotAvailable(() => {
        setUpdateState({ type: 'idle' });
      }),
      window.cortex.update.onDownloadProgress((progress) => {
        setUpdateState({ type: 'downloading', progress });
      }),
      window.cortex.update.onDownloaded((info) => {
        setUpdateState({ type: 'downloaded', info });
        setDismissed(false);
      }),
      window.cortex.update.onError((error) => {
        setUpdateState({ type: 'error', message: error.message });
      }),
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  const handleCheckForUpdates = async () => {
    await window.cortex.update.check();
  };

  const handleDownload = async () => {
    await window.cortex.update.download();
  };

  const handleInstall = () => {
    void window.cortex.update.install();
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatSpeed = (bytesPerSecond: number): string => {
    return `${formatBytes(bytesPerSecond)}/s`;
  };

  // Don't show if dismissed or idle
  if (dismissed || updateState.type === 'idle') {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md">
      <div className="rounded-lg border border-border bg-background/95 backdrop-blur shadow-lg">
        <div className="p-4">
          {updateState.type === 'checking' && (
            <div className="flex items-center gap-3">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-sm text-muted-foreground">Checking for updates...</span>
            </div>
          )}

          {updateState.type === 'available' && (
            <div className="space-y-3">
              <div>
                <h4 className="font-medium">Update Available</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Version {updateState.info.version} is available
                </p>
                {updateState.info.releaseName && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {updateState.info.releaseName}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleDownload}>
                  Download
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => setDismissed(true)}
                >
                  Later
                </Button>
              </div>
            </div>
          )}

          {updateState.type === 'downloading' && (
            <div className="space-y-3">
              <div>
                <h4 className="font-medium">Downloading Update</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  {updateState.progress.percent}% complete
                </p>
              </div>
              <Progress value={updateState.progress.percent} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{formatBytes(updateState.progress.transferred)} / {formatBytes(updateState.progress.total)}</span>
                <span>{formatSpeed(updateState.progress.bytesPerSecond)}</span>
              </div>
            </div>
          )}

          {updateState.type === 'downloaded' && (
            <div className="space-y-3">
              <div>
                <h4 className="font-medium">Update Ready</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Version {updateState.info.version} has been downloaded
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleInstall}>
                  Restart & Install
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => setDismissed(true)}
                >
                  Later
                </Button>
              </div>
            </div>
          )}

          {updateState.type === 'error' && (
            <div className="space-y-3">
              <div>
                <h4 className="font-medium text-destructive">Update Error</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  {updateState.message}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleCheckForUpdates}>
                  Retry
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => setDismissed(true)}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
