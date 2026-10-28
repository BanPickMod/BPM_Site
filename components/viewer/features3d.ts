import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { MapGrid } from "@/lib/replay/mapAsset";
import { themeFor, type Theme } from "./terrain";

/**
 * What the map maker placed, drawn with our own simple shapes so the layout is recognisable: tall grass and bushes (vision blockers),
 * trees, rocks, columns, ruins, buildings, walls, crystals, destructible rocks, Xel'Naga towers and geysers. Only names and positions come
 * from the map file; no game model or texture is used.
 */
type G = THREE.BufferGeometry;
const hash = (x: number, y: number) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };

function paint(g: G, c: [number, number, number]): G {
  const n = g.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2]; }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}
const place = (g: G, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0): G => {
  const c = (g.index ? g.toNonIndexed() : g.clone()) as G;
  c.deleteAttribute("uv");
  if (c.attributes.normal === undefined) c.computeVertexNormals();
  c.scale(sx, sy, sz); c.rotateX(rx); c.rotateY(ry); c.rotateZ(rz); c.translate(x, y, z);
  return c;
};
const box = (c: [number, number, number], ...a: number[]) => paint(place(new THREE.BoxGeometry(1, 1, 1), ...(a as [number, number, number])), c);
const cone = (c: [number, number, number], seg: number, ...a: number[]) => paint(place(new THREE.ConeGeometry(0.5, 1, seg), ...(a as [number, number, number])), c);
const cyl = (c: [number, number, number], seg: number, ...a: number[]) => paint(place(new THREE.CylinderGeometry(0.5, 0.5, 1, seg), ...(a as [number, number, number])), c);
const ico = (c: [number, number, number], ...a: number[]) => paint(place(new THREE.IcosahedronGeometry(0.5, 0), ...(a as [number, number, number])), c);
const oct = (c: [number, number, number], ...a: number[]) => paint(place(new THREE.OctahedronGeometry(0.5), ...(a as [number, number, number])), c);
const merge = (parts: G[]): G => mergeGeometries(parts.map((p) => { if (p.index) p = p.toNonIndexed(); return p; }))!;
const shade = (c: [number, number, number], k: number): [number, number, number] => [c[0] * k, c[1] * k, c[2] * k];

function shapes(th: Theme): Record<string, G> {
  const dark = shade(th.tree, 0.7), trunk: [number, number, number] = [0.22, 0.14, 0.09];
  return {
    // a clump of blades: reads as tall grass / a bush from above
    grass: merge([0, 1, 2, 3, 4, 5, 6].map((i) => { const a = (i / 7) * Math.PI * 2, r = i === 6 ? 0 : 0.55; return cone(i % 2 ? shade(th.grass, 0.8) : th.grass, 5, Math.cos(a) * r, 0.7, Math.sin(a) * r, 0.34, 1.5 + (i % 3) * 0.3, 0.34, Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3); })),
    tree: merge([cyl(trunk, 6, 0, 0.8, 0, 0.36, 1.6, 0.36), cone(th.tree, 7, 0, 2.2, 0, 2.6, 2.0, 2.6), cone(shade(th.tree, 1.15), 7, 0, 3.4, 0, 2.0, 1.8, 2.0), cone(dark, 7, 0, 4.4, 0, 1.3, 1.5, 1.3)]),
    rock: merge([ico(shade(th.stone, 0.55), 0, 0.45, 0, 1.7, 1.1, 1.4), ico(shade(th.stone, 0.7), 0.7, 0.25, 0.3, 0.9, 0.6, 0.8)]),
    column: merge([box(shade(th.stone, 0.8), 0, 0.25, 0, 1.4, 0.5, 1.4), cyl(th.stone, 6, 0, 2.0, 0, 0.9, 3.2, 0.9), box(shade(th.stone, 0.9), 0, 3.75, 0, 1.3, 0.35, 1.3)]),
    ruin: merge([box(shade(th.stone, 0.75), 0, 0.3, 0, 3.0, 0.6, 2.2), box(th.stone, -0.4, 1.3, 0.1, 1.5, 1.6, 1.2), box(shade(th.stone, 1.1), 0.9, 0.9, -0.3, 0.8, 1.0, 0.8), box(th.glow, -0.4, 2.15, 0.1, 0.5, 0.1, 0.5)]),
    building: merge([box(th.building, 0, 1.0, 0, 2.6, 2.0, 2.6), box(shade(th.building, 0.7), 0, 2.1, 0, 2.85, 0.22, 2.85), box(shade(th.building, 1.2), 0.7, 2.5, 0.5, 0.8, 0.55, 0.8)]),
    wall: merge([box(shade(th.building, 0.85), 0, 0.65, 0, 3.4, 1.3, 0.55), box(shade(th.building, 0.6), 0, 1.35, 0, 3.6, 0.15, 0.75)]),
    crystal: merge([oct(th.glow, 0, 1.0, 0, 0.8, 2.4, 0.8), oct(shade(th.glow, 0.8), 0.6, 0.6, 0.2, 0.5, 1.5, 0.5), oct(shade(th.glow, 0.9), -0.5, 0.5, -0.3, 0.45, 1.2, 0.45)]),
    prop: merge([box([0.45, 0.3, 0.2], 0, 0.35, 0, 0.9, 0.7, 0.9), box([0.55, 0.4, 0.25], 0.5, 0.2, 0.4, 0.5, 0.4, 0.5)]),
  };
}

const CAST = new Set(["tree", "rock", "column", "ruin", "building", "wall"]);
const SIZE: Record<string, [number, number]> = { grass: [0.8, 2.0], tree: [0.8, 1.8], rock: [0.7, 2.2], column: [0.8, 1.6], ruin: [0.8, 1.8], building: [0.7, 1.3], wall: [0.8, 1.8], crystal: [0.8, 1.8], prop: [0.8, 1.5] };

export interface Features { group: THREE.Group; setVisible(v: boolean): void; counts: Record<string, number>; dispose(): void }

export function buildFeatures(M: MapGrid, heightAt: (x: number, y: number) => number, lx: (x: number) => number, lz: (y: number) => number): Features {
  const th = themeFor(M.tileSet), group = new THREE.Group(), geos = shapes(th), counts: Record<string, number> = {};
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0.02 });
  const glowMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, emissive: new THREE.Color(th.glow[0], th.glow[1], th.glow[2]), emissiveIntensity: 0.55 });
  const dummy = new THREE.Object3D(), tint = new THREE.Color();

  for (const cls of Object.keys(geos)) {
    const list = M.doodads.filter((d) => d.cls === cls && d.x >= 0 && d.y >= 0 && d.x < M.w && d.y < M.h);
    if (!list.length) continue;
    counts[cls] = list.length;
    const mesh = new THREE.InstancedMesh(geos[cls], cls === "crystal" ? glowMat : mat, list.length);
    const [lo, hi] = SIZE[cls];
    list.forEach((d, i) => {
      const j = hash(d.x * 3.1, d.y * 1.7), s = Math.min(hi, Math.max(lo, d.scale * (0.85 + j * 0.3)));
      dummy.position.set(lx(d.x), heightAt(d.x, d.y), lz(d.y));
      dummy.rotation.set(0, (d.rot * Math.PI) / 180, 0);
      dummy.scale.set(s * (cls === "rock" ? 0.8 + j * 0.6 : 1), s * (cls === "building" ? 0.8 + j * 0.8 : cls === "rock" ? 0.7 + j * 0.7 : 1), s * (cls === "rock" ? 0.8 + (1 - j) * 0.6 : 1));
      dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
      const v = 0.82 + hash(d.x, d.y * 2.3) * 0.34; tint.setRGB(v, v, v); mesh.setColorAt(i, tint);
    });
    mesh.castShadow = CAST.has(cls); mesh.receiveShadow = cls !== "grass"; mesh.frustumCulled = false;
    group.add(mesh);
  }

  // destructible rocks: a rust-coloured pile on a translucent footprint, so they read as "can be broken"
  const dest = M.special.filter((u) => u.kind === "dest");
  if (dest.length) {
    const rockGeo = ico([0.62, 0.34, 0.2], 0, 0.5, 0, 1.6, 1.3, 1.5);
    const pieces = dest.flatMap((u) => { const n = Math.max(3, Math.round((u.w * u.h) / 5)); return Array.from({ length: n }, (_, k) => ({ u, k, n })); });
    const mesh = new THREE.InstancedMesh(rockGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), pieces.length);
    pieces.forEach(({ u, k }, i) => {
      const a = hash(u.x + k, u.y * 1.3 + k * 7), b = hash(u.y + k * 3, u.x * 0.7), cos = u.diagonal ? Math.SQRT1_2 : 1, sin = u.diagonal ? Math.SQRT1_2 : 0;
      const ox = (a - 0.5) * (u.w - 1.4), oy = (b - 0.5) * (u.h - 1.4), rx = ox * cos - oy * sin, ry = ox * sin + oy * cos;
      dummy.position.set(lx(u.x + rx), heightAt(u.x + rx, u.y + ry), lz(u.y + ry));
      dummy.rotation.set(0, a * 6.28, 0); const s = 0.9 + b * 0.9; dummy.scale.set(s, s * (0.9 + a * 0.6), s); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; group.add(mesh);
    for (const u of dest) {
      const pad = new THREE.Mesh(new THREE.PlaneGeometry(u.w, u.h), new THREE.MeshBasicMaterial({ color: 0xff8c3c, transparent: true, opacity: 0.22, depthWrite: false }));
      pad.rotation.x = -Math.PI / 2; pad.rotation.z = u.diagonal ? Math.PI / 4 : 0; pad.position.set(lx(u.x), heightAt(u.x, u.y) + 0.2, lz(u.y)); group.add(pad);
    }
    counts.destructible = dest.length;
  }
  for (const u of M.special.filter((q) => q.kind === "plate")) {
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(u.w, u.h), new THREE.MeshBasicMaterial({ color: 0xaab4d0, transparent: true, opacity: 0.28, depthWrite: false }));
    pad.rotation.x = -Math.PI / 2; pad.rotation.z = u.diagonal ? Math.PI / 4 : 0; pad.position.set(lx(u.x), heightAt(u.x, u.y) + 0.18, lz(u.y)); group.add(pad);
  }

  // Xel'Naga towers: a lit pillar and a ring that shows how far it sees
  for (const u of M.special.filter((q) => q.kind === "tower")) {
    const y = heightAt(u.x, u.y);
    const tower = new THREE.Mesh(merge([cyl([0.3, 0.36, 0.4], 10, 0, 0.35, 0, 3.0, 0.7, 3.0), cyl([0.5, 0.58, 0.62], 8, 0, 3.0, 0, 1.0, 5.2, 1.0), cyl(th.glow, 12, 0, 5.7, 0, 2.0, 0.25, 2.0), cone(th.glow, 6, 0, 6.6, 0, 0.9, 1.4, 0.9)]), glowMat);
    tower.position.set(lx(u.x), y, lz(u.y)); tower.castShadow = true; group.add(tower);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(22, 0.12, 6, 96), new THREE.MeshBasicMaterial({ color: new THREE.Color(th.glow[0], th.glow[1], th.glow[2]), transparent: true, opacity: 0.35, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(lx(u.x), y + 0.4, lz(u.y)); group.add(ring);
    counts.tower = (counts.tower ?? 0) + 1;
  }

  // geysers: a dark vent with a green glow
  if (M.gas.length) {
    const geo = merge([cyl([0.16, 0.17, 0.2], 10, 0, 0.35, 0, 3.4, 0.7, 3.4), cyl([0.1, 0.1, 0.12], 10, 0, 0.74, 0, 2.2, 0.12, 2.2)]);
    const base = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }), M.gas.length);
    const glow = new THREE.InstancedMesh(new THREE.CircleGeometry(1.0, 20), new THREE.MeshBasicMaterial({ color: 0x5ee08a, transparent: true, opacity: 0.9 }), M.gas.length);
    M.gas.forEach(([x, y], i) => {
      const h = heightAt(x, y);
      dummy.position.set(lx(x), h, lz(y)); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); base.setMatrixAt(i, dummy.matrix);
      dummy.position.set(lx(x), h + 0.82, lz(y)); dummy.rotation.set(-Math.PI / 2, 0, 0); dummy.updateMatrix(); glow.setMatrixAt(i, dummy.matrix);
    });
    base.castShadow = true; base.frustumCulled = glow.frustumCulled = false; group.add(base, glow);
    counts.gas = M.gas.length;
  }

  return {
    group, counts,
    setVisible(v: boolean) { group.visible = v; },
    dispose() {
      group.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mt = m.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mt) ? mt : mt ? [mt] : []).forEach((x) => x.dispose());
      });
    },
  };
}
