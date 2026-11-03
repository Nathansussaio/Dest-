/* Na versão web, o mapa é o esquemático (o mapa real é dos apps de iPhone e Android) */
import React from 'react';
import { SchematicMap } from './SchematicMap';
import type { MapItem } from './types';

export function PlacesMap(props: { items: MapItem[]; sel: string | null; onSelect: (k: string) => void; color: string }) {
  return <SchematicMap {...props} />;
}
