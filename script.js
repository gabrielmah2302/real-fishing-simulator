
(() => {
  "use strict";
  const canvas = document.getElementById("scene");
  const ctx = canvas.getContext("2d", { alpha: false });
  const $ = id => document.getElementById(id);
  const ui = {
    start:$("startBtn"), overlay:$("centerMessage"), cast:$("castBtn"), reel:$("reelBtn"),
    pause:$("pauseBtn"), depth:$("depth"), tension:$("tensionValue"), tensionBar:$("tensionBar"),
    lineStatus:$("lineStatus"), reelValue:$("reelValue"), reelBar:$("reelBar"),
    fishStatus:$("fishStatus"), caught:$("caught"), money:$("money"), alert:$("biteAlert"),
    toast:$("toast"), depthLine:$("lineLength"), clock:$("clock"), message:$("centerMessage")
  };

  let W=0,H=0,dpr=1,last=0,elapsed=0,running=false,paused=false;
  const state = {
    mode:"idle", line:0, maxLine:30, tension:0, reel:0, fish:null, biteTimer:0,
    castTimer:0, fishCount:0, money:0, time:7.5, rod:0, splash:0, toastTimer:0,
    pointerDown:false, keys:{}, lureX:0, lureY:0, particles:[], ripples:[], fishSchool:[]
  };
  const species = [
    {name:"Tilápia",weight:[.4,1.8],strength:.36,speed:.7,value:18,color:"#a7a78c"},
    {name:"Traíra",weight:[1.1,3.8],strength:.67,speed:1.05,value:45,color:"#778d65"},
    {name:"Tucunaré",weight:[1.5,6.5],strength:.9,speed:1.25,value:90,color:"#b5a45e"},
    {name:"Dourado",weight:[2,8],strength:1.12,speed:1.4,value:150,color:"#c59a4d"}
  ];
  const rand=(a,b)=>a+Math.random()*(b-a);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const fmt=n=>n.toFixed(1).replace(".",",");
  function resize(){
    const r=canvas.getBoundingClientRect(); dpr=Math.min(devicePixelRatio||1,1.7);
    W=r.width;H=r.height;canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  new ResizeObserver(resize).observe(canvas); resize();

  function fishShape(x,y,s,color,angle=0,alpha=1){
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.globalAlpha=alpha;
    ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(0,0,s*1.05,s*.43,0,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.moveTo(-s*.85,0);ctx.lineTo(-s*1.45,-s*.48);ctx.lineTo(-s*1.42,s*.48);ctx.closePath();ctx.fill();
    ctx.beginPath();ctx.moveTo(-s*.12,-s*.27);ctx.lineTo(s*.22,-s*.68);ctx.lineTo(s*.52,-s*.28);ctx.closePath();ctx.fill();
    ctx.fillStyle="#182a27";ctx.beginPath();ctx.arc(s*.65,-s*.07,Math.max(1.2,s*.045),0,Math.PI*2);ctx.fill();
    ctx.restore();
  }
  function drawBackground(t){
    const sky=ctx.createLinearGradient(0,0,0,H*.57);
    sky.addColorStop(0,"#9bb3a9");sky.addColorStop(.55,"#c0c6ae");sky.addColorStop(1,"#738e80");
    ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
    // distant tree line
    ctx.fillStyle="#405d50";ctx.beginPath();ctx.moveTo(0,H*.38);
    for(let x=0;x<=W+40;x+=35){let y=H*(.33+Math.sin(x*.018)*.018+Math.sin(x*.047)*.012);ctx.lineTo(x,y);}
    ctx.lineTo(W,H*.53);ctx.lineTo(0,H*.53);ctx.fill();
    ctx.fillStyle="#29483f";ctx.beginPath();ctx.moveTo(0,H*.43);
    for(let x=0;x<=W+30;x+=22){ctx.lineTo(x,H*(.39+Math.sin(x*.026+1)*.025));}
    ctx.lineTo(W,H*.54);ctx.lineTo(0,H*.54);ctx.fill();
    // lake surface
    const water=ctx.createLinearGradient(0,H*.43,0,H);
    water.addColorStop(0,"#648e87");water.addColorStop(.25,"#386b69");water.addColorStop(1,"#102f35");
    ctx.fillStyle=water;ctx.fillRect(0,H*.44,W,H*.56);
    // sun reflection
    const rg=ctx.createRadialGradient(W*.72,H*.49,2,W*.72,H*.49,W*.32);
    rg.addColorStop(0,"#d5c99b38");rg.addColorStop(1,"#d5c99b00");
    ctx.fillStyle=rg;ctx.fillRect(W*.4,H*.44,W*.6,H*.35);
    // animated fine water streaks
    for(let i=0;i<105;i++){
      const x=((i*97+t*(8+(i%4)*3))%(W+80))-40;
      const y=H*.46+((i*43)%Math.max(1,H*.49));
      const len=8+(i%7)*4;
      ctx.strokeStyle=`rgba(205,224,207,${.035+(i%4)*.012})`;ctx.lineWidth=.7;
      ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+len*.5,y-1,x+len,y);ctx.stroke();
    }
    // bank silhouette
    ctx.fillStyle="#253e35";ctx.beginPath();ctx.moveTo(0,H*.49);ctx.quadraticCurveTo(W*.13,H*.45,W*.26,H*.49);ctx.lineTo(0,H*.54);ctx.fill();
    ctx.fillStyle="#304b3d";ctx.beginPath();ctx.moveTo(W*.76,H*.46);ctx.quadraticCurveTo(W*.9,H*.43,W,H*.47);ctx.lineTo(W,H*.53);ctx.lineTo(W*.76,H*.52);ctx.fill();
  }
  function drawBoat(){
    const x=W*.5,y=H*.54;
    ctx.save();ctx.translate(x,y);
    ctx.fillStyle="#152b2b";ctx.beginPath();ctx.moveTo(-W*.16,0);ctx.quadraticCurveTo(-W*.13,H*.045,0,H*.05);ctx.quadraticCurveTo(W*.13,H*.045,W*.16,0);ctx.lineTo(W*.12,-H*.018);ctx.lineTo(-W*.12,-H*.018);ctx.closePath();ctx.fill();
    ctx.fillStyle="#785d43";ctx.fillRect(-W*.12,-H*.025,W*.24,H*.012);
    ctx.strokeStyle="#c4b18a";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(W*.03,-H*.03);ctx.lineTo(W*.13,-H*.23+state.rod*H*.035);ctx.stroke();
    ctx.strokeStyle="#d7d6c2";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(W*.13,-H*.23+state.rod*H*.035);ctx.lineTo(state.lureX-x,state.lureY-y);ctx.stroke();
    ctx.restore();
  }
  function drawUnderwater(t){
    const top=H*.58;
    const grad=ctx.createLinearGradient(0,top,0,H);
    grad.addColorStop(0,"rgba(7,36,39,.04)");grad.addColorStop(1,"rgba(3,18,25,.5)");
    ctx.fillStyle=grad;ctx.fillRect(0,top,W,H-top);
    // underwater light rays
    ctx.save();ctx.globalAlpha=.07;
    for(let i=0;i<5;i++){
      const x=W*(.13+i*.19)+Math.sin(t*.25+i)*16;
      ctx.fillStyle="#d2d7a8";ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x+45,H);ctx.lineTo(x+115,H);ctx.lineTo(x+24,top);ctx.fill();
    }ctx.restore();
    // vegetation silhouettes
    ctx.strokeStyle="#183e37";ctx.lineWidth=5;
    for(let i=0;i<9;i++){
      const x=(i*W/8+Math.sin(t*.4+i)*7);
      ctx.beginPath();ctx.moveTo(x,H);ctx.quadraticCurveTo(x-20,H*.85,x+Math.sin(t+i)*15,H*.76);ctx.stroke();
    }
    // schools / background fish
    state.fishSchool.forEach(f=>{
      f.x+=f.v*0.15;if(f.x>W+50)f.x=-50;
      fishShape(f.x,f.y,f.s,"#9db8a4",0,.24);
    });
  }
  function drawFishingLine(){
    if(state.mode==="idle")return;
    const bx=W*.5+W*.13,by=H*.31+state.rod*H*.035;
    const x=state.lureX||W*.64,y=state.lureY||H*.78;
    ctx.strokeStyle="rgba(231,236,214,.8)";ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(bx,by);
    const midY=(by+y)*.5+Math.sin(elapsed*2)*3;
    ctx.quadraticCurveTo((bx+x)*.5+state.rod*10,midY,x,y);ctx.stroke();
    ctx.fillStyle="#d7c69a";ctx.beginPath();ctx.arc(x,y,3.5,0,Math.PI*2);ctx.fill();
    if(state.fish){
      fishShape(x-12,y+15,Math.max(12,state.fish.weight*7),state.fish.color,Math.sin(elapsed*5)*.1,.92);
    }
  }
  function draw(){
    ctx.clearRect(0,0,W,H);drawBackground(elapsed);drawUnderwater(elapsed);
    if(state.mode!=="idle")drawFishingLine();
    drawBoat();
    // ripples
    state.ripples.forEach(r=>{ctx.strokeStyle=`rgba(222,235,218,${r.a})`;ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(r.x,r.y,r.r*1.7,r.r*.38,0,0,Math.PI*2);ctx.stroke();});
    state.particles.forEach(p=>{ctx.fillStyle=`rgba(222,237,220,${p.a})`;ctx.beginPath();ctx.arc(p.x,p.y,p.s,0,Math.PI*2);ctx.fill();});
  }
  function toast(msg){
    ui.toast.textContent=msg;ui.toast.classList.add("show");clearTimeout(state.toastTimer);
    state.toastTimer=setTimeout(()=>ui.toast.classList.remove("show"),2300);
  }
  function updateUI(){
    ui.depth.textContent=fmt(state.line)+" m";ui.tension.textContent=Math.round(state.tension)+"%";
    ui.tensionBar.style.width=state.tension+"%";ui.reelValue.textContent=Math.round(state.reel)+"%";
    ui.reelBar.style.width=state.reel+"%";ui.caught.textContent=state.fishCount;
    ui.money.textContent="R$ "+state.money.toFixed(2).replace(".",",");
    ui.lineStatus.textContent=state.tension>82?"PERIGO: LINHA SOB PRESSÃO":state.tension>30?"Linha tensionada":"Linha frouxa";
    ui.fishStatus.textContent=state.fish?state.fish.name+" • "+fmt(state.fish.weight)+" kg":state.mode==="idle"?"Aguardando arremesso":state.mode==="cast"?"Isca na água":"Recolhendo";
    ui.depthLine.textContent=state.maxLine+" m";
    ui.cast.disabled=state.mode!=="idle"&&state.mode!=="landed";ui.reel.disabled=state.mode==="idle";
    const mins=Math.floor((state.time%1)*60);ui.clock.textContent=String(Math.floor(state.time)%24).padStart(2,"0")+":"+String(mins).padStart(2,"0");
  }
  function cast(){
    if(state.mode!=="idle"&&state.mode!=="landed")return;
    state.mode="cast";state.line=0;state.tension=0;state.reel=0;state.fish=null;state.castTimer=0;
    state.lureX=W*.68;state.lureY=H*.8;state.splash=1;
    state.ripples.push({x:state.lureX,y:state.lureY,r:4,a:.65});
    toast("Arremesso realizado. Aguarde a aproximação dos peixes.");
    updateUI();
  }
  function hookFish(){
    if(state.mode!=="bite"||!state.fish)return;
    state.mode="fight";state.tension=24;ui.alert.classList.remove("show");
    toast("PEIXE FISGADO! Controle a tensão da linha.");
  }
  function reelIn(){
    if(state.mode==="idle")return;
    if(state.mode==="waiting"){state.line=Math.max(0,state.line-1.8);return;}
    if(state.mode==="fight"||state.mode==="reeling"){
      state.mode="fight";state.line=Math.max(0,state.line-.20);
      state.reel=clamp(state.reel+1.4,0,100);
    }else if(state.mode==="cast")state.line=Math.max(0,state.line-.7);
  }
  function releaseLine(){if(state.mode==="fight"){state.line=Math.min(state.maxLine,state.line+.18);state.tension=Math.max(0,state.tension-2.4);}}
  function breakLine(){
    state.mode="idle";state.fish=null;state.line=0;state.tension=0;state.reel=0;
    toast("A linha rompeu! Diminua a pressão ao trabalhar o peixe.");
  }
  function landFish(){
    const f=state.fish;if(!f)return;
    state.fishCount++;state.money+=f.value*f.weight;
    state.mode="landed";state.tension=0;state.reel=100;
    toast(`${f.name} capturado • ${fmt(f.weight)} kg • R$ ${(f.value*f.weight).toFixed(2).replace(".",",")}`);
    state.ripples.push({x:W*.58,y:H*.78,r:8,a:.8});state.fish=null;
    setTimeout(()=>{if(state.mode==="landed")state.mode="idle";updateUI();},1800);
  }
  function update(dt){
    elapsed+=dt;state.time=(state.time+dt*.002)%24;
    state.ripples.forEach(r=>{r.r+=dt*13;r.a-=dt*.24;});state.ripples=state.ripples.filter(r=>r.a>0);
    state.particles.forEach(p=>{p.y-=p.v*dt;p.a-=dt*.7;});state.particles=state.particles.filter(p=>p.a>0);
    if(state.mode==="cast"){
      state.castTimer+=dt;state.line=clamp(state.line+dt*2.2,0,rand(7,12));
      state.lureY=H*.64+state.line*H*.012;
      if(state.castTimer>2.8){state.mode="waiting";state.biteTimer=rand(4,9);}
    } else if(state.mode==="waiting"){
      state.biteTimer-=dt;
      if(state.biteTimer<=0){
        const sp=species[Math.floor(Math.random()*species.length)];
        state.fish={...sp,weight:rand(sp.weight[0],sp.weight[1]),energy:rand(9,15),phase:rand(0,6)};
        state.mode="bite";ui.alert.classList.add("show");toast("Movimento na isca! Pressione ESPAÇO para fisgar.");
        state.biteTimer=1.7;
      }
    } else if(state.mode==="bite"){
      state.biteTimer-=dt;
      if(state.biteTimer<=0){state.mode="waiting";state.fish=null;ui.alert.classList.remove("show");toast("O peixe soltou a isca. Tente novamente.");state.biteTimer=rand(3,7);}
    } else if(state.mode==="fight"&&state.fish){
      const f=state.fish;f.phase+=dt*f.speed;
      const pull=(Math.sin(f.phase*1.7)+1)*.5;
      const pulling=(Math.sin(f.phase*2.1)>-.15);
      const reeling=!!(state.keys.KeyW||state.pointerDown);
      if(reeling){state.line=Math.max(0,state.line-dt*(.75+state.reel*.004));state.reel=clamp(state.reel+dt*13,0,100);}
      if(state.keys.KeyS){state.line=Math.min(state.maxLine,state.line+dt*1.5);state.tension=Math.max(0,state.tension-dt*23);}
      const base=13+f.strength*34;
      state.tension=clamp(state.tension+(pulling?dt*base*(.45+pull*.75): -dt*16)+(reeling?dt*12:0),0,100);
      state.line=clamp(state.line+(pulling?dt*f.strength*.45:0),0,state.maxLine);
      state.lureX=W*.68+Math.sin(f.phase*1.3)*W*.045;
      state.lureY=H*.68+Math.sin(f.phase*2)*12+state.line*H*.009;
      if(state.tension>=99||state.line>=state.maxLine)breakLine();
      if(state.line<1.2&&state.reel>40)landFish();
    }
    state.fishSchool.forEach(f=>{f.x+=f.v*dt;if(f.x>W+30)f.x=-30;});
    updateUI();
  }
  function frame(ts){
    if(!last)last=ts;const dt=Math.min((ts-last)/1000,.04);last=ts;
    if(running&&!paused)update(dt);draw();requestAnimationFrame(frame);
  }
  function start(){
    running=true;paused=false;ui.overlay.classList.add("hidden");state.mode="idle";
    toast("Pescaria iniciada. Prepare seu primeiro arremesso.");
  }
  function togglePause(){
    if(!running)return;paused=!paused;
    if(paused){ui.overlay.classList.remove("hidden");ui.overlay.querySelector(".eyebrow").textContent="PAUSADO";ui.overlay.querySelector("h1").innerHTML="Pescaria<br>em pausa";ui.overlay.querySelector("p").textContent="Sua sessão está pausada.";ui.start.textContent="CONTINUAR";ui.start.onclick=togglePause;}
    else{ui.overlay.classList.add("hidden");ui.start.textContent="INICIAR PESCARIA";ui.start.onclick=start;}
  }
  function handleKey(e){
    if(["Space","ArrowUp","ArrowDown"].includes(e.code))e.preventDefault();
    if(e.repeat)return;state.keys[e.code]=true;
    if(e.code==="Space"){if(state.mode==="bite")hookFish();else if(state.mode==="idle"||state.mode==="landed")cast();}
    if(e.code==="KeyW")reelIn();if(e.code==="KeyS")releaseLine();
    if(e.code==="KeyA")state.rod=clamp(state.rod-.15,-1,1);if(e.code==="KeyD")state.rod=clamp(state.rod+.15,-1,1);
  }
  function handleUp(e){state.keys[e.code]=false;}
  ui.start.addEventListener("click",start);ui.cast.addEventListener("click",()=>{if(state.mode==="bite")hookFish();else cast();});
  ui.reel.addEventListener("pointerdown",()=>{state.pointerDown=true;reelIn();});
  ["pointerup","pointerleave","pointercancel"].forEach(ev=>ui.reel.addEventListener(ev,()=>state.pointerDown=false));
  ui.pause.addEventListener("click",togglePause);
  window.addEventListener("keydown",handleKey);window.addEventListener("keyup",handleUp);
  canvas.addEventListener("pointerdown",e=>{if(state.mode==="bite")hookFish();else if(state.mode==="fight"){state.pointerDown=true;reelIn();}});
  window.addEventListener("pointerup",()=>state.pointerDown=false);
  for(let i=0;i<14;i++)state.fishSchool.push({x:rand(0,900),y:rand(H*.69,H*.92),s:rand(5,11),v:rand(4,14)});
  updateUI();requestAnimationFrame(frame);
})();
