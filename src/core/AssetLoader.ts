import { LoadingManager } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Centralized async asset loading with progress reporting.
 *
 * The POC ships with NO binary assets — everything is generated procedurally at
 * runtime. This loader is the seam where real production assets get dropped in:
 * place a rigged character at `public/assets/models/character.glb` (with Mixamo
 * animation clips) and it will be picked up automatically; otherwise the game
 * falls back to the procedural CharacterRig. The same pattern extends to HDRIs,
 * audio, and texture atlases.
 */
export interface LoadedAssets {
  characterGltf: GLTF | null;
}

export class AssetLoader {
  private manager = new LoadingManager();

  constructor(private onProgress: (ratio: number, label: string) => void) {
    this.manager.onProgress = (url, loaded, total) => {
      this.onProgress(total > 0 ? loaded / total : 0, `Loading ${shortName(url)}…`);
    };
  }

  async load(): Promise<LoadedAssets> {
    // Simulated staged progress so the loading bar feels alive even though most
    // content is procedural and instantaneous.
    const stages = [
      'Generating terrain…',
      'Planting forests…',
      'Raising the city…',
      'Lighting the sky…',
      'Awakening the messenger…',
    ];
    for (let i = 0; i < stages.length; i++) {
      this.onProgress((i + 1) / (stages.length + 1), stages[i]);
      await frame();
    }

    const characterGltf = await this.tryLoadCharacter();
    this.onProgress(1, 'Ready');
    return { characterGltf };
  }

  private async tryLoadCharacter(): Promise<GLTF | null> {
    const url = 'assets/models/character.glb';
    try {
      const head = await fetch(url, { method: 'HEAD' });
      if (!head.ok) return null;
      const loader = new GLTFLoader(this.manager);
      return await loader.loadAsync(url);
    } catch {
      // No model present — procedural fallback will be used. This is expected
      // for the default POC and is not an error.
      return null;
    }
  }
}

const shortName = (url: string): string => url.split('/').pop() ?? url;
// Use a timer rather than requestAnimationFrame so the loading sequence still
// advances when the tab is backgrounded (rAF is paused while hidden).
const frame = (): Promise<void> => new Promise((r) => setTimeout(r, 30));
