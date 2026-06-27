import type { GospelResource } from './gameConfig';
import type { ResourceRequirement } from '../gameplay/Inventory';

/**
 * Data-driven city / level definitions. Each city has its own palette,
 * lighting, architecture mix, props and ambient identity, plus the set of
 * distribution objectives the player must complete there and the kind of
 * dynamic world event that opens when those objectives are met.
 *
 * Adding a new level is purely additive: append a CityConfig here.
 */
export type WorldEventKind = 'road' | 'gate' | 'crossing';

export interface CityConfig {
  id: string;
  name: string;
  country: string;
  subtitle: string;
  /** What's happening in this district and what the player must do. */
  situation: string;

  /** Atmospheric sky. elevation/azimuth in degrees. */
  sky: { elevation: number; azimuth: number; turbidity: number; rayleigh: number };
  fog: { color: number; near: number; far: number };
  exposure: number;
  ground: number;
  hemi: { sky: number; ground: number; intensity: number };
  sun: { color: number; intensity: number };

  buildings: {
    count: number;
    palette: number[];
    minHeight: number;
    maxHeight: number;
    /** 'mixed' = high-rise + low residential; 'modern' = glass towers. */
    style: 'mixed' | 'modern';
  };

  props: {
    palms: number;
    trees: number;
    market: boolean;
    park: boolean;
    mountains: boolean;
    busColor: number | null;
    busCount: number;
  };

  npcCount: number;
  objectives: ResourceRequirement;
  event: WorldEventKind;
}

const lagos: CityConfig = {
  id: 'lagos',
  name: 'Lagos',
  country: 'Nigeria',
  subtitle: 'Bright, busy and full of life on the Atlantic coast.',
  situation:
    'A protest has barricaded the road out of the district. Win the people over — hand out Bibles, magazines and books, and pray with those who ask. When enough hearts are reached, the road will be cleared.',
  sky: { elevation: 55, azimuth: 150, turbidity: 8, rayleigh: 1.4 },
  fog: { color: 0xd9e4d0, near: 70, far: 360 },
  exposure: 1.15,
  ground: 0xb7a98a,
  hemi: { sky: 0xfff4d0, ground: 0x7a6a4a, intensity: 0.7 },
  sun: { color: 0xfff1cf, intensity: 3.6 },
  buildings: {
    count: 64,
    palette: [0xd98c4a, 0xe2b35a, 0xc46b3d, 0xddd2bd, 0x9fb6c4, 0xcf7f56],
    minHeight: 5,
    maxHeight: 34,
    style: 'mixed',
  },
  props: { palms: 40, trees: 10, market: true, park: false, mountains: false, busColor: 0xffd21f, busCount: 4 },
  npcCount: 34,
  objectives: { bibles: 6, magazines: 4, prayerPoints: 2, books: 1 },
  event: 'road',
};

const accra: CityConfig = {
  id: 'accra',
  name: 'Accra',
  country: 'Ghana',
  subtitle: 'Warm evening light over wide, modern boulevards.',
  situation:
    'A frightened community has locked its gate. Serve the people on the streets and reassure them with the Good News. As their confidence grows, the community gate will open.',
  sky: { elevation: 14, azimuth: 250, turbidity: 6, rayleigh: 2.6 },
  fog: { color: 0xf0cfa0, near: 80, far: 380 },
  exposure: 1.1,
  ground: 0xa89b6f,
  hemi: { sky: 0xffd9a0, ground: 0x6f5f3f, intensity: 0.6 },
  sun: { color: 0xffb86b, intensity: 3.2 },
  buildings: {
    count: 56,
    palette: [0xe8e2d4, 0xcfd8df, 0xd8b98a, 0xb9c7b0, 0xa9b8c8, 0xe0d0b8],
    minHeight: 7,
    maxHeight: 30,
    style: 'mixed',
  },
  props: { palms: 22, trees: 30, market: true, park: true, mountains: false, busColor: 0xe24b3a, busCount: 3 },
  npcCount: 30,
  objectives: { bibles: 5, magazines: 3, prayerPoints: 2, books: 2 },
  event: 'gate',
};

const johannesburg: CityConfig = {
  id: 'johannesburg',
  name: 'Johannesburg',
  country: 'South Africa',
  subtitle: 'A modern skyline against the high-veld horizon.',
  situation:
    'Storms have damaged the crossing to the final district. Bring hope to the people of the city — once your mission here is complete, the crossing will be restored and the way to The Last Man will open.',
  sky: { elevation: 38, azimuth: 120, turbidity: 4, rayleigh: 2.0 },
  fog: { color: 0xcdd9e6, near: 90, far: 460 },
  exposure: 1.0,
  ground: 0x9aa882,
  hemi: { sky: 0xbcd6ff, ground: 0x55603f, intensity: 0.55 },
  sun: { color: 0xfff2e0, intensity: 3.3 },
  buildings: {
    count: 70,
    palette: [0x8fa3b8, 0xa6b4c2, 0x6f8294, 0xc2ccd6, 0x7d93a8, 0xb0bcc8],
    minHeight: 12,
    maxHeight: 56,
    style: 'modern',
  },
  props: { palms: 0, trees: 36, market: false, park: true, mountains: true, busColor: 0x2f6fb0, busCount: 3 },
  npcCount: 28,
  objectives: { bibles: 4, magazines: 2, prayerPoints: 3, books: 2 },
  event: 'crossing',
};

export const CITIES: CityConfig[] = [lagos, accra, johannesburg];

/** Resource types in canonical display order. */
export const RESOURCE_TYPES: GospelResource[] = ['bibles', 'magazines', 'books', 'prayerPoints'];
