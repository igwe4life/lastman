import type { GospelResource } from '../config/gameConfig';
import { Emitter } from '../utils/events';

export type SfxName =
  | 'collect'
  | 'buy'
  | 'give'
  | 'pray'
  | 'interact'
  | 'success'
  | 'denied'
  | 'jump'
  | 'footstep'
  | 'footstep-run'
  | 'event'
  | 'levelup'
  | 'chime';

export interface ObjectiveProgress {
  type: GospelResource;
  have: number;
  need: number;
}

/** Data shown in the NPC interaction panel. */
export interface NpcPanelData {
  request: string;
  resource: GospelResource;
  status: 'asking' | 'helped' | 'denied';
  acknowledgment?: string;
}

/** All cross-system events. Gameplay emits; UI + audio subscribe. */
export type GameEvents = {
  // Economy + inventory
  inventoryChanged: Record<GospelResource, number>;
  tokensChanged: number;
  purchase: { type: GospelResource; price: number };
  // Mission / level
  objectivesChanged: ObjectiveProgress[];
  levelChanged: { index: number; total: number; name: string; country: string; subtitle: string; situation: string };
  worldEventBanner: string;
  missionComplete: void;
  // NPC interaction
  npcPanel: NpcPanelData | null;
  promptChanged: string | null;
  // Shop + UI
  shopToggle: boolean;
  toast: string;
  cinematicChanged: boolean;
  levelTransition: boolean;
  // Audio
  sfx: SfxName;
};

export type GameBus = Emitter<GameEvents>;
export const createBus = (): GameBus => new Emitter<GameEvents>();
