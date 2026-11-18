import { nearObstacles, obsDist } from './colliders';

type Point = { x:number; z:number };
const dist=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.z-b.z);
const clear=(p:Point,r:number,limit:number)=> Math.hypot(p.x,p.z)<=limit && !nearObstacles(p.x,p.z,r).some(o=>obsDist(o,p.x,p.z)<r);

/** Keep a short trail separate from the solver's last substep. A stationary
 * contact is a valid substep, but is a useless place to recover to. */
export class DriveRecovery {
  private trail:Point[]=[];
  private anchor:Point={x:0,z:0};
  private stalled=0;
  ready=false;
  reset(p:Point){this.trail=[{x:p.x,z:p.z}];this.anchor={x:p.x,z:p.z};this.stalled=0;this.ready=false;}
  track(dt:number,p:Point,driving:boolean,r:number,limit:number){
    if(!this.trail.length)this.reset(p);
    if(dist(p,this.trail[this.trail.length-1])>=2 && clear(p,r+.25,limit-.25)){
      this.trail.push({x:p.x,z:p.z});if(this.trail.length>24)this.trail.shift();
    }
    // Measure actual progress, not engine speed: pushing into a seam may jitter.
    if(dist(p,this.anchor)>.65){this.anchor={x:p.x,z:p.z};this.stalled=0;this.ready=false;}
    else if(driving){this.stalled+=dt;if(this.stalled>=1.2)this.ready=true;}
    else this.stalled=0; // Keep the action available when a thumb leaves the stick.
  }
  destination(p:Point,r:number,limit:number){
    if(!this.ready)return null;
    for(let i=this.trail.length-1;i>=0;i--){const t=this.trail[i];if(dist(t,p)>=r && clear(t,r+.2,limit))return t;}
    // A fresh spawn has no trail yet. Prefer the closest spot with room to turn.
    for(let d=r;d<=r*6;d+=r*.5)for(let i=0;i<24;i++){
      const a=i*Math.PI/12,q={x:p.x+Math.cos(a)*d,z:p.z+Math.sin(a)*d};
      if(clear(q,r+1,limit-1))return q;
    }
    return null;
  }
}
