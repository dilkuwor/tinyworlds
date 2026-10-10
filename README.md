# Tiny Worlds

Small living worlds to rest your eyes on: a collection of calm, interactive canvas animations.
Everything is plain HTML, CSS and JavaScript. No build step, no image or audio files; every
creature, room and sound is drawn or synthesised in code.

| World | Path | What you can do |
| --- | --- | --- |
| Aquarium | `/aquarium/` | Feed the fish, add creatures, cycle day / twilight / night / deep, adjust the bubbler |
| Ragdoll Cat | `/cat/` | Pet it (it purrs), toss treats, play with yarn or a laser, watch it nap in its bed |

## Running locally

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

Pages use absolute paths (`/shared/...`), so serve the repository root rather than opening files directly.

## Project layout

```
index.html, landing.css, landing.js   Landing page with live previews of each world
scenes.js                             The list of worlds shown on the landing page
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
2. Add an entry to `scenes.js`. Optionally add a preview renderer to `PREVIEWS` in `landing.js`.
3. Commit and push. The Docker image copies the whole site, so no Dockerfile change is needed.

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
