# Commonplace — static PWA version

This is the GitHub Pages / installable-app version of your annotation
browser. It's a static site (no server needed) that reads from
`data.json`, and it works offline once installed.

## One-time setup

1. Create a new GitHub repository (public — GitHub Pages on a free
   account only publishes public content).
2. Copy everything in this `site/` folder into the repo root (or into a
   `docs/` folder — either works, you just pick the matching option in
   step 3).
3. In the repo on GitHub: **Settings → Pages** → under "Build and
   deployment", set Source to "Deploy from a branch", pick your branch
   and the folder you used (`/ (root)` or `/docs`).
4. GitHub gives you a URL like `https://yourname.github.io/reponame/`.
   Open it — that's your site.
5. On your phone, open that URL in Chrome (Android) or Safari (iOS) and
   use "Add to Home Screen" — it installs like an app, works offline,
   and shows your own icon.

## Getting your data onto the site

The site reads from `data.json`, which isn't included here since it's
your personal data. Generate it from the same `annotations.db` you
already use with the local Flask version:

```
python export_json.py annotations.db site/data.json
```

Put that `data.json` file in the same folder as `index.html`, then push
it to your GitHub repo. The site updates automatically within about a
minute of the push.

## Updating later

Whenever you export more annotations from Moon Reader:

1. `python parser.py <your export folder> -o annotations.db` (same as
   always — this rebuilds the full database from all your exports).
2. `python export_json.py annotations.db site/data.json`
3. Push the updated `data.json` to GitHub (`git add`, `git commit`,
   `git push`, or just drag-and-drop the file into the repo on
   github.com).

That's the whole update cycle — no rebuild step, no app store review.

## Notes

- Dictionary lookups happen directly from your browser now (no server to
  proxy them), and are cached in your browser's local storage instead of
  a database — so they're per-device rather than shared, but still avoid
  repeat lookups.
- This site is public if hosted on a free GitHub account. Don't publish
  it if you'd rather keep your collection private — the local Flask
  version stays available for that.
