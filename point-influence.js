// Only nearby and still-fading cells are updated; geometry never moves.
export function createPointInfluence(size, half) {
  const values = new Float32Array(size ** 3), active = new Set(), targets = new Map();
  const step = 2 * half / (size - 1), radius = 2.6;
  return {
    values,
    reset() { values.fill(0); active.clear(); targets.clear(); },
    update(center, dt) {
      targets.clear();
      if (center) {
        const cx=(center.x+half)/step, cy=(center.y+half)/step, cz=(center.z+half)/step;
        for(let x=Math.max(0,Math.ceil(cx-radius));x<=Math.min(size-1,Math.floor(cx+radius));x++)
        for(let y=Math.max(0,Math.ceil(cy-radius));y<=Math.min(size-1,Math.floor(cy+radius));y++)
        for(let z=Math.max(0,Math.ceil(cz-radius));z<=Math.min(size-1,Math.floor(cz+radius));z++) {
          const distance=Math.hypot(x-cx,y-cy,z-cz);
          if(distance>=radius)continue;
          const t=Math.max(0,Math.min(1,(distance-1.1)/(radius-1.1)));
          const index=(x*size+y)*size+z;
          targets.set(index,.95*(1-t*t*(3-2*t))); active.add(index);
        }
      }
      let changed=false;
      for(const index of active) {
        const target=targets.get(index)||0, previous=values[index];
        const tau=target>previous?.22:2.4;
        const next=previous+(target-previous)*(1-Math.exp(-Math.max(0,dt)/tau));
        values[index]=next<.001&&target===0?0:next;
        if(values[index]===0)active.delete(index);
        changed=true;
      }
      return changed;
    }
  };
}
