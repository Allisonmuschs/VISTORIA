# Vistoria

A phone-first web app for documenting the condition of a rental apartment when you get the keys
(*vistoria de entrada*), and exporting a dated PDF report with photo hashes.

- Works fully offline after the first load (PWA). No backend, no login, no cloud.
- All data (including photos) stays in your phone's browser storage (IndexedDB).
- UI in English. The PDF is in Brazilian Portuguese with the English label in small text beneath.
- The PDF footer reads *"Documento informativo elaborado pelo locatário"*. The app makes **no claim of legal validity**.

> This is a personal tool, not legal advice. Ask the landlord or agency to review and sign the report on
> the day. A report both sides have signed is worth much more than one only you hold.

---

## 1. Run it locally

You need nothing but Python 3 (already on macOS). From the folder that contains `index.html`:

```bash
python3 -m http.server 8000
```

Open <http://localhost:8000>. `localhost` counts as a secure context, so the service worker, offline
mode and PDF all work.

Opening it from your phone over Wi-Fi (`http://192.168.x.x:8000`) shows the app, but there is **no HTTPS**, so
the service worker (offline) and "Add to Home Screen" will not work. Use real hosting (below) to test on the phone.

## 2. Host it for free over HTTPS (GitHub Pages)

HTTPS is required for offline mode and installing the app.

1. On your personal GitHub, create a repository called **`VISTORIA`** (public; free Pages needs public).
2. In the repo choose **Add file → Upload files** and drag in the **contents** of this folder
   (so `index.html` sits at the repo root, next to `sw.js`, `js/`, `css/`, `vendor/`, `icons/`). Commit.
3. **Settings → Pages → Build and deployment**: Source *Deploy from a branch*, branch `main`, folder `/ (root)`. Save.
4. After about a minute the app is at `https://<your-username>.github.io/VISTORIA/`.

The repository only holds app code. Your inspections and photos never leave your phone, so a public repo is fine.

Alternatives: Cloudflare Pages or Netlify (drag-and-drop a folder; free). Any static host with HTTPS works.

### Updating the app later

Upload the changed files to the repo (same names overwrite). If you change anything under the app, open
`sw.js` and increase `VERSION` (for example `'v7'` to `'v8'`) so phones refresh their offline copy.
The phone picks up the new version the **second** time you open the app. **Settings** shows the cache name
and app version so you can check.

## 3. Install on your iPhone (Chrome)

1. Open the HTTPS address in Chrome **while you have signal**, and use the app for a moment so everything is cached.
2. Share button → **Add to Home Screen** (iOS 16.4+ allows this from Chrome).
3. Launch it from the icon. **Settings** should say *Installed to Home Screen: Yes*. Tap **Request persistent storage**.
4. Test it once in airplane mode before the big day.

Why install it: iOS can clear website storage for sites you have not opened in about a week. A Home Screen app is
exempt, and the backups below make you safe regardless.

## 4. The day you get the keys

**Before**
- Open the app online once, load the demo, try the camera and PDF, then delete the demo.
- Charge the phone. Clear some storage (photos are roughly 250-400 KB each; 100 photos is about 30 MB).
- Create the inspection: label, date, landlord/agency, tenant, number of bedrooms and bathrooms, furnished or not.

**During**
- Walk room by room (next/previous buttons at the bottom of each room). For each item tap **OK**, **Com defeito** or **N/A**.
- For anything wrong: **📷 Photo** on the item, or the red **⚡ Defect** button for photo + note in one tap.
- Take wide shots as well as close-ups. Photograph meters (with the reading), keys and remotes.
- Do the **Medidores** and **Chaves e controles** screens.

**Before you leave the apartment**
1. Open the inspection, tap **Generate PDF report**, then **Save / share** and email or WhatsApp it to the
   landlord/agency (and yourself) *the same day*. An email timestamp from a third party is stronger evidence than anything on your phone.
2. Tap **Export photos + data (ZIP)** and save it to Files or send it to yourself. It holds the full-quality
   photos, which the PDF only embeds as reduced copies.
3. Mention the **report fingerprint** (printed on the cover and on the register page) in the message.
4. If possible, have both parties sign a printed copy.

## 5. Backups

| What | Contains | Use it for |
|---|---|---|
| **ZIP** (Settings → *Back up everything*, or per inspection) | data + every photo + `hashes.txt` + `manifest-*.json` | Real backup; restore on any device; send to someone who wants to verify |
| **JSON** (*Data only*) | answers and photo metadata, **no photo files** | Small safety copy of the checklist only |

**Restore**: Settings → *Restore from ZIP or JSON…* and pick the file. Photos from a ZIP are re-checked against their hashes, and
the app warns if any do not match.

Make a ZIP at the end of the walkthrough, and again before changing phones or clearing browser data.

## 6. How the "tamper-evident" part works (and its limits)

- On capture every photo is resized (max 1600 px, JPEG 0.8), the **capture time is burned into the corner**, and the
  **SHA-256 of the stored file** is computed and saved with the time, size and device-clock metadata.
- **Verify integrity** in the photo viewer recomputes the hash of the stored file and compares it.
- The PDF lists every photo hash and a **report fingerprint**: the SHA-256 of `manifest-*.json` in the ZIP, a canonical
  description of everything recorded. Regenerating the PDF without changing data gives the same fingerprint.
- Anyone with the ZIP can check it on a Mac or Linux:

```bash
shasum -a 256 -c hashes.txt          # every photo should say OK
shasum -a 256 manifest-*.json        # should equal the fingerprint in the PDF
```

Limits, stated plainly:
- The timestamp comes from **your phone's clock**. Anyone can change a phone's clock, so the timestamp is only as trustworthy as you are.
  Hashes show a file was not altered *after* the hash was recorded; they do not prove *when* it was taken.
- The strongest anchor is **sending the PDF (with its fingerprint) to the other party on the day**.
- The PDF embeds reduced copies (about 900 px); the hashes refer to the full stored files in the ZIP.
- None of this is a legal certification.

## 7. Project layout

```
index.html  manifest.webmanifest  sw.js        app shell, PWA manifest, offline cache (bump VERSION on changes)
css/app.css
icons/                                          app icons
vendor/   htm-preact.js  fflate.js  jspdf.umd.min.js     third-party code, copied in so offline works
js/
  app.js          hash router + service worker registration
  db.js           IndexedDB (inspections + photos stores)
  model.js        room types, PT/EN checklist templates, counts
  store.js        load/save hook with debounce
  photos.js       resize, timestamp burn-in, SHA-256, thumbnails, PDF-size copies
  photoui.js      camera button, thumbnails, viewer, integrity check
  hash.js         SHA-256 (Web Crypto, with a pure-JS fallback)
  manifest.js     canonical manifest + report fingerprint
  report.js       PDF builder (jsPDF)
  backup.js       JSON/ZIP export, restore
  seed.js, demophotos.js   demo apartment with ~20 generated photos
  files.js        share sheet / download helper
  components.js   shared UI pieces, two-tap export button
  views/          home, setup, inspection, room, special (keys + meters), settings
```

Third-party libraries (pinned versions): Preact + htm 3.1.1 (UI), fflate 0.8.2 (ZIP), jsPDF 2.5.2 (PDF).

## 8. Troubleshooting

- **Old version after an update**: open the app twice; check *Settings → Offline cache*. If stuck, remove the Home Screen app and re-add it.
- **No share sheet**: the app falls back to a download. In the PDF export you can also use **Open to preview**, then the browser's own share/save.
- **A photo will not save**: the message shows the reason. Very large images can fail on memory-limited phones; take it again.
- **Storage full**: Settings shows usage. Export a ZIP, then free space.
- **Lost everything after not opening the app for weeks**: restore from your ZIP. This is why you export one the same day.
