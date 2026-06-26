import { Vector3 } from 'three';

/**
 * Central tunable configuration for the whole POC.
 * Keep gameplay/visual constants here so designers can tweak without hunting
 * through systems. Everything that defines "the slice" lives in this file.
 */
export const GameConfig = {
  render: {
    // Visual quality. `auto` picks based on devicePixelRatio + GPU heuristics.
    pixelRatioCap: 2,
    shadowMapSize: 2048,
    fov: 60,
    near: 0.1,
    far: 2000,
    enableBloom: true,
    enableSSAO: true,
    enableFXAA: true,
    targetFps: 60,
  },

  world: {
    // The world is a roughly linear path travelling along -Z toward the goal.
    groundSize: 600,
    fogColor: 0xc6d8e8,
    fogNear: 110,
    fogFar: 520,
  },

  player: {
    spawn: new Vector3(0, 0, 6),
    walkSpeed: 3.8,
    runSpeed: 7.6,
    acceleration: 22,
    jumpVelocity: 7.4,
    gravity: -20,
    height: 1.8,
    radius: 0.35,
    interactRange: 3.4,
  },

  camera: {
    distance: 6.0,
    height: 2.5,
    minPitch: -0.5,
    maxPitch: 1.1,
    sensitivity: 0.0032,
    smoothing: 14,
  },

  /**
   * Economy. The player starts each level with a fixed pool of Mission Tokens
   * and spends them at the Mission Supply Shop to acquire Gospel resources to
   * distribute to the people of the city. Prices are per single item and are
   * intentionally configurable for future balancing.
   */
  economy: {
    startingTokens: 200,
    prices: {
      bibles: 1,
      magazines: 0.5,
      books: 2,
      prayerPoints: 2,
    } as Record<GospelResource, number>,
  },

  npc: {
    // How close the player must be to read/interact with a person.
    interactRange: 3.0,
    // Floating need-icon height above the head.
    iconHeight: 2.5,
  },

  mission: {
    objectiveName: 'The Last Man Standing',
    finalPosition: new Vector3(0, 0, -96),
  },
} as const;

export type GospelResource = 'bibles' | 'books' | 'magazines' | 'prayerPoints';

export const ResourceLabels: Record<GospelResource, string> = {
  bibles: 'Bibles',
  books: 'Christian Books',
  magazines: 'Magazines',
  prayerPoints: 'Prayer Points',
};

export const ResourceIcons: Record<GospelResource, string> = {
  bibles: '📖',
  books: '📚',
  magazines: '📰',
  prayerPoints: '🙏',
};
