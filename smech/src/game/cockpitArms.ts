import * as THREE from 'three';
import type { VehicleConfig } from './vehicles';
import type { WeaponId } from './types';
import { createBeveledBox, getBrushedMetalNormalTexture } from './saltlineVisuals';

/** First-person hardpoints. Local forward is -Z, with the breech towards the pilot. */
export function makeHardpoint(id: WeaponId | null, cfg: VehicleConfig) {
  const root=new THREE.Group(), tip=new THREE.Object3D();
  root.name=`hardpoint:${id ?? 'empty'}`; root.add(tip);
  let rotor: THREE.Group | undefined;
  if(!id){root.visible=false;return {root,tip,rotor};}
  const normalMap = getBrushedMetalNormalTexture();
  const mat = (color: THREE.ColorRepresentation, metalness = 0.68, roughness = 0.36) =>
    new THREE.MeshStandardMaterial({
      color,
      metalness,
      roughness,
      normalMap,
      normalScale: new THREE.Vector2(0.25, 0.25),
    });
  const alloy=mat(cfg.armorColor, 0.70, 0.34), steel=mat(0x66747b, 0.82, 0.30), dark=mat(0x222c33, 0.75, 0.42), copper=mat(0xad633a, 0.85, 0.26), bone=mat(0xadc5c9, 0.62, 0.36);
  const lamp=new THREE.MeshStandardMaterial({color:cfg.accent,emissive:cfg.accent,emissiveIntensity:1.8,toneMapped:false});
  const ember=new THREE.MeshStandardMaterial({color:0xffb271,emissive:0xff5a18,emissiveIntensity:2.0,toneMapped:false});
  const mesh=(geo:THREE.BufferGeometry,m:THREE.Material,x:number,y:number,z:number,parent:THREE.Object3D=root)=>{const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);parent.add(o);return o};
  const box=(w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material)=>mesh(createBeveledBox(w,h,d,0.012),m,x,y,z);
  const tube=(r:number,end:number,len:number,x:number,y:number,z:number,m:THREE.Material,n=20,parent:THREE.Object3D=root)=>{const o=mesh(new THREE.CylinderGeometry(end,r,len,n),m,x,y,z,parent);o.rotation.x=-Math.PI/2;return o};
  const hoop=(r:number,t:number,z:number,m:THREE.Material)=>mesh(new THREE.TorusGeometry(r,t,6,18),m,0,0,z);
  const rib=(z:number)=>box(.48,.046,.065,0,.206,z,dark);
  const tipAt=(z:number,x=0,y=0)=>tip.position.set(x,y,z);
  // The heel disappears below the sill; nothing floats in front of the windscreen.
  box(.34,.32,1.65,0,-.13,.43,dark);
  switch(id){
    case 'autocannon': {
      tube(.38,.30,.99,0,0,-.08,alloy,8);rotor=new THREE.Group();root.add(rotor);
      for(let i=0;i<5;i++){const a=i*2*Math.PI/5;tube(.087,.087,1.35,.157*Math.cos(a),.157*Math.sin(a),-1.15,steel,10,rotor)}
      for(const z of [-.66,-1.48])hoop(.206,.047,z,dark);
      box(.32,.08,.55,0,.32,-.06,steel);box(.07,.02,.32,0,.368,-.06,lamp);tipAt(-1.85);break;
    }
    case 'cannon': {
      box(.54,.41,1.18,0,0,-.14,alloy);for(const z of [.25,.05,-.15,-.35])rib(z);
      tube(.22,.16,1.0,0,0,-1.08,steel);const brake=box(.39,.32,.47,0,0,-1.65,dark);
      for(const z of [-1.52,-1.69])box(.395,.04,.065,0,.12,z,steel);
      box(.07,.045,.52,-.21,.224,.02,lamp);tipAt(brake.position.z-.245);break;
    }
    case 'scatter': {
      // Short, broad bank of six ports with brass-backed rounds visible above the breech.
      box(.8,.35,.77,0,-.02,-.14,alloy);
      for(const y of [-.13,.13])for(const x of [-.26,0,.26]){
        tube(.148,.143,.93,x,y,-.80,dark,8);tube(.145,.153,.12,x,y,-1.22,copper,8);
      }
      for(const x of [-.23,0,.23])tube(.086,.086,.48,x,.22,-.05,copper);
      tipAt(-1.30);break;
    }
    case 'flame': {
      tube(.22,.15,1.33,0,0,-.60,dark);for(const x of [-.23,.23]){
        tube(.14,.14,.82,x,.045,-.06,copper);for(const z of [-.34,.21])tube(.15,.15,.08,x,.045,z,dark);
      }
      tube(.14,.29,.47,0,0,-1.36,copper,8);hoop(.238,.033,-1.51,ember);hoop(.29,.032,-1.59,dark);
      const pilot=mesh(new THREE.OctahedronGeometry(.14),ember,.14,.15,-1.59);pilot.scale.z=1.6;
      tipAt(-1.64);break;
    }
    case 'coil': case 'cryo': {
      const len=id==='coil'?2.12:1.85;
      tube(.14,.045,len,0,0,-len/2,bone,8);
      for(const x of [-.21,.21]) {box(.09,.22,1.48,x,0,-.65,alloy);box(.055,.025,1.13,x,.124,-.7,lamp)}
      for(let i=0;i<5;i++){const z=-.31-i*.30;hoop(.22-i*.018,.033,z,steel);hoop(.22-i*.018,.019,z-.057,lamp)}
      tipAt(-len);break;
    }
    case 'cryoball': {
      tube(.34,.34,.91,0,0,-.18,bone,8);tube(.24,.30,.72,0,0,-.91,alloy,8);hoop(.29,.046,-1.24,lamp);
      for(const x of [-.22,0,.22]){tube(.094,.094,.67,x,.275,-.19,lamp);for(const z of [.1,-.45])tube(.107,.107,.095,x,.275,z,steel)}
      tipAt(-1.30);break;
    }
    case 'emp': {
      const electric=new THREE.MeshStandardMaterial({color:0x84e9ff,emissive:0x29bce8,emissiveIntensity:1.8});
      box(.58,.42,1.12,0,0,-.22,dark);tube(.13,.10,1.6,0,0,-.97,electric,10);
      for(const x of [-.23,.23]){box(.10,.23,1.55,x,0,-.92,alloy);box(.055,.025,1.22,x,.14,-.92,electric)}
      for(const z of [-.65,-1.1,-1.5])hoop(.25,.035,z,electric);
      tipAt(-1.78);break;
    }
  }
  return {root,tip,rotor};
}

/** Fit to the *unzoomed* frustum so narrow screens retain a clear center lane. */
export function poseHardpoint(
  root: THREE.Group,
  index: number,
  aspect: number,
  fov: number,
  recoil: number,
  swayX = 0,
  swayY = 0,
  strideThump = 0
) {
  const k = Math.tan((fov * Math.PI) / 360) / Math.tan((70 * Math.PI) / 360);
  const lateral = Math.min(aspect, 2.2);
  root.scale.setScalar(0.68 * k * Math.min(1, aspect / 0.95));
  root.position.set(
    (index ? 1 : -1) * 1.13 * lateral * k + swayX * 0.7,
    -1.42 * k + swayY * 0.7 + strideThump * 0.35 + recoil * 0.05,
    -2.48 + recoil * 0.35
  );
  root.rotation.x = recoil * 0.22 - swayY * 0.9 + strideThump * 0.15;
  root.rotation.y = swayX * 0.9 + (index ? -1 : 1) * recoil * 0.035;
  root.rotation.z = -swayX * 0.5 + (index ? 1 : -1) * recoil * 0.045;
}
