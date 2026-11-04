import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Shops occupy the pressure-wall band. Every column and the lantern-lift bay
// stays open; the promenade's inner walking lane is shared by every business.
const bays=[[-116,true],[-100,false],[-84,true],[-68,false],[-36,true],[-20,false],[-4,true],[12,true],[28,true],[44,false]];
const positions=bays.flatMap(([z,double])=>double?[{z:z-3.1,width:5.4},{z:z+3.1,width:5.4}]:[{z,width:11.2}]);
const colors=['#d7ab72','#a6b69a','#d29a7d','#a9bfba','#c5b290','#b0adbf'];
// Full names belong to the directory; short brands stay readable at eye level.
const west=[
  ['food','Six Moons Noodle Bureau','SIX MOONS','Broths for unfamiliar stomachs','SIX BROTHS / ONE BOWL',[
    'Six pressure kettles hold six planetary gravities. A noodle pulled from the densest broth hangs perfectly straight, even when the cook carries it sideways.',
    'The menu asks which atmosphere you grew up under before it asks what you want to eat. Every serving arrives with a small, reassuring compatibility seal.']],
  ['botany','Parcel of Rain','PARCEL OF RAIN','Living weather, carefully packed','HUMIDITY LOCKED',[
    'Miniature cloud forests climb the inside of sealed nursery jars. Condensation runs upward through capillary roots, returning each small rainstorm to its beginning.',
    'The proprietor sells plants by the kind of home they remember: wet stone, long dusk, brief summer. No specimen may travel without its own weather.']],
  ['charts','Foldline Cartography','FOLDLINE','Routes for the long way home','FIND YOUR MOON',[
    'Layered star charts compare the published routes with the routes that crews actually use. Amber pins mark open berths; pale pins mark places people still write to.',
    'A strip above the plotting desk reads: distance is certain, arrival is negotiable. The printed maps include margins large enough for the next change of plan.']],
  ['tailoring','Other Sleeves Atelier','OTHER SLEEVES','Tailoring beyond bilateral symmetry','FITTINGS / ALL FORMS',[
    'Articulated dress forms wear coats with adjustable sleeve counts and magnetic hems. Fabric swatches change their drape when a small weight passes underneath.',
    'The tailor repairs a garment around its owner rather than around a diagram of a person. The best-worn cuffs are kept as samples of successful work.']],
  ['sensory','Breath Exchange','BREATH EXCHANGE','Atmospheres by the glass','SEA AIR / TWO MINUTES',[
    'Behind individual tasting valves wait coastal air, high-altitude rain and the mineral scent of a habitable cave. Each sample is isolated from the station supply.',
    'Customers choose a memory, then a pressure, then a duration. A handwritten line on the counter promises that homesickness is not an additional charge.']],
  ['repair','Second Self Drone Works','SECOND SELF','Small machines, long second lives','REPAIR / RETURN',[
    'Docking cradles hold courier drones in various states of dignified disassembly. Repaired shells retain their old paint, route stamps and familiar dents.',
    'The technician numbers every removed screw and addresses each machine by its registered name. A waiting basket contains replacement wings in deliberately mismatched colors.']],
  ['food','Red Shift Spice Office','RED SHIFT','Spices cleared for independent trade','TRACE AMOUNTS ONLY',[
    'A bank of sealed dispensers ranges from dull copper powders to pale crystalline curls. Tiny sample drawers keep each aroma from making promises to the entire deck.',
    'The scale measures flavor in fractions the display cannot quite show. A warning beside one jar recommends adding the spice to a meal, rather than the meal to the spice.']],
  ['curios','Afterimage Memory Jewels','AFTERIMAGE','Keep a moment in the light','UNRECORDED / UNIQUE',[
    'Cut mineral slivers throw different colors across the same velvet tray. Each contains a synthetic interference pattern made from a buyer’s chosen photograph.',
    'The jeweler keeps no source images after the setting is finished. An empty ring beside the scanner is reserved for a customer who has not decided what to remember.']],
  ['habitat','Small Gravities Habitat Office','SMALL GRAVITIES','Rooms that remember your weight','ROOMS / THREE G FIELDS',[
    'Sectional habitat models show foldout gardens, private doors and beds that rotate with local gravity. An improbably small apartment contains an improbably generous window.',
    'The leasing desk offers a week of familiar weight before asking for a longer commitment. Its most popular plan is called enough room to turn around.']],
  ['pharmacy','Slowlight Apothecary','SLOWLIGHT','Transit remedies, individually screened','CHECK BEFORE MIXING',[
    'Compartmented dispensers hold sealed mineral salts, sleep patches and pressure-acclimation kits. Each shelf has its own incompatibility reader.',
    'A quiet consultation booth faces away from the traffic. The pharmacist’s most repeated advice is printed beside the queue: allow yourself time to arrive.']],
  ['curios','The Lost Constellation','LOST CONSTELLATION','Unclaimed wonders, honest labels','PROVENANCE INCLUDED',[
    'Salvaged observatory pieces sit beside polished stones from worlds no longer on the public route map. Every object carries the story the seller can actually substantiate.',
    'One display is completely empty except for its label: a very convincing story, withdrawn. The gap appears to attract as much attention as the merchandise.']],
  ['luggage','Soft Landing Cargo Atelier','SOFT LANDING','Luggage for difficult arrivals','FRAGILE / ANY GRAVITY',[
    'Suspension cases cradle cargo inside nested shock rings. A demonstration parcel drops a few centimeters and settles so gently that the paper tag hardly moves.',
    'Cases can be fitted for seed banks, heirlooms or an object whose owner declines to describe it. The smallest suitcase has more inspection stamps than the largest one.']],
  ['food','Midnight Ferment Cooperative','MIDNIGHT FERMENT','Cultures from six quiet kitchens','CULTURES / SEALED',[
    'Amber fermentation vessels stand in a temperature-stable rack, each tagged with a kitchen rather than a manufacturer. Reusable sample dishes wait beneath a sterilizing hood.',
    'The cooperative exchanges starter cultures as carefully as other traders exchange currency. A jar near the back has been traveling longer than the oldest member.']],
  ['sensory','Quiet on Credit','QUIET ON CREDIT','Borrow a little less station','SILENCE / FIVE MINUTES',[
    'Acoustic baffles frame a row of personal listening hoods. Their samples are not music: snow against a window, an empty shore, a room before anyone wakes.',
    'The service can remove the station’s mechanical rhythms for a few minutes without masking an emergency call. The waiting area is the only place on the deck where nobody competes to be heard.']],
  ['exchange','Odd Tender Clearing House','ODD TENDER','Value travels in different forms','MANY UNITS / ONE LEDGER',[
    'A mechanical rate board compares station credits with stored power, verified labor and several currencies that have no useful coins. Sample tokens rest inside labeled drawers.',
    'The clerk’s ledger gives every conversion a visible fee. A small sign below it reads: questions are free until both parties understand the answer.']],
  ['food','Aphelion Tea Room','APHELION','Steep slowly. Depart when ready.','TEA / NO DEPARTURE TIME',[
    'Insulated tea vessels gather around a broad ceramic warming plate. Their handles are different shapes so a traveler can find a familiar grip without explaining it.',
    'The house blend is calibrated for the station’s ordinary drinking water. A long table at the back is reserved for customers who are waiting for someone, however long that takes.']],
];
const east=[
  ['luggage','Orbit & Anchor Outfitters','ORBIT & ANCHOR','Tethers, boots and practical optimism','HOLD ON / LET GO',[
    'Magnetic boots, hand tethers and compact maneuvering packs hang from a load-tested display rail. Each piece can be tried against a small patch of working deck plate.',
    'The outfitter stocks bright replacement straps because dark equipment is easy to lose in a dark hold. A battered rescue tether is displayed with a note that simply says returned.']],
  ['pharmacy','Manybody Transit Clinic','MANYBODY','First care for unfamiliar conditions','PRIVATE CONSULTATIONS',[
    'Color-coded examination kits fill a cabinet with more seal types than drawers. A foldaway screening arm lets the clinician work without assuming the patient’s height.',
    'The clinic’s intake form begins with how do you prefer to communicate. Its last box asks whether somebody should wait with you.']],
  ['botany','Pocket Biospheres','POCKET BIOSPHERES','A little world with a reliable lid','ECOSYSTEMS / BALANCED',[
    'Nested terrariums demonstrate closed water cycles under miniature suns. Some hold moss, some hold translucent fronds, and one contains nothing visibly alive until its light dims.',
    'A service counter accepts old biospheres for rebalancing. The caretaker records every returned world by the name its owner gave it.']],
  ['food','Twelve Tides Protein Kitchen','TWELVE TIDES','Ocean-grown, station-made','COMPATIBILITY FIRST',[
    'Sculpted protein sheets turn slowly through a sealed preparation rack. Their colors refer to texture and seasoning, never to the species they resemble.',
    'The cook keeps a separate set of utensils for each approved biochemistry. A placard invites customers to describe a meal they miss, even if the ingredients are impossible to obtain.']],
  ['repair','Patchwork Suit Service','PATCHWORK','Your pressure suit, still yours','SEALS TESTED HERE',[
    'Pressure sleeves and helmet rings wait on angular service stands. A transparent test chamber reveals a repaired seam under the same load it will meet outside.',
    'New patches carry the date and technician’s mark. Older ones remain visible, turning a well-kept suit into a record of places that allowed its wearer to return.']],
  ['charts','Elsewhere Navigation Cabinet','ELSEWHERE','Local knowledge for distant places','ASK ABOUT THE RETURN',[
    'A brass-edged plotting table projects routes as physical layers of transparent sheet. Detours can be lifted out and compared without hiding the original journey.',
    'The shop sells arrival knowledge as well as coordinates: which berth has a working lift, whose lights stay on late, and where a tired visitor can sit without buying anything.']],
  ['botany','Rootless Nursery','ROOTLESS','Gardens that learned to travel','ROOTS / NO SOIL REQUIRED',[
    'Air-root plants spread through open lattice frames inside their quarantine cabinets. Small reservoirs carry the colors of the worlds their mineral mixes imitate.',
    'The nursery fits travel sleeves around mature roots rather than trimming them to fit the packaging. A shelf of imperfect seedlings is offered in exchange for a promise to try.']],
  ['exchange','The Useful Minute','USEFUL MINUTE','Repairs, errands and time exchanged','LOCAL SKILLS / FAIR RATES',[
    'A physical job board pairs short station tasks with the people who can do them. Sliding tabs show available tools, required clearances and payment in advance.',
    'The broker accepts no job described as easy unless its owner can explain every step. The oldest listing is a request for someone to teach a song from home.']],
  ['tailoring','Silhouette Transit Wear','SILHOUETTE','Travel clothes with room to change','LAYERS / ALL SEASONS',[
    'Layered coats hang beside expandable transit wraps and adjustable climate collars. Fabric panels are labeled by temperature range instead of fashion season.',
    'A fitting rail has been polished at several different heights. The alteration service will preserve a meaningful tear if the customer asks, and reinforce everything around it.']],
  ['curios','The Unfamiliar Instrument','UNFAMILIAR INSTRUMENT','Sound you can hold in your hands','TRY / LISTEN / ASK',[
    'Resonant bowls, finger frames and compact breath instruments rest on felt supports. A diagram beside each shows a possible technique rather than the only correct one.',
    'A worn practice instrument is always available for visitors. Its case contains notes from travelers who found that a strange object knew a familiar tune.'],'instruments'],
  ['food','Comet Crumb Bakery','COMET CRUMB','Fresh warmth on a borrowed orbit','WARM / EVERY SHIFT',[
    'Small radiant ovens face a tray of ring-shaped pastries and dense traveler’s bread. Insulated shutters keep the smell close enough to be an invitation rather than an announcement.',
    'The baker stamps each wrapper with its atmosphere and allergen requirements. A narrow shelf holds paid-for portions for whichever traveler needs one next.'],'bakery'],
  ['sensory','Borrowed Horizon','BORROWED HORIZON','Windows for a room without one','VIEWS / LOCALLY STORED',[
    'Framed landscape samples lean against a sound-damped wall: slow surf, a high plain, a city whose afternoon lasts several station days. Each view comes with its own daylight profile.',
    'The shop rents room-sized horizon panels by the month. It also offers a plain dark setting, because some customers have traveled far enough for one day.']],
  ['pharmacy','Lumen Lens Exchange','LUMEN LENS','Optics for eyes unlike ours','CALIBRATION / WHILE YOU WAIT',[
    'Faceted lens blanks sit in labeled clamps beside adjustable viewing frames. An illuminated test target changes its contrast without flooding the promenade with light.',
    'The optician measures perception before discussing resolution. Returned lenses are recut for the next traveler who might find a useful view through them.']],
  ['botany','Pollen Post','POLLEN POST','Send a season. Receive a garden.','SEEDS / VERIFIED ORIGIN',[
    'Seed envelopes are stacked inside individual pressure drawers. Their illustrated seals show mature plants, expected light cycles and how much patience a new owner will need.',
    'The dispatch counter routes living parcels through quarantine instead of around it. A growing wall behind the desk proves that the most ordinary seed can still be a remarkable arrival.']],
  ['repair','Little Courier Assembly','LITTLE COURIER','Messengers built to find their way','TOOLS / PARTS / PATIENCE',[
    'Palm-sized delivery machines sit on assembly jigs beside interchangeable cargo baskets. Their navigation lamps are tested against a miniature intersection painted on the worktop.',
    'The maker offers repairs before replacements and keeps discontinued parts in shallow, carefully indexed trays. A finished courier waits beside a handwritten instruction to be kind to the doors.']],
  ['curios','Dust Archive & Salvage','DUST ARCHIVE','Material histories, honestly repaired','OBJECTS / SECOND CHAPTERS',[
    'Fragments of obsolete habitats are cleaned, mounted and described without pretending they were always art. A section of handrail is polished by hands that never met one another.',
    'The archivist sells copies of the records with the objects. Pieces without a history are labeled unknown, leaving room for their next owner to begin one.']],
];

export const PROMENADE_SHOPS=Object.freeze([-1,1].flatMap((side,sideIndex)=>(side<0?west:east).map((entry,index)=>{
  const [type,name,signName,tagline,specialty,description,display]=entry;
  return Object.freeze({id:`promenade-${side<0?'west':'east'}-${String(index+1).padStart(2,'0')}`,side,...positions[index],type,name,signName,tagline,specialty,display,accent:colors[(index+sideIndex*2)%colors.length],variant:(index+sideIndex)%4,description:Object.freeze(description)});
})));

/** One static atlas and one opaque draw for all storefronts and counter notices. */
export function createPromenadeSigns({group,shops=PROMENADE_SHOPS,height=7.625}) {
  const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=1024;
  const ctx=canvas.getContext('2d');
  const tileWidth=512,tileHeight=128,mainHeight=96;
  const geometries=[],scratch=new THREE.Object3D();
  function fitText(value,x,y,size,maxWidth,scaleX=1,color='#e4ddc6') {
    ctx.save();ctx.translate(x,y);ctx.scale(scaleX,1);ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.font=`600 ${size}px "Space Grotesk", sans-serif`;
    const measured=ctx.measureText(value).width;
    if(measured>maxWidth/scaleX)ctx.font=`600 ${size*maxWidth/(scaleX*measured)}px "Space Grotesk", sans-serif`;
    ctx.fillStyle=color;ctx.fillText(value,0,0);ctx.restore();
  }
  function glyphStrip(index) {
    ctx.strokeStyle='#9ba99a';ctx.lineWidth=1.2;
    for(let i=0;i<8;i++){
      const x=398+i*11,y=83,mask=(index*17+i*13+7)%8;
      ctx.beginPath();ctx.moveTo(x,y+3);ctx.lineTo(x,y-4);
      if(mask&1){ctx.moveTo(x-3,y-3);ctx.lineTo(x+3,y-3);}
      if(mask&2){ctx.moveTo(x-3,y);ctx.lineTo(x+3,y);}
      if(mask&4){ctx.moveTo(x,y+3);ctx.lineTo(x+4,y);}
      ctx.stroke();
    }
  }
  function panel(index,row,x,y,z,w,h,rotation) {
    const geometry=new THREE.PlaneGeometry(w,h),uv=geometry.attributes.uv;
    const tx=index%4*tileWidth,ty=Math.floor(index/4)*tileHeight+(row?mainHeight:0),th=row?tileHeight-mainHeight:mainHeight,gutter=1.5;
    for(let i=0;i<uv.count;i++)uv.setXY(i,(tx+gutter+uv.getX(i)*(tileWidth-2*gutter))/canvas.width,1-(ty+gutter+(1-uv.getY(i))*(th-2*gutter))/canvas.height);
    scratch.position.set(x,y,z);scratch.rotation.set(0,rotation,0);scratch.scale.set(1,1,1);scratch.updateMatrix();geometry.applyMatrix4(scratch.matrix);geometries.push(geometry);
  }
  shops.forEach((shop,index)=>{
    const x=index%4*tileWidth,y=Math.floor(index/4)*tileHeight;
    ctx.save();ctx.translate(x,y);ctx.beginPath();ctx.rect(0,0,tileWidth,tileHeight);ctx.clip();
    ctx.fillStyle=index%3===0?'#283633':index%3===1?'#202d31':'#332f2a';ctx.fillRect(0,0,tileWidth,mainHeight);
    ctx.fillStyle=shop.accent;ctx.fillRect(0,0,tileWidth,4);ctx.fillRect(16,14,4,49);
    const signWidth=shop.width-.3,scaleX=tileWidth*1.16/(mainHeight*signWidth);
    fitText(shop.signName||shop.name.toUpperCase(),256,37,31,466,scaleX,shop.accent);
    fitText(shop.tagline,256,65,13,466,scaleX);
    ctx.font='10px sans-serif';ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillStyle='#b8c0ab';ctx.fillText(`PFC / DECK 02 / ${shop.side<0?'W':'E'}${String(index%16+1).padStart(2,'0')}`,22,84);
    glyphStrip(index);
    ctx.fillStyle=shop.accent;ctx.fillRect(0,mainHeight,tileWidth,tileHeight-mainHeight);
    const fasciaWidth=Math.min(shop.width-1,2.8),fasciaScale=tileWidth*.7/((tileHeight-mainHeight)*fasciaWidth);
    fitText(shop.specialty,256,mainHeight+16,12,474,fasciaScale,'#1c2c2d');
    ctx.restore();
    const rotation=-shop.side*Math.PI/2;
    panel(index,0,shop.side*27.03,height+3.3,shop.z,signWidth,1.16,rotation);
    panel(index,1,shop.side*27.025,height+.65,shop.z,fasciaWidth,.7,rotation);
  });
  const atlas=new THREE.CanvasTexture(canvas);atlas.colorSpace=THREE.SRGBColorSpace;atlas.anisotropy=4;
  const material=new THREE.MeshBasicMaterial({map:atlas,toneMapped:false});
  const geometry=mergeGeometries(geometries);geometries.forEach(item=>item.dispose());
  const mesh=new THREE.Mesh(geometry,material);mesh.name='Deck 02 / thirty-two independent shop signs';mesh.matrixAutoUpdate=false;group.add(mesh);
  let disposed=false;
  return {stats:{signedBusinesses:shops.length,signDrawCalls:1,signTriangles:shops.length*4,signTextures:1,signAtlasWidth:canvas.width,signAtlasHeight:canvas.height,animatedSignTextures:0},
    // A standalone preview can dispose this resource explicitly. The integrated
    // station owns these same resources through its normal traversal instead.
    dispose(){if(disposed)return;disposed=true;mesh.removeFromParent();geometry.dispose();material.dispose();atlas.dispose();},
  };
}
