import { Vector3, type PerspectiveCamera } from 'three';
import type { Engine } from '../core/Engine';
import type { Player } from '../entities/Player';
import type { Inventory } from './Inventory';
import type { GameBus, ObjectiveProgress } from './events';
import { Environment } from '../world/Environment';
import { NPCManager } from './NPCManager';
import { WorldEvent } from './WorldEvent';
import { FinalScene } from './obstacles/FinalScene';
import { CITIES, RESOURCE_TYPES, type CityConfig } from '../config/cities';
import { GameConfig, ResourceLabels, type GospelResource } from '../config/gameConfig';

/**
 * Orchestrates the level lifecycle: builds a city, populates it with NPCs,
 * tracks the distribution objectives, handles helping people, and — once the
 * objectives are met — triggers the dynamic world event that opens the way to
 * the next district, culminating in reaching The Last Man Standing.
 */
export class LevelManager {
  private env!: Environment;
  private npcs!: NPCManager;
  private event!: WorldEvent;
  private finalScene: FinalScene | null = null;

  private index = -1;
  private have: Record<GospelResource, number> = blank();
  private city!: CityConfig;
  private completed = false;
  private transitioning = false;
  private lastPrompt: string | null = null;

  constructor(
    private engine: Engine,
    private bus: GameBus,
    private inventory: Inventory,
    private player: Player,
    private camera: PerspectiveCamera,
  ) {}

  get environment(): Environment {
    return this.env;
  }

  get inCinematic(): boolean {
    return this.event?.cinematicActive || this.finalScene?.isActive || this.transitioning;
  }

  /** Load the first level. */
  start(): void {
    this.loadLevel(0);
  }

  private loadLevel(index: number): void {
    this.index = index;
    this.city = CITIES[index];
    this.have = blank();
    this.completed = false;

    this.env = new Environment(this.engine, this.city);
    this.npcs = new NPCManager(this.engine.scene, this.env, this.city);
    this.event = new WorldEvent(this.engine.scene, this.city.event);
    this.event.onComplete = () => this.onEventOpened();

    // Last district: place The Last Man Standing beyond the restored crossing.
    this.finalScene =
      index === CITIES.length - 1 ? new FinalScene(this.camera, this.bus) : null;
    this.finalScene?.build(this.engine.scene);

    // Player physics now follow this city's ground; barrier = the world event
    // plus the street "walls" (kept on the street/sidewalk, out of buildings).
    this.player.controller.setGround(this.env);
    this.player.setBarrier(
      (next) => this.event.blocks(next) || Math.abs(next.x) > 9.2 || next.z > 18 || next.z < -103,
    );
    this.player.controller.position.set(0, 0, 8);
    this.player.controller.facing = Math.PI;
    this.player.camera.yaw = Math.PI;
    this.player.camera.pitch = 0.18;

    // Fresh token pool + empty satchel each level.
    this.inventory.reset();

    this.bus.emit('levelChanged', {
      index,
      total: CITIES.length,
      name: this.city.name,
      country: this.city.country,
      subtitle: this.city.subtitle,
      situation: this.city.situation,
    });
    this.emitObjectives();
    // Open the supply shop at the start of every level.
    this.bus.emit('shopToggle', true);
  }

  private emitObjectives(): void {
    const obj = this.city.objectives;
    const list: ObjectiveProgress[] = RESOURCE_TYPES.filter((t) => (obj[t] ?? 0) > 0).map((t) => ({
      type: t,
      have: this.have[t],
      need: obj[t] ?? 0,
    }));
    this.bus.emit('objectivesChanged', list);
  }

  /** Player pressed E. Try to help the nearest needy person, or pass the portal. */
  handleInteract(): void {
    if (this.inCinematic) return;

    // If the way is open and we're at the portal, advance.
    if (this.event.isOpen) {
      if (this.player.position.distanceTo(this.event.portalPosition) < 4) {
        this.advance();
        return;
      }
    }

    const npc = this.npcs.nearestNeedy(this.player.position, GameConfig.npc.interactRange);
    if (!npc || !npc.need) return;
    const need = npc.need;
    // Capture the lines before help() retires the need.
    const request = npc.requestLine;
    const thanks = npc.thanksLine;

    if (this.inventory.has(need)) {
      this.inventory.spend(need);
      npc.faceToward(this.player.position);
      this.player.playAction('interact', 1.2);
      npc.help();
      this.have[need] = Math.min(this.have[need] + 1, this.city.objectives[need] ?? this.have[need] + 1);
      this.bus.emit('sfx', need === 'prayerPoints' ? 'pray' : 'give');
      this.bus.emit('npcPanel', {
        request,
        resource: need,
        status: 'helped',
        acknowledgment: thanks,
      });
      this.bus.emit('toast', `${ResourceLabels[need]} given · +1 objective`);
      this.emitObjectives();
      window.setTimeout(() => this.bus.emit('npcPanel', null), 2200);
      this.checkCompletion();
    } else {
      this.bus.emit('sfx', 'denied');
      this.bus.emit('npcPanel', {
        request: npc.requestLine,
        resource: need,
        status: 'denied',
        acknowledgment: `You need a ${ResourceLabels[need].replace(/s$/, '')} to help this person. Visit the shop.`,
      });
      window.setTimeout(() => this.bus.emit('npcPanel', null), 2600);
    }
  }

  private checkCompletion(): void {
    if (this.completed) return;
    const obj = this.city.objectives;
    const done = RESOURCE_TYPES.every((t) => this.have[t] >= (obj[t] ?? 0));
    if (done) {
      this.completed = true;
      // Whisk the player to the end of the district to witness the world event
      // (the bridge / gate / crossing) opening up close.
      this.player.freeze(true);
      this.player.controller.position.set(0, 0, -84);
      this.player.controller.velocity.set(0, 0, 0);
      this.player.controller.facing = Math.PI;
      this.player.camera.yaw = Math.PI;
      this.player.camera.pitch = 0.12;
      this.event.trigger();
      this.bus.emit('worldEventBanner', this.event.bannerText);
      this.bus.emit('sfx', 'event');
    }
  }

  private onEventOpened(): void {
    // Cinematic finished; hand control back to the player.
    this.player.freeze(false);
    this.bus.emit('sfx', 'levelup');
  }

  private advance(): void {
    if (this.transitioning) return;
    const next = this.index + 1;
    if (next < CITIES.length) {
      this.transitioning = true;
      this.player.freeze(true);
      this.bus.emit('levelTransition', true);
      window.setTimeout(() => {
        this.teardown();
        this.loadLevel(next);
        this.player.freeze(false);
        this.transitioning = false;
        this.bus.emit('levelTransition', false);
      }, 700);
    }
    // On the final city the ending is started by reaching the Last Man (below),
    // so there is no further district to advance to.
  }

  private teardown(): void {
    this.npcs.dispose();
    this.event.dispose();
    this.env.dispose();
  }

  update(dt: number, elapsed: number): void {
    this.npcs.update(dt, elapsed, this.player.position);
    // People + the player are obstacles the traffic must stop for.
    const blockers = [this.player.position, ...this.npcs.positions];
    this.env.update(dt, elapsed, this.camera, this.player.position, blockers);
    this.event.update(dt, this.camera, this.player.position);
    this.finalScene?.update(dt, elapsed, this.player);

    if (!this.inCinematic) this.updatePrompt();

    // Final district: once the crossing is open, approaching the Last Man begins
    // the ending cinematic.
    if (this.finalScene && this.event.isOpen && !this.finalScene.isActive && !this.finalScene.isDone) {
      if (this.player.position.distanceTo(this.finalScene.position) < 6) {
        this.finalScene.start(this.player);
      }
    }
  }

  /** Where the HUD compass should point. */
  objectivePosition(): Vector3 {
    if (this.event.isOpen) return this.event.portalPosition;
    return new Vector3(0, 0, -45); // toward the heart of the district / crowd
  }

  private updatePrompt(): void {
    let prompt: string | null = null;
    if (this.event.isOpen && this.index < CITIES.length - 1) {
      if (this.player.position.distanceTo(this.event.portalPosition) < 6) {
        prompt = 'Press E to continue to the next city';
      }
    }
    if (!prompt) {
      const npc = this.npcs.nearestNeedy(this.player.position, GameConfig.npc.interactRange);
      if (npc && npc.need) {
        prompt = this.inventory.has(npc.need)
          ? `Press E to help · ${npc.requestLine}`
          : `${npc.requestLine}  (you need a ${ResourceLabels[npc.need].replace(/s$/, '')})`;
      }
    }
    if (prompt !== this.lastPrompt) {
      this.lastPrompt = prompt;
      this.bus.emit('promptChanged', prompt);
    }
  }
}

function blank(): Record<GospelResource, number> {
  return { bibles: 0, books: 0, magazines: 0, prayerPoints: 0 };
}
