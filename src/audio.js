import {createSpatialStationAudio} from './audio-sources.js';

const PROFILES = Object.freeze({
  concourse:{air:.095,airHz:850,hum:.76,crowd:.18,crowdHz:850,long:.27,close:.055,damping:2350,hull:.004,activity:18,chime:38},
  market:{air:.06,airHz:1150,hum:.35,crowd:.33,crowdHz:1180,long:.04,close:.19,damping:2700,hull:.001,activity:10,chime:63},
  observation:{air:.04,airHz:540,hum:.17,crowd:.025,crowdHz:570,long:.16,close:.025,damping:1600,hull:.001,activity:29,chime:76},
  docks:{air:.13,airHz:730,hum:1.05,crowd:.075,crowdHz:690,long:.09,close:.20,damping:1750,hull:.013,activity:16,chime:34},
});
const VOICE_LIMIT=4, CONTROL_INTERVAL=1/15;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

/** Procedural acoustics. No AudioContext or buffers exist before enabling sound. */
export function createAmbientAudio({contextFactory,onStateChange,volume=.55,footstepsEnabled=true}={}) {
  let context=null,graph=null,offline=false,disposed=false,desiredEnabled=false;
  let generation=0,suspendTimer=null,lifecycle=Promise.resolve(),lastError=null;
  let level=Number.isFinite(volume)?clamp(volume,0,1):.55,footsteps=Boolean(footstepsEnabled);
  let lastUpdate=-Infinity,lastTime=null,lastSector=null,nextActivity=null,nextChime=null;
  let seed=28763,contextsCreated=0,controlUpdates=0,peakLocalNodes=0,peakVoices=0;
  const voices=new Set();
  const hidden=()=>typeof document!=='undefined'&&document.hidden;
  const random=()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646;};
  const emit=()=>{if(onStateChange)try{onStateChange(desiredEnabled);}catch{/* UI callbacks cannot interrupt cleanup. */}};

  function target(param,value,seconds=.15) {
    if(!context||!param||!Number.isFinite(value))return;
    const now=context.currentTime;param.cancelScheduledValues(now);param.setTargetAtTime(value,now,seconds);
  }
  function fadeMaster(value,seconds) {
    if(!graph?.master||!context)return;const param=graph.master.gain,now=context.currentTime;
    if(param.cancelAndHoldAtTime)param.cancelAndHoldAtTime(now);
    else{const value=param.value;param.cancelScheduledValues(now);param.setValueAtTime(value,now);}
    param.linearRampToValueAtTime(value,now+seconds);
  }
  function track(node){graph.nodes.add(node);peakLocalNodes=Math.max(peakLocalNodes,graph.nodes.size+voices.size*3);return node;}
  function source(node){track(node);graph.sources.add(node);return node;}
  function toRoom(node,send=.5){node.connect(graph.dry);const gain=track(context.createGain());gain.gain.value=send;node.connect(gain);gain.connect(graph.reverb);return node;}
  function buffer(seconds,sampleRate,channels=1){const result=context.createBuffer(channels,Math.ceil(seconds*sampleRate),sampleRate);graph.buffers.push(result);graph.bufferBytes+=result.length*channels*4;return result;}
  function finishLoop(data){
    for(let i=0;i<600;i++){const mix=i/600;data[data.length-600+i]=data[data.length-600+i]*(1-mix)+data[i]*mix;}
    // The overlap ends at an early head sample; ease its remaining offset to the actual loop start.
    const last=data.length-1,offset=data[0]-data[last];
    for(let i=0;i<600;i++){const t=i/599;data[last-599+i]+=offset*(.5-.5*Math.cos(Math.PI*t));}
    data[last]=data[0];
  }
  function noiseBuffer(){
    const result=buffer(4.1,24000),data=result.getChannelData(0);let brown=0;
    for(let i=0;i<data.length;i++){brown=(brown+(random()*2-1)*.024)/1.018;data[i]=brown*3+(random()*2-1)*.012;}
    finishLoop(data);
    return result;
  }
  function murmurs(){
    const result=buffer(5.7,24000),data=result.getChannelData(0);let phase=0,brown=0;
    for(let i=0;i<data.length;i++){
      const t=i/24000,syllables=.37+.23*Math.sin(t*7.13+Math.sin(t*2.1))+.18*Math.sin(t*13.77+.8);
      brown=(brown+(random()*2-1)*.13)/1.04;phase+=Math.PI*2*(143+11*Math.sin(t*1.73)+5*Math.sin(t*4.17))/24000;
      const voiced=Math.sin(phase)*.22+Math.sin(phase*2)*.12+Math.sin(phase*3)*.08+Math.sin(phase*5)*.04;
      data[i]=(brown*1.15+voiced+(random()*2-1)*.08)*Math.max(.03,syllables);
    }
    finishLoop(data);
    return result;
  }
  function impulse(seconds,closeRoom){
    // A ConvolverNode requires its impulse at the context's native sample rate.
    const result=buffer(seconds,context.sampleRate,2);
    for(let channel=0;channel<2;channel++){
      const data=result.getChannelData(channel);let softened=0;
      for(let i=0;i<data.length;i++){const t=i/context.sampleRate;softened=softened*.59+(random()*2-1)*.41;data[i]=softened*Math.exp(-t/(closeRoom?.11:.48))*.11;}
      const taps=closeRoom?[[.013,.55],[.029,.34],[.047,.19],[.081,.1]]:[[.037,.55],[.071,.39],[.113,.25],[.177,.16],[.269,.1]];
      for(const [delay,amplitude]of taps){const index=Math.floor((delay+channel*.0017)*context.sampleRate);if(index<data.length)data[index]+=amplitude;}
    }
    return result;
  }
  function init(){
    if(context?.state==='closed'){context.removeEventListener?.('statechange',stateChanged);releaseGraph();context=null;}
    if(graph)return true;
    const Constructor=typeof window!=='undefined'&&(window.AudioContext||window.webkitAudioContext);
    if(!contextFactory&&!Constructor)return false;
    context=contextFactory?contextFactory():new Constructor({latencyHint:'balanced'});
    contextsCreated++;offline=typeof context.startRendering==='function';
    graph={nodes:new Set(),sources:new Set(),buffers:[],bufferBytes:0,motors:[],crowds:[],spatial:null};
    const master=graph.master=track(context.createGain());master.gain.value=0;
    const highpass=track(context.createBiquadFilter());highpass.type='highpass';highpass.frequency.value=29;highpass.Q.value=.5;
    const dynamics=track(context.createDynamicsCompressor());dynamics.threshold.value=-18;dynamics.knee.value=18;dynamics.ratio.value=3;dynamics.attack.value=.012;dynamics.release.value=.28;
    master.connect(highpass);highpass.connect(dynamics);dynamics.connect(context.destination);
    graph.dry=track(context.createGain());graph.dry.connect(master);
    graph.reverb=track(context.createGain());graph.damping=track(context.createBiquadFilter());graph.damping.type='lowpass';graph.damping.frequency.value=2300;graph.damping.Q.value=.3;graph.reverb.connect(graph.damping);
    graph.long=track(context.createGain());graph.long.gain.value=.27;graph.close=track(context.createGain());graph.close.gain.value=.055;
    for(const[duration,closeRoom,output]of[[2.1,false,graph.long],[.48,true,graph.close]]){
      const convolver=track(context.createConvolver());convolver.normalize=true;convolver.buffer=impulse(duration,closeRoom);graph.damping.connect(convolver);convolver.connect(output);output.connect(master);
    }
    graph.pa=track(context.createBiquadFilter());graph.pa.type='bandpass';graph.pa.frequency.value=1050;graph.pa.Q.value=.5;toRoom(graph.pa,.9);
    graph.hum=track(context.createGain());graph.hum.gain.value=.76;
    const machineFilter=track(context.createBiquadFilter());machineFilter.type='lowpass';machineFilter.frequency.value=250;machineFilter.Q.value=.25;
    graph.humPan=track(context.createStereoPanner());graph.humPan.pan.value=-.17;graph.hum.connect(machineFilter);machineFilter.connect(graph.humPan);toRoom(graph.humPan,.26);
    for(const[frequency,loudness,wave]of[[41.8,.09,'sine'],[83.77,.027,'sine'],[125.55,.009,'triangle']]){
      const oscillator=source(context.createOscillator()),gain=track(context.createGain());oscillator.type=wave;oscillator.frequency.value=frequency;gain.gain.value=loudness;oscillator.connect(gain);gain.connect(graph.hum);oscillator.start();graph.motors.push({oscillator,frequency});
    }
    const noise=graph.noise=noiseBuffer(),airflow=source(context.createBufferSource());airflow.buffer=noise;airflow.loop=true;
    graph.airFilter=track(context.createBiquadFilter());graph.airFilter.type='lowpass';graph.airFilter.frequency.value=850;
    graph.air=track(context.createGain());graph.air.gain.value=.095;graph.airPan=track(context.createStereoPanner());airflow.connect(graph.airFilter);graph.airFilter.connect(graph.air);graph.air.connect(graph.airPan);toRoom(graph.airPan,.4);airflow.start();
    const crowdBuffer=murmurs();
    for(let i=0;i<2;i++){
      const murmur=source(context.createBufferSource());murmur.buffer=crowdBuffer;murmur.loop=true;murmur.playbackRate.value=i?1.073:.917;
      const filter=track(context.createBiquadFilter());filter.type='bandpass';filter.frequency.value=i?1120:730;filter.Q.value=.65;
      const gain=track(context.createGain());gain.gain.value=.18;const pan=track(context.createStereoPanner());pan.pan.value=i?.55:-.5;
      murmur.connect(filter);filter.connect(gain);gain.connect(pan);toRoom(pan,.55);murmur.start(0,i?2.13:.4);graph.crowds.push({filter,gain,pan});
    }
    const hull=source(context.createOscillator());hull.type='triangle';hull.frequency.value=35.2;graph.hull=track(context.createGain());graph.hull.gain.value=.004;
    const hullPan=track(context.createStereoPanner());hullPan.pan.value=.35;hull.connect(graph.hull);graph.hull.connect(hullPan);toRoom(hullPan,.18);hull.start();
    graph.spatial=createSpatialStationAudio({context,dryInput:graph.dry,reverbInput:graph.reverb,noiseBuffer:noise});graph.spatial.setFootstepsEnabled(footsteps);
    graph.ready=true;context.addEventListener?.('statechange',stateChanged);return true;
  }
  function cleanVoice(voice){if(!voices.delete(voice))return;voice.oscillator.onended=null;for(const node of[voice.oscillator,voice.gain,voice.pan])try{node.disconnect();}catch{/* Context already released. */}}
  function clearVoices(release=false){
    const now=context?.currentTime||0;
    for(const voice of voices){
      if(release){const value=voice.gain.gain.value;voice.gain.gain.cancelScheduledValues(now);voice.gain.gain.setValueAtTime(value,now);voice.gain.gain.linearRampToValueAtTime(0,now+.018);try{voice.oscillator.stop(now+.02);}catch{/* Note ended. */}}
      else{try{voice.oscillator.stop();}catch{/* Note ended. */}cleanVoice(voice);}
    }
  }
  function softNote(frequency,delay,loudness,duration,pan=0,type='sine',radio=false,endFrequency){
    if(!graph||!desiredEnabled||voices.size>=VOICE_LIMIT)return;
    const oscillator=context.createOscillator(),gain=context.createGain(),panner=context.createStereoPanner(),at=context.currentTime+delay,voice={oscillator,gain,pan:panner};voices.add(voice);
    peakVoices=Math.max(peakVoices,voices.size);peakLocalNodes=Math.max(peakLocalNodes,graph.nodes.size+voices.size*3);
    oscillator.type=type;oscillator.frequency.setValueAtTime(frequency,at);if(endFrequency)oscillator.frequency.exponentialRampToValueAtTime(endFrequency,at+duration*.75);
    gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(loudness,at+.018);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);panner.pan.value=clamp(pan,-1,1);
    oscillator.connect(gain);gain.connect(panner);panner.connect(radio?graph.pa:graph.dry);if(!radio)panner.connect(graph.reverb);
    oscillator.onended=()=>cleanVoice(voice);oscillator.start(at);oscillator.stop(at+duration+.025);
  }
  function activity(sector,time){
    if(sector==='market'){const pan=Math.sin(time*.13)*.5;softNote(1371,0,.014,.14,pan);softNote(2039,.024,.004,.17,pan);softNote(644,.32,.005,.65,-.3,'triangle',false,712);}
    else if(sector==='docks'){softNote(86,0,.024,.23,.45,'triangle');softNote(57,.34,.011,.48,-.28);}
    else if(sector==='observation'){softNote(783.99,0,.0035,2.3,-.45);softNote(1174.66,.37,.0017,2.7,.35);}
    else{softNote(392,0,.009,.7,-.27,'sine',true);softNote(523.25,.28,.007,1.05,-.23,'sine',true);}
  }
  function chime(sector,upper){
    const gain=sector==='observation'?.003:sector==='market'?.007:sector==='docks'?.013:.016*(1-upper*.4);
    softNote(587.33,0,gain,.85,-.38,'sine',true);softNote(440,.34,gain*.68,1.15,-.32,'sine',true);softNote(659.25,.79,gain*.45,1.4,-.3,'sine',true);
  }
  function resetScheduling(release=true){nextActivity=nextChime=null;lastSector=null;lastTime=null;lastUpdate=-Infinity;clearVoices(release);graph?.spatial?.reset();}
  function clearSuspendTimer(){if(suspendTimer!==null){clearTimeout(suspendTimer);suspendTimer=null;}}
  function synchronizeContext(){
    lifecycle=lifecycle.catch(()=>{}).then(async()=>{if(disposed||!context||offline||context.state==='closed')return;if(desiredEnabled&&!hidden())await context.resume();else if(context.state!=='suspended')await context.suspend();});return lifecycle;
  }
  function fadeIn(){if(graph&&desiredEnabled&&!hidden())fadeMaster(level*.65,.25);}
  function scheduleSuspend(){
    clearSuspendTimer();if(!context||offline)return;const token=generation;
    suspendTimer=setTimeout(()=>{suspendTimer=null;if(disposed||token!==generation||(desiredEnabled&&!hidden()))return;clearVoices();synchronizeContext().catch(()=>{});},180);
  }
  function silence(){fadeMaster(0,.06);resetScheduling();scheduleSuspend();}
  function releaseFailedInit(){
    const failed=context,isOffline=offline;failed?.removeEventListener?.('statechange',stateChanged);releaseGraph();context=null;offline=false;
    if(failed&&!isOffline&&failed.state!=='closed')try{failed.close()?.catch?.(()=>{});}catch{/* An incomplete context may already have closed. */}
  }
  function stateChanged(){
    if(disposed)return;
    if(context?.state==='closed'){desiredEnabled=false;resetScheduling(false);lastError='Audio context closed';}
    else if(context?.state==='running'&&desiredEnabled&&!hidden())fadeIn();emit();
  }
  function visibilityChanged(){
    if(disposed||!context||offline)return;clearSuspendTimer();resetScheduling();
    if(hidden()){fadeMaster(0,.06);scheduleSuspend();}
    else if(desiredEnabled)synchronizeContext().then(fadeIn).catch(()=>{lastError='Tap sound to resume';emit();});
  }
  if(typeof document!=='undefined')document.addEventListener('visibilitychange',visibilityChanged);
  function releaseGraph(){
    if(!graph)return;resetScheduling(false);graph.spatial?.dispose();for(const item of graph.sources)try{item.stop();}catch{/* Source already stopped. */}
    for(const item of graph.nodes)try{item.disconnect();}catch{/* Context already closed. */}graph.nodes.clear();graph.sources.clear();graph.buffers.length=0;graph=null;
  }
  return {
    async setEnabled(value){
      if(disposed)return false;desiredEnabled=Boolean(value);const token=++generation;clearSuspendTimer();lastError=null;
      if(!desiredEnabled){silence();emit();return false;}
      try{
        if(!init()){desiredEnabled=false;lastError='Web Audio is unavailable';emit();return false;}
        resetScheduling();await synchronizeContext();if(disposed||token!==generation||!desiredEnabled)return false;
        if(!offline&&!hidden()&&context.state!=='running'){desiredEnabled=false;lastError='Tap sound to resume';silence();emit();return false;}
        fadeIn();emit();return true;
      }catch(error){if(token===generation&&!disposed){desiredEnabled=false;lastError=error?.message||'Audio could not start';if(graph?.ready)silence();else releaseFailedInit();emit();}return false;}
    },
    get enabled(){return desiredEnabled&&!disposed;},get volume(){return level;},
    setVolume(value){if(!Number.isFinite(value))return;level=clamp(value,0,1);if(graph&&desiredEnabled&&!hidden())fadeMaster(level*.65,.12);},
    setFootstepsEnabled(value){footsteps=Boolean(value);graph?.spatial?.setFootstepsEnabled(footsteps);},
    get stats(){const spatial=graph?.spatial?.stats;return{enabled:desiredEnabled,contextState:context?.state||'not-created',contextsCreated,disposed,volume:level,footstepsEnabled:footsteps,activeVoices:voices.size+(spatial?.activeVoices||0),maxCoreVoices:VOICE_LIMIT,peakCoreVoices:peakVoices,coreNodes:graph?.nodes.size||0,nodeCount:(graph?.nodes.size||0)+voices.size*3+(spatial?.nodeCount||0),peakCoreNodes:peakLocalNodes,bufferBytes:(graph?.bufferBytes||0)+(spatial?.bufferBytes||0),controlHz:15,controlUpdates,sector:lastSector,lastError,spatial:spatial||null};},
    update(position,time,environment={}){
      if(disposed||!graph||!desiredEnabled||hidden()||(!offline&&context.state!=='running')||!Number.isFinite(time))return;
      if(lastTime!==null&&time<lastTime)resetScheduling();lastTime=time;if(time-lastUpdate<CONTROL_INTERVAL)return;lastUpdate=time;controlUpdates++;
      const x=position?.x??position?.[0]??0,y=position?.y??position?.[1]??1.75,z=position?.z??position?.[2]??0;if(!Number.isFinite(x+y+z))return;
      const fallback=z<-129.8?'docks':x>31.8?'observation':x< -31.8?'market':'concourse',sector=Object.hasOwn(PROFILES,environment.sector)?environment.sector:fallback,profile=PROFILES[sector],upper=sector==='concourse'?clamp((y-3)/6,0,1):0;
      target(graph.airFilter.frequency,profile.airHz-upper*140,.8);target(graph.air.gain,profile.air*(1-upper*.12),.9);target(graph.hum.gain,profile.hum*(1-upper*.3),1.2);target(graph.hull.gain,profile.hull,.8);
      target(graph.airPan.pan,Math.sin(time*.047)*.13,.7);target(graph.humPan.pan,Math.sin(time*.031+.5)*.22,1);target(graph.long.gain,profile.long*(1+upper*.17),.75);target(graph.close.gain,profile.close,.75);target(graph.damping.frequency,profile.damping,.8);
      for(let i=0;i<graph.motors.length;i++){const motor=graph.motors[i];target(motor.oscillator.frequency,motor.frequency*(1+Math.sin(time*(.019+i*.007)+i)*.0008),1);}
      for(let i=0;i<graph.crowds.length;i++){const crowd=graph.crowds[i],ebb=.73+.17*Math.sin(time*(.13+i*.019)+i*2)+.09*Math.sin(time*.37+i);target(crowd.gain.gain,profile.crowd*(1-upper*.64)*ebb,.5);target(crowd.filter.frequency,profile.crowdHz*(i?1.23:.83),.8);}
      graph.spatial.update(position,time,environment);
      if(lastSector!==sector){lastSector=sector;nextActivity=time+(sector==='observation'?12:4);nextChime=time+(sector==='observation'?45:18);}
      if(nextActivity===null)nextActivity=time+4;if(nextChime===null)nextChime=time+18;
      if(time>=nextActivity){activity(sector,time);nextActivity=time+profile.activity+random()*7;}
      if(time>=nextChime){chime(sector,upper);nextChime=time+profile.chime+random()*16;}
    },
    dispose(){if(disposed)return;disposed=true;desiredEnabled=false;generation++;clearSuspendTimer();if(typeof document!=='undefined')document.removeEventListener('visibilitychange',visibilityChanged);context?.removeEventListener?.('statechange',stateChanged);releaseGraph();if(context&&!offline&&context.state!=='closed')try{const closing=context.close();closing?.catch?.(()=>{});}catch{/* Already closed. */}emit();},
  };
}
