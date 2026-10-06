/**
 * favorites.js - 通用「卡片收藏」组件
 * 适用页面：campus-life.html / dut-orientation.html（自动给卡片挂星标按钮）
 *          profile.html（读取收藏并渲染「我的收藏」）
 *
 * 存储：localStorage['dut_favorites'] = [{id,t,d,u,s,p,pn,ts}]
 *   id/ u 链接   t 标题   d 描述   s 所属板块
 *   p 来源文件名  pn 来源页名称  ts 收藏时间戳
 *
 * 对外：window.DLUTFav = {all,has,add,remove,toggle,clear,count,pageName,key}
 * 事件：window 'dlut:favchange' —— 收藏变化时触发，detail={count}
 */
(function(global){
  'use strict';

  var KEY='dut_favorites';
  var PAGE_NAMES={
    'campus-life.html':'校园生活助手',
    'dut-orientation.html':'新生入学助手',
    'volunteer.html':'志愿服务平台'
  };
  var STAR='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3.6l2.6 5.28 5.82.85-4.21 4.1 1 5.79L12 16.9l-5.21 2.72 1-5.79-4.21-4.1 5.82-.85z"/></svg>';

  /* ---------- 存储层 ---------- */
  function read(){
    try{
      var a=JSON.parse(localStorage.getItem(KEY)||'[]');
      return Object.prototype.toString.call(a)==='[object Array]'?a:[];
    }catch(e){return [];}
  }
  function write(arr){
    try{localStorage.setItem(KEY,JSON.stringify(arr));}catch(e){}
    emit();
  }
  function emit(){
    try{global.dispatchEvent(new CustomEvent('dlut:favchange',{detail:{count:read().length}}));}catch(e){}
  }
  function pageName(f){return PAGE_NAMES[f]||'其他页面';}
  function curFile(){
    var p=(location.pathname||'').split('/');
    return p[p.length-1]||'index.html';
  }

  var API={
    key:KEY,
    all:read,
    pageName:pageName,
    count:function(){return read().length;},
    has:function(id){
      if(!id)return false;
      var a=read();
      for(var i=0;i<a.length;i++){if(a[i].id===id)return true;}
      return false;
    },
    add:function(item){
      if(!item||!item.id)return false;
      var a=read(),i;
      for(i=0;i<a.length;i++){if(a[i].id===item.id)return false;}
      item.p=item.p||curFile();
      item.pn=item.pn||pageName(item.p);
      item.ts=Date.now();
      a.unshift(item);
      write(a);
      return true;
    },
    remove:function(id){
      var a=read(),b=[],i;
      for(i=0;i<a.length;i++){if(a[i].id!==id)b.push(a[i]);}
      write(b);
      return b.length!==a.length;
    },
    toggle:function(item){
      if(!item||!item.id)return false;
      if(API.has(item.id)){API.remove(item.id);return false;}
      API.add(item);return true;
    },
    clear:function(){write([]);}
  };
  global.DLUTFav=API;

  /* ---------- 提示条（复用页面已有的 showToast / .pc-toast 样式） ---------- */
  function toast(msg){
    if(typeof global.showToast==='function'){try{global.showToast(msg);return;}catch(e){}}
    try{
      var t=document.getElementById('favToast');
      if(!t){t=document.createElement('div');t.id='favToast';t.className='pc-toast';document.body.appendChild(t);}
      t.textContent=msg;
      t.className='pc-toast show';
      clearTimeout(t._tm);
      t._tm=setTimeout(function(){t.className='pc-toast';},1900);
    }catch(e){}
  }

  /* ---------- 卡片识别规则 ---------- */
  var RULES=[
    /* 迎新页：官方入口小卡（整块就是链接） */
    {sel:'.link-tile', self:true, t:['.lt-name'], d:['.lt-desc']},
    /* 迎新页：学院风采 / 交通路线卡片 */
    {sel:'.card', self:false, t:['h3'], d:['p'], link:'.card-site,.card-link'},
    /* 校园生活：校区位置卡片 */
    {sel:'.campus-card', self:false, t:['.c-name'], d:['.c-addr'], link:'.c-link'},
    /* 校园生活：周边场所卡片（标题里混有评分角标，需剔除） */
    {sel:'.place', self:false, t:['.place-name'], d:['.place-addr'], link:'.act-map,.act-nav', strip:'.place-badge'},
    /* 校园生活：学科竞赛卡片 */
    {sel:'.contest', self:false, t:['.contest-name'], d:['.contest-desc'], link:'.ca-official,.ca-map'},
    /* 志愿服务：线上平台卡片（官网/访问三个入口指向同一网址） */
    {sel:'.platform', self:false, t:['.platform-name'], d:['.platform-desc'], link:'.pa-official,.org-link'},
    /* 志愿服务：校内服务说明卡片 */
    {sel:'.cv-card', self:false, t:['h3'], d:['p','.cv-card-tag'], link:'.cv-link'},
    /* 志愿服务：各校区志愿组织卡片（随校区切换动态重渲染） */
    {sel:'.org-item', self:false, t:['.org-name-wx'], d:['.org-desc-wx'], link:'.org-go'},
    /* 迎新页：大工校园景色实景卡片（随校区/季节筛选动态重渲染） */
    {sel:'.sc-card', self:false, t:['.sc-t'], d:['.sc-d'], link:'.sc-src'}
  ];

  function clean(s){return (s||'').replace(/\s+/g,' ').trim();}

  function textOf(el,rule){
    if(!el)return '';
    var sels=rule.t,i,n;
    for(i=0;i<sels.length;i++){
      n=el.querySelector(sels[i]);
      if(n){
        var c=n.cloneNode(true),j,bad;
        if(rule.strip){
          bad=c.querySelectorAll(rule.strip);
          for(j=0;j<bad.length;j++){bad[j].parentNode.removeChild(bad[j]);}
        }
        var s=clean(c.textContent||'');
        if(s)return s;
      }
    }
    return '';
  }
  function descOf(el,rule){
    if(!rule.d)return '';
    var i,n;
    for(i=0;i<rule.d.length;i++){
      n=el.querySelector(rule.d[i]);
      if(n){var s=clean(n.textContent||'');if(s)return s;}
    }
    return '';
  }
  function linkOf(el,rule){
    var n=null,i,sels;
    if(rule.self)n=el;
    else{
      sels=(rule.link||'a').split(',');
      for(i=0;i<sels.length&&!n;i++){n=el.querySelector(sels[i]);}
      if(!n)n=el.querySelector('a[href]');
    }
    if(!n)return '';
    var h=n.getAttribute('href')||'';
    if(!h||h.charAt(0)==='#'||/^javascript:/i.test(h))return '';
    return h;
  }
  /* 所属板块：向上找最近的分组标题 / 板块标题 / 当前视图名 */
  function titleIn(node){
    if(!node||!node.querySelector)return '';
    var n,i,sels=['.links-cat-title','.section-title','.panel-title','.sec-title'];
    for(i=0;i<sels.length;i++){
      n=node.querySelector(sels[i]);
      if(n){var s=clean(n.textContent||'');if(s)return s;}
    }
    return '';
  }
  function sectionOf(el){
    var node=el,depth=0,prev,s;
    while(node&&depth<6){
      prev=node.previousElementSibling;
      while(prev){
        if(prev.classList){
          if(prev.classList.contains('links-cat-title')||prev.classList.contains('section-title')){
            s=clean(prev.textContent||'');if(s)return s;
          }
        }
        s=titleIn(prev);
        if(s)return s;
        prev=prev.previousElementSibling;
      }
      node=node.parentElement;depth++;
    }
    var vt=document.getElementById('viewTitle');
    return vt?clean(vt.textContent):'';
  }
  /* 视图深链：卡片用 onclick="switchView('xxx')" 做站内跳转时，
     合成一个可回访的地址（页面本身支持 ?view= 定位视图） */
  function viewUrl(el){
    var hop=0,attr,m;
    while(el&&hop<3){
      attr=el.getAttribute?el.getAttribute('onclick'):null;
      if(attr){
        m=/switchView\(\s*['"]([A-Za-z0-9_-]+)['"]\s*\)/.exec(attr);
        if(m)return curFile()+'?skip=1&view='+m[1];
      }
      el=el.parentElement;hop++;
    }
    return '';
  }
  function extract(el,rule){
    var url=linkOf(el,rule)||viewUrl(el);
    if(!url)return null;
    var title=textOf(el,rule)||clean(el.textContent||'').slice(0,24);
    if(!title)return null;
    return {id:url,t:title.slice(0,40),d:descOf(el,rule).slice(0,120),u:url,s:sectionOf(el),p:curFile(),pn:pageName(curFile())};
  }

  /* ---------- 注入星标按钮 ---------- */
  function syncBtn(btn){
    var on=API.has(btn.getAttribute('data-url'));
    btn.className='fav-btn'+(on?' on':'');
    btn.setAttribute('aria-pressed',on?'true':'false');
    btn.setAttribute('title',on?'取消收藏':'收藏到个人中心');
  }
  function syncAll(){
    var list=document.querySelectorAll('.fav-btn'),i;
    for(i=0;i<list.length;i++){syncBtn(list[i]);}
  }
  function scan(){
    var i,j,list,el,btn,info,found=false;
    for(i=0;i<RULES.length;i++){
      list=document.querySelectorAll(RULES[i].sel);
      for(j=0;j<list.length;j++){
        el=list[j];
        if(el.getAttribute('data-fav-init'))continue;
        info=extract(el,RULES[i]);
        if(!info)continue;
        found=true;
        el.setAttribute('data-fav-init','1');
        if((' '+el.className+' ').indexOf(' fav-host ')<0)el.className=(el.className+' fav-host').replace(/\s+/g,' ');
        btn=document.createElement('span');
        btn.className='fav-btn';
        btn.setAttribute('role','button');
        btn.setAttribute('tabindex','0');
        btn.setAttribute('data-url',info.u);
        btn.innerHTML=STAR;
        btn._item=info;
        el.appendChild(btn);
        syncBtn(btn);
      }
    }
    /* 卡片重渲染后，之前挂过的按钮可能已失效，重新校正状态 */
    var all=document.querySelectorAll('.fav-btn');
    for(i=0;i<all.length;i++){if(!all[i]._item)all[i]._item={id:all[i].getAttribute('data-url'),u:all[i].getAttribute('data-url'),t:'',d:'',p:curFile()};}
    return found;
  }

  function nearestFav(node){
    while(node&&node!==document.body){
      if(node.classList&&node.classList.contains('fav-btn'))return node;
      node=node.parentElement;
    }
    return null;
  }
  function onClick(e){
    var btn=nearestFav(e.target);
    if(!btn)return;
    e.preventDefault();
    e.stopPropagation();
    var item=btn._item;
    if(!item||!item.id)return;
    var added=API.toggle(item);
    syncBtn(btn);
    var url=item.id,list=document.querySelectorAll('.fav-btn'),i;
    for(i=0;i<list.length;i++){
      if(list[i]!==btn&&list[i].getAttribute('data-url')===url)syncBtn(list[i]);
    }
    toast(added?'已收藏 · 可在右上角「个人中心 → 我的收藏」查看':'已取消收藏');
  }
  function onKey(e){
    if(e.key!=='Enter'&&e.key!==' ')return;
    var btn=nearestFav(e.target);
    if(!btn)return;
    e.preventDefault();
    onClick.call(this,e);
  }

  /* 用捕获阶段，保证星标能抢在卡片自身的 onclick（如 switchView）之前拦截事件，
     避免「点星标收藏」被卡片顺带触发一次页面跳转 */
  document.addEventListener('click',onClick,true);
  document.addEventListener('keydown',onKey,true);

  /* ---------- 启动 / 监听动态重渲染 ---------- */
  function boot(){scan();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
  else boot();
  global.addEventListener('load',boot);
  setTimeout(boot,400);

  if(global.MutationObserver&&document.body){
    var mo=null,timer=null;
    mo=new MutationObserver(function(){
      clearTimeout(timer);
      timer=setTimeout(scan,150);
    });
    mo.observe(document.body,{childList:true,subtree:true});
  }

  global.addEventListener('storage',function(e){
    if(!e.key||e.key===KEY){syncAll();emit();}
  });

  emit();
})(window);
