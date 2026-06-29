import type { GameBus, ObjectiveProgress, NpcPanelData } from '../gameplay/events';
import { ResourceIcons, ResourceLabels, type GospelResource } from '../config/gameConfig';
import { RESOURCE_TYPES } from '../config/cities';

/**
 * The in-game HUD. Driven entirely off the event bus:
 *  - prominent Mission Token balance + satchel (top-left),
 *  - live mission objectives with progress bars,
 *  - shop + pause buttons and FPS (top-right),
 *  - objective compass, interaction prompt + NPC request panel,
 *  - city intro banners, world-event banners, toasts,
 *  - pause / final / level-transition overlays.
 */
export class UI {
  private root: HTMLElement;
  private tokenEl!: HTMLElement;
  private satchel: Record<GospelResource, HTMLElement> = {} as never;
  private objectivesEl!: HTMLElement;
  private peopleRemainingEl!: HTMLElement;
  private prompt!: HTMLElement;
  private npcPanel!: HTMLElement;
  private toastBox!: HTMLElement;
  private fpsEl!: HTMLElement;
  private compass!: HTMLElement;
  private cityLabel!: HTMLElement;
  private banner!: HTMLElement;
  private levelBanner!: HTMLElement;
  private pauseOverlay!: HTMLElement;
  private finalOverlay!: HTMLElement;
  private fadeOverlay!: HTMLElement;

  onPauseClick?: () => void;
  onShopClick?: () => void;

  constructor(private bus: GameBus) {
    this.root = document.getElementById('hud')!;
    this.build();
    this.subscribe();
  }

  private build(): void {
    this.root.innerHTML = `
      <div class="hud-topleft">
        <div class="token-card">
          <span class="token-icon">🪙</span>
          <div class="token-meta">
            <span class="token-label">Mission Tokens</span>
            <span class="token-value" id="token-value">200</span>
          </div>
        </div>
        <div class="satchel" id="satchel"></div>
        <div class="objectives-card">
          <div class="objectives-title">Mission · Distribute</div>
          <div class="objectives" id="objectives"></div>
          <div class="people-remaining" id="people-remaining"></div>
        </div>
      </div>

      <div class="hud-topright">
        <span class="fps" id="fps">60</span>
        <button class="hud-btn shop-btn" id="shop-btn" title="Mission Supply Shop (B)">🛒 Shop</button>
        <button class="hud-btn" id="pause-btn" title="Pause (Esc)">❚❚</button>
      </div>

      <div class="compass" id="compass"><div class="compass-arrow">▲</div></div>

      <div class="city-label" id="city-label"></div>

      <div class="hud-bottom">
        <div class="interact-prompt hidden" id="interact-prompt"></div>
      </div>

      <div class="npc-panel hidden" id="npc-panel"></div>

      <div class="event-banner hidden" id="event-banner"></div>
      <div class="level-banner hidden" id="level-banner"></div>
      <div class="toast-box" id="toast-box"></div>

      <div class="overlay hidden" id="pause-overlay">
        <div class="overlay-inner">
          <h2>Paused</h2>
          <button class="primary-button" id="resume-btn">Resume</button>
        </div>
      </div>
      <div class="overlay final hidden" id="final-overlay">
        <div class="overlay-inner">
          <h1 class="final-caption">Every person matters.</h1>
          <p class="final-sub">Mission Complete</p>
        </div>
      </div>
      <div class="fade-overlay" id="fade-overlay"></div>
    `;

    const satchel = this.root.querySelector('#satchel')!;
    for (const type of RESOURCE_TYPES) {
      const chip = document.createElement('div');
      chip.className = 'satchel-chip';
      chip.innerHTML = `<span class="chip-icon">${ResourceIcons[type]}</span><span class="chip-count" id="satchel-${type}">0</span>`;
      chip.title = ResourceLabels[type];
      satchel.appendChild(chip);
      this.satchel[type] = chip.querySelector(`#satchel-${type}`)!;
    }

    this.tokenEl = this.root.querySelector('#token-value')!;
    this.objectivesEl = this.root.querySelector('#objectives')!;
    this.peopleRemainingEl = this.root.querySelector('#people-remaining')!;
    this.prompt = this.root.querySelector('#interact-prompt')!;
    this.npcPanel = this.root.querySelector('#npc-panel')!;
    this.toastBox = this.root.querySelector('#toast-box')!;
    this.fpsEl = this.root.querySelector('#fps')!;
    this.compass = this.root.querySelector('#compass')!;
    this.cityLabel = this.root.querySelector('#city-label')!;
    this.banner = this.root.querySelector('#event-banner')!;
    this.levelBanner = this.root.querySelector('#level-banner')!;
    this.pauseOverlay = this.root.querySelector('#pause-overlay')!;
    this.finalOverlay = this.root.querySelector('#final-overlay')!;
    this.fadeOverlay = this.root.querySelector('#fade-overlay')!;

    this.root.querySelector('#pause-btn')!.addEventListener('click', () => this.onPauseClick?.());
    this.root.querySelector('#resume-btn')!.addEventListener('click', () => this.onPauseClick?.());
    this.root.querySelector('#shop-btn')!.addEventListener('click', () => this.onShopClick?.());
  }

  private subscribe(): void {
    this.bus.on('tokensChanged', (t) => {
      this.tokenEl.textContent = formatTokens(t);
      flash(this.tokenEl, 'token-flash');
    });

    this.bus.on('inventoryChanged', (snap) => {
      for (const type of RESOURCE_TYPES) {
        const el = this.satchel[type];
        if (el.textContent !== String(snap[type])) flash(el, 'bump');
        el.textContent = String(snap[type]);
      }
    });

    this.bus.on('objectivesChanged', (list) => this.renderObjectives(list));

    this.bus.on('peopleRemaining', (n) => {
      this.peopleRemainingEl.textContent = `People remaining: ${n}`;
    });

    this.bus.on('promptChanged', (text) => {
      if (text) {
        this.prompt.textContent = text;
        this.prompt.classList.remove('hidden');
      } else {
        this.prompt.classList.add('hidden');
      }
    });

    this.bus.on('npcPanel', (data) => this.renderNpcPanel(data));
    this.bus.on('toast', (text) => this.toast(text));
    this.bus.on('worldEventBanner', (text) => this.showEventBanner(text));
    this.bus.on('levelChanged', (lvl) => this.showLevelBanner(lvl));
    this.bus.on('cinematicChanged', (active) => this.root.classList.toggle('cinematic', active));
    this.bus.on('levelTransition', (active) => this.fadeOverlay.classList.toggle('show', active));
    this.bus.on('missionComplete', () => this.showFinal());
  }

  private renderObjectives(list: ObjectiveProgress[]): void {
    this.objectivesEl.innerHTML = list
      .map((o) => {
        const pct = Math.min(100, o.need ? (o.have / o.need) * 100 : 100);
        const done = o.have >= o.need;
        return `
          <div class="objective ${done ? 'done' : ''}">
            <span class="obj-icon">${ResourceIcons[o.type]}</span>
            <span class="obj-name">${ResourceLabels[o.type]}</span>
            <span class="obj-count">${o.have} / ${o.need}</span>
            <div class="obj-bar"><div class="obj-fill" style="width:${pct}%"></div></div>
          </div>`;
      })
      .join('');
  }

  private renderNpcPanel(data: NpcPanelData | null): void {
    if (!data) {
      this.npcPanel.classList.add('hidden');
      return;
    }
    const cls = data.status === 'helped' ? 'helped' : data.status === 'denied' ? 'denied' : 'asking';
    this.npcPanel.className = `npc-panel ${cls}`;
    this.npcPanel.innerHTML = `
      <div class="npc-icon">${ResourceIcons[data.resource]}</div>
      <div class="npc-text">
        <div class="npc-request">“${data.request}”</div>
        ${data.acknowledgment ? `<div class="npc-ack">${data.acknowledgment}</div>` : ''}
      </div>`;
  }

  private toast(text: string): void {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    this.toastBox.appendChild(el);
    window.setTimeout(() => el.classList.add('show'), 10);
    window.setTimeout(() => {
      el.classList.remove('show');
      window.setTimeout(() => el.remove(), 400);
    }, 2200);
  }

  private showEventBanner(text: string): void {
    this.banner.textContent = text;
    this.banner.classList.remove('hidden');
    this.banner.classList.add('show');
    window.setTimeout(() => {
      this.banner.classList.remove('show');
      window.setTimeout(() => this.banner.classList.add('hidden'), 600);
    }, 3200);
  }

  private showLevelBanner(lvl: { index: number; total: number; name: string; country: string; subtitle: string; situation: string }): void {
    this.cityLabel.textContent = `${lvl.name}, ${lvl.country}`;
    this.levelBanner.innerHTML = `
      <div class="level-kicker">Level ${lvl.index + 1} of ${lvl.total}</div>
      <div class="level-name">${lvl.name}</div>
      <div class="level-country">${lvl.country}</div>
      <div class="level-sub">${lvl.subtitle}</div>
      <div class="level-situation">${lvl.situation}</div>`;
    this.levelBanner.classList.remove('hidden');
    this.levelBanner.classList.add('show');
    window.setTimeout(() => {
      this.levelBanner.classList.remove('show');
      window.setTimeout(() => this.levelBanner.classList.add('hidden'), 800);
    }, 4000);
  }

  private showFinal(): void {
    this.finalOverlay.classList.remove('hidden');
    requestAnimationFrame(() => this.finalOverlay.classList.add('visible'));
  }

  setPaused(paused: boolean): void {
    this.pauseOverlay.classList.toggle('hidden', !paused);
  }

  tick(fps: number, bearing: number): void {
    this.fpsEl.textContent = `${fps}`;
    (this.compass.firstElementChild as HTMLElement).style.transform = `rotate(${bearing}rad)`;
  }

  show(): void {
    this.root.classList.remove('hidden');
  }
}

function formatTokens(t: number): string {
  return Number.isInteger(t) ? String(t) : t.toFixed(1);
}

function flash(el: HTMLElement, cls: string): void {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}
