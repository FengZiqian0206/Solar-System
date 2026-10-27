// Only nearby and still-fading cells are updated; base grid coordinates stay intact.
export function createPointInfluence(size, half) {
  const values = new Float32Array(size ** 3), offsets = new Float32Array(size ** 3 * 3), active = new Set(), targets = new Map();
  const step = 2 * half / (size - 1), radius = 2.1, repelRadius = 5.5;
  return {
    values, offsets,
    reset() { values.fill(0); offsets.fill(0); active.clear(); targets.clear(); },
    update(center, dt) {
      targets.clear();
      if (center) {
        const cx=(center.x+half)/step, cy=(center.y+half)/step, cz=(center.z+half)/step;
        for(let x=Math.max(0,Math.ceil(cx-repelRadius));x<=Math.min(size-1,Math.floor(cx+repelRadius));x++)
        for(let y=Math.max(0,Math.ceil(cy-repelRadius));y<=Math.min(size-1,Math.floor(cy+repelRadius));y++)
        for(let z=Math.max(0,Math.ceil(cz-repelRadius));z<=Math.min(size-1,Math.floor(cz+repelRadius));z++) {
          const distance=Math.hypot(x-cx,y-cy,z-cz);
          if(distance>=repelRadius)continue;
          const t=Math.max(0,Math.min(1,(distance-1.05)/(radius-1.05)));
          const index=(x*size+y)*size+z;
          targets.set(index,.95*(1-t*t*(3-2*t))); active.add(index);
        }
      }
      let changed=false;
      for(const index of active) {
        const target=targets.get(index)||0, previous=values[index];
        const tau=target>previous?.22:6;
        const next=previous+(target-previous)*(1-Math.exp(-Math.max(0,dt)/tau));
        values[index]=next<.001&&target===0?0:next;
        // A separate, shorter-lived offset lets nearby points return without shortening the colour trail.
        const q=index*3;
        let dx=0,dy=0,dz=0,amount=0;
        if(center && targets.has(index)) {
          dx=Math.floor(index/(size*size))*step-half-center.x;
          dy=Math.floor(index/size)%size*step-half-center.y;
          dz=index%size*step-half-center.z;
          const distance=Math.hypot(dx,dy,dz)/step;
          const inner=Math.max(0,Math.min(1,(distance-radius)/.6));
          const outer=Math.max(0,Math.min(1,(distance-radius-.6)/(repelRadius-radius-.6)));
          amount=distance>0?1.8*inner*inner*(3-2*inner)*(1-outer*outer*(3-2*outer))/distance:0;
        }
        const goalDistance=Math.hypot(dx,dy,dz)*amount;
        const previousDistance=Math.hypot(offsets[q],offsets[q+1],offsets[q+2]);
        const response=1-Math.exp(-Math.max(0,dt)/(goalDistance>previousDistance?.18:1.2));
        for(let axis=0;axis<3;axis++) {
          const goal=(axis===0?dx:axis===1?dy:dz)*amount;
          const shifted=offsets[q+axis]+(goal-offsets[q+axis])*response;
          offsets[q+axis]=Math.abs(shifted)<.0001&&goal===0?0:shifted;
        }
        if(values[index]===0 && offsets[q]===0 && offsets[q+1]===0 && offsets[q+2]===0)active.delete(index);
        changed=true;
      }
      return changed;
    }
  };
}
