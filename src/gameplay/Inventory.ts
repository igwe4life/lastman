import { GameConfig, type GospelResource } from '../config/gameConfig';
import type { GameBus } from './events';

export type ResourceRequirement = Partial<Record<GospelResource, number>>;

/**
 * Holds the player's Mission Token balance and the Gospel resources they've
 * acquired. Resources are no longer found in the world — they are bought at the
 * Mission Supply Shop with tokens and then distributed to people. Emits on every
 * change so the HUD can react (and animate).
 */
export class Inventory {
  private counts: Record<GospelResource, number> = {
    bibles: 0,
    books: 0,
    magazines: 0,
    prayerPoints: 0,
  };
  private tokens: number = GameConfig.economy.startingTokens;

  constructor(private bus: GameBus) {}

  get snapshot(): Record<GospelResource, number> {
    return { ...this.counts };
  }

  get balance(): number {
    return this.tokens;
  }

  count(type: GospelResource): number {
    return this.counts[type];
  }

  priceOf(type: GospelResource): number {
    return GameConfig.economy.prices[type];
  }

  canAfford(type: GospelResource): boolean {
    return this.tokens >= this.priceOf(type) - 1e-6;
  }

  /** Attempt to buy one of `type`. Returns whether the purchase succeeded. */
  buy(type: GospelResource): boolean {
    const price = this.priceOf(type);
    if (this.tokens < price - 1e-6) return false;
    this.tokens = Math.round((this.tokens - price) * 100) / 100;
    this.counts[type] += 1;
    this.bus.emit('purchase', { type, price });
    this.bus.emit('tokensChanged', this.tokens);
    this.bus.emit('inventoryChanged', this.snapshot);
    return true;
  }

  has(type: GospelResource, n = 1): boolean {
    return this.counts[type] >= n;
  }

  /** Spend a resource when helping a person. Returns success. */
  spend(type: GospelResource, n = 1): boolean {
    if (this.counts[type] < n) return false;
    this.counts[type] -= n;
    this.bus.emit('inventoryChanged', this.snapshot);
    return true;
  }

  /** Reset for a new level (fresh token pool, empty satchel). */
  reset(): void {
    this.counts = { bibles: 0, books: 0, magazines: 0, prayerPoints: 0 };
    this.tokens = GameConfig.economy.startingTokens;
    this.bus.emit('tokensChanged', this.tokens);
    this.bus.emit('inventoryChanged', this.snapshot);
  }

  prime(): void {
    this.bus.emit('tokensChanged', this.tokens);
    this.bus.emit('inventoryChanged', this.snapshot);
  }
}
