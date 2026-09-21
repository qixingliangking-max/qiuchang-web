if (!window.QC_SUPABASE_URL || !window.QC_SUPABASE_PUBLISHABLE_KEY) {
  console.error('Supabase 配置缺失');
} else if (!window.supabase) {
  console.error('Supabase JS 尚未加载');
} else {
  window.qcSupabase = window.supabase.createClient(
    window.QC_SUPABASE_URL,
    window.QC_SUPABASE_PUBLISHABLE_KEY
  );
}
