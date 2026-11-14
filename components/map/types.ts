/**
 * The only contract between the map and the rest of the app. To swap the map
 * library, write a client component with these props and export it from
 * `./renderer.ts`. Nothing else changes.
 */
import type { ComponentType } from "react";

import type { TileSource } from "@/lib/config/map";

import type { MapPin } from "./pins";

export interface MapRendererProps {
  pins: MapPin[];
  /** Null means a plain background with no tiles. */
  tileSource: TileSource | null;
}

export type MapRenderer = ComponentType<MapRendererProps>;
