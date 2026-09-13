# Android, iPhone and Cleared Today widgets

The Capacitor apps bundle the existing React application locally. Supabase remains
the backend. Native projects and the first home-screen widget are included; this
is a development build, not a store release.

## Build the shared app

Use Node.js 22 or newer and install dependencies with `npm ci`.
Keep the existing public Supabase URL and anon key in `.env.local`.
Add `.env.native.local` with the deployed HTTPS origin that serves the existing
account-deletion API:

```dotenv
VITE_NATIVE_API_ORIGIN=https://YOUR-DEPLOYED-SITE
```

Do not put a Supabase service-role key in any `VITE_` variable. The native API
origin has not been configured in the initial debug build; account deletion will
report that account services are unavailable until this value is set and rebuilt.
Ordinary Supabase sign-in and data access use the existing Supabase configuration.

In Supabase Authentication > URL Configuration, add this exact redirect URL:

```text
app.pocketcfo.mobile://auth/callback
```

Native Google sign-in opens the system browser and returns using PKCE. Email
confirmation and password recovery use the same callback. Configure and test the
providers in the actual Supabase project; the repository does not change its
remote allowlist. Web redirects retain their existing behavior.

```sh
npm run native:sync
npm run verify:native
npm run lint
```

`native:sync` builds `dist-native`, copies assets to both native projects and wires
the iOS widget target idempotently. Run it after changing web code or native
plugins. Native builds disable the PWA service worker and install prompts.
`npm run build` continues to produce the web/PWA build in `dist`.

The shared brand source is `resources/icon.svg`. To regenerate native icons and
splash screens, run `npm run native:assets`, then `npm run native:sync`.

## Android

Install Android Studio and Android SDK 36. Use Android Studio's bundled JDK.
`android/local.properties` should point `sdk.dir` at your local SDK; this file is
ignored by Git. Open the project with `npm run native:android`, select a device
or emulator, and Run. For a Windows command-line debug build:

```powershell
$env:JAVA_HOME = 'C:/Program Files/Android/Android Studio/jbr'
.\android\gradlew.bat -p android :app:assembleDebug :app:lintDebug --console=plain
```

On macOS/Linux use `./android/gradlew -p android :app:assembleDebug :app:lintDebug`.
The debug APK is `android/app/build/outputs/apk/debug/app-debug.apk`. Install it
on a connected Android device through Android Studio or `adb install -r`.
Minimum Android version is 7.0 (API 24).

If a managed network intercepts HTTPS and Gradle reports a certificate error,
configure a Java truststore using your organization's trusted CA. Do not disable
TLS verification. This workstation needed a temporary truststore containing its
existing Windows trusted roots; that machine-specific file is not in the repo.

After signing in and finishing onboarding, long-press the phone's home screen,
choose Widgets > Pocket CFO > Cleared Today. The widget is resizable. Its body
opens Home; Log Spend opens the existing spending form after authentication and
screen unlock.

## iPhone / iPad

Building and signing requires a Mac with Xcode 26 or newer. The iOS app and widget
target are prepared on Windows, but cannot be compiled or device-tested here.
On the Mac run `npm ci`, configure the same environment files, then:

```sh
npm run native:sync
npm run native:ios
```

Open `ios/App/App.xcodeproj` if opening manually. Allow Xcode to resolve the
Capacitor Swift Package Manager dependencies. Select a development team for
**both** App and ClearedTodayWidget and register these identifiers with that team:

| Purpose | Identifier |
| --- | --- |
| App (Android application ID and iOS bundle ID) | `app.pocketcfo.mobile` |
| iOS widget extension | `app.pocketcfo.mobile.widget` |
| Shared iOS App Group | `group.app.pocketcfo.mobile` |

Enable the same App Group for both targets in Signing & Capabilities. If these
identifiers are unavailable to your team, update the Capacitor config, native
projects, widget plugin storage names, URL handlers, configuration script, tests
and Supabase redirect allowlist together before release.

Select the App scheme, choose a simulator or connected iPhone, and Run. The
extension is embedded in the app. For an unsigned simulator compilation check:

```sh
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO build
```

Minimum iOS version is 15. After opening the app and completing onboarding, add
Cleared Today from the home-screen widget gallery. Small widgets open Log Spend
when tapped; medium widgets have a separate Log Spend button and Home destination.

## Widget behavior

- Uses the dashboard's daily discretionary spending calculation and current
  Cleared Today limit. Bills, debt payments and vault movements are excluded;
  refunds reduce today's spend. The displayed remaining amount stops at zero.
- Updates from app state changes while the app runs. It stores only formatted
  amount text, privacy flag, schema version and update/expiry timestamps in native
  storage. It does not store account IDs, tokens or transaction details there.
- Privacy mode or an enabled screen lock writes a redacted snapshot. Signing out
  clears the snapshot. Unconfirmed cached data produces no amount.
- Snapshots expire at the next local midnight. iOS has a precomputed expiry entry;
  Android requests an inexact expiry alarm and periodic refresh. The operating
  system controls actual redraw timing and may defer it, including privacy changes.
  The widget displays its update time; it does not promise live background sync.
- Open the app to fetch a fresh amount after expiry. The widget never records a
  purchase without opening the app's existing spending form.

## Device acceptance checks before distribution

1. Sign in with each enabled provider, confirm an email, reset a password, and
   verify callback handling with the app both closed and running.
2. Finish onboarding, add each widget size, log a purchase/refund, and compare the
   widget with the dashboard. Check long currency values and large system text.
3. Turn privacy mode and screen lock on/off, switch accounts, and sign out. Check
   that the widget redacts or clears and spending links respect the lock.
4. Test midnight, time-zone changes, offline launch and reconnect. An expired
   snapshot must request a refresh instead of presenting yesterday's allowance.
5. Configure the API origin, then test account deletion with a disposable account.
6. Exercise file import/export, keyboard, safe areas, back navigation and any
   biometric or notification features on real devices. Native push registration
   and native biometric integration are not part of this setup.

The mobile preview hides web checkout and billing controls; native store purchases
are not implemented. Before a public release, finish applicable store billing and
sign-in requirements (including Sign in with Apple where required), developer
signing, privacy disclosures and store listing assets. The included privacy
manifests declare App Group UserDefaults use; they are not a complete declaration
of the service's data practices. No store upload or external account configuration
has been performed.

References: [Capacitor environment setup](https://capacitorjs.com/docs/getting-started/environment-setup),
[Supabase native redirects](https://supabase.com/docs/guides/auth/native-mobile-deep-linking),
[WidgetKit updates](https://developer.apple.com/documentation/widgetkit/keeping-a-widget-up-to-date),
[Android widgets](https://developer.android.com/develop/ui/views/appwidgets).
