# ReefQuest brand kit

Everything needed to show ReefQuest in a document, a slide, a sticker, a dive-shop poster or an app
store. Open `index.html` in a browser to see all of it at once.

ReefQuest is a free, bilingual (Spanish first) 3D experience about the coral reefs of the Bay Islands
of Honduras. The brand should feel like the sea it shows: deep ocean blues, clear type, quiet
confidence. It is a science and education project, not a resort: no tropical clip art and no beige.

## Folder map

| Folder | What is inside |
| --- | --- |
| `logo/svg/` | Every logo as a vector file (use these whenever you can) |
| `logo/png/` | The same logos as transparent PNGs, large enough for print and slides |
| `icon/` | App icon, favicon (SVG, ICO, PNG), Apple touch icon, maskable Android icon, `site.webmanifest` |
| `social/` | Link preview images (1200 × 630) in Spanish and English |
| `tokens.css`, `tokens.json` | Colors, fonts and corner radii as code |
| `index.html` | The visual brand sheet |

## The logo

**The mark:** a branching coral rising from a wave line. It is drawn with round, even strokes, like
the dotted lines in the rest of the site.

**The wordmark:** "ReefQuest" in Inter at weight 650 with tight tracking (−0.03 em), always one word
with a capital R and a capital Q. The letters are outlined in the files, so no font is needed to use
them.

| Layout | Files | Use it for |
| --- | --- | --- |
| Horizontal | `reefquest-horizontal-*` | The default: headers, documents, slides, email signatures |
| Vertical | `reefquest-vertical-*` | Square or tall spaces: posters, stickers, profile pages, title slides |
| Mark | `reefquest-mark-*` | Small spaces and when "ReefQuest" is already written nearby |
| Wordmark | `reefquest-wordmark-*` | Very wide, very short spaces only |
| App icon | `icon/app-icon*` | App stores, home screens, social avatars |

### Color versions

| Suffix | Coral | Wave | Text | Put it on |
| --- | --- | --- | --- | --- |
| `color-on-dark` | white | foam `#bfe0ff` | white | Ocean blue, navy, photos of the sea |
| `color-on-light` | navy `#0b1f3f` | ocean blue `#0a66f0` | navy | White and light backgrounds |
| `white` | white | white | white | One-color printing on dark (screen print, embroidery) |
| `navy` | navy | navy | navy | One-color printing on light |
| `black` | black | black | black | Black-and-white printing, fax, stamps |

### Clear space and size

- Keep clear space around the logo equal to the height of the "R" on every side. Nothing (text,
  edges, other logos) goes inside it.
- Smallest sizes: horizontal 120 px wide on screen (30 mm in print), vertical 72 px (20 mm), mark
  20 px (6 mm). Below 32 px, use the favicon (`icon/favicon.svg`): it has heavier strokes.

### Please don't

- Stretch, squash, rotate or tilt the logo.
- Recolor parts of it outside the versions above (for example, a coral-red coral).
- Add shadows, outlines, glows or gradients to it.
- Put the color versions on busy photos without a calm area behind them.
- Rebuild the wordmark in another font or write it as "Reef Quest" or "REEFQUEST".
- Put the mark inside a different shape. The app icon is the only container.

## Colors

The site's main blue, plus the deep ocean blues that hold the data. Severity colors are reserved for
heat data and never decorate.

| Name | Hex | Use |
| --- | --- | --- |
| Ocean blue | `#0a66f0` | Brand color, primary buttons, links, highlights |
| Blue ink | `#084fc2` | Hover and pressed states, blue text on white |
| Blue soft | `#dce9ff` | Light tints, selected states on white |
| Foam | `#bfe0ff` | The logo's wave, light accents on blue |
| Navy | `#0b1f3f` | Text on white, the logo on light backgrounds |
| Deep | `#061d44` | Page backgrounds, data sections |
| Abyss | `#04132d` | Footer, the darkest backgrounds |
| Hero gradient | `#0c57dc` → `#0941b4` → `#062b84` | The home hero, the app icon, social cards |
| Sky | `#7fb5ff` | Small labels and accents on dark |
| Aqua | `#5fd0d6` | Secondary accent on dark |
| Coral | `#ff8a6e` | Story pins and warm accents, used sparingly |

**Heat alert scale (NOAA Coral Reef Watch)**, only for heat-stress data: no stress `#3a9bb5`, warning
`#f7a51c`, Alert 1 `#ef3b2c`, Alert 2 `#a50f15`, Alert 3 `#d4199a`, Alert 4 `#8b1fc9`,
Alert 5 `#5b1fb0`.

**Glass panels** (cards on the site): near-black navy `rgba(5, 18, 34, 0.64)` with a white hairline
edge at 11% and a soft blur.

## Type

| Font | Role | Where to get it |
| --- | --- | --- |
| **Inter** (variable) | Everything: headlines (bold), text, buttons | [fonts.google.com/specimen/Inter](https://fonts.google.com/specimen/Inter) |
| *Instrument Serif* (italic) | The accent in headlines: one or two words, never a whole paragraph | [fonts.google.com/specimen/Instrument+Serif](https://fonts.google.com/specimen/Instrument+Serif) |
| IBM Plex Mono | Data: coordinates, dates, numbers, small labels in capitals | [fonts.google.com/specimen/IBM+Plex+Mono](https://fonts.google.com/specimen/IBM+Plex+Mono) |

All three are free under the SIL Open Font License.

**The headline style:** bold Inter followed by an italic serif accent, e.g. "Conoce el arrecife *que
rodea nuestras islas.*" On the site, the accent words are marked with `*…*` in the text files.

## Voice

- Spanish first, English second, and both always say the same thing.
- Write for a 12-year-old in Roatán and a visiting diver at the same time: short sentences, plain
  words, one idea at a time.
- Every fact has a source. Say what the data can't tell you (the heat map is a 5 km regional
  satellite signal; the 3D scenes are a model, not a navigation chart).
- Hopeful and honest: the reefs are in trouble and worth knowing; avoid doom and avoid hype.

## Icons and favicons on the website

The site's `public/` folder uses `icon/favicon.svg`, `icon/favicon.ico`, `icon/apple-touch-icon.png`,
`icon/app-icon-192.png`, `icon/app-icon-512.png`, `icon/maskable-icon-512.png` and
`icon/site.webmanifest`. If the logo changes, regenerate this folder and copy those files again.

## Credits

Logo and kit by ReefQuest. Fonts: Inter (Rasmus Andersson), Instrument Serif (Instrument), IBM Plex
Mono (IBM), all SIL Open Font License 1.1.

## Regenerating the kit

Every file here is generated by `source/make-brand.cjs` from the site's mark (`src/ui/Logo.tsx`) and
fonts, so the kit and the site never drift apart. From the repo root:

```bash
npm i --no-save fontkit @resvg/resvg-js
node brand/source/make-brand.cjs .
```

`README.md` and `index.html` are written by hand and are not regenerated. To view the kit, run the
`brand` preview in `.claude/launch.json` (port 4379) or open `index.html` from any local server.
