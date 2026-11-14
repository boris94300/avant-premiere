import type * as THREE from "three";
export declare function createNightLighting(scene: THREE.Scene, renderer: THREE.WebGLRenderer, studio: Record<string, { visible?: boolean }>): {
  activate(name: string, model: unknown): void;
  set(patch: Partial<{ warm: number; key: number; sky: number; exposure: number; azimuth: number; elevation: number }>): void;
  dispose(): void;
};
