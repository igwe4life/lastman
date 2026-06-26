# Textures

The POC generates all textures procedurally on `<canvas>` at runtime (ground,
roads, building windows, clouds) — see the corresponding files in `src/world/`.

## Using real textures

For production quality, drop PBR sets here (albedo / normal / roughness / AO),
ideally as **KTX2 / Basis** compressed `.ktx2` for GPU-friendly loading, and load
them via Three's `KTX2Loader`. Good CC0 sources: [Poly Haven](https://polyhaven.com),
[ambientCG](https://ambientcg.com). Recommended first replacements:

- Grass / terrain ground (tileable, with normal map)
- Stone / dirt road
- An HDRI for `scene.environment` (replaces the procedural sky IBL in `Sky.ts`)
