function $(q, el=document){return el.querySelector(q)}
function $$(q, el=document){return [...el.querySelectorAll(q)]}
function setupDrawer(){const btn=$('#menuBtn'),bd=$('#drawerBackdrop'); if(!btn||!bd)return;btn.onclick=()=>bd.classList.add('open');bd.onclick=e=>{if(e.target===bd)bd.classList.remove('open')}}
function renderIndex(){
 const recap=$('#recapRows'),cards=$('#matchCards');if(!recap||!cards)return;
 recap.innerHTML=QC_DATA.recap.map(r=>`<tr class="${r.hit?'hit':''}"><td><b>${r.n}</b></td><td>${r.time}</td><td><span class="league-tag">${r.league}</span></td><td><span class="home">${r.home}</span><br><b class="score">${r.score}</b><br><span class="away">${r.away}</span></td><td>${r.hit?`<span class="hit-ring">${r.direction}</span>`:`<span class="pick">${r.direction}</span>`}</td><td><span class="pick">${r.goals}</span></td><td><span class="pick">${r.htft}</span></td></tr>`).join('');
 cards.innerHTML=QC_DATA.matches.map(m=>`<a class="match-card" href="match.html?id=${m.id}"><div class="match-top"><span>${m.n} · ${m.league}</span><span>${m.time}</span></div><div class="match-main"><div class="team">${m.home}</div><div class="versus">VS</div><div class="team right">${m.away}</div></div><div class="model-grid"><div class="model-chip"><b>模型方向</b><span>${m.direction}</span></div><div class="model-chip"><b>M7</b><span>${m.m7}</span></div><div class="model-chip"><b>M8</b><span>${m.m8}</span></div></div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><span class="pill blue">半全场 ${m.htft}</span><span class="pill orange">区间 ${m.range}</span><span class="pill green">置信 ${m.confidence}</span></div></a>`).join('')
}
function renderMatch(){
 const root=$('#matchRoot');if(!root)return;const id=new URLSearchParams(location.search).get('id');const m=QC_DATA.matches.find(x=>x.id===id)||QC_DATA.matches[0];
 root.innerHTML=`<div class="detail-head"><div class="match-top"><span>${m.n} · ${m.league}</span><span>${m.time}</span></div><div class="detail-title" style="margin-top:18px"><div class="team-badge"><span class="badge-circle">主</span>${m.home}</div><div class="center-score"><strong>VS</strong><small>赛前</small></div><div class="team-badge right">${m.away}<span class="badge-circle">客</span></div></div><div class="tabs" id="topTabs"><button class="active" data-tab="model">模型分析</button><button data-tab="data">赛况数据</button><button data-tab="market">市场数据</button><button data-tab="report">深度报告</button></div></div><div id="tabBody"></div>`;
 function show(tab){$$('#topTabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab)); const body=$('#tabBody');
 if(tab==='model') body.innerHTML=`<div class="panel"><h2>模型结论</h2><div class="prob-row"><div class="prob-box"><b>46%</b><span>主胜</span></div><div class="prob-box"><b>31%</b><span>平局</span></div><div class="prob-box"><b>23%</b><span>客胜</span></div></div><div class="result-grid" style="margin-top:16px"><div class="result-card"><b>模型方向</b><strong>${m.direction}</strong></div><div class="result-card"><b>M7</b><strong>${m.m7}</strong></div><div class="result-card"><b>M8</b><strong>${m.m8}</strong></div><div class="result-card"><b>半全场</b><strong>${m.htft}</strong></div><div class="result-card"><b>主要进球区间</b><strong>${m.range}</strong></div><div class="result-card"><b>置信度</b><strong>${m.confidence}</strong></div></div><h3 style="margin-top:22px">TOP3</h3><div class="score-list">${m.top.map(s=>`<span class="score-chip">${s}</span>`).join('')}</div><div class="data-quality" style="margin-top:22px"><b>数据完整度 ${m.quality}%</b><div class="quality-bar"><span style="width:${m.quality}%"></span></div></div></div>`;
 if(tab==='data') body.innerHTML=`<div class="panel"><div class="subtabs"><button class="active">数据</button><button>阵容</button><button>排名</button><button>技术统计</button><button>交锋</button></div><h2 style="margin-top:22px">赛况数据</h2><div class="result-grid"><div class="result-card"><b>比赛状态</b><strong>赛前</strong></div><div class="result-card"><b>联赛</b><strong>${m.league}</strong></div><div class="result-card"><b>主队</b><strong>${m.home}</strong></div><div class="result-card"><b>客队</b><strong>${m.away}</strong></div></div><p style="color:var(--muted);line-height:1.7;margin-top:18px">V0.1 先接入我们已有的赛程、球队、近期状态和模型结果。阵容、排名、技术统计、H2H 会作为后续自动数据层逐项接入。</p></div>`;
 if(tab==='market') body.innerHTML=`<div class="panel"><h2>市场数据</h2><div class="result-grid"><div class="result-card"><b>1X2 快照</b><strong>已预留字段</strong></div><div class="result-card"><b>让球快照</b><strong>已预留字段</strong></div><div class="result-card"><b>大小球快照</b><strong>已预留字段</strong></div><div class="result-card"><b>时间序列</b><strong>待接自动采集</strong></div></div><h3 style="margin-top:24px">赔率变化表</h3><table class="brief-table"><thead><tr><th>时间</th><th>主</th><th>平</th><th>客</th></tr></thead><tbody><tr><td>11:00</td><td>2.07</td><td>3.10</td><td>3.10</td></tr><tr><td>12:00</td><td>1.95</td><td>3.18</td><td>3.45</td></tr><tr><td>13:00</td><td>1.88</td><td>3.22</td><td>3.60</td></tr></tbody></table></div>`;
 if(tab==='report') body.innerHTML=`<div class="panel report"><h2>${m.home} vs ${m.away}｜赛前模型分析报告</h2><p><b>报告状态：</b>V0.1 模板生成。</p><h3>一、核心矛盾</h3><p>主队的比赛控制能力与客队的转换效率构成本场主要矛盾。模型不把单一近期比分直接等同于当前实力，而是结合阵容完整度、对手层级与路径一致性处理。</p><h3>二、近期状态与阵容</h3><p>近期表现用于刻画状态，不直接覆盖长期基线。阵容信息在未确认首发前只做有限修正，避免重复加权。</p><h3>三、市场与路径</h3><p>市场层作为有界参考，不直接接管模型方向。M7 与 M8 分别保留独立 Gate，最终以模型一致性和路径可实现性决定输出。</p><h3>四、最终结论</h3><p><b>方向：</b>${m.direction}；<b>区间：</b>${m.range}；<b>半全场：</b>${m.htft}；<b>TOP3：</b>${m.top.join(' / ')}。</p><h3>数据边界</h3><p>当前演示版未接实时阵容、xG、赔率公司池和赛中技术统计，因此这些字段不参与 V0.1 的实时校正。</p></div>`;
 }
 $$('#topTabs button').forEach(b=>b.onclick=()=>show(b.dataset.tab));show('model')
}
function setupDemoAuth(){
  const login = $('#loginForm');

  if(login){
    login.onsubmit = async e => {
      e.preventDefault();

      if(!window.qcSupabase){
        alert('数据库连接失败，请刷新页面后重试');
        return;
      }

      const email = login.querySelector('input[type="email"]').value.trim();
      const password = login.querySelector('input[type="password"]').value;
      const button = login.querySelector('button');

      button.disabled = true;
      button.textContent = '登录中...';

      const { data, error } = await window.qcSupabase.auth.signInWithPassword({
        email,
        password
      });

      button.disabled = false;
      button.textContent = '登录';

      if(error){
        alert('登录失败：' + error.message);
        return;
      }

      if(data.user){
        location.href = 'profile.html';
      }
    };
  }

  const reg = $('#registerForm');

  if(reg){
    const emailInput = $('#regEmail');
    const nicknameInput = $('#regNickname');
    const passwordInput = $('#regPassword');
    const codeInput = $('#regCode');
    const sendCodeBtn = $('#sendCodeBtn');
    const codeHint = $('#codeHint');
    let countdownTimer = null;

    const setHint = (message, state='') => {
      if(!codeHint) return;
      codeHint.textContent = message;
      codeHint.className = 'code-hint' + (state ? ' ' + state : '');
    };

    const startCountdown = (seconds=50) => {
      if(countdownTimer) clearInterval(countdownTimer);
      let left = seconds;
      sendCodeBtn.disabled = true;
      sendCodeBtn.textContent = left + '秒后重发';
      countdownTimer = setInterval(() => {
        left -= 1;
        if(left <= 0){
          clearInterval(countdownTimer);
          countdownTimer = null;
          sendCodeBtn.disabled = false;
          sendCodeBtn.textContent = '重新发送';
          return;
        }
        sendCodeBtn.textContent = left + '秒后重发';
      }, 1000);
    };

    const sendSignupCode = async () => {
      if(!window.qcSupabase){
        alert('数据库连接失败，请刷新页面后重试');
        return;
      }

      const email = emailInput.value.trim();
      const password = passwordInput.value;
      const nickname = nicknameInput.value.trim();

      if(!email){
        alert('请先填写邮箱');
        emailInput.focus();
        return;
      }

      if(password.length < 8){
        alert('密码至少需要8个字符');
        passwordInput.focus();
        return;
      }

      sendCodeBtn.disabled = true;
      sendCodeBtn.textContent = '发送中...';
      setHint('正在发送验证码…');

      const pendingEmail = sessionStorage.getItem('qc_pending_email');
      let error = null;

      if(pendingEmail === email){
        const result = await window.qcSupabase.auth.resend({
          type: 'signup',
          email
        });
        error = result.error;
      }else{
        const result = await window.qcSupabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              nickname
            }
          }
        });
        error = result.error;
      }

      if(error){
        sendCodeBtn.disabled = false;
        sendCodeBtn.textContent = '发送验证码';
        setHint('验证码发送失败，请检查邮箱后重试。', 'error');
        alert('发送验证码失败：' + error.message);
        return;
      }

      sessionStorage.setItem('qc_pending_email', email);
      setHint('验证码已发送，请检查邮箱（包括垃圾邮件文件夹）。', 'success');
      startCountdown(50);
      codeInput.focus();
    };

    sendCodeBtn.onclick = sendSignupCode;

    reg.onsubmit = async e => {
      e.preventDefault();

      if(!window.qcSupabase){
        alert('数据库连接失败，请刷新页面后重试');
        return;
      }

      const email = emailInput.value.trim();
      const token = codeInput.value.trim();
      const button = reg.querySelector('button[type="submit"]');

      if(!/^\d{6}$/.test(token)){
        alert('请输入邮件中的6位验证码');
        codeInput.focus();
        return;
      }

      const pendingEmail = sessionStorage.getItem('qc_pending_email');
      if(!pendingEmail || pendingEmail !== email){
        alert('请先点击“发送验证码”');
        return;
      }

      button.disabled = true;
      button.textContent = '验证中...';

      const { data, error } = await window.qcSupabase.auth.verifyOtp({
        email,
        token,
        type: 'signup'
      });

      button.disabled = false;
      button.textContent = '验证并注册';

      if(error){
        setHint('验证码错误或已过期，请重新输入。', 'error');
        alert('验证失败：' + error.message);
        return;
      }

      sessionStorage.removeItem('qc_pending_email');
      setHint('邮箱验证成功。', 'success');

      if(data.session){
        alert('注册成功');
        location.href = 'profile.html';
      }else{
        alert('注册成功，请登录');
        location.href = 'login.html';
      }
    };
  }

  const verify = $('#verifyForm');
  if(verify){
    const emailInput = $('#verifyEmail');
    const savedEmail = sessionStorage.getItem('qc_pending_email') || '';
    if(emailInput && savedEmail) emailInput.value = savedEmail;

    verify.onsubmit = async e => {
      e.preventDefault();

      if(!window.qcSupabase){
        alert('数据库连接失败，请刷新页面后重试');
        return;
      }

      const email = $('#verifyEmail').value.trim();
      const token = $('#verifyCode').value.trim();
      const button = verify.querySelector('button');

      button.disabled = true;
      button.textContent = '验证中...';

      const { data, error } = await window.qcSupabase.auth.verifyOtp({
        email,
        token,
        type: 'signup'
      });

      button.disabled = false;
      button.textContent = '完成验证';

      if(error){
        alert('验证失败：' + error.message);
        return;
      }

      sessionStorage.removeItem('qc_pending_email');

      if(data.session){
        alert('邮箱验证成功');
        location.href = 'profile.html';
      }else{
        alert('邮箱验证成功，请登录');
        location.href = 'login.html';
      }
    };
  }
}
document.addEventListener('DOMContentLoaded',()=>{setupDrawer();renderIndex();renderMatch();setupDemoAuth()})
