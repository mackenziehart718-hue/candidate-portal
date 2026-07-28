# Interview Prep Guide — Upload Guide

## Why `index.html` breaks in Box preview

Box does **not** host multi-file websites. When you upload only `index.html`, Box preview cannot load:

- `css/site.css` (styles)
- `locations/*.html` (location pages)
- Google Fonts via a separate CSS `@import` in some preview modes

Result: unstyled page, broken layout, dead links.

## What to upload to Box

| File | Use case |
|------|----------|
| **`index-for-box.html`** | Single self-contained hub page — **use this for Box preview** |
| **`redwood-city-for-box.html`** | Self-contained Redwood City location page — **Box preview** |
| **`interview-prep-guide-full.zip`** | Archive of the full site for your team (unzip to edit, or store as source) |
| **Full folder** (drag into Box) | Store all files together — still won't preview as one website |

## For candidates (live link)

Use **Netlify Drop**: upload the whole `interview-prep-guide` folder → get a public URL → paste in Greenhouse.

Box = storage + internal sharing. Netlify = candidate-facing live site.

## Box preview tips

1. Upload **`index-for-box.html`** (not `index.html`)
2. Open preview in **rendered** mode (document icon), not raw HTML (`</>`)
3. Location cards won't navigate in Box preview — that's expected
4. For a polished candidate URL, use Netlify
