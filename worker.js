const ready=new WeakMap();
const schema="CREATE TABLE IF NOT EXISTS `camp_players` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`room` text NOT NULL,\n\t`token` text NOT NULL,\n\t`name` text NOT NULL,\n\t`x` real NOT NULL,\n\t`z` real NOT NULL,\n\t`yaw` real NOT NULL,\n\t`action` text NOT NULL,\n\t`reaction` text NOT NULL,\n\t`react_at` integer NOT NULL,\n\t`seen` integer NOT NULL,\n\t`joined` integer NOT NULL,\n\tFOREIGN KEY (`room`) REFERENCES `camp_rooms`(`id`) ON UPDATE no action ON DELETE cascade\n);\n\nCREATE INDEX IF NOT EXISTS `camp_players_room` ON `camp_players` (`room`);\nCREATE TABLE IF NOT EXISTS `camp_rooms` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`region` text NOT NULL,\n\t`time` text NOT NULL,\n\t`weather` text NOT NULL,\n\t`host` text NOT NULL,\n\t`updated` integer NOT NULL\n);\n";


const regions=['east','forest','west','south','jeju'],times=['sunrise','morning','afternoon','sunset','night'],weathers=['clear','fog','rain'];
function json(data,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store'}})}
function id(){return crypto.randomUUID().replaceAll('-','')}
async function hash(s){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(x=>x.toString(16).padStart(2,'0')).join('')}
function num(x,min,max){return Math.max(min,Math.min(max,Number.isFinite(Number(x))?Number(x):0))}
async function POST(req,env){try{
 if(req.headers.get('content-type')?.split(';')[0]!=='application/json')return json({error:'잘못된 요청이에요.'},415);
 const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return json({error:'같은 사이트에서 접속해주세요.'},403);
 const body=await req.text();if(body.length>4096)return json({error:'요청이 너무 커요.'},413);
 const b=JSON.parse(body),db=env.DB;if(!db)return json({error:'공동 캠프를 준비 중이에요.'},503);const now=Date.now();
 if(b.op==='create'||b.op==='join'||b.op==='public'){
  const isPublic=b.op==='public';if(isPublic&&!regions.includes(b.region))return json({error:'지역을 골라주세요.'},400);
  const prefix='AA'+regions.indexOf(b.region).toString(16).toUpperCase();
  const available=isPublic?await db.prepare('SELECT r.id FROM camp_rooms r WHERE r.region=? AND r.id LIKE ? AND (SELECT COUNT(*) FROM camp_players p WHERE p.room=r.id AND p.seen>?)<10 ORDER BY r.updated DESC LIMIT 1').bind(b.region,prefix+'%',now-90000).first():null;
  const room=isPublic?(available?.id||prefix+id().slice(0,5).toUpperCase()):b.op==='create'?'BB'+id().slice(0,6).toUpperCase():String(b.room||'').toUpperCase();if(!/^[A-F0-9]{8}$/.test(room))return json({error:'초대 코드를 확인해주세요.'},400);
  const player=id(),token=id()+id(),tokenHash=await hash(token),name=String(b.name||'여행자').trim().slice(0,12)||'여행자';
  if(b.op==='create'||(isPublic&&!available)){if(!regions.includes(b.region))return json({error:'지역을 골라주세요.'},400);await db.batch([db.prepare('DELETE FROM camp_rooms WHERE updated < ?').bind(now-7200000),db.prepare('INSERT INTO camp_rooms(id,region,time,weather,host,updated) VALUES(?,?,?,?,?,?)').bind(room,b.region,'night','clear',player,now)])}
  const existing=await db.prepare('SELECT id FROM camp_rooms WHERE id=?').bind(room).first();if(!existing)return json({error:'캠프를 찾지 못했어요. 새 초대 링크를 받아주세요.'},404);
  const results=await db.batch([db.prepare('DELETE FROM camp_players WHERE room=? AND seen < ?').bind(room,now-90000),db.prepare('INSERT INTO camp_players(id,room,token,name,x,z,yaw,action,reaction,react_at,seen,joined) SELECT ?,?,?,?, (SELECT COUNT(*) FROM camp_players WHERE room=?)*.6-3,?,0,\'idle\',\'\',0,?,? WHERE (SELECT COUNT(*) FROM camp_players WHERE room=?) < 10').bind(player,room,tokenHash,name,room,4.8,now,now,room)]);
  if(!results[1].meta.changes)return json({error:'이 캠프는 10명이 머물고 있어요. 잠시 뒤 다시 와주세요.'},409);
  await db.prepare('UPDATE camp_rooms SET host=?,updated=? WHERE id=? AND NOT EXISTS(SELECT 1 FROM camp_players WHERE id=camp_rooms.host AND room=camp_rooms.id)').bind(player,now,room).run();
  return json({room,player,token,...await state(db,room)},201);
 }
 const room=String(b.room||'').toUpperCase();if(!/^[A-F0-9]{8}$/.test(room)||typeof b.token!=='string'||b.token.length!==64)return json({error:'다시 초대 링크로 입장해주세요.'},401);
 const p=await db.prepare('SELECT id,seen FROM camp_players WHERE room=? AND token=?').bind(room,await hash(b.token)).first();if(!p)return json({error:'연결이 종료됐어요. 다시 입장해주세요.'},401);
 if(b.op==='leave'){await db.prepare('DELETE FROM camp_players WHERE id=?').bind(p.id).run();return json({ok:true})}
 if(b.op!=='tick')return json({error:'지원하지 않는 요청이에요.'},400);
 const action=['idle','walk','fire','water','focus','note','cook','seating','standing'].includes(b.position?.action)?b.position.action:'idle';const react=['wave','heart','log'].includes(b.reaction)?b.reaction:'';
 await db.batch([db.prepare('DELETE FROM camp_players WHERE room=? AND seen < ? AND id<>?').bind(room,now-90000,p.id),db.prepare('UPDATE camp_players SET x=?,z=?,yaw=?,action=?,seen=?,reaction=CASE WHEN ?<>\'\' THEN ? ELSE reaction END,react_at=CASE WHEN ?<>\'\' THEN ? ELSE react_at END WHERE id=?').bind(num(b.position?.x,-5.9,5.9),num(b.position?.z,-5.9,5.9),num(b.position?.yaw,-20,20),action,now,react,react,react,now,p.id),db.prepare('UPDATE camp_rooms SET host=?,updated=? WHERE id=? AND NOT EXISTS(SELECT 1 FROM camp_players WHERE id=camp_rooms.host AND room=camp_rooms.id)').bind(p.id,now,room)]);
 if(b.settings&&times.includes(b.settings.time)&&weathers.includes(b.settings.weather))await db.prepare('UPDATE camp_rooms SET time=?,weather=?,updated=? WHERE id=? AND host=?').bind(b.settings.time,b.settings.weather,now,room,p.id).run();else await db.prepare('UPDATE camp_rooms SET updated=? WHERE id=?').bind(now,room).run();
 return json(await state(db,room));
}catch(e){console.error('camp api',e);return json({error:'캠프 연결에 문제가 생겼어요. 다시 시도해주세요.'},500)}}
async function state(db,room){const camp=await db.prepare('SELECT id,region,time,weather,host FROM camp_rooms WHERE id=?').bind(room).first();const peers=await db.prepare('SELECT id,name,x,z,yaw,action,reaction,react_at FROM camp_players WHERE room=? ORDER BY joined,id').bind(room).all();return {camp,peers:peers.results,serverTime:Date.now()}}

export default {async fetch(request,env){const url=new URL(request.url);if(url.pathname==='/api/camp'){if(request.method!=='POST')return Response.json({error:'POST required'},{status:405});if(!env.DB)return Response.json({error:'D1 DB binding missing'},{status:503});try{if(!ready.has(env.DB))ready.set(env.DB,env.DB.batch(schema.split(';').map(sql=>sql.trim()).filter(Boolean).map(sql=>env.DB.prepare(sql))).catch(e=>{ready.delete(env.DB);throw e}));await ready.get(env.DB)}catch{return Response.json({error:'데이터베이스 준비 실패'},{status:503})}return POST(request,env)}if(url.pathname==='/'){url.pathname='/camp/';return Response.redirect(url,302)}return env.ASSETS.fetch(request)}};
