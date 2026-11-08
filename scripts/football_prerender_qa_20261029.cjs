'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'football.html'),'utf8');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'data/overview/live-schedule-manifest.json'),'utf8'));
const m=html.match(/id="jcFootballCards" data-qc-static-date="(\d{4}-\d{2}-\d{2})" data-qc-static-count="(\d+)" data-qc-static-version="([^"]*)"/);
test('football page embeds published card HTML without loading scripts',()=>{
 assert.ok(m,'missing rendered public cards');
 const segment=html.split('<!-- QC_FOOTBALL_PUBLIC_START -->')[1].split('<!-- QC_FOOTBALL_PUBLIC_END -->')[0];
 assert.equal((segment.match(/<article class="jc-football-card /g)||[]).length,Number(m[2]));
 assert.ok((segment.match(/class="jc-team-logo"/g)||[]).length<=Number(m[2])*2);
 assert.ok((segment.match(/class="jc-team-name"/g)||[]).length===Number(m[2])*2);
 // Missing published crests must never suppress the public fixture or team name.
 assert.doesNotMatch(segment,/>正在加载中…</);
 assert.doesNotMatch(segment,/jc_model_outputs|jc_match_ai_analysis|qc_pro_predictions/);
 if(Number(m[2])>0) assert.match(segment,/data-qc-login-cta="1"/);
});
test('HTML matches the official static date, team IDs and locally cached crests',()=>{
 assert.ok(m);
 const entry=manifest.dates[m[1]];
 if(!entry){assert.equal(Number(m[2]),0);return;}
 assert.equal(m[3],entry.version);
 const rows=JSON.parse(fs.readFileSync(path.join(root,entry.file),'utf8')).rows;
 const visible=rows.filter(r=>r.match_date&&!(r.business_date==='2026-10-15'&&r.match_num==='周四007'));
 assert.equal(Number(m[2]),visible.length);
 const chunk=html.split('<!-- QC_FOOTBALL_PUBLIC_START -->')[1].split('<!-- QC_FOOTBALL_PUBLIC_END -->')[0];
 for(const row of visible){
  assert.ok(chunk.includes('data-match-id="'+row.id+'"'),row.match_num);
  for(const side of ['home','away']){
   const img=row['_'+side+'LogoUrl'];
   // A real crest is verified if published; missing crests show the team name.
   assert.ok(chunk.includes(row[side+'_team_name']),row.match_num+' '+side+' name');
   if(!img) continue;
   assert.ok(/^assets\/team-logos\/[a-z0-9-]+\.(png|jpg|webp)$/i.test(img),row.match_num+' '+side+' unsafe path');
   assert.ok(fs.existsSync(path.join(root,img)),row.match_num+' '+side+' missing file');
   assert.ok(chunk.includes('src="'+img+'"'),row.match_num+' '+side+' missing image');
  }
 }
});
test('stale HTML and explicit historical dates cannot flash wrong cards',()=>{
 assert.match(html,/if\(Number\(p.hour\)<10\)/);
 assert.match(html,/if\(selected!==date\)/);
});
