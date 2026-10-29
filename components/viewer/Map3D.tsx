"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import type { Clock } from "@/lib/replay/clock";
import type { MapGrid } from "@/lib/replay/mapAsset";
import type { Model, Unit } from "@/lib/replay/timeline";
import type { Hover } from "./Map2D";
import type { SceneHandle } from "./scene3d";
import type { CostOf } from "@/lib/replay/squads";

export interface Map3DApi {
  resetView(): void; topView(): void; setFollow(v: boolean): void;
  focus(x: number, y: number): void; select(u: Unit | null): void; followUnit(u: Unit | null): void;
  setFeatures(v: boolean): void;
  setSquads(v: boolean): void;
}

/** three.js is imported on demand so the replay list and the rest of the site never download it. */
export function Map3D({ model, map, clock, races, iconOf, iconOfType, costOf, squads, onHover, onSelect, selected, onFail, api }: {
  model: Model; map: MapGrid; clock: Clock; races: Record<number, string>; iconOf: (u: Unit) => string | null;
  iconOfType: (type: string) => string | null; costOf: CostOf; squads: boolean;
  onHover: (h: Hover | null) => void; onSelect: (u: Unit | null) => void; selected: Unit | null; onFail: () => void; api: Ref<Map3DApi>;
}) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<SceneHandle | null>(null);
  const selectedRef = useRef(selected);
  const squadsRef = useRef(squads);
  useEffect(() => { squadsRef.current = squads; scene.current?.setSquads(squads); }, [squads]);
  useEffect(() => { selectedRef.current = selected; scene.current?.select(selected); }, [selected]);

  useImperativeHandle(api, () => ({
    resetView: () => scene.current?.resetView(),
    topView: () => scene.current?.topView(),
    setFollow: (v: boolean) => scene.current?.setFollow(v),
    focus: (x: number, y: number) => scene.current?.focus(x, y),
    select: (u: Unit | null) => scene.current?.select(u),
    followUnit: (u: Unit | null) => scene.current?.followUnit(u),
    setFeatures: (v: boolean) => scene.current?.setFeatures(v),
    setSquads: (v: boolean) => scene.current?.setSquads(v),
  }), []);

  useEffect(() => {
    let cancelled = false;
    import("./scene3d")
      .then(({ mountScene }) => {
        if (cancelled || !host.current) return;
        scene.current = mountScene(host.current, { model, map, clock, races, iconOf, iconOfType, costOf, onHover, onSelect });
        scene.current.select(selectedRef.current);
        scene.current.setSquads(squadsRef.current);
      })
      .catch(() => { if (!cancelled) onFail(); });                  // no WebGL, or the chunk failed to load: caller switches to 2D
    return () => { cancelled = true; scene.current?.dispose(); scene.current = null; };
  }, [model, map, clock, races, iconOf, iconOfType, costOf, onHover, onSelect, onFail]);

  return <div ref={host} className="vw-canvas" />;
}
