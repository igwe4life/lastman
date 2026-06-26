# Models

The POC uses a **procedural character** (`src/entities/CharacterRig.ts`) and
procedural environment props, so no model files are required to run.

## Dropping in a real character (GLTF + Mixamo)

Place a rigged, animated character here as **`character.glb`**:

```
public/assets/models/character.glb
```

`src/core/AssetLoader.ts` automatically detects and loads it (via `HEAD` probe).
Recommended pipeline:

1. Get a rigged humanoid (e.g. [Mixamo](https://www.mixamo.com), Ready Player Me,
   or a CC0 model from [Quaternius](https://quaternius.com) / [Poly Pizza](https://poly.pizza)).
2. Download Mixamo clips **Idle, Walking, Running, Jump, Climbing, Standing Greeting**
   as FBX (with skin), import into Blender, retarget to one armature, and export
   as a single `.glb` with all animation clips.
3. Name the clips exactly: `idle`, `walk`, `run`, `jump`, `climb`, `interact`.
4. Extend `Player.ts` to use Three's `AnimationMixer` with these clips instead of
   `CharacterRig` (the state machine maps 1:1 — see `AnimState`).

Keep models **Draco-compressed** and under ~5 MB for fast loading.
