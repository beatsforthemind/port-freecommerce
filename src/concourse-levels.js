/** Public heights correspond to the actual concourse slabs and express landing. */
export const CONCOURSE_LEVELS=Object.freeze([
  Object.freeze({id:'concourse',number:1,label:'Public concourse',short:'PUBLIC DECK',height:0}),
  Object.freeze({id:'promenade',number:2,label:'Public promenade',short:'PUBLIC PROMENADE',height:7.625}),
  Object.freeze({id:'galleries',number:3,label:'Lantern galleries',short:'LANTERN GALLERIES',height:17.625}),
  Object.freeze({id:'express',number:4,label:'Express overlook',short:'EXPRESS OVERLOOK',height:23.36}),
]);

export const PUBLIC_LIFT_LAYOUT=Object.freeze({
  centerX:28.5,centerZ:-52,
  shaftHalfWidth:1.8,shaftHalfDepth:2,
  cabinHalfWidth:1.45,cabinHalfDepth:1.65,
  doorWidth:2.4,doorHeight:2.4,
});

export const PUBLIC_LIFT_SHAFTS=Object.freeze([-1,1].map(side=>Object.freeze({
  id:side<0?'west':'east',name:side<0?'West lantern lift':'East lantern lift',
  side,x:side*PUBLIC_LIFT_LAYOUT.centerX,z:PUBLIC_LIFT_LAYOUT.centerZ,
  entranceX:side*(PUBLIC_LIFT_LAYOUT.centerX-PUBLIC_LIFT_LAYOUT.shaftHalfWidth),
  minX:side<0?-30.3:26.7,maxX:side<0?-26.7:30.3,minZ:-54,maxZ:-50,
})));

export function concourseLevelAt(feet) {
  let result=CONCOURSE_LEVELS[0],distance=Infinity;
  for(const level of CONCOURSE_LEVELS){const delta=Math.abs(feet-level.height);if(delta<distance){distance=delta;result=level;}}
  return result;
}
