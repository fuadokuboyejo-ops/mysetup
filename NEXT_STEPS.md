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
