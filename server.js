// Sands of the Eclipse multiplayer server
// Node.js 18+ recommended. Install: npm install
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.get('/', (_req,res)=>res.send('Sands of the Eclipse multiplayer server is running.'));
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET','POST'] },
  transports: ['websocket','polling']
});
const PORT = process.env.PORT || 3000;
const rooms = new Map();
const playerRoom = new Map();
const MAX = 8;
const WORLD_W = 6000;
const GROUND_Y = 420;
const now = () => Date.now();
const codeChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function makeCode(){ let code; do { code=''; for(let i=0;i<3;i++) code+=codeChars[Math.floor(Math.random()*codeChars.length)]; } while(rooms.has(code)); return code; }
function cleanName(n){ return String(n||'Player').replace(/[<>]/g,'').trim().slice(0,16)||'Player'; }
function publicRoom(r){return {code:r.code,mode:r.mode,visibility:r.visibility,players:r.players.size,maxPlayers:MAX,started:r.started};}
function roomSnapshot(r, viewerId){return {code:r.code,mode:r.mode,visibility:r.visibility,started:r.started,hostId:r.hostId,isHost:r.hostId===viewerId,players:[...r.players.values()].map(p=>({id:p.id,name:p.name,crystals:p.crystals,x:p.x,y:p.y,alive:p.alive}))};}
function sendRoom(r){for(const id of r.players.keys())io.to(id).emit('room_update',roomSnapshot(r,id));}
function errorTo(s,msg){s.emit('error_message',{message:msg});}
function publicRooms(){return [...rooms.values()].filter(r=>r.visibility==='public'&&!r.started).map(publicRoom);}
function broadcastPublic(){io.emit('public_rooms',publicRooms());}
function leave(socket){
 const code=playerRoom.get(socket.id); if(!code)return;
 const r=rooms.get(code);playerRoom.delete(socket.id);socket.leave(code);
 if(!r)return;
 r.players.delete(socket.id);
 if(r.players.size===0){rooms.delete(code);}
 else {if(r.hostId===socket.id)r.hostId=r.players.keys().next().value;sendRoom(r);io.to(code).emit('match_state',matchState(r));}
 broadcastPublic();
}
function matchState(r) {
  return {
    room: roomSnapshot(r, ''),
    players: [...r.players.values()].map(p => ({
      ...p,
      keys: undefined
    })),
    crystals: r.crystals || [],
    teamCrystals: r.teamCrystals,
    elapsed: r.started
      ? Math.floor((now() - r.startedAt) / 1000)
      : 0,
    result: r.result
  };
}
function startMatch(r){
 if(r.started)return;
 if(r.players.size<5){return;}
 r.started = true;
r.startedAt = now();
r.result = null;
r.teamCrystals = 0;
r.crystals = [];
r.nextCrystal = 0;
 for(const p of r.players.values()){p.x=80+Math.random()*80;p.y=GROUND_Y;p.vy=0;p.crystals=0;p.alive=true;p.keys={};}
 io.to(r.code).emit('match_started',roomSnapshot(r,r.hostId));sendRoom(r);
 io.to(r.code).emit('match_state',matchState(r));broadcastPublic();
}
function addPlayer(socket,r,name){
 if(r.started){errorTo(socket,'Match already started. Late joins are closed.');return false;}
 if(r.players.size>=MAX){errorTo(socket,'Room is full (8/8).');return false;}
 if(playerRoom.has(socket.id))leave(socket);
 const p={id:socket.id,name:cleanName(name),x:80+r.players.size*36,y:GROUND_Y,vx:0,vy:0,crystals:0,alive:true,keys:{},lastJump:false,lastAttack:0};
 r.players.set(socket.id,p);playerRoom.set(socket.id,r.code);socket.join(r.code);
 sendRoom(r);io.to(r.code).emit('match_state',matchState(r));broadcastPublic();
 if(r.players.size===MAX)startMatch(r);
 return true;
}
io.on('connection',socket=>{
 socket.emit('public_rooms',publicRooms());
 socket.on('list_public_rooms',()=>socket.emit('public_rooms',publicRooms()));
 socket.on('create_room',data=>{
  if(playerRoom.has(socket.id))leave(socket);
  const code=makeCode(), mode=data?.mode==='coop'?'coop':'race', visibility=data?.visibility==='private'?'private':'public';
  const r={code,mode,visibility,hostId:socket.id,players:new Map(),started:false,startedAt:0,teamCrystals:0,result:null,createdAt:now(),nextCrystal:0};
  rooms.set(code,r);addPlayer(socket,r,data?.name);sendRoom(r);broadcastPublic();
 });
 socket.on('join_room',data=>{
  const code=String(data?.code||'').trim().toUpperCase(),r=rooms.get(code);
  if(!r){errorTo(socket,'Room not found. Check the code and try again.');return;}
  if(r.started){errorTo(socket,'Match already started. Late joins are closed.');return;}
  if(r.players.size>=MAX){errorTo(socket,'Room is full (8/8).');return;}
  addPlayer(socket,r,data?.name);
 });
 socket.on('start_match',()=>{
  const code=playerRoom.get(socket.id),r=rooms.get(code);if(!r)return;
  if(r.hostId!==socket.id){errorTo(socket,'Only the host can start the match.');return;}
  if(r.players.size<5){errorTo(socket,'At least 5 players are required to start.');return;}
  startMatch(r);
 });
 socket.on('leave_room',()=>leave(socket));
 socket.on('player_input',data=>{
  const code=playerRoom.get(socket.id),r=rooms.get(code);if(!r||!r.started)return;
  const p=r.players.get(socket.id);if(!p||!p.alive)return;
  const k=data?.keys||{};p.keys={left:!!k.left,right:!!k.right,jump:!!k.jump,attack:!!k.attack};
 });
 socket.on('disconnect',()=>leave(socket));
});
function finish(r){
 if(r.result)return;
 const ps=[...r.players.values()];
 if(r.mode==='coop'){
  if(r.teamCrystals>=20)r.result={message:'Co-op victory! The team collected 20 crystals.'};
  else if(ps.every(p=>!p.alive))r.result={message:'Expedition over. The team can try again.'};
 } else if(r.teamCrystals>=1 && ps.some(p=>p.crystals>=10)){
  const winner=ps.slice().sort((a,b)=>b.crystals-a.crystals)[0];r.result={message:`${winner.name} wins with ${winner.crystals} crystals!`};
 } else if(ps.every(p=>!p.alive)){const winner=ps.slice().sort((a,b)=>b.crystals-a.crystals)[0];r.result={message:`Race over! ${winner?.name||'No one'} collected the most crystals.`};}
}
let tick=0;
setInterval(()=>{
 tick++;
 for(const r of rooms.values()){
  if(!r.started||r.result)continue;
  const t=now();
  for(const p of r.players.values()){
   if(!p.alive)continue;
   const k=p.keys||{},speed=3.3;
   p.vx=(k.right?speed:0)-(k.left?speed:0);
   p.x=Math.max(20,Math.min(WORLD_W-20,p.x+p.vx));
   if(k.jump&&!p.lastJump&&p.y>=GROUND_Y-1)p.vy=-11;
   p.lastJump=!!k.jump;
   p.vy=Math.min(14,p.vy+0.55);p.y+=p.vy;
   if(p.y>=GROUND_Y){p.y=GROUND_Y;p.vy=0;}
   if(k.attack && t-p.lastAttack>500){p.lastAttack=t;}
   // Crystal spawns are shared world objects; server assigns each pickup once.
  }
  if(t-r.nextCrystal>1200){r.nextCrystal=t;const x=160+Math.random()*(WORLD_W-320);r.crystals ||= [];r.crystals.push({id:`${t}-${Math.random()}`,x,y:GROUND_Y-28});if(r.crystals.length>30)r.crystals.shift();}
  for(const c of (r.crystals||[])){
   for(const p of r.players.values()){
    if(!p.alive||c.taken)continue;
    if(Math.abs(p.x-c.x)<24&&Math.abs(p.y-(c.y+28))<38){c.taken=true;p.crystals++;if(r.mode==='coop')r.teamCrystals++;}
   }
  }
  r.crystals=(r.crystals||[]).filter(c=>!c.taken);
  finish(r);
  io.to(r.code).emit('match_state',{room:roomSnapshot(r,''),players:[...r.players.values()].map(p=>({...p,keys:undefined})),crystals:r.crystals,teamCrystals:r.teamCrystals,elapsed:Math.floor((t-r.startedAt)/1000),result:r.result});
 }
},50);
server.listen(PORT,()=>console.log(`Sands of the Eclipse server listening on ${PORT}`));
