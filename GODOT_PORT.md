# The Last Man — Godot 4 Port Blueprint

This document is the porting plan for rebuilding **The Last Man** as a native
(mobile-first) game in **Godot 4.x**, using the Three.js web build in this repo
as the validated design/blueprint. The web build stays as the public demo.

> Status: the web POC (this repo) is the **design spec**. Gameplay, economy,
> level flow and "feel" are settled here; Godot is where production quality and
> native mobile happen.

---

## 1. Why Godot, what carries over

**Carries over (design, not code):** the three-city structure (Lagos → Accra →
Johannesburg → The Last Man), the Mission-Token economy + shop, distribute-to-NPCs
objectives, the world events (road/gate/crossing) gating progress, sidewalk
routing + zebra crossings, traffic that stops for people, the teleport-to-event
on completion, and the angelic finale.

**Godot replaces hand-rolled systems with engine features:** physics/collision,
NavMesh pathfinding, animation state machines, particles, post-processing, a real
UI system, positional audio, input mapping (incl. touch + gamepad), and native
export to Android/iOS/desktop (plus web).

---

## 2. System mapping (Three.js build → Godot 4)

| Current (`src/…`) | Godot 4 equivalent |
| --- | --- |
| `core/Engine` (renderer + EffectComposer SSAO/Bloom/FXAA) | Project renderer (Forward+ desktop / Mobile) + `WorldEnvironment` (glow, SSAO, SSR, fog, ACES tonemap) per level |
| `core/Game` (composition root) | `Main.tscn` + **autoload singletons** |
| `gameplay/events.ts` (typed bus) | Autoload **`EventBus`** with `signal`s (Godot's native idiom) |
| `core/Input` (+ `ui/TouchControls`) | **InputMap** actions; on-screen `TouchScreenButton` + virtual joystick; gamepad free |
| `core/Loop` | `_process` / `_physics_process(delta)` |
| `core/AssetLoader` | `ResourceLoader` / `preload` + the `.import` pipeline |
| `config/gameConfig,cities,layout` | **Custom `Resource` types** (`CityData.gd`, `Prices.tres`) editable in the Inspector |
| `world/Environment` (per-city builder) | A `City.tscn` (or `CityBuilder.gd`) driven by a `CityData` resource |
| `world/Sky`, `Lighting` | `WorldEnvironment` + `ProceduralSkyMaterial` + `DirectionalLight3D` |
| `world/Grass,Trees,Palms` (InstancedMesh) | `MultiMeshInstance3D` + wind shader |
| `world/Buildings,Roads,Landmarks,CityProps` | Modeled `.glb` / `GridMap` / CSG; roads as meshes; placed in-editor or via script |
| `world/Vehicles` | `Path3D` lanes + `PathFollow3D`; `Area3D`/raycast to stop for people; wheels via shader/`AnimationPlayer` |
| `entities/Player` + `CharacterController` | **`CharacterBody3D`** + `move_and_slide()` |
| `entities/ThirdPersonCamera` | **`SpringArm3D` + `Camera3D`** (free wall-occlusion) |
| `entities/CharacterRig` (procedural) | Imported **skinned GLTF + `AnimationTree`** state machine (idle/walk/run/jump/interact) |
| `entities/CityNPC` + `gameplay/NPCManager` | `CharacterBody3D` agents + **`NavigationAgent3D`** on a baked **NavMesh** (sidewalks); spawner + needs manager; need icon = `Sprite3D`/`Label3D` billboard |
| sidewalk routing / crossings (manual) | **NavigationRegion3D** over sidewalks + **NavLink3D** at zebra crossings |
| NPC "blocked" separation (manual) | `NavigationAgent3D` avoidance (RVO) |
| `gameplay/WorldEvent` (camera/particles/anim) | `AnimationPlayer` + `GPUParticles3D` + camera anim |
| `gameplay/obstacles/FinalScene` + `world/Angels` | Cutscene via `AnimationPlayer`; angels = animated `MultiMesh`/instanced scenes; `GPUParticles3D` |
| `gameplay/Inventory` (tokens + resources) | Autoload **`GameState`** |
| `gameplay/LevelManager` | Autoload **`LevelManager`** (scene transitions, per-city data) |
| `ui/UI` (HUD), `ui/ShopUI` (DOM/CSS) | **`Control`** scenes + `Theme`; anchors/containers for responsive; `peopleRemaining`, objectives, compass |
| `audio/AudioManager` (WebAudio synth) | `AudioStreamPlayer` (music) + `AudioStreamPlayer3D` (positional SFX) + audio **buses**, real files |

---

## 3. Proposed Godot project structure

```
res://
  scenes/
    Main.tscn
    player/Player.tscn
    npc/CityNPC.tscn
    cities/Lagos.tscn  Accra.tscn  Johannesburg.tscn   # or one City.tscn + data
    ui/HUD.tscn  Shop.tscn  TouchControls.tscn  Title.tscn
    fx/WorldEvent.tscn  Finale.tscn  Angels.tscn
  scripts/
    autoload/  GameState.gd  EventBus.gd  AudioManager.gd  LevelManager.gd
    player/  npc/  world/  ui/
  resources/
    CityData.gd                # custom Resource (mirrors config/cities.ts)
    cities/  lagos.tres  accra.tres  johannesburg.tres
    prices.tres
  assets/
    models/  animations/  audio/  textures/  materials/
  addons/                       # optional (e.g. phantom_camera for cutscenes)
```

Autoloads = the spine: **EventBus** (signals), **GameState** (economy/inventory),
**AudioManager**, **LevelManager**. Everything else is scenes that emit/listen.

---

## 4. Data-driven cities (`CityData` resource)

Port `config/cities.ts` 1:1 into a `Resource`:

```gdscript
class_name CityData extends Resource
@export var id: String
@export var display_name: String
@export var country: String
@export var situation: String
@export var objectives: Dictionary   # {"bibles":6,"magazines":4,...}
@export var npc_count: int
@export var event_kind: String        # "road" | "gate" | "crossing"
@export var sun_energy: float
@export var fog_color: Color
@export var building_palette: PackedColorArray
@export var has_palms: bool
@export var has_mountains: bool
# …etc — one .tres per city, editable in the Inspector
```

Prices/economy → a `Prices.tres`. This makes balancing a no-code task.

---

## 5. Milestones (suggested order)

0. **Setup** — Godot 4.x, repo + `.gitignore` (`.godot/`), pick language, import settings.
1. **Core traversal** — `Player` (`CharacterBody3D`) + `SpringArm3D` camera + InputMap (keyboard/mouse/touch/gamepad) on a flat test scene.
2. **City greybox** — one street + sidewalks + placeholder buildings; bake a `NavMesh` over the sidewalks; `NavLink3D` at crossings.
3. **One NPC** — `CityNPC` with `NavigationAgent3D` walking sidewalks; billboard need-icon; press-to-give interaction.
4. **Economy + UI** — `GameState`, `Shop.tscn`, `HUD.tscn` (objectives + people-remaining + compass), `EventBus` signals.
5. **Crowd + traffic** — spawner + needs distribution; agent avoidance; `Vehicles` on `Path3D` that stop for people (Area3D).
6. **Level flow** — objectives complete → teleport → `WorldEvent` (anim + particles + camera) → next city.
7. **Three cities** — `CityData` resources; per-city `WorldEnvironment` (lighting/fog/atmosphere); landmarks.
8. **Finale** — Last Man cutscene + Angels + fanfare + "Every person matters."
9. **Art pass** — GLTF character + Mixamo via `AnimationTree`; PBR materials; glow/SSAO/SSR/volumetric fog.
10. **Audio pass** — music + positional SFX + buses.
11. **Mobile export** — Android/iOS; mobile renderer; `MultiMesh` + LOD + occlusion culling; touch UX tuning.
12. **Polish + store prep** — settings, save, icons, splash, store listings.

A playable vertical slice (one city, full loop) lands around **milestone 6**.

---

## 6. Risks / watch-items

- **Web export is heavier in Godot** (multi-MB WASM) — keep *this* Three.js build as the web demo; don't rely on Godot for the frictionless URL.
- **Art is the real quality lever** — Godot only shines with imported GLTF + animations + PBR. Budget for assets (commission / Mixamo / marketplace).
- **Mobile perf** — use the Mobile renderer, `MultiMesh` for crowds/vegetation, LOD, occlusion culling, and cap dynamic lights/shadows.
- **NavMesh authoring** — getting agents to use sidewalks + cross only at crossings needs careful nav region + nav link setup (it replaces the manual routing here, and is more robust once configured).

---

## 7. Locked decisions

1. **Language: GDScript** — all gameplay/UI in GDScript for fastest iteration and
   tightest editor integration.
2. **Platform: cross-platform, built to the mobile budget from day one** —
   target desktop + Android/iOS (and web for parity). Adopt the **Mobile-budget
   discipline throughout**: prefer the Mobile/Compatibility-friendly settings,
   `MultiMesh` for all crowds/vegetation, LOD + occlusion culling, cap dynamic
   shadow-casting lights, keep post-processing affordable (glow + light SSAO;
   treat SSR/volumetric fog as desktop-only toggles via a quality setting).
3. **Art: Mixamo + free/marketplace models** — rigged GLTF humanoids + free
   Mixamo clips, retargeted in an `AnimationTree`. One shared humanoid skeleton
   so the player and all NPCs reuse the same animation set (cheap, consistent).

### Implications baked into the plan
- **Quality settings switch** from the start (Low/Med/High): toggles SSR,
  volumetric fog, shadow distance, MSAA, crowd density — so the same project ships
  to a phone and a desktop.
- **Animation library approach:** import Mixamo clips once onto the shared
  skeleton, store as an `AnimationLibrary`, reuse across Player + every NPC via
  `AnimationTree` state machines + a 2D blend space for locomotion.
- **Crowds:** NPCs share one skinned mesh + skeleton; use `AnimationTree` per
  agent but keep counts mobile-safe (LOD: distant NPCs drop to a simpler/idle
  animation or `MultiMesh` imposters).
