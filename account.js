/**
 * account.js - 本地「账号绑定」组件（纯 localStorage，无后端）
 *
 * 目标：把「在入口页（entrance.html）设置的姓名」当作账号钥匙。
 *   · 输入的名字首次出现  → 视为「绑定新账号」，本机已有数据归入该账号；
 *   · 切换成另一个名字    → 先把当前账号的数据存档（vault），清空工作区，
 *                          再读取新名字对应的存档；没存档就从空白开始；
 *   · 清空姓名 / 名字对不上 → 锁定，个人数据隐藏，页面显示解锁引导。
 *
 * 这样做的好处：favorites.js、MBTI 模块、报到清单模块
 * 仍然读写它们原来的 key，无需大改；本组件只在「切换账号」的瞬间
 * 负责存档（archive）与读档（restore）。
 *
 * 存储：
 *   dut_student_name      当前填写的姓名（entrance.html / profile.html 原有）
 *   dut_accounts          {"张三":{c:创建时间,l:最近登录}}  已绑定账号名单
 *   dut_account_current   当前已登录（已验证）的账号名，空串 = 锁定
 *   dut_vault             {"张三":{"dut_favorites":"[...]",...}} 各账号存档
 *
 * 工作区键（业务模块实际使用的 key）：
 *   dut_favorites / dut_checklist_checked / dut_mbti_result / study_college / study_major
 *
 * 对外：window.DLUTAccount = {
 *   name,current,names,isBound,active,login,requestLogin,logout,
 *   unbind,sync,refresh,guard,onChange,entranceUrl,snapshot,keys
 * }
 * 事件：
 *   window 'dlut:accountchange'  detail={name,current,active,list,switched}
 *   window 'dlut:acctblocked'    未验证姓名时进行写操作
 *
 * 用法（页面侧）：
 *   1) 在 <script src="favorites.js"> 之前引入 <script src="account.js"></script>
 *   2) 给需要保护的容器加  data-account-zone="报到清单进度"
 *   3) 写操作前调用  DLUTAccount.guard()
 */
(function(global){
  'use strict';

  var NAME_KEY ='dut_student_name',
      ACC_KEY  ='dut_accounts',
      CUR_KEY  ='dut_account_current',
      VAULT_KEY='dut_vault';

  /* 各业务模块共用的工作区键 */
  var DATA_KEYS=[
    'dut_favorites',        // 收藏（favorites.js）
    'dut_checklist_checked',// 报到清单进度
    'dut_mbti_result',      // MBTI 测评结果
    'study_college',        // 学业规划 · 学院
    'study_major'           // 学业规划 · 专业
  ];

  var ICO_LOCK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/></svg>';
  var ICO_KEY ='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="8" cy="15" r="4"/><path d="M10.85 12.15L19 4M18 5l2 2M15 8l2 2"/></svg>';

  var CSS=[
    '.acct-lock{position:absolute;inset:0;z-index:80;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;text-align:center;padding:22px;border-radius:inherit;background:rgba(255,255,255,.82);-webkit-backdrop-filter:blur(7px) saturate(1.1);backdrop-filter:blur(7px) saturate(1.1);box-shadow:inset 0 0 0 1px rgba(0,63,136,.10)}',
    '.acct-lock[hidden]{display:none!important}',
    '.acct-lock .al-ico{width:42px;height:42px;border-radius:13px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#003F88,#00A3E0);color:#fff;box-shadow:0 8px 18px rgba(0,63,136,.24)}',
    '.acct-lock .al-ico svg{width:21px;height:21px}',
    '.acct-lock .al-t{font-size:14px;font-weight:600;color:#0F1B2D;letter-spacing:-.01em}',
    '.acct-lock .al-d{font-size:12px;line-height:1.75;color:#5A6B85;max-width:330px}',
    '.acct-lock .al-b{margin-top:3px;display:inline-flex;align-items:center;gap:6px;padding:8px 15px;border-radius:10px;background:#003F88;color:#fff;font-size:12.5px;font-weight:500;text-decoration:none;transition:background .2s}',
    '.acct-lock .al-b svg{width:14px;height:14px}',
    '.acct-lock .al-b:hover{background:#0052B4}',
    '.acct-pill{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:9999;display:flex;align-items:center;gap:9px;padding:9px 16px;border-radius:999px;background:rgba(255,255,255,.94);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);box-shadow:0 10px 30px rgba(0,31,64,.18),inset 0 0 0 1px rgba(0,63,136,.12);font-size:12.5px;color:#0F1B2D;font-family:inherit}',
    '.acct-pill svg{width:15px;height:15px;color:#003F88;flex-shrink:0}',
    '.acct-pill a{color:#003F88;font-weight:600;text-decoration:none}',
    '.acct-pill a:hover{text-decoration:underline}',
    '.acct-pill .al-x{margin-left:2px;border:none;background:none;cursor:pointer;color:#8A98AC;font-size:15px;line-height:1;padding:0 2px;font-family:inherit}',
    '.acct-pill .al-x:hover{color:#0F1B2D}'
  ].join('');

  /* ---------- 基础读写 ---------- */
  function clean(s){return (s||'').replace(/\s+/g,' ').trim();}
  function ls(k){try{return localStorage.getItem(k);}catch(e){return null;}}
  function lsS(k,v){try{localStorage.setItem(k,v);}catch(e){}}
  function lsD(k){try{localStorage.removeItem(k);}catch(e){}}
  function obj(k){
    try{
      var v=JSON.parse(ls(k)||'null');
      return (v&&typeof v==='object')?v:{};
    }catch(e){return {};}
  }
  function has(o,k){return Object.prototype.hasOwnProperty.call(o,k);}
  function saveObj(k,o){lsS(k,JSON.stringify(o));}
  function esc(s){
    return (s||'').replace(/[&<>"']/g,function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  /* ---------- 账号状态 ---------- */
  function name(){return clean(ls(NAME_KEY));}
  function current(){return clean(ls(CUR_KEY));}
  function accounts(){var o=obj(ACC_KEY);return o;}
  function vault(){return obj(VAULT_KEY);}
  function isBound(n){n=clean(n);return !!n&&has(accounts(),n);}
  function active(){
    var n=name(),c=current();
    return !!n&&!!c&&n===c;
  }
  function names(){
    var m=accounts(),out=[],k;
    for(k in m){if(has(m,k))out.push(k);}
    out.sort(function(a,b){return (m[b].l||0)-(m[a].l||0);});
    return out;
  }
  function snapshot(){
    return {name:name(),current:current(),active:active(),list:names(),switched:false};
  }

  /* ---------- 存档 / 读档 ---------- */
  function archive(acct){
    acct=clean(acct);
    if(!acct)return;
    var v=vault(),slot={},i,k,val,any=false;
    for(i=0;i<DATA_KEYS.length;i++){
      k=DATA_KEYS[i];
      val=ls(k);
      if(val!==null&&val!==''){slot[k]=val;any=true;}
    }
    if(any)v[acct]=slot;
    else if(has(v,acct))delete v[acct];
    saveObj(VAULT_KEY,v);
  }
  function wipe(){
    var i;
    for(i=0;i<DATA_KEYS.length;i++)lsD(DATA_KEYS[i]);
  }
  function restore(acct){
    acct=clean(acct);
    if(!acct)return;
    var slot=vault()[acct]||{},i,k;
    for(i=0;i<DATA_KEYS.length;i++){
      k=DATA_KEYS[i];
      if(has(slot,k))lsS(k,slot[k]);
      else lsD(k);
    }
  }

  /* ---------- 登录 / 登出 ---------- */
  var BUSY=false;

  function touch(n){
    var m=accounts();
    if(!has(m,n)||typeof m[n]!=='object')m[n]={};
    if(!m[n].c)m[n].c=Date.now();
    m[n].l=Date.now();
    saveObj(ACC_KEY,m);
  }

  function login(n){
    n=clean(n);
    if(!n)return false;
    var cur=current();
    if(cur===n){touch(n);return true;}      /* 同一个账号，仅刷新登录时间 */
    if(cur)archive(cur);                    /* 换人：先把旧账号存档 */
    /* 只有在本机从未绑定过任何账号时，才把工作区里的旧数据当作「首次绑定归属」；
       否则新账号必须空白起步，避免继承上一个账号的数据 */
    var migrating=(!cur&&names().length===0);
    if(isBound(n)){wipe();restore(n);}      /* 老账号：清干净再读档 */
    else if(!migrating){wipe();}            /* 新账号：空白起步 */
    touch(n);
    lsS(CUR_KEY,n);
    return true;
  }
  function logout(){
    var cur=current();
    if(cur)archive(cur);
    wipe();
    lsD(CUR_KEY);
    return true;
  }
  function unbind(n){
    n=clean(n);
    if(!n)return false;
    var m=accounts(),v=vault();
    if(has(m,n))delete m[n];
    if(has(v,n))delete v[n];
    saveObj(ACC_KEY,m);
    saveObj(VAULT_KEY,v);
    if(current()===n){wipe();lsD(CUR_KEY);}
    return true;
  }

  /* ---------- 广播 ---------- */
  function fire(switched){
    applyGate();
    try{
      global.dispatchEvent(new CustomEvent('dlut:accountchange',{
        detail:{name:name(),current:current(),active:active(),list:names(),switched:!!switched}
      }));
    }catch(e){}
    /* 收藏数据已换人，通知收藏组件刷新星标状态 */
    try{
      var c=0,raw=ls('dut_favorites');
      if(raw){try{c=(JSON.parse(raw)||[]).length;}catch(e2){c=0;}}
      global.dispatchEvent(new CustomEvent('dlut:favchange',{detail:{count:c}}));
    }catch(e){}
  }

  var T=null;
  function requestLogin(n,immediate){
    n=clean(n);
    if(T){clearTimeout(T);T=null;}
    if(!n)return;
    if(immediate){commit(n);return;}
    /* 输入过程中会连续触发，等名字稳定下来再真正切换账号 */
    T=setTimeout(function(){T=null;commit(n);},700);
  }
  function commit(n){
    var before=current();
    if(!login(n))return;
    fire(before!==current());
  }
  /* 已登录但工作区是空的（比如存档在、工作键丢了）：从存档补回来 */
  function heal(){
    var cur=current();
    if(!cur)return false;
    var slot=vault()[cur];
    if(!slot)return false;
    var i,k,val;
    for(i=0;i<DATA_KEYS.length;i++){
      k=DATA_KEYS[i];
      val=ls(k);
      if(val!==null&&val!==''&&val!=='[]')return false;   /* 还有内容，不用补 */
    }
    restore(cur);
    return true;
  }
  function sync(){
    var n=name(),c=current();
    if(n===c)return heal();
    if(n){login(n);}
    else{logout();}
    return true;
  }

  /* ---------- 写操作守卫 ---------- */
  var TOAST_ID='dlut-acct-toast';
  function guard(){
    if(active())return true;
    var t=document.getElementById(TOAST_ID);
    if(!t){
      t=document.createElement('div');
      t.id=TOAST_ID;
      t.setAttribute('role','status');
      t.style.cssText='position:fixed;left:50%;bottom:76px;transform:translateX(-50%) translateY(8px);z-index:10000;padding:11px 20px;border-radius:12px;background:rgba(15,27,45,.94);color:#fff;font-size:13px;letter-spacing:.01em;box-shadow:0 14px 34px rgba(0,31,64,.30);opacity:0;transition:opacity .22s ease,transform .22s ease;pointer-events:none;max-width:88vw;text-align:center;font-family:inherit';
      document.body.appendChild(t);
    }
    t.textContent='请先在入口页输入已绑定的姓名，验证后才能操作个人数据';
    t.style.opacity='1';
    t.style.transform='translateX(-50%) translateY(0)';
    clearTimeout(t._tm);
    t._tm=setTimeout(function(){
      t.style.opacity='0';
      t.style.transform='translateX(-50%) translateY(8px)';
    },2400);
    try{global.dispatchEvent(new CustomEvent('dlut:acctblocked'));}catch(e){}
    return false;
  }

  /* ---------- 锁定遮罩 ---------- */
  var STYLE_ID='dlut-acct-style',PILL_ID='dlut-acct-pill';

  function injectCss(){
    if(document.getElementById(STYLE_ID))return;
    var s=document.createElement('style');
    s.id=STYLE_ID;
    s.setAttribute('type','text/css');
    if(s.styleSheet){s.styleSheet.cssText=CSS;}
    else{s.appendChild(document.createTextNode(CSS));}
    (document.head||document.documentElement).appendChild(s);
  }

  function findLock(z){
    var kids=z.childNodes,i,c;
    for(i=0;i<kids.length;i++){
      c=kids[i];
      if(c&&c.className&&String(c.className).indexOf('acct-lock')>=0)return c;
    }
    return null;
  }

  function makeLock(z){
    var d=document.createElement('div');
    d.className='acct-lock';
    d.innerHTML=
      '<div class="al-ico">'+ICO_LOCK+'</div>'+
      '<div class="al-t">'+esc(z.getAttribute('data-account-zone')||'个人数据')+'已锁定</div>'+
      '<div class="al-d">该内容绑定在本机已设置的姓名账号下。<br>请在入口页输入<b>已绑定的姓名</b>完成验证后再查看。</div>'+
      '<a class="al-b" href="'+entranceUrl()+'">'+ICO_KEY+'前往入口页验证</a>';
    z.appendChild(d);
    return d;
  }

  function renderPill(act){
    var old=document.getElementById(PILL_ID),d;
    if(act){
      if(old&&old.parentNode)old.parentNode.removeChild(old);
      return;
    }
    if(!document.querySelectorAll('[data-account-zone]').length)return;
    if(old)return;
    d=document.createElement('div');
    d.id=PILL_ID;
    d.className='acct-pill';
    d.innerHTML=ICO_LOCK+'<span>当前未绑定姓名账号，个人收藏与进度已隐藏</span>'+
      '<a href="'+entranceUrl()+'">去验证</a>'+
      '<button class="al-x" type="button" title="忽略">×</button>';
    document.body.appendChild(d);
    d.querySelector('.al-x').onclick=function(){
      if(d.parentNode)d.parentNode.removeChild(d);
    };
  }

  function applyGate(){
    try{
      injectCss();
      var zones=document.querySelectorAll('[data-account-zone]'),i,z,lock,act=active();
      for(i=0;i<zones.length;i++){
        z=zones[i];
        var pos=(global.getComputedStyle?global.getComputedStyle(z).position:'')||'';
        if(!pos||pos==='static')z.style.position='relative';
        lock=findLock(z);
        if(!lock)lock=makeLock(z);
        if(act)lock.setAttribute('hidden','');
        else lock.removeAttribute('hidden');
      }
      renderPill(act);
    }catch(e){}
  }

  /* ---------- 入口页地址（带来源，验证后可原路返回） ---------- */
  function entranceUrl(){
    var p=(location.pathname||'').split('/');
    var f=p[p.length-1]||'';
    if(!f||f==='entrance.html')return 'entrance.html?skip=1';
    return 'entrance.html?skip=1&from='+encodeURIComponent(f);
  }

  /* ---------- 启动 ---------- */
  /* 数据被换掉后，先广播让各模块按新数据重绘；再整页重载确保处处一致 */
  function afterSwitch(changed){
    fire(changed);
    if(!changed)return;
    var tag=current()||'__locked__';
    var RL='dut_acct_reloaded';
    try{
      if(sessionStorage.getItem(RL)!==tag){
        sessionStorage.setItem(RL,tag);
        location.reload();
      }
    }catch(e){}
  }
  function boot(){
    var changed=sync();
    applyGate();
    afterSwitch(changed);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
  else boot();

  global.addEventListener('load',function(){applyGate();});

  if(global.MutationObserver&&document.body){
    var mo=null,mt=null;
    mo=new MutationObserver(function(){
      clearTimeout(mt);
      mt=setTimeout(applyGate,200);
    });
    mo.observe(document.body,{childList:true,subtree:true});
  }

  /* 跨标签页：别的标签改了姓名/账号，本页跟着同步 */
  var WATCH=[NAME_KEY,CUR_KEY,ACC_KEY,VAULT_KEY];
  global.addEventListener('storage',function(e){
    if(e.key&&WATCH.indexOf(e.key)<0)return;
    var changed=sync();
    applyGate();
    afterSwitch(changed);
  });

  var API={
    keys:DATA_KEYS,
    name:name,
    current:current,
    accounts:accounts,
    names:names,
    isBound:isBound,
    active:active,
    login:function(n){commit(n);return true;},
    requestLogin:requestLogin,
    logout:function(){logout();fire(true);return true;},
    unbind:function(n){var r=unbind(n);fire(true);return r;},
    sync:sync,
    refresh:function(){applyGate();fire(false);},
    guard:guard,
    entranceUrl:entranceUrl,
    snapshot:snapshot
  };
  global.DLUTAccount=API;
})(window);
