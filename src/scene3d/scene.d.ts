import type * as THREE from "three";
export declare const LANTERN_POS: THREE.Vector3;
export declare const DECK_Y: number;
export declare const WATER_Y: number;
export declare function createScene(o: { renderer: THREE.WebGLRenderer; look: { sky: { zenith: string; horizon: string }; fog: { color: string; density: number } } }): {
  scene: THREE.Scene;
  lights: { moon: THREE.DirectionalLight; fill: THREE.HemisphereLight; lantern: THREE.PointLight };
  materials: Record<string, THREE.MeshStandardMaterial>;
  setMoonDirection(azimuthDeg: number, elevationDeg: number): void;
  update(dt: number): boolean;
  dispose(): void;
};
