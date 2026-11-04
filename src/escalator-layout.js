import {CONCOURSE_LEVELS} from './concourse-levels.js';

/** Six one-way flights sit inside the balconies, leaving the trading walks intact. */
export const PROMENADE_HEIGHT=CONCOURSE_LEVELS[1].height;
export const ESCALATOR_SPEED=.8;
export const ESCALATOR_FLAT=1.2;
export const ESCALATOR_WIDTH=2.2;

const banks=Object.freeze([
  Object.freeze({id:'arrivals',name:'Arrivals',topZ:54,bottomZ:80}),
  Object.freeze({id:'interchange',name:'Interchange',topZ:-48,bottomZ:-30}),
  Object.freeze({id:'departures',name:'Departures',topZ:-110,bottomZ:-92}),
]);

export const ESCALATORS=Object.freeze(banks.flatMap(bank=>[-1,1].map(side=>Object.freeze({
  id:`${bank.id}-${side<0?'up':'down'}`,bankId:bank.id,
  name:`${bank.name} ${side<0?'ascending':'descending'} escalator`,
  side,x:side*18.75,direction:side<0?1:-1,width:ESCALATOR_WIDTH,
  bottomZ:bank.bottomZ,topZ:bank.topZ,bottomHeight:0,topHeight:PROMENADE_HEIGHT,
  supportX:side*(bank.id==='interchange'?19.7:20.7),
  landing:Object.freeze({
    minX:side<0?-23:17.3,maxX:side<0?-17.3:23,
    minZ:bank.topZ-2.8,maxZ:bank.topZ,height:PROMENADE_HEIGHT,
  }),
}))));

/** Open the existing inner balustrade only where a new landing joins it. */
export function splitPromenadeRail(start,end) {
  let segments=[[start,end]];
  for(const bank of banks){
    const low=bank.topZ-2.9,high=bank.topZ+.15,next=[];
    for(const[a,b]of segments){
      if(high<=a||low>=b){next.push([a,b]);continue;}
      if(low>a)next.push([a,Math.min(low,b)]);
      if(high<b)next.push([Math.max(a,high),b]);
    }
    segments=next;
  }
  return segments;
}
