# Last Man Standing — Proof of Concept

A playable 3D adventure **vertical slice** that runs entirely in a modern web
browser. A messenger travels through three living African cities — **Lagos**,
**Accra** and **Johannesburg** — spending a limited pool of **Mission Tokens** on
Gospel resources and distributing them to the people who need them. Completing
each city's objectives triggers a dynamic world event that opens the way onward,
until the messenger finally reaches **The Last Man Standing**. ~5–10 minutes.

## The gameplay loop

1. **Shop** — every level opens at the Mission Supply Shop. You start with **200
   Mission Tokens** and buy resources at configurable prices (Bible 1, Magazine
   0.5, Christian Book 2, Prayer 2). You can't carry everything, so choose.
2. **Help people** — the city is full of NPCs going about their day; some carry a
   floating **need icon** (📖/📰/📚/🙏). Approach and press **E**. If you have the
   resource they want, you hand it over (or pray with them) and the mission
   progresses; if not, you're told to visit the shop. Reopen the shop any time
   with **B**.
3. **Complete the objectives** — each city asks you to distribute a set number of
   each resource. When the targets are met, a **dynamic world event** fires
   (a blocked road clears / a community gate opens / a damaged crossing is
   restored) with a camera move, particles and sound.
4. **Move on** — walk into the revealed light to travel to the next city, and
   ultimately to The Last Man Standing. "Every person matters."

> **POC scope.** This is a polished foundation, not the final game. Everything is
> generated procedurally so it runs with zero binary assets — but every asset
> (character, audio, textures, HDRI) sits behind a loader seam so you can drop in
> production art later without rewriting gameplay. See the `public/assets/*`
> READMEs.

---

## Quick start

```bash
npm install
npm run dev
```

Vite opens the game at `http://localhost:5173`. Click **Begin Journey**
(this gesture unlocks audio + mouse-look), then play.

### Other commands

| Command           | What it does                                  |
| ----------------- | --------------------------------------------- |
| `npm run dev`     | Dev server with hot reload                    |
| `npm run build`   | Type-check + production build to `dist/`      |
| `npm run preview` | Serve the production build locally            |
| `npm run typecheck` | TypeScript check only                       |

Requires **Node 18+**.

---

## Controls

| Input             | Action          |
| ----------------- | --------------- |
| `W` `A` `S` `D`   | Move            |
| `Shift`           | Run             |
| `Space`           | Jump            |
| `E`               | Help the nearest person |
| `B`               | Open / close the supply shop |
| `Mouse drag`      | Look / orbit camera (360°) |
| `Double-click`    | Toggle immersive Pointer-Lock mouse-look |
| `Esc` / pause btn | Pause           |

---

## The three cities

| Level | City | Identity | World event |
| ----- | ---- | -------- | ----------- |
| 1 | **Lagos, Nigeria** | Bright tropical noon, yellow danfo buses, palm-lined streets, street markets, mixed high-rise/residential | A blocked road is cleared |
| 2 | **Accra, Ghana** | Warm evening light, wide boulevards, modern architecture, a park & fountain, markets | A community gate opens |
| 3 | **Johannesburg, South Africa** | Crisp high-veld daylight, modern glass skyline, urban park, mountains on the horizon | A damaged crossing is restored → **The Last Man Standing** |

Each city is data-driven (`src/config/cities.ts`): palette, lighting, building
mix, props, traffic, NPC count, distribution objectives and event kind. Adding a
level is purely additive. The HUD compass (top-centre) points to the current
objective; finishing the last city plays the ending cinematic — **"Every person
matters."**

---

## Tech stack

- **Three.js** (WebGL2) with an HDR post-processing pipeline:
  ACES Filmic tone mapping → SSAO (ambient occlusion) → Unreal Bloom → FXAA.
- **TypeScript**, **Vite** for dev/build.
- Procedural everything: atmospheric `Sky` + IBL environment map, dynamic
  sun/shadows, instanced grass & trees with GPU wind, canvas-generated textures,
  Web Audio synthesized music/ambience/SFX, and a jointed procedural character
  with hand-authored idle/walk/run/jump/climb/interact animations.

---

## Project structure

```
last-man-standing/
├─ index.html                 # Loading + start screens, HUD mount
├─ vite.config.ts             # Build config (three split into its own chunk)
├─ public/assets/             # Drop-in slot for real models / audio / textures
│  ├─ models/  audio/  textures/   (each has a README on how to add real assets)
└─ src/
   ├─ main.ts                 # Boot: loading bar → start screen → begin
   ├─ config/                 # gameConfig.ts (economy/tunables) + cities.ts (levels)
   ├─ core/                   # Engine, Input, Loop, AssetLoader, Game (root)
   ├─ world/                  # Parametric, disposable city builder: Sky, Lighting,
   │                          #   Terrain, Buildings, Roads, Grass, Trees, Palms,
   │                          #   Vehicles, CityProps, Mountains, Clouds, Birds,
   │                          #   Environment (composes one city per CityConfig)
   ├─ entities/               # Player, CharacterRig (+ animations), controller,
   │                          #   ThirdPersonCamera, NPC, CityNPC (need-icon crowd)
   ├─ gameplay/               # Game logic: LevelManager (level lifecycle),
   │   │                      #   Inventory (tokens + resources), NPCManager,
   │   │                      #   WorldEvent (dynamic obstacles), events (bus)
   │   └─ obstacles/          #   FinalScene (the ending cinematic)
   ├─ audio/                  # AudioManager (Web Audio synthesis)
   ├─ ui/                     # UI.ts (HUD) + ShopUI.ts + ui.css
   └─ utils/                  # math + typed event emitter
```

The folders map to the requested architecture: `world` + `scenes` content lives
in `world/` (composed by `Environment`), reusable `components` are the classes in
`entities/`/`world/`, `animations` are authored in `CharacterRig`, and `game
logic` is `gameplay/`.

---

## Performance

- Targets **60 FPS** on a mid-range laptop. Pixel ratio is capped (config), grass
  and trees use **`InstancedMesh`**, wind runs on the GPU, the shadow frustum
  follows the player to keep a tight high-res shadow map, and `three` is split
  into its own cached chunk.
- Tune quality in `src/config/gameConfig.ts` (`render.enableBloom`,
  `enableSSAO`, `enableFXAA`, `shadowMapSize`, `pixelRatioCap`).

---

## Deployment

It's a static site — build and host the `dist/` folder anywhere:

```bash
npm run build      # outputs dist/
npm run preview    # verify locally
```

- **Netlify / Vercel / GitHub Pages / Cloudflare Pages**: publish directory `dist`,
  build command `npm run build`. `base: './'` in `vite.config.ts` makes it work
  from any subpath.
- **Any static host / nginx**: copy `dist/` to the web root.

---

## Extending toward a mobile game

- **Real character:** add `public/assets/models/character.glb` (Mixamo clips) —
  auto-detected by `AssetLoader`; swap `CharacterRig` for an `AnimationMixer` in
  `Player.ts`. The `AnimState` machine maps 1:1 to the clip names.
- **Touch controls:** add an on-screen joystick + buttons that feed the same
  `Input.moveIntent()` / action contract — no gameplay changes needed.
- **Assets:** replace canvas textures with KTX2 PBR sets and the procedural sky
  with an HDRI (see `public/assets/textures/README.md`).
- All gameplay is data-driven from `config/gameConfig.ts` and the `Obstacle`
  base class, so new obstacles/levels are additive.
