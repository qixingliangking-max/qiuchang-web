'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'app.js'),'utf8');
const a=source.indexOf('async function setupDesktopAccountNav(){');
const b=source.indexOf('\nfunction qcSetupProfileContactModal(',a);
assert.ok(a>0&&b>a,'desktop navigation source found');
const fragment=source.slice(a,b);
function harness({desktop=false,session={user:{id:'pro-a',email:'a@sample.invalid'}},manualSession=false,fetchDelay=false}={}){
  const els={};
  for(const id of ['#desktopLogin','#desktopRedeem','#desktopAccount','#desktopLogout','#desktopAccountDivider'])
    els[id]={hidden:false,style:{},textContent:'',title:''};
  const calls={nickname:0,session:0},idle=[],timers=[];
  let cb,resolveSession,resolveNick,profileCalls=[];
  const sdk={auth:{
    onAuthStateChange(fn){cb=fn;return {data:{subscription:{unsubscribe(){}}}};},
    async signOut(){cb('SIGNED_OUT',null);return {error:null};}
  },from(table){
    assert.equal(table,'profiles');calls.nickname++;
    const q={select(s){assert.equal(s,'nickname');return this;},eq(k,v){assert.equal(k,'id');profileCalls.push(v);return this;},
      maybeSingle(){return fetchDelay?new Promise(r=>resolveNick=r):Promise.resolve({data:{nickname:'测试昵称'}});}};
    return q;
  }};
  const context={window:{qcSupabase:sdk},'$':name=>els[name]||null,
    qcGetSharedSession:()=>{calls.session++;return manualSession?
      new Promise(r=>resolveSession=r):Promise.resolve({data:{session},error:null});},
    matchMedia:()=>({matches:desktop}),
    requestIdleCallback:fn=>{idle.push(fn);return idle.length;},
    setTimeout:(fn)=>{timers.push(fn);return timers.length;},
    qcEnsureDesktopRedeemModal:()=>({_qcOpen(){}}),
    location:{href:''},console:{warn(){}},Promise,Array,Boolean,String};
  vm.createContext(context);
  vm.runInContext(fragment,context);
  const run=vm.runInContext('setupDesktopAccountNav()',context);
  return {els,calls,idle,timers,run,profileCalls,
    emit:(event,s)=>cb(event,s),finishSession:s=>resolveSession({data:{session:s},error:null}),
    finishNick:name=>resolveNick({data:{nickname:name}}),
    flush:async()=>{for(let i=0;i<8;i++)await Promise.resolve();}
  };
}
test('mobile signed-in page does not query hidden desktop nickname',async()=>{
 const h=harness();await h.run;await h.flush();
 assert.equal(h.calls.session,1);
 assert.equal(h.calls.nickname,0);
 assert.equal(h.idle.length,0);
 assert.equal(h.els['#desktopAccount'].textContent,'a');
 assert.equal(h.els['#desktopAccount'].hidden,false);
});
test('desktop shows account immediately and fetches optional nickname only when idle',async()=>{
 const h=harness({desktop:true});await h.run;await h.flush();
 assert.equal(h.els['#desktopAccount'].textContent,'a');
 assert.equal(h.calls.nickname,0);
 assert.equal(h.idle.length,1);
 await h.idle[0]();await h.flush();
 assert.equal(h.calls.nickname,1);
 assert.equal(h.els['#desktopAccount'].textContent,'测试昵称');
});
test('signout makes nav guest-safe and ignores a late nickname reply',async()=>{
 const h=harness({desktop:true,fetchDelay:true});await h.run;
 const pending=h.idle[0]();
 h.emit('SIGNED_OUT',null);
 assert.equal(h.els['#desktopAccount'].hidden,true);
 h.finishNick('绝不显示');
 await pending;await h.flush();
 assert.equal(h.els['#desktopAccount'].textContent,'个人中心');
 assert.equal(h.els['#desktopLogin'].hidden,false);
});
test('late SIGNED_IN updates desktop account without waiting for slow initial session',async()=>{
 const h=harness({desktop:true,session:null,manualSession:true});
 h.emit('SIGNED_IN',{user:{id:'pro-b',email:'b@sample.invalid'}});
 assert.equal(h.els['#desktopAccount'].hidden,false);
 assert.equal(h.els['#desktopAccount'].textContent,'b');
 h.finishSession(null);await h.run;
 assert.equal(h.els['#desktopAccount'].textContent,'b');
 assert.equal(h.idle.length,1);
});
test('provisional INITIAL_SESSION may be superseded by shared restored session',async()=>{
 const h=harness({desktop:false,manualSession:true});
 h.emit('INITIAL_SESSION',null);
 h.finishSession({user:{id:'pro-a',email:'a@sample.invalid'}});await h.run;
 assert.equal(h.els['#desktopAccount'].hidden,false);
 assert.equal(h.calls.nickname,0);
});
