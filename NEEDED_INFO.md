# Needed Info & Launch Checklist

Everything still required to ship mysetup to the App Store, what's already done,
and the info/decisions I need from you. Check items off as you go.

_Last updated: 2026-07-27_

---

## 🌐 Live URLs

- **Website (landing):** https://square-bar-d6c1.mysetupapp.workers.dev/
- **Privacy Policy:** https://square-bar-d6c1.mysetupapp.workers.dev/privacy.html
- **Terms of Use:** https://square-bar-d6c1.mysetupapp.workers.dev/terms.html

> Hosted on Cloudflare (public). Use the **Privacy Policy URL** in App Store Connect.
> When you move to a custom domain (e.g. `mysetup.app`), update these here and in the app.

---

## 🔴 Launch blockers (app will be rejected or broken without these)

### RevenueCat / subscriptions
- [x] **`appl_` SDK key** wired into `app/config/purchases.js`
- [x] Safety net so a bad key can't crash a production build
- [ ] **In-App Purchase Key (`.p8`)** uploaded to RevenueCat (Key ID + Issuer ID) — *in progress*
- [ ] **App Store Connect App-Specific Shared Secret** added in RevenueCat (needed to validate purchases)
- [ ] **Products imported** into RevenueCat (monthly + yearly) and attached to an **Offering**
- [ ] **Entitlement named exactly `MySetup Pro`** with both products attached
- [ ] **3-day free trial** (Introductory Offer) set on each product in App Store Connect — *the paywall advertises this, so it must be real*
- [ ] Confirm your **RevenueCat account email** (dashboard banner)

### App Store Connect
- [ ] **Apple Developer Program** membership active ($99/yr)
- [ ] App record created for bundle ID **`com.mysetup.app`**
- [ ] **Subscriptions created** (monthly + yearly auto-renewable) with the 3-day intro offers
- [ ] **Screenshots** — at least 6.5" iPhone size (capture real app screens)
- [ ] **Privacy Policy URL** entered + **App Privacy** questionnaire filled (collects: email, photos, usage)
- [ ] Age rating + category (Lifestyle or Photo & Video)

### In-app legal (Apple Guideline 3.1.2 — required for subscriptions)
- [ ] **Terms of Use + Privacy Policy links inside the app** — on the paywall and in Settings
      *(not done yet — I can add these using your live URLs)*
- [ ] **Auto-renewal disclosure** text on the paywall *(already added in code)*

### Supabase
- [x] eBay keys set as secrets (`EBAY_CLIENT_ID` / `EBAY_CLIENT_SECRET`) + marketplace-deletion exemption
- [ ] **Push the feedback migration** (`supabase/migrations/0005_feedback.sql`) — the Community Feedback screen errors until this is applied to the remote DB

---

## 🟡 Needed from you (info / decisions)

- [ ] **Governing law** for the Terms of Use — currently set to **Ontario, Canada** (guessed from your amazon.ca account). Confirm or change.
- [ ] **App Store URL** for the website buttons (once the app is live) — buttons currently link to `#` and say "Launching soon"
- [ ] **Custom domain** for the site (e.g. `mysetup.app`) instead of the `workers.dev` URL — recommended (looks more legit to Apple), then update the URLs above + in the app
- [x] Website is live & public on Cloudflare (see Live URLs above)

---

## 🟢 Marketing / accounts

- [ ] **Amazon Associates:** get **3 qualifying sales within 180 days** or the account closes
- [ ] Complete the Amazon Associates **onboarding checklist** (payment + tax info) so you can actually get paid
- [ ] App Store **description, keywords, subtitle, promotional text** (drafts written — see chat history)
- [ ] Consider **eBay Partner Network** so the price/buy links earn commission

---

## 🔵 Before real scale (not launch blockers)

- [ ] **Auth emails:** move from Gmail SMTP to **Resend + a verified domain** before heavy signups (Gmail SMTP is rate-limited and unbranded)
- [ ] **Google Sign-In:** confirm `EXPO_PUBLIC_GOOGLE_*` client IDs are set if that flow is enabled
- [ ] Real, shared **like counts** (currently per-device local) — needs a `post_likes` table + RLS
- [ ] **Social / following** — deferred; see `FUTURE_UPDATES.md`
- [ ] **In-app catalog** (eBay product search) — built but unwired/deferred; see `FUTURE_UPDATES.md`

---

## ✅ Already done

- [x] RevenueCat crash fixed (`appl_` key + safety net)
- [x] Paywalls advertise the 3-day trial (dynamic from the store offer)
- [x] "Unlimited AI" copy corrected to "100 AI revamps a month"
- [x] Settings screen (logout + delete account, edge function deployed)
- [x] Notifications opt-in screen removed (was non-functional)
- [x] Item visibility derived from posts (public/private toggle removed)
- [x] Affiliate "Buy on Amazon" button (tag `mysetupapp0d-20`, amazon.ca)
- [x] eBay price lookup wired + credentials set
- [x] Following removed; follower/following stats cleaned up
- [x] Likes → Collections (per-device), tap heart or press-and-hold
- [x] Gear/search header icons converted to SVG (were emoji on iOS)
- [x] Marketing site + Privacy Policy + Terms of Use (in `website/`, deployed as artifacts)

---

## Build & submit commands

```bash
cd app
eas build --platform ios --profile production
eas submit --platform ios --profile production --latest
```
> EAS builds from git — **commit first** so the build includes the latest changes.
