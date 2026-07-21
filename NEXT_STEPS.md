# Next Steps

Immediate priorities for the next development push.

---

## July 11, 2026

- [ ] Finish onboarding
- [ ] Fix main functionality
- [ ] Look into affiliate links and creator tags
- [ ] Look into getting a product catalog

---

## July 13, 2026

- [ ] Desk-shaped boards — board background/outline shaped like an actual desk, with slots laid out where gear would really sit on one (see Setup Boards below)

---

## July 17, 2026

- [ ] Add photos to a post — let users attach one or more extra photos to a post (beyond the main setup shot), shown in the post detail
- [ ] Item catalog search engine — search a piece of gear and have pre-made catalog items appear to add to the board (Best Buy API to start, seeded with the PCPartPicker dataset; reuse `/api/remove-bg` for clean cutouts). Feeds price finding + affiliate links.
- [ ] AI Revamp — style & background controls — let the user pick the **style** they want the generated image in (e.g. minimal, RGB gaming, cozy, cyberpunk) and choose the exact **background** they want. Support presets (e.g. bedroom, studio, plain wall, neon city), a custom background description, and eventually a reference photo; pass the choice into the revamp prompt while keeping the user's setup and gear intact.

---

## July 18, 2026

- [ ] Tutorial — a first-run, walkthrough that guides new users through the core flow: scan/add gear, arrange the board, tag items on the photo, post to the feed, and try AI Revamp. Skippable, and replayable from settings/profile.
- [ ] Estimated setup value — show approximately how much a user's complete board/setup is worth by totaling the best available price for each placed item. Prefer the user's entered purchase price, fall back to a verified current product price, label the result as an estimate, show the currency and last-updated time, and never invent prices for unmatched products.
- [ ] Item comments — add a comment/community-advice section to each product detail page so users can ask questions, share ownership tips, reply, like helpful comments, and report inappropriate content.

---

## July 19, 2026

- [ ] Redesign other users' profile view — make public profiles match the owner's profile layout and display that user's saved profile picture, banner, username, bio, public items, and public setups. Opening a creator from the feed, search, comments, or a setup should always lead to this same profile screen. Keep private setups and library-only items hidden, and do not show edit controls when viewing someone else's profile.

---

## July 20, 2026

- [ ] Community profile page — build out the profile into a social hub:
  - **Community feedback** — let other users leave feedback/comments on a profile and its setups; surface a feed of recent activity (new comments, likes, mentions) on the profile.
  - **Following & followers** — full follow system: follow/unfollow from any profile, follower and following counts that link to browsable lists, and a "follows you" indicator. Gate private accounts behind a follow request.
  - **Comment history** — a per-user history of the comments they've posted (on items, setups, and other profiles), visible on their profile, with links back to the original context and the ability to edit/delete their own.

---

## Setup Boards

Create unique board layouts for each setup type — each type has different slots that reflect the gear that belongs in that space.

### PC Setup
Already built. Slots: monitor, keyboard, mouse, PC tower, headphones, deskmat.

### Laptop Setup
Slots: laptop, external monitor, mouse, docking station, headphones, deskmat.

### Console Setup
Slots: TV/monitor, console, controller (x2), headset, storage/hard drive.

### Server Setup
Slots: server rack, UPS/power supply, network switch, router, monitors, keyboard.

### Studio Setup
Slots: studio monitors (x2), audio interface, MIDI controller, microphone, headphones, mixer.

### Vanity Setup
Slots: mirror, skincare tray, fragrance display, makeup organizer, lighting, accessories.

### Desk-Shaped Boards
Instead of (or in addition to) the plain rectangular grid, give boards a desk-shaped outline/background — the board itself reads as a desk (surface, legs, maybe a subtle wood/laminate texture) rather than an abstract grid of slots. Slots sit where the gear would actually rest on that desk shape: monitor at the back center, keyboard/mouse toward the front, deskmat under keyboard+mouse, PC tower to the side, etc. Different setup types could get different desk shapes (e.g. L-shaped desk, standing desk, corner desk) as an eventual stretch goal.

---

## Backend

- [ ] Once a Supabase backend is configured, revisit AI Revamp / AI generation image storage — move generated images (and setup photos) to Supabase Storage instead of storing raw base64 in local AsyncStorage. Local storage hits Android's ~2MB SQLite CursorWindow row limit on full-size images (hit this with generation history thumbnails; `updateSetupPhoto`'s "Save to a setup" flow stores full base64 and is likely to hit the same error).

---

## Monetization

- [x] Photo limit is 10 per user for free accounts, 100 for Plus (AI Revamp subscription). Hitting the free cap opens the AI Revamp paywall instead of proceeding with a scan; hitting the Plus cap just shows an alert (no further tier to upsell to).

---

## Notes

- Each board type should have its own slot definitions and category keywords for auto-matching scanned items
- Slot layouts should visually reflect the real-world arrangement of that setup type (e.g. console has TV at top, console below, controllers beside it)
- Board previews on the profile card should adapt to the setup type
