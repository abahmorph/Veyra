# Veyra — TestFlight Deployment (VANTA)

This document explains how to deploy **Veyra** (the native iOS app in
`VeyraApp/`) to TestFlight using the scripts in `scripts/ios/`.

The pipeline is: **CHECK → TEST → SIGNING GATE → ARCHIVE (signed) → EXPORT IPA →
UPLOAD → REPORT**. Everything up to the signing gate runs with no credentials.
Final signing/distribution is always gated on explicit human authorization.

> No secrets are ever stored in this repository. See "Secrets" below.

---

## Prerequisites

These scripts must run on **macOS with a recent Xcode** (they need `xcodebuild`,
`xcrun`, `plutil`, `agvtool`, `PlistBuddy`).

- macOS with Xcode (e.g. Xcode 16.x)
- Xcode Command Line Tools (`xcode-select --install`)
- An Apple Developer account with your Apple ID added in Xcode
- App Store Connect access to the app

### Project facts (from `Veyra.xcodeproj`)

| Item | Value |
|------|-------|
| Project | `VeyraApp/Veyra.xcodeproj` |
| Scheme | `Veyra` |
| App target | `Veyra` |
| Test target | `VeyraTests` |
| Bundle ID (app) | `com.veyra.app` |
| Bundle ID (tests) | `com.veyra.app.tests` |
| Marketing version | `1.0` |
| Build number | starts at `1` (`CURRENT_PROJECT_VERSION`) |
| Min iOS | `16.0` |
| Signing | `CODE_SIGN_STYLE = Automatic`, no `DEVELOPMENT_TEAM` yet |

---

## Apple Developer / App Store Connect requirements (one-time)

You must do this **once** before the first real deploy:

1. **Xcode account + team**
   - Xcode → Settings → Accounts → add your Apple ID.
   - In the project target *Veyra → Signing & Capabilities*, select your
     **Development Team** and let Xcode automatic signing create the needed
     profiles. This sets `DEVELOPMENT_TEAM` in the project.
2. **Create the app in App Store Connect** if it does not exist yet
   - App Store Connect → *My Apps* → *+* → New App.
   - Bundle ID must be exactly `com.veyra.app` (register it in
     Certificates, Identifiers & Profiles → Identifiers if needed).
3. **App Store Connect API key** (for the CLI upload)
   - App Store Connect → *Users and Access* → *Integrations* → *App Store
     Connect API* → **Generate API Key**.
   - Grant the key **App Manager** (or equivalent) access.
   - Save the `AuthKey_<KEY_ID>.p8` file and note the **Key ID** and
     **Issuer ID**.

### Secrets

Never commit any credential. Secrets are read from the environment or from
`~/.appstoreconnect/` (outside the repo, ignored by git):

| Secret | Where |
|--------|-------|
| App Store Connect private key | `~/.appstoreconnect/private_key.p8` (chmod 600) |
| Key ID | env `ASC_KEY_ID` |
| Issuer ID | env `ASC_ISSUER_ID` |
| Distribution signing | macOS Keychain + Xcode signing (no file in repo) |

The scripts delete/copy the key into `~/.appstoreconnect/AuthKey_<ID>.p8` for
`xcrun altool`. Nothing is uploaded to GitHub.

---

## Environment configuration

All scripts use environment variables with safe defaults; none are required
for the *check/test* path:

```bash
export VANTA_PROJECT_DIR="$PWD/VeyraApp"     # default: repo/VeyraApp
export VANTA_SCHEME="Veyra"                  # default
export VANTA_BUILD_DIR="$PWD/VeyraApp/build" # default

# Only needed for upload:
export ASC_KEY_ID="XXXXXXXXXX"
export ASC_ISSUER_ID="00000000-0000-0000-0000-000000000000"
export ASC_PRIVATE_KEY="$HOME/.appstoreconnect/private_key.p8"
```

---

## 1. Environment check

```bash
./scripts/ios/check_environment.sh
```

Verifies macOS, Xcode, `xcodebuild`, project, scheme, bundle id, signing
configuration, and App Store Connect configuration. Exits `0` when READY and
`1` with an actionable summary when action is required. It never prints
credentials.

## 2. Build + test

```bash
./scripts/ios/test.sh
```

Builds the `Veyra` scheme for an auto-detected installed simulator and runs
the unit test suite (`VeyraTests`). Stops immediately (`TEST FAILURE`) if any
test fails. The destination is discovered automatically; set `VANTA_SIMULATOR`
to force one (e.g. `VANTA_SIMULATOR='name=iPhone 16 Pro,OS=18.5'`).

## 3. Archive

```bash
./scripts/ios/archive.sh
```

Creates an unsigned archive at `VeyraApp/build/Veyra.xcarchive` (CI/local
check). Real signing is enabled automatically by `deploy.sh` after the gate.

> `VeyraApp/build/`, `*.xcarchive`, `*.ipa` are git-ignored.

## 4. Signing authorization gate

`deploy.sh` stops **before** creating the signed archive and asks:

```
Signing authorization detected (team=TEAMID).
Continue with signing and distribution?
[Y]es / [N]o
```

- If no `DEVELOPMENT_TEAM` is configured it prints
  `🔐 SIGNING AUTHORIZATION REQUIRED` and stops without touching credentials.
- For trusted non-interactive automation you may export `VANTA_SIGN=yes`, but
  the safest default is the interactive gate.

## 5. Export IPA

```bash
./scripts/ios/export.sh
```

Generates `VeyraApp/build/ExportOptions.plist` (`method=app-store`) if none
exists (existing files are reused, never overwritten) and exports
`VeyraApp/build/Veyra.ipa`.

## 6. Upload to App Store Connect

```bash
./scripts/ios/upload_testflight.sh
```

Uploads `Veyra.ipa` via `xcrun altool --upload-app -t ios` using the App Store
Connect API key. Reports `UPLOAD COMPLETE — APPLE PROCESSING PENDING`. It does
**not** claim the build is already in TestFlight — Apple must finish processing
first (check App Store Connect → TestFlight → this build, which will show
*missing metadata* then *Ready to Test*).

## 7. One-command deploy

```bash
./scripts/ios/deploy.sh
```

Runs check → test → signing gate → archive (signed) → export → upload.

## 8. Bump build number (optional, safe)

```bash
./scripts/ios/bump_build_number.sh            # show current + next (no change)
./scripts/ios/bump_build_number.sh --commit   # increment by exactly 1
```

Never decreases and never changes the marketing version (`1.0`). To bump the
marketing version, change `MARKETING_VERSION` in the target build settings in
Xcode.

---

## Common errors

### `PROVISIONING PROFILE DOES NOT MATCH BUNDLE IDENTIFIER`
The distribution profile doesn't cover `com.veyra.app`. Fix the team/profile in
Xcode (Signing & Capabilities) for the **Release** configuration, and ensure the
app + bundle id exist in App Store Connect.

### `UPLOAD FAILURE` / altool auth error
The API key lacks `App Manager` permission, the `.p8` is missing/misplaced, or
`ASC_KEY_ID`/`ASC_ISSUER_ID` are unset. Check `VeyraApp/build/upload.log`.

### `TEST FAILURE`
A unit test failed. Inspect `VeyraApp/build/test.log`.

### `BUILD FAILURE`
A source compile error. Inspect `VeyraApp/build/build.log`.

### `ARCHIVE FAILURE` / `EXPORT FAILURE`
Signing/provisioning misconfiguration for Release. See
`VeyraApp/build/archive.log` or `export.log`.

---

## Vanta command interface

Once the one-time setup above is complete:

```
Vanta, deploy Veyra to TestFlight.   -> ./scripts/ios/deploy.sh
Build Veyra                          -> ./scripts/ios/archive.sh
Test Veyra                           -> ./scripts/ios/test.sh
Archive Veyra                        -> ./scripts/ios/archive.sh
Check TestFlight deployment          -> watch App Store Connect TestFlight status
```

The signing gate means the AI will never sign/distribute without your explicit
approval.
