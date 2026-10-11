# Tiny Worlds

Small living worlds to rest your eyes on: a collection of calm, interactive canvas animations.
Everything is plain HTML, CSS and JavaScript. No build step, no image or audio files; every
creature, room and sound is drawn or synthesised in code.

| World | Path | What you can do |
| --- | --- | --- |
| Aquarium | `/aquarium/` | Feed the fish, add creatures, cycle day / twilight / night / deep, adjust the bubbler |
| Ragdoll Cat | `/cat/` | Pet it (it purrs), toss treats, play with yarn or a laser, watch it nap in its bed |
| Rain on the Glass | `/rain/` | Wipe the window fog, change rain intensity, trigger thunder, watch drops race |
| The Feeder | `/feeder/` | Scatter seed, watch sparrows, finches, chickadees, cardinals, and jays arrive |
| Night Meadow | `/meadow/` | Hold still to gather fireflies, call them with a lantern, wait for synchrony |
| Night Train | `/train/` | Watch countryside, coast, snow, and city roll by, sound the horn, toggle reflection |
| The Greenhouse | `/greenhouse/` | Aim the watering can and watch thirsty plants lift; mist the leaves; plants grow only while moist, across real days, and tell you what grew while you were away |
| The Snow Globe | `/snowglobe/` | Drag or shake (on a phone, really shake) to swirl the snow, then watch it settle on the roofs; wind the music box and the toy train runs until it winds down; the sky follows your local time |
| The Shoreline | `/shoreline/` | Draw or write in the sand and let the waves smooth it away; collect the shells they leave; a crab runs from your hand; light and tide follow your local time |
| The Desk | `/desk/` | A desk at night where every object is a doorway into another world; hover to see where it leads, switch off the lamp |

## Running locally

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

Pages use absolute paths (`/shared/...`), so serve the repository root rather than opening files directly.

## Project layout

```
index.html, landing.css, landing.js   Landing page: the shelf, then a live preview of each world
scenes.js                             The list of worlds (title, copy, search description, accent)
render.js                             Homepage markup for the shelf and world sections
tools/prerender.mjs                   Build step: writes that markup, search/share tags and sitemap.xml into the HTML
og/<slug>.jpg                         1200×630 share images, also used as the shelf snapshots
robots.txt
shared/
  ui.css      Glass UI: brand pill, stats pill, single-row collapsible toolbar, guide modal
  shell.js    Toolbar collapse (T), idle fade, hint banner, dropdowns, guide (?), fullscreen (F), Esc
  audio.js    AudioEngine: procedural Web Audio base class (tone / noise helpers, master mute)
  canvas.js   High-DPI canvas sizing, delta-time loop, reduced-motion check
aquarium/     The aquarium world (engine, creatures, sounds)
cat/          The Ragdoll world: cat.js (poses + rendering), room.js, toys.js, sounds.js, scene.js (behaviour)
```

## Adding a world

1. Create a folder, e.g. `fireflies/`, with an `index.html` that loads `/shared/ui.css`,
   `/shared/canvas.js`, `/shared/audio.js` and `/shared/shell.js`, and reuses the shared markup
   (`#world`, `.top-nav`, `#toolbar-container`, `#toolbar-handle`, `#hint-banner`, `#help-modal`).
   Call `Shell.init({ storageKey: 'tinyworlds.fireflies' })` on load.
2. Add an entry to `scenes.js`, including a one-line `description` (it becomes the search result
   text and link-preview text). Optionally add a preview renderer to `PREVIEWS` in `landing.js`.
3. Add `og/<slug>.jpg` (1200×630): a still of the world, used for link previews and on the shelf.
   The easiest way is to render the world's homepage preview into a 1200×630 canvas and save it.
4. Commit and push. The build fills in the homepage, the `<head>` tags and the sitemap, so no
   Dockerfile change is needed.

## Shared shortcuts

| Key | Action |
| --- | --- |
| `T` | Show / hide the toolbar |
| `F` | Fullscreen |
| `?` / `H` | Guide |
| `Esc` | Close menus and the guide |

The UI and cursor fade after a few idle seconds so only the world remains.

## Deployment

`Dockerfile` serves the site with nginx on port 80. It is set up for Dockyard: pushes to `main`
build the image and redeploy through the generated GitHub Actions workflow.

The image build first runs `tools/prerender.mjs` (in a Node stage), so the homepage arrives with
every world already in the HTML and each page carries its description, canonical URL, Open Graph /
Twitter tags (and structured data on the homepage). Locally, without that step, `landing.js` builds
the same markup from `render.js`, so the page looks the same. To see the built output:
`node tools/prerender.mjs <copy-of-the-site>`.
