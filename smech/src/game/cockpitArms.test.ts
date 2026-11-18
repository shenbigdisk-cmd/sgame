import { expect, it } from 'vitest';
import * as THREE from 'three';
import { makeHardpoint, poseHardpoint } from './cockpitArms';
import { VEHICLES } from './vehicles';

it('fits the installed hardpoints and gives a stripped socket no visible model',()=>{
 const cfg=VEHICLES.pyre;
 expect(makeHardpoint(null,cfg).root.visible).toBe(false);
 expect(makeHardpoint('autocannon',cfg).rotor).toBeInstanceOf(THREE.Group);
 expect(makeHardpoint('scatter',cfg).rotor).toBeUndefined();
});
it('keeps each factory muzzle in the lower side of the viewport, away from the reticle',()=>{
 for(const aspect of [.5,1,16/9,2.2])for(const fov of [55,70,95])for(const cfg of Object.values(VEHICLES)){
  const cam=new THREE.PerspectiveCamera(fov,aspect,.1,100);
  [cfg.loadout.primary,cfg.loadout.secondary].forEach((id,i)=>{
   const arm=makeHardpoint(id,cfg);poseHardpoint(arm.root,i,aspect,fov,0);
   const tip=arm.tip.getWorldPosition(new THREE.Vector3()).project(cam);
   expect(tip.y).toBeGreaterThan(-.9);expect(tip.y).toBeLessThan(-.42);
   expect(tip.x*(i?1:-1)).toBeGreaterThan(.32);expect(Math.abs(tip.x)).toBeLessThan(.8);
  });
 }
});
