import {beforeEach,expect,it} from 'vitest';
import {gridInsert,resetColliderGrid} from './colliders';
import {DriveRecovery} from './driveRecovery';
beforeEach(resetColliderGrid);
const p=(x:number,z=0)=>({x,z});
it('does not trigger for idling, turning in place, or steady driving',()=>{
 const d=new DriveRecovery();d.reset(p(0));
 for(let i=0;i<100;i++)d.track(.05,p(0),false,2,30);
 for(let i=0;i<100;i++)d.track(.05,p(i*.15),true,2,30);
 expect(d.ready).toBe(false);expect(d.destination(p(15),2,30)).toBeNull();
});
it('detects sustained input without progress and keeps recovery tappable after release',()=>{
 const d=new DriveRecovery();d.reset(p(0));
 for(let x=0;x<=10;x+=.5)d.track(.05,p(x),true,2,30);
 for(let i=0;i<30;i++)d.track(.05,p(10+(i%2)*.03),true,2,30);
 d.track(.05,p(10),false,2,30);expect(d.ready).toBe(true);
 expect(d.destination(p(10),2,30)).toEqual(p(8));
 d.track(.05,p(9),true,2,30);expect(d.ready).toBe(false);
});
it('rejects an obstructed trail and finds room inside the perimeter on a fresh map',()=>{
 const d=new DriveRecovery();d.reset(p(9));gridInsert({x:9,z:0,r:2,h:5,y0:0});
 for(let i=0;i<30;i++)d.track(.05,p(9),true,2,10);
 const q=d.destination(p(9),2,10)!;
 expect(Math.hypot(q.x-9,q.z)).toBeGreaterThanOrEqual(5-1e-6);
 expect(Math.hypot(q.x,q.z)).toBeLessThanOrEqual(9);
 d.reset(q);expect(d.destination(q,2,10)).toBeNull();
});
