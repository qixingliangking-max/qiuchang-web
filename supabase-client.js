if (!window.QC_SUPABASE_URL || !window.QC_SUPABASE_PUBLISHABLE_KEY) {
  console.error('Supabase 配置缺失');
} else if (!window.supabase) {
  console.error('Supabase JS 尚未加载');
} else {
  const QC_AUTO_LOGIN_KEY='qc-auto-login';

  function qcAuthStoragePreference(){
    try{
      return localStorage.getItem(QC_AUTO_LOGIN_KEY);
    }catch(_){
      return null;
    }
  }

  const qcAuthStorage={
    getItem(key){
      try{
        const pref=qcAuthStoragePreference();
        if(pref==='1') return localStorage.getItem(key);
        if(pref==='0') return sessionStorage.getItem(key);
        // Legacy compatibility: existing users may already have a valid persistent session.
        return sessionStorage.getItem(key) ?? localStorage.getItem(key);
      }catch(_){
        return null;
      }
    },
    setItem(key,value){
      const pref=qcAuthStoragePreference();
      try{
        if(pref==='0'){
          sessionStorage.setItem(key,value);
          localStorage.removeItem(key);
        }else{
          localStorage.setItem(key,value);
          sessionStorage.removeItem(key);
        }
      }catch(_){}
    },
    removeItem(key){
      try{ localStorage.removeItem(key); }catch(_){}
      try{ sessionStorage.removeItem(key); }catch(_){}
    }
  };

  window.qcSetAutoLoginPreference=function(enabled){
    try{
      localStorage.setItem(QC_AUTO_LOGIN_KEY,enabled?'1':'0');
    }catch(_){}
  };

  window.qcGetAutoLoginPreference=function(){
    try{
      return localStorage.getItem(QC_AUTO_LOGIN_KEY)==='1';
    }catch(_){
      return false;
    }
  };

  window.qcSupabase = window.supabase.createClient(
    window.QC_SUPABASE_URL,
    window.QC_SUPABASE_PUBLISHABLE_KEY,
    {
      auth:{
        storage:qcAuthStorage,
        persistSession:true,
        autoRefreshToken:true,
        detectSessionInUrl:true
      }
    }
  );
}
