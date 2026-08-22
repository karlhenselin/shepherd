# Shepherd

A free, cozy Android game: Stardew-like shepherding with Psalm 23 as the spine. Faith shows up in the world, not as quizzes.

**Loop:** Explore → find pasture → care for sheep → protect them → discover places → return home → grow the flock.

## Art

2D top-down. Procedurally generated terrain in a watercolor style — soft washes, bleeding edges, paper-like grain. Sunrise, weather, and time of day shift the palette.

Generate the world from noise (elevation, moisture → biomes). Paint it with stacked, low-opacity deformed shapes (Hobbs-style watercolor), then **bake and cache** chunks. Do not redraw 30–100 layers every frame.

Shepherd and sheep stay simple painted sprites on top so they read clearly against the washes.

Biomes: green pastures, still waters, hills and valleys, forests, campsites, villages, home, quiet spiritual places.

## Sheep

Named personalities you care for and get attached to.

| Name | Traits |
|---|---|
| Snowball | Curious, brave, wanders off |
| Clover | Calm, friendly, stays with the flock |
| Biscuit | Hungry, lazy, always looking for food |
| Milo | Nervous, follows other sheep |

## Gameplay

The challenge is keeping the flock together, not combat.

A sheep goes missing → follow hoofprints, listen for a baa, rescue them (cliff, thorns, flood) → bring them home.

**Threats:** wolves, storms, getting lost, cliffs, hunger, thorns, flash floods.

**Tools:** staff (guide), lantern (night), harp (calm), rope (rescue), water flask (care), map.

**Lost Sheep** is the signature: each day one sheep may wander. Finding them can be easy, a small adventure, or a way to discover something new. When you do: *“There you are.”*

Tap-to-move or a virtual joystick on phone. Mouse + WASD in the browser (dev only).

## Psalm 23

Chapters are the campaign. Optional Bible gems in the world open a passage (English, free-to-use translation).

1. *The Lord is my shepherd* — care for your first sheep
2. *Green pastures* — find fertile land
3. *Still waters* — lead the flock to water
4. *He restores my soul* — make a safe resting place
5. *The valley* — take the flock through danger
6. *I will fear no evil* — lead them through the night
7. *Goodness and mercy* — return home

Later: **Shepherd’s Journal** — optional scripture, stories, prayers, history. Never required.

## Platform

Free Android app. No accounts, no backend, no monetization.

Phaser in the browser for development; Capacitor wraps the same build for Android. Local JSON save on the phone; Android Auto Backup restores it on a new device. Browser play is for testing only — web and phone do not share saves.

```
Phaser          game
TypeScript      code
Vite            dev server + web bundle
Capacitor       Android app
Local JSON      save on device
Auto Backup     restore via Google
```

## References

- [Phaser 3 tilemaps](https://medium.com/@michaelwesthadley/modular-game-worlds-in-phaser-3-tilemaps-1-958fc7e6bbd6)
- [Phaser Editor](https://docs.phaser.io/phaser-editor/)
- [Phaser editor starter](https://github.com/phaserjs/editor-starter-template-cursor-javascript)
- [Hobbs — watercolor generative art](https://www.tylerxhobbs.com/words/a-guide-to-simulating-watercolor-paint-with-generative-art)
