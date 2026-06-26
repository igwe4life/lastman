import { Vector3 } from 'three';
import { Engine } from './Engine';
import { Input } from './Input';
import { Loop } from './Loop';
import { AssetLoader } from './AssetLoader';
import { Player } from '../entities/Player';
import { Inventory } from '../gameplay/Inventory';
import { LevelManager } from '../gameplay/LevelManager';
import { AudioManager } from '../audio/AudioManager';
import { UI } from '../ui/UI';
import { ShopUI } from '../ui/ShopUI';
import { createBus } from '../gameplay/events';

/**
 * Top-level composition root. Owns every subsystem and the frame loop and wires
 * them together through the event bus. Lifecycle:
 *   new Game() -> init(onProgress) [load + build level 1] -> begin() [gesture].
 *
 * Gameplay loop: shop for resources with Mission Tokens, walk the city helping
 * people who need them, complete the distribution objectives to trigger the
 * district's world event, then continue to the next city.
 */
export class Game {
  private engine: Engine;
  private input: Input;
  private bus = createBus();
  private loop: Loop;
  private audio: AudioManager;
  private ui: UI;

  private player!: Player;
  private inventory!: Inventory;
  private level!: LevelManager;
  private shop!: ShopUI;

  private paused = false;
  private shopOpen = false;
  private started = false;
  private readonly tmp = new Vector3();

  constructor(container: HTMLElement) {
    this.engine = new Engine(container);
    this.input = new Input(this.engine.renderer.domElement);
    this.audio = new AudioManager(this.bus);
    this.ui = new UI(this.bus);
    this.loop = new Loop((dt, elapsed) => this.update(dt, elapsed));

    this.input.onPauseToggle = () => this.togglePause();
    this.ui.onPauseClick = () => this.togglePause();
    this.ui.onShopClick = () => this.bus.emit('shopToggle', !this.shopOpen);

    this.bus.on('shopToggle', (open) => this.onShopToggle(open));
  }

  async init(onProgress: (ratio: number, label: string) => void): Promise<void> {
    const loader = new AssetLoader(onProgress);
    await loader.load();

    // Player gets a flat placeholder ground; the LevelManager swaps in the real
    // city ground the moment a level is built.
    this.player = new Player(this.input, this.engine.camera, { heightAt: () => 0 });
    this.engine.scene.add(this.player.group);
    this.player.onFootstep = (running) => this.bus.emit('sfx', running ? 'footstep-run' : 'footstep');
    this.player.onJump = () => this.bus.emit('sfx', 'jump');

    this.inventory = new Inventory(this.bus);
    this.shop = new ShopUI(this.inventory, this.bus);
    this.level = new LevelManager(this.engine, this.bus, this.inventory, this.player, this.engine.camera);

    // Build the first city so it sits behind the start screen.
    this.level.start();
    this.player.update(0.016);
    this.engine.render();

    if (import.meta.env.DEV) {
      (window as unknown as { __lms: unknown }).__lms = {
        player: this.player,
        level: this.level,
        inventory: this.inventory,
        bus: this.bus,
        camera: this.engine.camera,
        scene: this.engine.scene,
      };
    }
  }

  begin(): void {
    if (this.started) return;
    this.started = true;
    this.audio.start();
    this.ui.show();
    this.loop.start();
  }

  private onShopToggle(open: boolean): void {
    this.shopOpen = open;
    this.input.enableLook(!open && !this.paused);
    if (!open) this.audio.resume();
  }

  private togglePause(): void {
    if (!this.started || this.shopOpen) return;
    this.paused = !this.paused;
    this.ui.setPaused(this.paused);
    this.input.enableLook(!this.paused);
    if (!this.paused) this.audio.resume();
  }

  private update(dt: number, elapsed: number): void {
    // Shop is reachable from anywhere with B (also closes it).
    if (this.input.wasPressed('KeyB') && !this.paused && !this.level.inCinematic) {
      this.bus.emit('shopToggle', !this.shopOpen);
    }

    if (this.paused || this.shopOpen) {
      this.engine.render();
      this.input.endFrame();
      return;
    }

    const inCinematic = this.level.inCinematic;
    if (!inCinematic) {
      if (this.input.wasPressed('KeyE')) this.level.handleInteract();
      this.player.update(dt);
    }

    this.level.update(dt, elapsed);
    this.audio.update(dt);

    // Objective compass bearing relative to camera.
    const obj = this.level.objectivePosition();
    this.tmp.set(obj.x - this.player.position.x, 0, obj.z - this.player.position.z);
    const bearing = Math.atan2(this.tmp.x, this.tmp.z) - this.player.camera.yaw;
    this.ui.tick(this.loop.fps, bearing);

    this.engine.render();
    this.input.endFrame();
  }
}
