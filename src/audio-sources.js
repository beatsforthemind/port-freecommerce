const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const wrap=(value,period)=>((value%period)+period)%period;
const smooth=value=>{const t=clamp(value,0,1);return t*t*(3-2*t);};

/** Same 120-second out-and-back clock as the transport vertex shader. */
export function serviceProgress(clock) {
  const t=wrap(clock,120);
  if(t<8)return 0;
  if(t<60)return smooth((t-8)/52);
  if(t<68)return 1;
  return 1-smooth((t-68)/52);
}

function serviceVelocity(clock) {
  const t=wrap(clock,120);
  if(t<8||(t>=60&&t<68))return 0;
  const u=t<60?(t-8)/52:(t-68)/52;
  return (t<60?1:-1)*186*6*u*(1-u)/52;
}

function liftProgress(clock) {
  const t=wrap(clock,120);
  if(t<8)return 1;
  if(t<24)return 1-smooth((t-8)/16);
  if(t<104)return 0;
  return smooth((t-104)/16);
}

function liftVelocity(clock) {
  const t=wrap(clock,120);
  if(t<8||(t>=24&&t<104))return 0;
  const u=t<24?(t-8)/16:(t-104)/16;
  return 5.735*6*u*(1-u)/16;
}

function roomAt(x,z) {
  return z< -129.8?'docks':x>31.8?'observation':x< -31.8?'market':'concourse';
}

function throughPortal(room,x,z,sx,sz) {
  if(room==='concourse')return true;
  if(room==='docks') {
    if(Math.abs(sz-z)<1e-8)return false;
    const across=x+(sx-x)*((-130-z)/(sz-z));
    return across> -11&&across<11;
  }
  if(Math.abs(sx-x)<1e-8)return false;
  const across=z+(sz-z)*(((room==='market'?-32:32)-x)/(sx-x));
    return room==='market'?across>18&&across<42:across> -40&&across<0;
}

function crossed(previous,current,edge) {
  return Math.floor((current-edge)/120)>Math.floor((previous-edge)/120);
}

/**
 * Quiet, spatial activity beneath the shared room bed. Five reusable emitters
 * and at most eight short voices use equal-power stereo rather than HRTF work.
 * The caller owns context, output buses and the optional shared noise buffer.
 */
export function createSpatialStationAudio({context,dryInput,reverbInput,noiseBuffer}={}) {
  if(!context||!dryInput||!reverbInput)throw new Error('Spatial station audio requires a context and two output buses.');
  const continuous=[],voices=new Set(),emitters=[];
  const scratch={gain:0,pan:0,cutoff:900,distance:0};
  let disposed=false,footstepsEnabled=true,initializedMovement=false;
  let previousX=0,previousZ=0,previousTime=0,stepDistance=0,lastStep=-Infinity,footSide=1;
  let previousService=NaN,peakVoices=0,createdVoices=0,droppedVoices=0;
  let footsteps=0,serviceCues=0,teleportsSuppressed=0,bufferBytes=0;
  let listenerX=0,listenerY=1.75,listenerZ=0,listenerYaw=0,listenerRoom='concourse';
  let randomState=73129;
  const random=()=>{randomState=randomState*16807%2147483647;return (randomState-1)/2147483646;};
  const track=node=>{continuous.push(node);return node;};

  function automation(param,value,now,constant=.12) {
    if(typeof param.cancelAndHoldAtTime==='function')param.cancelAndHoldAtTime(now);
    else param.cancelScheduledValues(now);
    param.setTargetAtTime(value,now,constant);
  }

  function makeNoise() {
    const buffer=context.createBuffer(1,Math.ceil(context.sampleRate*2),context.sampleRate);
    const samples=buffer.getChannelData(0);
    let brown=0;
    for(let i=0;i<samples.length;i++){brown=(brown+(random()*2-1)*.035)/1.035;samples[i]=brown*3.2;}
    bufferBytes+=samples.byteLength;
    return buffer;
  }
  let noise=noiseBuffer||makeNoise();

  function footBuffer(surface) {
    const duration=surface===0?.19:surface===1?.16:.13;
    const buffer=context.createBuffer(1,Math.ceil(context.sampleRate*duration),context.sampleRate);
    const samples=buffer.getChannelData(0);
    let low=0;
    for(let i=0;i<samples.length;i++) {
      const t=i/context.sampleRate,n=random()*2-1;
      low=low*.73+n*.27;
      const impact=Math.sin(t*(surface===0?81:surface===1?63:116)*Math.PI*2)*Math.exp(-t*(surface===0?48:58));
      const scuff=(surface===1?low:n*.6+low*.4)*Math.exp(-t*(surface===0?34:44));
      const plate=surface===0?Math.sin(t*317*Math.PI*2)*Math.exp(-t*60)*.11:0;
      samples[i]=(impact*.43+scuff*.28+plate)*Math.min(1,t/.0025);
    }
    bufferBytes+=samples.byteLength;
    return buffer;
  }
  const footBuffers=[footBuffer(0),footBuffer(1),footBuffer(2)];
  const peakBufferBytes=bufferBytes;

  function loop(name,room,wave,frequency,cutoff,send) {
    const source=track(wave==='noise'?context.createBufferSource():context.createOscillator());
    if(wave==='noise'){source.buffer=noise;source.loop=true;}
    else {source.type=wave;source.frequency.value=frequency;}
    const filter=track(context.createBiquadFilter());
    filter.type=wave==='noise'?'bandpass':'lowpass';filter.frequency.value=cutoff;filter.Q.value=.7;
    const gain=track(context.createGain());gain.gain.value=0;
    const pan=track(context.createStereoPanner());
    const wet=track(context.createGain());wet.gain.value=send;
    source.connect(filter);filter.connect(gain);gain.connect(pan);pan.connect(dryInput);pan.connect(wet);wet.connect(reverbInput);
    if(wave==='noise') {
      source.playbackRate.value=.9+emitters.length*.047;
      source.start(context.currentTime,emitters.length*.61%noise.duration);
    } else source.start();
    const emitter={name,room,source,filter,gain,pan,wet,x:0,y:0,z:0,level:0,panValue:0,cutoff,frequency,lastFrequency:frequency,lastCutoff:cutoff};
    emitters.push(emitter);return emitter;
  }

  let freight,express,tea,repair,lift;
  try {
    freight=loop('Overhead freight','concourse','triangle',58,750,.21);
    express=loop('Overhead express','concourse','sine',105,1050,.18);
    tea=loop('Market pressure kettle','market','noise',0,1650,.09);
    repair=loop('Repair-cell tooling','concourse','noise',0,1250,.12);
    lift=loop('Service lift','concourse','noise',0,360,.13);
  } catch(error) {
    for(const node of continuous){try{node.stop?.();}catch{}try{node.disconnect();}catch{}}
    throw error;
  }

  function mixAt(x,y,z,room,range,level,cutoff=1500) {
    const dx=x-listenerX,dy=y-listenerY,dz=z-listenerZ;
    const distance=Math.hypot(dx,dy,dz);
    const near=1-smooth(distance/range);
    let leak=1,frequency=cutoff;
    if(room!==listenerRoom) {
      const doorway=throughPortal(room,listenerX,listenerZ,x,z)&&throughPortal(listenerRoom,listenerX,listenerZ,x,z);
      leak=doorway?.28:.035;frequency=doorway?650:260;
    }
    scratch.gain=level*near*near*leak;
    scratch.pan=clamp((dx*Math.cos(listenerYaw)-dz*Math.sin(listenerYaw))/Math.max(5,Math.hypot(dx,dz)),-.94,.94);
    scratch.cutoff=frequency;scratch.distance=distance;
    return scratch;
  }

  function updateEmitter(emitter,x,y,z,level,range,cutoff,frequency,now) {
    const mix=mixAt(x,y,z,emitter.room,range,level,cutoff);
    emitter.x=x;emitter.y=y;emitter.z=z;
    if(Math.abs(emitter.level-mix.gain)>.00001){automation(emitter.gain.gain,mix.gain,now,.16);emitter.level=mix.gain;}
    if(Math.abs(emitter.panValue-mix.pan)>.002){automation(emitter.pan.pan,mix.pan,now,.13);emitter.panValue=mix.pan;}
    if(Math.abs(emitter.lastCutoff-mix.cutoff)>2){automation(emitter.filter.frequency,mix.cutoff,now,.2);emitter.lastCutoff=mix.cutoff;}
    if(emitter.source.frequency&&Math.abs(emitter.lastFrequency-frequency)>.1){automation(emitter.source.frequency,frequency,now,.12);emitter.lastFrequency=frequency;}
  }

  function release(voice) {
    if(voice.released)return;
    voice.released=true;voice.source.onended=null;
    for(const node of voice.nodes){try{node.disconnect();}catch{}}
    voice.source.buffer=null;voice.nodes.length=0;
    voices.delete(voice);
  }

  function stopVoice(voice,immediate=true) {
    if(!immediate) {
      if(voice.cancelled)return;
      voice.cancelled=true;
      automation(voice.gain.gain,.00001,context.currentTime,.004);
      try{voice.source.stop(context.currentTime+.025);}catch{release(voice);}
      return;
    }
    try{voice.source.stop(context.currentTime);}catch{}
    release(voice);
  }

  function play({buffer=noise,duration=.25,level=.01,pan=0,cutoff=1200,send=.12,delay=0,rate=1,offset=0}) {
    if(disposed||level<.00004)return false;
    if(voices.size>=8){droppedVoices++;return false;}
    const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain(),panner=context.createStereoPanner(),wet=context.createGain();
    source.buffer=buffer;source.playbackRate.value=rate;
    filter.type='lowpass';filter.frequency.value=cutoff;filter.Q.value=.65;
    panner.pan.value=clamp(pan,-1,1);wet.gain.value=send;
    source.connect(filter);filter.connect(gain);gain.connect(panner);panner.connect(dryInput);panner.connect(wet);wet.connect(reverbInput);
    const at=context.currentTime+delay;
    gain.gain.setValueAtTime(0,at);
    gain.gain.linearRampToValueAtTime(level,at+.006);
    gain.gain.exponentialRampToValueAtTime(.00001,at+duration);
    const voice={source,gain,nodes:[source,filter,gain,panner,wet],released:false,cancelled:false};
    voices.add(voice);createdVoices++;peakVoices=Math.max(peakVoices,voices.size);
    source.onended=()=>release(voice);
    const maximumOffset=Math.max(0,buffer.duration-duration*rate-.01);
    try{source.start(at,clamp(offset,0,maximumOffset));source.stop(at+duration+.015);}catch(error){release(voice);throw error;}
    return true;
  }

  function localCue(x,y,z,room,level,duration,cutoff,send=.2,delay=0) {
    const mix=mixAt(x,y,z,room,46,level,cutoff);
    if(play({level:mix.gain,pan:mix.pan,cutoff:mix.cutoff,duration,send,delay,offset:random()*Math.max(0,noise.duration-.9)}))serviceCues++;
  }

  function transportCues(previous,current) {
    const expressPrevious=previous+60,expressCurrent=current+60;
    for(let end=0;end<2;end++) {
      const edge=end*60,z=end?78:-108;
      if(crossed(previous,current,edge))localCue(-14,24.45,z,'concourse',.037,.36,460);
      if(crossed(expressPrevious,expressCurrent,edge)) {
        localCue(14,24.45,z,'concourse',.028,.38,560);
        localCue(15.6,24.45,z,'concourse',.015,.62,1700,.19,.12);
      }
      if(crossed(expressPrevious,expressCurrent,edge+6.6))localCue(15.6,24.45,z,'concourse',.012,.38,1250);
      const phase=end?0:60;
      if(crossed(previous+phase,current+phase,0))localCue(23,23.36,z,'concourse',.015,.2,410);
      if(crossed(previous+phase,current+phase,24))localCue(23,17.625,z,'concourse',.012,.17,350);
    }
  }

  function updateSteps(x,z,time,environment,now) {
    const valid=environment.mode==='exploring';
    if(!initializedMovement||!valid||!footstepsEnabled) {
      previousX=x;previousZ=z;previousTime=time;initializedMovement=valid&&footstepsEnabled;stepDistance=0;
      return;
    }
    const dx=x-previousX,dz=z-previousZ,distance=Math.hypot(dx,dz),dt=time-previousTime;
    previousX=x;previousZ=z;previousTime=time;
    if(distance>2.5||dt<=0||dt>.5) {stepDistance=0;teleportsSuppressed++;return;}
    if(distance<.002)return;
    const speed=distance/dt,stride=1.1+Math.min(1,speed/10)*.9;
    stepDistance+=distance;
    if(stepDistance<stride||now-lastStep<.245)return;
    stepDistance%=stride;lastStep=now;footSide=-footSide;
    const surface=listenerRoom==='market'?1:listenerRoom==='observation'?2:0;
    const level=(surface===1?.026:.031)*(speed>8?1.12:1);
    if(play({buffer:footBuffers[surface],duration:footBuffers[surface].duration,level,pan:footSide*.12,cutoff:surface===1?850:surface===2?1700:2100,send:surface===0?.17:.10,rate:.94+random()*.1}))footsteps++;
  }

  return {
    update(position,time,environment={}) {
      if(disposed)return;
      const x=position?.x??position?.[0]??0,y=position?.y??position?.[1]??1.75,z=position?.z??position?.[2]??0;
      if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z)||!Number.isFinite(time))return;
      const now=context.currentTime;
      listenerX=x;listenerY=y;listenerZ=z;listenerYaw=Number.isFinite(environment.yaw)?environment.yaw:0;
      const room=environment.sector;
      listenerRoom=room==='concourse'||room==='market'||room==='observation'||room==='docks'?room:roomAt(x,z);
      const service=Number.isFinite(environment.serviceTime)?environment.serviceTime:time+32;
      const moving=!environment.reducedMotion;
      const freightSpeed=moving?Math.abs(serviceVelocity(service)):0;
      const expressSpeed=moving?Math.abs(serviceVelocity(service+60)):0;
      updateEmitter(freight,-14,24.45,-108+186*serviceProgress(service),.014*Math.min(1,freightSpeed/2.4),74,800,52+freightSpeed*9,now);
      updateEmitter(express,14,24.45,-108+186*serviceProgress(service+60),.012*Math.min(1,expressSpeed/2.4),69,1100,88+expressSpeed*8,now);
      updateEmitter(tea,-58,1.3,30,.005*(.75+.25*Math.sin(time*.19)),25,1700,0,now);
      updateEmitter(repair,28.7,1.45,28,moving?.002+.012*Math.max(0,Math.sin(service*.5))**16:0,23,1350,0,now);
      const northDistance=(x-23)**2+(z+108)**2,southDistance=(x-23)**2+(z-78)**2;
      const north=northDistance<southDistance,phase=north?60:0,liftSpeed=moving?liftVelocity(service+phase):0;
      updateEmitter(lift,23,18.335+5.735*liftProgress(service+phase),north?-108:78,.012*Math.min(1,liftSpeed/.35),35,440,0,now);
      if(moving&&Number.isFinite(previousService)&&service>=previousService&&service-previousService<2)transportCues(previousService,service);
      previousService=service;
      updateSteps(x,z,time,environment,now);
    },
    setFootstepsEnabled(value) {
      footstepsEnabled=Boolean(value);initializedMovement=false;stepDistance=0;
    },
    reset() {
      if(disposed)return;
      for(const voice of voices)stopVoice(voice,false);
      initializedMovement=false;stepDistance=0;lastStep=-Infinity;previousService=NaN;
      const now=context.currentTime;
      for(const emitter of emitters){automation(emitter.gain.gain,0,now,.025);emitter.level=0;}
    },
    get stats() {
      return {continuousNodes:continuous.length,nodeCount:disposed?0:continuous.length+voices.size*5,activeVoices:voices.size,peakVoices,maxVoices:8,createdVoices,droppedVoices,bufferBytes,peakBufferBytes,footsteps,serviceCues,teleportsSuppressed,footstepsEnabled,
        emitters:emitters.map(emitter=>({name:emitter.name,x:emitter.x,y:emitter.y,z:emitter.z,gain:emitter.level,pan:emitter.panValue,cutoff:emitter.lastCutoff}))};
    },
    dispose() {
      if(disposed)return;
      disposed=true;
      for(const voice of voices)stopVoice(voice);
      for(const node of continuous){try{node.stop?.();}catch{}try{node.disconnect();}catch{}if('buffer' in node)node.buffer=null;}
      continuous.length=emitters.length=footBuffers.length=0;
      freight=express=tea=repair=lift=noise=null;bufferBytes=0;
    },
  };
}
