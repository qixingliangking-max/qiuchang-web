'use strict';
const fs=require('node:fs'),test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'internal-test/curated-lab-20261019.html'),'utf8');
const data=fs.readFileSync(path.join(root,'internal-test/curated-db-direct-20261022.js'),'utf8');
const ui=fs.readFileSync(path.join(root,'internal-test/curated-lab-20261019.js'),'utf8');
test('legacy static archive never flashes before the live first render',()=>{
 assert.match(html,/<body class="curated-booting">/);
 assert.match(html,/body\.curated-booting #plans/);
 assert.match(html,/body\.curated-booting #tabs/);
 assert.match(html,/curated-db-direct-20261022\.js\?v=20261030livefirst1/);
 assert.match(html,/curated-lab-20261019\.js\?v=20261030livefirst1/);
 assert.match(ui,/document\.body\.classList\.remove\('curated-booting'\)/);
 assert.match(data,/window\.QC_CURATED_DB_READY=loadDay\(initialDay\)/);
 assert.doesNotMatch(data,/window\.QC_CURATED_DB_READY=Promise\.resolve\(\)/);
});
test('first business day is awaited before archived history background refresh',()=>{
 const start=data.indexOf('window.QC_CURATED_DB_READY=loadDay(initialDay)');
 const refresh=data.indexOf('window.QC_CURATED_DB_READY.then(function(){setTimeout(refresh,0)});');
 assert.ok(start>0&&refresh>start);
 assert.match(data,/setInterval\(refresh,120000\)/);
});
