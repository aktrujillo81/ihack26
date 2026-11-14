/** The single swap point for the map library. */
import { LeafletMap } from "./LeafletMap";
import type { MapRenderer } from "./types";

export const Renderer: MapRenderer = LeafletMap;
