'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const a=app.indexOf('function jcCompactHandicapPick(text){');
const b=app.indexOf('function jcHasOrdinaryResult(m){',a);
assert.ok(a>0&&b>a,'display helper found');
const c={};vm.createContext(c);vm.runInContext(app.slice(a,b),c);
test('display original +1 / -1 / +2 official handicap without changing model order',()=>{
 assert.equal(c.jcDisplayOfficialHandicap({handicap_direction:'让胜 / 让平',raw_input:{handicap_line:'+1'}}),'让胜 / 让平（+1）');
 assert.equal(c.jcDisplayOfficialHandicap({handicap_direction:'让负 / 让胜',raw_input:{handicap_line:'-1'}}),'让负 / 让胜（-1）');
 assert.equal(c.jcDisplayOfficialHandicap({handicap_direction:'让胜 / 让负',raw_input:{handicap_line:'+2'}}),'让胜 / 让负（+2）');
});
test('legacy models without original handicap line display unchanged',()=>{
 assert.equal(c.jcDisplayOfficialHandicap({handicap_direction:'让负 / 让平'}),'让负 / 让平');
 assert.equal(c.jcDisplayOfficialHandicap({handicap_direction:'让负 / 让平',raw_input:{handicap_line:'unknown'}}),'让负 / 让平');
});
test('published summary uses display helper, scoring still parses bare result choices',()=>{
 assert.match(app,/const handicapText=model\?jcDisplayOfficialHandicap\(model\):'待生成'/);
 assert.match(app,/const handicapChoices=jcCompactHandicapPick\(model\.handicap_direction\)/);
});