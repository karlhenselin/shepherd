# Shepherd

A free, cozy Android game: Stardew-like shepherding with Psalm 23 as the spine. Faith shows up in the world, not as quizzes.

**Loop:** Explore → find a lost sheep → care for the flock → protect them → return to the fold.

## Art

2D top-down. Watercolor world: stacked, low-opacity deformed washes (Hobbs-style), paper grain, bleeding edges. The intro paints the heavens and the earth (Genesis 1:1). As you walk, new washes rain into empty ground and stay — they are not redrawn every frame.

The map is a 7×7 grid of regions. A green pasture and quiet water sit in fixed neighboring regions. Night is a darkening veil; the sheepfold’s campfire glows through it.

Shepherd and sheep are simple painted sprites on top so they read clearly against the washes.

## Sheep

Named personalities you care for and get attached to. They follow in a trail, can be petted, and bleat when waiting or falling behind. Each has a distinct coat tint.

| Name | Traits |
|---|---|
| Clover | Calm, friendly, stays with the flock |
| Snowball | Curious, brave, wanders off |
| Biscuit | Hungry, lazy, always looking for food |
| Milo | Nervous, follows other sheep |

## Gameplay

The challenge is keeping the flock together, not combat.

A sheep goes missing → follow the hint, listen for a baa, rescue them → bring them home. If followers lag, one may wander off again.

Care: hunger (green pasture) and thirst (quiet water).

**Threats:** wolf, hole, thorns.

- **Wolf** — heard, not fought. At night the howls start; music falls silent.
- **Hole** — a sheep is trapped and hurt; walk up and bandage them.
- **Thorns** — still to come.

**Staff** is found on the way to the fold at night. A bandage button appears when a hurt sheep is nearby. Hint arrows point to the current need (lost sheep, pasture, water, staff, fold) and to optional Bible gems.

Tap or click to move. WASD in the browser.

**Lost sheep** is the signature: each new sheep waits far away. Finding them: *“There you are.”*

## Psalm 23

Scripture is spoken in the world as the story happens (Berean Standard Bible). The campaign so far:

1. *The LORD is my shepherd* — find your first sheep
2. *I shall not want / green pastures* — the flock is hungry; lead them to grass
3. *We all like sheep have gone astray* (Isaiah 53:6) — another sheep is missing
4. *Quiet waters* — the flock is thirsty; lead them to water
5. *He restores my soul* — a sheep is hurt in a hole; bandage them
6. *Paths of righteousness* — walk on
7. *The valley of the shadow* — night falls; wolves howl; a fold waits at the far corner of the map
8. *I will fear no evil* — find the staff
9. *Your rod and Your staff* — pick it up
10. *The one who enters by the gate* (John 10:2) — guide the flock to the pen
11. *I am the gate* (John 10:9) — the shepherd lies down in the gateway
12. *We will all be changed* (1 Corinthians 15:51) — white robe; morning

Still ahead: *You prepare a table* / *goodness and mercy* (Psalm 23:5–6).

Optional **Bible gems** are scattered on the map. Collecting one speaks a short verse. The treasure chest lists gems you have found and scripture heard along the way. Never required.

## Platform

Free Android app. No custom accounts, no backend, no monetization. Google Play Games silent sign-in is used only for achievements on the player’s Play Games profile.

Phaser 4 in the browser for development; Capacitor wraps the same build for Android. Local JSON save on the device; Android Auto Backup restores it on a new device. Browser play is for testing only — web and phone do not share saves.

Settings: sound, credits, reset save, and (on Android) Play Games achievements.

```
Phaser 4        game
TypeScript      code
Vite            dev server + web bundle
Capacitor       Android app
Play Games      achievements (PGS v2)
Local JSON      save on device
Auto Backup     restore via Google
```

### Android build

From `shepherd-app/`:

```bash
npm run cap:sync    # vite build + cap sync android
npm run android     # open Android Studio
```

### Play Console checklist (achievements)

1. Create the Play app and a Play Games Services project; link package `com.karlhenselin.shepherd`.
2. Create these achievements and publish them:
   - First of the Flock (`first_sheep`)
   - Full Flock (`full_flock`)
   - Green Pastures (`green_pastures`)
   - Quiet Waters (`quiet_waters`)
   - He Restores My Soul (`restores_soul`)
   - Paths of Righteousness (`paths_righteousness`)
   - Valley of the Shadow (`valley_of_shadow`)
   - Fear No Evil (`fear_no_evil`)
   - Comfort of the Staff (`comfort_of_staff`)
   - The Gate (`the_gate`)
   - We Shall All Be Changed (`we_shall_be_changed`)
   - First Bible Gem (`first_bible_gem`)
   - Gem Collector — 25 gems (`gem_collector`)
   - Bible Treasure Hunter — all gems (`bible_treasure_hunter`)
3. Paste the Games Services project id into `shepherd-app/android/app/src/main/res/values/games-ids.xml`.
4. Paste each Play Console achievement id into `ANDROID_ACHIEVEMENT_IDS` in `shepherd-app/src/game/achievements/catalog.ts`.

Until those ids are filled in, unlocks are queued locally and skipped on the platform.

## References

- [Phaser 3 tilemaps](https://medium.com/@michaelwesthadley/modular-game-worlds-in-phaser-3-tilemaps-1-958fc7e6bbd6)
- [Phaser Editor](https://docs.phaser.io/phaser-editor/)
- [Phaser editor starter](https://github.com/phaserjs/editor-starter-template-cursor-javascript)
- [Hobbs — watercolor generative art](https://www.tylerxhobbs.com/words/a-guide-to-simulating-watercolor-paint-with-generative-art)
