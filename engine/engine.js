// Cargo Bay — shared game engine.
// Each matching system is its own page (index.html = oxygen fractions, words/ = word types, rhymes/, conjugation/ = Spanish verbs). A page
// defines window.CARGO_MODE, then loads this file, which injects the styles and HUD markup and runs
// the game. Everything here is common, so engine updates reach every mode at once.
//
// window.CARGO_MODE:
//   id                    save slot / protocol id (also add the mode to MODES below)
//   title, intro          start screen: "CARGO BAY: <title> PROTOCOL" and the one line under it,
//                         "Sort the <things> by their <property>." (everything else is left to discover)
//   scanLabel             caption over the scanner readout
//   pickValue(sector)     a random value for this sector: any plain object with a `key`
//   makeItem(value, sector, labels)  how one rock shows that value: {rep, text, glyph?}
//                         (labels: texts the barrels are showing right now)
//   same(a, b)            optional; values match (default: same key)
//   repLabel(item)        optional; line beside the readout while a rock is held (\n breaks lines)
//   readoutHTML(item)     optional; custom scanner markup (default: item.text)
//   drawGlyph(ctx, glyph, x, y, r, colors)  optional; draws item.glyph on a barrel hologram, returns true
// A barrel is labelled with its first rock's item (text/glyph); the value it matches stays hidden.
(function(){
const ENGINE_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Rajdhani:wght@500;600;700&display=swap');

:root{
  --void:#04060a;
  --panel:#161c26;
  --panel-2:#1f2733;
  --panel-3:#293244;
  --border:#3c4759;
  --metal-hi:#6b7a94;
  --amber:#ffb648;
  --amber-dim:#7a5323;
  --cyan:#5be6d9;
  --cyan-dim:#194b48;
  --danger:#ff5252;
  --danger-dim:#5a1414;
  --success:#7cffb2;
  --text-hi:#eef3fb;
  --text-mid:#9fb0c9;
  --text-dim:#5c6b85;
  --font-display: 'Orbitron', 'Segoe UI', sans-serif;
  --font-body: 'Rajdhani', 'Segoe UI', sans-serif;
}
*{box-sizing:border-box; -webkit-tap-highlight-color:transparent;}
html,body{
  margin:0; padding:0; width:100%; height:100%; overflow:hidden;
  background:var(--void);
  font-family:var(--font-body);
  color:var(--text-hi);
  touch-action:none;
  user-select:none;
}
#app{position:fixed; inset:0; width:100%; height:100%;}
#stage{position:absolute; inset:0; width:100%; height:100%;}
canvas{display:block; width:100%; height:100%; touch-action:none;}
#stage canvas{position:absolute; left:0; top:0;}

.panel{
  background:linear-gradient(160deg, var(--panel-2), var(--panel));
  border:1px solid var(--border);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.03), 0 6px 18px rgba(0,0,0,0.45);
  position:relative;
}
.panel::before{
  content:"";
  position:absolute; inset:0;
  background:repeating-linear-gradient(0deg, rgba(255,255,255,0.015) 0px, rgba(255,255,255,0.015) 1px, transparent 1px, transparent 3px);
  pointer-events:none;
}
.notch{clip-path:polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);}

#hullPanel{
  position:absolute; top:14px; left:14px; z-index:20;
  padding:10px 16px 12px 14px; min-width:190px;
  border-radius:4px;
}
.hud-label{
  font-family:var(--font-display); font-size:10px; letter-spacing:2px;
  color:var(--text-dim); margin-bottom:6px; display:flex; justify-content:space-between;
}
.hud-label span.val{color:var(--cyan);}
#hullBarTrack{
  height:10px; width:100%; background:#0b0f16; border:1px solid var(--border); border-radius:2px; overflow:hidden;
  position:relative;
}
#hullBarFill{
  height:100%; width:100%;
  background:linear-gradient(90deg, #3fce8a, var(--success));
  transition:width .35s ease, background .35s ease;
}
#hullBarTicks{position:absolute; inset:0; display:flex;}
#hullBarTicks div{flex:1; border-right:1px solid rgba(0,0,0,0.5);}

#topRight{
  position:absolute; top:14px; right:14px; z-index:20;
  display:flex; align-items:center; gap:8px;
}
#sectorPanel{
  padding:10px 16px; text-align:right; border-radius:4px;
}
#sectorPanel .hud-label{justify-content:flex-end; gap:8px;}
#sectorValue{font-family:var(--font-display); font-size:20px; font-weight:700; color:var(--amber); letter-spacing:1px;}
#barrelDots{display:flex; gap:6px; margin-top:8px; justify-content:flex-end;}
.cdot{width:9px;height:9px;border-radius:2px; background:#0b0f16; border:1px solid var(--border); transform:rotate(45deg);}
.cdot.on{background:var(--success); border-color:var(--success); box-shadow:0 0 6px var(--success);}

#audioToggle{
  width:auto; padding:6px 10px; border-radius:4px; cursor:pointer;
  font-family:var(--font-display); font-size:9px; letter-spacing:1.5px; color:var(--text-mid);
  display:flex; align-items:center; gap:6px;
}
#audioToggle .dot{width:6px;height:6px;border-radius:50%; background:var(--cyan); box-shadow:0 0 5px var(--cyan);}
#audioToggle.off .dot{background:var(--danger); box-shadow:0 0 5px var(--danger);}

#toolbar{
  position:absolute; left:50%; bottom:14px; transform:translateX(-50%);
  z-index:20; width:min(640px, 92vw); border-radius:6px;
  padding:10px 22px 12px;
  display:flex; align-items:center; justify-content:center; gap:22px;
}
#toolbar .scanLabel{
  font-family:var(--font-display); font-size:10px; letter-spacing:3px; color:var(--text-dim);
  text-align:center;
}
#toolbarInner{display:flex; align-items:center; gap:22px; width:100%; justify-content:center;}
#o2Readout{
  font-family:var(--font-display); font-weight:900; font-size:clamp(30px,6vw,46px);
  color:var(--text-dim); letter-spacing:1px; min-width:150px; text-align:center; white-space:nowrap;
  transition:color .15s ease, text-shadow .15s ease;
}
#o2Readout .pie{height:1.15em; width:1.15em; display:block; margin:0 auto; filter:drop-shadow(0 0 6px rgba(91,230,217,0.45));}
#o2Readout.active{color:var(--cyan); text-shadow:0 0 16px rgba(91,230,217,0.55);}
#toolbarSide{display:flex; flex-direction:column; gap:4px; min-width:170px;}
#repLabel{font-family:var(--font-display); font-size:9px; letter-spacing:2px; color:var(--text-dim); white-space:pre-line;}
#idlePrompt{
  font-family:var(--font-body); font-size:15px; font-weight:600; color:var(--text-dim);
  letter-spacing:.5px; text-align:center;
}

#toastLayer{
  position:absolute; inset:0; z-index:25; pointer-events:none;
  display:flex; align-items:center; justify-content:center;
}
.toast{
  font-family:var(--font-display); font-weight:700; text-align:center;
  padding:18px 34px; border-radius:6px; letter-spacing:2px;
  background:rgba(10,13,20,0.72); border:1px solid var(--border);
  backdrop-filter:blur(3px);
  opacity:0; transform:translateY(10px) scale(.96);
  transition:opacity .35s ease, transform .35s ease;
}
.toast.show{opacity:1; transform:translateY(0) scale(1);}
.toast .big{font-size:clamp(18px,3.4vw,30px);}
.toast.warn{color:var(--danger); border-color:var(--danger-dim); box-shadow:0 0 30px rgba(255,82,82,0.25);}
.toast.good{color:var(--success); border-color:#1f5a3a; box-shadow:0 0 30px rgba(124,255,178,0.2);}
.toast.info{color:var(--cyan); border-color:var(--cyan-dim); box-shadow:0 0 30px rgba(91,230,217,0.2);}
.toast .sub{font-family:var(--font-body); font-size:13px; font-weight:600; letter-spacing:1px; color:var(--text-mid); margin-top:6px;}

#warnFlash{
  position:absolute; inset:0; z-index:18; pointer-events:none;
  background:radial-gradient(ellipse at center, rgba(255,0,0,0) 55%, rgba(255,40,40,0.35) 100%);
  opacity:0; transition:opacity .12s ease;
}
#warnFlash.show{opacity:1;}

.overlay{
  position:absolute; inset:0; z-index:40;
  background:radial-gradient(ellipse at 50% 30%, #101a26 0%, #04060a 75%);
  display:flex; align-items:center; justify-content:safe center; flex-direction:column;
  text-align:center; padding:20px;
  overflow-y:auto; touch-action:pan-y;   /* short phone screens: scroll to reach the button */
}
.overlay.hidden{display:none;}
.overlay h1{
  font-family:var(--font-display); font-weight:900; font-size:clamp(24px,5vw,44px);
  color:var(--text-hi); letter-spacing:3px; margin:0 0 6px;
  text-shadow:0 0 24px rgba(91,230,217,0.35);
}
.overlay h1 .accent{color:var(--cyan);}
.overlay .ship{
  font-family:var(--font-display); font-size:12px; letter-spacing:4px; color:var(--amber); margin-bottom:26px;
}
.overlay p{
  max-width:560px; color:var(--text-mid); font-size:16px; line-height:1.55; margin:0 0 8px;
}
#intro{margin:4px 0 30px; font-size:18px;}
.bigBtn{
  font-family:var(--font-display); font-weight:700; letter-spacing:3px; font-size:15px;
  color:#04121a; background:linear-gradient(180deg, var(--cyan), #2fb5a8);
  border:none; padding:14px 38px; border-radius:4px; cursor:pointer;
  box-shadow:0 0 26px rgba(91,230,217,0.45);
}
.bigBtn:active{transform:translateY(1px);}
.linkBtn{
  display:block; margin:14px auto 0; background:none; border:none; cursor:pointer;
  font-family:var(--font-display); font-size:11px; letter-spacing:2px; color:var(--text-mid); text-decoration:underline;
}
.linkBtn.hidden{display:none;}
#protocolSwitch{
  margin-top:28px; display:flex; flex-wrap:wrap; align-items:center; justify-content:center; gap:10px;
  font-family:var(--font-display); font-size:10px; letter-spacing:2px; color:var(--text-dim);
}
#protocolSwitch .lbl{margin-right:4px;}
#protocolSwitch a{color:var(--text-mid); text-decoration:none; border-bottom:1px dotted var(--text-dim); padding-bottom:1px;}
#protocolSwitch a:hover{color:var(--cyan);}
#protocolSwitch .cur{color:var(--cyan);}
#protocolSwitch .sep{color:var(--text-dim);}
.bigBtn.danger{background:linear-gradient(180deg, var(--danger), #a52d2d); color:#2a0808; box-shadow:0 0 26px rgba(255,82,82,0.4);}


@media (prefers-reduced-motion: reduce){
  .toast{transition:none;}
}
`;
const MODE = window.CARGO_MODE;
// The engine's own URL (with the page's ?v= cache-buster, if any) and the site root above it.
const ENGINE_SRC = (document.currentScript && document.currentScript.src) || '';
const SITE_ROOT = ENGINE_SRC ? new URL('../', ENGINE_SRC).href : '';
// Every matching system, for the protocol switch on the start screen (paths relative to SITE_ROOT).
const MODES = [
  {id:'o2',    name:'OXYGEN',     path:''},
  {id:'words', name:'WORD TYPES', path:'words/'},
  {id:'rhymes', name:'RHYMES',     path:'rhymes/'},
  {id:'conjugation', name:'SPANISH VERBS', path:'conjugation/'},
];
// Snapshot of this page's own markup, taken before the engine touches the DOM; the live-update
// check compares it (plus this file's text) against freshly fetched copies (see bottom of file).
// The <script> tag the page's loader writes for this file isn't in the page source, so it's skipped.
const PAGE_FP = pageFingerprint(document);
function pageFingerprint(doc){
  const root = doc.documentElement.cloneNode(true);
  root.querySelectorAll('[data-cargo-engine]').forEach(n=>n.remove());
  const head = root.querySelector('head'), body = root.querySelector('body');
  return ((head ? head.innerHTML : '') + '\u0000' + (body ? body.innerHTML : '')).replace(/\s+$/,'');
}
injectShell();
function injectShell(){
  const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const style = document.createElement('style');
  style.textContent = ENGINE_CSS;
  document.head.appendChild(style);
  const protocols = MODES.map(m => m.id===MODE.id
    ? `<span class="cur">${esc(m.name)}</span>`
    : `<a href="${esc(SITE_ROOT + m.path)}">${esc(m.name)}</a>`).join('<span class="sep">·</span>');
  document.body.insertAdjacentHTML('afterbegin', `
<div id="app">
  <div id="stage">
    <canvas id="bgScene"></canvas>
    <canvas id="scene"></canvas>
  </div>

  <div id="hullPanel" class="panel notch">
    <div class="hud-label"><span>HULL INTEGR<span id="secretSpawnBtn">I</span>TY</span><span class="val" id="hullPct">100%</span></div>
    <div id="hullBarTrack"><div id="hullBarFill"></div><div id="hullBarTicks"></div></div>
  </div>

  <div id="topRight">
  <div id="audioToggle" class="panel"><span class="dot"></span><span id="audioLabel">COMMS ON</span></div>
  <div id="sectorPanel" class="panel notch">
    <div class="hud-label"><span>SECTOR</span></div>
    <div id="sectorValue">01</div>
    <div id="barrelDots"></div>
  </div>
  </div>

  <div id="toolbar" class="panel notch">
    <div id="toolbarInner">
      <div id="readoutBox">
        <div class="scanLabel">${esc(MODE.scanLabel)}</div>
        <div id="o2Readout">— — —</div>
      </div>
      <div id="toolbarSide">
        <div id="repLabel">SCANNER IDLE</div>
        <div id="idlePrompt" style="display:none;">GRAB A DRIFTING ROCK TO SCAN IT</div>
      </div>
    </div>
  </div>

  <div id="warnFlash"></div>
  <div id="toastLayer"></div>

  <div id="startOverlay" class="overlay">
    <div class="ship">S.S. KESTREL-9 — CARGO DIVISION</div>
    <h1>CARGO BAY: <span class="accent">${esc(MODE.title)}</span> PROTOCOL</h1>
    <p id="intro">${esc(MODE.intro)}</p>
    <button class="bigBtn" id="startBtn">BEGIN SHIFT</button>
    <button class="linkBtn hidden" id="newShiftBtn">START A NEW SHIFT INSTEAD</button>
    <div id="protocolSwitch"><span class="lbl">PROTOCOL</span>${protocols}</div>
  </div>

  <div id="endOverlay" class="overlay hidden">
    <div class="ship">S.S. KESTREL-9 — CARGO DIVISION</div>
    <h1 id="endTitle">HULL BREACH</h1>
    <p id="endText">Structural integrity has failed. Cargo operations suspended.</p>
    <button class="bigBtn danger" id="restartBtn">REBOOT SYSTEMS</button>
  </div>
</div>
`);
}
"use strict";

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const rand=(a,b)=>a+Math.random()*(b-a);
const randInt=(a,b)=>Math.floor(rand(a,b+1));
const choice=(arr)=>arr[Math.floor(Math.random()*arr.length)];
const TAU=Math.PI*2;
const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;


const AudioEngine = (function(){
  let ctx=null, master=null, enabled=true;
  let hum=null;
  let noiseBuffer=null;

  function init(){
    if(ctx) return;
    ctx = new (window.AudioContext||window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.85;
    master.connect(ctx.destination);
    const len = ctx.sampleRate*1.2;
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuffer.getChannelData(0);
    for(let i=0;i<len;i++) d[i] = Math.random()*2-1;
  }

  function setEnabled(v){
    enabled=v;
    if(master) master.gain.value = v?0.85:0;
  }

  function beamStart(){
    if(!ctx||!enabled) return;
    beamStop();
    const now=ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type='sine'; osc.frequency.value=72;
    const osc2 = ctx.createOscillator();
    osc2.type='sine'; osc2.frequency.value=108;
    const g = ctx.createGain();
    g.gain.value=0.0001;
    g.gain.linearRampToValueAtTime(0.05, now+0.25);

    const lfo = ctx.createOscillator();
    lfo.type='sine'; lfo.frequency.value=0.9;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value=0.028;
    lfo.connect(lfoGain);
    lfoGain.connect(g.gain);

    const filt = ctx.createBiquadFilter();
    filt.type='lowpass'; filt.frequency.value=420;

    osc.connect(filt); osc2.connect(filt);
    filt.connect(g);
    g.connect(master);
    osc.start(); osc2.start(); lfo.start();
    hum={osc,osc2,lfo,g};
  }
  function beamStop(){
    if(!hum||!ctx) { hum=null; return; }
    const now=ctx.currentTime;
    try{
      hum.g.gain.cancelScheduledValues(now);
      hum.g.gain.setValueAtTime(hum.g.gain.value, now);
      hum.g.gain.linearRampToValueAtTime(0.0001, now+0.18);
      hum.osc.stop(now+0.2); hum.osc2.stop(now+0.2); hum.lfo.stop(now+0.2);
    }catch(e){}
    hum=null;
  }

  function chuteAccept(){
    if(!ctx||!enabled) return;
    const now=ctx.currentTime;
    const osc=ctx.createOscillator();
    osc.type='square'; osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(640, now+0.09);
    const g=ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.09, now+0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, now+0.16);
    const filt=ctx.createBiquadFilter(); filt.type='lowpass'; filt.frequency.value=2200;
    osc.connect(filt); filt.connect(g); g.connect(master);
    osc.start(now); osc.stop(now+0.2);
  }

  function explosion(){
    if(!ctx||!enabled) return;
    const now=ctx.currentTime;
    const src=ctx.createBufferSource();
    src.buffer=noiseBuffer;
    const filt=ctx.createBiquadFilter();
    filt.type='lowpass';
    filt.frequency.setValueAtTime(3200, now);
    filt.frequency.exponentialRampToValueAtTime(90, now+0.55);
    const g=ctx.createGain();
    g.gain.setValueAtTime(0.5, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now+0.62);
    src.connect(filt); filt.connect(g); g.connect(master);
    src.start(now); src.stop(now+0.65);
    const osc=ctx.createOscillator();
    osc.type='sine'; osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(35, now+0.4);
    const g2=ctx.createGain();
    g2.gain.setValueAtTime(0.5, now);
    g2.gain.exponentialRampToValueAtTime(0.0001, now+0.45);
    osc.connect(g2); g2.connect(master);
    osc.start(now); osc.stop(now+0.5);
  }

  function sealHum(){
    if(!ctx||!enabled) return;
    const now=ctx.currentTime;
    [46,69].forEach((f,i)=>{
      const osc=ctx.createOscillator();
      osc.type='sine'; osc.frequency.value=f;
      const g=ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.16, now+0.5+i*0.1);
      g.gain.linearRampToValueAtTime(0.0001, now+2.6);
      const filt=ctx.createBiquadFilter(); filt.type='lowpass'; filt.frequency.value=260;
      osc.connect(filt); filt.connect(g); g.connect(master);
      osc.start(now); osc.stop(now+2.7);
    });
  }

  function eject(){
    if(!ctx||!enabled) return;
    const now=ctx.currentTime;
    const osc=ctx.createOscillator();
    osc.type='sawtooth'; osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(900, now+0.35);
    const g=ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.06, now+0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, now+0.4);
    const filt=ctx.createBiquadFilter(); filt.type='bandpass'; filt.frequency.value=800;
    osc.connect(filt); filt.connect(g); g.connect(master);
    osc.start(now); osc.stop(now+0.42);
  }

  function uiBlip(freq){
    if(!ctx||!enabled) return;
    const now=ctx.currentTime;
    const osc=ctx.createOscillator();
    osc.type='sine'; osc.frequency.value=freq||500;
    const g=ctx.createGain();
    g.gain.setValueAtTime(0.06, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now+0.12);
    osc.connect(g); g.connect(master);
    osc.start(now); osc.stop(now+0.13);
  }

  // Short mechanical whir for the robot arm / floor doors. f0→f1 sweep over dur seconds.
  function servo(f0, f1, dur){
    if(!ctx||!enabled) return;
    const now=ctx.currentTime;
    const osc=ctx.createOscillator();
    osc.type='sawtooth';
    osc.frequency.setValueAtTime(f0, now);
    osc.frequency.linearRampToValueAtTime(f1, now+dur);
    const filt=ctx.createBiquadFilter(); filt.type='lowpass'; filt.frequency.value=700;
    const g=ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.035, now+0.04);
    g.gain.setValueAtTime(0.035, now+Math.max(0.05,dur-0.06));
    g.gain.exponentialRampToValueAtTime(0.0001, now+dur);
    osc.connect(filt); filt.connect(g); g.connect(master);
    osc.start(now); osc.stop(now+dur+0.02);
  }

  // Crackle of static plus a sagging "bwong" as the iris force field bounces something back.
  function forceField(){
    if(!ctx||!enabled) return;
    const now=ctx.currentTime;
    const src=ctx.createBufferSource();
    src.buffer=noiseBuffer;
    const filt=ctx.createBiquadFilter(); filt.type='bandpass'; filt.frequency.value=2600; filt.Q.value=0.8;
    const g=ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    for(let i=0;i<8;i++) g.gain.setValueAtTime(i%2 ? 0.02 : 0.14*(1-i/8), now+i*0.045);
    g.gain.exponentialRampToValueAtTime(0.0001, now+0.42);
    src.connect(filt); filt.connect(g); g.connect(master);
    src.start(now); src.stop(now+0.45);
    const osc=ctx.createOscillator();
    osc.type='triangle'; osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(140, now+0.3);
    const g2=ctx.createGain();
    g2.gain.setValueAtTime(0.08, now);
    g2.gain.exponentialRampToValueAtTime(0.0001, now+0.32);
    osc.connect(g2); g2.connect(master);
    osc.start(now); osc.stop(now+0.34);
  }

  // Airlock cycling: a rush of air that drops away as the outer hatch opens.
  function airlock(){
    if(!ctx||!enabled) return;
    const now=ctx.currentTime;
    const src=ctx.createBufferSource();
    src.buffer=noiseBuffer;
    const filt=ctx.createBiquadFilter(); filt.type='lowpass';
    filt.frequency.setValueAtTime(4000, now);
    filt.frequency.exponentialRampToValueAtTime(200, now+0.9);
    const g=ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.3, now+0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, now+1.0);
    src.connect(filt); filt.connect(g); g.connect(master);
    src.start(now); src.stop(now+1.05);
  }

  // A short electrical crackle: a few stuttering bursts of hiss.
  function spark(){
    if(!ctx||!enabled) return;
    const now=ctx.currentTime;
    const src=ctx.createBufferSource();
    src.buffer=noiseBuffer;
    const filt=ctx.createBiquadFilter(); filt.type='highpass'; filt.frequency.value=2400;
    const g=ctx.createGain();
    const n=4+Math.floor(Math.random()*4), step=0.022;
    g.gain.setValueAtTime(0.0001, now);
    for(let i=0;i<n;i++) g.gain.setValueAtTime(i%2 ? 0.008 : 0.02+0.07*(1-i/n), now+i*step);
    g.gain.setValueAtTime(0.0001, now+n*step);
    src.connect(filt); filt.connect(g); g.connect(master);
    src.start(now, Math.random()*0.8); src.stop(now+n*step+0.02);
  }

  // The hull straining: a low wobbling roar that swells and fades over `dur` seconds, sometimes
  // with a metal groan in it.
  function rumble(dur){
    if(!ctx||!enabled) return;
    const now=ctx.currentTime, end=now+dur;
    const env=(peak)=>{
      const g=ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(peak, now+Math.min(0.8, dur*0.35));
      g.gain.setValueAtTime(peak, end-Math.min(0.8, dur*0.35));
      g.gain.linearRampToValueAtTime(0.0001, end);
      g.connect(master);
      return g;
    };
    const src=ctx.createBufferSource();
    src.buffer=noiseBuffer; src.loop=true;
    const filt=ctx.createBiquadFilter(); filt.type='lowpass'; filt.frequency.value=140;
    const wob=ctx.createGain(); wob.gain.value=1;
    const lfo=ctx.createOscillator(); lfo.frequency.value=rand(2.5,4.5);
    const lfoGain=ctx.createGain(); lfoGain.gain.value=0.45;
    lfo.connect(lfoGain); lfoGain.connect(wob.gain);
    src.connect(filt); filt.connect(wob); wob.connect(env(0.32));
    const osc=ctx.createOscillator();
    osc.type='sine'; osc.frequency.setValueAtTime(46, now); osc.frequency.linearRampToValueAtTime(38, end);
    osc.connect(env(0.1));
    src.start(now); lfo.start(now); osc.start(now);
    src.stop(end+0.05); lfo.stop(end+0.05); osc.stop(end+0.05);
    if(Math.random()<0.5){
      const groan=ctx.createOscillator();
      groan.type='sawtooth';
      const f0=rand(70,95);
      groan.frequency.setValueAtTime(f0, now);
      groan.frequency.linearRampToValueAtTime(f0*rand(0.75,0.9), end);
      const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=320; bp.Q.value=4;
      groan.connect(bp); bp.connect(env(0.03));
      groan.start(now); groan.stop(end+0.05);
    }
  }

  return {init, setEnabled, beamStart, beamStop, chuteAccept, explosion, sealHum, eject, uiBlip, servo, forceField, airlock, spark, rumble,
          get running(){return !!ctx;}};
})();

// ---------- Matching system ----------
// The page's CARGO_MODE decides what rocks carry. A value is anything with a `key` (what barrels
// match on); an item is how one rock shows its value: {rep, text, glyph?}. `text` labels the scanner
// and barrel holograms; `glyph` is optional mode-drawn art (the oxygen mode's pie charts).
function sameValue(a,b){ return MODE.same ? MODE.same(a,b) : a.key===b.key; }
// `labels`: the barrels' current label texts, so a mode can avoid spawning a rock that just repeats one.
function makeItem(value){ return MODE.makeItem(value, state.sector, state.barrels.map(b=>b.text).filter(Boolean)); }

const canvas=document.getElementById('scene');
const bgCanvas=document.getElementById('bgScene');
let ctx=canvas.getContext('2d');   // `let`: paintLayer() points it at an offscreen canvas while caching
// ---------- Cached layers ----------
// Things that rarely change (walls, floor, nebula, iris blades, floor openings, barrel bodies) are
// drawn once into an offscreen canvas and then blitted each frame. A layer is redrawn only when its
// key changes. `fn` draws in normal screen coordinates into the region (x, y, w, h); because what's
// cached is just that patch, the same layer can be blitted somewhere else (all barrels share one body).
let layoutGen=0;
function makeLayer(){ return {cv:document.createElement('canvas'), key:null}; }
function paintLayer(L, key, x, y, w, h, fn, dx, dy){
  w=Math.ceil(w); h=Math.ceil(h);
  if(L.key!==key){
    L.cv.width=Math.max(1,Math.ceil(w*DPR)); L.cv.height=Math.max(1,Math.ceil(h*DPR));
    const o=L.cv.getContext('2d');
    o.setTransform(DPR,0,0,DPR,-x*DPR,-y*DPR);
    const main=ctx; ctx=o;
    try{ fn(); } finally { ctx=main; }
    L.key=key;
  }
  ctx.drawImage(L.cv, dx===undefined?x:dx, dy===undefined?y:dy, w, h);
}
let W=0,H=0,DPR=1;
function resize(){
  DPR = Math.min(window.devicePixelRatio||1, 2);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W*DPR; canvas.height=H*DPR;
  canvas.style.width=W+'px'; canvas.style.height=H+'px';
  ctx.setTransform(DPR,0,0,DPR,0,0);
  computeLayout();
  // Walls and floor (and their battle damage) live on a canvas of their own behind the scene,
  // painted only on a resize or when the damage changes, so they cost nothing per frame.
  bgCanvas.width = W*DPR; bgCanvas.height=H*DPR;
  bgCanvas.style.width=W+'px'; bgCanvas.style.height=H+'px';
  paintBackground();
}
function paintBackground(){
  const main=ctx; ctx=bgCanvas.getContext('2d');
  ctx.setTransform(DPR,0,0,DPR,0,0);
  try{ drawBayStructure(); drawFloor(); drawHullDamage(); } finally { ctx=main; }
}
window.addEventListener('resize', resize);

let layout={};
function computeLayout(){
  layoutGen++;
  const cx=W*0.5, cy=H*0.34;
  const irisR = Math.min(W,H)*0.225;
  layout.iris = {cx,cy,r:irisR};
  layout.spawnCircle = {cx, cy, r: irisR*0.8};
  layout.floorTop = cy + irisR*0.75;
  layout.floorBottom = H - 118;

  layout.barrelR = clamp(Math.min(W,H)*0.05, 26, 46);
  layout.barrelH = layout.barrelR*3.1;

  const gy1 = lerp(layout.floorTop, layout.floorBottom, 0.46);
  const gy2 = lerp(layout.floorTop, layout.floorBottom, 0.94);
  const gxSpread = Math.min(W*0.19, 150);
  layout.barrels4 = [
    {x:cx-gxSpread, y:gy1},
    {x:cx+gxSpread, y:gy1},
    {x:cx-gxSpread*1.18, y:gy2},
    {x:cx+gxSpread*1.18, y:gy2},
  ];
  layout.emitters = [
    {x:W*0.07, y:H*0.14},
    {x:W*0.93, y:H*0.14},
    {x:W*0.05, y:layout.floorTop-10},
    {x:W*0.95, y:layout.floorTop-10},
  ];
  layout.toolbarTop = H-108;
  // Both sit on the far walkway (track 2): their bottoms rest on it, not their centers.
  // Button housing radius is r*1.6; the lever's mounting plate is 24 tall (±12 around the pivot).
  layout.redButton = {x: cx - irisR*1.35, y: layout.floorTop - 10*1.6, r: 10};
  layout.lever = {x: cx + irisR*1.35, y: layout.floorTop - 12, h: 24};

  // Floor openings: one under each barrel slot, plus the robot arm's in the middle of the four.
  const R=layout.barrelR;
  const holeRx=R*1.08, holeRy=R*0.42*1.1;
  layout.barrelHoles = layout.barrels4.map(a=>({x:a.x, y:a.y, rx:holeRx, ry:holeRy}));
  layout.armHole = {x:cx, y:(gy1+gy2)/2, rx:holeRx, ry:holeRy};
  // Hologram projectors: an emitter on the floor beside each slot (outer side) projects the barrel's
  // label as a floating panel. Where there isn't room beside it (narrow portrait screens), the panel
  // floats above the barrel instead, projected from the lid.
  const holoM=10, holoGap=R*0.3, holoH=R*1.25;
  layout.holos = layout.barrels4.map((a,i)=>{
    const side = i%2===0 ? -1 : 1;
    const room = side<0 ? a.x-R-holoGap-holoM : W-holoM-(a.x+R+holoGap);
    if(room >= R*2.6){
      const w = Math.min(room, R*4.4), x = a.x+side*(R+holoGap+w/2);
      return {beside:true, w, h:holoH, x, y:a.y-layout.barrelH*0.62, ex:x, ey:a.y};
    }
    const w = Math.min(R*4.6, gxSpread*2-R*0.5, 2*(a.x-holoM), 2*(W-holoM-a.x));
    return {beside:false, w, h:holoH, x:a.x, y:a.y-layout.barrelH-R*0.6-holoH/2, ex:a.x, ey:a.y-layout.barrelH};
  });
  // Arm geometry: a mast rises out of the hole to the shoulder; two equal segments reach from there.
  layout.armMast = layout.barrelH*0.55;
  layout.armPincer = R*0.5;
  const sh = {x:cx, y:layout.armHole.y - layout.armMast};
  let maxReach = 0;
  for(const a of layout.barrels4){
    const w = armGrabWrist(a);
    maxReach = Math.max(maxReach, Math.hypot(w.x-sh.x, w.y-sh.y));
  }
  layout.armSeg = maxReach*0.58;

  // Airlock chute: a glass box set into the left wall right beside the iris, with its LAUNCH button
  // mounted above it. It fills the wall between whatever is above it (the hull HUD, a beam emitter) and whatever
  // stands in front of it (the red button, and on short landscape screens the back-left barrel and
  // its hologram), so the room it gets depends on its own width: settle that in a few passes.
  const hudR = (()=>{ const el=document.getElementById('hullPanel'); return el ? el.getBoundingClientRect() : null; })();
  const rb = layout.redButton, b0 = layout.barrels4[0], h0 = layout.holos[0];
  const R0 = layout.barrelR;
  const below = [
    {l:rb.x-rb.r*1.6, r:rb.x+rb.r*1.6, top:rb.y-rb.r*1.6},
    {l:b0.x-R0*1.1, r:b0.x+R0*1.1, top:b0.y-layout.barrelH-R0*0.45},
    {l:h0.x-h0.w/2, r:h0.x+h0.w/2, top:h0.y-h0.h/2},
  ];
  const roomR = cx - irisR*1.2 - 10, BOX_MAX = 104, ASPECT = 1.2, BTN_H = 30, GAP = 10;
  const frameOf = w => Math.max(5, w*0.07);   // drawChute's frame width
  let bw = BOX_MAX, roomBottom = 0;
  for(let pass=0; pass<4; pass++){
    const l = roomR - frameOf(bw)*2 - bw;
    const e0 = layout.emitters[0];
    let roomTop = (hudR && hudR.right + 8 > l ? hudR.bottom : 0) + 14;
    if(e0.x + 15 > l) roomTop = Math.max(roomTop, e0.y + 15 + 6);
    roomBottom = layout.floorTop - 30;
    below.forEach(o=>{ if(o.r > l && o.l < roomR) roomBottom = Math.min(roomBottom, o.top - 8); });
    bw = Math.max(40, Math.min(roomR-10, BOX_MAX, (roomBottom-roomTop - BTN_H - GAP - frameOf(bw))/ASPECT - frameOf(bw)));
  }
  const bh = bw*ASPECT, frame = frameOf(bw);
  const boxX = roomR - frame - bw/2, boxY = roomBottom - frame - bh/2;
  layout.chute = {x:boxX, y:boxY, w:bw, h:bh};
  layout.chuteBtn = {x:boxX, y:boxY - bh/2 - frame - GAP - BTN_H/2, w:bw, h:BTN_H};
}
// Where the wrist sits when the pincers are clamped on the lid of a barrel standing at `anchor`.
function armGrabWrist(anchor){
  return {x:anchor.x, y:anchor.y - layout.barrelH - layout.armPincer*0.7};
}
// Inverse of the above: barrel anchor (bottom-center) for a given wrist position.
function armBarrelAnchor(w){
  return {x:w.x, y:w.y + layout.armPincer*0.7 + layout.barrelH};
}

const state={
  phase:'intro',
  breaching:false,
  hull:100,
  sector:1,
  // status: 'ready' (on its slot, usable) | 'carried' (in the robot arm) | 'gone' (retrieved) | 'rising' (coming up from its slot)
  //         | 'destroyed' (blown up by a mismatch; replacement rises after destroyT)
  barrels:[0,1,2,3].map(()=>({value:null, text:null, glyph:null, items:[], holo:0, slots:0, sealed:false, flashT:0, sealT:0, fillDisplay:0,
            status:'ready', door:0, riseT:0})),
  // Robot arm: one job at a time; sealed barrels wait in `queue` (barrel indices, FIFO).
  arm:{queue:[], job:null, door:0, shY:0, wrist:null, carrying:-1, side:1, fk:null},
  rocks:[],
  aliens:[],
  alienSpawnedThisSector:false,
  alienCloneCounters:{},
  leverDown:false,
  // Airlock chute (its occupant is the alien whose state is 'chute' or 'launching').
  chute:{flash:0, hatch:0, hatchT:0, press:0},
  // Static flash over the iris window when an alien is bounced off it.
  forceField:{t:0, x:0, y:0},
  particles:[],
  spawnTimer:0,
  held:null,
  pointer:{x:0,y:0,active:false},
  dragLast:{x:0,y:0},
  dragSamples:[],
  shake:0,
  // Battle damage painted on the walls and floor, one group of marks per lost hull step (see
  // syncDamageMarks), and the low-hull rumble.
  scars:[], scarGroup:0,
  rumble:{t:0, dur:0, next:2, shake:0},
  irisSparkT:0,
  warnT:0,
  irisOpen:1, irisTarget:1,
  transition:null,
  t:0,
  nebulaHue:200,
  stars:[],
  nebulaBlobs:[],
};

function resetHullTicks(){
  const track=document.getElementById('hullBarTicks');
  track.innerHTML='';
  for(let i=0;i<10;i++){ const d=document.createElement('div'); track.appendChild(d); }
}
resetHullTicks();

function makeStars(){
  const arr=[];
  for(let i=0;i<140;i++){
    arr.push({a:Math.random()*TAU, r:Math.random(), tw:Math.random()*TAU, sp:rand(0.6,2.2), size:rand(0.6,1.9)});
  }
  return arr;
}
function makeNebula(hue){
  const blobs=[];
  const n=5;
  for(let i=0;i<n;i++){
    blobs.push({
      a:Math.random()*TAU, r:rand(0.15,0.85),
      size:rand(0.35,0.75),
      hue: hue + rand(-40,40),
      alpha: rand(0.10,0.22)
    });
  }
  return blobs;
}
state.stars = makeStars();
state.nebulaBlobs = makeNebula(state.nebulaHue);

const ROCK_PALETTES=[
  {a:'#8a5a3c',b:'#c98a5a',c:'#3d2717'},
  {a:'#4c7f9e',b:'#a9d4e8',c:'#1c3644'},
  {a:'#6a4c9e',b:'#b79bdc',c:'#2c1f43'},
  {a:'#5a6270',b:'#9aa4b5',c:'#25292f'},
  {a:'#7a8a3c',b:'#c3d987',c:'#33401a'},
];
let ROCK_ID=1;
function genShape(size){
  const pts=[]; const n=randInt(9,13);
  for(let i=0;i<n;i++){
    const ang = (i/n)*TAU;
    const r = size*rand(0.68,1.12);
    pts.push({ang, r});
  }
  return pts;
}
function makeCraters(size){
  const c=[]; const n=randInt(3,6);
  for(let i=0;i<n;i++){
    c.push({ang:rand(0,TAU), r:rand(0.15,0.75)*size, cr:rand(0.09,0.2)*size});
  }
  return c;
}
function pickSpawnValue(){
  const armed = state.barrels.filter(b=>b.value && !b.sealed).map(b=>b.value);
  if(armed.length && Math.random()<0.5){
    return choice(armed);
  }
  return MODE.pickValue(state.sector);
}
// `item` (optional): keep a rock's existing look ({rep, text, glyph}) instead of rolling a new one.
function createRock(value, item){
  const size = rand(21,32);
  const pal = choice(ROCK_PALETTES);
  const sc = layout.spawnCircle;
  const ang = rand(0,TAU);
  const rr = sc.r*Math.sqrt(Math.random())*0.85;
  const x = sc.cx + Math.cos(ang)*rr;
  const y = sc.cy + Math.sin(ang)*rr;
  const s0 = rand(0.38,0.6);
  item = item || makeItem(value);
  return {
    id:ROCK_ID++,
    value, rep:item.rep, text:item.text, glyph:item.glyph||null,
    x,y, baseX:x, baseY:y,
    vx:rand(-9,9), vy:rand(-6,6),
    size, shape:genShape(size), pal,
    rot:rand(0,TAU), rotSpeed:rand(-0.35,0.35),
    phase:rand(0,TAU), freq:rand(0.35,0.7), amp:rand(6,14),
    scale:s0, targetScale:s0,
    state:'floating',
    fvy:0,
    craters: makeCraters(size),
  };
}
const ALIEN_MESSAGES=[
  "Thanks for the ride!",
  "Mmm, oxygen. My favorite.",
  "You have a lovely cargo bay.",
  "Take me to your leader. Later, though.",
  "Much obliged, cargo handler.",
  "This is better than my last ship.",
  "Beep boop. Gratitude protocol engaged.",
  "I'll tell my whole cluster about you.",
  "You're doing great work out here.",
  "Safe travels, friend.",
  "My species thanks you. All nine of us.",
  "Ten out of ten cargo bay, would drift again.",
];
function makeAlienFace(){
  return {
    hue: randInt(0,360),
    sat: randInt(45,70),
    eyeCount: choice([1,2,2,2,2]),
    eyeHue: randInt(0,360),
    eyeSpread: rand(0.28,0.42),
    eyeR: rand(0.16,0.24),
    pupilOffX: rand(-0.18,0.18),
    pupilOffY: rand(-0.18,0.18),
    mouthWidth: rand(0.3,0.5),
    mouthCurve: choice([0.16,-0.12,0.06,-0.2,0.02]),
    bumpCount: randInt(0,3),
  };
}
function drawWavatarFace(cx,cy,r,face){
  ctx.save();
  ctx.translate(cx,cy);
  const skinColor=`hsl(${face.hue},${face.sat}%,46%)`;
  const skinGrad=ctx.createRadialGradient(-r*0.25,-r*0.25,r*0.1, 0,0,r);
  skinGrad.addColorStop(0, `hsl(${face.hue},${face.sat}%,58%)`);
  skinGrad.addColorStop(1, skinColor);
  ctx.fillStyle=skinGrad;
  ctx.beginPath(); ctx.arc(0,0,r,0,TAU); ctx.fill();

  for(let i=0;i<face.bumpCount;i++){
    const a=(i/Math.max(1,face.bumpCount))*Math.PI*2 + 0.4;
    const bx=Math.cos(a)*r*0.78, by=Math.sin(a)*r*0.78;
    ctx.fillStyle=`hsl(${face.hue},${face.sat}%,40%)`;
    ctx.beginPath(); ctx.arc(bx,by,r*0.12,0,TAU); ctx.fill();
  }

  function drawEye(ex,ey,er){
    ctx.fillStyle='white';
    ctx.beginPath(); ctx.arc(ex,ey,er,0,TAU); ctx.fill();
    ctx.fillStyle=`hsl(${face.eyeHue},70%,55%)`;
    const pr=er*0.55;
    const pox=ex+face.pupilOffX*er, poy=ey+face.pupilOffY*er;
    ctx.beginPath(); ctx.arc(pox,poy,pr,0,TAU); ctx.fill();
    ctx.fillStyle='#0a0a0a';
    ctx.beginPath(); ctx.arc(pox,poy,pr*0.4,0,TAU); ctx.fill();
  }
  const eyeR=r*face.eyeR;
  if(face.eyeCount===1){
    drawEye(0,-r*0.08,eyeR*1.15);
  } else {
    const ex=r*face.eyeSpread;
    drawEye(-ex,-r*0.08,eyeR);
    drawEye(ex,-r*0.08,eyeR);
  }

  ctx.strokeStyle='rgba(15,10,10,0.75)';
  ctx.lineWidth=r*0.08;
  ctx.lineCap='round';
  ctx.beginPath();
  const mouthY=r*0.36, mw=r*face.mouthWidth;
  ctx.moveTo(-mw,mouthY);
  ctx.quadraticCurveTo(0, mouthY+r*face.mouthCurve, mw, mouthY);
  ctx.stroke();

  ctx.restore();
}
// Alien face rendering mode. The procedural wavatar-style generator above is preserved
// but DISABLED by default — aliens render a live Gravatar wavatar image instead.
// Set to 'procedural' to re-enable the built-in generator.
const ALIEN_FACE_MODE = 'gravatar';

function loadAlienAvatar(alien){
  const ts = Math.floor(Date.now()/1000);
  const img = new Image();
  img.onload = ()=>{ alien.avatarLoaded = true; };
  img.onerror = ()=>{ alien.avatarLoaded = false; alien.avatarFailed = true; };
  img.src = `https://www.gravatar.com/avatar/${ts}?d=wavatar&f=y`;
  alien.avatarImg = img;
}
const ALIEN_NAME_CONSONANTS = 'bcdfghjklmnpqrstvwxyz'.split('');
const ALIEN_NAME_VOWELS = 'aeiou'.split('');
const ALIEN_NAME_BLACKLIST = new Set([
  "cok","coc","dic","dik","god","gay","cum","fag","fuk","hor","jiz","giz","kys","nig","sex","tit"
]);
function generateAlienName(){
  let name;
  let attempts=0;
  do{
    name = choice(ALIEN_NAME_CONSONANTS)+choice(ALIEN_NAME_VOWELS)+choice(ALIEN_NAME_CONSONANTS);
    attempts++;
  } while(ALIEN_NAME_BLACKLIST.has(name) && attempts<50);
  return name.charAt(0).toUpperCase()+name.slice(1);
}
// Walking-track tuning (phase one of alien mischief behavior).
const ALIEN_TRACK1_SPEED = 12;   // px/s, walking right along the near floor
const ALIEN_TRACK2_SPEED = 8;    // px/s, walking left along the far walkway near the iris
const ALIEN_TRACK1_SCALE = 1.15; // near-camera size while on the front track
const ALIEN_TRACK2_SCALE = 0.42; // scaled down for distance while on the far track
const ALIEN_TRACK_GAP_SECONDS = 30; // time spent off-screen between track 1 and track 2
const ALIEN_TRACK_EDGE_MARGIN = 50; // extra px past the window edge before an alien is considered off-screen
// Walking past a resting rock on track 1, an alien sometimes picks it up, balances it on its
// head and carries it off the edge of the screen, where it unloads. Just as often it kicks the
// rock along the bay floor instead (never out the window; off the edge it unloads too).
// Otherwise it walks past.
const ALIEN_CARRY_CHANCE = 0.25;
const ALIEN_KICK_ROCK_CHANCE = 0.25;
const ALIEN_KICK_ROCK_MESSAGES=[
  "Who left this garbage here?",
  "Ugh, watch your step, people.",
  "This is NOT recycling.",
  "Rude. Absolutely rude.",
  "Not on my walk, cargo handler.",
];
const ALIEN_CARRY_LIFT_SECONDS = 0.45;
const ALIEN_CARRY_MESSAGES=[
  "I know where this belongs.",
  "Leave it to me. I know a place.",
  "This goes over here. Trust me.",
  "Ah, a stray! I'll take it home.",
  "Don't worry, I've got this one.",
];
// Where a carried rock sits: balanced on top of its carrier's helmet.
function carriedRockSpot(r, a){
  return {x:a.x, y:a.y - a.size*a.scale - r.size*r.scale*0.9};
}
const ALIEN_FIXIT_MESSAGES=[
  "I fixed your gorblesnarker!",
  "I made a door!",
  "Structural integrity: improved!",
  "You're welcome, probably.",
];
const ALIEN_BUTTON_MESSAGES=[
  "What does this do?",
  "Close the windows, it's too bright!",
  "Close the windows, it's too windy!",
  "Oops.",
  "I did not mean to do that.",
];
const ALIEN_LEVER_CHANCE = 0.5;
const ALIEN_LEVER_MESSAGES=[
  "Ooh, a lever!",
  "Click clack!",
  "Up? Down? Yes!",
  "That light seems important.",
  "Don't mind me.",
];
const ALIEN_HIDE_MESSAGES=[
  "Well, excuuuse me!",
  "Your turn to hide!",
  "A little privacy, please!",
  "I was here first!",
];
const ALIEN_CLIMB_CHANCE = 0.25;  // chance to climb the iris ring when reaching it on track 2
const ALIEN_CLIMB_SPEED = ALIEN_TRACK2_SPEED; // px/s along the ring's arc (base, before variation)
// Meandering walk: every 40-80px of travel an alien picks a new speed between the
// current track's base speed and double it. Stored as a 1x-2x multiplier so the same
// rule applies to track 1, track 2, and the iris climb, each against its own base.
const ALIEN_WALK_MULT_MIN = 1, ALIEN_WALK_MULT_MAX = 2;
const ALIEN_WALK_RECALC_MIN = 40, ALIEN_WALK_RECALC_MAX = 80;
function rollAlienWalkSpeed(a){
  a.walkMult = rand(ALIEN_WALK_MULT_MIN, ALIEN_WALK_MULT_MAX);
  a.walkDistLeft = rand(ALIEN_WALK_RECALC_MIN, ALIEN_WALK_RECALC_MAX);
}
// Distance this alien covers this frame at the given base speed; counts down toward the
// next speed recalculation.
function alienWalkStep(a, baseSpeed, dt){
  const d = baseSpeed * a.walkMult * dt;
  a.walkDistLeft -= d;
  if(a.walkDistLeft <= 0) rollAlienWalkSpeed(a);
  return d;
}
const ALIEN_CLIMB_FALL_MESSAGES=[
  "Ahh!",
  "Catch me!",
  "Whoa whoa whoa!",
  "Not again!",
];
// Radius of the path a climbing alien's center follows: the iris housing ring's outer
// edge (matches drawIrisWindow) plus the alien's own radius, so it sits on the ring.
function irisClimbRadius(a){
  const r = layout.iris.r;
  return r + r*0.14*0.92 + a.size*a.scale*0.9;
}
// Horizontal offset from the iris center where the climb path meets track 2.
function irisClimbEntryDX(a){
  const Rc = irisClimbRadius(a);
  const dy = layout.floorTop - layout.iris.cy;
  return Math.sqrt(Math.max(0, Rc*Rc - dy*dy));
}
function startAlienClimb(a){
  const Rc = irisClimbRadius(a);
  const dy = layout.floorTop - layout.iris.cy;
  const theta0 = Math.atan2(dy, irisClimbEntryDX(a)); // angle of the right-side entry point
  a.walkPhase = 'climbing';
  // Normal walkers (moving left) meet the right side and go over the top counterclockwise
  // (angle decreasing); reverse walkers meet the left side and go clockwise (angle increasing).
  a.climbDir = a.walksReverse ? 1 : -1;
  a.climbAngle = a.walksReverse ? Math.PI - theta0 : theta0;
  a.climbSweep = Math.PI + 2*theta0;
  a.climbProgress = 0;
}
function finishAlienClimb(a){
  const dx = irisClimbEntryDX(a);
  a.walkPhase = 'track2';
  a.baseX = layout.iris.cx + (a.walksReverse ? dx : -dx);
  a.baseY = layout.floorTop;
  a.x = a.baseX; a.y = a.baseY;
}
// ---- Stacking ----
// Aliens can form towers: each alien carries at most one rider (a chain, not a pyramid).
// The bottom alien (the base) walks normally; everyone above follows it.
const ALIEN_STACK_CHANCE = 0.10;
function alienInStack(a){ return !!(a.rider || a.ridingOn); }
function alienStackRoot(a){ let c=a; while(c.ridingOn) c=c.ridingOn; return c; }
function alienStackLevel(a){ let n=0, c=a; while(c.ridingOn){ c=c.ridingOn; n++; } return n; }
// Off-screen = in the gap between tracks, or riding a tower whose base is.
function alienIsOffscreen(a){
  const root = alienStackRoot(a);
  return root.state==='settled' && root.walkPhase==='gap';
}
// Riders never roll; a standalone alien or the base of a tower can. A base carries its whole
// tower up onto the target, so towers can merge.
function maybeTriggerStack(a){
  if(a.ridingOn) return false;
  const own = new Set(); for(let c=a; c; c=c.rider) own.add(c);
  const targets = state.aliens.filter(t=> !own.has(t) && !t.rider && !t.abductMarked && !t.borrowed && alienIsOffscreen(t));
  if(targets.length===0 || Math.random()>=ALIEN_STACK_CHANCE) return false;
  const target = choice(targets);
  a.ridingOn = target;
  target.rider = a;
  a.walkPhase = 'riding';
  a.state = 'settled';
  a.x = target.x; a.y = target.y;
  a.baseX = a.x; a.baseY = a.y;
  return true;
}
// Give a group of falling aliens each their own sideways velocity, spread across the
// range (with jitter, in shuffled order) so a collapsing tower always scatters into a
// pile instead of occasionally dropping as a neat column.
function scatterAlienVelocities(list){
  const n = list.length;
  const vxs = list.map((_,i)=> n===1
    ? choice([-1,1]) * rand(30,100)
    : lerp(-110, 110, i/(n-1)) + rand(-15,15));
  for(let i=vxs.length-1;i>0;i--){ const j=randInt(0,i); [vxs[i],vxs[j]]=[vxs[j],vxs[i]]; }
  list.forEach((a,i)=>{ a.fvx = vxs[i]; });
}
// Knock every alien above `a` off the tower; `a` and anything below it are unaffected.
// Returns the aliens that fell.
function tumbleRidersAbove(a, toTrack2){
  const fallen = [];
  let r = a.rider;
  a.rider = null;
  while(r){
    const next = r.rider;
    r.ridingOn = null; r.rider = null;
    r.state = 'falling';
    r.walkPhase = null;
    r.fvy = -rand(20,80);
    r.fallToTrack2 = toTrack2;
    r.tumbled = true;
    r.message = choice(ALIEN_CLIMB_FALL_MESSAGES);
    r.bubbleT = 2.5;
    fallen.push(r);
    r = next;
  }
  scatterAlienVelocities(fallen);
  return fallen;
}
// Called when the player grabs an alien: detach it from whatever it rides, and
// everything above it falls off. Aliens below keep walking as a shorter tower.
function breakStackAt(a){
  const root = alienStackRoot(a);
  const toTrack2 = isFarTrackAlien(root);
  if(a.ridingOn){ a.ridingOn.rider = null; a.ridingOn = null; }
  tumbleRidersAbove(a, toTrack2);
}
// Riders trail the alien beneath them with a lag, so the X offset compounds up the tower
// and the top of a tall stack wobbles the most.
const ALIEN_STACK_LAG = 6; // higher = tighter following
function updateAlienStacks(dt){
  state.aliens.forEach(base=>{
    if(base.ridingOn || !base.rider) return;
    let below = base, level = 1, r = base.rider;
    while(r){
      const targetX = below.x;
      if(Math.abs(targetX - r.x) > W*0.3) r.x = targetX; // snap across track teleports
      else r.x += (targetX - r.x) * Math.min(1, dt*ALIEN_STACK_LAG);
      r.x += Math.sin(state.t*2.3 + r.phase) * 0.15 * level; // a little extra sway
      r.scale = base.scale; r.targetScale = base.scale;
      r.y = below.y - (below.size*below.scale + r.size*r.scale)*0.8;
      r.baseX = r.x; r.baseY = r.y;
      below = r; r = r.rider; level++;
    }
  });
}
// Aliens at track 2's depth (walking it, climbing the iris ring, or falling back onto it)
// draw behind the barrels. Riders take their tower base's depth.
function isFarTrackAlien(a){
  if(a.state==='settled' && a.walkPhase==='riding') return isFarTrackAlien(alienStackRoot(a));
  return (a.state==='settled' && (a.walkPhase==='track2' || a.walkPhase==='climbing'))
      || (a.state==='falling' && a.fallToTrack2);
}
// Sector change: anything climbing the iris ring shouts and falls back to track 2,
// bringing its whole tower down with it.
function dropClimbingAliens(){
  state.aliens.forEach(a=>{
    if(a.state==='settled' && a.walkPhase==='climbing'){
      const pile = [a, ...tumbleRidersAbove(a, true)];
      a.message = choice(ALIEN_CLIMB_FALL_MESSAGES);
      a.bubbleT = 2.5;
      a.state = 'falling';
      a.walkPhase = null;
      a.fvy = 0;
      a.fallToTrack2 = true;
      a.tumbled = true;
      scatterAlienVelocities(pile); // base and riders scatter together
    }
  });
}
const ALIEN_REDROP_MESSAGES=[
  "Whee! Again!",
  "Why here?",
  "Again? Okay!",
  "Round two!",
  "Put me down. No wait, up!",
];
function createAlien(skipAvatarLoad){
  const sc = layout.spawnCircle;
  const ang = rand(0,TAU);
  const rr = sc.r*Math.sqrt(Math.random())*0.7;
  const x = sc.cx + Math.cos(ang)*rr;
  const y = sc.cy + Math.sin(ang)*rr;
  const s0 = rand(0.4,0.6);
  const alien = {
    id:'alien'+(ROCK_ID++),
    isAlien:true,
    name: generateAlienName(),
    baseName: null,
    x,y, baseX:x, baseY:y,
    vx:rand(-7,7), vy:rand(-5,5),
    size:rand(24,34),
    scale:s0, targetScale:s0,
    phase:rand(0,TAU), freq:rand(0.3,0.6), amp:rand(6,12),
    state:'floating',
    fvy:0,
    face: makeAlienFace(), // kept populated so ALIEN_FACE_MODE can be flipped back at any time
    avatarImg:null, avatarLoaded:false, avatarFailed:false,
    message:null, bubbleT:0,
    walkPhase:null, track:1, waitTimer:0,
    greeted:false, fixitMode:false, buttonRolled:false, walksReverse:false,
    hidingInBarrel:null, hideJumpOut:false,
    climbRolled:false, climbDir:0, climbAngle:0, climbSweep:0, climbProgress:0, fallToTrack2:false,
    walkMult:1, walkDistLeft:0,
    ridingOn:null, rider:null, tumbled:false, kicked:false,
    leverRolled:false,
  };
  rollAlienWalkSpeed(alien);
  alien.baseName = alien.name;
  if(ALIEN_FACE_MODE==='gravatar' && !skipAvatarLoad) loadAlienAvatar(alien);
  return alien;
}
function trySpawnRandom(){
  if(!state.alienSpawnedThisSector && Math.random()<0.01){
    state.aliens.push(createAlien());
    state.alienSpawnedThisSector=true;
    return;
  }
  const floatingCount = state.rocks.filter(r=>r.state==='floating').length;
  if(floatingCount>=5) return;
  const value = pickSpawnValue();
  state.rocks.push(createRock(value));
}

function startLevel(sector, riseBarrels){
  state.sector=sector;
  document.getElementById('sectorValue').textContent = String(sector).padStart(2,'0');
  state.barrels.forEach(b=>{endSlotPeek(b); b.value=null;b.text=null;b.glyph=null;b.items=[];b.slots=0;b.sealed=false;b.flashT=0;b.sealT=0;b.fillDisplay=0;
    // Arriving at a new sector: fresh empties come up through the floor. Fresh start/reboot: just there.
    b.status = riseBarrels ? 'rising' : 'ready'; b.riseT = 0; b.door = 0;});
  resetArm();
  updateBarrelDots();
  state.rocks=[];
  state.alienSpawnedThisSector=false;
  state.spawnTimer=0;
  for(let i=0;i<4;i++) trySpawnRandom();
}
function updateBarrelDots(){
  let sealedCount = state.barrels.filter(b=>b.sealed).length;
  document.getElementById('barrelDots').innerHTML = [0,1,2,3].map(i=>`<div class="cdot ${i<sealedCount?'on':''}"></div>`).join('');
}

function toast(text, sub, cls, dur){
  const layer=document.getElementById('toastLayer');
  const el=document.createElement('div');
  el.className='toast '+(cls||'info');
  el.innerHTML = `<div class="big">${text}</div>${sub?`<div class="sub">${sub}</div>`:''}`;
  layer.appendChild(el);
  requestAnimationFrame(()=>el.classList.add('show'));
  setTimeout(()=>{
    el.classList.remove('show');
    setTimeout(()=>el.remove(), 400);
  }, dur||1800);
}

function renderHull(){
  document.getElementById('hullPct').textContent = Math.round(state.hull)+'%';
  const fill=document.getElementById('hullBarFill');
  fill.style.width = state.hull+'%';
  if(state.hull<30) fill.style.background='linear-gradient(90deg,#a52d2d,var(--danger))';
  else if(state.hull<65) fill.style.background='linear-gradient(90deg,#c98a2d,var(--amber))';
  else fill.style.background='linear-gradient(90deg,#3fce8a,var(--success))';
}
// `site` (optional): the barrel slot that blew up, which gets a scorch mark on the floor around it.
function damageHull(amount, site){
  state.hull = clamp(state.hull-amount, 0, 100);
  renderHull();
  syncDamageMarks(site);
  state.warnT=0.5;
  state.shake = Math.min(state.shake+18, 26);
  if(state.hull<=0 && state.phase==='playing' && !state.breaching){
    state.breaching = true;
    SaveGame.clear(); // the shift is lost; don't let a reload undo it
    playHullBreachSequence();
  }
}
function healHull(amount){
  state.hull = clamp(state.hull+amount, 0, 100);
  renderHull();
  syncDamageMarks();
}

// ---------- Structural damage ----------
// Hull integrity goes in 15% steps. Every lost step scars the bay a little more: a scorch mark on the
// floor around the barrel slot that blew, plus soot, cracks and (further down) torn plating on the walls
// and floor, more and bigger the lower the hull gets. A repair takes the latest step's marks away again.
// The marks are painted on the background canvas, so they cost nothing per frame.
// Below that: from 65% moving machinery throws sparks, more often each step; from 40% aliens coming
// back on-screen sometimes worry out loud; from 25% the bay rumbles now and then, and from 10% the
// rumbles last longer and come more often.
const HULL_STEP = 15;
const SPARK_HULL = 65, COMPLAIN_HULL = 40, RUMBLE_HULL = 25, RUMBLE_SUSTAINED_HULL = 10;
function damageStep(){ return Math.round((100-state.hull)/HULL_STEP); }
function damageGroupCount(){ return new Set(state.scars.map(s=>s.group)).size; }
// Bring the marks in line with the hull: one group per lost step.
function syncDamageMarks(site){
  let changed=false;
  while(damageGroupCount() < damageStep()){ addDamageGroup(damageGroupCount()+1, site); site=undefined; changed=true; }
  while(damageGroupCount() > damageStep()){
    const g=state.scars[state.scars.length-1].group;
    state.scars=state.scars.filter(s=>s.group!==g);
    changed=true;
  }
  if(changed && W) paintBackground();
}
function addDamageGroup(step, site){
  const group=++state.scarGroup, size=0.7+step*0.12;
  const seed=()=>randInt(1, 2e9);
  if(site!==undefined) state.scars.push({group, kind:'blast', site, size, seed:seed()});
  const n = 1 + (step>=3?1:0) + (step>=5?1:0);
  for(let i=0;i<n;i++){
    const spot=pickScarSpot();
    if(!spot) continue;
    const kinds = step>=4 ? ['scorch','crack','gash','gash'] : ['scorch','crack','crack'];
    state.scars.push({group, kind:choice(kinds), floor:spot.floor, u:spot.u, v:spot.v,
      size:size*rand(0.8,1.2), rot:rand(0,TAU), seed:seed()});
  }
}
// Where a mark sits on screen. Positions are stored relative to the wall or floor (or as a barrel
// slot), so they stay put through a resize.
function scarPos(s){
  if(s.kind==='blast'){ const a=layout.barrels4[s.site]; return {x:a.x, y:a.y}; }
  return {x:s.u*W, y: s.floor ? lerp(layout.floorTop, layout.floorBottom, s.v) : s.v*layout.floorTop};
}
// A random spot on the wall or floor that isn't hidden behind the iris, the airlock, the HUD or a
// barrel, and isn't on top of another mark.
function pickScarSpot(){
  const {cx,cy,r}=layout.iris, c=layout.chute, cb=layout.chuteBtn, R=layout.barrelR, m=24;
  const huds=['hullPanel','topRight'].map(id=>document.getElementById(id).getBoundingClientRect());
  const holes=layout.barrelHoles.concat([layout.armHole]);
  for(let tries=0; tries<40; tries++){
    const floor = Math.random()<0.4;
    const s={floor, u:rand(0.04,0.96), v: floor ? rand(0.05,0.97) : rand(0.08,0.9)};
    const p=scarPos(s);
    if(!floor && Math.hypot(p.x-cx, p.y-cy) < r*1.3+m) continue;
    if(Math.abs(p.x-c.x) < c.w/2+m && p.y > cb.y-cb.h/2-m && p.y < c.y+c.h/2+m) continue;
    if(huds.some(b=> p.x>b.left-m && p.x<b.right+m && p.y>b.top-m && p.y<b.bottom+m)) continue;
    if(floor && holes.some(h=> Math.abs(p.x-h.x) < h.rx+R*0.6 && p.y > h.y-layout.barrelH-R && p.y < h.y+h.ry+R*0.5)) continue;
    if(layout.holos.some(g=> Math.abs(p.x-g.x) < g.w/2+m && p.y > g.y-g.h/2-m && p.y < Math.max(g.y+g.h/2, g.ey)+m)) continue;
    if(state.scars.some(o=> o.kind!=='blast' && Math.hypot(scarPos(o).x-p.x, scarPos(o).y-p.y) < 60)) continue;
    return s;
  }
  return null;
}
// Small seeded PRNG, so a mark comes out the same shape every time the background is repainted.
function seededRand(seed){
  let s=seed>>>0;
  return ()=>{
    s=(s+0x6D2B79F5)>>>0;
    let t=s; t=Math.imul(t^(t>>>15), t|1); t^=t+Math.imul(t^(t>>>7), t|61);
    return ((t^(t>>>14))>>>0)/4294967296;
  };
}
function drawHullDamage(){
  const k=clamp(Math.min(W,H)/700, 0.6, 1.3);
  for(const s of state.scars){
    const p=scarPos(s), rnd=seededRand(s.seed), onFloor = s.kind==='blast' || s.floor;
    ctx.save();
    // keep wall marks on the wall and floor marks on the floor
    ctx.beginPath();
    if(onFloor) ctx.rect(0, layout.floorTop, W, H-layout.floorTop); else ctx.rect(0, 0, W, layout.floorTop);
    ctx.clip();
    ctx.translate(p.x, p.y);
    if(s.kind==='blast') drawScorch(rnd, layout.barrelR*1.8*s.size, 0.45, false, 1.8);
    else if(s.kind==='scorch') drawScorch(rnd, 34*k*s.size, s.floor ? 0.38 : 1, !s.floor, s.floor ? 1.5 : 1);
    else if(s.kind==='crack') drawCrack(rnd, 60*k*s.size, s.floor ? 0.45 : 1, s.rot);
    else drawGash(rnd, 26*k*s.size, s.floor ? 0.45 : 1, s.rot);
    ctx.restore();
  }
}
// Soot from a blast: a heat-tinted halo, overlapping blotches and tapered rays. `squash` flattens it
// onto the floor; on the wall, smoke stains climb up from it. `tint` strengthens the heat halo, which
// is what shows on the darker floor.
function drawScorch(rnd, R, squash, smoke, tint){
  const ht=tint||1;
  ctx.save();
  ctx.scale(1, squash);
  let g=ctx.createRadialGradient(0,0,R*0.3, 0,0,R*1.3);
  g.addColorStop(0,`rgba(160,95,45,${0.16*ht})`); g.addColorStop(0.6,`rgba(80,100,160,${0.08*ht})`); g.addColorStop(1,'rgba(80,100,160,0)');
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,R*1.3,0,TAU); ctx.fill();
  for(let i=0;i<7;i++){
    const a=rnd()*TAU, d=rnd()*R*0.45, rr=R*(0.35+rnd()*0.45);
    const x=Math.cos(a)*d, y=Math.sin(a)*d;
    g=ctx.createRadialGradient(x,y,0, x,y,rr);
    g.addColorStop(0,'rgba(5,4,3,0.5)'); g.addColorStop(1,'rgba(5,4,3,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,rr,0,TAU); ctx.fill();
  }
  ctx.fillStyle='rgba(5,4,3,0.38)';
  const rays=9+Math.floor(rnd()*7);
  for(let i=0;i<rays;i++){
    const a=rnd()*TAU, w=0.05+rnd()*0.08, r0=R*0.35, r1=R*(0.85+rnd()*0.75);
    ctx.beginPath();
    ctx.moveTo(Math.cos(a-w)*r0, Math.sin(a-w)*r0);
    ctx.lineTo(Math.cos(a)*r1, Math.sin(a)*r1);
    ctx.lineTo(Math.cos(a+w)*r0, Math.sin(a+w)*r0);
    ctx.closePath(); ctx.fill();
  }
  // a few flecks of spatter beyond the rays
  for(let i=0;i<10;i++){
    const a=rnd()*TAU, d=R*(0.9+rnd()*0.8);
    ctx.beginPath(); ctx.arc(Math.cos(a)*d, Math.sin(a)*d, 0.8+rnd()*1.8, 0, TAU); ctx.fill();
  }
  ctx.restore();
  if(smoke){
    for(let i=0;i<3;i++){
      const x=(rnd()-0.5)*R*0.9, y=-R*(0.9+rnd()*0.9), rx=R*(0.25+rnd()*0.25), ry=R*(0.8+rnd()*0.6);
      ctx.save();
      ctx.translate(x,y); ctx.scale(rx/ry, 1);
      g=ctx.createRadialGradient(0,0,0, 0,0,ry);
      g.addColorStop(0,'rgba(5,4,3,0.2)'); g.addColorStop(1,'rgba(5,4,3,0)');
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,ry,0,TAU); ctx.fill();
      ctx.restore();
    }
  }
}
// A jagged branching crack in the plating, spreading from a dented impact point.
function drawCrack(rnd, len, squash, rot){
  const lines=[];
  const grow=(x, y, ang, l, depth)=>{
    const pts=[{x,y}], n=6+Math.floor(rnd()*4);
    for(let i=0;i<n;i++){
      ang += (rnd()-0.5)*0.9;
      x += Math.cos(ang)*l/n; y += Math.sin(ang)*l/n;
      pts.push({x,y});
      if(depth<2 && rnd()<0.22) grow(x, y, ang+(rnd()<0.5?-1:1)*(0.5+rnd()*0.6), l*0.45, depth+1);
    }
    lines.push({pts, w:[2.4,1.5,1][depth]});
  };
  const arms=2+Math.floor(rnd()*2);
  for(let i=0;i<arms;i++) grow(0, 0, rot + i*TAU/arms + (rnd()-0.5)*0.8, len*(0.5+rnd()*0.6), 0);
  ctx.save();
  ctx.scale(1, squash);
  const dent=ctx.createRadialGradient(0,0,0, 0,0,len*0.16);
  dent.addColorStop(0,'rgba(0,0,0,0.55)'); dent.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=dent; ctx.beginPath(); ctx.arc(0,0,len*0.16,0,TAU); ctx.fill();
  ctx.lineCap='round'; ctx.lineJoin='round';
  const stroke=(dy, style, wk)=>{
    ctx.strokeStyle=style;
    for(const ln of lines){
      ctx.lineWidth=ln.w*wk;
      ctx.beginPath();
      ln.pts.forEach((p,i)=> i ? ctx.lineTo(p.x, p.y+dy) : ctx.moveTo(p.x, p.y+dy));
      ctx.stroke();
    }
  };
  stroke(1.2, 'rgba(160,180,205,0.16)', 0.6);   // lit lower lip of the crack
  stroke(0, 'rgba(0,0,0,0.8)', 1);
  ctx.restore();
}
// Torn plating: a jagged hole into the dark structure behind, with an ember glow deep inside, a bent
// lip catching the light and a couple of loose wires, all ringed with soot.
function drawGash(rnd, R, squash, rot){
  drawScorch(rnd, R*1.4, squash, squash===1, squash===1 ? 1 : 1.5);
  ctx.save();
  ctx.scale(1, squash);
  ctx.rotate(rot*0.3);
  const n=14, pts=[];
  const ax=1+rnd()*0.6;   // a little longer than it is tall
  for(let i=0;i<n;i++){
    const a=i/n*TAU, rr=R*(i%2 ? 0.55+rnd()*0.25 : 0.85+rnd()*0.35);
    pts.push({x:Math.cos(a)*rr*ax, y:Math.sin(a)*rr*0.7});
  }
  const path=()=>{ ctx.beginPath(); pts.forEach((p,i)=> i ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y)); ctx.closePath(); };
  path(); ctx.fillStyle='#030406'; ctx.fill();
  ctx.save();
  path(); ctx.clip();
  const glow=ctx.createRadialGradient(0,R*0.15,0, 0,R*0.15,R*0.8);
  glow.addColorStop(0,'rgba(255,90,40,0.35)'); glow.addColorStop(1,'rgba(255,90,40,0)');
  ctx.fillStyle=glow; ctx.fillRect(-R*2,-R*2,R*4,R*4);
  // a structural rib crossing the hole
  ctx.strokeStyle='rgba(60,70,85,0.9)'; ctx.lineWidth=R*0.12;
  ctx.beginPath(); ctx.moveTo(-R*2, R*(rnd()-0.5)*0.6); ctx.lineTo(R*2, R*(rnd()-0.5)*0.6); ctx.stroke();
  ctx.restore();
  // bent lip: light along the upper edge, dark along the lower
  ctx.lineJoin='round';
  for(let i=0;i<n;i++){
    const p=pts[i], q=pts[(i+1)%n];
    ctx.strokeStyle = (p.y+q.y)<0 ? 'rgba(150,165,185,0.45)' : 'rgba(0,0,0,0.7)';
    ctx.lineWidth=1.6;
    ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(q.x,q.y); ctx.stroke();
  }
  // loose wires hanging out
  const wires=1+Math.floor(rnd()*2);
  for(let i=0;i<wires;i++){
    const p=pts[Math.floor(rnd()*n)];
    ctx.strokeStyle=['rgba(220,80,60,0.8)','rgba(230,190,70,0.8)','rgba(90,170,220,0.8)'][Math.floor(rnd()*3)];
    ctx.lineWidth=1.2;
    ctx.beginPath(); ctx.moveTo(p.x*0.8, p.y*0.8);
    ctx.quadraticCurveTo(p.x*0.3+R*(rnd()-0.5), R*(0.5+rnd()*0.5), p.x*0.5+R*(rnd()-0.5)*0.8, R*(0.6+rnd()*0.6));
    ctx.stroke();
  }
  ctx.restore();
}

// ---- Sparks ----
// From 65% down, moving machinery (the arm, iris, lever, barrel elevators, airlock hatch) sometimes
// throws a shower of sparks as it moves: a 20% chance at 55%, rising 15% with each step after.
function sparkChance(){ return state.hull>SPARK_HULL ? 0 : clamp(0.2 + (55-state.hull)/HULL_STEP*0.15, 0.2, 0.7); }
function maybeSpark(x, y, dir){
  if(state.phase==='intro' || state.phase==='gameover') return false;
  if(Math.random()>=sparkChance()) return false;
  spawnSparkShower(x, y, dir);
  return true;
}
// `dir` (optional): the general direction they fly in; otherwise every which way.
function spawnSparkShower(x, y, dir){
  const n=randInt(8,16);
  for(let i=0;i<n;i++){
    const ang = dir===undefined ? rand(0,TAU) : dir+rand(-0.9,0.9), sp=rand(120,380);
    state.particles.push({type:'zap', x, y, vx:Math.cos(ang)*sp, vy:Math.sin(ang)*sp - rand(40,140),
      life:0, maxLife:rand(0.35,0.8), size:rand(0.8,1.7)});
  }
  state.particles.push({type:'zapFlash', x, y, life:0, maxLife:0.14, size:rand(10,16)});
  AudioEngine.spark();
}
// While the iris blades are moving, roll for sparks off a random point of the ring every so often.
function updateIrisSparks(dt){
  if(Math.abs(state.irisTarget-state.irisOpen) < 0.03){ state.irisSparkT=0; return; }
  state.irisSparkT -= dt;
  if(state.irisSparkT>0) return;
  state.irisSparkT = 0.4;
  const {cx,cy,r}=layout.iris;
  for(let tries=0; tries<6; tries++){
    const a=rand(0,TAU), x=cx+Math.cos(a)*r*1.08, y=cy+Math.sin(a)*r*1.08;
    if(y < layout.floorTop-6){ maybeSpark(x, y, a); return; }
  }
}

// ---- Worried aliens ----
// From 40% down, an alien coming back on-screen has a 25% chance to complain once it's a quarter
// of the way along the track it's starting.
const ALIEN_COMPLAIN_CHANCE = 0.25;
const ALIEN_DAMAGE_MESSAGES=[
  "Something sounds broken.",
  "You guys have lifejackets, right?",
  "Is the floor supposed to do that?",
  "I smell smoke. Is that normal?",
  "Who's in charge of repairs around here?",
  "I'd like to speak to the ship's engineer.",
];
// Called as an alien starts a track at `fromX`, heading for `toX`.
function maybeScheduleComplaint(a, fromX, toX){
  a.complainAtX = null; a.complainDue = false;
  if(state.hull>COMPLAIN_HULL || Math.random()>=ALIEN_COMPLAIN_CHANCE) return;
  a.complainAtX = lerp(fromX, toX, 0.25);
}
// Called each frame as a walker moves from prevX to a.baseX. If it's mid-sentence when it passes
// the mark, it says its piece as soon as it's done.
function updateComplaint(a, prevX){
  if(a.complainAtX!=null && prevX!==a.baseX && (prevX-a.complainAtX)*(a.baseX-a.complainAtX)<=0){
    a.complainAtX = null; a.complainDue = true;
  }
  if(a.complainDue && a.bubbleT<=0){
    a.complainDue = false;
    a.message = choice(ALIEN_DAMAGE_MESSAGES);
    a.bubbleT = 3.5;
  }
}

// ---- Rumble ----
// From 25% down the bay rumbles every so often: a low roar and a light tremor. From 10% the rumbles
// are no stronger, but they last longer and the quiet spells between them are shorter.
function updateRumble(dt){
  const rb=state.rumble;
  const active = state.hull<=RUMBLE_HULL && state.hull>0 && !state.breaching &&
                 (state.phase==='playing' || state.phase==='transition');
  if(!active){ rb.t=0; rb.shake=0; rb.next=rand(1.5,3); return; }   // the first one comes soon after the hull drops this far
  if(rb.t>0){
    rb.t = Math.max(0, rb.t-dt);
    const u = 1 - rb.t/rb.dur;
    const env = Math.min(1, u/0.25, (1-u)/0.25);
    rb.shake = reducedMotion ? 0 : 2.4*env*(0.75+0.25*Math.sin(state.t*19));
    return;
  }
  rb.shake = 0;
  rb.next -= dt;
  if(rb.next>0) return;
  const sustained = state.hull<=RUMBLE_SUSTAINED_HULL;
  rb.dur = sustained ? rand(3.5,5.5) : rand(1.2,2);
  rb.t = rb.dur;
  rb.next = sustained ? rand(2,4) : rand(7,13);
  AudioEngine.rumble(rb.dur);
}
function playHullBreachSequence(){
  state.phase='breach';
  AudioEngine.beamStop();
  const spots = layout.barrels4.map(a=>({x:a.x, y:a.y-layout.barrelH*0.5}));
  spots.forEach((pos,i)=>{
    setTimeout(()=>{
      if(state.phase!=='breach') return;
      spawnExplosion(pos.x, pos.y);
      AudioEngine.explosion();
      state.shake = Math.max(state.shake, 24);
      state.warnT = 0.5;
    }, i*450);
  });
  setTimeout(()=>{
    if(state.phase==='breach') gameOver();
  }, spots.length*450 + 500);
}
function gameOver(){
  state.phase='gameover';
  AudioEngine.beamStop();
  document.getElementById('endTitle').textContent='HULL BREACH';
  document.getElementById('endText').textContent = `Structural integrity failed in Sector ${String(state.sector).padStart(2,'0')}. Cargo operations suspended.`;
  document.getElementById('endOverlay').classList.remove('hidden');
}

function spawnExplosion(x,y){
  for(let i=0;i<22;i++){
    const ang=rand(0,TAU), sp=rand(60,260);
    state.particles.push({
      type:'shard', x,y, vx:Math.cos(ang)*sp, vy:Math.sin(ang)*sp - rand(20,80),
      life:0, maxLife:rand(0.4,0.75), size:rand(2,6), hue: choice([10,25,40])
    });
  }
  state.particles.push({type:'flash', x,y, life:0, maxLife:0.35, size:10});
}
function spawnBarrelDebris(x,y){
  const R=layout.barrelR;
  for(let i=0;i<10;i++){
    const ang=rand(-Math.PI*0.95,-Math.PI*0.05), sp=rand(140,300);
    state.particles.push({
      type:'plate', x:x+rand(-R,R)*0.6, y:y+rand(-R,R),
      vx:Math.cos(ang)*sp, vy:Math.sin(ang)*sp,
      rot:rand(0,TAU), spin:rand(-9,9),
      w:rand(0.35,0.7)*R, h:rand(0.12,0.24)*R,
      life:0, maxLife:rand(0.8,1.2)
    });
  }
}
function spawnDebrisRain(x,y){
  for(let i=0;i<16;i++){
    state.particles.push({
      type:'shard', x:x+rand(-50,50), y:y+rand(-8,8),
      vx:rand(-40,40), vy:rand(-30,20),
      life:0, maxLife:rand(0.9,1.5), size:rand(2,5), hue: choice([40,45,200,210])
    });
  }
}
function spawnSealRing(x,y){
  state.particles.push({type:'ring', x,y, life:0, maxLife:1.1, size:layout.barrelR});
}
function spawnEjectTrail(x,y,vx,vy,pal){
  state.particles.push({type:'ejectRock', x,y,vx,vy, life:0, maxLife:1.4, size:rand(10,16), pal});
}
function spawnEjectSpark(x,y){
  for(let i=0;i<10;i++){
    const ang=rand(0,TAU), sp=rand(40,140);
    state.particles.push({type:'spark', x,y, vx:Math.cos(ang)*sp, vy:Math.sin(ang)*sp, life:0, maxLife:rand(0.3,0.5), size:rand(1.5,3)});
  }
}

function localPos(e){
  const rect=canvas.getBoundingClientRect();
  const cx = (e.touches? e.touches[0].clientX : e.clientX) - rect.left;
  const cy = (e.touches? e.touches[0].clientY : e.clientY) - rect.top;
  return {x:cx,y:cy};
}
function hitRock(pos){
  const candidates = state.rocks.filter(r=> (r.state==='floating' && state.irisOpen>0.5) || r.state==='settled' || r.state==='falling');
  candidates.sort((a,b)=> b.scale - a.scale);
  for(const r of candidates){
    const d=Math.hypot(pos.x-r.x, pos.y-r.y);
    const hitR = Math.max(r.size*r.scale*1.2, 24);
    if(d < hitR) return r;
  }
  return null;
}
function hitAlien(pos){
  // Thrown aliens can be caught mid-air, but not ones on a scripted fall (booted by the arm, shaken off the ring).
  const candidates = state.aliens.filter(a=> (a.state==='floating' && state.irisOpen>0.5) || a.state==='settled' || a.state==='chute' ||
    (a.state==='falling' && !a.kicked && !a.fallToTrack2));
  candidates.sort((a,b)=> b.scale - a.scale);
  for(const a of candidates){
    const d=Math.hypot(pos.x-a.x, pos.y-a.y);
    const hitR = Math.max(a.size*a.scale*1.2, 24);
    if(d < hitR) return a;
  }
  return null;
}
function hitBarrel(pos, idx){
  if(state.barrels[idx].status!=='ready') return false; // carried off, gone, or still coming up
  const anchor=layout.barrels4[idx];
  const R=layout.barrelR, Hh=layout.barrelH;
  const topY=anchor.y-Hh, botY=anchor.y+R*0.4;
  return pos.x >= anchor.x-R*1.15 && pos.x <= anchor.x+R*1.15 &&
         pos.y >= topY-R*0.25 && pos.y <= botY;
}
function onDown(e){
  if(state.phase!=='playing') return;
  if(state.held) return; // already dragging a rock — ignore extra pointer/touch events
  AudioEngine.init();
  const pos=localPos(e);
  if(hitChuteButton(pos)){
    e.preventDefault();
    launchChute();
    state.pointer.x=pos.x; state.pointer.y=pos.y; state.pointer.active=true;
    return;
  }
  const r=hitRock(pos);
  if(r){
    e.preventDefault();
    state.held=r;
    r.state='held';
    state.dragLast={x:pos.x,y:pos.y};
    state.dragSamples=[]; recordDragSample(pos);
    AudioEngine.beamStart();
    canvas.setPointerCapture && e.pointerId!==undefined && canvas.setPointerCapture(e.pointerId);
    state.pointer.x=pos.x; state.pointer.y=pos.y; state.pointer.active=true;
    return;
  }
  const a=hitAlien(pos);
  if(a){
    e.preventDefault();
    breakStackAt(a); // everyone above tumbles off; anyone below keeps walking
    if(a.state==='chute'){ a.message=choice(ALIEN_CHUTE_RESCUE_MESSAGES); a.bubbleT=2.5; a.tumbled=true; }
    state.held=a;
    a.state='held';
    state.dragLast={x:pos.x,y:pos.y};
    state.dragSamples=[]; recordDragSample(pos);
    AudioEngine.beamStart();
    canvas.setPointerCapture && e.pointerId!==undefined && canvas.setPointerCapture(e.pointerId);
    state.pointer.x=pos.x; state.pointer.y=pos.y; state.pointer.active=true;
    return;
  }
  for(let i=0;i<layout.barrels4.length;i++){
    if(!state.barrels[i].sealed && hitBarrel(pos,i)){
      e.preventDefault();
      ejectBarrel(i);
      break;
    }
  }
  const lev=layout.lever;
  if(Math.hypot(pos.x-lev.x, pos.y-lev.y) < Math.max(lev.h*1.1, 24)){
    e.preventDefault();
    flipLever();
    state.pointer.x=pos.x; state.pointer.y=pos.y; state.pointer.active=true;
    return;
  }
  const btn=layout.redButton;
  if(Math.hypot(pos.x-btn.x, pos.y-btn.y) < Math.max(btn.r*1.6, 22)){
    e.preventDefault();
    pressRedButton();
    state.pointer.x=pos.x; state.pointer.y=pos.y; state.pointer.active=true;
    return;
  }
  if(state.phase==='playing' && state.irisTarget===0){
    const iris=layout.iris;
    if(Math.hypot(pos.x-iris.cx, pos.y-iris.cy) < iris.r*1.15){
      e.preventDefault();
      state.irisTarget=1;
      state.pointer.x=pos.x; state.pointer.y=pos.y; state.pointer.active=true;
      return;
    }
  }
  state.pointer.x=pos.x; state.pointer.y=pos.y; state.pointer.active=true;
}
function onMove(e){
  const pos=localPos(e);
  state.pointer.x=pos.x; state.pointer.y=pos.y;
  if(state.held){
    e.preventDefault();
    const r=state.held;
    r.vel = {x:pos.x-state.dragLast.x, y:pos.y-state.dragLast.y};
    state.dragLast={x:pos.x,y:pos.y};
    recordDragSample(pos);
    r.x = pos.x; r.y = pos.y;
    const top = layout.iris.cy - layout.iris.r*0.2;
    const bottom = layout.floorBottom;
    const t = clamp((pos.y-top)/(bottom-top), 0, 1);
    r.targetScale = lerp(0.62, 1.7, t);
  }
}
function onUp(e){
  if(!state.held) return;
  const r=state.held;
  state.held=null;
  AudioEngine.beamStop();
  if(r.isAlien) releaseAlien(r); else releaseRock(r);
}
canvas.addEventListener('pointerdown', onDown);
window.addEventListener('pointermove', onMove, {passive:false});
window.addEventListener('pointerup', onUp);

// ---- Throw physics ----
// Whatever the beam lets go of keeps the pointer's velocity and flies under gravity: it bounces
// on the near floor, skids to a stop, and anything that sails past a side edge has left the bay
// (a rock is unloaded, an alien starts its off-screen gap).
const THROW_SAMPLE_MS = 90;      // pointer history used to measure the throw
const THROW_STALE_MS = 100;      // pointer still for longer than this before letting go = a drop, not a throw
const THROW_MAX_SPEED = 1400;    // px/s
const FALL_GRAVITY = 420;        // px/s²
const BOUNCE_RESTITUTION = 0.35; // share of vertical speed kept on each bounce
const BOUNCE_MIN_VY = 110;       // hitting the floor slower than this stops the bouncing
const BOUNCE_KEEP_VX = 0.8;      // share of sideways speed kept on each bounce
const FLOOR_FRICTION = 900;      // px/s² of sideways slowdown while skidding on the floor
const SETTLE_SPEED = 15;         // px/s; slower than this on the floor counts as at rest
function recordDragSample(pos){
  const now=performance.now();
  state.dragSamples.push({x:pos.x, y:pos.y, t:now});
  while(state.dragSamples.length>2 && now-state.dragSamples[0].t > THROW_SAMPLE_MS*2) state.dragSamples.shift();
}
// Pointer velocity (px/s) over the last moment of the drag. A pointer that stopped before letting
// go has no recent samples, so it drops the object instead of throwing it.
function throwVelocity(){
  const now=performance.now(), s=state.dragSamples;
  state.dragSamples=[];
  if(s.length<2) return {x:0,y:0};
  const b=s[s.length-1];
  if(now-b.t > THROW_STALE_MS) return {x:0,y:0};
  // Earliest sample within the window, but always at least the one before the last (slow devices
  // can space pointer events further apart than the window).
  let i=s.length-2;
  while(i>0 && b.t-s[i-1].t <= THROW_SAMPLE_MS) i--;
  const a=s[i], dt=(b.t-a.t)/1000;
  if(dt<0.008) return {x:0,y:0};
  let vx=(b.x-a.x)/dt, vy=(b.y-a.y)/dt;
  const sp=Math.hypot(vx,vy);
  if(sp>THROW_MAX_SPEED){ vx*=THROW_MAX_SPEED/sp; vy*=THROW_MAX_SPEED/sp; }
  return {x:vx, y:vy};
}
// One frame of free flight for a falling rock or alien. Returns -1 / 1 once it has gone past the
// left / right edge of the screen, 'rest' once it has come to rest on the floor, otherwise null.
function stepFallingBody(b, dt){
  b.fvx = b.fvx||0;
  b.fvy = (b.fvy||0) + FALL_GRAVITY*dt;
  b.x += b.fvx*dt;
  b.y += b.fvy*dt;
  const pTop = layout.iris.cy - layout.iris.r*0.2;
  const pBottom = layout.floorBottom;
  b.scale = lerp(0.62, 1.7, clamp((b.y-pTop)/(pBottom-pTop), 0, 1));
  const floorY = layout.floorBottom - b.size*0.4;
  let onFloor = false;
  if(b.y>=floorY){
    b.y = floorY;
    if(b.fvy > BOUNCE_MIN_VY){
      b.fvy = -b.fvy*BOUNCE_RESTITUTION;
      b.fvx *= BOUNCE_KEEP_VX;
    } else {
      onFloor = true;
      b.fvy = 0;
      const dv = FLOOR_FRICTION*dt;
      b.fvx = Math.abs(b.fvx)<=dv ? 0 : b.fvx - Math.sign(b.fvx)*dv;
    }
  }
  const rad = b.size*b.scale;
  if(b.x + rad < 0) return -1;
  if(b.x - rad > W) return 1;
  if(onFloor && Math.abs(b.fvx) < SETTLE_SPEED){ b.fvx = 0; return 'rest'; }
  return null;
}
// A falling alien that left the bay over a side edge: straight into the off-screen gap, and its
// next pass comes in from the side it left by (like an alien booted out by the robot arm).
function alienFellOffEdge(a, side){
  a.walksReverse = side<0;
  a.fixitMode = false;
  a.tumbled = false;
  sendAlienOffscreen(a);
}

function releaseRock(r){
  const iris=layout.iris;
  const distIris = Math.hypot(r.x-iris.cx, r.y-iris.cy);
  if(distIris < iris.r*0.92 && state.irisOpen>0.75 && r.y < layout.floorTop){
    r.state='ejected';
    const v = r.vel || {x:0,y:-4};
    const mag = Math.hypot(v.x,v.y)||1;
    const speed = clamp(mag*2.2, 90, 420);
    r.evx = (r.x-iris.cx)/ (Math.hypot(r.x-iris.cx,r.y-iris.cy)||1) * speed*0.3 + (v.x/mag)*speed;
    r.evy = (v.y/mag)*speed - 40;
    r.opacity=1;
    AudioEngine.eject();
    return;
  }
  for(let i=0;i<layout.barrels4.length;i++){
    if(hitBarrel({x:r.x,y:r.y}, i)){
      handleBarrelDrop(i, r);
      return;
    }
  }
  const v = throwVelocity();
  r.state='falling';
  r.fvx = v.x; r.fvy = v.y;
}
function releaseAlien(a){
  a.walksReverse = Math.random()<0.5;
  if(!chuteOccupant() && hitChute(a)){ putAlienInChute(a); return; }
  const iris=layout.iris;
  if(Math.hypot(a.x-iris.cx, a.y-iris.cy) < iris.r*0.92 && state.irisOpen>0.75 && a.y < layout.floorTop){
    forceFieldRebound(a);
    return;
  }
  const v = throwVelocity();
  a.state='falling';
  a.fvx = v.x; a.fvy = v.y;
}

// ---- Iris force field ----
// Aliens can't be thrown out through the iris: a staticky field flashes over the window and
// bounces them gently back into the bay, sideways, away from the middle of the window.
const FORCE_FIELD_DUR = 0.7;
const ALIEN_FORCEFIELD_MESSAGES=[
  "Ow!",
  "That tickles!",
  "Bzzzt! Hey!",
  "Ooh, staticky!",
  "My antennae are all fuzzy now!",
  "Do it again!",
  "Rude!",
];
function forceFieldRebound(a){
  const iris=layout.iris;
  throwVelocity(); // discard the throw: the field decides where it goes
  state.forceField = {t:FORCE_FIELD_DUR, x:a.x, y:a.y};
  const side = Math.sign(a.x-iris.cx) || choice([-1,1]);
  a.state='falling';
  a.fvx = side*Math.min(W*rand(0.18,0.28), 260);
  a.fvy = -rand(140,200);
  a.tumbled = true; // it's already said its piece; no greeting when it lands
  a.message = choice(ALIEN_FORCEFIELD_MESSAGES);
  a.bubbleT = 2.5;
  spawnEjectSpark(a.x, a.y);
  AudioEngine.forceField();
}

// ---- Airlock chute ----
// The only way to really get rid of an alien: drop it into the glass box on the left wall, then
// press LAUNCH. It's sucked out through the outer hatch and drifts past the iris window, waving
// goodbye. Until launch it can be grabbed back out.
const CHUTE_SUCK_DUR = 0.45;     // shrinking out through the outer hatch
const CHUTE_HATCH_DUR = 1.2;     // outer hatch stays open this long after launch
const CHUTE_FLIGHT_DUR = 3.4;    // drifting across the iris window
const ALIEN_CHUTE_ENTER_MESSAGES=[
  "Hey! What's this?",
  "Is this a sauna?",
  "I don't like where this is going.",
  "Cozy. Suspiciously cozy.",
  "Let's talk about this!",
  "I want to speak to your captain!",
  "Is this the VIP lounge?",
];
const ALIEN_CHUTE_WAIT_MESSAGES=[
  "Hello? Anybody?",
  "*knock knock*",
  "I can see you, you know.",
  "I'll be good, I promise!",
  "It's getting stuffy in here.",
  "What's that button do?",
  "Don't press anything!",
];
const ALIEN_CHUTE_RESCUE_MESSAGES=[
  "Freedom!",
  "I knew you'd come around!",
  "Phew!",
  "Was it something I said?",
];
const ALIEN_FAREWELL_MESSAGES=[
  "Nice knowing ya!",
  "I don't blame you!",
  "No hard feelings!",
  "Worth a shot!",
  "Catch you on the flip side!",
  "Wheeeeee!",
  "I'll write!",
  "Tell my clones I said hi!",
];
function chuteOccupant(){ return state.aliens.find(a=> a.state==='chute' || a.state==='launching') || null; }
function hitChute(pos){
  const c=layout.chute, m=18;
  return Math.abs(pos.x-c.x) <= c.w/2+m && Math.abs(pos.y-c.y) <= c.h/2+m;
}
function hitChuteButton(pos){
  const b=layout.chuteBtn;
  return Math.abs(pos.x-b.x) <= Math.max(b.w, 44)/2 && Math.abs(pos.y-b.y) <= Math.max(b.h, 44)/2;
}
function putAlienInChute(a){
  throwVelocity();
  a.state='chute';
  a.walkPhase=null; a.fixitMode=false; a.tumbled=false; a.hideJumpOut=false;
  a.fvx=a.fvy=0;
  a.greeted = true;
  a.message = choice(ALIEN_CHUTE_ENTER_MESSAGES);
  a.bubbleT = 3;
  a.chuteTalkT = rand(7,11);
  AudioEngine.chuteAccept();
}
function launchChute(){
  const ch=state.chute, a=chuteOccupant();
  ch.press = 0.15;
  if(!a || a.state!=='chute'){ AudioEngine.uiBlip(160); return; }
  a.state='launching';
  a.launchT=0;
  a.chuteScale=a.scale;
  a.bubbleT=0;
  ch.flash=1;
  ch.hatchT=CHUTE_HATCH_DUR;
  state.irisTarget=1; // open up so everyone gets to watch
  AudioEngine.airlock();
  maybeSpark(layout.chute.x + layout.chute.w*0.36*rand(-1,1), layout.chute.y - layout.chute.h*0.05 - layout.chute.w*0.3);
}
// Out through the hatch: from here it's a little figure in space, crossing the window left to right.
function startChuteFlight(a){
  const {cx,cy,r}=layout.iris;
  a.state='spaced';
  a.flightT=0;
  a.flightY0 = cy + r*rand(0.1,0.35);
  a.flightY1 = cy - r*rand(0.2,0.45);
  a.x = cx - r*1.15; a.y = a.flightY0;
  a.rot = 0; a.spin = choice([-1,1])*rand(1.5,2.8);
  a.opacity = 1;
  a.saidBye = false;
}
function updateChute(dt){
  const ch=state.chute;
  ch.flash = Math.max(0, ch.flash-dt*2.5);
  ch.press = Math.max(0, ch.press-dt);
  ch.hatchT = Math.max(0, ch.hatchT-dt);
  ch.hatch = lerp(ch.hatch, ch.hatchT>0 ? 1 : 0, Math.min(1, dt*(ch.hatchT>0 ? 9 : 4)));
  state.forceField.t = Math.max(0, state.forceField.t-dt);
}
function updateChuteAlien(a, dt){
  const c=layout.chute;
  if(a.state==='chute'){
    // The chute is on the wall above track 2, so its occupant is drawn at track 2's depth.
    a.scale = lerp(a.scale, ALIEN_TRACK2_SCALE, Math.min(1, dt*6));
    a.x = c.x + Math.sin(state.t*0.9+a.phase)*c.w*0.07;
    a.y = c.y + c.h*0.1 + Math.sin(state.t*1.7+a.phase)*2;
    a.baseX=a.x; a.baseY=a.y;
    a.chuteTalkT -= dt;
    if(a.chuteTalkT<=0 && a.bubbleT<=0){
      a.message = choice(ALIEN_CHUTE_WAIT_MESSAGES);
      a.bubbleT = 3;
      a.chuteTalkT = rand(8,13);
    }
  } else if(a.state==='launching'){
    a.launchT += dt;
    const u = clamp(a.launchT/CHUTE_SUCK_DUR, 0, 1);
    a.scale = a.chuteScale*(1 - 0.85*u*u);
    a.opacity = 1 - u*u;
    a.x = lerp(a.x, c.x, Math.min(1, dt*10));
    a.y = lerp(a.y, c.y - c.h*0.05, Math.min(1, dt*10));
    if(u>=1) startChuteFlight(a);
  } else if(a.state==='spaced'){
    const {cx,r}=layout.iris;
    a.flightT += dt;
    const u = a.flightT/CHUTE_FLIGHT_DUR;
    a.x = lerp(cx - r*1.15, cx + r*1.15, u);
    a.y = lerp(a.flightY0, a.flightY1, u) - Math.sin(u*Math.PI)*r*0.12;
    a.scale = lerp(ALIEN_TRACK2_SCALE, ALIEN_TRACK2_SCALE*0.4, u);   // out beyond the wall: no bigger than in the chute
    a.rot += a.spin*dt;
    a.opacity = u>0.8 ? clamp((1-u)/0.2, 0, 1) : 1;
    // Speak up once it's properly in view, and be done talking by the time it's gone.
    if(!a.saidBye && a.x > cx - r*0.8){
      a.saidBye = true;
      a.message = choice(ALIEN_FAREWELL_MESSAGES);
      a.bubbleT = CHUTE_FLIGHT_DUR*0.68;
    }
    if(u>=1) a.state='gone';
  }
}

function maybeTriggerFixit(a){
  if(Math.random()<0.05){
    startAlienFixit(a);
    return true;
  }
  return false;
}
function startAlienFixit(a){
  const topX = W*0.5, topY = 24;
  spawnExplosion(topX, topY);
  spawnDebrisRain(topX, topY);
  AudioEngine.explosion();
  state.shake = Math.min(state.shake+18, 26);
  healHull(15);
  a.state='falling';
  a.x = topX; a.y = topY; a.baseX = topX; a.baseY = topY;
  a.fvx = 0; a.fvy = 0;
  a.fixitMode = true;
  a.walkPhase = null;
}

function maybeTriggerDuplicate(a){
  if(Math.random()<0.05){
    duplicateAlien(a);
  }
}
function duplicateAlien(parent){
  const clone = createAlien(true); // skip its own avatar fetch — it inherits the parent's face below
  clone.baseName = parent.baseName || parent.name;
  if(!state.alienCloneCounters[clone.baseName]) state.alienCloneCounters[clone.baseName] = 2;
  const num = state.alienCloneCounters[clone.baseName]++;
  clone.name = clone.baseName + ' #' + num;

  // Exact same face as the parent, whether that's the procedural generator's data
  // or (in gravatar mode) the same already-loading/loaded image.
  clone.face = parent.face;
  clone.avatarImg = parent.avatarImg;
  clone.avatarLoaded = parent.avatarLoaded;
  clone.avatarFailed = parent.avatarFailed;

  clone.walksReverse = Math.random()<0.5;
  clone.greeted = true;
  clone.state = 'settled';
  clone.buttonRolled = false;
  clone.leverRolled = false;
  clone.climbRolled = false;
  if(Math.random()<0.5){
    clone.track = 2;
    clone.walkPhase = 'track2';
    clone.targetScale = ALIEN_TRACK2_SCALE;
    clone.scale = ALIEN_TRACK2_SCALE;
    clone.baseY = layout.floorTop;
    clone.baseX = clone.walksReverse
      ? -clone.size*clone.scale - ALIEN_TRACK_EDGE_MARGIN
      : W + clone.size*clone.scale + ALIEN_TRACK_EDGE_MARGIN;
  } else {
    clone.track = 1;
    clone.walkPhase = 'track1';
    clone.targetScale = ALIEN_TRACK1_SCALE;
    clone.scale = ALIEN_TRACK1_SCALE;
    clone.baseY = layout.floorBottom - clone.size*0.4;
    clone.baseX = clone.walksReverse
      ? W + clone.size*clone.scale + ALIEN_TRACK_EDGE_MARGIN
      : -clone.size*clone.scale - ALIEN_TRACK_EDGE_MARGIN;
  }
  clone.x = clone.baseX; clone.y = clone.baseY;
  state.aliens.push(clone);
}

function maybeTriggerHide(a){
  const eligible = [];
  state.barrels.forEach((b,i)=>{ if(!b.sealed && b.status==='ready') eligible.push(i); });
  if(eligible.length===0) return false;
  if(Math.random()<0.05){
    a.hidingInBarrel = choice(eligible);
    a.walkPhase = 'hiding';
    a.state = 'settled';
    return true;
  }
  return false;
}
function evictAlienFromBarrel(a, idx){
  a.hidingInBarrel = null;
  const anchor = layout.barrels4[idx];
  a.state = 'falling';
  a.x = anchor.x; a.y = anchor.y - layout.barrelH*0.55;
  a.baseX = a.x; a.baseY = a.y;
  a.fvy = -90;
  a.fvx = choice([-1,1]) * rand(40,90);
  a.hideJumpOut = true;
  a.walkPhase = null;
}

// The lever does nothing at all except blink a red light while it's down.
function flipLever(){
  state.leverDown = !state.leverDown;
  const L=layout.lever;
  maybeSpark(L.x, L.y, -Math.PI/2);
}

function pressRedButton(){
  if(state.phase!=='playing') return;
  if(state.irisTarget===1){
    if(state.held){
      const held=state.held;
      state.held=null;
      AudioEngine.beamStop();
      if(held.isAlien) releaseAlien(held); else releaseRock(held);
    }
    state.irisTarget=0;
  } else {
    state.irisTarget=1;
  }
}

// What a barrel remembers about each rock it takes, so an ejected rock comes back out as itself.
function rockItem(r){ return {value:r.value, rep:r.rep, text:r.text, glyph:r.glyph||null}; }

function handleBarrelDrop(idx, r){
  const hidden = state.aliens.find(a=>a.hidingInBarrel===idx);
  if(hidden) evictAlienFromBarrel(hidden, idx);

  const barrel=state.barrels[idx];
  if(barrel.sealed){
    r.state='falling'; r.fvy=0; return;
  }
  if(!barrel.value){
    barrel.value = r.value;
    barrel.text = r.text;
    barrel.glyph = r.glyph || null;
    barrel.slots = 1;
    barrel.items = [rockItem(r)];
    r.state='gone';
    removeRock(r);
    barrel.flashT=0.3;
    AudioEngine.chuteAccept();
    trySpawnRandom();
    return;
  }
  if(sameValue(barrel.value, r.value)){
    barrel.slots++;
    barrel.items.push(rockItem(r));
    r.state='gone';
    removeRock(r);
    barrel.flashT=0.3;
    AudioEngine.chuteAccept();
    trySpawnRandom();
    if(barrel.slots>=5){
      sealBarrel(idx);
    }
    return;
  }
  mismatch(idx, r);
}

function mismatch(idx, r){
  const barrel=state.barrels[idx];
  const anchor=layout.barrels4[idx];
  const midY = anchor.y - layout.barrelH*0.5;
  barrel.value=null; barrel.text=null; barrel.glyph=null; barrel.items=[]; barrel.slots=0; barrel.sealed=false;
  barrel.flashT=0; barrel.fillDisplay=0;
  // The barrel is destroyed outright; a fresh empty one comes up out of its slot shortly after.
  barrel.status='destroyed'; barrel.destroyT=BARREL_RESPAWN_DELAY; barrel.riseT=0; barrel.door=0;
  r.state='gone';
  removeRock(r);
  spawnExplosion(anchor.x,midY);
  spawnBarrelDebris(anchor.x, midY);
  damageHull(15, idx);
  AudioEngine.explosion();
  trySpawnRandom();
}

function sealBarrel(idx){
  const barrel=state.barrels[idx];
  barrel.sealed=true;
  barrel.sealT=1;
  const anchor=layout.barrels4[idx];
  spawnSealRing(anchor.x, anchor.y-layout.barrelH*0.5);
  updateBarrelDots();
  queueArmRetrieval(idx);
  // The sector change waits until the arm has taken every barrel away (see updateArm).
}

function ejectBarrel(idx){
  if(state.phase!=='playing') return;
  const hidden = state.aliens.find(a=>a.hidingInBarrel===idx);
  if(hidden) evictAlienFromBarrel(hidden, idx);
  const barrel=state.barrels[idx];
  if(barrel.slots===0 || barrel.sealed || barrel.status!=='ready') return;
  const anchor=layout.barrels4[idx];
  const n=barrel.slots;
  const formerValue=barrel.value, formerItems=barrel.items;
  barrel.value=null; barrel.text=null; barrel.glyph=null; barrel.items=[]; barrel.slots=0; barrel.sealed=false;
  AudioEngine.eject();
  spawnEjectSpark(anchor.x, anchor.y-layout.barrelH*0.5);
  for(let i=0;i<n;i++){
    setTimeout(()=>{
      const ang=rand(-0.5,0.5)-Math.PI/2;
      const sp=rand(160,260);
      const vx=Math.cos(ang)*sp, vy=Math.sin(ang)*sp;
      const x=anchor.x+rand(-10,10), y=anchor.y-layout.barrelH*0.5;
      if(state.irisOpen>0.5){
        spawnEjectTrail(x, y, vx, vy, choice(ROCK_PALETTES));
      } else {
        // Iris closed — the rocks have nowhere to go. Spawn real rocks carrying the values they
        // went in with and fling them into the air; they land and stay fully sortable.
        // (A barrel from a save made before items were tracked has none, so those rocks reroll.)
        const it = formerItems[i];
        const newRock = createRock(it ? it.value : formerValue, it);
        newRock.x = x; newRock.y = y;
        newRock.baseX = x; newRock.baseY = y;
        newRock.state = 'falling';
        newRock.fvx = vx;
        newRock.fvy = vy;
        state.rocks.push(newRock);
      }
    }, i*90);
  }
  updateBarrelDots();
}

// ---------- Robot arm & floor doors ----------
// One job at a time from a FIFO queue of {type, ...} items.
//  retrieve: doors open → arm rises → reaches the barrel → grabs the lid (magnet) → carries it
//            over the arm's opening → pulls it down out of sight → doors close.        ≈3.25s
//  unjam:    doors open → arm rises holding a stuck alien → sets it down beside the opening →
//            lifts off → crouches low behind it → swings the forearm 360° around the elbow, booting
//            the alien in the rump on the way through and following through to straight up →
//            retracts → doors close.                                                  ≈3.4s
const ARM_JOBS = {
  retrieve: {steps:['wait','open','rise','reach','grip','carry','lower','close'],
             dur:{wait:0.35, open:0.3, rise:0.3, reach:0.5, grip:0.2, carry:0.7, lower:0.6, close:0.3}},
  unjam:    {steps:['wait','open','rise','place','release','crouch','swing','retract','sink','close'],
             dur:{wait:0.15, open:0.3, rise:0.35, place:0.45, release:0.15, crouch:0.22, swing:0.75, retract:0.28, sink:0.35, close:0.3}},
  // abduct: doors open → arm rises → reaches out to an alien walking the near track → grabs its
  //         head → hauls it back over the opening → pulls it down out of sight → doors close.  ≈2.9s
  abduct:   {steps:['wait','open','rise','reach','grip','carry','lower','close'],
             dur:{wait:0.1, open:0.3, rise:0.3, reach:0.55, grip:0.2, carry:0.55, lower:0.55, close:0.3}},
};
const SLOT_DOOR_DUR = 0.3, SLOT_RISE_DUR = 0.6;
// When a slot's doors open, 10% of the time an off-screen alien is "borrowed" to peek up through
// the opening for a bit before the barrel comes up. It just watches; its off-screen timer is paused.
const SLOT_PEEK_CHANCE = 0.10;
const SLOT_PEEK_IN = 0.35, SLOT_PEEK_HOLD = 1.9, SLOT_PEEK_OUT = 0.35;
const SLOT_PEEK_DUR = SLOT_PEEK_IN + SLOT_PEEK_HOLD + SLOT_PEEK_OUT;
function peekCandidates(){
  return state.aliens.filter(a=> a.state==='settled' && a.walkPhase==='gap' && !a.borrowed && !alienInStack(a));
}
function startSlotPeek(b){
  const c=peekCandidates();
  if(!c.length || Math.random()>=SLOT_PEEK_CHANCE) return;
  const a=choice(c);
  a.borrowed=true;
  b.peek={alien:a, t:0};
}
function endSlotPeek(b){
  if(b.peek){ b.peek.alien.borrowed=false; b.peek=null; }
}
// 0..1 how far the peeking head is up out of the opening.
function slotPeekAmount(b){
  if(!b.peek) return 0;
  const t=b.peek.t;
  if(t<SLOT_PEEK_IN) return smooth01(t/SLOT_PEEK_IN);
  if(t<SLOT_PEEK_IN+SLOT_PEEK_HOLD) return 1;
  return 1-smooth01(clamp((t-SLOT_PEEK_IN-SLOT_PEEK_HOLD)/SLOT_PEEK_OUT,0,1));
}
const BARREL_RESPAWN_DELAY = 0.7; // after a mismatch blows a barrel up, before its replacement starts rising
const smooth01 = u => u*u*(3-2*u);

const ALIEN_JAM_CHANCE = 0.10;
const ALIEN_JAM_MESSAGES = ["Little help here?", "It's cramped in there!", "Which way's the exit?", "I was just looking!"];
const ALIEN_KICK_MESSAGES = ["Rude!", "Was it something I said?", "I'll be baaack!", "Worth it!"];
// Near-track abduction. The roll happens off-screen (at the gap checkpoint): a marked alien is
// grabbed by the arm when it next walks past one of two markers on track 1, mirrored about the
// arm's opening (the first one it reaches while the arm is free; if the arm is still busy at both,
// it stays marked and tries again next pass). Marked aliens skip stacking, hiding and jamming.
const ALIEN_ABDUCT_CHANCE = 0.10;
const ALIEN_ABDUCT_MESSAGES = ["Hey! Put me down!", "Wheee!", "Where are we going?", "Unhand me!", "Not again!"];
function abductCheckpoints(){
  const d = Math.min(W*0.19, 150)*0.5;   // between the front-row barrels, well within the arm's reach
  return [layout.armHole.x - d, layout.armHole.x + d];
}
function maybeMarkAbduct(a){
  if(alienInStack(a) || a.abductMarked || Math.random()>=ALIEN_ABDUCT_CHANCE) return false;
  a.abductMarked = true;
  return true;
}
// Called as a track-1 walker moves from prevX to a.baseX: a marked alien crossing a marker
// while the arm is free gets grabbed.
function maybeTriggerAbduct(a, prevX){
  if(!a.abductMarked || state.phase!=='playing' || state.breaching || alienInStack(a) || !armIdle()) return false;
  for(const px of abductCheckpoints()){
    if(prevX!==a.baseX && (prevX-px)*(a.baseX-px)<=0){
      state.arm.queue.push({type:'abduct', alien:a});
      return true;
    }
  }
  return false;
}
// Anyone the arm is holding when a job is torn down (reboot/level reset) is put back off-screen.
function releaseArmAlien(a){
  if(!a || (a.state!=='jammed' && a.state!=='abducted')) return;
  // It's about to jump off-screen: whatever it was saying stays put where it was said, rather
  // than snapping across to the screen edge with it.
  if(a.bubbleT>0) a.bubbleAt = {x:a.x, y:a.y - a.size*a.scale - 12};
  a.state='settled'; a.walkPhase='gap'; a.waitTimer=ALIEN_TRACK_GAP_SECONDS; a.track=1;
  a.x=a.baseX = a.walksReverse ? -ALIEN_TRACK_EDGE_MARGIN*3 : W + ALIEN_TRACK_EDGE_MARGIN*3;
}

function resetArm(){
  const arm=state.arm;
  for(const it of arm.queue.concat(arm.job ? [arm.job] : [])) releaseArmAlien(it.alien);
  arm.queue=[]; arm.job=null; arm.door=0; arm.carrying=-1; arm.wrist=null; arm.side=1;
  arm.fk=null;
  arm.shY=armHiddenShY();
}
function queueArmRetrieval(idx){
  const arm=state.arm;
  const dup = it => it.type==='retrieve' && it.idx===idx;
  if(!arm.queue.some(dup) && !(arm.job && dup(arm.job))) arm.queue.push({type:'retrieve', idx});
}
function armIdle(){ return !state.arm.job && state.arm.queue.length===0; }
// The shoulder rides on a telescoping mast. Whenever the arm passes through the opening it is
// straightened into a near-vertical column so the elbow never sweeps through the floor.
const ARM_STRAIGHT = 1.9; // shoulder→wrist distance (in segment lengths) for the column pose
function armShoulder(){ return {x:layout.armHole.x, y:state.arm.shY}; }
function armColumnWrist(sh){ return {x:sh.x, y:sh.y - layout.armSeg*ARM_STRAIGHT}; }
function armUpShY(){ return layout.armHole.y - layout.armMast; }           // mast fully extended
function armColumnShY(){ return armCarryWrist().y + layout.armSeg*ARM_STRAIGHT; } // column, wrist at carry height
function armSinkDepth(){ return layout.barrelH + layout.barrelR*1.5; }      // far enough to hide barrel + arm
function armHiddenShY(){ return armColumnShY() + armSinkDepth(); }
// Wrist position with the barrel hanging just above the arm's opening.
function armCarryWrist(){
  const h=layout.armHole;
  return armGrabWrist({x:h.x, y:h.y - layout.barrelR*0.4});
}
// Two-bone IK. `side` keeps the elbow on one consistent side of the shoulder→wrist line
// for a whole job so it never flips mid-motion. Returns the reachable wrist too.
function armSolve(sh, target, side){
  const L=layout.armSeg;
  const dx=target.x-sh.x, dy=target.y-sh.y;
  const raw=Math.hypot(dx,dy);
  const d=clamp(raw, 1e-3, 2*L*0.999);
  const base=Math.atan2(dy,dx), off=Math.acos(d/(2*L));
  const ang=base + side*off;
  const elbow={x:sh.x+Math.cos(ang)*L, y:sh.y+Math.sin(ang)*L};
  const wrist={x:sh.x+Math.cos(base)*d, y:sh.y+Math.sin(base)*d};
  return {elbow, wrist};
}
// Current arm pose. Normally IK toward arm.wrist; arm.fk overrides with an explicit
// elbow/wrist (used while crouching, swinging around a fixed elbow, and recovering).
function armPose(){
  const arm=state.arm, sh=armShoulder();
  if(arm.fk) return {sh, elbow:arm.fk.elbow, wrist:arm.fk.wrist};
  const s=armSolve(sh, arm.wrist||armColumnWrist(sh), arm.side);
  return {sh, elbow:s.elbow, wrist:s.wrist};
}

// --- jammed aliens ---
// Perspective scale for something standing at screen y on the bay floor (same rule as falling objects).
function floorScaleAt(y){
  const pTop = layout.iris.cy - layout.iris.r*0.2, pBottom = layout.floorBottom;
  return lerp(0.62, 1.7, clamp((y-pTop)/(pBottom-pTop), 0, 1));
}
// Off-screen checkpoint roll: the alien wanders into the robot arm's compartment and gets stuck.
function maybeTriggerJam(a){
  if(alienInStack(a) || Math.random()>=ALIEN_JAM_CHANCE) return false;
  a.state = 'jammed';
  a.walkPhase = null;
  a.x = a.baseX = layout.armHole.x; a.y = a.baseY = layout.armHole.y + layout.barrelH; // down in the hole
  state.arm.queue.push({type:'unjam', alien:a});
  return true;
}
// Where the stuck alien hangs from the wrist magnet.
function jamAlienHang(a, wrist){
  const sc=floorScaleAt(wrist.y);
  return {x:wrist.x, y:wrist.y + a.size*sc*1.05, scale:sc};
}
// Spot on the floor beside the opening where the arm sets the alien down.
function jamSetDownSpot(a, side){
  const h=layout.armHole;
  const y=h.y - a.size*0.4;
  const sc=floorScaleAt(y);
  return {x:h.x + side*(h.rx + a.size*sc*0.9 + 4), y, scale:sc};
}
// Boot the alien in an arc that lands past the screen edge on its side, then it rejoins the
// normal off-screen gap and wanders back in later.
function kickJammedAlien(a, side){
  a.state='falling';
  a.kicked=true; a.fallToTrack2=false; a.walkPhase=null;
  a.walksReverse = side<0;   // landing off the left edge → next pass comes from the left, like track 1 does
  const g=420, vy=-rand(330,400);
  const floorY = layout.floorBottom - a.size*0.4;
  const t = (-vy + Math.sqrt(vy*vy + 2*g*Math.max(0, floorY-a.y)))/g;
  const target = side>0 ? W + ALIEN_TRACK_EDGE_MARGIN + a.size*1.7*2 : -ALIEN_TRACK_EDGE_MARGIN - a.size*1.7*2;
  a.fvy = vy;
  a.fvx = (target - a.x)/t * rand(1.05,1.25);
  a.message = choice(ALIEN_KICK_MESSAGES);
  a.bubbleT = 3;
  AudioEngine.eject();
}

function startArmJob(item){
  const arm=state.arm;
  arm.job={...item, step:'wait', t:0};
  arm.fk=null;
  // Start parked straight down below the closed doors, so nothing pokes up before they open.
  arm.shY=armHiddenShY(); arm.wrist=armColumnWrist(armShoulder());
  if(item.type==='unjam'){
    const a=item.alien, p=jamAlienHang(a, arm.wrist);
    a.x=a.baseX=p.x; a.y=a.baseY=p.y; a.scale=a.targetScale=p.scale;
  }
  if(item.type==='abduct'){
    arm.side = item.alien.x < layout.armHole.x ? 1 : -1;
  } else if(item.type==='retrieve'){
    // Elbow up: for a barrel left of the opening that's the +offset solution, right is −offset.
    arm.side = layout.barrels4[item.idx].x < layout.armHole.x ? 1 : -1;
  } else {
    arm.job.placeSide = Math.random()<0.5 ? -1 : 1;  // roll: set the alien down left or right
    arm.side = arm.job.placeSide<0 ? 1 : -1;
  }
}
function advanceArmStep(job){
  const steps=ARM_JOBS[job.type].steps;
  const i=steps.indexOf(job.step);
  job.t=0;
  job.step = steps[i+1] || 'done';
  const s=job.step, d=ARM_JOBS[job.type].dur[s];
  if(s==='open' || s==='close') AudioEngine.servo(140, s==='open'?220:110, d);
  else if(s==='rise' || s==='reach' || s==='carry' || s==='place' || s==='retract') AudioEngine.servo(90, 170, d);
  else if(s==='swing') AudioEngine.servo(120, 320, d);
  else if(s==='lower' || s==='sink') AudioEngine.servo(170, 70, d);
  if(s==='open' || s==='close'){
    const h=layout.armHole;
    maybeSpark(h.x, h.y, -Math.PI/2);
  } else if(s!=='done' && d>0.2){
    // off whichever joint is up out of the floor
    const p=armPose(), joints=[p.elbow, p.wrist, p.sh].filter(j=>j.y < layout.armHole.y);
    if(joints.length){ const j=choice(joints); maybeSpark(j.x, j.y); }
  }
}
function updateArm(dt){
  const arm=state.arm;
  if(!arm.job && arm.queue.length) startArmJob(arm.queue.shift());
  const job=arm.job;
  if(!job){ arm.wrist=null; return; }
  job.t+=dt;
  const u=clamp(job.t/ARM_JOBS[job.type].dur[job.step],0,1), e=smooth01(u);
  if(job.type==='retrieve') updateRetrieveJob(arm, job, u, e);
  else if(job.type==='abduct') updateAbductJob(arm, job, u, e);
  else updateUnjamJob(arm, job, u, e);
  if(u>=1) advanceArmStep(job);
  if(job.step==='done'){ arm.job=null; arm.door=0; arm.shY=armHiddenShY(); arm.wrist=null; arm.fk=null; }
}
function updateRetrieveJob(arm, job, u, e){
  const R=layout.barrelR;
  const anchor=layout.barrels4[job.idx];
  switch(job.step){
    case 'wait': break;
    case 'open': arm.door=e; break;
    case 'rise': arm.shY=lerp(armHiddenShY(), armColumnShY(), e); arm.wrist=armColumnWrist(armShoulder()); break;
    case 'reach': {
      arm.shY=lerp(armColumnShY(), armUpShY(), e);
      const from=armCarryWrist(), to=armGrabWrist(anchor);
      arm.wrist={x:lerp(from.x,to.x,e), y:lerp(from.y,to.y,e) - Math.sin(Math.PI*u)*R*0.6};
      break;
    }
    case 'grip':
      arm.wrist=armGrabWrist(anchor);
      if(u>=1){ state.barrels[job.idx].status='carried'; arm.carrying=job.idx; AudioEngine.uiBlip(180); }
      break;
    case 'carry': {
      arm.shY=lerp(armUpShY(), armColumnShY(), e);
      const from=armGrabWrist(anchor), to=armCarryWrist();
      arm.wrist={x:lerp(from.x,to.x,e), y:lerp(from.y,to.y,e) - Math.sin(Math.PI*u)*R*1.4};
      break;
    }
    case 'lower': {
      const d=armSinkDepth()*e, from=armCarryWrist();
      arm.shY=armColumnShY()+d;
      arm.wrist={x:from.x, y:from.y+d};
      if(u>=1){ state.barrels[job.idx].status='gone'; arm.carrying=-1; }
      break;
    }
    case 'close': arm.door=1-e; break;
  }
}
// Where the wrist magnet meets the top of a walking alien's head.
function alienGrabWrist(a){ return {x:a.x, y:a.y - a.size*a.scale*1.05}; }
function updateAbductJob(arm, job, u, e){
  const a=job.alien, R=layout.barrelR;
  // Still reachable? If the player tractor-grabbed it (or it otherwise left the near track) before
  // the magnet caught it, the arm gives up and goes home empty.
  const free = () => a.state==='settled' && a.walkPhase==='track1';
  // Carried: hang from the magnet, scaled for depth relative to where it was grabbed.
  const hang = () => {
    const w=armPose().wrist, sc=job.grabScale*floorScaleAt(w.y)/job.grabFloorSc;
    a.x=a.baseX=w.x; a.y=a.baseY=w.y + a.size*sc*1.05; a.scale=a.targetScale=sc;
  };
  switch(job.step){
    case 'wait': break;
    case 'open': arm.door=e; break;
    case 'rise': arm.shY=lerp(armHiddenShY(), armColumnShY(), e); arm.wrist=armColumnWrist(armShoulder()); break;
    case 'reach': {
      arm.shY=lerp(armColumnShY(), armUpShY(), e);
      if(!job.missed && !free()) job.missed=true;
      const from=armCarryWrist(), to = job.missed ? from : alienGrabWrist(a);   // tracks the walker live
      arm.wrist={x:lerp(from.x,to.x,e), y:lerp(from.y,to.y,e) - Math.sin(Math.PI*u)*R*0.8};
      break;
    }
    case 'grip':
      if(!job.missed && !free()) job.missed=true;
      if(!job.missed){
        arm.wrist=alienGrabWrist(a);
        if(u>=1){
          a.state='abducted'; a.walkPhase=null; a.fvx=a.fvy=0; a.abductMarked=false;
          a.message=choice(ALIEN_ABDUCT_MESSAGES); a.bubbleT=3;
          job.grabScale=a.scale; job.grabFloorSc=floorScaleAt(arm.wrist.y);
          AudioEngine.uiBlip(180);
        }
      }
      if(u>=1) job.carryFrom={...arm.wrist};
      break;
    case 'carry': {
      arm.shY=lerp(armUpShY(), armColumnShY(), e);
      const from=job.carryFrom, to=armCarryWrist();
      arm.wrist={x:lerp(from.x,to.x,e), y:lerp(from.y,to.y,e) - Math.sin(Math.PI*u)*R*1.4};
      if(a.state==='abducted') hang();
      break;
    }
    case 'lower': {
      const d=armSinkDepth()*e, from=armCarryWrist();
      arm.shY=armColumnShY()+d;
      arm.wrist={x:from.x, y:from.y+d};
      if(a.state==='abducted'){
        hang();
        // Gone below: carry on exactly as if it had just walked off the end of track 1.
        if(u>=1){ releaseArmAlien(a); a.scale=a.targetScale=ALIEN_TRACK1_SCALE; }
      }
      break;
    }
    case 'close': arm.door=1-e; break;
  }
}
function updateUnjamJob(arm, job, u, e){
  const a=job.alien, R=layout.barrelR, L=layout.armSeg;
  const side=job.placeSide;
  // Keep the alien glued to the magnet while it's being carried.
  const hang = () => { const w=armPose().wrist, p=jamAlienHang(a, w); a.x=a.baseX=p.x; a.y=a.baseY=p.y; a.scale=a.targetScale=p.scale; };
  switch(job.step){
    case 'wait': break;
    case 'open': arm.door=e; break;
    case 'rise':
      if(job.t<=1/30){ a.message=choice(ALIEN_JAM_MESSAGES); a.bubbleT=3; }
      arm.shY=lerp(armHiddenShY(), armColumnShY(), e); arm.wrist=armColumnWrist(armShoulder());
      hang();
      break;
    case 'place': {
      arm.shY=lerp(armColumnShY(), armUpShY(), e);
      const spot=jamSetDownSpot(a, side);
      const to={x:spot.x, y:spot.y - a.size*spot.scale*1.05};
      const from=armCarryWrist();
      arm.wrist={x:lerp(from.x,to.x,e), y:lerp(from.y,to.y,e) - Math.sin(Math.PI*u)*R*1.0};
      hang();
      if(u>=1){ a.x=a.baseX=spot.x; a.y=a.baseY=spot.y; a.scale=a.targetScale=spot.scale; }
      break;
    }
    case 'release': {
      // magnet off; the arm lifts clear of the alien's head
      const spot=jamSetDownSpot(a, side);
      const base={x:spot.x, y:spot.y - a.size*spot.scale*1.05};
      arm.wrist={x:base.x, y:base.y - R*0.8*e};
      a.y = a.baseY + Math.sin(state.t*1.4+a.phase)*1.5;
      if(u>=1){
        const p=armPose();
        job.fromPose={shY:arm.shY, elbow:p.elbow, wrist:p.wrist};
        // Crouch target: elbow directly over the opening, up-and-behind the alien's rump, so the
        // forearm (pointing down-and-outward) lands on the rump while sweeping outward and up, and
        // the low part of the swing dips into the open hole rather than through the floor.
        const sc=a.scale, rump={x:a.x - side*a.size*sc*0.45, y:a.y + a.size*sc*0.5};
        const hx=layout.armHole.x;
        job.kickAng = Math.acos(clamp((rump.x - hx)/L, -0.9, 0.9));   // 0..π, below horizontal
        const E={x:rump.x - Math.cos(job.kickAng)*L, y:rump.y - Math.sin(job.kickAng)*L};
        const dx=Math.min(Math.abs(E.x-layout.armHole.x), L*0.95);
        job.elbow=E;
        job.crouchShY = E.y + Math.sqrt(L*L - dx*dx);   // mast drops so the shoulder→elbow segment fits
        job.spin = side>0 ? -1 : 1;                      // outward-and-up through the kick point
        // fraction of the full turn (starting straight up) at which the wrist reaches the rump
        job.kickFrac = (side>0 ? (1.5*Math.PI - job.kickAng) : (job.kickAng + 0.5*Math.PI)) / TAU;
      }
      break;
    }
    case 'crouch': {
      // lower the whole arm into the wind-up pose: elbow behind the alien, forearm straight up
      const f=job.fromPose, E=job.elbow, W={x:E.x, y:E.y-L};
      arm.shY=lerp(f.shY, job.crouchShY, e);
      arm.fk={elbow:{x:lerp(f.elbow.x,E.x,e), y:lerp(f.elbow.y,E.y,e)},
              wrist:{x:lerp(f.wrist.x,W.x,e), y:lerp(f.wrist.y,W.y,e)}};
      break;
    }
    case 'swing': {
      // one full turn from straight up, through the rump, back to straight up
      const E=job.elbow, ang=-Math.PI/2 + job.spin*TAU*e;
      arm.fk={elbow:E, wrist:{x:E.x+Math.cos(ang)*L, y:E.y+Math.sin(ang)*L}};
      if(!job.kicked && e>=job.kickFrac){ job.kicked=true; kickJammedAlien(a, side); }
      if(u>=1){
        job.fromPose={shY:arm.shY, elbow:E, wrist:{x:E.x, y:E.y-L}};
        const sh0=arm.shY; arm.shY=armColumnShY(); arm.fk=null;
        const endPose=armSolve(armShoulder(), armCarryWrist(), arm.side);
        job.toPose={shY:arm.shY, elbow:endPose.elbow, wrist:endPose.wrist};
        arm.shY=sh0; arm.fk=job.fromPose;
      }
      break;
    }
    case 'retract': {
      // blend from the follow-through pose back to the column pose, then IK takes over for the sink
      const f=job.fromPose, t=job.toPose;
      arm.shY=lerp(f.shY, t.shY, e);
      arm.fk={elbow:{x:lerp(f.elbow.x,t.elbow.x,e), y:lerp(f.elbow.y,t.elbow.y,e)},
              wrist:{x:lerp(f.wrist.x,t.wrist.x,e), y:lerp(f.wrist.y,t.wrist.y,e)}};
      if(u>=1){ arm.fk=null; arm.wrist=armCarryWrist(); }
      break;
    }
    case 'sink': {
      const d=armSinkDepth()*e, from=armCarryWrist();
      arm.shY=armColumnShY()+d;
      arm.wrist={x:from.x, y:from.y+d};
      break;
    }
    case 'close': arm.door=1-e; break;
  }
}
function barrelRiseOffset(b){
  if(b.status!=='rising') return 0;
  const u=clamp((b.riseT-SLOT_DOOR_DUR)/SLOT_RISE_DUR,0,1);
  return (1-smooth01(u))*(layout.barrelH + layout.barrelR);
}
function updateBarrelSlots(dt){
  state.barrels.forEach(b=>{
    // hologram: on while the barrel stands ready in its slot
    b.holo = b.status==='ready' ? Math.min(1,(b.holo||0)+dt/0.35) : Math.max(0,(b.holo||0)-dt/0.2);
    if(b.status==='destroyed'){
      b.destroyT-=dt;
      if(b.destroyT<=0){ b.status='rising'; b.riseT=0; }
    }
    if(b.status==='rising'){
      if(b.riseT===0){
        startSlotPeek(b); AudioEngine.servo(80, 160, b.peek ? SLOT_DOOR_DUR : SLOT_DOOR_DUR+SLOT_RISE_DUR);
        const h=layout.barrelHoles[state.barrels.indexOf(b)];
        maybeSpark(h.x + h.rx*rand(-0.8,0.8), h.y, -Math.PI/2);
      }
      if(b.peek && !state.aliens.includes(b.peek.alien)) endSlotPeek(b);
      if(b.peek && b.riseT>=SLOT_DOOR_DUR){
        // doors are open: hold the barrel down below while the borrowed alien has its look
        b.peek.t+=dt;
        if(b.peek.t>=SLOT_PEEK_DUR){ endSlotPeek(b); AudioEngine.servo(100, 160, SLOT_RISE_DUR); }
        return;
      }
      b.riseT+=dt;
      b.door=clamp(b.riseT/SLOT_DOOR_DUR,0,1);
      if(b.riseT>=SLOT_DOOR_DUR+SLOT_RISE_DUR){
        b.status='ready'; // usable now; doors close underneath it
        const h=layout.barrelHoles[state.barrels.indexOf(b)];
        maybeSpark(h.x + h.rx*choice([-1,1]), h.y);
      }
    } else if(b.door>0){
      b.door=Math.max(0, b.door-dt/SLOT_DOOR_DUR);
    }
  });
}

function removeRock(r){
  const i=state.rocks.indexOf(r);
  if(i>=0) state.rocks.splice(i,1);
}

function beginLevelTransition(){
  state.phase='transition';
  state.transition={step:'closing', t:0};
  state.irisTarget=0;
  dropClimbingAliens();
  AudioEngine.sealHum();
  toast('SORTING CYCLE COMPLETE','Engaging transit drive — closing outer iris','good',2000);
}
function updateTransition(dt){
  const tr=state.transition;
  tr.t+=dt;
  if(tr.step==='closing'){
    state.shake = Math.max(state.shake, 4);
    if(state.irisOpen<0.02 && tr.t>0.6){
      tr.step='travel'; tr.t=0;
      state.nebulaHue = (state.nebulaHue + rand(70,160))%360;
      state.nebulaBlobs = makeNebula(state.nebulaHue);
      state.stars = makeStars();
    }
  } else if(tr.step==='travel'){
    state.shake = Math.max(state.shake*0.9, reducedMotion?0:3);
    if(tr.t>1.0){
      tr.step='opening'; tr.t=0;
      state.irisTarget=1;
      toast('ARRIVING AT SECTOR '+String(state.sector+1).padStart(2,'0'),'New mineral field detected','info',1800);
      startLevel(state.sector+1, true);
    }
  } else if(tr.step==='opening'){
    if(state.irisOpen>0.97 && tr.t>0.4){
      state.phase='playing';
      state.transition=null;
    }
  }
}

let lastT=performance.now();
function update(){
  const now=performance.now();
  let dt=(now-lastT)/1000; lastT=now;
  dt=Math.min(dt,0.05);
  state.t+=dt;

  state.irisOpen = lerp(state.irisOpen, state.irisTarget, Math.min(1, dt*2.4));

  if(state.phase==='playing'){
    state.spawnTimer -= dt;
    if(state.spawnTimer<=0){ trySpawnRandom(); state.spawnTimer = rand(0.7,1.3); }
  }
  if(state.phase==='transition' && state.transition){ updateTransition(dt); }
  SaveGame.tick(dt);

  updateArm(dt);
  updateBarrelSlots(dt);
  updateChute(dt);
  updateIrisSparks(dt);
  updateRumble(dt);
  // Sector change only once the arm has hauled away all four barrels.
  if(state.phase==='playing' && !state.breaching && armIdle() &&
     state.barrels.every(b=>b.status==='gone')){
    beginLevelTransition();
  }

  const sc=layout.spawnCircle;
  for(const r of state.rocks){
    r.rot += r.rotSpeed*dt;
    if(r.state==='floating'){
      r.baseX += r.vx*dt; r.baseY += r.vy*dt;
      const dx=r.baseX-sc.cx, dy=r.baseY-sc.cy;
      const dist=Math.hypot(dx,dy);
      if(dist > sc.r){
        const nx=dx/(dist||1), ny=dy/(dist||1);
        const dot = r.vx*nx + r.vy*ny;
        r.vx -= 2*dot*nx; r.vy -= 2*dot*ny;
        r.baseX = sc.cx + nx*sc.r; r.baseY = sc.cy + ny*sc.r;
      }
      r.x = r.baseX + Math.sin(state.t*r.freq+r.phase)*r.amp*0.4;
      r.y = r.baseY + Math.cos(state.t*r.freq*0.8+r.phase)*r.amp*0.5;
      r.scale = lerp(r.scale, r.targetScale, Math.min(1,dt*3));
    } else if(r.state==='held'){
      r.scale = lerp(r.scale, r.targetScale, Math.min(1,dt*8));
    } else if(r.state==='falling'){
      const res = stepFallingBody(r, dt);
      r.rot += (r.fvx/r.size)*dt*0.6;   // tumbles in the direction it's flying / rolling
      if(res==='rest'){
        r.state='settled'; r.baseX=r.x; r.baseY=r.y;
      } else if(res){
        r.state='gone';   // went over the edge: unloaded
      }
    } else if(r.state==='settled'){
      r.x = r.baseX;
      r.y = r.baseY + Math.sin(state.t*1.4+r.phase)*1.5;
    } else if(r.state==='carried'){
      const a = r.carrier;
      if(!a || a.carrying!==r || a.state!=='settled' || a.walkPhase!=='track1'){
        // Its carrier was grabbed, beamed up or otherwise interrupted: the rock drops where it is.
        if(a && a.carrying===r) a.carrying = null;
        r.carrier = null;
        r.state = 'falling'; r.fvx = 0; r.fvy = 0;
      } else {
        r.liftT = Math.min(1, r.liftT + dt/ALIEN_CARRY_LIFT_SECONDS);
        const spot = carriedRockSpot(r, a), u = r.liftT;
        const e = u*u*(3-2*u);
        r.x = lerp(r.liftFrom.x, spot.x, e);
        r.y = lerp(r.liftFrom.y, spot.y, e) - Math.sin(u*Math.PI)*a.size*a.scale*0.6;
        // balancing: a slow wobble that tips toward the direction of travel
        r.rot += Math.sin(state.t*2.1 + r.phase)*dt*0.6;
      }
    } else if(r.state==='ejected'){
      r.x += r.evx*dt; r.y += r.evy*dt;
      r.evx *= 1.01; r.evy = r.evy*1.01 - 26*dt;
      r.opacity = clamp(r.opacity-dt*0.55,0,1);
      r.scale = Math.max(0.05, r.scale - dt*0.5);
    }
  }
  state.rocks = state.rocks.filter(r=> !(r.state==='ejected' && (r.opacity<=0.03 || r.scale<=0.06)) && r.state!=='gone');

  for(const a of state.aliens){
    if(a.state==='floating'){
      a.baseX += a.vx*dt; a.baseY += a.vy*dt;
      const dx=a.baseX-sc.cx, dy=a.baseY-sc.cy;
      const dist=Math.hypot(dx,dy);
      if(dist > sc.r){
        const nx=dx/(dist||1), ny=dy/(dist||1);
        const dot = a.vx*nx + a.vy*ny;
        a.vx -= 2*dot*nx; a.vy -= 2*dot*ny;
        a.baseX = sc.cx + nx*sc.r; a.baseY = sc.cy + ny*sc.r;
      }
      a.x = a.baseX + Math.sin(state.t*a.freq+a.phase)*a.amp*0.4;
      a.y = a.baseY + Math.cos(state.t*a.freq*0.8+a.phase)*a.amp*0.5;
      a.scale = lerp(a.scale, a.targetScale, Math.min(1,dt*3));
    } else if(a.state==='held'){
      a.scale = lerp(a.scale, a.targetScale, Math.min(1,dt*8));
    } else if(a.state==='falling'){
      a.fvy = (a.fvy||0) + 420*dt;
      a.y += a.fvy*dt;
      a.x += (a.fvx||0)*dt;
      if(a.fallToTrack2){
        // Shaken off the iris ring: it's at far-track depth, so no perspective growth,
        // and it lands back on track 2 rather than the near floor.
        if(a.y>=layout.floorTop){
          a.y=layout.floorTop; a.fvy=0; a.fvx=0; a.state='settled';
          a.baseX=a.x; a.baseY=a.y;
          a.fallToTrack2 = false;
          a.tumbled = false;
          a.walkPhase = 'track2';
          a.track = 2;
          a.climbRolled = true; // already dealt with the ring this pass
        }
      } else if(a.kicked){
        // Booted out by the robot arm: free arc (no clamping to the bay) that lands off-screen.
        a.scale = a.targetScale = floorScaleAt(a.y);
        const floorY = layout.floorBottom - a.size*0.4;
        if(a.fvy>0 && a.y>=floorY){
          a.y=floorY; a.fvy=0; a.fvx=0; a.kicked=false; a.state='settled';
          a.baseX=a.x; a.baseY=a.y;
          a.track=1; a.targetScale=ALIEN_TRACK1_SCALE;
          const off = a.x < -ALIEN_TRACK_EDGE_MARGIN || a.x > W + ALIEN_TRACK_EDGE_MARGIN;
          if(off){ a.walkPhase='gap'; a.waitTimer=ALIEN_TRACK_GAP_SECONDS; }
          else a.walkPhase='track1';
        }
      } else {
      const res = stepFallingBody(a, dt);
      if(res===-1 || res===1){
        alienFellOffEdge(a, res);
      } else if(res==='rest'){
        a.state='settled'; a.baseX=a.x; a.baseY=a.y;
        if(a.fixitMode){
          a.fixitMode = false;
          a.message = choice(ALIEN_FIXIT_MESSAGES);
          a.bubbleT = 3.5;
          a.walkPhase = 'track1';
          a.track = 1;
          a.targetScale = ALIEN_TRACK1_SCALE;
        } else if(a.hideJumpOut){
          a.hideJumpOut = false;
          a.message = choice(ALIEN_HIDE_MESSAGES);
          a.bubbleT = 3;
          a.walkPhase = 'track1';
          a.track = 1;
          a.targetScale = ALIEN_TRACK1_SCALE;
        } else {
          if(a.tumbled){
            a.tumbled = false; // already shouted on the way down
          } else if(!a.greeted){
            a.message = choice(ALIEN_MESSAGES);
            a.bubbleT = 3.5;
            a.greeted = true;
          } else {
            a.message = choice(ALIEN_REDROP_MESSAGES);
            a.bubbleT = 3;
          }
          // Every landing (first drop, or re-drop after being re-grabbed) starts a fresh walk on track 1.
          a.walkPhase = 'track1';
          a.track = 1;
          a.targetScale = ALIEN_TRACK1_SCALE;
        }
      }
      }
    } else if(a.state==='settled'){
      if(a.walkPhase==='track1'){
        a.scale = lerp(a.scale, a.targetScale, Math.min(1,dt*3));
        const prevX = a.baseX;
        a.baseX += alienWalkStep(a, ALIEN_TRACK1_SPEED, dt)*(a.walksReverse?-1:1);
        a.baseY = layout.floorBottom - a.size*0.4;
        a.x = a.baseX;
        a.y = a.baseY + Math.sin(state.t*1.4+a.phase)*1.5;
        updateComplaint(a, prevX);
        maybeTriggerAbduct(a, prevX);

        if(a.carrying && !state.rocks.includes(a.carrying)) a.carrying = null;   // cleared by a sector reset
        // Each rock it passes gets one roll; a tower's base already has a rider on its head.
        if(!a.carrying && !a.rider){
          const rolled = a.rocksRolled || (a.rocksRolled = new WeakSet());
          const nearRock = state.rocks.find(rk=> rk.state==='settled' && !rolled.has(rk) &&
            Math.abs(rk.x-a.x) < (a.size*a.scale + rk.size*rk.scale)*0.85);
          if(nearRock){
            rolled.add(nearRock);
            const roll = Math.random();
            if(roll < ALIEN_KICK_ROCK_CHANCE){
              // Booted forward along the floor: it hops, bounces and skids, still fully sortable.
              const dir = a.walksReverse ? -1 : 1;
              nearRock.state = 'falling';
              nearRock.fvx = dir*rand(180,380);
              nearRock.fvy = -rand(120,220);
              AudioEngine.eject();
              spawnEjectSpark(nearRock.x - dir*nearRock.size*0.5, nearRock.y+4);
              a.message = choice(ALIEN_KICK_ROCK_MESSAGES);
              a.bubbleT = 3;
            } else if(roll < ALIEN_KICK_ROCK_CHANCE + ALIEN_CARRY_CHANCE){
              a.carrying = nearRock;
              nearRock.state = 'carried';
              nearRock.carrier = a;
              nearRock.liftT = 0;
              nearRock.liftFrom = {x:nearRock.x, y:nearRock.y};
              a.message = choice(ALIEN_CARRY_MESSAGES);
              a.bubbleT = 3.5;
            }
          }
        }

        const track1Exited = a.walksReverse
          ? (a.baseX + a.size*a.scale < -ALIEN_TRACK_EDGE_MARGIN)
          : (a.baseX - a.size*a.scale > W + ALIEN_TRACK_EDGE_MARGIN);
        if(track1Exited){
          if(a.carrying){ a.carrying.state='gone'; a.carrying=null; }   // carried off the edge: unloaded
          a.complainAtX = null; a.complainDue = false;
          a.walkPhase='gap';
          a.waitTimer = ALIEN_TRACK_GAP_SECONDS;
        }
      } else if(a.walkPhase==='gap'){
        // While borrowed to peek out of a barrel slot, the off-screen clock stands still.
        if(!a.borrowed) a.waitTimer -= dt;
        // Anyone in a tower is locked into stacking behavior: no fixit, hide or jam, but the
        // tower's base may still climb onto another off-screen alien (taking its tower along).
        // Duplication is still allowed (the newborn spawns on its own), so it's rolled for every
        // alien in the tower here, since riders never reach this checkpoint themselves.
        // An unstacked alien also rolls here for a future abduction; once marked it sits out
        // stacking, hiding and jamming (fixit and duplication still apply).
        const stacked = alienInStack(a);
        let busy = true;
        if(a.waitTimer<=0){
          if(stacked) busy = maybeTriggerStack(a);
          else {
            maybeMarkAbduct(a);
            busy = maybeTriggerFixit(a) ||
              (!a.abductMarked && (maybeTriggerHide(a) || maybeTriggerStack(a) || maybeTriggerJam(a)));
          }
        }
        if(!busy){
          for(let c=a; c; c=c.rider) maybeTriggerDuplicate(c);
          a.track = 2;
          a.walkPhase = 'track2';
          a.targetScale = ALIEN_TRACK2_SCALE;
          a.scale = ALIEN_TRACK2_SCALE;
          a.baseY = layout.floorTop;
          a.baseX = a.walksReverse
            ? -a.size*a.scale - ALIEN_TRACK_EDGE_MARGIN
            : W + a.size*a.scale + ALIEN_TRACK_EDGE_MARGIN;
          a.x = a.baseX; a.y = a.baseY;
          maybeScheduleComplaint(a, a.baseX, a.walksReverse ? W + ALIEN_TRACK_EDGE_MARGIN : -ALIEN_TRACK_EDGE_MARGIN);
          a.buttonRolled = false;
          a.leverRolled = false;
          a.climbRolled = false;
        }
      } else if(a.walkPhase==='riding'){
        // Positioned each frame by updateAlienStacks, following the alien beneath it.
      } else if(a.walkPhase==='climbing'){
        const Rc = irisClimbRadius(a);
        const dTheta = alienWalkStep(a, ALIEN_CLIMB_SPEED, dt)/Rc;
        a.climbAngle += a.climbDir*dTheta;
        a.climbProgress += dTheta;
        if(a.climbProgress >= a.climbSweep){
          finishAlienClimb(a);
        } else {
          a.x = layout.iris.cx + Math.cos(a.climbAngle)*Rc;
          a.y = layout.iris.cy + Math.sin(a.climbAngle)*Rc;
          a.baseX = a.x; a.baseY = a.y;
        }
      } else if(a.walkPhase==='hiding'){
        // waiting silently inside its chosen barrel until a rock is dropped in — see handleBarrelDrop
      } else if(a.walkPhase==='track2'){
        const prevX = a.baseX;
        a.baseX += alienWalkStep(a, ALIEN_TRACK2_SPEED, dt)*(a.walksReverse?1:-1);
        a.baseY = layout.floorTop;
        a.x = a.baseX;
        a.y = a.baseY + Math.sin(state.t*1.0+a.phase)*0.7;
        updateComplaint(a, prevX);

        if(!a.buttonRolled && Math.abs(a.baseX-layout.redButton.x) < 14){
          a.buttonRolled = true;
          if(state.irisTarget===1 && Math.random()<0.5){
            a.message = choice(ALIEN_BUTTON_MESSAGES);
            a.bubbleT = 3;
            pressRedButton();
          }
        }

        if(!a.leverRolled && Math.abs(a.baseX-layout.lever.x) < 14){
          a.leverRolled = true;
          if(Math.random()<ALIEN_LEVER_CHANCE){
            a.message = choice(ALIEN_LEVER_MESSAGES);
            a.bubbleT = 3;
            flipLever();
          }
        }

        // Reaching the near side of the iris ring: one 25% roll per pass to climb over it.
        if(!a.climbRolled && state.phase==='playing'){
          const entryDX = irisClimbEntryDX(a);
          const reached = a.walksReverse
            ? (a.baseX >= layout.iris.cx - entryDX && a.baseX < layout.iris.cx)
            : (a.baseX <= layout.iris.cx + entryDX && a.baseX > layout.iris.cx);
          if(reached){
            a.climbRolled = true;
            if(Math.random()<ALIEN_CLIMB_CHANCE){
              startAlienClimb(a);
            }
          }
        }

        const track2Exited = a.walksReverse
          ? (a.baseX - a.size*a.scale > W + ALIEN_TRACK_EDGE_MARGIN)
          : (a.baseX + a.size*a.scale < -ALIEN_TRACK_EDGE_MARGIN);
        if(track2Exited && (alienInStack(a) || !maybeTriggerFixit(a))){
          a.track = 1;
          a.walkPhase = 'track1';
          a.targetScale = ALIEN_TRACK1_SCALE;
          a.scale = ALIEN_TRACK1_SCALE;
          a.baseX = a.walksReverse
            ? W + a.size*a.scale + ALIEN_TRACK_EDGE_MARGIN
            : -a.size*a.scale - ALIEN_TRACK_EDGE_MARGIN;
          a.baseY = layout.floorBottom - a.size*0.4;
          a.x = a.baseX; a.y = a.baseY;
          maybeScheduleComplaint(a, a.baseX, a.walksReverse ? -ALIEN_TRACK_EDGE_MARGIN : W + ALIEN_TRACK_EDGE_MARGIN);
        }
      } else {
        // Landed but walk cycle not yet initialized (safety fallback) — idle bob in place.
        a.x = a.baseX;
        a.y = a.baseY + Math.sin(state.t*1.4+a.phase)*1.5;
      }
    } else if(a.state==='chute' || a.state==='launching' || a.state==='spaced'){
      updateChuteAlien(a, dt);
    } else if(a.state==='ejected'){
      a.x += a.evx*dt; a.y += a.evy*dt;
      a.evx *= 1.01; a.evy = a.evy*1.01 - 26*dt;
      a.opacity = clamp((a.opacity===undefined?1:a.opacity)-dt*0.55,0,1);
      a.scale = Math.max(0.05, a.scale - dt*0.5);
    }
    if(a.bubbleT>0) a.bubbleT = Math.max(0, a.bubbleT-dt);
    if(a.bubbleT<=0) a.bubbleAt = null;
  }
  updateAlienStacks(dt);
  state.aliens = state.aliens.filter(a=> !(a.state==='ejected' && (a.opacity<=0.03 || a.scale<=0.06)) && a.state!=='gone');

  state.barrels.forEach(b=>{
    if(b.flashT>0) b.flashT=Math.max(0,b.flashT-dt);
    if(b.sealT>0) b.sealT=Math.max(0,b.sealT-dt*0.4);
    if(state.phase==='transition'){
      b.fillDisplay = lerp(b.fillDisplay, 0, Math.min(1, dt*2.2));
    } else {
      b.fillDisplay = b.slots/5;
    }
  });

  for(const p of state.particles){
    p.life += dt;
    if(p.type==='shard'){
      p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy += 300*dt; p.vx*=0.98;
    } else if(p.type==='plate'){
      p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy += 520*dt; p.vx*=0.985; p.rot+=p.spin*dt;
    } else if(p.type==='spark'){
      p.x+=p.vx*dt; p.y+=p.vy*dt; p.vx*=0.94; p.vy*=0.94;
    } else if(p.type==='ejectRock'){
      p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy -= 40*dt;
    } else if(p.type==='zap'){
      p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy += 700*dt; p.vx*=0.985;
    }
  }
  state.particles = state.particles.filter(p=>p.life<p.maxLife);

  state.shake = Math.max(0, state.shake - dt*60);
  state.warnT = Math.max(0, state.warnT-dt);
  document.getElementById('warnFlash').classList.toggle('show', state.warnT>0);

  updateToolbar();
}

function updateToolbar(){
  const readout=document.getElementById('o2Readout');
  const repLabel=document.getElementById('repLabel');
  const idlePrompt=document.getElementById('idlePrompt');
  if(state.held && state.held.isAlien){
    if(readout.dataset.k!=='alien:'+state.held.name){
      readout.textContent = state.held.name; readout.dataset.k='alien:'+state.held.name;
      fitReadout(readout);
    }
    readout.classList.add('active');
    repLabel.textContent = 'LIFEFORM DESIGNATION';
    idlePrompt.style.display='none';
    repLabel.style.display='block';
  } else if(state.held){
    const r=state.held, key = r.rep+':'+r.text;
    if(readout.dataset.k!==key){
      const html = MODE.readoutHTML && MODE.readoutHTML(r);
      if(html) readout.innerHTML = html; else readout.textContent = r.text;
      readout.dataset.k=key;
      fitReadout(readout);
    }
    readout.classList.add('active');
    repLabel.textContent = MODE.repLabel ? MODE.repLabel(r) : '';
    idlePrompt.style.display='none';
    repLabel.style.display='block';
  } else {
    if(readout.dataset.k!==''){ readout.textContent='— — —'; readout.dataset.k=''; fitReadout(readout); }
    readout.classList.remove('active');
    repLabel.style.display='none';
    idlePrompt.style.display='block';
  }
}

// Long readings (words, alien names) shrink to fit beside the side panel instead of overflowing.
function fitReadout(el){
  el.style.fontSize='';
  const inner=document.getElementById('toolbarInner'), side=document.getElementById('toolbarSide');
  const avail = inner.clientWidth - side.offsetWidth - 22;
  const w = el.scrollWidth;
  if(w>avail && avail>0){
    const fs=parseFloat(getComputedStyle(el).fontSize);
    el.style.fontSize = Math.max(14, Math.floor(fs*avail/w))+'px';
  }
}
function drawRockList(list){
  const sorted = list.slice().sort((a,b)=>a.scale-b.scale);
  sorted.forEach(r=>{
    ctx.save();
    const op = r.opacity!==undefined? r.opacity : 1;
    ctx.globalAlpha=op;
    ctx.translate(r.x,r.y);
    ctx.rotate(r.rot);
    ctx.scale(r.scale,r.scale);

    const pal=r.pal;
    const grad=ctx.createRadialGradient(-r.size*0.3,-r.size*0.3,r.size*0.1, 0,0, r.size*1.1);
    grad.addColorStop(0,pal.b); grad.addColorStop(0.55,pal.a); grad.addColorStop(1,pal.c);
    ctx.fillStyle=grad;

    ctx.beginPath();
    r.shape.forEach((p,i)=>{
      const x=Math.cos(p.ang)*p.r, y=Math.sin(p.ang)*p.r;
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.closePath();
    ctx.fill();

    if(r.state==='held'){
      ctx.strokeStyle='rgba(91,230,217,0.9)';
      ctx.lineWidth=2/r.scale;
      ctx.shadowColor='#5be6d9'; ctx.shadowBlur=14;
      ctx.stroke();
      ctx.shadowBlur=0;
    } else {
      ctx.strokeStyle='rgba(0,0,0,0.35)';
      ctx.lineWidth=1.4/r.scale;
      ctx.stroke();
    }

    ctx.fillStyle=pal.c;
    ctx.globalAlpha=op*0.55;
    r.craters.forEach(c=>{
      const cx=Math.cos(c.ang)*c.r, cy=Math.sin(c.ang)*c.r;
      ctx.beginPath(); ctx.arc(cx,cy,c.cr,0,TAU); ctx.fill();
    });
    ctx.globalAlpha=op;

    ctx.restore();
  });
}

// A tiny, deliberately unreadable shipping label: an orange routing block, a few "text" lines and a
// barcode. Same pattern every time, so the one on a marked alien's head matches the barrels'.
const LABEL_BARS=[1,0,1,1,0,1,0,0,1,1,1,0,1,0,1,1,0,1];
function drawShippingLabel(cx, cy, w, h, rot){
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(rot||0);
  const x0=-w/2, y0=-h/2, lw=Math.max(0.5, h*0.06);
  ctx.fillStyle='#e9e3d2';
  ctx.fillRect(x0, y0, w, h);
  ctx.strokeStyle='rgba(0,0,0,0.45)'; ctx.lineWidth=lw;
  ctx.strokeRect(x0, y0, w, h);
  // routing block
  ctx.fillStyle='#e0782a';
  ctx.fillRect(x0+w*0.07, y0+h*0.1, w*0.24, h*0.32);
  // address "text"
  ctx.fillStyle='rgba(40,44,52,0.7)';
  const tl=[[0.38,0.12,0.5],[0.38,0.28,0.38],[0.07,0.5,0.62],[0.07,0.62,0.45]];
  for(const [tx,ty,tw] of tl) ctx.fillRect(x0+w*tx, y0+h*ty, w*tw, Math.max(0.6,h*0.07));
  // barcode
  const bw=w*0.86/LABEL_BARS.length, by=y0+h*0.76, bh=h*0.16;
  ctx.fillStyle='rgba(20,22,26,0.85)';
  LABEL_BARS.forEach((on,i)=>{ if(on) ctx.fillRect(x0+w*0.07+i*bw, by, bw*0.75, bh); });
  ctx.restore();
}
function drawAlienList(list){
  const sorted = list.slice().sort((a,b)=> (a.scale-b.scale) || (alienStackLevel(a)-alienStackLevel(b)));
  sorted.forEach(a=>{
    const op = a.opacity!==undefined? a.opacity : 1;
    if(op<=0) return;
    ctx.save();
    ctx.globalAlpha=op;
    ctx.translate(a.x,a.y);
    if(a.rot) ctx.rotate(a.rot);
    ctx.scale(a.scale,a.scale);
    const R=a.size;

    if(ALIEN_FACE_MODE==='gravatar'){
      if(a.avatarLoaded && a.avatarImg){
        ctx.save();
        ctx.beginPath(); ctx.arc(0,0,R*0.92,0,TAU); ctx.clip();
        ctx.drawImage(a.avatarImg, -R*0.92, -R*0.92, R*1.84, R*1.84);
        ctx.restore();
      } else if(a.avatarFailed){
        drawWavatarFace(0,0,R*0.92,a.face);
      }
    } else {
      drawWavatarFace(0,0,R*0.92,a.face);
    }

    const grad=ctx.createRadialGradient(0,0,R*0.4, 0,0,R);
    grad.addColorStop(0,'rgba(150,158,168,0)');
    grad.addColorStop(1,'rgba(150,158,168,0.92)');
    ctx.fillStyle=grad;
    ctx.beginPath(); ctx.arc(0,0,R,0,TAU); ctx.fill();

    ctx.strokeStyle='rgba(255,255,255,0.95)';
    ctx.lineWidth=2.5/a.scale;
    ctx.beginPath(); ctx.arc(0,0,R,0,TAU); ctx.stroke();

    if(a.abductMarked){
      // stuck to the side of the helmet, wrapping off its edge
      ctx.save();
      ctx.beginPath(); ctx.arc(0,0,R,0,TAU); ctx.clip();
      drawShippingLabel(R*0.62, R*0.2, R*0.56, R*0.38, 0.35);
      ctx.restore();
    }

    if(a.state==='held'){
      ctx.strokeStyle='rgba(91,230,217,0.9)';
      ctx.lineWidth=2/a.scale;
      ctx.shadowColor='#5be6d9'; ctx.shadowBlur=14;
      ctx.beginPath(); ctx.arc(0,0,R*1.06,0,TAU); ctx.stroke();
      ctx.shadowBlur=0;
    }
    ctx.restore();
  });
}
function drawSpeechBubble(x,y,text){
  ctx.font='700 13px Rajdhani, sans-serif';
  const padX=12, h=25;
  const w=ctx.measureText(text).width + padX*2;
  const bx=clamp(x-w/2, 6, Math.max(6, W-6-w)), by=y-h;
  const tx = clamp(x, bx+14, bx+w-14); // tail stays on the bubble when it's pushed in from an edge
  ctx.fillStyle='rgba(255,255,255,0.97)';
  roundRectPath(bx,by,w,h,8);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(tx-7,by+h);
  ctx.lineTo(tx+7,by+h);
  ctx.lineTo(x,by+h+9);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle='#14202a';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(text, bx+w/2, by+h/2+1);
}
function drawAlienBubbles(){
  state.aliens.forEach(a=>{
    if(a.bubbleT>0 && a.message){
      const op = a.bubbleT>0.6 ? 1 : a.bubbleT/0.6;
      ctx.save();
      ctx.globalAlpha=op;
      const lift = a.carrying ? a.carrying.size*a.carrying.scale*1.5 : 0;
      const at = a.bubbleAt || {x:a.x, y:a.y - a.size*a.scale - 12 - lift};
      drawSpeechBubble(at.x, at.y, a.message);
      ctx.restore();
    }
  });
}

// Aliens drawn somewhere other than the bay floor: out in space, in the arm's grip, in the chute.
const OFF_FLOOR_ALIEN_STATES = new Set(['floating','ejected','jammed','abducted','chute','launching','spaced']);
function draw(){
  ctx.clearRect(0,0,W,H);
  ctx.save();
  // Screen shake moves the whole stage (both canvases) rather than redrawing it offset.
  const sh = Math.max(state.shake, state.rumble.shake), stage=canvas.parentNode;
  if(sh>0.1){
    stage.style.transform='translate('+((Math.random()-0.5)*sh).toFixed(1)+'px,'+((Math.random()-0.5)*sh).toFixed(1)+'px)';
    stage.dataset.shaking='1';
  } else if(stage.dataset.shaking){ stage.style.transform=''; delete stage.dataset.shaking; }

  // Walls and floor are on the background canvas (see resize). The floor used to be painted over the
  // bottom of the iris; now the iris is clipped at the floor line instead.
  ctx.save();
  ctx.beginPath(); ctx.rect(-W, -H, W*3, layout.floorTop+H); ctx.clip();
  drawIrisWindow();
  ctx.restore();
  drawChute();
  drawEmitters();
  drawRedButton();
  drawLever();
  drawAlienList(state.aliens.filter(isFarTrackAlien));
  drawBarrels();
  if(state.held) drawBeams();
  drawRockList(state.rocks.filter(r=>r.state!=='floating' && r.state!=='ejected' && r.state!=='gone' && r.state!=='carried'));
  drawAlienList(state.aliens.filter(a=> !OFF_FLOOR_ALIEN_STATES.has(a.state) && !isArmLayerAlien(a) && a.walkPhase!=='hiding' && !isFarTrackAlien(a)));
  drawRockList(state.rocks.filter(r=>r.state==='carried'));
  drawParticles();
  drawAlienBubbles();

  ctx.restore();
}

const layerSky=makeLayer(), layerIris=makeLayer(), layerBarrel=makeLayer();
const holeLayers=new WeakMap();
let nebulaGen=0;
function drawVoidBackdrop(){
  const g=ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#0a0e16');
  g.addColorStop(1,'#04060a');
  ctx.fillStyle=g;
  ctx.fillRect(0,0,W,H);
}

function drawIrisWindow(){
  const {cx,cy,r}=layout.iris;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx,cy,r,0,TAU); ctx.clip();
  const blobs=state.nebulaBlobs;
  if(!blobs.gen) blobs.gen=++nebulaGen;
  paintLayer(layerSky, layoutGen+'|'+DPR+'|'+blobs.gen+'|'+state.nebulaHue, cx-r, cy-r, r*2, r*2, ()=>{
    const sg=ctx.createRadialGradient(cx,cy,0,cx,cy,r*1.4);
    sg.addColorStop(0,`hsl(${state.nebulaHue},45%,10%)`);
    sg.addColorStop(1,'#020305');
    ctx.fillStyle=sg;
    ctx.fillRect(cx-r,cy-r,r*2,r*2);
    blobs.forEach(b=>{
      const bx=cx+Math.cos(b.a)*r*b.r, by=cy+Math.sin(b.a)*r*b.r;
      const rad=r*b.size;
      const ng=ctx.createRadialGradient(bx,by,0,bx,by,rad);
      ng.addColorStop(0, `hsla(${b.hue},70%,60%,${b.alpha})`);
      ng.addColorStop(1, `hsla(${b.hue},70%,50%,0)`);
      ctx.fillStyle=ng;
      ctx.beginPath(); ctx.arc(bx,by,rad,0,TAU); ctx.fill();
    });
  });
  state.stars.forEach(s=>{
    const sx=cx+Math.cos(s.a)*r*s.r, sy=cy+Math.sin(s.a)*r*s.r;
    const tw = reducedMotion ? 0.8 : 0.55+0.45*Math.sin(state.t*s.sp+s.tw);
    ctx.globalAlpha = tw;
    ctx.fillStyle='#dfeaff';
    ctx.beginPath(); ctx.arc(sx,sy,s.size,0,TAU); ctx.fill();
    ctx.globalAlpha=1;
  });

  drawRockList(state.rocks.filter(r=>r.state==='floating' || r.state==='ejected'));
  drawAlienList(state.aliens.filter(a=>a.state==='floating' || a.state==='ejected' || a.state==='spaced'));
  drawForceField();

  ctx.restore();

  // blades + ring + rivets: one layer, redrawn only while the iris is moving
  const RR=r*1.17+4;
  paintLayer(layerIris, layoutGen+'|'+DPR+'|'+state.irisOpen.toFixed(3), cx-RR, cy-RR, RR*2, RR*2, ()=>{
    drawIrisBlades(cx,cy,r);

    const ringW = r*0.14;
    const rg=ctx.createLinearGradient(cx-r,cy-r,cx+r,cy+r);
    rg.addColorStop(0,'#4a5568'); rg.addColorStop(0.5,'#232a35'); rg.addColorStop(1,'#3a4553');
    ctx.strokeStyle=rg;
    ctx.lineWidth=ringW;
    ctx.beginPath(); ctx.arc(cx,cy,r+ringW*0.42,0,TAU); ctx.stroke();
    ctx.strokeStyle='rgba(91,230,217,0.35)';
    ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(cx,cy,r+ringW*0.05,0,TAU); ctx.stroke();
    const rivetN=20;
    for(let i=0;i<rivetN;i++){
      const a=(i/rivetN)*TAU;
      const rx=cx+Math.cos(a)*(r+ringW*0.8), ry=cy+Math.sin(a)*(r+ringW*0.8);
      ctx.fillStyle='#151b23';
      ctx.beginPath(); ctx.arc(rx,ry,2.4,0,TAU); ctx.fill();
    }
  });
}

function drawIrisBlades(cx,cy,r){
  const N=11;
  const open=state.irisOpen;
  ctx.save();
  // Blades retract into the housing: mask everything outside the outer edge of the ring
  // (ring is drawn at r + ringW*0.42 with width ringW = r*0.14, see drawIrisWindow).
  ctx.beginPath(); ctx.arc(cx,cy,r + r*0.14*0.92,0,TAU); ctx.clip();
  const halfW = (Math.PI/N)*1.08;
  for(let i=0;i<N;i++){
    const a0=(i/N)*TAU;
    const twist = open*(Math.PI/N)*1.6;
    const innerR = lerp(0, r*1.08, open);
    const outerR = r*1.65;
    const aS = a0-halfW, aE=a0+halfW;
    const p1={x:cx+Math.cos(aS+twist)*innerR, y:cy+Math.sin(aS+twist)*innerR};
    const p2={x:cx+Math.cos(aS+twist*0.35)*outerR, y:cy+Math.sin(aS+twist*0.35)*outerR};
    const p3={x:cx+Math.cos(aE+twist*0.35)*outerR, y:cy+Math.sin(aE+twist*0.35)*outerR};
    const p4={x:cx+Math.cos(aE+twist)*innerR, y:cy+Math.sin(aE+twist)*innerR};
    const grad=ctx.createLinearGradient(p1.x,p1.y,p3.x,p3.y);
    grad.addColorStop(0,'#333c49');
    grad.addColorStop(0.5,'#1a2028');
    grad.addColorStop(1,'#2b3341');
    ctx.fillStyle=grad;
    ctx.beginPath();
    ctx.moveTo(p1.x,p1.y); ctx.lineTo(p2.x,p2.y); ctx.lineTo(p3.x,p3.y); ctx.lineTo(p4.x,p4.y);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,0.55)'; ctx.lineWidth=1.2; ctx.stroke();
    ctx.strokeStyle='rgba(255,182,72,0.18)';
    ctx.beginPath(); ctx.moveTo(p1.x,p1.y); ctx.lineTo(p2.x,p2.y); ctx.stroke();
  }
  ctx.restore();
}

function drawBayStructure(){
  const grad=ctx.createLinearGradient(0,0,0,H);
  grad.addColorStop(0,'#141a22'); grad.addColorStop(1,'#0a0d13');
  ctx.fillStyle=grad;
  ctx.fillRect(0,0,W,layout.floorTop);

  const ribCount=6;
  for(let i=0;i<ribCount;i++){
    const t=i/(ribCount-1);
    const x = W*t;
    const g2=ctx.createLinearGradient(x-14,0,x+14,0);
    g2.addColorStop(0,'rgba(255,255,255,0)');
    g2.addColorStop(0.5,'rgba(120,140,165,0.10)');
    g2.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=g2;
    ctx.fillRect(x-14,0,28,layout.floorTop);
  }
  ctx.strokeStyle='rgba(91,230,217,0.14)';
  ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(0,H*0.04); ctx.lineTo(W,H*0.04); ctx.stroke();
  ctx.strokeStyle='rgba(255,182,72,0.10)';
  ctx.beginPath(); ctx.moveTo(0,H*0.065); ctx.lineTo(W,H*0.065); ctx.stroke();

  drawChevronStrip(10, layout.floorTop-26, 90, 14);
  drawChevronStrip(W-100, layout.floorTop-26, 90, 14);
}
function drawChevronStrip(x,y,w,h){
  ctx.save();
  ctx.beginPath(); ctx.rect(x,y,w,h); ctx.clip();
  ctx.fillStyle='#161b22'; ctx.fillRect(x,y,w,h);
  const step=h*1.4;
  ctx.fillStyle='rgba(255,182,72,0.55)';
  for(let cx=x-h;cx<x+w+h;cx+=step){
    ctx.beginPath();
    ctx.moveTo(cx,y+h); ctx.lineTo(cx+h*0.6,y); ctx.lineTo(cx+h*0.6+6,y); ctx.lineTo(cx+6,y+h);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function drawFloor(){
  const top=layout.floorTop, bottom=H;
  const g=ctx.createLinearGradient(0,top,0,bottom);
  g.addColorStop(0,'#151b24');
  g.addColorStop(1,'#0a0d13');
  ctx.fillStyle=g;
  ctx.beginPath();
  ctx.moveTo(0,top); ctx.lineTo(W,top); ctx.lineTo(W,bottom); ctx.lineTo(0,bottom);
  ctx.closePath(); ctx.fill();

  const vpx=layout.iris.cx;
  ctx.strokeStyle='rgba(120,140,165,0.10)';
  ctx.lineWidth=1;
  const cols=9;
  for(let i=0;i<=cols;i++){
    const t=i/cols;
    const xBottom = lerp(0,W,t);
    ctx.beginPath();
    ctx.moveTo(xBottom,bottom);
    ctx.lineTo(lerp(vpx,xBottom,0.55), top);
    ctx.stroke();
  }
  const rows=5;
  for(let i=1;i<rows;i++){
    const t=i/rows;
    const y=lerp(top,bottom,t*t*0.9+t*0.1);
    ctx.strokeStyle='rgba(120,140,165,0.08)';
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();
  }
}

function drawEmitters(){
  layout.emitters.forEach(e=>{
    ctx.save();
    ctx.translate(e.x,e.y);
    const active = !!state.held;
    ctx.fillStyle='#242b36';
    ctx.beginPath(); ctx.arc(0,0,13,0,TAU); ctx.fill();
    ctx.strokeStyle='#454f60'; ctx.lineWidth=2; ctx.stroke();
    ctx.fillStyle = active ? '#5be6d9' : '#3a4351';
    ctx.beginPath(); ctx.arc(0,0,5.5,0,TAU); ctx.fill();
    if(active){
      ctx.shadowColor='#5be6d9'; ctx.shadowBlur=14;
      ctx.beginPath(); ctx.arc(0,0,5.5,0,TAU); ctx.fill();
      ctx.shadowBlur=0;
    }
    ctx.restore();
  });
}

function drawRedButton(){
  const b=layout.redButton;
  ctx.save();
  ctx.translate(b.x,b.y);
  ctx.fillStyle='#20262f';
  ctx.beginPath(); ctx.arc(0,0,b.r*1.6,0,TAU); ctx.fill();
  ctx.strokeStyle='#454f60'; ctx.lineWidth=2; ctx.stroke();
  const grad=ctx.createRadialGradient(-b.r*0.3,-b.r*0.3,1, 0,0,b.r);
  grad.addColorStop(0,'#ff6b6b');
  grad.addColorStop(1,'#a51f1f');
  ctx.fillStyle=grad;
  ctx.beginPath(); ctx.arc(0,0,b.r,0,TAU); ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,0.35)'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.arc(0,0,b.r,0,TAU); ctx.stroke();
  ctx.restore();
}

function drawLever(){
  const L=layout.lever;
  ctx.save();
  ctx.translate(L.x,L.y);
  // mounting plate
  ctx.fillStyle='#20262f';
  roundRectPath(-11,-12,22,24,4); ctx.fill();
  ctx.strokeStyle='#454f60'; ctx.lineWidth=2; ctx.stroke();
  // handle: tilted up normally, tilted down when flipped
  const ang = state.leverDown ? Math.PI*0.5-0.5 : -Math.PI*0.5+0.5;
  const hx=Math.cos(ang)*L.h, hy=Math.sin(ang)*L.h;
  ctx.strokeStyle='#9aa6b8'; ctx.lineWidth=4; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(hx,hy); ctx.stroke();
  ctx.fillStyle='#d9e0ea';
  ctx.beginPath(); ctx.arc(hx,hy,5,0,TAU); ctx.fill();
  ctx.fillStyle='#3a4351';
  ctx.beginPath(); ctx.arc(0,0,4,0,TAU); ctx.fill();
  // warning light: dark while up, blinking red for as long as the lever stays down
  const lx=24, ly=-6;
  const lit = state.leverDown && Math.sin(state.t*Math.PI*3) > 0;
  ctx.fillStyle='#20262f';
  ctx.beginPath(); ctx.arc(lx,ly,8,0,TAU); ctx.fill();
  ctx.fillStyle = lit ? '#ff3b3b' : '#4a1616';
  if(lit){ ctx.shadowColor='#ff3b3b'; ctx.shadowBlur=16; }
  ctx.beginPath(); ctx.arc(lx,ly,5,0,TAU); ctx.fill();
  ctx.shadowBlur=0;
  ctx.restore();
}

// Static over the iris glass: a glow where the alien hit, jittery scan lines and a crackling rim.
// Drawn inside drawIrisWindow's clip, so it only covers the window.
function drawForceField(){
  const ff=state.forceField;
  if(ff.t<=0) return;
  const {cx,cy,r}=layout.iris;
  const k=ff.t/FORCE_FIELD_DUR;
  ctx.save();
  const g=ctx.createRadialGradient(ff.x,ff.y,0,ff.x,ff.y,r*1.3);
  g.addColorStop(0,`rgba(170,240,255,${0.45*k})`);
  g.addColorStop(0.35,`rgba(91,230,217,${0.22*k})`);
  g.addColorStop(1,`rgba(91,160,230,${0.10*k})`);
  ctx.fillStyle=g;
  ctx.fillRect(cx-r,cy-r,r*2,r*2);
  ctx.lineWidth=1;
  const lines = reducedMotion ? 0 : 26;
  for(let i=0;i<lines;i++){
    const y=cy-r+Math.random()*r*2, x=cx-r+Math.random()*r*2, len=rand(r*0.1, r*0.6);
    ctx.strokeStyle=`rgba(${Math.random()<0.5?'220,255,255':'120,220,255'},${rand(0.2,0.8)*k})`;
    ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+len,y); ctx.stroke();
  }
  ctx.strokeStyle=`rgba(190,250,255,${0.8*k})`;
  ctx.lineWidth=3;
  ctx.beginPath();
  const N=48;
  for(let i=0;i<=N;i++){
    const a=i/N*TAU, rr=r*(0.97 + (reducedMotion ? 0 : rand(-0.025,0.025)));
    const px=cx+Math.cos(a)*rr, py=cy+Math.sin(a)*rr;
    if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
  }
  ctx.stroke();
  ctx.restore();
}

// The airlock chute: a glass box in a wall frame. Behind the glass is the outer hatch, a round
// port that irises open onto space when the chute launches. The occupant is drawn between the two.
function drawChute(){
  const c=layout.chute, ch=state.chute, occ=chuteOccupant();
  const x0=c.x-c.w/2, y0=c.y-c.h/2, F=Math.max(5, c.w*0.07);   // frame width (computeLayout assumes the same)
  ctx.save();
  // wall frame
  ctx.fillStyle='#1b212b';
  roundRectPath(x0-F, y0-F, c.w+F*2, c.h+F*2, 6); ctx.fill();
  ctx.strokeStyle='#454f60'; ctx.lineWidth=2; ctx.stroke();
  ctx.fillStyle='#151b23';
  [[x0-F*0.5,y0-F*0.5],[x0+c.w+F*0.5,y0-F*0.5],[x0-F*0.5,y0+c.h+F*0.5],[x0+c.w+F*0.5,y0+c.h+F*0.5]].forEach(([bx,by])=>{
    ctx.beginPath(); ctx.arc(bx,by,Math.max(1.5,F*0.28),0,TAU); ctx.fill();
  });
  // inside of the box, with the outer hatch in its back wall
  ctx.fillStyle='#0c1118';
  ctx.fillRect(x0, y0, c.w, c.h);
  const px=c.x, py=c.y-c.h*0.05, pr=c.w*0.36;
  ctx.fillStyle='#232a35';
  ctx.beginPath(); ctx.arc(px,py,pr*1.12,0,TAU); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.arc(px,py,pr,0,TAU); ctx.clip();
  ctx.fillStyle=`hsl(${state.nebulaHue},45%,8%)`;
  ctx.fillRect(px-pr,py-pr,pr*2,pr*2);
  ctx.fillStyle='#dfeaff';
  for(let i=0;i<7;i++){
    const s=state.stars[i]; if(!s) break;
    ctx.globalAlpha=0.5+0.5*s.r;
    ctx.beginPath(); ctx.arc(px+Math.cos(s.a)*pr*s.r, py+Math.sin(s.a)*pr*s.r, 0.9, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha=1;
  // hatch leaves: closed they meet in the middle, open they slide back into the rim
  const open=ch.hatch;
  ctx.fillStyle='#2e3644'; ctx.strokeStyle='rgba(0,0,0,0.6)'; ctx.lineWidth=1;
  const N=6;
  for(let i=0;i<N;i++){
    const a0=i/N*TAU + open*0.6, inner=pr*open*1.02;
    ctx.beginPath();
    ctx.moveTo(px+Math.cos(a0)*inner, py+Math.sin(a0)*inner);
    ctx.arc(px,py,pr*1.05,a0,a0+TAU/N+0.02);
    ctx.lineTo(px+Math.cos(a0+TAU/N)*inner, py+Math.sin(a0+TAU/N)*inner);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
  // occupant, inside the glass
  if(occ){
    ctx.save();
    ctx.beginPath(); ctx.rect(x0,y0,c.w,c.h); ctx.clip();
    drawAlienList([occ]);
    ctx.restore();
  }
  // glass front: a tint, two highlight streaks, a cyan edge; white flash on launch
  ctx.fillStyle='rgba(150,215,255,0.08)';
  ctx.fillRect(x0,y0,c.w,c.h);
  ctx.save();
  ctx.beginPath(); ctx.rect(x0,y0,c.w,c.h); ctx.clip();
  ctx.strokeStyle='rgba(255,255,255,0.16)'; ctx.lineCap='round';
  ctx.lineWidth=c.w*0.09;
  ctx.beginPath(); ctx.moveTo(x0+c.w*0.15, y0+c.h*0.55); ctx.lineTo(x0+c.w*0.55, y0+c.h*0.08); ctx.stroke();
  ctx.lineWidth=c.w*0.04;
  ctx.beginPath(); ctx.moveTo(x0+c.w*0.32, y0+c.h*0.62); ctx.lineTo(x0+c.w*0.72, y0+c.h*0.15); ctx.stroke();
  ctx.restore();
  if(ch.flash>0){
    ctx.fillStyle=`rgba(230,250,255,${ch.flash*0.7})`;
    ctx.fillRect(x0,y0,c.w,c.h);
  }
  ctx.strokeStyle='rgba(91,230,217,0.55)'; ctx.lineWidth=1.5;
  ctx.strokeRect(x0+0.5,y0+0.5,c.w-1,c.h-1);
  // stencil on the top of the frame, and an occupancy light
  ctx.font=`700 ${Math.max(6, Math.min(9, F*1.1))}px Orbitron, sans-serif`;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillStyle='rgba(255,182,72,0.75)';
  ctx.fillText('AIRLOCK', c.x, y0-F*0.5);
  const lit = occ && occ.state==='chute' && Math.sin(state.t*Math.PI*2.4)>0;
  ctx.fillStyle = lit ? '#ffb648' : '#4a3a1e';
  if(lit){ ctx.shadowColor='#ffb648'; ctx.shadowBlur=10; }
  ctx.beginPath(); ctx.arc(x0+c.w+F*0.5, c.y, Math.max(2, F*0.32), 0, TAU); ctx.fill();
  ctx.shadowBlur=0;
  ctx.restore();
  drawChuteButton(!!occ && occ.state==='chute');
}
function drawChuteButton(armed){
  const b=layout.chuteBtn, ch=state.chute;
  const x0=b.x-b.w/2, y0=b.y-b.h/2 + (ch.press>0 ? 1.5 : 0);
  ctx.save();
  // hazard-striped bezel
  roundRectPath(x0, y0, b.w, b.h, 5);
  ctx.fillStyle='#161b22'; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle='rgba(255,182,72,0.6)';
  for(let sx=x0-b.h; sx<x0+b.w+b.h; sx+=10){
    ctx.beginPath(); ctx.moveTo(sx,y0+b.h); ctx.lineTo(sx+b.h,y0); ctx.lineTo(sx+b.h+5,y0); ctx.lineTo(sx+5,y0+b.h); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  // the button itself: red and pulsing when there's someone to launch
  const inset=4;
  roundRectPath(x0+inset, y0+inset, b.w-inset*2, b.h-inset*2, 3);
  if(armed){
    const pulse=0.5+0.5*Math.sin(state.t*5);
    const g=ctx.createLinearGradient(0,y0,0,y0+b.h);
    g.addColorStop(0,'#ff6b6b'); g.addColorStop(1,'#a51f1f');
    ctx.fillStyle=g;
    ctx.shadowColor='#ff3b3b'; ctx.shadowBlur=6+10*pulse;
  } else {
    ctx.fillStyle='#2a303a';
  }
  ctx.fill();
  ctx.shadowBlur=0;
  ctx.strokeStyle='rgba(0,0,0,0.5)'; ctx.lineWidth=1; ctx.stroke();
  ctx.font='700 11px Orbitron, sans-serif';
  const fit=(b.w-inset*2-6)/ctx.measureText('LAUNCH').width;
  ctx.font=`700 ${Math.max(7, Math.min(11, 11*fit)).toFixed(1)}px Orbitron, sans-serif`;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillStyle = armed ? '#fff3f0' : '#5c6b85';
  ctx.fillText('LAUNCH', b.x, y0+b.h/2+0.5);
  ctx.restore();
}

function roundRectPath(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}

// Aliens at the arm's depth (between the barrel rows) that aren't held by the arm: ones it just kicked.
function isArmLayerAlien(a){ return a.state==='falling' && a.kicked; }
function drawBarrels(){
  // Floor openings first, then back row, the arm (and anything it carries) plus anything it just
  // kicked, then the front row. An abduction reaches out to the near track in front of the front
  // row, so that arm is drawn last.
  layout.barrelHoles.forEach((h,i)=>drawFloorHole(h, state.barrels[i].door));
  drawFloorHole(layout.armHole, state.arm.door);
  drawBarrelSlot(0); drawBarrelSlot(1);
  drawHologram(0); drawHologram(1);
  const armFront = state.arm.job && state.arm.job.type==='abduct';
  if(!armFront) drawArm();
  drawAlienList(state.aliens.filter(isArmLayerAlien));
  drawBarrelSlot(2); drawBarrelSlot(3);
  drawHologram(2); drawHologram(3);
  if(armFront) drawArm();
}
function drawBarrelSlot(i){
  const b=state.barrels[i];
  if(b.status==='gone' || b.status==='carried' || b.status==='destroyed') return;
  const a=layout.barrels4[i];
  if(b.status==='rising'){
    const dy=barrelRiseOffset(b), h=layout.barrelHoles[i];
    withHoleClip(h, b.door, ()=>{
      drawBarrel({x:a.x, y:a.y+dy}, i, true);
      const p=slotPeekAmount(b);
      if(p>0){
        // the borrowed alien's head, drawn here (it's still off-screen as far as anyone else knows)
        const al=b.peek.alien, sc=floorScaleAt(h.y)*0.8, r=al.size*sc;
        const save={x:al.x, y:al.y, scale:al.scale};
        al.x=h.x; al.y=h.y + r*1.1 - p*r*1.2; al.scale=sc;   // eyes just over the rim
        drawAlienList([al]);
        al.x=save.x; al.y=save.y; al.scale=save.scale;
      }
    });
  } else {
    drawBarrel(a,i);
  }
}
// A barrel's label, projected as a hologram beside (or above) its slot. Shows how the barrel was
// labelled by its first rock; what that means for matching is up to the player.
// Each panel (frame, scanlines, glowing label) is rendered once into an offscreen canvas and reused
// until its label, colour or size changes; blurred glow is costly to redraw every frame.
const holoCache=[];
let holoFontGen=0;
if(document.fonts){
  document.fonts.addEventListener && document.fonts.addEventListener('loadingdone', ()=>holoFontGen++);
  document.fonts.ready.then(()=>holoFontGen++);
}
function holoPanel(i, b, g){
  const sealed=!!b.sealed, label=b.value ? b.text : null, glyph=b.value ? b.glyph : null;
  const key=[label, glyph&&JSON.stringify(glyph), sealed, g.w, g.h, DPR, holoFontGen].join('|');
  const c=holoCache[i];
  if(c && c.key===key) return c;
  const PAD=12, w=g.w, h=g.h;
  const cv=(c && c.cv) || document.createElement('canvas');
  cv.width=Math.ceil((w+PAD*2)*DPR); cv.height=Math.ceil((h+PAD*2)*DPR);
  const o=cv.getContext('2d');
  o.setTransform(DPR,0,0,DPR,PAD*DPR,PAD*DPR);
  const col = sealed ? '124,255,178' : '91,230,217';
  o.fillStyle='rgba('+col+',0.09)'; o.fillRect(0,0,w,h);
  o.fillStyle='rgba('+col+',0.07)';
  for(let yy=1; yy<h; yy+=3) o.fillRect(0,yy,w,1);
  o.strokeStyle='rgba('+col+',0.5)'; o.lineWidth=1;
  o.strokeRect(0.5,0.5,w-1,h-1);
  const k=Math.min(8,h*0.3);                                       // corner brackets
  o.strokeStyle='rgba('+col+',0.95)'; o.lineWidth=1.6;
  o.beginPath();
  o.moveTo(0,k); o.lineTo(0,0); o.lineTo(k,0);
  o.moveTo(w-k,0); o.lineTo(w,0); o.lineTo(w,k);
  o.moveTo(w,h-k); o.lineTo(w,h); o.lineTo(w-k,h);
  o.moveTo(k,h); o.lineTo(0,h); o.lineTo(0,h-k);
  o.stroke();
  o.shadowColor='rgb('+col+')'; o.shadowBlur=10;
  const drawn = glyph && MODE.drawGlyph &&
    MODE.drawGlyph(o, glyph, w/2, h/2, h*0.4, {fill:'rgb('+col+')', empty:'rgba('+col+',0.12)', line:'rgba('+col+',0.8)'});
  if(!drawn){
    const text = label || '— —';
    o.textAlign='center'; o.textBaseline='middle';
    o.font='700 100px Orbitron, sans-serif';
    const w100=o.measureText(text).width||1;
    const size=Math.max(8, Math.min(h*0.6, Math.floor(100*(w-12)/w100)));
    o.font='700 '+size+'px Orbitron, sans-serif';
    o.fillStyle = label ? (sealed ? '#c9ffe1' : '#d8fbf7') : 'rgba('+col+',0.45)';
    o.fillText(text, w/2, h/2+size*0.04);
  }
  return holoCache[i]={key, cv, pad:PAD, col};
}
function drawHologram(i){
  const b=state.barrels[i], g=layout.holos[i], R=layout.barrelR;
  if(g.beside){
    // emitter puck on the floor, always there
    ctx.fillStyle='#1a2029';
    ctx.beginPath(); ctx.ellipse(g.ex,g.ey,R*0.42,R*0.15,0,0,TAU); ctx.fill();
    ctx.strokeStyle='#3a4351'; ctx.lineWidth=1.5; ctx.stroke();
    ctx.fillStyle = b.holo>0 ? 'rgba(91,230,217,'+(0.35+0.5*b.holo)+')' : '#26303c';
    ctx.beginPath(); ctx.ellipse(g.ex,g.ey,R*0.18,R*0.065,0,0,TAU); ctx.fill();
  }
  if(b.holo<=0.01) return;
  const panel=holoPanel(i, b, g), col=panel.col;
  const t=state.t, open=smooth01(b.holo);
  let alpha = 0.86 + 0.08*Math.sin(t*11 + i*1.9);
  if(((t*0.9 + i*0.37) % 5) < 0.05) alpha*=0.45;                 // the odd glitch
  const w=g.w*(0.3+0.7*open), h=g.h*open, x0=g.x-w/2, y0=g.y-h/2;
  ctx.save();
  ctx.globalAlpha=alpha*b.holo;
  // projection beam from the emitter (or the lid) to the panel's lower edge
  const bw = R*(g.beside?0.18:0.5);
  const bg=ctx.createLinearGradient(0, g.beside ? y0+h : g.ey, 0, g.beside ? g.ey : y0+h);
  bg.addColorStop(0, g.beside ? 'rgba('+col+',0.10)' : 'rgba('+col+',0.22)');
  bg.addColorStop(1, g.beside ? 'rgba('+col+',0.28)' : 'rgba('+col+',0.04)');
  ctx.fillStyle=bg;
  ctx.beginPath();
  ctx.moveTo(g.ex-bw,g.ey); ctx.lineTo(g.ex+bw,g.ey); ctx.lineTo(x0+w,y0+h); ctx.lineTo(x0,y0+h);
  ctx.closePath(); ctx.fill();
  // the cached panel, squashed while it unfolds
  const sx=w/g.w, sy=h/g.h, P=panel.pad;
  ctx.drawImage(panel.cv, x0-P*sx, y0-P*sy, (g.w+P*2)*sx, (g.h+P*2)*sy);
  ctx.restore();
}
// Draw something that passes down through a floor opening: visible above the hole's center line,
// and below it only through the gap between the open doors.
function withHoleClip(h, open, fn){
  ctx.save();
  ctx.beginPath(); ctx.rect(-W, -H, W*3, h.y+H); ctx.clip();
  fn();
  ctx.restore();
  if(open>0){
    ctx.save();
    ctx.beginPath(); ctx.ellipse(h.x,h.y,h.rx,h.ry,0,0,TAU); ctx.clip();
    ctx.beginPath(); ctx.rect(h.x-open*h.rx, h.y, open*h.rx*2, h.ry+2); ctx.clip();
    fn();
    ctx.restore();
  }
}
// Like withHoleClip, plus everything on the far side of a segment's exit point `c` (direction `d`):
// the part of an arm segment that has already come up out of the opening.
function withEmergedClip(h, open, c, d, fn){
  withHoleClip(h, open, fn);
  const L=Math.hypot(d.x,d.y)||1, ux=d.x/L, uy=d.y/L, B=W+H;
  ctx.save();
  // below the hole line, outside the opening (already covered above)
  ctx.beginPath(); ctx.rect(-W, h.y, W*3, H*2); ctx.clip();
  ctx.beginPath(); ctx.rect(-W, -H, W*3, H*3); ctx.ellipse(h.x,h.y,h.rx,h.ry,0,0,TAU); ctx.clip('evenodd');
  // and past the exit point along the segment
  ctx.beginPath();
  ctx.moveTo(c.x - uy*B, c.y + ux*B); ctx.lineTo(c.x + uy*B, c.y - ux*B);
  ctx.lineTo(c.x + uy*B + ux*B, c.y - ux*B + uy*B); ctx.lineTo(c.x - uy*B + ux*B, c.y + ux*B + uy*B);
  ctx.closePath(); ctx.clip();
  fn();
  ctx.restore();
}
// A circular opening in the floor with two doors that meet at a vertical seam.
function drawFloorHole(h, open){
  let L=holeLayers.get(h); if(!L){ L=makeLayer(); holeLayers.set(h,L); }
  const bx=h.rx*1.14+3, by=h.ry*1.2+3;
  paintLayer(L, layoutGen+'|'+DPR+'|'+open.toFixed(3), h.x-bx, h.y-by, bx*2, by*2, ()=>drawFloorHoleRaw(h, open));
}
function drawFloorHoleRaw(h, open){
  ctx.save();
  ctx.fillStyle='#07090d';
  ctx.beginPath(); ctx.ellipse(h.x,h.y,h.rx*1.14,h.ry*1.2,0,0,TAU); ctx.fill();
  ctx.strokeStyle='#3a4351'; ctx.lineWidth=2; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(h.x,h.y,h.rx,h.ry,0,0,TAU); ctx.clip();
  const pit=ctx.createLinearGradient(0,h.y-h.ry,0,h.y+h.ry);
  pit.addColorStop(0,'#000'); pit.addColorStop(1,'#0d1a1f');
  ctx.fillStyle=pit; ctx.fillRect(h.x-h.rx, h.y-h.ry, h.rx*2, h.ry*2);
  const gap=open*h.rx;
  const dg=ctx.createLinearGradient(0,h.y-h.ry,0,h.y+h.ry);
  dg.addColorStop(0,'#1a2028'); dg.addColorStop(1,'#2b3341');
  ctx.fillStyle=dg;
  ctx.fillRect(h.x-h.rx-1, h.y-h.ry-1, h.rx-gap+1, h.ry*2+2);
  ctx.fillRect(h.x+gap, h.y-h.ry-1, h.rx-gap+1, h.ry*2+2);
  // door edges: dark seam with a thin amber hazard line on each leading edge
  ctx.lineWidth=1.5;
  for(const ex of [h.x-gap, h.x+gap]){
    ctx.strokeStyle='rgba(0,0,0,0.75)';
    ctx.beginPath(); ctx.moveTo(ex,h.y-h.ry); ctx.lineTo(ex,h.y+h.ry); ctx.stroke();
  }
  ctx.strokeStyle='rgba(255,182,72,0.35)';
  ctx.beginPath(); ctx.moveTo(h.x-gap-3,h.y-h.ry); ctx.lineTo(h.x-gap-3,h.y+h.ry); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(h.x+gap+3,h.y-h.ry); ctx.lineTo(h.x+gap+3,h.y+h.ry); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle='rgba(120,140,165,0.35)'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.ellipse(h.x,h.y,h.rx,h.ry,0,0,TAU); ctx.stroke();
}
function drawArmBar(p,q,w,fill){
  const ang=Math.atan2(q.y-p.y,q.x-p.x), len=Math.hypot(q.x-p.x,q.y-p.y);
  ctx.save();
  ctx.translate(p.x,p.y); ctx.rotate(ang);
  const g=ctx.createLinearGradient(0,-w/2,0,w/2);
  g.addColorStop(0,fill[0]); g.addColorStop(0.5,fill[1]); g.addColorStop(1,fill[2]);
  ctx.fillStyle=g;
  ctx.fillRect(0,-w/2,len,w);
  ctx.strokeStyle='rgba(0,0,0,0.5)'; ctx.lineWidth=1.2;
  ctx.strokeRect(0,-w/2,len,w);
  ctx.restore();
}
function drawArmJoint(p,r){
  ctx.fillStyle='#8b97a8';
  ctx.beginPath(); ctx.arc(p.x,p.y,r,0,TAU); ctx.fill();
  ctx.strokeStyle='#20262f'; ctx.lineWidth=2; ctx.stroke();
  ctx.fillStyle='#2b3341';
  ctx.beginPath(); ctx.arc(p.x,p.y,r*0.4,0,TAU); ctx.fill();
}
function drawArm(){
  const arm=state.arm;
  if(!arm.job && arm.door<=0) return;
  const h=layout.armHole, R=layout.barrelR;
  const {sh, elbow, wrist}=armPose();
  const steel=['#6b778a','#4a5568','#2b3341'];
  const step=arm.job ? arm.job.step : 'close';
  // Only clip what's actually passing through the opening. A barrel or alien being carried across the
  // floor (e.g. one of the front-row barrels, which stand lower than the opening) must not be masked.
  const throughHole = step==='wait' || step==='rise' || step==='lower' || step==='sink' || step==='open' || step==='close';
  // An abduction reaches out over the floor in front of the opening, below its center line, so the
  // forearm (and, while reaching, the upper arm) must not be masked by the hole then.
  // An abduction reaches out over the floor in front of the opening, below its center line. Whatever
  // part of a segment comes after the point where it rose up out of the opening is in the air and
  // stays visible even when it dips back down in front; the part before that is still underground.
  const abd = arm.job && arm.job.type==='abduct';
  let under = sh.y > h.y;
  const segClip = (p0, p1) => {
    if(!abd) return fn => withHoleClip(h, arm.door, fn);
    if(!under) return fn => fn();
    const out = p1.y < h.y;               // segment rises out of the opening
    if(!out) return fn => withHoleClip(h, arm.door, fn);
    under = false;
    const t=(p0.y-h.y)/(p0.y-p1.y), c={x:lerp(p0.x,p1.x,t), y:h.y};
    return fn => withEmergedClip(h, arm.door, c, {x:p1.x-p0.x, y:p1.y-p0.y}, fn);
  };
  withHoleClip(h, arm.door, ()=>drawArmBar({x:h.x, y:h.y+layout.armSeg*3}, sh, R*0.5, steel)); // mast out of the opening
  const upperClip = segClip(sh, elbow), foreClip = segClip(elbow, wrist);
  upperClip(()=>drawArmBar(sh, elbow, R*0.34, steel));
  foreClip(()=>drawArmBar(elbow, wrist, R*0.26, steel));
  withHoleClip(h, arm.door, ()=>drawArmJoint(sh, R*0.26));
  upperClip(()=>drawArmJoint(elbow, R*0.22));
  const payload = ()=>{
    if(arm.carrying>=0) drawBarrel(armBarrelAnchor(wrist), arm.carrying, true);
    const j=arm.job;
    if(j && j.type==='unjam' && j.alien.state==='jammed') drawAlienList([j.alien]);
    if(j && j.type==='abduct' && j.alien.state==='abducted') drawAlienList([j.alien]);
  };
  if(throughHole) withHoleClip(h, arm.door, payload); else payload();
  const wristJoint = ()=>{
    drawArmJoint(wrist, R*0.17);
    // magnet face on the wrist
    ctx.fillStyle='#c98a2d';
    roundRectPath(wrist.x-R*0.22, wrist.y+R*0.1, R*0.44, R*0.12, 2); ctx.fill();
  };
  // The kick's swing dips the wrist down into the open hole, so clip it then too.
  if(throughHole || step==='swing' || step==='crouch') withHoleClip(h, arm.door, wristJoint); else wristJoint();
}
function drawBarrel(anchor,i,noShadow){
  const b=state.barrels[i];
  const R=layout.barrelR, ry=R*0.42, Hh=layout.barrelH;
  const topY=anchor.y-Hh, bottomY=anchor.y;

  let rimColor='#4a5568';
  if(b.sealed) rimColor='#7cffb2';
  else if(b.value) rimColor='#5be6d9';

  ctx.save();

  if(!noShadow){
    // soft contact shadow only, so the closed slot doors underneath still read as closed
    ctx.fillStyle='rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(anchor.x,bottomY,R*1.02, ry*0.95,0,0,TAU); ctx.fill();
  }

  const gw=R*0.62;
  const gTop=topY+R*0.62, gBot=bottomY-R*0.28;
  const gx0=anchor.x-gw/2, gh=gBot-gTop;
  // Everything up to the gauge's contents is the same for every barrel: cached once, blitted here.
  const bx0=anchor.x-R-4, by0=topY-ry-4;
  paintLayer(layerBarrel, layoutGen+'|'+DPR, bx0, by0, R*2+8, Hh+ry*2+8, ()=>{
    // Cylinder body: straight sides, rounded (lower half-ellipse) bottom, shaded like a curved surface.
    const x=anchor.x;
    const bodyPath=()=>{
      ctx.beginPath();
      ctx.moveTo(x-R, topY);
      ctx.lineTo(x-R, bottomY);
      ctx.ellipse(x, bottomY, R, ry, 0, Math.PI, 0, true);
      ctx.lineTo(x+R, topY);
      ctx.closePath();
    };
    const bodyGrad=ctx.createLinearGradient(x-R,0,x+R,0);
    bodyGrad.addColorStop(0,'#14181f');
    bodyGrad.addColorStop(0.18,'#2a323e');
    bodyGrad.addColorStop(0.36,'#46505f');
    bodyGrad.addColorStop(0.5,'#38414f');
    bodyGrad.addColorStop(0.8,'#232a35');
    bodyGrad.addColorStop(1,'#101318');
    ctx.fillStyle=bodyGrad;
    bodyPath(); ctx.fill();
    // Hoops: raised rings that wrap around the barrel, so they curve with the bottom edge.
    ctx.save();
    bodyPath(); ctx.clip();
    [0.2,0.5,0.82].forEach((t,k)=>{
      const yy=lerp(topY,bottomY,t);
      const major = k!==1;
      ctx.strokeStyle='rgba(0,0,0,0.45)'; ctx.lineWidth=major?6:3;
      ctx.beginPath(); ctx.ellipse(x,yy+1,R,ry,0,0,Math.PI); ctx.stroke();
      const hg=ctx.createLinearGradient(x-R,0,x+R,0);
      hg.addColorStop(0,'rgba(180,195,215,0.04)');
      hg.addColorStop(0.35,'rgba(200,215,235,'+(major?0.38:0.18)+')');
      hg.addColorStop(1,'rgba(180,195,215,0.03)');
      ctx.strokeStyle=hg; ctx.lineWidth=major?2:1;
      ctx.beginPath(); ctx.ellipse(x,yy-1.5,R,ry,0,0,Math.PI); ctx.stroke();
    });
    // soft specular streak down the lit side
    const spec=ctx.createLinearGradient(x-R*0.55,0,x-R*0.15,0);
    spec.addColorStop(0,'rgba(255,255,255,0)');
    spec.addColorStop(0.5,'rgba(255,255,255,0.07)');
    spec.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=spec; ctx.fillRect(x-R*0.55, topY, R*0.4, Hh+ry);
    ctx.restore();
    // shipping label in the lower corner
    drawShippingLabel(x + R*0.64, bottomY - R*0.36, R*0.44, R*0.3, -0.04);
    // outline: sides plus the curved bottom rim
    ctx.strokeStyle='rgba(0,0,0,0.55)'; ctx.lineWidth=1.5;
    bodyPath(); ctx.stroke();
    ctx.strokeStyle='rgba(150,165,185,0.22)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.ellipse(x, bottomY-2, R-1, ry, 0, Math.PI*0.15, Math.PI*0.85); ctx.stroke();

    ctx.fillStyle='#0a0d12';
    roundRectPath(gx0-3, gTop-3, gw+6, gh+6, 5); ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.08)'; ctx.lineWidth=1;
    roundRectPath(gx0-3, gTop-3, gw+6, gh+6, 5); ctx.stroke();
  }, bx0, by0);

  const fillT=clamp(b.fillDisplay,0,1);
  if(fillT>0){
    const fillH=gh*fillT;
    const fy0=gBot-fillH;
    ctx.save();
    roundRectPath(gx0,gTop,gw,gh,3); ctx.clip();
    const fg=ctx.createLinearGradient(0,fy0,0,gBot);
    fg.addColorStop(0, b.sealed? '#a8ffce':'#8be8de');
    fg.addColorStop(1, b.sealed? '#2f9e63':'#1d6b64');
    ctx.fillStyle=fg;
    ctx.fillRect(gx0, fy0, gw, fillH+4);
    ctx.strokeStyle='rgba(255,255,255,0.6)'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(gx0,fy0); ctx.lineTo(gx0+gw,fy0); ctx.stroke();
    ctx.restore();
  }

  const lidGrad=ctx.createRadialGradient(anchor.x-R*0.3,topY-ry*0.3,2, anchor.x,topY,R*1.1);
  lidGrad.addColorStop(0,'#4a5568');
  lidGrad.addColorStop(1,'#232a35');
  ctx.fillStyle=lidGrad;
  ctx.beginPath(); ctx.ellipse(anchor.x,topY,R,ry,0,0,TAU); ctx.fill();

  // The lid carries no label any more (that's the hologram beside the slot); just a recessed plate
  // that glows while the barrel is armed.
  ctx.fillStyle='#0b0f15';
  ctx.beginPath(); ctx.ellipse(anchor.x,topY,R*0.84,ry*0.84,0,0,TAU); ctx.fill();
  if(b.value){
    ctx.save();
    ctx.translate(anchor.x,topY); ctx.scale(1, ry/R);
    const gl=ctx.createRadialGradient(0,0,0,0,0,R*0.6);
    const c = b.sealed ? '124,255,178' : '91,230,217';
    gl.addColorStop(0,'rgba('+c+',0.4)'); gl.addColorStop(0.5,'rgba('+c+',0.15)'); gl.addColorStop(1,'rgba('+c+',0)');
    ctx.fillStyle=gl;
    ctx.beginPath(); ctx.arc(0,0,R*0.6,0,TAU); ctx.fill();
    ctx.restore();
  }

  const flashBoost = b.flashT>0 ? (b.flashT/0.3) : 0;
  // rim glow: soft wide strokes under the rim (cheaper than a blur shadow)
  const glow=4+flashBoost*14+(b.sealed?6:0);
  ctx.beginPath(); ctx.ellipse(anchor.x,topY,R,ry,0,0,TAU);
  ctx.strokeStyle=rimColor;
  ctx.globalAlpha=0.12; ctx.lineWidth=2.5+glow*1.6; ctx.stroke();
  ctx.globalAlpha=0.25; ctx.lineWidth=2.5+glow*0.7; ctx.stroke();
  ctx.globalAlpha=1;    ctx.lineWidth=2.5+flashBoost*4; ctx.stroke();

  ctx.restore();
}

function drawBeams(){
  const r=state.held;
  layout.emitters.forEach((e,idx)=>{
    ctx.save();
    // glow as two soft wide strokes under the core line (a blur shadow costs far more)
    ctx.beginPath();
    ctx.moveTo(e.x,e.y);
    ctx.lineTo(r.x,r.y);
    ctx.lineCap='round';
    ctx.strokeStyle='rgba(91,230,217,0.07)'; ctx.lineWidth=9; ctx.stroke();
    ctx.strokeStyle='rgba(91,230,217,0.16)'; ctx.lineWidth=4; ctx.stroke();
    ctx.strokeStyle='rgba(91,230,217,0.85)'; ctx.lineWidth=1; ctx.stroke();
    const speed=2.4;
    const tt=(state.t*speed+idx*0.27)%1;
    const px=lerp(e.x,r.x,tt), py=lerp(e.y,r.y,tt);
    ctx.fillStyle='#c9fff8';
    ctx.beginPath(); ctx.arc(px,py,1.8,0,TAU); ctx.fill();
    ctx.restore();
  });
  ctx.save();
  ctx.fillStyle='rgba(91,230,217,0.18)';
  ctx.beginPath(); ctx.arc(r.x,r.y,r.size*r.scale*1.6,0,TAU); ctx.fill();
  ctx.restore();
}

function drawParticles(){
  state.particles.forEach(p=>{
    const t=p.life/p.maxLife;
    if(p.type==='plate'){
      ctx.save();
      ctx.globalAlpha = Math.min(1, (1-t)*2);
      ctx.translate(p.x,p.y); ctx.rotate(p.rot);
      ctx.fillStyle='#2b3341'; ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);
      ctx.fillStyle='#4a5568'; ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h*0.35);
      ctx.strokeStyle='rgba(0,0,0,0.6)'; ctx.lineWidth=1; ctx.strokeRect(-p.w/2,-p.h/2,p.w,p.h);
      ctx.restore();
    } else if(p.type==='shard'){
      ctx.save();
      ctx.globalAlpha = 1-t;
      ctx.fillStyle = `hsl(${p.hue},90%,60%)`;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.size*(1-t*0.4),0,TAU); ctx.fill();
      ctx.restore();
    } else if(p.type==='flash'){
      ctx.save();
      ctx.globalAlpha = (1-t)*0.8;
      const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.size+t*90);
      g.addColorStop(0,'rgba(255,220,180,0.9)');
      g.addColorStop(1,'rgba(255,120,60,0)');
      ctx.fillStyle=g;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.size+t*90,0,TAU); ctx.fill();
      ctx.restore();
    } else if(p.type==='ring'){
      ctx.save();
      ctx.globalAlpha = 1-t;
      ctx.strokeStyle='rgba(124,255,178,0.8)';
      ctx.lineWidth=3;
      ctx.beginPath(); ctx.ellipse(p.x,p.y,p.size*(0.6+t*1.3), p.size*(0.35+t*0.8), 0,0,TAU); ctx.stroke();
      ctx.restore();
    } else if(p.type==='spark'){
      ctx.save();
      ctx.globalAlpha=1-t;
      ctx.fillStyle='#ffd58a';
      ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,TAU); ctx.fill();
      ctx.restore();
    } else if(p.type==='zap'){
      // a hot streak along its direction of travel, white turning orange as it cools
      ctx.save();
      ctx.globalAlpha = 1-t*t;
      ctx.strokeStyle = `hsl(${lerp(55,22,t)},100%,${lerp(92,60,t)}%)`;
      ctx.lineWidth = p.size; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(p.x-p.vx*0.025, p.y-p.vy*0.025); ctx.lineTo(p.x, p.y); ctx.stroke();
      ctx.restore();
    } else if(p.type==='zapFlash'){
      ctx.save();
      ctx.globalAlpha = 1-t;
      const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.size);
      g.addColorStop(0,'rgba(235,245,255,0.95)'); g.addColorStop(0.4,'rgba(150,200,255,0.5)'); g.addColorStop(1,'rgba(150,200,255,0)');
      ctx.fillStyle=g;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,TAU); ctx.fill();
      ctx.restore();
    } else if(p.type==='ejectRock'){
      ctx.save();
      ctx.globalAlpha = 1-t;
      ctx.translate(p.x,p.y);
      const grad=ctx.createRadialGradient(0,0,0,0,0,p.size);
      grad.addColorStop(0,p.pal.b); grad.addColorStop(1,p.pal.c);
      ctx.fillStyle=grad;
      ctx.beginPath(); ctx.arc(0,0,p.size*(1-t*0.5),0,TAU); ctx.fill();
      ctx.restore();
    }
  });
}

function loop(){
  update();
  draw();
  requestAnimationFrame(loop);
}

resize();

// ---------- Save / load ----------
// Autosaved to localStorage (gzip + base64) every couple of seconds while playing, and when the
// tab is hidden. Saved: sector, hull, barrels, iris + lever, and every onboard alien (position,
// velocity, off-screen timer, stack links). Not saved: rocks (respawn), the robot arm (a sealed
// barrel loads as already retrieved), and in-progress peeks / unjams / abductions (those aliens
// load off-screen). Positions are rescaled if the window size changed.
const SaveGame = (()=>{
  // Each matching system keeps its own save (the oxygen mode keeps the original key).
  const KEY = MODE.id==='o2' ? 'cargoSort.save' : 'cargoSort.'+MODE.id+'.save', VERSION=1, INTERVAL=2;
  let gen=0, timer=0, chain=Promise.resolve();
  const hasGzip = typeof CompressionStream!=='undefined' && typeof DecompressionStream!=='undefined';
  const toB64 = bytes => { let s=''; for(let i=0;i<bytes.length;i+=0x8000) s+=String.fromCharCode.apply(null, bytes.subarray(i,i+0x8000)); return btoa(s); };
  const fromB64 = b64 => Uint8Array.from(atob(b64), c=>c.charCodeAt(0));
  const pipe = async (bytes, stream) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
  async function encode(obj){
    const json=JSON.stringify(obj, (k,v)=> typeof v==='number' ? Math.round(v*1000)/1000 : v);
    if(!hasGzip) return 'js1:'+json;
    return 'gz1:'+toB64(await pipe(new TextEncoder().encode(json), new CompressionStream('gzip')));
  }
  async function decode(str){
    if(str.startsWith('js1:')) return JSON.parse(str.slice(4));
    if(str.startsWith('gz1:')) return JSON.parse(new TextDecoder().decode(await pipe(fromB64(str.slice(4)), new DecompressionStream('gzip'))));
    throw new Error('unknown save format');
  }
  const ALIEN_SKIP = new Set(['avatarImg','ridingOn','rider','bubbleAt','carrying','rocksRolled']);
  function snapshot(){
    const aliens=[];
    for(const a of state.aliens){
      if(a.state==='ejected' || a.state==='launching' || a.state==='spaced') continue;  // on its way out
      const o={};
      for(const k in a) if(!ALIEN_SKIP.has(k)) o[k]=a[k];
      o.ridingOn = a.ridingOn ? a.ridingOn.id : null;
      o.rider = a.rider ? a.rider.id : null;
      o.avatarSrc = a.avatarImg ? a.avatarImg.src : null;
      aliens.push(o);
    }
    return {
      v:VERSION, mode:MODE.id, W, H, sector:state.sector, hull:state.hull, scars:state.scars,
      irisOpen:state.irisOpen, irisTarget:state.irisTarget, leverDown:state.leverDown,
      nebulaHue:state.nebulaHue, alienSpawnedThisSector:state.alienSpawnedThisSector,
      alienCloneCounters:state.alienCloneCounters,
      barrels:state.barrels.map(b=>({value:b.value, text:b.text, glyph:b.glyph, items:b.items, slots:b.slots, sealed:b.sealed,
        fillDisplay:b.fillDisplay, status:b.status, door:b.door, riseT:b.riseT, destroyT:b.destroyT||0})),
      aliens,
    };
  }
  // Saves run one after another; the returned promise settles once this save is written.
  function save(){
    if(!canSave()) return chain;
    const g=gen, snap=snapshot();
    chain = chain.then(async ()=>{
      try{
        const str=await encode(snap);
        if(g===gen) localStorage.setItem(KEY, str);  // a clear() while encoding wins
      }catch(e){ /* storage full / blocked: keep playing */ }
    });
    return chain;
  }
  function clear(){ gen++; try{ localStorage.removeItem(KEY); }catch(e){} }
  async function load(){
    let str=null;
    try{ str=localStorage.getItem(KEY); }catch(e){ return null; }
    if(!str) return null;
    try{
      const d=await decode(str);
      if(!d || d.v!==VERSION || (d.mode||'o2')!==MODE.id) throw new Error('version');
      return d;
    }catch(e){ clear(); return null; }
  }
  const canSave = () => state.phase==='playing' && !state.breaching;
  function tick(dt){
    if(!canSave()){ timer=0; return; }
    timer+=dt;
    if(timer>=INTERVAL){ timer=0; save(); }
  }
  const flush = () => { if(canSave()) save(); };
  document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='hidden') flush(); });
  window.addEventListener('pagehide', flush);
  return {save, clear, load, tick, snapshot};
})();

function sendAlienOffscreen(a){
  a.state='settled'; a.walkPhase='gap'; a.waitTimer=ALIEN_TRACK_GAP_SECONDS; a.track=1;
  a.fvx=a.fvy=0; a.kicked=false; a.fallToTrack2=false; a.hidingInBarrel=null; a.hideJumpOut=false;
  a.scale=a.targetScale=ALIEN_TRACK1_SCALE;
  a.x=a.baseX = a.walksReverse ? -ALIEN_TRACK_EDGE_MARGIN*3 : W + ALIEN_TRACK_EDGE_MARGIN*3;
  a.y=a.baseY = layout.floorBottom - a.size*0.4;
}
function restoreGame(d){
  state.sector=d.sector;
  document.getElementById('sectorValue').textContent = String(d.sector).padStart(2,'0');
  state.hull=d.hull; renderHull();
  // Battle damage as it was (a save from before it was tracked gets fresh marks to match the hull).
  state.scars = Array.isArray(d.scars) ? d.scars : [];
  state.scarGroup = state.scars.reduce((m,s)=>Math.max(m, s.group), 0);
  syncDamageMarks(); paintBackground();
  state.irisOpen=d.irisOpen; state.irisTarget=d.irisTarget; state.leverDown=!!d.leverDown;
  state.nebulaHue=d.nebulaHue; state.nebulaBlobs=makeNebula(state.nebulaHue);
  state.alienSpawnedThisSector=!!d.alienSpawnedThisSector;
  state.alienCloneCounters=d.alienCloneCounters||{};
  state.particles=[]; state.rocks=[]; state.held=null; state.breaching=false; state.transition=null;

  state.barrels.forEach((b,i)=>{
    const s=d.barrels[i]||{};
    endSlotPeek(b);
    Object.assign(b, {value:s.value||null, text:s.text||null, glyph:s.glyph||s.pie||null, items:s.items||[], slots:s.slots||0, sealed:!!s.sealed,
      fillDisplay:s.fillDisplay||0, status:s.status||'ready', door:s.door||0, riseT:s.riseT||0, destroyT:s.destroyT||0,
      flashT:0, sealT:0});
    if(b.sealed){ b.status='gone'; b.door=0; }      // sealed = already hauled away by the arm
    else if(b.status==='carried' || b.status==='gone'){ b.status='rising'; b.riseT=0; b.door=0; }
  });
  resetArm();
  updateBarrelDots();

  // Aliens: rebuild objects, then relink stacks by id.
  const sx = d.W ? W/d.W : 1, sy = d.H ? H/d.H : 1;
  const imgs = {}, byId = {};
  const aliens = d.aliens.map(o=>{
    const a = Object.assign(createAlien(true), o);
    a.x*=sx; a.baseX*=sx; a.y*=sy; a.baseY*=sy;
    if(ALIEN_FACE_MODE==='gravatar'){
      // same face as before; clones share one image
      a.avatarLoaded=false; a.avatarFailed=false;
      if(o.avatarSrc){
        if(!imgs[o.avatarSrc]){
          const img=new Image(), group=[];
          img.onload=()=>group.forEach(x=>x.avatarLoaded=true);
          img.onerror=()=>group.forEach(x=>{x.avatarLoaded=false; x.avatarFailed=true;});
          img.src=o.avatarSrc; imgs[o.avatarSrc]={img, group};
        }
        a.avatarImg=imgs[o.avatarSrc].img; imgs[o.avatarSrc].group.push(a);
      } else loadAlienAvatar(a);
    }
    delete a.avatarSrc;
    byId[a.id]=a;
    return a;
  });
  aliens.forEach(a=>{
    a.ridingOn = a.ridingOn ? byId[a.ridingOn]||null : null;
    a.rider = a.rider ? byId[a.rider]||null : null;
  });
  aliens.forEach(a=>{
    if(a.ridingOn && a.ridingOn.rider!==a) a.ridingOn=null;
    if(a.rider && a.rider.ridingOn!==a) a.rider=null;
    a.borrowed=false; a.vel=null;
    if(a.state==='held'){ a.state='falling'; a.fvx=0; a.fvy=0; }   // the beam lets go
    if(a.state==='jammed' || a.state==='abducted') sendAlienOffscreen(a);
    if(a.walkPhase==='riding' && !a.ridingOn) sendAlienOffscreen(a);
    if(a.walkPhase==='hiding' && !(state.barrels[a.hidingInBarrel] && state.barrels[a.hidingInBarrel].status==='ready')) sendAlienOffscreen(a);
    const n=parseInt(String(a.id).replace(/\D/g,''),10);
    if(n>=ROCK_ID) ROCK_ID=n+1;
  });
  state.aliens=aliens;
  updateAlienStacks(0);
  state.spawnTimer=0;
  for(let i=0;i<4;i++) trySpawnRandom();
}

let pendingSave=null;
SaveGame.load().then(d=>{
  const auto = takeAutoResumeFlag();
  if(!d || state.phase!=='intro') return;
  pendingSave=d;
  // Reloaded by the live-update check: drop straight back into the game.
  if(auto){ beginShift(true, true); return; }
  document.getElementById('startBtn').textContent='RESUME SHIFT · SECTOR '+String(d.sector).padStart(2,'0');
  document.getElementById('newShiftBtn').classList.remove('hidden');
});
function beginShift(resume, auto){
  if(!auto) AudioEngine.init(); // auto-resume has no click to unlock audio; the first tap does it
  takeAutoResumeFlag();
  document.getElementById('startOverlay').classList.add('hidden');
  state.phase='playing';
  if(resume && pendingSave){
    try{ restoreGame(pendingSave); pendingSave=null; return; }
    catch(e){ console.warn('Save could not be restored', e); SaveGame.clear(); }
  }
  pendingSave=null;
  SaveGame.clear();
  state.aliens=[]; state.alienCloneCounters={}; state.leverDown=false; state.irisOpen=1; state.irisTarget=1;
  state.hull=100; renderHull();
  state.scars=[]; paintBackground();
  startLevel(1);
}
document.getElementById('startBtn').addEventListener('click', ()=>beginShift(true));
function takeAutoResumeFlag(){
  try{ const f=sessionStorage.getItem('cargoSort.autoResume'); sessionStorage.removeItem('cargoSort.autoResume'); return f==='1'; }
  catch(e){ return false; }
}

// ---------- Live update (GitHub Pages only) ----------
// Every 30s, re-fetch this page and the engine (both cache-busted past GitHub's CDN) and compare them
// with what this tab actually loaded. If either differs: save, then reload (also cache-busted; the
// page's loader passes the same ?v= on to the engine) and resume automatically. The reload waits
// while something is in the tractor beam so a drag isn't cut off. If a reload still doesn't bring in
// that exact new version (CDN lag, a browser extension editing the page), it won't reload for it
// again, so it can never get into a reload loop.
(()=>{
  if(location.origin!=='https://neonms92.github.io' || !location.pathname.startsWith('/cargo-sort/') || !ENGINE_SRC) return;
  if(/[?&]v=\d+/.test(location.search)) history.replaceState(null, '', location.pathname + location.hash); // tidy the address bar
  const KEY = 'cargoSort.updateTarget:' + location.pathname;
  const enginePath = new URL(ENGINE_SRC).pathname;
  const hash = str => { let h=0x811c9dc5; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,0x01000193); } return (h>>>0).toString(36) + ':' + str.length; };
  const getText = async (url, opts) => { const r = await fetch(url, opts); if(!r.ok) throw new Error(r.status); return r.text(); };
  // The engine text this tab is running: the browser just downloaded it, so this comes from its cache.
  let engineBase = null;
  const loadBase = () => getText(ENGINE_SRC, {cache:'force-cache'}).then(t=>{ engineBase=t; }, ()=>{});
  loadBase();
  let triedTarget = null;
  try{ triedTarget = sessionStorage.getItem(KEY); }catch(e){}
  let updating = false;
  async function check(){
    if(updating || document.visibilityState==='hidden') return;
    if(engineBase===null){ await loadBase(); if(engineBase===null) return; }
    let page, engine;
    try{
      const v = '?v=' + Date.now();
      [page, engine] = await Promise.all([
        getText(location.pathname + v, {cache:'no-store'}),
        getText(enginePath + v, {cache:'no-store'}),
      ]);
    }catch(e){ return; }
    const freshPage = pageFingerprint(new DOMParser().parseFromString(page, 'text/html'));
    if(freshPage === PAGE_FP && engine === engineBase) return;
    const target = hash(freshPage + '\u0001' + engine);
    if(target === triedTarget) return;           // already reloaded for this one; it didn't take
    updating = true;
    while(state.held) await new Promise(r=>setTimeout(r, 250));
    if(state.phase==='playing' && !state.breaching){
      await SaveGame.save();
      try{ sessionStorage.setItem('cargoSort.autoResume','1'); }catch(e){}
    }
    try{ sessionStorage.setItem(KEY, target); }catch(e){}
    location.replace(location.pathname + '?v=' + Date.now() + location.hash);
  }
  setInterval(check, 30000);
})();
document.getElementById('newShiftBtn').addEventListener('click', ()=>beginShift(false));
document.getElementById('restartBtn').addEventListener('click', ()=>{
  document.getElementById('endOverlay').classList.add('hidden');
  state.hull=100; renderHull();
  state.scars=[]; paintBackground();
  state.particles=[];
  state.rocks=[];
  state.aliens=[];
  state.alienCloneCounters={};
  state.leverDown=false;
  state.breaching=false;
  state.irisOpen=1; state.irisTarget=1;
  state.phase='playing';
  startLevel(1);
});
const audioToggle=document.getElementById('audioToggle');
let audioOn=true;
audioToggle.addEventListener('click', ()=>{
  audioOn=!audioOn;
  AudioEngine.setEnabled(audioOn);
  audioToggle.classList.toggle('off', !audioOn);
  document.getElementById('audioLabel').textContent = audioOn? 'COMMS ON':'COMMS OFF';
});
document.getElementById('secretSpawnBtn').addEventListener('click', ()=>{
  // Debug spawn: straight into the off-screen gap (as if it had just walked off track 1), so it
  // gets the checkpoint rolls after a couple of seconds and then walks in along the far track.
  if(state.phase==='playing'){
    const a=createAlien();
    a.state='settled'; a.walkPhase='gap'; a.waitTimer=2;  // short wait so it's quick to test with
    a.track=1; a.greeted=true; a.walksReverse=Math.random()<0.5;
    a.scale=a.targetScale=ALIEN_TRACK1_SCALE;
    a.x=a.baseX = a.walksReverse ? -ALIEN_TRACK_EDGE_MARGIN*3 : W + ALIEN_TRACK_EDGE_MARGIN*3;
    a.y=a.baseY = layout.floorBottom - a.size*0.4;
    state.aliens.push(a);
  }
});

requestAnimationFrame(loop);

})();
