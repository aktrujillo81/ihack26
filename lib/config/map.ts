/**
 * Map configuration. Client-safe (no secrets, no server-only imports).
 *
 * Tile source: OpenStreetMap's public tile servers are free but best-effort,
 * have no service guarantee, and may be blocked without notice. Their policy
 * (https://operations.osmfoundation.org/policies/tiles/) forbids pre-fetching,
 * bulk download and offline copies, so tiles must NOT be seeded or cached for
 * the demo. The fallback is a plain background (see components/map), never
 * pre-seeded OSM tiles. To use a licensed or self-hosted tile provider, change
 * `TILE_SOURCE` here; nothing else needs to change.
 *
 * Set NEXT_PUBLIC_MAP_TILES=none to turn tiles off entirely (plain background).
 */
export interface TileSource {
  /** Leaflet URL template. Do not send no-cache headers or strip the Referer. */
  urlTemplate: string;
  /** Must stay clearly visible and link to the copyright page (OSM policy). May contain HTML. */
  attribution: string;
  maxZoom: number;
}

export const OSM_TILE_SOURCE: TileSource = {
  urlTemplate: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
  maxZoom: 19,
};

export const TILE_SOURCE: TileSource | null =
  process.env.NEXT_PUBLIC_MAP_TILES === "none" ? null : OSM_TILE_SOURCE;

/** After this many tile errors with no tile loaded, switch to the plain background. */
export const TILE_ERROR_LIMIT = 3;

/** Default dashboard view for the demo region. Pin-filled maps may fit to their pins. */
export const DASHBOARD_MAP_CENTER: [number, number] = [-1.2888, 36.815];

/** Default complaint location-editor view. Existing complaint coordinates override this. */
export const LOCATION_EDITOR_CENTER: [number, number] = [-1.2888, 36.815];
