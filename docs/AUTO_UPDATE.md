# Cortex IDE - Auto-Update Implementation

## Overview

The auto-update system uses `electron-updater` to deliver seamless updates to users across all platforms. Updates are checked automatically on app launch and periodically during runtime.

## Architecture

### Components

1. **UpdateManager** (`packages/main/src/updater.ts`)
   - Handles update lifecycle
   - Configures auto-updater behavior
   - Manages event handlers
   - Provides manual update controls

2. **IPC Handlers** (`packages/main/src/ipc/handlers.ts`)
   - `update:check` - Manual update check
   - `update:download` - Manual download trigger
   - `update:install` - Install and restart

3. **UpdateNotification** (`packages/renderer/src/components/UpdateNotification.tsx`)
   - UI for update notifications
   - Progress tracking
   - User actions (download, install, dismiss)

4. **Preload Script** (`packages/preload/src/index.ts`)
   - Exposes update IPC to renderer
   - Type-safe API

## Update Flow

```
1. App Launch
   ↓
2. UpdateManager.initialize()
   ↓
3. Auto-check (after 3s)
   ↓
4. If update available
   ↓
5. Auto-download (background)
   ↓
6. Notification shown
   ↓
7. User clicks "Install"
   ↓
8. App restarts with new version
```

## Events

### From Main → Renderer

- `update:checking` - Checking for updates
- `update:available` - Update is available
  - `{ version, releaseDate, releaseName, releaseNotes }`
- `update:not-available` - No update available
  - `{ version }`
- `update:download-progress` - Download progress
  - `{ percent, transferred, total, bytesPerSecond }`
- `update:downloaded` - Update downloaded
  - `{ version, releaseDate, releaseName }`
- `update:error` - Error occurred
  - `{ message }`

### From Renderer → Main

- `update:check` - Trigger manual check
- `update:download` - Start download
- `update:install` - Install and restart

## Configuration

### UpdaterConfig

```typescript
interface UpdaterConfig {
  checkOnStart: boolean;        // Check on app launch
  checkInterval: number;         // Interval in ms (default: 4h)
  autoDownload: boolean;         // Auto-download updates
  autoInstallOnAppQuit: boolean; // Install on app quit
}
```

Default configuration:
- Check on start: Yes (after 3s delay)
- Check interval: 4 hours
- Auto-download: Yes
- Auto-install on quit: Yes

## Release Server Setup

### Required Files

For each release, publish these files:

**macOS:**
- `Cortex-IDE-{version}.dmg`
- `Cortex-IDE-{version}-mac.zip`
- `Cortex-IDE-{version}.dmg.blockmap`
- `latest-mac.yml`

**Windows:**
- `Cortex-IDE-Setup-{version}.exe`
- `Cortex-IDE-{version}.exe.blockmap`
- `latest.yml`

**Linux:**
- `Cortex-IDE-{version}.AppImage`
- `cortex-ide_{version}_amd64.deb`
- `latest-linux.yml`

### latest-*.yml Format

These files contain update metadata:

```yaml
version: 1.0.0
releaseDate: '2024-01-15T12:00:00.000Z'
files:
  - url: Cortex-IDE-1.0.0.dmg
    sha512: <hash>
    size: 123456789
path: Cortex-IDE-1.0.0.dmg
sha512: <hash>
```

electron-builder generates these automatically.

## Delta Updates

electron-updater supports delta updates to minimize download size:

- Only changed blocks are downloaded
- Uses `.blockmap` files for comparison
- Significantly reduces bandwidth usage

## Security

### Code Signing (Required for auto-update)

**macOS:**
- Sign with Developer ID Application certificate
- Notarize with Apple
- Required for Gatekeeper

**Windows:**
- Sign with code signing certificate
- Required to avoid SmartScreen warnings

**Linux:**
- No signing required
- AppImage runs directly

### HTTPS

- Release server MUST use HTTPS in production
- HTTP only for local testing

## Testing

### Local Testing

1. Build current version:
   ```bash
   bun run dist
   ```

2. Install and run the app

3. Increment version in `package.json`

4. Build new version:
   ```bash
   bun run dist
   ```

5. Serve the `dist/` folder:
   ```bash
   cd dist
   python -m http.server 8080
   ```

6. Update `electron-builder.yml`:
   ```yaml
   publish:
     provider: generic
     url: http://localhost:8080/
   ```

7. Launch the old version - it should detect and download the update

### Staging Environment

Use different channels for testing:

```yaml
publish:
  provider: generic
  url: https://releases-staging.cortex-ide.com/
  channel: beta
```

## Production Deployment

### Manual Deployment

1. Update version in `package.json`
2. Build for all platforms
3. Upload files to release server
4. Ensure HTTPS and CORS configured

### Automated with GitHub Actions

1. Push version tag:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. GitHub Actions builds and publishes automatically

3. Artifacts uploaded to GitHub Releases

4. Users receive updates automatically

## Monitoring

### Logs

Update logs are written to:
- macOS: `~/Library/Logs/Cortex IDE/`
- Windows: `%USERPROFILE%\AppData\Roaming\Cortex IDE\logs\`
- Linux: `~/.config/Cortex IDE/logs/`

### Metrics to Track

- Update check success rate
- Download success rate
- Installation success rate
- Time to install
- Error types and frequencies

## Troubleshooting

### Updates Not Detected

1. Check release server is accessible
2. Verify version number is incremented
3. Check `latest-*.yml` files are present
4. Ensure HTTPS (production)

### Download Fails

1. Check network connectivity
2. Verify file permissions on server
3. Check CORS settings
4. Ensure sufficient disk space

### Installation Fails

1. Check app has write permissions
2. Verify code signing (macOS/Windows)
3. Check antivirus isn't blocking
4. Review logs for specific errors

### macOS Gatekeeper Issues

- App must be signed AND notarized
- Use `spctl --assess --verbose` to check

### Windows SmartScreen Warnings

- Sign with extended validation (EV) certificate
- Build reputation over time

## Best Practices

1. **Version Numbering**
   - Use semantic versioning (MAJOR.MINOR.PATCH)
   - Always increment for updates to work

2. **Release Notes**
   - Provide clear release notes
   - Highlight breaking changes
   - Include migration guides

3. **Staged Rollout**
   - Test with beta channel first
   - Monitor for issues
   - Gradually roll out to all users

4. **Backwards Compatibility**
   - Maintain database compatibility
   - Handle config migrations
   - Support data format upgrades

5. **Emergency Rollback**
   - Keep previous version available
   - Document rollback procedure
   - Test rollback scenarios

## Future Enhancements

- [ ] Differential updates for faster downloads
- [ ] Update scheduling (install at specific time)
- [ ] Release channels (stable, beta, alpha)
- [ ] Automatic rollback on crash
- [ ] Update analytics dashboard
- [ ] Custom update UI themes
