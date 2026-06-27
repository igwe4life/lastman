/**
 * Shared street-layout constants for the city. Roads, pedestrian routing, props
 * and traffic all read from here so the geometry, the sidewalks people walk on,
 * the zebra crossings and the side roads always line up.
 *
 * The district is a boulevard running along -Z:
 *   - drivable road occupies |x| < ROAD_HALF_WIDTH
 *   - vehicles drive in two lanes at x = ±LANE_X
 *   - pedestrians walk the sidewalks at x = ±SIDEWALK_X
 *   - people only cross the road at the zebra CROSSINGS (z positions)
 *   - SIDE_ROADS are perpendicular cross-streets
 */
export const STREET = {
  start: 16,
  end: -92,
  roadHalfWidth: 4, // painted road edge to centre
  laneX: 2.6, // vehicle lane offset from centre
  sidewalkX: 8, // pedestrian lane (inner edge of the raised sidewalk)
  sidewalkOuter: 14,
} as const;

/** Z positions of zebra crossings across the main road. */
export const CROSSINGS = [-6, -34, -64];

/** Z positions of perpendicular side roads (cross-streets). */
export const SIDE_ROADS = [-20, -50];
