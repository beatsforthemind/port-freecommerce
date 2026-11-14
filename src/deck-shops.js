import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createShopKit,shopRandom} from './shop-kit.js';

/**
 * The businesses along both walls of Deck 01, one to a structural bay. `z` is
 * the bay's centre line. Each has a kind (what stands in its window), a price
 * board, and a line or two for a visitor who stops to look.
 */
export const DECK_SHOPS=[
  [-1,-118,'outfitter','Dockside Outfitters','Suits, seals and second skins','#d7a56b','06–22',null,
    'Pressure liners hang by size and by number of limbs. The fitting form in the window has worn the same patched suit since the shop opened, and it still passes inspection.'],
  [-1,-102,'office','Contracts & Claims','Witnessed while you wait','#a8c7bf','08–20',
    ['SERVICES',[['WITNESSED SEALS','8'],['CLAIMS FILED','15'],['CERTIFIED COPIES','2'],['NOTARY','10']],'QUEUE AT THE LINE'],
    'A clerk stamps, seals and countersigns. The queue display has shown the same number all cycle, and nobody waiting seems to mind.'],
  [-1,-86,'provisions','Last Light Provisions','Stock up before the long dark','#e0b46f','05–23',null,
    'Shelf-stable everything, sorted by the length of the voyage. The top shelf is for crossings where nobody plans to come back the same way.'],
  [-1,-70,'books','The Long Shelf','Books, charts and other slow media','#c9b48a','09–21',null,
    'Paper travels badly and sells anyway. Charts are filed by where the reader hopes to end up, and the returns bin is labelled “changed my mind”.'],
  [-1,-54,'luggage','Liftside Lockers','Leave it. Come back for it.','#9fb7ad','ALWAYS',null,
    'Left luggage by the hour, the cycle or the generation. One locker is paid a long way in advance, and the attendant does not open it for anyone.'],
  [-1,-38,'parts','Spare & Seal','Gaskets, couplings, small miracles','#d49b73','06–22',null,
    'Every drawer is labelled by thread and pressure rating. The counter rule is simple: bring the broken one, leave with the right one.'],
  [-1,-22,'pharmacy','Quiet Cycle Pharmacy','Transit remedies, checked twice','#a9c9c1','ALWAYS',null,
    'Sleep patches, pressure salts and remedies for three kinds of gravity. The pharmacist asks where you slept last before asking what hurts.'],
  [-1,-6,'office','Meridian Credit','Any currency, eventually','#c7b98f','07–21',
    ['TODAY’S RATES',[['PORT CREDIT','1.00'],['RING SCRIP','0.84'],['HAULER’S NOTE','0.61'],['A PROMISE','ASK']],'RATES MOVE WHEN SHIPS DO'],
    'Rates for eleven currencies and two kinds of promise. The board changes whenever a ship docks, which is the only news the tellers trust.'],
  [-1,58,'bar','Half Measure','Tea by the pot, time by the cup','#e2a66a','10–02',
    ['POURING',[['HOUSE TEA, POT','2'],['SMOKED LEAF','3'],['RING WATER','3'],['THE LONG ONE','8']],'NO SHIP TALK AFTER TEN'],
    'A narrow bar under the ramp, where the departures board cannot be seen. Regulars say that is the whole point.'],
  [-1,74,'noodles','Noodles 24H','Broth does not close','#ffb75c','ALWAYS',null,
    'The stock pots have not been empty since the station was commissioned. Whoever is on shift adds to them and takes the credit.'],
  [-1,90,'provisions','Arrivals Sundries','Whatever you left behind','#d8c08f','ALWAYS',
    ['FORGOT SOMETHING?',[['ADAPTOR, ANY','5'],['TOOTH KIT','2'],['WARM SOCKS','4'],['PORT MAP','1']],'FIRST SHOP IN, LAST SHOP OUT'],
    'The first shop a new arrival passes. It sells the five things everyone forgets and one thing nobody can identify.'],
  [1,-118,'office','Gate Seven Freight Desk','Manifests, seals, forwarding','#c9a36f','06–22',
    ['FREIGHT',[['MANIFEST CHECK','6'],['CUSTOMS SEAL','9'],['FORWARDING, PER KG','1'],['HOLD, PER CYCLE','4']],'LONG-HAUL CUT-OFF: 2 HOURS'],
    'Everything that leaves on the liner is weighed, sealed and argued about here first. The scale is honest; the arguments are traditional.'],
  [1,-102,'parts','Tender & Line','Chandlery for small craft','#b8c2a8','06–20',null,
    'Line, shackles and fittings for craft small enough to be repaired by their owners. Advice is free and usually longer than the repair.'],
  [1,-86,'office','Short-Stay Habitats','A door that locks, by the cycle','#e7cc9b','ALWAYS',
    ['ROOMS',[['CAPSULE, ONE CYCLE','18'],['CABIN, ONE CYCLE','35'],['SHOWER','3'],['LATE CHECKOUT','5']],'KEYS AT THE DESK'],
    'Capsules and cabins let by the cycle. The model in the window is to scale, which the brochure does not mention.'],
  [1,-70,'botany','Greenhouse Nine','Cuttings cleared for travel','#a9c79a','07–19',null,
    'Every plant carries a transit permit and a note on the light it remembers. The grow lamps stay on through the night cycle.'],
  [1,-54,'luggage','Left Luggage','Tagged, sealed, remembered','#b7b39a','ALWAYS',null,
    'Cases wait here for owners on later ships. Each tag gives a name, a berth and a date, and a few of the dates are optimistic.'],
  [1,10,'books','Ringside Charts','Maps of the view next door','#b9c7c9','09–21',
    ['NEW IN',[['PELAGOS: A FIELD GUIDE','14'],['TABLES OF THE RINGS','9'],['STORM ATLAS','12'],['POSTCARDS','1']],'BROWSERS WELCOME'],
    'Charts and guides to the planet outside the gallery. The best-selling print is a storm that ended before the station was built.'],
  [1,26,'outfitter','Common Thread','Mending and travel wear','#d6a48a','08–20',null,
    'Travel wear in station colours, and mending while you wait. The tailor can tell which ship someone came in on from the wear on their cuffs.'],
  [1,42,'provisions','Passage Supply Co.','Rations, salts, small comforts','#f0b872','05–23',null,
    'Rations for the passage and small comforts for the cabin. The shopkeeper packs every order as if it were going further than the customer is.'],
  [1,58,'bar','The Slow Orbit','One drink per revolution','#d98f62','16–04',null,
    'The back bar is arranged by how long each bottle took to arrive. The oldest is not for sale, though it is occasionally opened.'],
  [1,74,'parts','Orbital Supply','Tools and fittings, any thread','#d2d8c9','06–22',null,
    'Tools and fittings for every thread the station has ever used, including two it should not have. Nothing here is thrown away.'],
  [1,90,'bar','First & Last Cup','Coffee on the way in or out','#e3b680','ALWAYS',
    ['AT THE BAR',[['SHORT AND DARK','2'],['LONG AND PALE','3'],['WITH RING SUGAR','3'],['REFILL','1']],'CUPS BACK ON THE RAIL'],
    'The first cup after a long passage and the last before the next one. Both are poured by someone who does not ask which it is.'],
].map(([side,z,kind,name,tagline,accent,hours,poster,text])=>Object.freeze({side,z,kind,name,tagline,accent,hours,poster,text,id:`deck-shop-${side<0?'w':'e'}${z}`}));

const POSTERS={
  provisions:['THIS CYCLE',[['TRANSIT SALT','2'],['DRIED PLUM','3'],['WATER, 5 L','4'],['RATION TIN','6']],'PRICES IN PORT CREDIT'],
  noodles:['MENU',[['LONG NOODLE','6'],['SIX-HOUR BROTH','4'],['DUMPLINGS × 5','5'],['TEA, POT','2']],'OPEN ALL CYCLE'],
  outfitter:['FITTINGS',[['LINER, STANDARD','40'],['SEAL RENEWAL','12'],['BOOT RESOLE','9'],['PATCH, WHILE YOU WAIT','3']],'ALL BODY PLANS'],
  parts:['IN STOCK',[['GASKET SETS','7'],['COUPLINGS M6–M30','4'],['LINE, PER METRE','1'],['SEAL TAPE','2']],'BRING THE BROKEN ONE'],
  pharmacy:['ASK US ABOUT',[['PRESSURE SALTS',''],['SLEEP PATCHES',''],['GRAVITY SICKNESS',''],['RE-ENTRY KITS','']],'CHECKED TWICE'],
  luggage:['LEFT LUGGAGE',[['PER HOUR','1'],['PER CYCLE','6'],['PER VOYAGE','40'],['OVERSIZE','ASK']],'KEEP YOUR TAG'],
  books:['NEW IN',[['HOW TO WAIT','7'],['TABLES OF TIDES','9'],['THE LONG WAY ROUND','11'],['CHARTS, USED','3']],'BROWSERS WELCOME'],
  botany:['CLEARED FOR TRAVEL',[['MOSS, JAR','6'],['HERB CUTTINGS','4'],['SEED TAPE','3'],['GROW LAMP','22']],'PERMITS INCLUDED'],
  bar:['POURING',[['HOUSE TEA','2'],['RING WATER','3'],['SOMETHING AMBER','5'],['THE LONG ONE','8']],'TABS CLOSE AT DEPARTURE'],
  office:['SERVICES',[['ENQUIRIES','—'],['FORMS','1'],['COPIES','2'],['SEALS','8']],'TAKE A NUMBER'],
};
const WARM=new Set(['provisions','noodles','bar','books','outfitter']);

const FIT='#232d30',PALE='#a39d8c',WOOD='#7d5f45',STEEL='#7d8787',INK='#1b2325';
const PRODUCT=['#a8573b','#c9a45a','#5f8f8a','#cbc5b2','#6b5a78','#4f6b55','#b98a56','#8a9ba6','#9a5560','#536a80'];
const LABEL='#d8d2bf';
const CLOTH=['#526563','#8b705b','#7d8181','#a09278','#4d5968','#796268','#a87351','#536054','#c1b89e','#33414a'];
const BOOKS=['#7b2f2a','#2f4b5c','#c9a45a','#3d5a43','#8a6a4b','#cbc2a8','#5c3f5e','#27353a','#a8573b','#6f8f8c'];
const TOOL=['#9aa3a3','#c98a4b','#b5533c','#d8d2bf','#5c7f86'];
const BIN=['#b5533c','#c9a13f','#5c7f86','#6d7b74','#3f5f6b'];
const MED=['#e6e1d2','#8fb5ab','#5f8f8a','#c9a45a','#a8573b','#cbc5b2','#8a9ba6'];
const CASE=['#8b4a3a','#3f5f6b','#c9a45a','#526563','#796268','#2f3a3c','#a09278'];
const BOTTLE=['#7a4a25','#2f5a3c','#c9a13f','#8fb0a8','#5a2a2a','#d8d2bf','#3d3340'];
const PAPER=['#d8d2bf','#c9a45a','#a9c9c1','#b9b09a','#c98a8a'];
const scratch=new THREE.Color();
const shade=(hex,factor)=>`#${scratch.set(hex).multiplyScalar(factor).getHexString()}`;

/**
 * Real shopfronts for the deck's wall bays: a named fascia, a recessed door, and a glazed
 * display case with shelves and stock that shift against each other as a visitor walks past.
 * Everything stays inside the wall line, so the deck's floor and colliders are untouched.
 */
export function buildDeckShops({group,box,materials,glow=null,shops=DECK_SHOPS}) {
  // One set of meshes to a wall, so that the frontage behind a visitor is not drawn.
  const kits={[-1]:createShopKit('Deck 01 west shopfronts'),1:createShopKit('Deck 01 east shopfronts')};
  const m=materials,landmarks=[];
  // The window floor, and the back of the display case just in front of the structural wall.
  const F=.75,BACK=31.93;

  shops.forEach((shop,index)=>{
    const {side,z,kind,accent}=shop,rnd=shopRandom(index*131+17),kit=kits[side];
    const pick=list=>list[Math.floor(rnd()*list.length)];
    const mirror=options=>options&&{...options,ry:(options.ry||0)*side,rz:(options.rz||0)*side};
    // `d` is the distance from the hall's centre line, `u` the distance along the wall from the bay's centre.
    const S=(color,d,y,u,depth,h,width,options)=>kit.box(color,side*d,y,z+u,depth,h,width,mirror(options));
    const C=(color,d,y,u,radius,h,options)=>kit.can(color,side*d,y,z+u,radius,h,mirror(options));
    const B=(color,d,y,u,radius,options)=>kit.ball(color,side*d,y,z+u,radius,options);
    const K=(color,d,y,u,radius,h,options)=>kit.cone(color,side*d,y,z+u,radius,h,mirror(options));
    const R=(color,d,y,u,radius,tube,options)=>kit.ring(color,side*d,y,z+u,radius,tube,mirror(options));
    const lamp=(color,d,y,u,depth,h,width)=>kit.box(color,side*d,y,z+u,depth,h,width,{light:true});
    const hull=(material,d,y,u,depth,h,width)=>box(material,side*d,y,z+u,depth,h,width);
    const dark=shade(accent,.6),deep=shade(accent,.2);

    // The shopfront: a painted wall with a window opening and a door opening, closed at its ends and top.
    S(FIT,31.11,.375,-1.65,.12,.75,8.5);
    S(FIT,31.11,2.1,-5.4,.12,2.7,1);
    S(FIT,31.11,2.1,1.75,.12,2.7,1.7);
    S(FIT,31.11,1.725,5,.12,3.45,1.8);
    S(FIT,31.11,2.975,3.35,.12,.95,1.5);
    S(FIT,31.11,4.15,0,.12,1.4,11.8);
    for(const u of[-5.87,5.87])S(FIT,31.55,2.425,u,.86,4.85,.06);
    S(FIT,31.55,4.82,0,.86,.06,11.8);
    // A stall riser in the shop's own colour, and a sill under the glass.
    S(deep,31.04,.4,-2,.02,.56,5.6);
    S(STEEL,31.045,.775,-2,.05,.05,5.86);

    // The display case behind the glass, lit from a strip at its head.
    S(PALE,31.575,.72,-2,.81,.06,5.8);
    S(PALE,31.575,3.42,-2,.81,.06,5.8);
    for(const u of[-4.87,.87])S(PALE,31.575,2.07,u,.81,2.64,.06);
    lamp(WARM.has(kind)?'#8c7758':'#6f847e',31.95,2.07,-2,.04,2.64,5.8);
    hull(m.warm,31.27,3.355,-2,.07,.05,5.3);
    // Three panes, each stopping short of the sill, the head and the mullions: where glass runs
    // into a frame, the line where they cross shimmers from across the hall.
    for(const [from,to] of [[-4.88,-3.02],[-2.92,-1.08],[-.98,.88]])hull(m.glass,31.085,2.125,(from+to)/2,.02,2.63,to-from);
    for(const u of[-2.97,-1.03])S(FIT,31.07,2.1,u,.08,2.7,.07);

    // The door: two leaves at the back of a short recess, each with a lit slot, under a lamp.
    for(const u of[2.9725,3.7275]) {
      S(dark,31.6,1.23,u,.06,2.42,.735);
      lamp('#b7a680',31.563,1.6,u,.014,1.05,.1);
      S(INK,31.565,.2,u,.012,.34,.735);
      S(STEEL,31.54,1.1,u+(u<3.35?.26:-.26),.03,.5,.03);
    }
    for(const u of[2.63,4.07])S(FIT,31.37,1.25,u,.4,2.5,.06);
    S(FIT,31.37,2.47,3.35,.4,.06,1.5);
    S('#2f3a3c',31.37,.012,3.35,.4,.024,1.44);
    hull(m.amber,31.1,.02,3.35,.05,.03,1.3);
    hull(m.warm,31.32,2.42,3.35,.2,.03,.9);
    // An entry reader beside it.
    S(FIT,31.035,1.32,4.42,.03,.2,.13);
    lamp('#b9e0d2',31.017,1.37,4.42,.008,.03,.05);

    // Shops that sell from the window keep an awning over it.
    if(kind==='provisions'||kind==='noodles'||kind==='bar'||kind==='botany') {
      kit.box(shade(accent,.82),side*30.68,3.47,z-2,.8,.045,6.2,{rz:side*Math.atan2(.3,.74)});
      S(dark,30.31,3.25,-2,.03,.14,6.2);
    }

    const shelving=(color,u0,u1,levels,depth=.3)=>{
      const d=BACK+.01-depth/2,top=levels[levels.length-1];
      for(const y of levels)S(color,d,y,(u0+u1)/2,depth,.035,u1-u0);
      for(const u of[u0+.02,u1-.02])S(color,d,(F+top)/2+.02,u,depth,top-F+.04,.035);
      return d;
    };
    const row=(u0,u1,item)=>{for(let u=u0;u<u1;)u+=item(u)+.012+rnd()*.03;};

    if(kind==='provisions') {
      const levels=[1.3,1.85,2.4,2.95],d=shelving(WOOD,-4.7,.7,levels);
      for(const y of levels)row(-4.62,.6,u=>{
        const top=y+.0175;
        if(rnd()<.55){const r=.04+rnd()*.022,h=.11+rnd()*.09;C(pick(PRODUCT),d,top,u+r,r,h);if(rnd()<.6)C(LABEL,d,top+h*.28,u+r,r*1.04,h*.42);return r*2;}
        const w=.09+rnd()*.1,h=.12+rnd()*.14;S(pick(PRODUCT),d,top+h/2,u+w/2,.11+rnd()*.06,h,w);return w;
      });
      // Crates of fruit tipped toward the glass, a pyramid of tins, and two sacks.
      for(const [i,u] of [-4.2,-3.3,-2.4].entries()) {
        S(WOOD,31.42,F+.15,u,.42,.26,.72,{rz:.18});
        for(let k=0;k<7;k++)B(['#c8553d','#d9a441','#7f9b54'][i],31.33+rnd()*.14,F+.33+rnd()*.03,u-.27+k*.09,.055+rnd()*.012);
      }
      for(let layer=0;layer<3;layer++)for(let k=0;k<3-layer;k++)C(pick(PRODUCT),31.4,F+layer*.13,-1.3+(k+layer*.5)*.13,.06,.125);
      for(const u of[-.5,.1])S('#b9a780',31.45,F+.2,u,.34,.4,.5,{rz:.06});
    } else if(kind==='noodles') {
      // A back counter with stock pots, a steamer, bowls and sauces, under paper lanterns.
      S(WOOD,31.68,F+.3,-2,.46,.6,5.5);S('#3b2f27',31.68,F+.62,-2,.5,.04,5.56);
      const top=F+.64;
      for(const u of[-4.1,-3.3,-2.5]){C('#8b9296',31.7,top,u,.17,.3,{sides:8});C('#5d6467',31.7,top+.3,u,.185,.03,{sides:8});C(INK,31.7,top+.33,u,.03,.04);}
      for(let k=0;k<4;k++)C(k%2?'#c9a66b':'#b8935a',31.68,top+k*.085,-1.55,.15,.08,{sides:8});
      C('#a8824e',31.68,top+.34,-1.55,.16,.02,{sides:8});
      for(const u of[-.9,-.55,-.2]){const n=3+Math.floor(rnd()*4);for(let k=0;k<n;k++)C(k%2?'#e6dfcb':'#d2c9b0',31.6,top+k*.035,u,.07,.04,{top:.1,sides:8});}
      row(.05,.65,u=>{C(pick(['#7b2f2a','#3d2a1e','#c8993f','#30402f']),31.72,top,u+.03,.03,.17);C(INK,31.72,top+.17,u+.03,.012,.05);return .06;});
      for(const u of[-4.2,-2.9,-1.6,-.3]) {
        S('#2b2320',31.5,3.18,u,.012,.4,.012);
        lamp('#ffc98a',31.5,2.84,u,.2,.26,.2);
        for(const y of[2.985,2.695])S('#3b2f27',31.5,y,u,.22,.03,.22);
      }
      for(const u of[-3.9,-2.6,-1.3,0]){S('#2a2420',31.9,2.35,u,.03,.78,.34);for(let k=0;k<5;k++)lamp('#e9dcc0',31.882,2.62-k*.13,u,.006,.035,.2+rnd()*.08);}
      // Sample bowls on a ledge at the glass.
      S(WOOD,31.34,F+.05,-2,.2,.1,5.4);
      for(const u of[-4,-2.6,-1.2,.2]){C('#e6dfcb',31.34,F+.1,u,.09,.07,{top:.14,sides:8});S('#b8935a',31.34,F+.185,u+.02,.012,.012,.26);}
    } else if(kind==='outfitter') {
      // Garments on a rail, a fitting form in a pressure liner, and folded stock with boots at the glass.
      S(STEEL,31.62,2.72,-2.6,.03,.03,3.6);
      for(const u of[-4.38,-.82])S(STEEL,31.62,1.75,u,.03,2,.03);
      row(-4.25,-.95,u=>{const w=.07+rnd()*.03,h=.85+rnd()*.5;S(pick(CLOTH),31.62,2.68-h/2,u+w/2,.42+rnd()*.06,h,w);S(STEEL,31.62,2.705,u+w/2,.02,.04,.012);return w;});
      const form=-.15;
      C(STEEL,31.5,F,form,.16,.03,{sides:8});S(STEEL,31.5,F+.5,form,.035,1,.035);
      S(shade(accent,.75),31.5,F+1.32,form,.26,.62,.46);S(dark,31.5,F+.95,form,.24,.14,.4);
      for(const arm of[-1,1])S(shade(accent,.75),31.5,F+1.3,form+arm*.31,.13,.56,.13,{rx:arm*.12});
      B('#c9c2ad',31.5,F+1.8,form,.15);S(INK,31.37,F+1.81,form,.03,.08,.2);
      for(const u of[-4.2,-3.55,-2.9])for(let k=0;k<4;k++)S(pick(CLOTH),31.38,F+.03+k*.06,u,.3,.055,.42);
      for(const u of[-2.1,-1.6])for(const foot of[-.07,.07]){S('#2b3234',31.36,F+.12,u+foot,.14,.24,.1);S('#2b3234',31.31,F+.045,u+foot,.24,.09,.1);}
    } else if(kind==='parts') {
      // Tools on a board, bins of small parts, gas bottles and a cable drum, and boxed stock.
      S('#2f3a3c',31.9,2.3,-2.9,.03,1.6,3.6);
      for(let i=0;i<14;i++) {
        const u=-4.5+i*.25+rnd()*.06,y=1.85+rnd()*.9;
        if(i%4===0)R(pick(TOOL),31.86,y,u,.09+rnd()*.05,.014,{ry:Math.PI/2});
        else S(pick(TOOL),31.87,y,u,.02,.25+rnd()*.3,.035+rnd()*.03,{rx:(rnd()-.5)*.5});
      }
      const d=shelving(STEEL,-4.7,-1.1,[1.05,1.38],.34);
      for(const y of[1.05,1.38])for(let k=0;k<9;k++){const u=-4.5+k*.4;S(pick(BIN),d,y+.11,u,.3,.18,.34);S(INK,d-.02,y+.18,u,.24,.05,.28);}
      for(const u of[-4.4,-4.05,-3.7]){C(pick(['#b5533c','#c9a13f','#5c7f86']),31.42,F,u,.11,.62,{sides:8});C(INK,31.42,F+.62,u,.05,.08);}
      C(WOOD,31.5,F+.13,-2.9,.28,.3,{rx:Math.PI/2,sides:10});C('#3f5f6b',31.5,F+.17,-2.9,.2,.22,{rx:Math.PI/2,sides:10});
      const levels=[1.2,1.75,2.3,2.85],d2=shelving(STEEL,-.9,.7,levels);
      for(const y of levels)row(-.82,.6,u=>{const w=.1+rnd()*.12,h=.1+rnd()*.14;S(pick(BIN),d2,y+.0175+h/2,u+w/2,.2,h,w);return w;});
    } else if(kind==='pharmacy') {
      // Small bottles and boxes in neat rows, a lit cross, and a dispensing counter.
      const levels=[1.25,1.75,2.25,2.75],d=shelving('#b9b5a7',-4.7,-.6,levels,.26);
      for(const y of levels)row(-4.62,-.68,u=>{
        const top=y+.0175;
        if(rnd()<.5){const r=.032+rnd()*.014,h=.11+rnd()*.07;C(pick(MED),d,top,u+r,r,h);C('#f1ede0',d,top+h,u+r,r*.7,.022);return r*2;}
        const w=.08+rnd()*.08,h=.1+rnd()*.1;S(pick(MED),d,top+h/2,u+w/2,.12,h,w);return w;
      });
      lamp('#8fd9b6',31.9,2.3,.12,.02,.62,.2);lamp('#8fd9b6',31.9,2.3,.12,.02,.2,.62);
      S('#b9b5a7',31.4,F+.25,-2.6,.36,.5,3.6);S('#8fb5ab',31.4,F+.51,-2.6,.4,.02,3.66);
      for(const u of[-3.9,-2.9,-1.9]){S('#f1ede0',31.4,F+.6,u,.2,.16,.3);for(const v of[-.08,0,.08])C(pick(MED),31.36,F+.68,u+v,.025,.09);}
    } else if(kind==='office') {
      // A service counter with two positions, pigeonholes behind, a queue light and a plant.
      S(PALE,31.55,F+.33,-2.2,.5,.66,4.6);S('#2f3a3c',31.55,F+.675,-2.2,.56,.03,4.7);
      for(const u of[-3.4,-1.2]) {
        S(INK,31.6,F+.9,u,.05,.36,.5);lamp('#9fd3c7',31.572,F+.9,u,.006,.3,.44);S(INK,31.6,F+.72,u,.14,.04,.2);
        S('#d8d2bf',31.45,F+.705,u+.55,.22,.03,.3);S('#e7dfca',31.45,F+.73,u+.57,.21,.02,.29);
      }
      for(let i=0;i<=8;i++)S(WOOD,31.82,2.45,-4.4+i*.45,.22,1.1,.025);
      for(let j=0;j<=3;j++)S(WOOD,31.82,1.9+j*.366,-2.6,.22,.025,3.63);
      for(let i=0;i<8;i++)for(let j=0;j<3;j++)if(rnd()<.7)S(pick(PAPER),31.84,1.92+j*.366+.07,-4.175+i*.45,.16,.1+rnd()*.1,.3+rnd()*.08);
      S(INK,31.88,2.6,.1,.04,.42,.8);lamp(accent,31.855,2.6,.1,.006,.2,.5);
      C(WOOD,31.4,F,.35,.13,.22,{top:.16,sides:8});
      for(let k=0;k<5;k++)K('#5f8a5a',31.4+(rnd()-.5)*.08,F+.2,.35+(rnd()-.5)*.1,.1,.45+rnd()*.3,{rz:(rnd()-.5)*.5,rx:(rnd()-.5)*.5});
    } else if(kind==='luggage') {
      // A wall of lockers, with cases waiting in front and a hand trolley.
      for(let i=0;i<7;i++)for(let j=0;j<3;j++) {
        const u=-4.4+i*.62,y=F+.45+j*.78;
        S(j%2===i%2?'#7d8b86':'#96a39b',31.75,y,u,.34,.72,.58);S('#2b3234',31.572,y,u+.2,.012,.14,.03);
        if(rnd()<.4)lamp('#ffb65e',31.572,y+.24,u+.2,.006,.03,.03);
      }
      for(const [u,w,h] of [[-3.9,.7,.5],[-3,.55,.7],[-2.2,.8,.42],[-1.2,.5,.62]]) {
        const colour=pick(CASE);
        S(colour,31.36,F+h/2,u,.26,h,w);S(INK,31.36,F+h+.03,u,.03,.06,.2);
        for(const v of[-.3,.3])S(shade(colour,.7),31.224,F+h/2,u+v*w,.012,h*.8,.04);
      }
      S(pick(CASE),31.36,F+.5+.16,-3.9,.24,.32,.5);
      for(const v of[-.17,.17])S(STEEL,31.44,F+.55,.25+v,.03,1.1,.03);
      S(STEEL,31.36,F+.04,.25,.3,.03,.4);S(STEEL,31.44,F+1.1,.25,.03,.03,.37);
      for(const v of[-.2,.2])C(INK,31.47,F+.045,.25+v,.07,.05,{rx:Math.PI/2,sides:8});
    } else if(kind==='books') {
      // Shelves of spines, a table of stacks with a globe, and rolled charts in a bin.
      const levels=[1.1,1.5,1.9,2.3,2.7],d=shelving(WOOD,-4.7,.7,levels,.22);
      for(const y of levels)row(-4.62,.62,u=>{
        const top=y+.0175,chance=rnd();
        if(chance<.07){for(let k=0;k<3;k++)S(pick(BOOKS),d,top+.02+k*.04,u+.1,.16,.036,.2-.02*k);return .2;}
        if(chance<.15)return .06+rnd()*.1;
        const w=.028+rnd()*.04,h=.2+rnd()*.12;S(pick(BOOKS),d+(rnd()-.5)*.02,top+h/2,u+w/2,.16,h,w);return w;
      });
      S(WOOD,31.38,F+.2,-2.9,.34,.4,2.8);
      for(const u of[-4,-3.5,-3,-2.2]){const n=2+Math.floor(rnd()*4);for(let k=0;k<n;k++)S(pick(BOOKS),31.38,F+.42+k*.045,u,.2,.04,.28,{ry:(rnd()-.5)*.3});}
      C(STEEL,31.38,F+.4,-1.75,.03,.14);B('#6f9a96',31.38,F+.68,-1.75,.15);
      C(WOOD,31.4,F,.2,.16,.4,{sides:8});
      for(let k=0;k<5;k++)C('#e6dfcb',31.4+(rnd()-.5)*.12,F+.1,.2+(rnd()-.5)*.14,.025,.65+rnd()*.2,{rz:(rnd()-.5)*.25});
    } else if(kind==='botany') {
      // Two tiers of potted plants under grow lamps, and jars of cuttings on a high shelf.
      S('#6d7b74',31.72,F+.25,-2,.4,.5,5.5);S('#6d7b74',31.4,F+.11,-2,.3,.22,5.5);
      for(let i=0;i<11;i++) {
        const u=-4.5+i*.5+rnd()*.08,back=i%2===0,d=back?31.72:31.4,y=F+(back?.5:.22);
        C(pick(['#a8573b','#8a6a4c','#d8d2bf']),d,y,u,.1,.16,{top:.13,sides:8});
        const green=pick(['#4f7a52','#6f9a5c','#3f6b52','#8aa86a']),height=.35+rnd()*.6;
        for(let k=0;k<3+Math.floor(rnd()*3);k++)K(green,d+(rnd()-.5)*.1,y+.14,u+(rnd()-.5)*.14,.07+rnd()*.05,height*(.6+rnd()*.4),{rz:(rnd()-.5)*.5,rx:(rnd()-.5)*.5});
        if(rnd()<.3)B(pick(['#c8553d','#e0b354','#b54b5f']),d,y+height*.8,u,.05);
      }
      hull(m.cool,31.56,3.2,-2,.06,.03,5.2);
      for(const u of[-4.4,.4])S(STEEL,31.56,3.3,u,.012,.18,.012);
      const d=shelving('#6d7b74',-4.7,.7,[2.5],.22);
      row(-4.55,.55,u=>{C('#b9d3c9',d,2.5175,u+.06,.06,.18,{sides:8});K('#6f9a5c',d,2.6,u+.06,.035,.16);return .2+rnd()*.25;});
    } else if(kind==='bar') {
      // Three lit shelves of bottles over a back bar set with glasses, and stools at the glass.
      const levels=[1.6,2.05,2.5],d=shelving('#3b2f27',-4.7,.7,levels,.22);
      for(const y of levels) {
        lamp('#ffc98a',d-.09,y-.03,-2,.02,.015,5.2);
        row(-4.6,.6,u=>{const r=.03+rnd()*.012,h=.17+rnd()*.1,colour=pick(BOTTLE);C(colour,d,y+.0175,u+r,r,h);C(colour,d,y+.0175+h,u+r,r*.4,.07,{top:r*.3});return r*2+.02;});
      }
      S('#3b2f27',31.72,F+.33,-2,.36,.66,5.5);S(WOOD,31.72,F+.675,-2,.42,.03,5.56);
      for(let k=0;k<14;k++)C('#d8e2dc',31.66,F+.69,-4.3+k*.36,.03,.09,{top:.038});
      for(const u of[-1.1,-.8]){S(STEEL,31.72,F+.84,u,.04,.3,.04);S(STEEL,31.66,F+.97,u,.14,.03,.04);}
      for(const u of[-4,-2.9,-1.8,-.7,.4]){C(STEEL,31.36,F,u,.03,.5);C(STEEL,31.36,F,u,.14,.02,{sides:8});C(dark,31.36,F+.5,u,.15,.05,{sides:8});}
    }

    // Lit glazing spills onto the deck in front of it.
    glow?.pool(side*28.3,0,z-2,2.5,WARM.has(kind)?'#f5dec0':'#cfe0d8',.17,.8,2.6);
    landmarks.push({id:shop.id,x:side*29.2,y:0,z:z+.6,radius:3.3,code:`PFC / DECK 01 / ${side<0?'WEST':'EAST'} FRONTAGE`,
      title:shop.name,hint:`Inspect ${shop.name}`,text:[shop.text]});
  });

  const fittings=[kits[-1].build(group),kits[1].build(group)];
  const graphics=createGraphics(group,shops);
  return {landmarks,stats:{shops:shops.length,kinds:new Set(shops.map(shop=>shop.kind)).size,
    drawCalls:fittings[0].drawCalls+fittings[1].drawCalls+1,triangles:fittings[0].triangles+fittings[1].triangles+graphics.triangles,
    textures:1,atlas:graphics.atlas,perFrameUpdates:0}};
}

/** One sheet for every fascia, price board and door plate; drawn once. */
function createGraphics(group,shops) {
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=2048;
  const ctx=canvas.getContext('2d');
  const FASCIA=[1024,96],CARD=[256,300],BOARD=236,CARDS_Y=1064;
  const pieces=[],transform=new THREE.Object3D();
  const fit=(value,x,y,size,weight,maxWidth,colour,align='left',face='"Space Grotesk"')=>{
    ctx.font=`${weight} ${size}px ${face}, sans-serif`;
    const measured=ctx.measureText(value).width;
    if(measured>maxWidth)ctx.font=`${weight} ${size*maxWidth/measured}px ${face}, sans-serif`;
    ctx.fillStyle=colour;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(value,x,y);
  };
  const quad=(x0,y0,w,h,side,d,y,z,width,height)=>{
    const geometry=new THREE.PlaneGeometry(width,height),uv=geometry.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setXY(i,(x0+1.5+uv.getX(i)*(w-3))/canvas.width,1-(y0+1.5+(1-uv.getY(i))*(h-3))/canvas.height);
    transform.position.set(side*d,y,z);transform.rotation.set(0,-side*Math.PI/2,0);transform.updateMatrix();
    geometry.applyMatrix4(transform.matrix);pieces.push(geometry);
  };
  shops.forEach((shop,index)=>{
    const {side,z,accent}=shop;
    // The fascia: a mark, the name, what the shop is for, its bay and its hours.
    const fx=index%2*FASCIA[0],fy=Math.floor(index/2)*FASCIA[1];
    ctx.save();ctx.translate(fx,fy);ctx.beginPath();ctx.rect(0,0,...FASCIA);ctx.clip();
    ctx.fillStyle=['#1d282b','#26221f','#1f2a27'][index%3];ctx.fillRect(0,0,...FASCIA);
    ctx.fillStyle=accent;ctx.fillRect(0,0,FASCIA[0],3);
    ctx.strokeStyle=accent;ctx.lineWidth=3;
    ctx.beginPath();ctx.arc(52,50,24,index*.9,index*.9+Math.PI*1.5);ctx.stroke();
    ctx.beginPath();
    if(index%3===0){ctx.moveTo(40,50);ctx.lineTo(64,50);ctx.moveTo(52,38);ctx.lineTo(52,62);}
    else if(index%3===1){ctx.moveTo(40,58);ctx.lineTo(52,38);ctx.lineTo(64,58);}
    else ctx.arc(52,50,9,0,Math.PI*2);
    ctx.stroke();
    fit(shop.name.toUpperCase(),98,40,44,600,640,accent);
    fit(shop.tagline,100,75,18,500,640,'#d8d2bf');
    fit(`D01 / ${side<0?'W':'E'}${String(Math.floor(index%11)+1).padStart(2,'0')}`,1000,30,17,500,180,'#9aa69c','right');
    fit(shop.hours==='ALWAYS'?'OPEN ALL CYCLE':`OPEN ${shop.hours}`,1000,62,20,600,220,'#d8d2bf','right');
    ctx.restore();
    quad(fx,fy,...FASCIA,side,31.03,4.2,z+.15,10.3,.966);

    // A price board on the pier beside the door, and a plate over the door.
    const cx=index%8*CARD[0],cy=CARDS_Y+Math.floor(index/8)*CARD[1];
    const [title,lines,foot]=shop.poster||POSTERS[shop.kind];
    ctx.save();ctx.translate(cx,cy);ctx.beginPath();ctx.rect(0,0,CARD[0],BOARD);ctx.clip();
    ctx.fillStyle='#e7dfca';ctx.fillRect(0,0,CARD[0],BOARD);
    ctx.fillStyle=accent;ctx.fillRect(0,0,CARD[0],46);
    fit(title,16,24,22,600,224,'#1b2325');
    lines.forEach(([label,price],line)=>{
      const y=74+line*34;
      fit(label,16,y,16,500,price?168:224,'#27353a');
      if(price)fit(price,240,y,17,600,56,'#27353a','right');
      ctx.fillStyle='rgba(39,53,58,.22)';ctx.fillRect(16,y+15,224,1);
    });
    fit(foot,16,214,12,500,224,'#5f6a66');
    ctx.restore();
    quad(cx,cy,CARD[0],BOARD,side,31.03,1.85,z+1.75,1,.92);
    ctx.save();ctx.translate(cx,cy+BOARD);ctx.beginPath();ctx.rect(0,0,CARD[0],CARD[1]-BOARD);ctx.clip();
    ctx.fillStyle='#1b2325';ctx.fillRect(0,0,CARD[0],CARD[1]-BOARD);
    fit('OPEN',16,33,30,600,110,accent);
    fit(shop.hours==='ALWAYS'?'ALL CYCLE':shop.hours,240,33,18,500,110,'#d8d2bf','right');
    ctx.restore();
    quad(cx,cy+BOARD,CARD[0],CARD[1]-BOARD,side,31.03,2.97,z+3.35,1.2,.3);
  });
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
  const geometry=mergeGeometries(pieces);pieces.forEach(piece=>piece.dispose());
  // Two centimetres proud of the painted wall; a constant bias holds them in front from the far end of the hall.
  const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({map:texture,polygonOffset:true,polygonOffsetUnits:-2}));
  mesh.name='Deck 01 shopfronts / signs and price boards';mesh.matrixAutoUpdate=false;
  group.add(mesh);
  return {triangles:shops.length*6,atlas:`${canvas.width}x${canvas.height}`};
}
