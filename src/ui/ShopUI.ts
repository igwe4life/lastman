import type { Inventory } from '../gameplay/Inventory';
import type { GameBus } from '../gameplay/events';
import { ResourceIcons, ResourceLabels, type GospelResource } from '../config/gameConfig';
import { RESOURCE_TYPES } from '../config/cities';

/**
 * The Mission Supply Shop. Opens at the start of every level (and any time via
 * the HUD shop button / B key). The player converts Mission Tokens into Gospel
 * resources to carry into the city. Purchases animate the balance down and the
 * inventory up. The world is paused while the shop is open (handled by Game via
 * the shopToggle event).
 */
export class ShopUI {
  private overlay: HTMLElement;
  private balanceEl!: HTMLElement;
  private rows: Record<GospelResource, { owned: HTMLElement; buy: HTMLButtonElement }> = {} as never;
  private open = false;

  constructor(private inventory: Inventory, private bus: GameBus) {
    this.overlay = document.createElement('div');
    this.overlay.id = 'shop-overlay';
    this.overlay.className = 'overlay shop hidden';
    document.body.appendChild(this.overlay);
    this.build();

    bus.on('shopToggle', (open) => this.setOpen(open));
    bus.on('tokensChanged', () => this.refresh());
    bus.on('inventoryChanged', () => this.refresh());
  }

  private build(): void {
    this.overlay.innerHTML = `
      <div class="shop-window">
        <div class="shop-head">
          <h2>Mission Supply Shop</h2>
          <div class="shop-balance">Balance: <span class="token-icon">🪙</span><span id="shop-balance">200</span></div>
        </div>
        <p class="shop-tagline">Spend your Mission Tokens wisely — you cannot help everyone, so choose what to carry into the city.</p>
        <div class="shop-list" id="shop-list"></div>
        <button class="primary-button" id="shop-close">Enter the City →</button>
      </div>`;

    const list = this.overlay.querySelector('#shop-list')!;
    for (const type of RESOURCE_TYPES) {
      const price = this.inventory.priceOf(type);
      const row = document.createElement('div');
      row.className = 'shop-row';
      row.innerHTML = `
        <span class="shop-row-icon">${ResourceIcons[type]}</span>
        <div class="shop-row-meta">
          <span class="shop-row-name">${ResourceLabels[type]}</span>
          <span class="shop-row-price">${formatPrice(price)} token${price === 1 ? '' : 's'} each</span>
        </div>
        <span class="shop-row-owned">×<span id="shop-owned-${type}">0</span></span>
        <button class="buy-btn" id="buy-${type}">Buy</button>`;
      list.appendChild(row);
      const buy = row.querySelector(`#buy-${type}`) as HTMLButtonElement;
      buy.addEventListener('click', () => this.tryBuy(type, buy));
      this.rows[type] = { owned: row.querySelector(`#shop-owned-${type}`)!, buy };
    }

    this.balanceEl = this.overlay.querySelector('#shop-balance')!;
    this.overlay.querySelector('#shop-close')!.addEventListener('click', () => {
      this.bus.emit('shopToggle', false);
    });
  }

  private tryBuy(type: GospelResource, btn: HTMLButtonElement): void {
    if (this.inventory.buy(type)) {
      this.bus.emit('sfx', 'buy');
      btn.classList.remove('pop');
      void btn.offsetWidth;
      btn.classList.add('pop');
    } else {
      this.bus.emit('toast', 'Not enough tokens.');
      btn.classList.remove('shake');
      void btn.offsetWidth;
      btn.classList.add('shake');
    }
  }

  private refresh(): void {
    this.balanceEl.textContent = formatPrice(this.inventory.balance);
    for (const type of RESOURCE_TYPES) {
      this.rows[type].owned.textContent = String(this.inventory.count(type));
      this.rows[type].buy.disabled = !this.inventory.canAfford(type);
    }
  }

  private setOpen(open: boolean): void {
    this.open = open;
    this.overlay.classList.toggle('hidden', !open);
    if (open) this.refresh();
  }

  get isOpen(): boolean {
    return this.open;
  }
}

function formatPrice(p: number): string {
  return Number.isInteger(p) ? String(p) : p.toFixed(1);
}
