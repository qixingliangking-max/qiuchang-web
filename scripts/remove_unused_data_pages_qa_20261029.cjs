'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const targets={
 'football.html':'jcFootballCards',
 'jc-match.html':'jcMatchDetailRoot',
 'league.html':'leagueRecordRoot',
 'model-record-test.html':'modelRecordRoot'
};
for(const [page,container] of Object.entries(targets)){
 test(page+' drops unused September demo dataset without altering its actual module',()=>{
  const html=fs.readFileSync(path.join(root,page),'utf8');
  assert.doesNotMatch(html,/<script[^>]*src=["']data\.js["']/);
  assert.match(html,new RegExp('id=["\']'+container+'["\']'));
  assert.match(html,/supabase-client\.js/);
  assert.match(html,/app\.js\?v=/);
  assert.doesNotMatch(html,/id=["'](?:recapRows|matchCards|matchRoot)["']/);
 });
}
test('legacy demo page retains its required data.js fixture',()=>{
 const html=fs.readFileSync(path.join(root,'match.html'),'utf8');
 assert.match(html,/<script[^>]*src=["']data\.js["']/);
 assert.match(html,/id=["']matchRoot["']/);
});
test('source demo data and protected model auth remain unmodified',()=>{
 const data=fs.readFileSync(path.join(root,'data.js'),'utf8');
 assert.match(data,/window\.QC_DATA\s*=/);
 const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
 assert.match(app,/has_active_pro_access/);
 assert.match(app,/qcGetAccessState/);
});
