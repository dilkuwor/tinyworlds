/**
 * render.js - Homepage markup for the worlds, shared by the browser and the build.
 *
 * The build (tools/prerender.mjs) runs these same functions to write the
 * shelf and the world sections straight into index.html, so search engines
 * and link previews see every world without running any JavaScript. In the
 * browser, landing.js only uses them when that HTML isn't there (local dev).
 */

const TW_SITE = {
  url: 'https://tinyworlds.bytetech.cloud',
  name: 'Tiny Worlds',
  title: 'Tiny Worlds · Small living worlds to rest your eyes on',
  description: 'Calm, interactive little worlds to rest your eyes on: an aquarium, a Ragdoll cat, rain on the glass, a snow globe, a quiet beach and more.'
};

function twEscape(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** One small window on the shelf: a snapshot that comes alive on hover. */
function twShelfItem(world) {
  const e = twEscape;
  return `<a class="shelf-item" href="/${e(world.slug)}/" data-slug="${e(world.slug)}" style="--accent: ${e(world.accent)}">` +
    `<span class="shelf-window"><img src="/og/${e(world.slug)}.jpg" alt="" width="1200" height="630" loading="lazy" decoding="async"><canvas aria-hidden="true"></canvas></span><span class="shelf-plank" aria-hidden="true"></span>` +
    `<span class="shelf-label"><span class="shelf-icon" aria-hidden="true">${world.icon}</span>${e(world.title)}</span>` +
    `</a>`;
}

/** A full showcase section for one world. */
function twWorldSection(world, i) {
  const e = twEscape, href = `/${e(world.slug)}/`;
  return `<article class="world reveal" id="world-${e(world.slug)}" data-slug="${e(world.slug)}" style="--accent: ${e(world.accent)}">
      <div class="world-window-wrap">
        <a class="world-window" href="${href}" aria-label="Open ${e(world.title)}">
          <canvas aria-hidden="true"></canvas>
        </a>
      </div>
      <div class="world-copy">
        <span class="world-index">${String(i + 1).padStart(2, '0')}</span>
        <h3 class="world-name">${e(world.title)}</h3>
        <p class="world-lede">${e(world.lede)}</p>
        <ul class="world-chips">${world.actions.map(a => `<li>${e(a)}</li>`).join('')}</ul>
        <a class="world-cta" href="${href}">${e(world.cta)} <span class="arrow" aria-hidden="true">→</span></a>
      </div>
    </article>`;
}
