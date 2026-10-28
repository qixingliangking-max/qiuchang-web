'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {test}=require('node:test');

const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'app.js'),'utf8');
const start=source.indexOf('function setupLastActiveTracking(){');
const stop=source.indexOf('let qcAuthRecoveryBound=false;',start);
assert.ok(start>0&&stop>start,'actual activity setup found');
const fragment='let qcLastActiveBound=false;\n'+source.slice(start,stop)+'\nsetupLastActiveTracking();';

function simulate(isLogin){
  const events=[],delayed=[],calls=[];
  const context={
    window:{qcSupabase:{auth:{onAuthStateChange(callback){events.push(callback)}}},
      addEventListener(){}},
    document:{querySelector(selector){
      return isLogin && selector.includes('#loginForm')?{}:null;
    },addEventListener(){}},
    qcTouchLastActive(force){calls.push(force);return Promise.resolve();},
    setTimeout(callback,delay){delayed.push({callback,delay});return delayed.length;},
    console
  };
  vm.runInNewContext(fragment,context);
  return {events,delayed,calls};
}

test('login form does not create a competing SDK auth-session reader',()=>{
  const run=simulate(true);
  assert.equal(run.events.length,0);
  assert.equal(run.calls.length,0);
  assert.equal(run.delayed.length,0);
});

test('ordinary page defers session reads and auth-event work',()=>{
  const run=simulate(false);
  assert.equal(run.events.length,1);
  assert.equal(run.calls.length,0,'no immediate getSession on page mount');
  assert.equal(run.delayed.length,1);
  assert.equal(run.delayed[0].delay,3200);
  const callback=run.events[0];
  callback('SIGNED_IN',{user:{id:'test-placeholder'}});
  assert.equal(run.calls.length,0,'no auth.getSession within auth callback');
  assert.equal(run.delayed.length,2);
  assert.equal(run.delayed[1].delay,0);
  run.delayed[1].callback();
  assert.deepEqual(run.calls,[true]);
  callback('TOKEN_REFRESHED',{user:{id:'test-placeholder'}});
  assert.equal(run.calls.length,1);
  run.delayed[2].callback();
  assert.deepEqual(run.calls,[true,false]);
});

test('shared cached application asset across active user pages',()=>{
  const pages=['index.html','football.html','league.html',
    'jc-match.html','profile.html','register.html',
    'forgot-password.html','reset-password.html','verify.html'];
  for(const page of pages){
    const html=fs.readFileSync(path.join(root,page),'utf8');
    assert.match(html,/<script\b[^>]*src="app\.js\?v=20261028authdeadline1"/,
      page+' must use the same app.js cache key');
  }
  const login=fs.readFileSync(path.join(root,'login.html'),'utf8');
  assert.match(login,/<script\b[^>]*src="login-fast\.js\?v=20261028fastlogin1"/);
  assert.doesNotMatch(login,/<script\b[^>]*src="app\.js/);
});
