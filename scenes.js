/**
 * scenes.js - The list of Tiny Worlds shown on the landing page.
 * Adding a world: create its folder (e.g. /fireflies/index.html), add one
 * entry here, and (optionally) a preview renderer in landing.js.
 */
const TINY_WORLDS = [
  {
    slug: 'aquarium',
    title: 'Aquarium',
    icon: '🐠',
    lede: 'A little reef behind glass. Clownfish weave through the kelp, jellyfish drift in slow pulses, and a turtle passes by now and then.',
    actions: ['Drop food', 'Shift the light', 'Add a creature'],
    cta: 'Dive in',
    accent: '56, 189, 248',
    preview: 'aquarium'
  },
  {
    slug: 'cat',
    title: 'Ragdoll Cat',
    icon: '🐈',
    lede: 'A fluffy, floppy companion in a sunny room. It watches you, stalks a laser dot, pounces on yarn, and purrs when you stroke it.',
    actions: ['Pet it slowly', 'Toss a treat', 'Play with yarn'],
    cta: 'Say hello',
    accent: '255, 178, 122',
    preview: 'cat'
  },
  {
    slug: 'rain',
    title: 'Rain on the Glass',
    icon: '🌧️',
    lede: 'A misty window over a soft-focus city. Drops gather, stall and slide in little rivers. Wipe a space to look out, and watch the glass fog over again.',
    actions: ['Wipe the fog', 'Change the rain', 'Wait for thunder'],
    cta: 'Look outside',
    accent: '169, 196, 224',
    preview: 'rain'
  },
  {
    slug: 'feeder',
    title: 'The Feeder',
    icon: '🐦',
    lede: 'A garden feeder outside the window. Scatter seed and see who comes: sparrows and finches, a bold chickadee, now and then a cardinal. Move gently, or the whole flock bursts away.',
    actions: ['Scatter seed', 'Spot every species', 'Try not to startle them'],
    cta: 'Watch the birds',
    accent: '185, 224, 138',
    preview: 'feeder'
  },
  {
    slug: 'meadow',
    title: 'Night Meadow',
    icon: '✨',
    lede: 'Tall grass under the stars and a pond holding the moon. Fireflies blink on their own clocks, until, left in peace, the whole meadow slowly learns to blink as one.',
    actions: ['Hold still to gather them', 'Call with a lantern', 'Wait for the rhythm'],
    cta: 'Step into the night',
    accent: '232, 245, 154',
    preview: 'meadow'
  }
];
