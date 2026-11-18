import { beforeEach,expect,it } from 'vitest';
import { aimOnHostile } from './aimRing';
import { gridInsert,resetColliderGrid } from './colliders';
const origin={x:0,y:2,z:0},dir={x:0,y:0,z:1},enemy={alive:true,pos:{x:0,y:0,z:30},radius:2,height:4};
const aim=(targets=[enemy],ground=()=>0)=>aimOnHostile(origin,dir,targets,ground);
beforeEach(resetColliderGrid);
it('only marks a live target intersecting the sight line',()=>{
 expect(aim()).toBe(true);expect(aim([])).toBe(false);expect(aim([{...enemy,alive:false}])).toBe(false);
 expect(aim([{...enemy,pos:{x:2.1,y:0,z:30}}])).toBe(false);expect(aim([{...enemy,pos:{x:0,y:0,z:-30}}])).toBe(false);
});
it('does not mark enemies through thin walls or terrain',()=>{
 expect(aim([enemy],()=>3)).toBe(false);
 gridInsert({x:0,z:12.25,r:4.1,h:8,y0:0,box:{hw:4,hd:.05,c:1,s:0,rot:0}});expect(aim()).toBe(false);
});
it('clears low cover but not a tall rock in front',()=>{
 gridInsert({x:0,z:10,r:2,h:1,y0:0});gridInsert({x:0,z:35,r:2,h:5,y0:0});expect(aim()).toBe(true);
 gridInsert({x:0,z:18,r:2,h:3,y0:0});expect(aim()).toBe(false);
});
it('marks visible enemies inside the ring even when the center dot misses',()=>{
 const target={...enemy,pos:{x:3,y:0,z:60},radius:1};
 expect(aimOnHostile(origin,dir,[target],()=>0,.06)).toBe(true);
 expect(aimOnHostile(origin,dir,[target],()=>0,.02)).toBe(false);
 gridInsert({x:1.5,z:30,r:1,h:4,y0:0});
 expect(aimOnHostile(origin,dir,[target],()=>0,.06)).toBe(false);
});
