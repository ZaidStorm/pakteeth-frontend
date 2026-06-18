/**
 * city-globe.js - Realistic Globe with Interactive Pakistan Map Overlay
 */

(function(){
const SC={Critical:'#ff3a1a',High:'#ffaa00',Moderate:'#cc66ff',Stable:'#22aaff',Low:'#22dd99'};
const SBG={Critical:'rgba(255,50,20,.22)',High:'rgba(255,160,0,.22)',Moderate:'rgba(180,80,255,.22)',Stable:'rgba(0,160,255,.22)',Low:'rgba(0,210,130,.22)'};

const CITY_COORDS={
  'Sahiwal':{lat:30.668,lon:73.111},'Lahore':{lat:31.520,lon:74.359},
  'Karachi':{lat:24.861,lon:67.001},'Islamabad':{lat:33.684,lon:73.048},
  'Faisalabad':{lat:31.450,lon:73.135},'Multan':{lat:30.158,lon:71.525},
  'Rawalpindi':{lat:33.565,lon:73.017},'Peshawar':{lat:34.015,lon:71.525},
  'Quetta':{lat:30.180,lon:66.975},'Gujranwala':{lat:32.188,lon:74.195},
  'Sialkot':{lat:32.493,lon:74.531},'Bahawalpur':{lat:29.354,lon:71.691},
  'Sargodha':{lat:32.084,lon:72.671},'Hyderabad':{lat:25.396,lon:68.358},
  'Sukkur':{lat:27.724,lon:68.817},'Larkana':{lat:27.559,lon:68.212},
  'Sheikhupura':{lat:31.713,lon:73.978},'Jhang':{lat:31.270,lon:72.317},
  'Rahim Yar Khan':{lat:28.420,lon:70.303},'Mardan':{lat:34.199,lon:72.044},
  'Gujrat':{lat:32.574,lon:74.075},'Kasur':{lat:31.116,lon:74.447},
  'Abbottabad':{lat:34.149,lon:73.199}
};

const COUNTRIES = [
  {
    id:'pakistan', label:'Pakistan', hasPatients:true,
    color:'#c9aa52', hoverColor:'#f0cc60',
    poly:[[60,24],[62,22],[66,20],[68,24],[70,28],[70,32],[72,36],[74,36],[76,34],[76,36],[74,38],[72,36],[70,36],[68,36],[66,34],[64,32],[62,28],[60,24]]
  },
  {id:'india',label:'India',hasPatients:false,color:'#3d7a34',hoverColor:'#52a446',poly:[[76,34],[80,34],[82,28],[86,24],[90,22],[92,26],[90,28],[88,24],[86,20],[82,14],[80,10],[78,8],[76,6],[74,10],[70,14],[68,24],[70,28],[70,32],[72,36],[74,36],[76,34]]},
  {id:'china',label:'China',hasPatients:false,color:'#4a6e8a',hoverColor:'#5e8eae',poly:[[76,36],[80,36],[90,42],[100,42],[110,40],[120,48],[130,46],[128,40],[122,32],[116,24],[108,18],[100,18],[96,24],[88,28],[82,30],[76,34],[76,36]]},
  {id:'iran',label:'Iran',hasPatients:false,color:'#7a5a3a',hoverColor:'#9a7050',poly:[[44,38],[48,38],[54,36],[60,36],[62,30],[60,24],[58,24],[54,28],[48,30],[44,34],[44,38]]},
  {id:'afghanistan',label:'Afghanistan',hasPatients:false,color:'#8a7040',hoverColor:'#aa9050',poly:[[60,36],[64,36],[68,36],[70,36],[72,36],[70,32],[70,28],[68,24],[66,28],[62,30],[60,34],[60,36]]},
];

const WORLD_LAND=[
  [[-9,36],[0,43],[10,54],[20,54],[30,60],[40,65],[50,68],[60,64],[70,56],[80,52],[90,55],[100,52],[110,48],[120,50],[130,48],[140,44],[145,40],[140,36],[130,32],[120,30],[110,22],[105,18],[100,10],[105,5],[112,2],[115,-4],[120,-8],[115,-10],[108,-8],[102,-2],[100,4],[96,8],[90,22],[80,28],[72,22],[68,24],[64,30],[60,38],[50,42],[42,38],[36,44],[28,46],[20,46],[10,48],[0,46],[-6,44],[-9,38]],
  [[-18,15],[-16,22],[-12,26],[-6,34],[0,38],[10,38],[18,36],[26,32],[32,28],[36,20],[42,12],[44,2],[42,-6],[36,-18],[28,-32],[22,-34],[18,-28],[14,-22],[12,-18],[8,-4],[0,6],[-4,10],[-10,16],[-16,20],[-18,15]],
  [[-170,62],[-155,70],[-140,70],[-130,58],[-126,52],[-120,46],[-110,40],[-100,30],[-92,18],[-86,14],[-80,10],[-76,8],[-80,4],[-76,0],[-70,10],[-64,18],[-62,12],[-68,8],[-76,6],[-80,2],[-82,10],[-84,14],[-88,18],[-94,28],[-100,40],[-104,50],[-108,58],[-120,64],[-140,60],[-150,60],[-160,56],[-165,60],[-170,62]],
  [[-80,10],[-76,8],[-70,4],[-64,2],[-60,-4],[-52,-10],[-44,-22],[-40,-20],[-38,-14],[-34,-8],[-36,0],[-50,0],[-52,-2],[-60,-14],[-62,-22],[-68,-30],[-72,-40],[-68,-50],[-66,-54],[-70,-52],[-76,-46],[-74,-40],[-68,-32],[-66,-20],[-70,-14],[-76,-6],[-80,2],[-80,10]],
  [[114,-26],[118,-20],[122,-16],[128,-14],[136,-12],[142,-12],[148,-18],[152,-24],[152,-30],[148,-38],[144,-40],[140,-38],[136,-36],[130,-32],[126,-28],[120,-28],[116,-32],[114,-26]]
];

const PAK_BORDER=[
  [60.87,29.83],[62.55,28.53],[63.17,27.25],[63.32,26.67],[63.00,26.08],
  [62.00,25.22],[61.60,24.58],[61.50,23.90],[62.00,23.00],[63.00,22.00],
  [65.00,21.00],[67.00,20.50],[68.00,21.00],[68.75,21.59],[68.80,22.00],
  [69.50,22.50],[70.00,22.50],[70.80,22.00],[71.00,22.20],[71.50,22.80],
  [72.00,22.50],[72.50,22.50],[73.00,23.00],[73.50,24.00],[74.50,24.00],
  [74.50,25.00],[76.00,25.50],[77.00,26.50],[77.00,28.00],[76.50,29.50],
  [76.00,30.00],[75.50,31.00],[75.00,32.00],[74.00,32.50],[73.00,33.00],
  [72.00,33.00],[71.00,34.00],[70.00,34.00],[69.00,34.50],[68.00,35.50],
  [67.00,36.00],[66.00,36.00],[64.50,35.00],[63.00,35.00],[62.00,35.50],
  [60.87,35.00],[60.87,34.00],[60.87,32.00],[60.87,30.50],[60.87,29.83]
];

// Globe state
const gc=document.getElementById('gc');
const gctx=gc.getContext('2d');
const gw=document.getElementById('gw');
let W=0,H=0,R=0,CX=0,CY=0;
let yaw=1.1,pitch=0.15,isDrag=false,px=0,py=0,autoSpin=true,spinTimer=null;
let hovCountry=null,t=0,lastT=0;
const FPS=38,FMS=1000/FPS;

// Flat map state
const mc=document.getElementById('map-canvas');
const mctx=mc.getContext('2d');
let MW=0,MH=0;
let cityData=[];
let totalP=0,maxP=1;
let hovPin=null;
const pakMapImg = new Image();
pakMapImg.src = '../../assets/map/pak-map.png';

function resizeGlobe(){
  if (!gw) return;
  const rect=gw.getBoundingClientRect();
  W=gc.width=rect.width; H=gc.height=460;
  R=Math.min(W,H)*0.37; CX=W/2; CY=H/2;
}

function resizeMap(){
  const body=document.getElementById('ov-body');
  if (!body) return;
  const rect=body.getBoundingClientRect();
  MW=mc.width=rect.width; MH=mc.height=rect.height;
  drawFlatMap();
}

function ll2v(lat,lon){
  const phi=(90-lat)*Math.PI/180, lam=(lon+180)*Math.PI/180;
  return{x:-Math.sin(phi)*Math.cos(lam),y:Math.cos(phi),z:Math.sin(phi)*Math.sin(lam)};
}
function ry(v,a){return{x:v.x*Math.cos(a)+v.z*Math.sin(a),y:v.y,z:-v.x*Math.sin(a)+v.z*Math.cos(a)};}
function rx(v,a){return{x:v.x,y:v.y*Math.cos(a)-v.z*Math.sin(a),z:v.y*Math.sin(a)+v.z*Math.cos(a)};}
function tv(v){return rx(ry(v,yaw),pitch);}
function proj(v){const fov=2.6,z=v.z+fov;return{x:v.x/z*R*fov+CX,y:-v.y/z*R*fov+CY,z:v.z};}

function hexRgb(h){return[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];}

function buildCityData(patients){
  const stats={};
  if(patients&&patients.length){
    patients.forEach(p=>{const c=(p.city||'').trim();if(c)stats[c]=(stats[c]||0)+1;});
  } else {
    Object.assign(stats,{Sahiwal:5,Lahore:22,Karachi:18,Islamabad:9,Faisalabad:14,Multan:11,Rawalpindi:7,Peshawar:6,Quetta:4,Gujranwala:8,Sialkot:5,Bahawalpur:6,Sargodha:4,Hyderabad:9,Sukkur:3,Larkana:2,Sheikhupura:3,Jhang:3,'Rahim Yar Khan':2,Mardan:2,Gujrat:4,Kasur:2,Abbottabad:3});
  }
  totalP=Object.values(stats).reduce((a,b)=>a+b,0);
  maxP=Math.max(1,...Object.values(stats));
  cityData=Object.entries(stats).map(([name,count])=>{
    const co=CITY_COORDS[name]||{lat:30+Math.random()*3,lon:70+Math.random()*3};
    const ratio=count/maxP;
    let status='Stable';
    if(ratio>0.8||count>20)status='Critical';
    else if(ratio>0.5||count>10)status='High';
    else if(ratio>0.2||count>5)status='Moderate';
    else if(count<2)status='Low';
    return{name,count,ratio,status,lat:co.lat,lon:co.lon,pct:((count/totalP)*100).toFixed(1),col:SC[status]};
  });
  buildLegend();
}

function buildLegend(){
  const legendEl = document.getElementById('legend');
  if (!legendEl) return;
  const used=new Set(cityData.map(c=>c.status));
  legendEl.innerHTML=[...used].map(s=>
    `<div class="li"><div class="ld" style="background:${SC[s]}"></div>${s}</div>`).join('');
}

// ── GLOBE DRAWING ────────────────────────────────────────────────
function drawGlobeFrame(now){
  requestAnimationFrame(drawGlobeFrame);
  if(document.getElementById('overlay').classList.contains('show'))return;
  if(now-lastT<FMS)return;
  lastT=now;
  t+=0.016;
  if(autoSpin)yaw+=0.0018;

  gctx.clearRect(0,0,W,H);

  // Space bg
  const sp=gctx.createRadialGradient(CX*.7,CY*.6,0,CX,CY,W*.8);
  sp.addColorStop(0,'#0d1b3e');sp.addColorStop(0.6,'#060c1f');sp.addColorStop(1,'#020408');
  gctx.fillStyle=sp;gctx.fillRect(0,0,W,H);

  // Stars
  for(let i=0;i<110;i++){
    const sx=((i*137.5+50)%W),sy=((i*79.3+30)%H);
    const tw=0.3+0.7*Math.abs(Math.sin(t*0.4+i));
    gctx.globalAlpha=tw*0.55;
    gctx.beginPath();gctx.arc(sx,sy,0.6,0,Math.PI*2);gctx.fillStyle='#fff';gctx.fill();
  }
  gctx.globalAlpha=1;

  // Atmosphere halo
  const ah=gctx.createRadialGradient(CX,CY,R*.92,CX,CY,R*1.2);
  ah.addColorStop(0,'rgba(60,140,255,0)');ah.addColorStop(0.5,'rgba(60,160,255,.07)');
  ah.addColorStop(0.85,'rgba(100,180,255,.18)');ah.addColorStop(1,'rgba(60,120,255,0)');
  gctx.beginPath();gctx.arc(CX,CY,R*1.2,0,Math.PI*2);gctx.fillStyle=ah;gctx.fill();

  // Globe clip
  gctx.save();
  gctx.beginPath();gctx.arc(CX,CY,R,0,Math.PI*2);gctx.clip();

  // Ocean
  const oc=gctx.createRadialGradient(CX-R*.2,CY-R*.25,0,CX,CY,R);
  oc.addColorStop(0,'#3a8fce');oc.addColorStop(0.5,'#1a6aaa');oc.addColorStop(0.9,'#0a3870');oc.addColorStop(1,'#041828');
  gctx.fillStyle=oc;gctx.fillRect(CX-R,CY-R,R*2,R*2);

  // Grid
  gctx.strokeStyle='rgba(255,255,255,.06)';gctx.lineWidth=0.5;
  for(let lat=-80;lat<=80;lat+=20){
    gctx.beginPath();let f=true;
    for(let lo=-180;lo<=180;lo+=3){const rv=tv(ll2v(lat,lo));if(rv.z<0){f=true;continue;}const p=proj(rv);f?gctx.moveTo(p.x,p.y):gctx.lineTo(p.x,p.y);f=false;}
    gctx.stroke();
  }
  for(let lo=-180;lo<=180;lo+=20){
    gctx.beginPath();let f=true;
    for(let lat=-90;lat<=90;lat+=3){const rv=tv(ll2v(lat,lo));if(rv.z<0){f=true;continue;}const p=proj(rv);f?gctx.moveTo(p.x,p.y):gctx.lineTo(p.x,p.y);f=false;}
    gctx.stroke();
  }

  // World land base
  function drawPoly3d(poly,fill,stroke){
    gctx.beginPath();let f=true,lv=false;
    for(const [lo,la] of poly){const rv=tv(ll2v(la,lo));const vis=rv.z>-0.05;if(!vis){f=true;lv=false;continue;}const p=proj(rv);(f||!lv)?gctx.moveTo(p.x,p.y):gctx.lineTo(p.x,p.y);f=false;lv=true;}
    gctx.closePath();gctx.fillStyle=fill;gctx.fill();
    if(stroke){gctx.strokeStyle=stroke;gctx.lineWidth=0.4;gctx.stroke();}
  }
  WORLD_LAND.forEach(p=>drawPoly3d(p,'#3d6b34','rgba(255,255,255,.06)'));

  // Country highlights
  COUNTRIES.forEach(co=>{
    const isHov=hovCountry===co.id;
    const fill=isHov?co.hoverColor:co.color;
    const alpha=co.hasPatients?(isHov?1:0.9):0.7;
    gctx.globalAlpha=alpha;
    drawPoly3d(co.poly,fill,isHov?'rgba(255,255,150,.5)':'rgba(255,255,255,.1)');
    gctx.globalAlpha=1;
    if(isHov&&co.hasPatients){
      // label
      let sumX=0,sumY=0,cnt=0;
      for(const [lo,la] of co.poly){const rv=tv(ll2v(la,lo));if(rv.z<0)continue;const p=proj(rv);sumX+=p.x;sumY+=p.y;cnt++;}
      if(cnt>0){
        const lx=sumX/cnt,ly=sumY/cnt;
        gctx.font='bold 11px sans-serif';gctx.textAlign='center';
        gctx.fillStyle='rgba(255,240,160,.95)';gctx.fillText(co.label,lx,ly-2);
        gctx.font='9px sans-serif';gctx.fillStyle='rgba(255,220,100,.7)';
        gctx.fillText('click to explore',lx,ly+10);
      }
    }
  });

  // Ice caps
  const arc=[];for(let lo=-180;lo<=180;lo+=8)arc.push([lo,80]);arc.push([-180,90],[180,90]);
  drawPoly3d(arc,'#dce8f5');
  const ant=[];for(let lo=-180;lo<=180;lo+=8)ant.push([lo,-75]);ant.push([-180,-90],[180,-90]);
  drawPoly3d(ant,'#d0e4f2');

  // Specular
  const sh=gctx.createRadialGradient(CX-R*.28,CY-R*.3,0,CX-R*.1,CY-R*.1,R*.9);
  sh.addColorStop(0,'rgba(255,255,255,.2)');sh.addColorStop(0.25,'rgba(255,255,255,.07)');sh.addColorStop(0.6,'rgba(255,255,255,.01)');sh.addColorStop(1,'rgba(0,0,0,0)');
  gctx.fillStyle=sh;gctx.fillRect(CX-R,CY-R,R*2,R*2);

  // Shadow terminator
  const sd=gctx.createRadialGradient(CX+R*.3,CY+R*.2,R*.1,CX,CY,R);
  sd.addColorStop(0,'rgba(0,0,0,0)');sd.addColorStop(0.65,'rgba(0,0,0,0)');sd.addColorStop(0.85,'rgba(0,8,24,.4)');sd.addColorStop(1,'rgba(0,4,16,.78)');
  gctx.fillStyle=sd;gctx.fillRect(CX-R,CY-R,R*2,R*2);

  gctx.restore();

  // Rim
  const rim=gctx.createRadialGradient(CX,CY,R*.88,CX,CY,R*1.02);
  rim.addColorStop(0,'rgba(0,0,0,0)');rim.addColorStop(0.8,'rgba(50,130,255,.09)');rim.addColorStop(1,'rgba(0,0,0,0)');
  gctx.beginPath();gctx.arc(CX,CY,R*1.02,0,Math.PI*2);gctx.fillStyle=rim;gctx.fill();
}

// ── GLOBE INTERACTION ────────────────────────────────────────────
function getHoveredCountry(mx,my){
  for(const co of COUNTRIES){
    let sumVis=0,cnt=0;
    for(const [lo,la] of co.poly){const rv=tv(ll2v(la,lo));if(rv.z>-0.05)sumVis++;cnt++;}
    if(sumVis/cnt<0.3)continue;
    // crude centroid hit test
    let cxs=0,cys=0,n=0;
    for(const [lo,la] of co.poly){const rv=tv(ll2v(la,lo));if(rv.z<0)continue;const p=proj(rv);cxs+=p.x;cys+=p.y;n++;}
    if(!n)continue;
    const radius=R*0.1;
    if(Math.hypot(mx-cxs/n,my-cys/n)<radius+20)return co.id;
  }
  return null;
}

gc.addEventListener('mousedown',e=>{isDrag=true;px=e.clientX;py=e.clientY;autoSpin=false;gc.classList.add('drag');clearTimeout(spinTimer);});
gc.addEventListener('touchstart',e=>{isDrag=true;px=e.touches[0].clientX;py=e.touches[0].clientY;autoSpin=false;clearTimeout(spinTimer);},{passive:true});
window.addEventListener('mouseup',e=>{
  if(isDrag&&Math.hypot(e.clientX-px,e.clientY-py)<6){
    const rect=gc.getBoundingClientRect();
    const hc=getHoveredCountry(e.clientX-rect.left,e.clientY-rect.top);
    const co=COUNTRIES.find(c=>c.id===hc);
    if(co&&co.hasPatients)openOverlay(co);
  }
  isDrag=false;gc.classList.remove('drag');
  spinTimer=setTimeout(()=>autoSpin=true,4500);
});
window.addEventListener('touchend',()=>{isDrag=false;spinTimer=setTimeout(()=>autoSpin=true,4500);});
window.addEventListener('mousemove',e=>{
  if(isDrag){
    yaw+=(e.clientX-px)*.005;pitch+=(e.clientY-py)*.005;
    pitch=Math.max(-1.3,Math.min(1.3,pitch));
    px=e.clientX;py=e.clientY;hovCountry=null;return;
  }
  const rect=gc.getBoundingClientRect();
  if (!rect) return;
  const hc=getHoveredCountry(e.clientX-rect.left,e.clientY-rect.top);
  hovCountry=hc;
  const co=COUNTRIES.find(c=>c.id===hc);
  gc.style.cursor=(co&&co.hasPatients)?'pointer':'grab';
});

// ── FLAT MAP ─────────────────────────────────────────────────────
// Pakistan bounding box for projection (refined for pak-map.png)
const PAK_LON_MIN = 59.8;
const PAK_LON_MAX = 79.5;
const PAK_LAT_MIN = 22.5;
const PAK_LAT_MAX = 38.5;

function ll2map(lat, lon) {
    const body = document.getElementById('ov-body');
    if (!body) return { x: 0, y: 0 };
    
    // Calculate drawing rect
    const imgRatio = pakMapImg.width / pakMapImg.height || 1;
    const canvasRatio = MW / MH;
    let drawW, drawH, dx, dy;
    
    if (imgRatio > canvasRatio) {
        drawW = MW;
        drawH = MW / imgRatio;
        dx = 0;
        dy = (MH - drawH) / 2;
    } else {
        drawH = MH;
        drawW = MH * imgRatio;
        dy = 0;
        dx = (MW - drawW) / 2;
    }

    // Map Lat/Lon to normalized 0-1 within the Pakistani grid
    const normX = (lon - PAK_LON_MIN) / (PAK_LON_MAX - PAK_LON_MIN);
    const normY = 1 - (lat - PAK_LAT_MIN) / (PAK_LAT_MAX - PAK_LAT_MIN);
    
    return {
        x: dx + normX * drawW,
        y: dy + normY * drawH
    };
}

function drawFlatMap() {
    if (!MW || !MH) return;
    mctx.clearRect(0, 0, MW, MH);

    // Background
    mctx.fillStyle = '#0a1628';
    mctx.fillRect(0, 0, MW, MH);

    // Map Image
    let dx = 0, dy = 0, drawW = MW, drawH = MH;
    if (pakMapImg.complete) {
        const imgRatio = pakMapImg.width / pakMapImg.height;
        const canvasRatio = MW / MH;
        if (imgRatio > canvasRatio) {
            drawW = MW;
            drawH = MW / imgRatio;
            dx = 0;
            dy = (MH - drawH) / 2;
        } else {
            drawH = MH;
            drawW = MH * imgRatio;
            dy = 0;
            dx = (MW - drawW) / 2;
        }
        mctx.globalAlpha = 0.55;
        mctx.drawImage(pakMapImg, dx, dy, drawW, drawH);
        mctx.globalAlpha = 1.0;
    }

    // Pakistan border outline
    mctx.beginPath();
    let first = true;
    for (const [lo, la] of PAK_BORDER) {
        const p = ll2map(la, lo);
        first ? mctx.moveTo(p.x, p.y) : mctx.lineTo(p.x, p.y);
        first = false;
    }
    mctx.closePath();
    mctx.strokeStyle = 'rgba(220, 200, 100, 0.35)';
    mctx.lineWidth = 1.8;
    mctx.stroke();

    // Province labels
    const provLabels = [
        { name: 'KPK', lat: 34.4, lon: 71.2 },
        { name: 'Punjab', lat: 31.0, lon: 72.5 },
        { name: 'Sindh', lat: 26.2, lon: 68.5 },
        { name: 'Balochistan', lat: 28.5, lon: 65.5 },
        { name: 'Gilgit-Baltistan', lat: 35.8, lon: 74.8 }
    ];
    mctx.font = 'bold 10px sans-serif';
    mctx.textAlign = 'center';
    mctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    provLabels.forEach(pl => {
        const p = ll2map(pl.lat, pl.lon);
        mctx.fillText(pl.name.toUpperCase(), p.x, p.y);
    });

    // Connection lines
    cityData.forEach((ca, i) => {
        const neighbors = [...cityData].sort((a, b) => {
            const d = (c, d2) => Math.hypot(c.lat - d2.lat, c.lon - d2.lon);
            return d(ca, a) - d(ca, b);
        }).slice(1, 3);
        neighbors.forEach(cb => {
            const pa = ll2map(ca.lat, ca.lon), pb = ll2map(cb.lat, cb.lon);
            mctx.beginPath(); mctx.moveTo(pa.x, pa.y); mctx.lineTo(pb.x, pb.y);
            const hot = ca.ratio > 0.3 || cb.ratio > 0.3;
            mctx.strokeStyle = hot ? 'rgba(255, 160, 60, 0.15)' : 'rgba(80, 160, 255, 0.1)';
            mctx.lineWidth = hot ? 1 : 0.5; mctx.stroke();
        });
    });

    // City pins
    cityData.forEach((c, i) => {
        const p = ll2map(c.lat, c.lon);
        const isHov = hovPin === i;
        const pinH = 16 + c.ratio * 20;
        const dotR = 5 + c.ratio * 8;
        const [r, g, b] = hexRgb(c.col);

        mctx.beginPath(); mctx.ellipse(p.x, p.y + 2, dotR * 0.8, 3, 0, 0, Math.PI * 2);
        mctx.fillStyle = 'rgba(0,0,0,0.4)'; mctx.fill();

        mctx.beginPath(); mctx.moveTo(p.x, p.y); mctx.lineTo(p.x, p.y - pinH);
        mctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.8)`;
        mctx.lineWidth = isHov ? 2.5 : 1.5; mctx.stroke();

        const glow = mctx.createRadialGradient(p.x, p.y - pinH, 0, p.x, p.y - pinH, dotR * 3);
        glow.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${isHov ? 0.7 : 0.3})`);
        glow.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        mctx.beginPath(); mctx.arc(p.x, p.y - pinH, dotR * 3, 0, Math.PI * 2);
        mctx.fillStyle = glow; mctx.fill();

        mctx.beginPath(); mctx.arc(p.x, p.y - pinH, dotR, 0, Math.PI * 2);
        mctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${isHov ? 1 : 0.9})`; mctx.fill();
        mctx.strokeStyle = '#fff'; mctx.lineWidth = isHov ? 2 : 1; mctx.stroke();

        mctx.font = `${isHov ? 'bold ' : ''}${isHov ? 12 : 10}px sans-serif`;
        mctx.textAlign = 'center'; mctx.fillStyle = isHov ? '#fff' : 'rgba(255,255,255,0.85)';
        mctx.shadowBlur = isHov ? 10 : 0; mctx.shadowColor = `rgba(${r},${g},${b},0.8)`;
        mctx.fillText(c.name, p.x, p.y - pinH - dotR - 6);
        mctx.shadowBlur = 0;

        if (isHov || c.ratio > 0.6) {
            mctx.font = 'bold 9px sans-serif';
            mctx.fillStyle = c.col;
            mctx.fillText(c.count + ' pts', p.x, p.y - pinH - dotR - 18);
        }
    });
}

// Map pin hit test
function getHovPin(mx,my){
  let best=22,hit=null;
  cityData.forEach((c,i)=>{
    const p=ll2map(c.lat,c.lon);
    const pinH=14+c.ratio*18;
    const dotR=4+c.ratio*7;
    const dr=Math.hypot(mx-p.x,my-(p.y-pinH));
    if(dr<dotR+8&&dr<best){best=dr;hit=i;}
  });
  return hit;
}

function showCityTip(c,ex,ey){
  const body=document.getElementById('ov-body');
  if (!body) return;
  const tip=document.getElementById('city-tip');
  if (!tip) return;
  
  const rect=body.getBoundingClientRect();
  const lx=ex-rect.left, ly=ey-rect.top;
  
  document.getElementById('ct-n').textContent=c.name;
  document.getElementById('ct-p').textContent=c.count.toLocaleString();
  document.getElementById('ct-s').textContent=c.pct+'%';
  document.getElementById('ct-c').textContent=c.lat.toFixed(2)+'°N, '+c.lon.toFixed(2)+'°E';
  
  const b=document.getElementById('ct-b');
  b.textContent=c.status;
  b.style.background=SBG[c.status];
  b.style.color=c.col;
  
  document.getElementById('ct-bf').style.width=Math.round(c.ratio*100)+'%';
  document.getElementById('ct-bf').style.background=c.col;
  
  tip.style.display='block';
  const tw = tip.offsetWidth || 185;
  const th = tip.offsetHeight || 150;
  
  let tx = lx + 20;
  if (tx + tw > MW) tx = lx - tw - 20;
  
  // Clamp to bounds
  tx = Math.max(5, Math.min(MW - tw - 5, tx));
  let ty = Math.max(5, Math.min(MH - th - 5, ly - 20));
  
  tip.style.left = tx + 'px';
  tip.style.top = ty + 'px';
}

mc.addEventListener('mousemove',e=>{
  const rect=mc.getBoundingClientRect();
  const mx=e.clientX-rect.left,my=e.clientY-rect.top;
  const hit=getHovPin(mx,my);
  if(hit!==hovPin){hovPin=hit;drawFlatMap();}
  if(hit!==null){showCityTip(cityData[hit],e.clientX,e.clientY);mc.style.cursor='pointer';}
  else{document.getElementById('city-tip').style.display='none';mc.style.cursor='default';}
});
mc.addEventListener('mouseleave',()=>{document.getElementById('city-tip').style.display='none';hovPin=null;drawFlatMap();});

// ── OVERLAY OPEN/CLOSE ───────────────────────────────────────────
function openOverlay(co){
  autoSpin=false;
  const ov=document.getElementById('overlay');
  if (!ov) return;
  document.getElementById('ov-title').textContent=co.label+' — Patient Locations';
  ov.classList.add('show');
  // size map canvas
  setTimeout(()=>{resizeMap();},30);
}

window.closeOverlay=function(){
  const ov = document.getElementById('overlay');
  if (ov) ov.classList.remove('show');
  const tip = document.getElementById('city-tip');
  if (tip) tip.style.display='none';
  autoSpin=true;
};

// ── BOOT ─────────────────────────────────────────────────────────
resizeGlobe();
buildCityData(window.patientsList&&window.patientsList.length?window.patientsList:null);
requestAnimationFrame(drawGlobeFrame);
window.addEventListener('resize',()=>{resizeGlobe();if(document.getElementById('overlay').classList.contains('show'))resizeMap();});

// Refresh data if window.patientsList updates
let pc=0;
const poll=setInterval(()=>{
  if(window.patientsList&&window.patientsList.length){buildCityData(window.patientsList);clearInterval(poll);}
  if(++pc>20)clearInterval(poll);
},800);

// Redraw map when image loads
pakMapImg.onload = () => { if(document.getElementById('overlay').classList.contains('show')) drawFlatMap(); };

})();
