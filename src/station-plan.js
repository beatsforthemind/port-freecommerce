/** Draw the real public floors instead of an illustrative cross-shaped map. */
export function createStationPlan(navigation) {
  const ns='http://www.w3.org/2000/svg';
  const svg=document.querySelector('.station-map svg');
  svg.replaceChildren();svg.setAttribute('viewBox','-113 -214 226 322');svg.classList.add('station-plan-live');
  const colors={concourse:'#d5ad83',observation:'#adc6bc',market:'#d1956d',docks:'#91a9ba'};
  const paths=[];
  function add(name,attributes,text) {
    const element=document.createElementNS(ns,name);
    for(const [key,value] of Object.entries(attributes))element.setAttribute(key,String(value));
    if(text)element.textContent=text;
    svg.append(element);return element;
  }
  for(const floor of navigation.surfaces){
    const polygon=floor.polygon||[[floor.minX,floor.minZ],[floor.maxX,floor.minZ],[floor.maxX,floor.maxZ],[floor.minX,floor.maxZ]];
    const raised=Boolean(floor.height>1||floor.axis);
    const path=add('polygon',{points:polygon.map(p=>p.join(',')).join(' '),fill:colors[floor.sector]||colors.concourse,'fill-opacity':raised?.04:.12,stroke:colors[floor.sector]||colors.concourse,'stroke-width':raised?.6:.85,'stroke-dasharray':raised?'2 2':'none'});
    paths.push({path,sector:floor.sector,raised});
  }
  for(const [x,z,number] of [[-7,5,'01'],[72,-17,'02'],[-63,32,'03'],[-4,-151,'04']])add('text',{x,y:z,fill:'#e1d9c1','font-size':7,'font-family':'sans-serif'},number);
  add('path',{d:'M-24 48V-100H24V48Z',fill:'none',stroke:'#e5bc82','stroke-width':.7,'stroke-dasharray':'2 2',opacity:.65});
  const marker=add('circle',{r:2.4,fill:'#f2c98c',stroke:'#182b30','stroke-width':1});
  const caption=add('text',{x:-104,y:101,fill:'#b8c6b8','font-size':4,'font-family':'sans-serif'},'SOLID / PUBLIC DECK    DASHED / UPPER PROMENADE');
  caption.setAttribute('letter-spacing','.2');
  caption.classList.add('plan-legend');
  return {update(position,sector){
    marker.setAttribute('cx',position.x);marker.setAttribute('cy',position.z);
    for(const {path,sector:id,raised} of paths)path.setAttribute('fill-opacity',raised?.05:id===sector?.26:.09);
  }};
}
