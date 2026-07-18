# Future Updates

Planned features and improvements for mysetup.

---

## AI Mode

- **Generate a setup from the board** — AI reads what's already on the board (scanned items, slot names, sizes, and positions) and suggests or auto-generates an optimized layout — e.g. dual monitors side by side, tower placement, deskmat sizing
- **Fix delete button** — delete setup button needs to be more reliable and easier to tap on profile cards and inside the setup screen header

---

## Affiliate Links for Creators

- **Affiliate links on items** — let creators attach buy links (Amazon, Best Buy, etc.) to products on their setup board
- **Tap to shop** — viewers tap an item on a shared setup and go straight to the creator's affiliate link
- **Creator dashboard** — track clicks and earnings per setup and per item
- **Link auto-matching** — suggest affiliate links when a product is scanned or added, based on product name and category
- **Disclosure labels** — show a clear "affiliate link" badge so viewers know the creator may earn a commission

---

## Price Finding with AI

- **AI price lookup** — when an item is scanned or added, AI finds its current price across retailers (Amazon, Best Buy, Newegg, etc.) from the product name, brand, and category
- **Price on the item card** — show the found price on the gear receipt and the tag/product card, with the source retailer
- **Total setup cost** — sum every item's price to show what a whole setup costs to build
- **Price range & deals** — surface the lowest current price and flag notable discounts
- **Refresh & history** — re-check prices on demand and keep a simple price history per item
- Pairs with affiliate links — the found retailer can become the buy link

---

## Item Catalog

- **Global product catalog** — a shared, browsable library of gear (mice, keyboards, monitors, servers, laptops, consoles, etc.) so users can add items without scanning
- **Search & filter** — find products by name, brand, category, or spec (e.g. 75% keyboards, 240Hz monitors)
- **Add from catalog** — pick a product to drop straight onto the board and into your library, pre-filled with specs and photo
- **Auto-fill on scan** — when a scan matches a catalog entry, prefill the gear receipt (brand, model, specs, cutout photo)
- **Community-built** — items scanned by users feed back into the catalog, growing it over time (deduped, moderated)
- **Canonical specs & images** — one clean record per product with a standard cutout, so boards look consistent
- Ties into Price Finding and Affiliate Links — catalog entries carry pricing and buy links

---

## Widgets

- Home screen widgets — glanceable summaries of your setup (item count, latest scan, setup photo)
- Setup widget — pin a specific setup to your home screen showing the board preview
- Stats widget — show total items tagged, setups created, and recent activity

---

## Setup Types

- **Different setup boards** — each setup type gets its own board slots, layout, and matching categories instead of using the same PC board everywhere
- **Vanity setup** — let users build and share their vanity setups, tagging skincare, fragrance, and accessories
- **Studio setup** — music production rigs with audio interfaces, MIDI controllers, studio monitors, and recording gear

---

## Desks

- **Different desk styles** — let users pick the desk their setup sits on, so the board and AI-generated photo reflect it instead of one generic desk
- **Standing desk** — adjustable-height frame; show it raised or lowered in generated photos
- **L-shaped / corner desk** — extra surface area with a second run of slots for dual-zone setups
- **Gaming desk** — carbon-texture top, RGB edge lighting, headphone hook and cup holder
- **Minimal desk** — small, clean top for compact setups
- **Glass desk** — transparent top with a modern look
- **Wooden / rustic desk** — warm wood grain for cozy or home-office setups
- **Ultrawide / large desk** — wider board layout for multi-monitor and full peripheral spreads
- **Desk picker in the board builder** — choose the desk up front; board slot sizes and the AI revamp prompt adapt to the chosen desk

---

## Features

- Product detail pages — tapping an item opens a full product page with specs, links, and community ratings
- Setup sharing — publish your setup publicly and let others explore it
- Follow & feed — follow other users and see their setups in your home feed
- Comments — leave comments on setups
- Setup templates — starter layouts for common desk configs (minimal, gaming, home office)
- Multiple setup types — support for gaming rig, home office, studio, and more beyond desk setups

---

## Live Monitor Wallpaper — Background Removal

- Server endpoint `/api/remove-bg-video` is built and wired up
- Two approaches ready to switch on:
  1. **ffmpeg crop** — crops the recorded video to the guide box region (90% width, 16:9, centered), giving just the monitor screen with no background removal credits needed. Works best when the user has lined up the guide correctly.
  2. **videobgremover.com SDK** — full AI background removal using `@videobgremover/sdk`. Server code is written, just needs API credits (`VIDEOBGREMOVER_API_KEY` is already in `.env`).
- **Status: shelved.** The client-side live-capture flow has been removed — monitors are now captured as a regular photo like any other product. The pieces are still on disk to revive it:
  - `screens/LivePhotoPreviewScreen.js` — the record → crop → save flow (still exists, no longer routed)
  - `screens/CameraScreen.js` — the `livePhotoMode` two-step capture + monitor alignment guide (dormant; `livePhotoMode` is never passed)
  - `config/setup.js` `updateSetupWallpaper` + server `/api/remove-bg-video` (both intact)
- To re-enable: in `App.js` reinstate the "Live Photo" option in `goToCamera` (pass `livePhotoMode`), route the captured video to `LivePhotoPreviewScreen`, and restore the `MonitorSlot` video rendering + `monitorWallpaper` load in `SetupScreen.js` (see git history for the removed code)

---

## Live Monitor Display

- Live wallpaper slot — let users upload a short video loop (Live Photo or screen recording, capped at 5 seconds) that plays silently in the monitor slot on the board
- Falls back to a static frame if the file is unavailable
- Makes shared setups feel alive — the monitor actually plays your wallpaper or a looping desktop scene
- Requires file URI storage (not base64) and expo-video for playback

---

## Tagging & Photo

- Photo details — let users add notes, title, lighting/context, and other details to setup photos
- Tag labels — show the product name as a small label next to each dot on the photo
- Re-position tags — drag existing dots to move them after placing
- Tag links — tap a tag to go directly to the product page

---

## Items & Scanning

- Barcode scanning — scan product barcodes as an alternative to photo recognition
- Manual add — search and add products manually if scanning fails
- Keyboard switch sounds — let users add or preview sound profiles for keyboard switches
- Item history — view all products you have ever scanned
- Duplicate detection — warn when the same product is scanned twice

---

## Profile

- Profile page — username, avatar, bio, and public setup gallery
- Stats — total items tagged, setups created, likes received
