# Cortex IDE - Build & Release Guide

## Prerequisites

### All Platforms
- Bun (latest version)
- Git

### macOS
- Xcode Command Line Tools
- Apple Developer account for code signing
- Environment variables:
  - `CSC_LINK`: Path to your .p12 certificate
  - `CSC_KEY_PASSWORD`: Certificate password
  - `APPLE_ID`: Your Apple ID
  - `APPLE_APP_SPECIFIC_PASSWORD`: App-specific password
  - `APPLE_TEAM_ID`: Your team ID

### Windows
- Visual Studio Build Tools
- Optional: Code signing certificate
  - `CSC_LINK`: Path to your .pfx certificate
  - `CSC_KEY_PASSWORD`: Certificate password

### Linux
- Standard build tools (gcc, make)
- RPM build tools (for .rpm packages)

## Development Build

```bash
# Install dependencies
bun install

# Build all packages
bun run build

# Start development server
bun run dev
```

## Production Build

### Build for current platform
```bash
bun run dist
```

### Build for specific platform
```bash
# macOS (dmg + zip)
bun run dist:mac

# Windows (nsis installer + portable)
bun run dist:win

# Linux (AppImage + deb)
bun run dist:linux
```

Output files will be in the `dist/` directory.

## Code Signing

### macOS

1. Export your Developer ID Application certificate as .p12
2. Set environment variables:
   ```bash
   export CSC_LINK="/path/to/certificate.p12"
   export CSC_KEY_PASSWORD="your-password"
   ```

3. For notarization (required for distribution):
   ```bash
   export APPLE_ID="your@email.com"
   export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
   export APPLE_TEAM_ID="XXXXXXXXXX"
   ```

4. Uncomment the `afterSign` line in `electron-builder.yml`

### Windows

1. Obtain a code signing certificate (.pfx)
2. Set environment variables:
   ```bash
   set CSC_LINK=C:\path\to\certificate.pfx
   set CSC_KEY_PASSWORD=your-password
   ```

## Auto-Update Setup

### 1. Configure Release Server

Update the `publish.url` in `electron-builder.yml`:

```yaml
publish:
  provider: generic
  url: https://your-release-server.com/
  channel: latest
```

### 2. Release Structure

Your release server should host these files:

```
releases/
├── latest-mac.yml          # macOS update metadata
├── latest-linux.yml        # Linux update metadata
├── latest.yml              # Windows update metadata
├── Cortex-IDE-1.0.0.dmg
├── Cortex-IDE-1.0.0-mac.zip
├── Cortex-IDE-Setup-1.0.0.exe
├── Cortex-IDE-1.0.0.AppImage
└── cortex-ide_1.0.0_amd64.deb
```

### 3. Publishing a Release

1. Update version in `package.json`
2. Build for all platforms:
   ```bash
   bun run dist:mac
   bun run dist:win
   bun run dist:linux
   ```
3. Upload all files from `dist/` to your release server

## CI/CD with GitHub Actions

### Setup Secrets

Add these secrets to your GitHub repository:

```
MACOS_CERTIFICATE          # Base64 encoded .p12
MACOS_CERTIFICATE_PASSWORD
APPLE_ID
APPLE_APP_SPECIFIC_PASSWORD
APPLE_TEAM_ID
WINDOWS_CERTIFICATE        # Base64 encoded .pfx (optional)
WINDOWS_CERTIFICATE_PASSWORD
```

### Create Release

1. Push a version tag:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. GitHub Actions will:
   - Build for macOS, Windows, and Linux
   - Sign and notarize (if configured)
   - Create a GitHub Release
   - Upload all artifacts

## Testing Updates Locally

1. Start a local HTTP server:
   ```bash
   cd dist
   python -m http.server 8080
   ```

2. Update `electron-builder.yml`:
   ```yaml
   publish:
     provider: generic
     url: http://localhost:8080/
   ```

3. Build and test the update mechanism

## Troubleshooting

### macOS Notarization Fails
- Verify your Apple ID credentials
- Check that your app is properly signed
- Review logs: `xcrun notarytool log <submission-id>`

### Windows Installer Not Launching
- Ensure you're using the correct certificate
- Check Windows Defender didn't block the file
- Try the portable version

### Linux AppImage Won't Run
- Make the file executable: `chmod +x Cortex-IDE-*.AppImage`
- Install FUSE: `sudo apt install libfuse2`

### Auto-Update Not Working
- Check network connectivity to release server
- Verify release server CORS settings
- Check console logs for errors
- Ensure version numbers are properly incremented

## Version Management

Update version in these files:
- `package.json` (root)
- Git tag (e.g., `v1.0.0`)

Version format: `MAJOR.MINOR.PATCH`
- MAJOR: Breaking changes
- MINOR: New features, backwards compatible
- PATCH: Bug fixes

## Release Checklist

- [ ] Update version in `package.json`
- [ ] Update CHANGELOG.md
- [ ] Run tests
- [ ] Build for all platforms
- [ ] Test each platform build
- [ ] Sign and notarize (macOS)
- [ ] Upload to release server
- [ ] Create Git tag
- [ ] Push tag to trigger CI/CD
- [ ] Verify auto-update works
- [ ] Announce release
