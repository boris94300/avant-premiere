import type * as THREE from "three";
export declare function createPostStack(o: { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.Camera; bloom?: { threshold: number; strength: number; radius: number }; vignette?: number; toneMapping?: { mode: "ACESFilmic" | "AgX" | "Neutral"; exposure: number } }): {
  render(dt: number): void; setSize(w: number, h: number): void; dispose(): void;
};
