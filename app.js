/* =========================================================
   学科资料库 · app.js
   纯前端单页应用：GitHub Pages 托管 + Supabase 后端
   ========================================================= */
(function () {
'use strict';

const CFG = window.APP_CONFIG || {};
const APP = document.getElementById('app');
const BUCKET = 'files';
const MAX_BYTES = (CFG.MAX_UPLOAD_MB || 50) * 1024 * 1024;
const INITIAL_HASH = location.hash; // 找回密码链接会带 #access_token=…&type=recovery
let routerBound = false;

/* ---------- 板块定义 ---------- */
const SECTIONS = {
  course:  { name: '课程资料', short: '课程', tagLabel: '课程名', tagHint: '如：中级微观经济学',
             cats: ['PPT课件', '笔记', '作业', '小组Pre', '复习资料', '往届考卷'],
             downloadable: false, allowLink: false, hasTeacher: true },
  intern:  { name: '实习面试', short: '实习', tagLabel: '公司 / 机构', tagHint: '如：中金公司 IBD',
             cats: ['面经', '笔试题', '简历模板', '行业研究', '其他'],
             downloadable: true, allowLink: true },
  exam:    { name: '职业考试', short: '考试', tagLabel: '科目 / 级别', tagHint: '如：Level I / 口语',
             cats: ['四六级', '雅思', '托福', 'CFA', '其他'],
             downloadable: true, allowLink: true },
  contest: { name: '比赛资料', short: '比赛', tagLabel: '比赛名称', tagHint: '如：挑战杯 / 正大杯',
             cats: ['PPT模板', 'BP模板', '获奖作品', '比赛通知', '其他'],
             downloadable: true, allowLink: true },
};
const COURSE_ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.gif';

/* ---------- 图标 ---------- */
const I = {
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  books: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5V5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2Zm0 0A2 2 0 0 0 6 22h13v-4"/><path d="M9 7h6"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z"/><path d="m9 12 2 2 4-4"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12h14"/></svg>',
};

/* ---------- 小工具 ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtSize = (b) => !b ? '' : b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(0) + ' KB' : b < 1073741824 ? (b / 1048576).toFixed(1) + ' MB' : (b / 1073741824).toFixed(2) + ' GB';
const fmtDate = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const fmtTime = (d) => { const x = new Date(d); return `${fmtDate(d)} ${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`; };
const ago = (d) => { const s = (Date.now() - new Date(d)) / 1000; if (s < 60) return '刚刚'; if (s < 3600) return Math.floor(s / 60) + ' 分钟前'; if (s < 86400) return Math.floor(s / 3600) + ' 小时前'; if (s < 86400 * 30) return Math.floor(s / 86400) + ' 天前'; return fmtDate(d); };
const extOf = (n) => { const m = /\.([a-z0-9]+)$/i.exec(n || ''); return m ? m[1].toLowerCase() : ''; };
function ftype(r) {
  if (r.kind === 'link') return ['link', '链接'];
  const e = extOf(r.file_name);
  if (e === 'pdf') return ['pdf', 'PDF'];
  if (['ppt', 'pptx', 'key'].includes(e)) return ['ppt', 'PPT'];
  if (['doc', 'docx', 'pages', 'txt', 'md'].includes(e)) return ['doc', 'DOC'];
  if (['xls', 'xlsx', 'csv', 'numbers'].includes(e)) return ['xls', 'XLS'];
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'heic'].includes(e)) return ['img', 'IMG'];
  if (['zip', 'rar', '7z'].includes(e)) return ['zip', 'ZIP'];
  return ['file', (e || 'FILE').slice(0, 4).toUpperCase()];
}
const isPreviewable = (r) => r.kind === 'file' && ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif'].includes(extOf(r.file_name));

let toastTimer;
function toast(msg, ms = 2400) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}
function errMsg(e) {
  const m = (e && (e.message || e.error_description || e.msg)) || String(e);
  if (/Invalid login credentials/i.test(m)) return '学号或密码不正确';
  if (/already registered|already been registered/i.test(m)) return '这个学号已经注册过了，请直接登录';
  if (/Password should be/i.test(m)) return '密码至少 8 位';
  if (/rate limit|too many/i.test(m)) return '操作太频繁，请稍后再试';
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return '网络连接失败，请检查网络后重试';
  if (/Payload too large|exceeded the maximum/i.test(m)) return '文件超过存储服务的大小上限';
  return m;
}
function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

/* ---------- 设备 ID（每台设备/浏览器一个）---------- */
function deviceId() {
  let id = store('fdse_device_id');
  if (!id) { id = uuid(); store('fdse_device_id', id); }
  return id;
}
function deviceLabel() {
  const u = navigator.userAgent;
  const os = /iPhone/.test(u) ? 'iPhone' : /iPad/.test(u) || (/Macintosh/.test(u) && navigator.maxTouchPoints > 1) ? 'iPad'
    : /Android/.test(u) ? 'Android' : /Mac/.test(u) ? 'Mac' : /Windows/.test(u) ? 'Windows' : /Linux/.test(u) ? 'Linux' : '设备';
  const br = /MicroMessenger/.test(u) ? '微信' : /Edg\//.test(u) ? 'Edge' : /CriOS|Chrome\//.test(u) ? 'Chrome' : /FxiOS|Firefox/.test(u) ? 'Firefox' : /Safari/.test(u) ? 'Safari' : '浏览器';
  const pwa = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone;
  return `${os} · ${pwa ? '桌面App' : br}`;
}

/* ---------- 全局状态 ---------- */
const S = {
  sb: null, session: null, me: null, role: 'member',
  cache: {}, // section -> rows
  filters: { cat: '全部', tag: '', term: '', sort: 'new', q: '' },
  pendingCount: 0, installEvt: null,
};

/* =========================================================
   启动
   ========================================================= */
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); S.installEvt = e; });
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

async function boot() {
  if (!CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY) return renderNotConfigured();
  if (!window.supabase) return renderFatal('核心组件加载失败，请刷新页面重试。');
  if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdfjs/pdf.worker.min.js';
  }
  S.sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'fdse-hub-auth' },
    global: { headers: { 'x-device-id': deviceId() } },
  });
  S.sb.auth.onAuthStateChange((ev, session) => {
    S.session = session;
    if (ev === 'PASSWORD_RECOVERY') renderResetPassword();
    if (ev === 'SIGNED_OUT') { S.me = null; S.cache = {}; renderAuth(); }
  });
  const { data } = await S.sb.auth.getSession();
  S.session = data.session;
  if (INITIAL_HASH.includes('type=recovery')) { if (S.session) renderResetPassword(); else renderAuth(); return; }
  if (!S.session) return renderAuth();
  await enter();
}

/* 登录后：登记设备 → 判断状态 → 进入 */
async function enter() {
  APP.innerHTML = `<div class="boot"><div class="seal seal-lg">学</div><p>正在验证身份…</p></div>`;
  let res;
  try {
    const { data, error } = await S.sb.rpc('register_device', { p_device_id: deviceId(), p_label: deviceLabel() });
    if (error) throw error;
    res = data;
  } catch (e) { return renderFatal('无法连接服务器：' + errMsg(e), true); }

  if (res.status === 'no_member') return renderAuth('redeem');
  if (res.status === 'banned') return renderBlocked('banned');
  if (res.status === 'pending' || res.status === 'revoked') return renderBlocked(res.status);

  const { data: me, error } = await S.sb.from('members').select('*').eq('id', S.session.user.id).single();
  if (error || !me) return renderFatal('读取成员信息失败：' + errMsg(error), true);
  S.me = me; S.role = me.role;
  renderShell();
  if (!routerBound) { window.addEventListener('hashchange', route); routerBound = true; }
  if (/access_token|type=/.test(location.hash)) history.replaceState(null, '', location.pathname);
  route();
  if (S.role === 'admin') refreshPendingCount();
}

/* =========================================================
   未配置 / 错误 / 拦截页面
   ========================================================= */
function renderNotConfigured() {
  APP.innerHTML = `
  <div class="auth"><div class="auth-card">
    <div class="auth-head"><div class="seal seal-lg">学</div><div><h1>${esc(CFG.APP_NAME || '学科资料库')}</h1><p>还差最后一步配置</p></div></div>
    <div class="notice warn">网站已部署成功，但还没有连接数据库。</div>
    <ol class="steps">
      <li>在 Supabase 新建项目，运行仓库里的 <b>supabase/setup.sql</b></li>
      <li>把项目的 URL 和 anon key 填进仓库根目录的 <b>config.js</b></li>
      <li>提交后等 1 分钟刷新本页</li>
    </ol>
    <p class="small muted" style="margin-top:14px">详细步骤见仓库里的 README.md</p>
  </div></div>`;
}
function renderFatal(msg, retry) {
  APP.innerHTML = `<div class="auth"><div class="auth-card">
    <div class="auth-head"><div class="seal seal-lg">学</div><div><h1>出了点问题</h1></div></div>
    <div class="notice bad">${esc(msg)}</div>
    ${retry ? '<button class="btn btn-primary btn-block" id="retry">重试</button><button class="btn btn-ghost btn-block" id="out" style="margin-top:8px">退出登录</button>' : ''}
  </div></div>`;
  if (retry) { $('#retry').onclick = () => enter(); $('#out').onclick = () => S.sb.auth.signOut(); }
}
function renderBlocked(kind) {
  const txt = {
    pending: ['这台设备等待部长批准', '为了防止账号外借，每个账号能自动绑定的设备数量有限。你的账号已达到上限，这台新设备需要部长在后台批准后才能使用。<br><br>批准后点下面的按钮刷新即可。'],
    revoked: ['这台设备已被移除', '部长已从你的账号中移除了这台设备。如有疑问请联系部长。'],
    banned: ['账号已停用', '你的账号已被部长停用，暂时无法访问资料库。如有疑问请联系部长。'],
  }[kind];
  APP.innerHTML = `<div class="auth"><div class="auth-card">
    <div class="auth-head"><div class="seal seal-lg">学</div><div><h1>${txt[0]}</h1></div></div>
    <div class="notice ${kind === 'pending' ? 'warn' : 'bad'}">${txt[1]}</div>
    <p class="small muted">本设备：${esc(deviceLabel())}</p>
    ${kind !== 'banned' ? '<button class="btn btn-primary btn-block" id="retry">我已获批，刷新</button>' : ''}
    <button class="btn btn-ghost btn-block" id="out" style="margin-top:8px">退出登录</button>
  </div></div>`;
  const r = $('#retry'); if (r) r.onclick = () => enter();
  $('#out').onclick = () => S.sb.auth.signOut();
}

/* =========================================================
   登录 / 注册
   ========================================================= */
function renderAuth(mode) {
  mode = mode || 'login';
  const redeemOnly = mode === 'redeem';
  APP.innerHTML = `
  <div class="auth"><div class="auth-card">
    <div class="auth-head"><div class="seal seal-lg">学</div><div><h1>${esc(CFG.APP_NAME || '学科资料库')}</h1><p>${esc(CFG.ORG_NAME || '')} · 内部资料</p></div></div>
    ${redeemOnly ? '<div class="notice warn">账号已创建，但还没有完成邀请码验证。请填写邀请码完成注册。</div>' : `
    <div class="tabs"><button data-m="login" class="${mode === 'login' ? 'on' : ''}">登录</button><button data-m="register" class="${mode === 'register' ? 'on' : ''}">邀请码注册</button></div>`}
    <form id="authForm" autocomplete="on"></form>
    <div class="auth-foot">资料仅限部门成员使用 · 所有访问均有记录</div>
  </div></div>`;
  $$('.tabs button').forEach(b => b.onclick = () => renderAuth(b.dataset.m));
  const f = $('#authForm');

  if (mode === 'login') {
    f.innerHTML = `
      <label class="field"><span>学号</span><input class="input" name="sid" inputmode="numeric" autocomplete="username" required></label>
      <label class="field"><span>密码</span><input class="input" name="pw" type="password" autocomplete="current-password" required></label>
      <div class="err" id="err"></div>
      <button class="btn btn-primary btn-block" type="submit">登录</button>
      <button class="btn btn-ghost btn-block" type="button" id="forgot" style="margin-top:6px">忘记密码</button>`;
    f.onsubmit = async (e) => {
      e.preventDefault(); const btn = f.querySelector('[type=submit]'); btn.disabled = true; $('#err').textContent = '';
      const sid = f.sid.value.trim();
      const { data, error } = await S.sb.auth.signInWithPassword({ email: `${sid}@${CFG.EMAIL_DOMAIN}`.toLowerCase(), password: f.pw.value });
      btn.disabled = false;
      if (error) return ($('#err').textContent = errMsg(error));
      S.session = data.session; enter();
    };
    $('#forgot').onclick = async () => {
      const sid = f.sid.value.trim();
      if (!sid) return ($('#err').textContent = '请先填写学号');
      const email = `${sid}@${CFG.EMAIL_DOMAIN}`.toLowerCase();
      const { error } = await S.sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
      if (error) return ($('#err').textContent = errMsg(error));
      $('#err').innerHTML = `<span style="color:var(--ok)">重置链接已发到 ${esc(email)}，请到复旦邮箱查收（可能在垃圾箱）</span>`;
    };
  } else {
    f.innerHTML = `
      <label class="field"><span>邀请码</span><input class="input mono" name="code" autocapitalize="characters" autocomplete="off" required placeholder="部长发给你的 10 位码"></label>
      <label class="field"><span>姓名</span><input class="input" name="name" autocomplete="name" required></label>
      <label class="field"><span>学号</span><input class="input" name="sid" inputmode="numeric" autocomplete="username" required ${redeemOnly && S.session ? `value="${esc((S.session.user.email || '').split('@')[0])}" readonly` : ''}></label>
      ${redeemOnly ? '' : `
      <label class="field"><span>设置密码</span><input class="input" name="pw" type="password" autocomplete="new-password" minlength="8" required><small>至少 8 位。登录账号就是学号</small></label>
      <label class="field"><span>确认密码</span><input class="input" name="pw2" type="password" autocomplete="new-password" minlength="8" required></label>`}
      <div class="err" id="err"></div>
      <button class="btn btn-seal btn-block" type="submit">${redeemOnly ? '完成验证' : '注册并进入'}</button>
      ${redeemOnly ? '<button class="btn btn-ghost btn-block" type="button" id="out" style="margin-top:6px">退出登录</button>' : ''}`;
    if (redeemOnly) $('#out').onclick = () => S.sb.auth.signOut();
    f.onsubmit = async (e) => {
      e.preventDefault();
      const err = (m) => { $('#err').textContent = m; btn.disabled = false; };
      const btn = f.querySelector('[type=submit]'); btn.disabled = true; $('#err').textContent = '';
      const code = f.code.value.trim().toUpperCase(), name = f.name.value.trim(), sid = f.sid.value.trim();
      if (!/^\w{4,20}$/.test(sid)) return err('学号格式不正确');
      if (!redeemOnly && f.pw.value !== f.pw2.value) return err('两次输入的密码不一致');
      try {
        const { data: chk, error: ce } = await S.sb.rpc('check_invite', { p_code: code });
        if (ce) throw ce;
        if (!chk || !chk.ok) return err('邀请码无效、已过期或已被使用');
        if (chk.for_student_id && chk.for_student_id !== sid) return err('这个邀请码不是发给该学号的');
        if (!redeemOnly) {
          const email = `${sid}@${CFG.EMAIL_DOMAIN}`.toLowerCase();
          let { data, error } = await S.sb.auth.signUp({ email, password: f.pw.value, options: { data: { name } } });
          if (error && /already/i.test(error.message)) {
            ({ data, error } = await S.sb.auth.signInWithPassword({ email, password: f.pw.value }));
            if (error) return err('这个学号已经注册过，但密码不对。请切换到「登录」');
          } else if (error) throw error;
          if (!data.session) return err('注册需要邮箱确认——请部长在 Supabase 后台关闭「Confirm email」后再试');
          S.session = data.session;
        }
        const { error: re } = await S.sb.rpc('redeem_invite', { p_code: code, p_name: name, p_student_id: sid });
        if (re) throw re;
        toast('注册成功，欢迎加入！');
        enter();
      } catch (ex) { err(errMsg(ex)); }
    };
  }
}

function renderResetPassword() {
  APP.innerHTML = `<div class="auth"><div class="auth-card">
    <div class="auth-head"><div class="seal seal-lg">学</div><div><h1>设置新密码</h1></div></div>
    <form id="rf">
      <label class="field"><span>新密码</span><input class="input" name="pw" type="password" minlength="8" autocomplete="new-password" required></label>
      <div class="err" id="err"></div>
      <button class="btn btn-primary btn-block">保存并进入</button>
    </form></div></div>`;
  $('#rf').onsubmit = async (e) => {
    e.preventDefault();
    const { error } = await S.sb.auth.updateUser({ password: e.target.pw.value });
    if (error) return ($('#err').textContent = errMsg(error));
    history.replaceState(null, '', location.pathname);
    toast('密码已更新'); enter();
  };
}

/* =========================================================
   主框架 & 路由
   ========================================================= */
function renderShell() {
  const isAdmin = S.role === 'admin';
  APP.innerHTML = `
  <div class="shell">
    <header class="topbar"><div class="topbar-in">
      <div class="brand">
        <div class="seal">学</div>
        <div><h1>${esc(CFG.APP_NAME || '学科资料库')}</h1><p>${esc(CFG.ORG_NAME || '')}</p></div>
        <div class="spacer"></div>
        <nav class="desk-nav">
          <a href="#/s/course" data-nav="s">资料</a>
          <a href="#/upload" data-nav="upload">上传</a>
          <a href="#/me" data-nav="me">我的</a>
          ${isAdmin ? '<a href="#/admin" data-nav="admin">管理<span class="badge hidden" data-pc></span></a>' : ''}
        </nav>
      </div>
      <nav class="sections" id="secTabs">
        ${Object.entries(SECTIONS).map(([k, v]) => `<a href="#/s/${k}" data-sec="${k}">${v.name}</a>`).join('')}
      </nav>
    </div></header>
    <main class="main" id="main"></main>
    <nav class="bottom-nav">
      <a href="#/s/course" data-nav="s">${I.books}<span>资料</span></a>
      <a href="#/upload" data-nav="upload" class="up"><span class="ic">${I.plus}</span><span class="lb">上传</span></a>
      <a href="#/me" data-nav="me">${I.user}<span>我的</span></a>
      ${isAdmin ? `<a href="#/admin" data-nav="admin">${I.shield}<span>管理</span><span class="badge hidden" data-pc></span></a>` : ''}
    </nav>
  </div>`;
}

function route() {
  const h = location.hash.replace(/^#\/?/, '');
  const [page, arg] = h.split('/');
  let nav = 's';
  closeOverlays();
  if (page === 'upload') { nav = 'upload'; renderUpload(arg); }
  else if (page === 'me') { nav = 'me'; renderMe(); }
  else if (page === 'admin' && S.role === 'admin') { nav = 'admin'; renderAdmin(arg); }
  else {
    const sec = SECTIONS[arg] ? arg : (store('fdse_last_sec') || 'course');
    if (!SECTIONS[sec]) return (location.hash = '#/s/course');
    store('fdse_last_sec', sec);
    renderSection(sec);
  }
  $('#secTabs').classList.toggle('hidden', nav !== 's');
  $$('[data-nav]').forEach(a => {
    a.classList.toggle('on', a.dataset.nav === nav);
    if (a.dataset.nav === 's') a.href = '#/s/' + (store('fdse_last_sec') || 'course');
  });
  window.scrollTo(0, 0);
}
function closeOverlays() { $$('.overlay, .viewer').forEach(o => o.remove()); document.body.style.overflow = ''; }

/* =========================================================
   资料列表
   ========================================================= */
async function loadSection(sec, force) {
  if (S.cache[sec] && !force) return S.cache[sec];
  const { data, error } = await S.sb.from('resources')
    .select('*, members(name)').eq('section', sec).order('created_at', { ascending: false }).limit(2000);
  if (error) throw error;
  S.cache[sec] = data || [];
  return S.cache[sec];
}

async function renderSection(sec) {
  const def = SECTIONS[sec];
  $$('#secTabs a').forEach(a => a.classList.toggle('on', a.dataset.sec === sec));
  const main = $('#main');
  if (S.filters._sec !== sec) S.filters = { cat: '全部', tag: '', term: '', sort: 'new', q: '', _sec: sec };
  main.innerHTML = `
    <div class="searchbar">${I.search}<input class="input" id="q" type="search" placeholder="搜索${def.name}：标题、${def.tagLabel}、老师…" value="${esc(S.filters.q)}"></div>
    <div class="chips" id="cats">${['全部', ...def.cats].map(c => `<button class="chip ${S.filters.cat === c ? 'on' : ''}" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div>
    <div class="filters2">
      <select class="input" id="ftag"><option value="">全部${esc(def.tagLabel)}</option></select>
      ${sec === 'course' ? '<select class="input" id="fterm"><option value="">全部学期</option></select>' : ''}
      <select class="input" id="fsort" style="flex:0 0 96px"><option value="new">最新</option><option value="hot">最热</option><option value="name">名称</option></select>
    </div>
    ${def.downloadable ? '' : `<div class="section-note">${I.lock}<span>课程资料仅支持在线预览，不提供下载</span></div>`}
    <div id="list"><div class="spinner"></div></div>`;

  let rows;
  try { rows = await loadSection(sec); } catch (e) { $('#list').innerHTML = `<div class="notice bad">加载失败：${esc(errMsg(e))}</div>`; return; }
  if (location.hash.indexOf('/s/' + sec) === -1 && location.hash.replace(/^#\/?/, '') !== '') return;

  const tags = [...new Set(rows.map(r => r.tag).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh'));
  $('#ftag').innerHTML += tags.map(t => `<option ${S.filters.tag === t ? 'selected' : ''}>${esc(t)}</option>`).join('');
  if ($('#fterm')) {
    const terms = [...new Set(rows.map(r => r.term).filter(Boolean))].sort().reverse();
    $('#fterm').innerHTML += terms.map(t => `<option ${S.filters.term === t ? 'selected' : ''}>${esc(t)}</option>`).join('');
  }
  $('#fsort').value = S.filters.sort;

  const draw = () => drawList(sec, rows);
  $('#q').oninput = (e) => { S.filters.q = e.target.value; draw(); };
  $$('#cats .chip').forEach(b => b.onclick = () => { S.filters.cat = b.dataset.c; $$('#cats .chip').forEach(x => x.classList.toggle('on', x === b)); draw(); });
  $('#ftag').onchange = (e) => { S.filters.tag = e.target.value; draw(); };
  if ($('#fterm')) $('#fterm').onchange = (e) => { S.filters.term = e.target.value; draw(); };
  $('#fsort').onchange = (e) => { S.filters.sort = e.target.value; draw(); };
  draw();
}

function drawList(sec, rows) {
  const f = S.filters, q = f.q.trim().toLowerCase();
  let out = rows.filter(r =>
    (f.cat === '全部' || r.category === f.cat) &&
    (!f.tag || r.tag === f.tag) && (!f.term || r.term === f.term) &&
    (!q || [r.title, r.tag, r.teacher, r.description, r.file_name, r.term, r.category, r.members && r.members.name].join(' ').toLowerCase().includes(q)));
  if (f.sort === 'hot') out = out.slice().sort((a, b) => (b.views + b.downloads) - (a.views + a.downloads));
  if (f.sort === 'name') out = out.slice().sort((a, b) => a.title.localeCompare(b.title, 'zh'));
  const list = $('#list');
  if (!out.length) {
    list.innerHTML = `<div class="empty"><div class="seal seal-lg">学</div><p>${rows.length ? '没有符合条件的资料' : '这个板块还没有资料'}</p>
      <a class="btn btn-seal" href="#/upload/${sec}">${I.plus.replace('<svg', '<svg width="16" height="16"')} 上传第一份</a></div>`;
    return;
  }
  list.innerHTML = `<p class="count-line">共 ${out.length} 份</p><div class="list">${out.map(cardHTML).join('')}</div>`;
  $$('.res', list).forEach(el => el.onclick = () => openDetail(rows.find(r => r.id === el.dataset.id)));
}

function cardHTML(r) {
  const [cls, lbl] = ftype(r);
  return `<button class="res" data-id="${r.id}">
    <div class="ftype ft-${cls}">${esc(lbl)}</div>
    <div class="res-body">
      <div class="res-title">${esc(r.title)}</div>
      <div class="res-meta">
        <span class="tag">${esc(r.category)}</span>
        ${r.tag ? `<span>${esc(r.tag)}</span>` : ''}${r.term ? `<span>${esc(r.term)}</span>` : ''}
      </div>
      <div class="res-meta" style="margin-top:3px">
        <span>${esc((r.members && r.members.name) || '已退出成员')}</span><span>${ago(r.created_at)}</span>
        ${r.file_size ? `<span>${fmtSize(r.file_size)}</span>` : ''}<span>👁 ${r.views}</span>
      </div>
    </div></button>`;
}

/* =========================================================
   资料详情
   ========================================================= */
function openSheet(html) {
  closeOverlays();
  const o = document.createElement('div');
  o.className = 'overlay';
  o.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
  o.addEventListener('click', (e) => { if (e.target === o) closeSheet(o); });
  document.body.appendChild(o); document.body.style.overflow = 'hidden';
  return o;
}
function closeSheet(o) { (o || $('.overlay'))?.remove(); document.body.style.overflow = ''; }

function openDetail(r) {
  if (!r) return;
  const def = SECTIONS[r.section];
  const canDel = r.uploader === S.me.id || S.role === 'admin';
  const [cls, lbl] = ftype(r);
  let acts = '';
  if (r.kind === 'link') acts = `<button class="btn btn-primary" data-a="link">打开网盘链接</button>`;
  else if (!def.downloadable) acts = isPreviewable(r) ? `<button class="btn btn-primary" data-a="view">${I.lock.replace('<svg', '<svg width="16" height="16"')} 在线预览</button>` : `<div class="notice warn" style="flex:1">该文件格式不支持在线预览，请上传者转为 PDF 后重新上传</div>`;
  else acts = `${isPreviewable(r) ? '<button class="btn" data-a="view">预览</button>' : ''}<button class="btn btn-primary" data-a="dl">下载</button>`;
  const o = openSheet(`
    <div class="sheet-head"><div class="ftype ft-${cls}">${esc(lbl)}</div><h2>${esc(r.title)}</h2><button class="icon-btn" data-a="close" aria-label="关闭">${I.x}</button></div>
    <div class="row row-wrap"><span class="tag hl">${esc(def.name)}</span><span class="tag">${esc(r.category)}</span>${def.downloadable ? '' : '<span class="tag warn">仅预览</span>'}</div>
    <dl class="kv">
      ${r.tag ? `<dt>${esc(def.tagLabel)}</dt><dd>${esc(r.tag)}</dd>` : ''}
      ${r.term ? `<dt>学期 / 年份</dt><dd>${esc(r.term)}</dd>` : ''}
      ${r.teacher ? `<dt>任课老师</dt><dd>${esc(r.teacher)}</dd>` : ''}
      ${r.kind === 'file' ? `<dt>文件</dt><dd>${esc(r.file_name)}${r.file_size ? ' · ' + fmtSize(r.file_size) : ''}</dd>` : `<dt>链接</dt><dd>${esc(r.link_url)}</dd>`}
      <dt>上传者</dt><dd>${esc((r.members && r.members.name) || '已退出成员')} · ${fmtTime(r.created_at)}</dd>
      <dt>热度</dt><dd>查看 ${r.views} · ${r.kind === 'link' ? '打开' : '下载'} ${r.downloads}</dd>
    </dl>
    ${r.description ? `<div class="desc">${esc(r.description)}</div>` : ''}
    <div class="actions">${acts}</div>
    ${canDel ? '<div class="actions" style="margin-top:10px"><button class="btn btn-danger btn-sm" data-a="del" style="flex:0">删除这份资料</button></div>' : ''}
  `);
  o.querySelector('[data-a=close]').onclick = () => closeSheet(o);
  const a = (k, fn) => { const b = o.querySelector(`[data-a=${k}]`); if (b) b.onclick = fn; };
  a('view', () => openViewer(r));
  a('dl', () => downloadFile(r));
  a('link', () => {
    S.sb.rpc('log_access', { p_resource: r.id, p_action: 'open_link' });
    let url = r.link_url; if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    window.open(url, '_blank', 'noopener');
  });
  a('del', async () => {
    if (!(await confirmBox(`确定删除「${r.title}」？删除后无法恢复。`, '删除', true))) return;
    try {
      if (r.storage_path) { const { error } = await S.sb.storage.from(BUCKET).remove([r.storage_path]); if (error) throw error; }
      const { error } = await S.sb.from('resources').delete().eq('id', r.id); if (error) throw error;
      Object.keys(S.cache).forEach(k => S.cache[k] = S.cache[k].filter(x => x.id !== r.id));
      closeSheet(o); toast('已删除'); route();
    } catch (e) { toast('删除失败：' + errMsg(e)); }
  });
}

function confirmBox(msg, okText = '确定', danger = false, extraHTML = '') {
  return new Promise((resolve) => {
    const o = document.createElement('div'); o.className = 'overlay';
    o.innerHTML = `<div class="sheet" style="max-width:420px"><p style="margin:4px 0 12px;font-size:15px">${esc(msg)}</p>${extraHTML}
      <div class="actions"><button class="btn" data-x="0">取消</button><button class="btn ${danger ? 'btn-seal' : 'btn-primary'}" data-x="1">${esc(okText)}</button></div></div>`;
    document.body.appendChild(o);
    o.onclick = (e) => {
      const x = e.target.closest('[data-x]');
      if (e.target === o || x) { const v = x && x.dataset.x === '1' ? (extraHTML ? o.querySelector('input').value : true) : false; o.remove(); resolve(v); }
    };
  });
}

async function downloadFile(r) {
  toast('正在准备下载…');
  const { data, error } = await S.sb.storage.from(BUCKET).createSignedUrl(r.storage_path, 120, { download: r.file_name || true });
  if (error) return toast('下载失败：' + errMsg(error));
  S.sb.rpc('log_access', { p_resource: r.id, p_action: 'download' });
  r.downloads++;
  const a = document.createElement('a'); a.href = data.signedUrl; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
}

/* =========================================================
   在线预览（带水印、禁下载）
   ========================================================= */
function wmText() { return [`${S.me.name} ${S.me.student_id}`, `${fmtTime(new Date())} · 学科中心内部资料 严禁外传`]; }
function drawWatermark(ctx, w, h, scale) {
  const [l1, l2] = wmText();
  ctx.save();
  const fs = Math.max(11, Math.round(14 * scale));
  ctx.font = `600 ${fs}px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`;
  ctx.fillStyle = 'rgba(184,57,42,0.16)';
  ctx.textAlign = 'center';
  const stepX = 300 * scale, stepY = 170 * scale;
  ctx.translate(w / 2, h / 2); ctx.rotate(-Math.PI / 7);
  const R = Math.hypot(w, h);
  for (let y = -R; y < R; y += stepY) {
    for (let x = -R; x < R; x += stepX) {
      const off = (Math.round(y / stepY) % 2) * stepX / 2;
      ctx.fillText(l1, x + off, y);
      ctx.fillText(l2, x + off, y + fs * 1.4);
    }
  }
  ctx.restore();
}

let viewerKeyHandler = null;
async function openViewer(r) {
  const v = document.createElement('div');
  v.className = 'viewer';
  v.innerHTML = `
    <div class="viewer-bar">
      <button class="icon-btn" data-v="close" aria-label="关闭">${I.x}</button>
      <div class="t">${esc(r.title)}</div>
      <div class="zoom"><button class="icon-btn" data-v="out" aria-label="缩小">${I.minus}</button><button class="icon-btn" data-v="in" aria-label="放大">${I.plus}</button></div>
    </div>
    <div class="viewer-pages"><div class="viewer-msg">正在加载…</div></div>`;
  document.body.appendChild(v); document.body.style.overflow = 'hidden';
  const pages = v.querySelector('.viewer-pages');
  const block = (e) => { e.preventDefault(); return false; };
  ['contextmenu', 'dragstart', 'selectstart', 'copy'].forEach(ev => v.addEventListener(ev, block));
  viewerKeyHandler = (e) => {
    if ((e.ctrlKey || e.metaKey) && ['s', 'p', 'c'].includes(e.key.toLowerCase())) { e.preventDefault(); toast('该资料仅限在线查看'); }
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', viewerKeyHandler);
  let pdfDoc = null, zoom = 1, observer = null, destroyed = false;
  const close = () => {
    destroyed = true; observer && observer.disconnect(); pdfDoc && pdfDoc.destroy();
    document.removeEventListener('keydown', viewerKeyHandler); v.remove(); document.body.style.overflow = '';
  };
  v.querySelector('[data-v=close]').onclick = close;

  const { data: blob, error } = await S.sb.storage.from(BUCKET).download(r.storage_path);
  if (destroyed) return;
  if (error || !blob) { pages.innerHTML = `<div class="viewer-msg">加载失败：${esc(errMsg(error))}</div>`; return; }
  S.sb.rpc('log_access', { p_resource: r.id, p_action: 'view' }); r.views++;

  const ext = extOf(r.file_name);
  if (ext !== 'pdf') {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const draw = () => {
        const maxW = Math.min(pages.clientWidth - 20, img.naturalWidth) * zoom;
        const scale = maxW / img.naturalWidth, dpr = window.devicePixelRatio || 1;
        const c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * scale * dpr); c.height = Math.round(img.naturalHeight * scale * dpr);
        c.style.width = Math.round(img.naturalWidth * scale) + 'px';
        const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, c.width, c.height);
        drawWatermark(ctx, c.width, c.height, dpr);
        pages.innerHTML = ''; pages.appendChild(c);
      };
      draw(); URL.revokeObjectURL(url);
      v.querySelector('[data-v=in]').onclick = () => { zoom = Math.min(3, zoom + .25); draw(); };
      v.querySelector('[data-v=out]').onclick = () => { zoom = Math.max(.5, zoom - .25); draw(); };
    };
    img.onerror = () => { pages.innerHTML = '<div class="viewer-msg">图片无法显示</div>'; };
    img.src = url;
    return;
  }

  if (!window.pdfjsLib) { pages.innerHTML = '<div class="viewer-msg">PDF 组件加载失败，请刷新重试</div>'; return; }
  try {
    const buf = await blob.arrayBuffer();
    pdfDoc = await pdfjsLib.getDocument({
      data: buf, cMapUrl: 'vendor/pdfjs/cmaps/', cMapPacked: true,
      standardFontDataUrl: 'vendor/pdfjs/standard_fonts/', isEvalSupported: false,
    }).promise;
  } catch (e) { pages.innerHTML = `<div class="viewer-msg">PDF 打开失败：${esc(errMsg(e))}</div>`; return; }
  if (destroyed) return;
  const first = await pdfDoc.getPage(1);
  const baseVp = first.getViewport({ scale: 1 });

  const layout = () => {
    observer && observer.disconnect();
    pages.innerHTML = '';
    const cssW = Math.min(pages.clientWidth - 20, 1000) * zoom;
    const cssH = cssW * baseVp.height / baseVp.width;
    observer = new IntersectionObserver((ents) => ents.forEach(en => {
      if (en.isIntersecting && !en.target.dataset.done) { en.target.dataset.done = '1'; renderPage(en.target, +en.target.dataset.p, cssW); }
    }), { root: pages, rootMargin: '600px 0px' });
    for (let p = 1; p <= pdfDoc.numPages; p++) {
      const ph = document.createElement('div');
      ph.className = 'ph'; ph.dataset.p = p; ph.style.width = cssW + 'px'; ph.style.height = cssH + 'px';
      ph.textContent = `第 ${p} / ${pdfDoc.numPages} 页`;
      pages.appendChild(ph); observer.observe(ph);
    }
  };
  async function renderPage(ph, p, cssW) {
    try {
      const page = await pdfDoc.getPage(p);
      if (destroyed) return;
      const vp1 = page.getViewport({ scale: 1 });
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const scale = cssW / vp1.width;
      const vp = page.getViewport({ scale: scale * dpr });
      const c = document.createElement('canvas');
      c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
      c.style.width = Math.floor(cssW) + 'px';
      const ctx = c.getContext('2d');
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      drawWatermark(ctx, c.width, c.height, dpr * Math.max(.7, scale));
      if (ph.isConnected) ph.replaceWith(c);
    } catch (e) { ph.textContent = `第 ${p} 页渲染失败`; }
  }
  layout();
  v.querySelector('[data-v=in]').onclick = () => { zoom = Math.min(3, zoom + .25); layout(); };
  v.querySelector('[data-v=out]').onclick = () => { zoom = Math.max(.5, zoom - .25); layout(); };
}

/* =========================================================
   上传
   ========================================================= */
function renderUpload(presetSec) {
  const sec0 = SECTIONS[presetSec] ? presetSec : (store('fdse_last_sec') || 'course');
  const main = $('#main');
  main.innerHTML = `
  <div class="panel" style="max-width:640px;margin:0 auto">
    <h3>上传资料</h3>
    <form id="uf">
      <label class="field"><span>板块</span>
        <select class="input" name="section">${Object.entries(SECTIONS).map(([k, v]) => `<option value="${k}" ${k === sec0 ? 'selected' : ''}>${v.name}</option>`).join('')}</select></label>
      <label class="field"><span>分类</span><select class="input" name="category"></select></label>
      <div id="modeWrap"></div>
      <div id="srcWrap"></div>
      <label class="field"><span>标题</span><input class="input" name="title" maxlength="120" placeholder=""><small id="titleHint"></small></label>
      <label class="field"><span id="tagLbl"></span><input class="input" name="tag" list="tagList" maxlength="60"><datalist id="tagList"></datalist></label>
      <div class="row">
        <label class="field grow"><span>学期 / 年份</span><input class="input" name="term" list="termList" maxlength="30" placeholder="如 2025秋"><datalist id="termList"></datalist></label>
        <label class="field grow" id="teacherF"><span>任课老师</span><input class="input" name="teacher" maxlength="40"></label>
      </div>
      <label class="field"><span>说明（选填）</span><textarea class="input" name="description" maxlength="2000" placeholder="资料内容、适用范围、注意事项…"></textarea></label>
      <div class="progress hidden" id="prog"><i></i></div><div class="small muted" id="progTxt"></div>
      <div class="err" id="err"></div>
      <button class="btn btn-seal btn-block" type="submit" style="padding:12px">上传</button>
    </form>
  </div>`;
  const f = $('#uf');
  let mode = 'file', files = [];
  const now = new Date(), y = now.getFullYear();
  $('#termList').innerHTML = [`${y}秋`, `${y}春`, `${y - 1}秋`, `${y - 1}春`, `${y - 2}秋`, `${y - 2}春`].map(t => `<option value="${t}">`).join('');

  const sync = async () => {
    const sec = f.section.value, def = SECTIONS[sec];
    f.category.innerHTML = def.cats.map(c => `<option>${esc(c)}</option>`).join('');
    $('#tagLbl').textContent = def.tagLabel + (sec === 'course' ? '' : '（选填）');
    f.tag.placeholder = def.tagHint; f.tag.required = sec === 'course';
    $('#teacherF').classList.toggle('hidden', !def.hasTeacher);
    if (!def.allowLink) mode = 'file';
    $('#modeWrap').innerHTML = def.allowLink
      ? `<div class="seg"><button type="button" data-m="file" class="${mode === 'file' ? 'on' : ''}">上传文件</button><button type="button" data-m="link" class="${mode === 'link' ? 'on' : ''}">网盘链接（大文件）</button></div>` : '';
    $$('#modeWrap [data-m]').forEach(b => b.onclick = () => { mode = b.dataset.m; sync(); });
    drawSrc();
    try { const rows = await loadSection(sec); $('#tagList').innerHTML = [...new Set(rows.map(r => r.tag).filter(Boolean))].map(t => `<option value="${esc(t)}">`).join(''); } catch (e) {}
  };
  const drawSrc = () => {
    const sec = f.section.value, def = SECTIONS[sec];
    if (mode === 'link') {
      $('#srcWrap').innerHTML = `<label class="field"><span>链接</span><input class="input" name="link" type="url" placeholder="https://pan.baidu.com/s/…（可附提取码）" required>
        <small>录屏、整套题库等大文件放网盘，这里只贴链接和提取码</small></label>`;
      $('#titleHint').textContent = ''; f.title.required = true; f.title.placeholder = '如：CFA L1 全套讲义 + 题库';
      return;
    }
    $('#srcWrap').innerHTML = `
      <div class="field"><span>文件</span>
        <label class="drop" id="drop"><input type="file" id="fi" multiple hidden ${sec === 'course' ? `accept="${COURSE_ACCEPT}"` : ''}>
          <strong>点击选择文件</strong>${sec === 'course' ? '课程资料仅支持 PDF / 图片（PPT、Word 请先「另存为 PDF」）' : '支持任意格式'} · 单个 ≤ ${CFG.MAX_UPLOAD_MB || 50}MB · 可多选
        </label>
        <div class="filelist" id="fl"></div>
      </div>`;
    f.title.required = false;
    const fi = $('#fi'), drop = $('#drop');
    const take = (list) => {
      files = Array.from(list); const bad = [];
      files = files.filter(x => {
        if (x.size > MAX_BYTES) { bad.push(`${x.name} 超过 ${CFG.MAX_UPLOAD_MB || 50}MB`); return false; }
        if (sec === 'course' && !['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif'].includes(extOf(x.name))) { bad.push(`${x.name} 不是 PDF/图片`); return false; }
        return true;
      });
      $('#fl').innerHTML = files.map(x => `<div><span>${esc(x.name)}</span><span class="muted">${fmtSize(x.size)}</span></div>`).join('');
      $('#err').textContent = bad.length ? bad.join('；') + (bad.some(b => b.includes('MB')) ? '。大文件请改用网盘链接' : '') : '';
      $('#titleHint').textContent = files.length > 1 ? `已选 ${files.length} 个文件：标题留空则自动用各自文件名` : '留空则使用文件名';
    };
    fi.onchange = () => take(fi.files);
    drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
    drop.ondragleave = () => drop.classList.remove('over');
    drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); take(e.dataTransfer.files); };
    $('#titleHint').textContent = '留空则使用文件名'; f.title.placeholder = '';
  };
  f.section.onchange = () => { files = []; sync(); };
  sync();

  f.onsubmit = async (e) => {
    e.preventDefault();
    const btn = f.querySelector('[type=submit]'), errEl = $('#err');
    const sec = f.section.value, def = SECTIONS[sec];
    const base = {
      section: sec, category: f.category.value, tag: f.tag.value.trim() || null,
      term: f.term.value.trim() || null, teacher: def.hasTeacher ? (f.teacher.value.trim() || null) : null,
      description: f.description.value.trim() || null, uploader: S.me.id,
    };
    errEl.textContent = '';
    if (mode === 'link') {
      const link = f.link.value.trim(); if (!link) return (errEl.textContent = '请填写链接');
      btn.disabled = true;
      const { error } = await S.sb.from('resources').insert({ ...base, kind: 'link', link_url: link, title: f.title.value.trim() });
      btn.disabled = false;
      if (error) return (errEl.textContent = errMsg(error));
      delete S.cache[sec]; toast('已发布'); location.hash = '#/s/' + sec; return;
    }
    if (!files.length) return (errEl.textContent = '请选择文件');
    btn.disabled = true;
    const prog = $('#prog'), bar = prog.querySelector('i'), ptxt = $('#progTxt');
    prog.classList.remove('hidden');
    const total = files.reduce((s, x) => s + x.size, 0); let doneBytes = 0, ok = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = extOf(file.name);
      const path = `${sec}/${S.me.id}/${uuid()}${ext ? '.' + ext : ''}`;
      ptxt.textContent = `正在上传 ${i + 1}/${files.length}：${file.name}`;
      try {
        await xhrUpload(path, file, (loaded) => { bar.style.width = Math.round((doneBytes + loaded) / total * 100) + '%'; });
        const title = (files.length === 1 && f.title.value.trim()) || (files.length > 1 && f.title.value.trim() ? `${f.title.value.trim()}（${file.name.replace(/\.[^.]+$/, '')}）` : file.name.replace(/\.[^.]+$/, ''));
        const { error } = await S.sb.from('resources').insert({
          ...base, kind: 'file', title, storage_path: path, file_name: file.name, file_size: file.size, mime: file.type || null,
        });
        if (error) { await S.sb.storage.from(BUCKET).remove([path]); throw error; }
        ok++;
      } catch (ex) { errEl.textContent = `${file.name} 上传失败：${errMsg(ex)}`; }
      doneBytes += file.size;
    }
    btn.disabled = false;
    if (ok) { delete S.cache[sec]; toast(`成功上传 ${ok} 份资料，谢谢分享！`); if (ok === files.length) location.hash = '#/s/' + sec; }
  };
}

async function xhrUpload(path, file, onProgress) {
  const { data } = await S.sb.auth.getSession();
  const token = data.session && data.session.access_token;
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('POST', `${CFG.SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/${BUCKET}/${path}`);
    x.setRequestHeader('Authorization', 'Bearer ' + token);
    x.setRequestHeader('apikey', CFG.SUPABASE_ANON_KEY);
    x.setRequestHeader('x-upsert', 'false');
    x.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    x.setRequestHeader('cache-control', 'max-age=3600');
    x.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded);
    x.onload = () => {
      if (x.status >= 200 && x.status < 300) return resolve();
      let m = x.responseText; try { const j = JSON.parse(m); m = j.message || j.error || m; } catch (e) {}
      if (x.status === 413) m = 'Payload too large';
      reject(new Error(m || ('HTTP ' + x.status)));
    };
    x.onerror = () => reject(new Error('Failed to fetch'));
    x.send(file);
  });
}

/* =========================================================
   我的
   ========================================================= */
async function renderMe() {
  const main = $('#main');
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  const standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone;
  main.innerHTML = `
    <div class="panel"><div class="profile">
      <div class="avatar">${esc((S.me.name || '?').slice(-1))}</div>
      <div class="grow"><div style="font-family:var(--serif);font-weight:700;font-size:18px">${esc(S.me.name)}</div>
        <div class="small muted">学号 ${esc(S.me.student_id)} · ${S.role === 'admin' ? '<span class="tag hl">部长 / 管理员</span>' : '成员'}</div>
        <div class="small muted">加入于 ${fmtDate(S.me.created_at)}</div></div>
    </div></div>

    ${standalone ? '' : `
    <div class="panel"><h3>添加到手机主屏幕</h3>
      ${S.installEvt ? '<button class="btn btn-primary btn-block" id="inst">一键安装为 App</button>' : isIOS ? `
      <ol class="steps"><li>用 <b>Safari</b> 打开本网址（微信里请先点右上角「在浏览器打开」）</li><li>点底部的 <b>分享</b> 按钮（方框+向上箭头）</li><li>选择 <b>添加到主屏幕</b></li></ol>` : `
      <ol class="steps"><li>用 Chrome / Edge / 系统浏览器打开本网址</li><li>点右上角 <b>⋮</b> 菜单</li><li>选择 <b>添加到主屏幕</b> 或 <b>安装应用</b></li></ol>`}
      <p class="small muted" style="margin:8px 0 0">注意：桌面 App 第一次打开需要再登录一次，并会占用一个设备名额。</p>
    </div>`}

    <div class="panel"><h3>我的设备</h3><div id="myDev"><div class="spinner"></div></div>
      <p class="small muted" style="margin:6px 0 0">每个账号可自动绑定的设备数量有限，换手机等需要移除旧设备请联系部长。</p></div>

    <div class="panel"><h3>我上传的资料</h3><div id="myUp"><div class="spinner"></div></div></div>

    <div class="panel"><h3>账号</h3>
      <form id="pwf" class="row"><input class="input grow" name="pw" type="password" minlength="8" placeholder="新密码（至少 8 位）" autocomplete="new-password" required><button class="btn">修改密码</button></form>
      <button class="btn btn-danger btn-block" id="logout" style="margin-top:12px">退出登录</button>
    </div>`;
  if ($('#inst')) $('#inst').onclick = async () => { S.installEvt.prompt(); await S.installEvt.userChoice; S.installEvt = null; renderMe(); };
  $('#logout').onclick = async () => { if (await confirmBox('确定退出登录？下次需重新输入学号和密码。', '退出')) S.sb.auth.signOut(); };
  $('#pwf').onsubmit = async (e) => {
    e.preventDefault();
    const { error } = await S.sb.auth.updateUser({ password: e.target.pw.value });
    if (error) return toast(errMsg(error)); e.target.reset(); toast('密码已修改');
  };
  const [{ data: devs }, { data: ups }] = await Promise.all([
    S.sb.from('devices').select('*').eq('user_id', S.me.id).order('last_seen', { ascending: false }),
    S.sb.from('resources').select('*, members(name)').eq('uploader', S.me.id).order('created_at', { ascending: false }),
  ]);
  if (!$('#myDev')) return;
  const me = deviceId();
  $('#myDev').innerHTML = (devs || []).map(d => `<div class="trow"><div class="grow"><b>${esc(d.label || '未知设备')}${d.device_id === me ? '（本机）' : ''}</b><span>最近使用 ${ago(d.last_seen)}</span></div>${devTag(d.status)}</div>`).join('') || '<p class="muted small">暂无</p>';
  $('#myUp').innerHTML = (ups || []).length ? (ups.map(r => `<div class="trow" data-id="${r.id}" style="cursor:pointer"><div class="grow"><b>${esc(r.title)}</b><span>${SECTIONS[r.section].name} · ${esc(r.category)} · ${fmtDate(r.created_at)} · 查看 ${r.views}</span></div></div>`).join(''))
    : '<p class="muted small" style="margin:0">还没有上传过资料。分享一份，帮到下一届 ✨</p>';
  $$('#myUp .trow').forEach(el => el.onclick = () => openDetail(ups.find(r => r.id === el.dataset.id)));
}
const devTag = (s) => s === 'approved' ? '<span class="tag ok">已启用</span>' : s === 'pending' ? '<span class="tag warn">待批准</span>' : '<span class="tag">已移除</span>';

/* =========================================================
   管理后台（部长）
   ========================================================= */
async function refreshPendingCount() {
  const { count } = await S.sb.from('devices').select('id', { count: 'exact', head: true }).eq('status', 'pending');
  S.pendingCount = count || 0;
  $$('[data-pc]').forEach(b => { b.textContent = S.pendingCount; b.classList.toggle('hidden', !S.pendingCount); });
}

function renderAdmin(tab) {
  tab = tab || 'invites';
  const tabs = { invites: '邀请码', devices: '设备审批', members: '成员', logs: '访问记录', settings: '设置' };
  $('#main').innerHTML = `
    <div class="stat-grid" id="stats"></div>
    <div class="admin-tabs">${Object.entries(tabs).map(([k, v]) => `<a class="chip ${k === tab ? 'on' : ''}" href="#/admin/${k}" style="text-decoration:none">${v}${k === 'devices' && S.pendingCount ? `<span class="badge">${S.pendingCount}</span>` : ''}</a>`).join('')}</div>
    <div id="adm"><div class="spinner"></div></div>`;
  drawStats();
  ({ invites: admInvites, devices: admDevices, members: admMembers, logs: admLogs, settings: admSettings })[tab]?.();
}

async function drawStats() {
  const [m, r, used] = await Promise.all([
    S.sb.from('members').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    S.sb.from('resources').select('id', { count: 'exact', head: true }),
    S.sb.from('resources').select('file_size').eq('kind', 'file'),
  ]);
  const bytes = (used.data || []).reduce((s, x) => s + (x.file_size || 0), 0);
  const quota = (CFG.STORAGE_QUOTA_GB || 1) * 1073741824;
  const pct = Math.min(100, bytes / quota * 100);
  if (!$('#stats')) return;
  $('#stats').innerHTML = `
    <div class="stat"><b>${m.count ?? '-'}</b><span>在册成员</span></div>
    <div class="stat"><b>${r.count ?? '-'}</b><span>资料总数</span></div>
    <div class="stat"><b>${fmtSize(bytes) || '0'}</b><span>已用 / ${CFG.STORAGE_QUOTA_GB || 1}GB</span><div class="meter"><i style="width:${pct}%;${pct > 85 ? 'background:var(--seal)' : ''}"></i></div></div>`;
}

async function admInvites() {
  const box = $('#adm');
  box.innerHTML = `
    <div class="panel"><h3>生成邀请码</h3>
      <p class="small muted" style="margin-top:-4px">一人一码：填写成员的姓名和学号，这个码只能被这个学号使用一次。</p>
      <form id="invf">
        <div class="row row-wrap">
          <label class="field grow" style="min-width:120px"><span>姓名</span><input class="input" name="name" required></label>
          <label class="field grow" style="min-width:140px"><span>学号</span><input class="input" name="sid" inputmode="numeric" placeholder="强烈建议填写"></label>
          <label class="field" style="width:110px"><span>有效期</span><select class="input" name="days"><option value="3">3 天</option><option value="7" selected>7 天</option><option value="30">30 天</option><option value="0">不过期</option></select></label>
        </div>
        <button class="btn btn-seal btn-block">生成</button>
      </form>
      <div id="newCode"></div>
    </div>
    <div class="panel"><h3>邀请码记录</h3><div id="invList"><div class="spinner"></div></div></div>`;
  $('#invf').onsubmit = async (e) => {
    e.preventDefault(); const f = e.target;
    const { data: code, error } = await S.sb.rpc('create_invite', { p_for_name: f.name.value.trim(), p_for_student_id: f.sid.value.trim(), p_days: +f.days.value });
    if (error) return toast(errMsg(error));
    const site = location.origin + location.pathname;
    const msg = `【${CFG.APP_NAME}】${f.name.value.trim()}你好，你的专属邀请码：${code}\n网址：${site}\n用学号注册，此码仅限本人使用一次，请勿转发。资料仅供部门内部学习，严禁外传或售卖，所有访问均有实名记录。`;
    $('#newCode').innerHTML = `<div class="code-box"><span class="mono">${code}</span><button class="btn btn-sm" id="cpy">复制邀请消息</button></div><pre class="desc" style="font-family:inherit;margin:0">${esc(msg)}</pre>`;
    $('#cpy').onclick = () => copyText(msg);
    f.reset(); loadInv();
  };
  const loadInv = async () => {
    const { data, error } = await S.sb.from('invites').select('*, used:members!invites_used_by_fkey(name)').order('created_at', { ascending: false }).limit(300);
    if (error) return ($('#invList').innerHTML = `<div class="notice bad">${esc(errMsg(error))}</div>`);
    $('#invList').innerHTML = (data || []).map(i => {
      const expired = i.expires_at && new Date(i.expires_at) < new Date();
      const st = i.used_by ? `<span class="tag ok">已用 · ${esc(i.used && i.used.name || '')}</span>` : i.revoked ? '<span class="tag">已作废</span>' : expired ? '<span class="tag">已过期</span>' : '<span class="tag warn">未使用</span>';
      const live = !i.used_by && !i.revoked && !expired;
      return `<div class="trow"><div class="grow"><b class="mono">${esc(i.code)}</b><span>给 ${esc(i.for_name)}${i.for_student_id ? '（' + esc(i.for_student_id) + '）' : ''} · ${fmtDate(i.created_at)}${i.expires_at ? ' · 至 ' + fmtDate(i.expires_at) : ''}</span></div>${st}${live ? `<button class="btn btn-sm btn-danger" data-rv="${esc(i.code)}">作废</button>` : ''}</div>`;
    }).join('') || '<p class="muted small" style="margin:0">还没有生成过邀请码</p>';
    $$('[data-rv]').forEach(b => b.onclick = async () => {
      const { error } = await S.sb.from('invites').update({ revoked: true }).eq('code', b.dataset.rv);
      if (error) return toast(errMsg(error)); toast('已作废'); loadInv();
    });
  };
  loadInv();
}

async function admDevices() {
  const { data, error } = await S.sb.from('devices').select('*, members(name, student_id)').eq('status', 'pending').order('created_at', { ascending: false });
  if (error) return ($('#adm').innerHTML = `<div class="notice bad">${esc(errMsg(error))}</div>`);
  $('#adm').innerHTML = `<div class="panel"><h3>等待批准的新设备</h3>
    <p class="small muted" style="margin-top:-4px">成员的设备超过上限时会出现在这里。同一个人短时间内冒出很多新设备，可能是在外借账号。</p>
    ${(data || []).map(d => `<div class="trow"><div class="grow"><b>${esc(d.members && d.members.name)}（${esc(d.members && d.members.student_id)}）</b><span>${esc(d.label || '未知设备')} · ${ago(d.created_at)}</span></div>
      <button class="btn btn-sm btn-primary" data-ok="${d.id}">批准</button><button class="btn btn-sm btn-danger" data-no="${d.id}">拒绝</button></div>`).join('') || '<p class="muted small" style="margin:0">没有待批准的设备 👍</p>'}</div>`;
  const act = async (id, status) => {
    const { error } = await S.sb.from('devices').update({ status }).eq('id', id);
    if (error) return toast(errMsg(error)); toast(status === 'approved' ? '已批准' : '已拒绝');
    await refreshPendingCount(); renderAdmin('devices');
  };
  $$('[data-ok]').forEach(b => b.onclick = () => act(b.dataset.ok, 'approved'));
  $$('[data-no]').forEach(b => b.onclick = () => act(b.dataset.no, 'revoked'));
}

async function admMembers() {
  const [{ data: ms, error }, { data: devs }] = await Promise.all([
    S.sb.from('members').select('*').order('created_at'),
    S.sb.from('devices').select('*'),
  ]);
  if (error) return ($('#adm').innerHTML = `<div class="notice bad">${esc(errMsg(error))}</div>`);
  const byUser = {}; (devs || []).forEach(d => (byUser[d.user_id] = byUser[d.user_id] || []).push(d));
  $('#adm').innerHTML = `<div class="panel"><h3><span class="grow">成员（${ms.length}）</span></h3>
    ${ms.map(m => {
      const ds = byUser[m.id] || [], nOk = ds.filter(d => d.status === 'approved').length;
      return `<div class="trow" style="flex-wrap:wrap"><div class="grow"><b>${esc(m.name)} ${m.role === 'admin' ? '<span class="tag hl">部长</span>' : ''} ${m.status === 'banned' ? '<span class="tag">已停用</span>' : ''}</b>
        <span>${esc(m.student_id)} · ${fmtDate(m.created_at)} 加入 · ${nOk} 台设备</span></div>
        ${m.id !== S.me.id ? `<button class="btn btn-sm" data-dev="${m.id}">设备</button>
          <button class="btn btn-sm ${m.status === 'active' ? 'btn-danger' : ''}" data-ban="${m.id}" data-st="${m.status}">${m.status === 'active' ? '停用' : '恢复'}</button>
          ${m.status === 'active' ? `<button class="btn btn-sm" data-tr="${m.id}" data-nm="${esc(m.name)}">移交部长</button>` : ''}` : '<span class="small muted">（你）</span>'}
        <div class="hidden" data-devlist="${m.id}" style="flex-basis:100%;padding:6px 0 0 8px">
          ${ds.map(d => `<div class="trow" style="padding:6px 0"><div class="grow"><b style="font-size:13px">${esc(d.label || '未知设备')}</b><span>最近 ${ago(d.last_seen)}</span></div>${devTag(d.status)}
            ${d.status !== 'revoked' ? `<button class="btn btn-sm btn-danger" data-rmd="${d.id}">移除</button>` : `<button class="btn btn-sm" data-dd="${d.id}">删除记录</button>`}</div>`).join('') || '<span class="small muted">无设备</span>'}
        </div></div>`;
    }).join('')}</div>`;
  $$('[data-dev]').forEach(b => b.onclick = () => $(`[data-devlist="${b.dataset.dev}"]`).classList.toggle('hidden'));
  $$('[data-rmd]').forEach(b => b.onclick = async () => {
    const { error } = await S.sb.from('devices').update({ status: 'revoked' }).eq('id', b.dataset.rmd);
    if (error) return toast(errMsg(error)); toast('已移除该设备'); admMembers();
  });
  $$('[data-dd]').forEach(b => b.onclick = async () => {
    const { error } = await S.sb.from('devices').delete().eq('id', b.dataset.dd);
    if (error) return toast(errMsg(error)); toast('已删除记录（该设备下次登录会重新申请）'); admMembers();
  });
  $$('[data-ban]').forEach(b => b.onclick = async () => {
    const to = b.dataset.st === 'active' ? 'banned' : 'active';
    if (to === 'banned' && !(await confirmBox('停用后该成员立即无法访问任何资料（已上传的资料保留）。确定停用？', '停用', true))) return;
    const { error } = await S.sb.rpc('set_member_status', { p_user: b.dataset.ban, p_status: to });
    if (error) return toast(errMsg(error)); toast(to === 'banned' ? '已停用' : '已恢复'); admMembers(); drawStats();
  });
  $$('[data-tr]').forEach(b => b.onclick = async () => {
    const nm = b.dataset.nm;
    const typed = await confirmBox(`把部长（管理员）权限移交给「${nm}」？移交后你将变回普通成员，无法撤回。请输入对方姓名确认：`, '确认移交', true,
      '<input class="input" placeholder="输入对方姓名" style="margin-bottom:6px">');
    if (typed === false) return;
    if (typed.trim() !== nm) return toast('姓名不一致，已取消');
    const { error } = await S.sb.rpc('transfer_admin', { p_user: b.dataset.tr });
    if (error) return toast(errMsg(error));
    toast('已移交，祝新部长顺利！'); setTimeout(() => { location.hash = '#/me'; location.reload(); }, 900);
  });
}

async function admLogs() {
  const since = new Date(Date.now() - 86400000).toISOString();
  const [{ data, error }, { data: day }] = await Promise.all([
    S.sb.from('access_logs').select('*, members(name, student_id), resources(title, section)').order('created_at', { ascending: false }).limit(300),
    S.sb.from('access_logs').select('user_id, members(name, student_id)').gte('created_at', since).limit(5000),
  ]);
  if (error) return ($('#adm').innerHTML = `<div class="notice bad">${esc(errMsg(error))}</div>`);
  const cnt = {}; (day || []).forEach(l => { const k = l.user_id; cnt[k] = cnt[k] || { n: 0, m: l.members }; cnt[k].n++; });
  const top = Object.values(cnt).sort((a, b) => b.n - a.n).slice(0, 8);
  const act = { view: '预览', download: '下载', open_link: '打开链接' };
  $('#adm').innerHTML = `
    <div class="panel"><h3>近 24 小时最活跃</h3>
      <p class="small muted" style="margin-top:-4px">一天内查看/下载超过 60 次会标红，可能在批量搬运资料。</p>
      ${top.map(t => `<div class="trow ${t.n > 60 ? 'hot' : ''}"><div class="grow"><b>${esc(t.m && t.m.name)}（${esc(t.m && t.m.student_id)}）</b></div><span>${t.n} 次</span></div>`).join('') || '<p class="muted small" style="margin:0">暂无</p>'}
    </div>
    <div class="panel"><h3>最近 300 条记录</h3>
      ${(data || []).map(l => `<div class="trow"><div class="grow"><b>${esc(l.members && l.members.name)} ${act[l.action] || l.action}「${esc(l.resources ? l.resources.title : '已删除')}」</b><span>${fmtTime(l.created_at)}${l.resources ? ' · ' + SECTIONS[l.resources.section].name : ''}</span></div></div>`).join('') || '<p class="muted small" style="margin:0">暂无记录</p>'}
    </div>`;
}

async function admSettings() {
  const { data } = await S.sb.from('settings').select('*').eq('key', 'max_devices').maybeSingle();
  const cur = data ? +data.value : 3;
  $('#adm').innerHTML = `
    <div class="panel"><h3>设备上限</h3>
      <p class="small muted" style="margin-top:-4px">每个成员最多自动绑定几台设备，超出需你批准。建议 3（电脑 + 手机浏览器 + 手机桌面App）。</p>
      <form id="sf" class="row"><select class="input grow" name="n">${[1, 2, 3, 4, 5].map(n => `<option ${n === cur ? 'selected' : ''}>${n}</option>`).join('')}</select><button class="btn btn-primary">保存</button></form>
    </div>
    <div class="panel"><h3>换届交接</h3>
      <ol class="steps"><li>让新部长先用邀请码注册成为成员</li><li>在「成员」里找到 TA，点「移交部长」</li><li>同时把 GitHub 仓库和 Supabase 项目的管理权也交给 TA（见 README「换届交接」）</li></ol>
    </div>
    <div class="panel"><h3>防外泄机制说明</h3>
      <ol class="steps">
        <li>一人一码、码绑学号，注册即实名</li>
        <li>每个账号设备数有上限，借号会触发审批</li>
        <li>课程资料只能在线看，画面铺满查看者姓名 + 学号水印</li>
        <li>所有预览、下载、打开链接都有记录，可追溯到人</li>
        <li>发现外泄：在「成员」里一键停用</li>
      </ol>
    </div>`;
  $('#sf').onsubmit = async (e) => {
    e.preventDefault();
    const { error } = await S.sb.from('settings').update({ value: +e.target.n.value }).eq('key', 'max_devices');
    if (error) return toast(errMsg(error)); toast('已保存');
  };
}

function copyText(t) {
  const done = () => toast('已复制');
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(t).then(done, () => fallback());
  fallback();
  function fallback() { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); done(); } catch (e) { toast('复制失败，请手动复制'); } a.remove(); }
}

boot().catch(e => renderFatal('启动失败：' + errMsg(e), true));
})();
