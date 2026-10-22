// =====================================================
//  网站配置 —— 部署时只需要改这个文件
//  SUPABASE_URL / SUPABASE_ANON_KEY 在 Supabase 后台
//  Project Settings → API（或 Data API）里复制
//  anon key 本来就是公开的，放在这里是安全的
// =====================================================
window.APP_CONFIG = {
  SUPABASE_URL: "https://github.com/TwinkleStella/fdu-/edit/main/config.js",
  SUPABASE_ANON_KEY: "sb_publishable_M_r__stw7gGymsAd-xU2gA_ELrQSqV4",

  ORG_NAME: "复旦经院学术科创中心",
  APP_NAME: "学科资料库",

  // 登录账号 = 学号，系统内部拼成 学号@这个域名（复旦学生邮箱），用于找回密码
  EMAIL_DOMAIN: "m.fudan.edu.cn",

  // 单个文件上限（MB）。Supabase 免费版上限 50MB，升级 Pro 后可改大
  MAX_UPLOAD_MB: 50,

  // 存储总容量（GB），仅用于后台显示用量。免费版 1，Pro 100
  STORAGE_QUOTA_GB: 1,
};
