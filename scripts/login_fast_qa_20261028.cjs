'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'login-fast.js'),'utf8');

function makeHarness({status=200,next='jc-match.html?id=abc',persisted=false}={}){
  const events={},calls={requests:[],sessions:[],getSession:0,navigate:[],eventCallbacks:[]};
  const el=(id)=>({
    id,value:'',checked:false,disabled:false,textContent:'',className:'',dataset:{},handlers:{},
    addEventListener(event,fn){(this.handlers[event]??=[]).push(fn)},
    querySelector(selector){if(selector.includes('button'))return nodes.submit;return null},
    contains(){return false}
  });
  const nodes=Object.fromEntries(['loginForm','loginHint','loginAgreement','loginAutoLogin','loginEmail','loginPassword'].map(id=>[id,el(id)]));
  nodes.submit=el('submit');
  nodes.loginForm.querySelector=()=>nodes.submit;
  nodes.loginEmail.value='test@example.com';
  nodes.loginPassword.value='dummy-password-123';
  nodes.loginAgreement.checked=true;
  const store=new Map([['qc-login-agreement-v1','1']]);
  const timers=new Map();
  const session={user:{id:'test-id'}};
  let timeoutSeq=0;
  const context={
    window:{
      qcGetAutoLoginPreference:()=>persisted,
      qcSetAutoLoginPreference:()=>{},
      QC_SUPABASE_URL:'https://example.supabase.co',
      QC_SUPABASE_PUBLISHABLE_KEY:'public-key',
      qcSupabase:{
        auth:{
          onAuthStateChange(fn){calls.eventCallbacks.push(fn)},
          getSession(){calls.getSession++;throw new Error('forbidden lock on login')},
          async setSession(arg){calls.sessions.push(arg);return {data:{session},error:null}}
        },
        async rpc(){return {data:true,error:null}}
      }
    },
    document:{getElementById(id){return nodes[id]},activeElement:null},
    location:{origin:'https://qcda.cn',search:'?next='+encodeURIComponent(next),pathname:'/login.html',
      replace(dest){calls.navigate.push(dest)}},
    history:{replaceState(){}},
    navigator:{userAgent:'Mozilla/5.0'},
    localStorage:{getItem(k){return store.get(k)||null},setItem(k,v){store.set(k,v)}},
    sessionStorage:{setItem(k,v){store.set(k,v)}},
    URL,URLSearchParams,AbortController,
    setTimeout(fn,_ms){const id=++timeoutSeq;timers.set(id,fn);return id},
    clearTimeout(id){timers.delete(id)},
    async fetch(url,opts){calls.requests.push({url,opts});
      return {ok:status===200,status,async json(){
        return status===200?{access_token:'token',refresh_token:'refresh'}:
        {code:'invalid_credentials',message:'Invalid login credentials'};
      }};
    },
    console
  };
  vm.runInNewContext(source,context);
  return {nodes,calls,events,timers};
}
async function submit(h){
 const fn=h.nodes.loginForm.handlers.submit?.[0]; assert.ok(fn,'submit handler bound');
 await fn({preventDefault(){}});
}
test('login page downloads only small login controller, not full app bundle',()=>{
 const html=fs.readFileSync(path.join(root,'login.html'),'utf8');
 assert.match(html,/src="login-fast\.js\?v=20261029netretry2"/);
 assert.doesNotMatch(html,/<script\b[^>]*src="app\.js/);
 assert.ok(Buffer.byteLength(source)<10000,'fast login target 10KB');
});
test('valid login persists same SDK session, logs in once, redirects to safe next',async()=>{
 const h=makeHarness(); await submit(h);
 assert.equal(h.calls.requests.length,1);
 assert.match(h.calls.requests[0].url,/\/auth\/v1\/token\?grant_type=password$/);
 assert.equal(h.calls.requests[0].opts.cache,'no-store');
 assert.ok(h.calls.requests[0].opts.signal);
 assert.equal(h.calls.sessions.length,1);
 assert.equal(h.calls.navigate[0],'jc-match.html?id=abc');
 assert.equal(h.calls.getSession,0,'must not lock pending login with getSession');
 assert.equal(h.nodes.submit.disabled,false);
});
test('invalid credentials get precise user-facing feedback, never navigate',async()=>{
 const h=makeHarness({status:400});await submit(h);
 assert.equal(h.calls.navigate.length,0);
 assert.match(h.nodes.loginHint.textContent,/邮箱或密码错误/);
 assert.equal(h.calls.sessions.length,0);
});
test('cross-origin next query cannot redirect outside the site',async()=>{
 const h=makeHarness({next:'https://evil.example/steal'});await submit(h);
 assert.deepEqual(h.calls.navigate,['index.html']);
});
test('INITIAL_SESSION avoids a new getSession request and does not override typing',()=>{
 const h=makeHarness({persisted:true});
 assert.equal(h.calls.eventCallbacks.length,1);
 h.calls.eventCallbacks[0]('INITIAL_SESSION',{user:{id:'test-id'}});
 assert.equal(h.calls.getSession,0);
 assert.equal(h.calls.navigate.length,0);
});
test('script has no app-wide initialization or separate entitlement bypass',()=>{
 assert.doesNotMatch(source,/qcGetOverviewBootstrap|qc_detail_prediction_snapshots|has_active_pro_access/);
 assert.match(source,/setSession/);
});
