# Release Guide: Google Play

The GitHub workflow in `.github/workflows/release.yml` builds, signs, and uploads the app. Your part is the one-time setup below. Each release after that is one command.

## Part 1: Things only you can do (about 1–2 hours, plus waiting)

1. **Google Play Console account.** Sign in with your dedicated Google account at play.google.com/console, pay the $25 one-time fee, and verify your identity with government ID. Google may take a few days to approve it.
2. **Choose the app ID.** Pick something unique and permanent, like `com.yourname.kidsgame`. Put it in `capacitor.config.json` (replace `com.example.kidsgame`) and in the GitHub variable `APP_ID`. It can't be changed later.
3. **Create the app** in Play Console (name: "Kids Game" or your choice; free; for kids).
4. **Upload keystore (keep it safe).** Create it once on your computer:
   `keytool -genkey -v -keystore upload.keystore -alias upload -keyalg RSA -keysize 2048 -validity 10000`
   Save the password and alias somewhere safe, like a password manager. Losing this file means you can't update the app.
5. **Service account for automatic uploads.** In Play Console → Setup → API access, create a service account, grant it release permissions, and download its JSON key.
6. **GitHub secrets and variables.** In the repository settings, add the secrets and the `APP_ID` variable listed at the top of `release.yml`. The keystore goes in as base64: `base64 -w0 upload.keystore`.
7. **Store questionnaires (required before release):**
   - Data safety: say the app collects no personal data.
   - Content rating questionnaire.
   - Target audience: children, with the Families policy questions answered.
   - Store listing: short and full description, icon (512×512), feature graphic (1024×500), and at least 2 phone and 2 tablet screenshots.
   - Privacy policy URL: the page from `docs/privacy-policy.md` once it is hosted (GitHub Pages).
8. **Closed test.** New personal developer accounts must have at least 12 testers opted in for 14 days before a production release. Add the testers' Google accounts to the test track and ask them to opt in. This is the longest wait, so start it early.

## Part 2: Releasing (automated)

1. Update `CHANGELOG.md` and the version in `package.json`.
2. Commit and tag:
   `git tag v0.5.0 && git push origin main --tags`
3. GitHub builds the app, signs it, and uploads it to the **internal testing** track in Play Console.
4. When the closed test is done and the questionnaires are complete, promote the release to production from Play Console.

## Important notes

- The first workflow run is a test. The signing step edits Android's build file with `sed`, so check the first run's log. Tell me what fails and I'll fix it.
- The app can't be built on this session's computer (the Android tools are blocked), so the first real build happens on GitHub after the repository is pushed.
- Never commit the keystore, its password, or the service account JSON. `.gitignore` blocks key files, but the GitHub secrets are the safe place.
