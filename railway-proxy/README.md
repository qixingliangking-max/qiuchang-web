# 球场档案 Auth/API Proxy

Railway 备用网络通道。浏览器无法直接访问 Supabase 时，通过该服务转发以下接口：

- /auth/v1/*
- /rest/v1/*
- /functions/v1/*

## Railway 环境变量

SUPABASE_URL=https://oqtloldkfjxildoribkf.supabase.co
SUPABASE_PUBLISHABLE_KEY=<Supabase publishable key>
ALLOWED_ORIGINS=https://qixingliangking-max.github.io

启动命令：npm start

健康检查：/healthz

注意：不得在此服务中配置或返回 service_role key。
