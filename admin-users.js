(function(){
  function q(s,e){return (e||document).querySelector(s);}
  function qa(s,e){return Array.prototype.slice.call((e||document).querySelectorAll(s));}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function fmt(v){
    if(!v)return '—';
    var d=new Date(v);
    if(isNaN(d.getTime()))return String(v);
    return d.toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
  }
  function beijingToday(){
    var parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    var m={}; parts.forEach(function(p){m[p.type]=p.value;});
    return m.year+'-'+m.month+'-'+m.day;
  }
  function dateLabel(s){
    if(!s)return '—';
    var d=new Date(s+'T12:00:00+08:00');
    if(isNaN(d.getTime()))return s;
    return (d.getMonth()+1)+'月'+d.getDate()+'日';
  }

  async function requireAdmin(){
    var root=q('#adminUsersRoot');
    if(!window.qcSupabase){
      root.innerHTML='<div class="profile-card">数据库连接失败，请刷新页面后重试。</div>';
      return false;
    }
    var ur=await window.qcSupabase.auth.getUser();
    if(ur.error || !ur.data || !ur.data.user){
      location.href='login.html?next=admin-users.html';
      return false;
    }
    var sr=await window.qcSupabase.rpc('admin_dashboard_stats');
    if(sr.error){
      root.innerHTML='<div class="profile-card"><h2>管理员验证未通过</h2><p>请重新登录管理员账号后再试。</p></div>';
      return false;
    }
    return true;
  }

  async function init(){
    if(!q('#adminUsersRoot'))return;
    if(!(await requireAdmin()))return;

    var all=[];
    var selected=beijingToday();
    var search=q('#adminUserSearch');
    var userRows=q('#adminUserRows');
    var dailyRows=q('#adminDailyRows');
    var detailRows=q('#adminDailyDetailRows');

    async function overview(){
      var r=await window.qcSupabase.rpc('admin_user_overview');
      if(r.error){console.error('admin_user_overview',r.error);return;}
      var x=r.data||{};
      if(q('#usersTotal'))q('#usersTotal').textContent=x.total_users||0;
      if(q('#usersPro'))q('#usersPro').textContent=x.pro_users||0;
      if(q('#usersToday'))q('#usersToday').textContent=x.today_new||0;
      if(q('#usersLogin24h'))q('#usersLogin24h').textContent=(x.active_24h!=null?x.active_24h:(x.login_24h||0));
      if(q('#dailyTodayActive'))q('#dailyTodayActive').textContent=x.today_active||0;
      if(q('#dailyTodayLogin'))q('#dailyTodayLogin').textContent=x.today_login||0;
      if(q('#dailyTodayRedeem'))q('#dailyTodayRedeem').textContent=x.today_redeem||0;
      if(q('#daily7Active'))q('#daily7Active').textContent=x.active_7d||0;
    }

    function renderUsers(items){
      if(!items.length){userRows.innerHTML='<tr><td colspan="8">没有匹配用户</td></tr>';return;}
      userRows.innerHTML=items.map(function(item){
        var active=item.account_status==='active';
        var membership=item.membership||'基础用户';
        var expiry=membership==='Pro会员'?fmt(item.pro_expires_at):(membership==='管理员'?'管理员权限':'—');
        var status=active?'<span class="admin-status ok">正常</span>':'<span class="admin-status off">已停用</span>';
        var action=item.role==='admin'?'<span class="admin-action-muted">—</span>':
          '<button class="admin-user-action '+(active?'danger':'restore')+'" type="button" data-user-id="'+esc(item.user_id||'')+'" data-email="'+esc(item.email||'')+'" data-action="'+(active?'disable':'restore')+'">'+(active?'停用':'恢复')+'</button>';
        return '<tr><td><strong>'+esc(item.email||'—')+'</strong></td><td>'+esc(fmt(item.created_at))+'</td><td>'+esc(fmt(item.last_active_at))+'</td><td>'+esc(fmt(item.last_sign_in_at))+'</td><td>'+esc(membership)+'</td><td>'+esc(expiry)+'</td><td>'+status+'</td><td>'+action+'</td></tr>';
      }).join('');
      qa('.admin-user-action',userRows).forEach(function(btn){
        btn.onclick=async function(){
          var action=btn.getAttribute('data-action');
          var rpc=action==='disable'?'admin_disable_user':'admin_restore_user';
          var verb=action==='disable'?'停用':'恢复';
          if(!confirm('确认'+verb+'账号：'+(btn.getAttribute('data-email')||'该账号')+'？'))return;
          btn.disabled=true;
          var rr=await window.qcSupabase.rpc(rpc,{target_user:btn.getAttribute('data-user-id')});
          if(rr.error || !rr.data || !rr.data.ok){alert(verb+'失败');btn.disabled=false;return;}
          await Promise.all([loadUsers(),overview()]);
        };
      });
    }

    function filterUsers(){
      var s=(search&&search.value?search.value:'').trim().toLowerCase();
      renderUsers(!s?all:all.filter(function(x){return String(x.email||'').toLowerCase().indexOf(s)>=0;}));
    }

    async function loadUsers(){
      var r=await window.qcSupabase.rpc('admin_users_list');
      if(r.error){console.error('admin_users_list',r.error);userRows.innerHTML='<tr><td colspan="8">用户数据读取失败</td></tr>';return;}
      all=r.data||[];
      filterUsers();
    }

    async function detail(dateStr){
      selected=dateStr||beijingToday();
      if(q('#adminDailyDetailTitle'))q('#adminDailyDetailTitle').textContent=dateLabel(selected)+' 明细';
      detailRows.innerHTML='<tr><td colspan="7">正在读取…</td></tr>';
      var r=await window.qcSupabase.rpc('admin_daily_activity_detail',{p_date:selected});
      if(r.error){console.error('admin_daily_activity_detail',r.error);detailRows.innerHTML='<tr><td colspan="7">每日明细读取失败</td></tr>';return;}
      var items=r.data||[];
      detailRows.innerHTML=items.length?items.map(function(x){
        return '<tr><td><strong>'+esc(x.email||'—')+'</strong></td><td>'+esc(x.membership||'—')+'</td><td>'+esc(fmt(x.first_active_at))+'</td><td>'+esc(fmt(x.last_active_at))+'</td><td>'+esc(x.active_count||0)+'</td><td>'+esc(x.login_count||0)+'</td><td>'+esc(x.redeem_count||0)+'</td></tr>';
      }).join(''):'<tr><td colspan="7">当天暂无记录</td></tr>';
      qa('tr[data-date]',dailyRows).forEach(function(tr){tr.classList.toggle('selected',tr.getAttribute('data-date')===selected);});
    }

    async function daily(days){
      dailyRows.innerHTML='<tr><td colspan="5">正在读取…</td></tr>';
      var r=await window.qcSupabase.rpc('admin_daily_activity_summary',{p_days:days});
      if(r.error){console.error('admin_daily_activity_summary',r.error);dailyRows.innerHTML='<tr><td colspan="5">每日活跃读取失败</td></tr>';return;}
      var items=r.data||[];
      dailyRows.innerHTML=items.map(function(x){
        return '<tr data-date="'+esc(x.activity_date||'')+'" class="'+(x.activity_date===selected?'selected':'')+'"><td><strong>'+esc(dateLabel(x.activity_date))+'</strong></td><td>'+esc(x.active_users||0)+'</td><td>'+esc(x.login_users||0)+'</td><td>'+esc(x.login_events||0)+'</td><td>'+esc(x.redeem_users||0)+'</td></tr>';
      }).join('');
      qa('tr[data-date]',dailyRows).forEach(function(tr){tr.onclick=function(){detail(tr.getAttribute('data-date'));};});
    }

    qa('.admin-daily-tabs button').forEach(function(btn){
      btn.onclick=async function(){
        qa('.admin-daily-tabs button').forEach(function(x){x.classList.toggle('active',x===btn);});
        await daily(Number(btn.getAttribute('data-days')||7));
      };
    });

    if(search)search.oninput=filterUsers;
    await Promise.all([overview(),loadUsers(),daily(7),detail(selected)]);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){init().catch(console.error);});
  else init().catch(console.error);
})();