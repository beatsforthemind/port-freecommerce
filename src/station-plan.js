import {CONCOURSE_LEVELS,PUBLIC_LIFT_SHAFTS,concourseLevelAt} from './concourse-levels.js';
import {ESCALATORS} from './escalator-layout.js';

/** Public floor plans share their geometry with walking, including lift landings. */
export function createStationPlan(navigation,{shops=[]}={}) {
  const ns='http://www.w3.org/2000/svg',svg=document.querySelector('.station-map svg');
  svg.replaceChildren();svg.setAttribute('viewBox','-113 -214 226 322');svg.classList.add('station-plan-live');
  const colors={concourse:'#d5ad83',observation:'#adc6bc',market:'#d1956d',docks:'#91a9ba'},paths=[],listeners=[];
  let selected='concourse',lastSector='concourse',lastPosition=null;
  function add(name,attributes,text){const node=document.createElementNS(ns,name);for(const[key,value]of Object.entries(attributes))node.setAttribute(key,String(value));if(text)node.textContent=text;svg.append(node);return node;}
  for(const floor of navigation.surfaces){
    if(floor.lift||floor.dynamic)continue;
    const polygon=floor.polygon||[[floor.minX,floor.minZ],[floor.maxX,floor.minZ],[floor.maxX,floor.maxZ],[floor.minX,floor.maxZ]];
    const raised=Boolean(floor.height>1||floor.axis),sector=floor.sector||'concourse';
    const deck=floor.axis?'ramp':concourseLevelAt(floor.height||0).id;
    const path=add('polygon',{points:polygon.map(p=>p.join(',')).join(' '),fill:colors[sector]||colors.concourse,'fill-opacity':raised?.06:.12,stroke:colors[sector]||colors.concourse,'stroke-width':raised?.6:.85,'stroke-dasharray':raised?'2 2':'none'});
    paths.push({path,sector,deck,raised});
  }
  for(const[x,z,number]of[[-7,5,'01'],[72,-17,'02'],[-63,32,'03'],[-4,-151,'04']])add('text',{x,y:z,fill:'#e1d9c1','font-size':7,'font-family':'sans-serif'},number);
  for(const shaft of PUBLIC_LIFT_SHAFTS){
    add('rect',{x:shaft.x-1.8,y:shaft.z-2,width:3.6,height:4,fill:'#efc18c',stroke:'#f0cf9f','stroke-width':.6});
    const label=add('text',{x:shaft.side<0?shaft.x-8:shaft.x+4,y:shaft.z+1.6,fill:'#efc18c','font-size':4,'font-family':'sans-serif'},'L');label.classList.add('plan-lift-label');
  }
  const shopMarkers=shops.map(shop=>{
    const node=add('rect',{x:shop.side<0?-31.4:27.1,y:shop.z-shop.width/2,width:4.3,height:shop.width,fill:'#a7bc98','fill-opacity':.7});
    const title=document.createElementNS(ns,'title');title.textContent=`Deck 02 / ${shop.name}`;node.append(title);
    return node;
  });
  const escalatorMarkers=ESCALATORS.map(route=>{
    const node=add('g',{'class':'plan-escalator'}),z=(route.topZ+route.bottomZ)/2;
    const title=document.createElementNS(ns,'title');title.textContent=`${route.name} / Decks 01–02`;node.append(title);
    const arrow=document.createElementNS(ns,'path'),tip=z-route.direction*2.5;
    arrow.setAttribute('d',`M${route.x} ${route.bottomZ}V${route.topZ}M${route.x-1.3} ${tip+route.direction*2}L${route.x} ${tip}L${route.x+1.3} ${tip+route.direction*2}`);
    arrow.setAttribute('fill','none');arrow.setAttribute('stroke','#dec49b');arrow.setAttribute('stroke-width','1');node.append(arrow);
    return node;
  });
  const marker=add('circle',{r:2.4,fill:'#f2c98c',stroke:'#182b30','stroke-width':1});
  const caption=add('text',{x:-104,y:101,fill:'#b8c6b8','font-size':3.6,'font-family':'sans-serif'},'AMBER / LIFTS    SAGE / SHOPS    ARROWS / ESCALATORS');caption.classList.add('plan-legend');
  function refresh(){
    const level=CONCOURSE_LEVELS.find(item=>item.id===selected);
    document.querySelector('#map-deck-label').textContent=level?`DECK ${String(level.number).padStart(2,'0')} / ${level.short}`:'ALL PUBLIC DECKS';
    for(const button of document.querySelectorAll('[data-map-deck]'))button.setAttribute('aria-pressed',String(button.dataset.mapDeck===selected));
    for(const node of shopMarkers)node.style.display=selected==='promenade'||selected==='all'?'':'none';
    for(const node of escalatorMarkers)node.style.display=['concourse','promenade','all'].includes(selected)?'':'none';
    for(const item of paths){
      const visible=item.sector!=='concourse'||selected==='all'||item.deck===selected||(item.deck==='ramp'&&(selected==='concourse'||selected==='promenade'));
      item.path.style.display=visible?'':'none';
      item.path.setAttribute('fill-opacity',item.sector==='concourse'?.14:item.sector===lastSector?.22:.08);
    }
    if(lastPosition){marker.setAttribute('cx',lastPosition.x);marker.setAttribute('cy',lastPosition.z);}
  }
  for(const button of document.querySelectorAll('[data-map-deck]')){const handler=()=>{selected=button.dataset.mapDeck;refresh();};button.addEventListener('click',handler);listeners.push(()=>button.removeEventListener('click',handler));}
  refresh();
  return {
    update(position,sector){lastPosition=position;lastSector=sector;selected=sector==='concourse'?concourseLevelAt(position.y-1.75).id:'all';refresh();},
    dispose(){for(const remove of listeners)remove();listeners.length=0;},
  };
}
