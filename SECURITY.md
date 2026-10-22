# Security

This document records the security controls on the Sankofa Market Firebase
project and the operational steps needed to keep them working. It is excluded
from the Firebase Hosting deploy (`**/*.md` in `firebase.json`).

## App Check

The web app uses **reCAPTCHA Enterprise** as its App Check provider.

| Item | Value |
| --- | --- |
| Firebase app | `1:98342667835:web:f9ca761128eaa0b5c27e1e` |
| App Check provider | reCAPTCHA Enterprise (SCORE), `minValidScore` 0.5 |
| Site key (public) | `6LfagPstAAAAANhFltIMEPyj9hd-qKaW3l249nf4` |
| Allowed domains | `sankofa-market.web.app`, `sankofa-market.firebaseapp.com`, `localhost` |
| Enforcement | `firestore.googleapis.com` **ENFORCED**, `firebasestorage.googleapis.com` **ENFORCED** |
| Auth (`identitytoolkit`) | **not enforced** (deliberate: avoids lockout while clients update) |

The SDK is loaded on every Firebase page (`firebase-app-check-compat.js`) and
activated in `config/firebase-config.js` **before** Auth/Firestore/Storage are
instantiated, so the first request already carries a token.

### Adding a domain (custom domain, preview channel)

A new origin must be added in **both** places or the app will break there:

1. reCAPTCHA Enterprise key → allowed domains
   (`https://recaptchaenterprise.googleapis.com/v1/projects/98342667835/keys/6LfagPstAAAAANhFltIMEPyj9hd-qKaW3l249nf4`)
2. Browser API key → allowed referrers
   (`https://apikeys.googleapis.com/v2/projects/sankofa-market/locations/global/keys/6c6f760a-09b0-4b8d-a42c-9cb28084c716`)

Preview channels use per-channel hosts (`sankofa-market--<channel>-<hash>.web.app`).
Add the specific channel host rather than a wildcard, otherwise any Firebase site
could spend your App Check quota.

### Local development

Debug tokens are **never** shipped to production. On localhost, opt in from the
browser console:

```js
localStorage.setItem('sm_appcheck_debug', '1'); // then reload
```

The printed token must be registered under Firebase Console → App Check → Apps →
Manage debug tokens. Remove it when finished.

## API key restrictions

The browser key (`AIzaSyALwyEU6XYgumx989vgt58QxdQSx0Txghg`) is restricted to:

- `https://sankofa-market.web.app/*`
- `https://sankofa-market.firebaseapp.com/*`
- `http://localhost/*`
- `http://127.0.0.1/*`

Its 27 `apiTargets` are preserved; do not replace the restrictions object without
copying them, or the app loses access to Firebase services. Requests from any
other referrer receive HTTP 403.

## Cloud Functions

The backend is the authoritative deployed source recovered from the
`gcf-sources-98342667835-us-central1` bucket (92 functions, Node 22,
`firebase-admin` 12, `firebase-functions` 5).

`functions/.runtimeconfig.json` contains the **live Paystack secret key**. It is
git-ignored and must never be committed or uploaded to Hosting. Rotate the key
in the Paystack dashboard if it is ever exposed.

## Hosting

- Backend artifacts are not published: rules files, `package*.json`,
  `firestore.indexes.json`, `tests/**`, `esbuild.config.js`, `dist/meta.json`,
  `js/admin-seed.js`, `pages/admin/test-users.html`, `audit.sh` and the legal
  text compilation all return 404 in production.
- A global `Content-Security-Policy` allowlists external script/style/frame/
  connect origins (gstatic, Google reCAPTCHA, Paystack, jsDelivr, Google Fonts).
  `'unsafe-inline'` is still required by 63 inline script blocks and 178 inline
  handlers; removing it (nonces/hashes) is the next hardening step.
- `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.

## Known follow-ups

- Enforce App Check for Identity Toolkit after a monitoring period.
- Remove `'unsafe-inline'` from `script-src` by moving inline handlers to
  delegated listeners and inline blocks to external files.
- Replace the remaining `alert()` calls with in-page toasts.
- Rotate the GitHub personal access token that was exposed during remediation
  and use the SSH key instead.

## Reporting

Report vulnerabilities privately to the maintainer rather than opening a public
issue.
