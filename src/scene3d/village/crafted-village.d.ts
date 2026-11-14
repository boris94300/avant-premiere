import type * as THREE from "three";
export declare function village(): {
  group: THREE.Group; subject: THREE.Group;
  night: { anchors: THREE.Vector3[] };
  dynamique: THREE.Object3D[];
  update(dt: number): boolean; dispose(): void;
};
