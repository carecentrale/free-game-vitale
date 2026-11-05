# Firebase Hosting setup (Google Cloud)

Status: prepared, not yet set up. Nothing is deployed to Firebase yet.

## One-time steps (done by the parent)
1. Create a Google Cloud project (for example `adventurers-of-drenerics`). Note the project ID.
2. Create a billing account with a card, and link it to the project. Turn on the pay-as-you-go (Blaze) plan. Set a monthly budget alert (for example $10) so a traffic spike can't run up a large bill.
3. In the Firebase console, add Firebase to that project and open Hosting. Click "Get started" (this creates the site).
4. Create a service account for deploys: in Google Cloud, IAM → Service Accounts → create one with the "Firebase Hosting Admin" role. Create a JSON key for it and keep the file private.
5. In GitHub (repository settings → Secrets and variables → Actions):
   - Secret `FIREBASE_SERVICE_ACCOUNT`: the whole contents of the JSON key file.
   - Variable `FIREBASE_PROJECT_ID`: the project ID from step 1.
6. Add a custom domain in Firebase Hosting (optional), and check the HTTPS certificate is issued.

## What the files do
- `firebase.json`: publishes the `www` folder. Models are cached for a week; HTML is always rechecked, so updates show at once.
- `.github/workflows/firebase-hosting.yml`: runs all tests, then deploys to the live channel. It only runs on `main`, so tests on `dev` don't deploy.

## Before the first deploy
- The public database write access must be locked down (open issue in CLAUDE.md).
- The privacy policy must be published at a public address, and the store form must link to it.
- Check the Firebase terms allow the commercial use planned (ads, purchases).

## Rollback
Firebase keeps previous releases. In the Firebase console, Hosting → Release history → roll back to an earlier release. Record the rollback in docs/VERSIONS.md.
