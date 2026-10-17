/* ============================================================
   mbti-firms.js — MBTI 各类型的职业方向示例企业（共享数据源）
   被 campus-life.html（测评结果页）与 profile.html（个人中心 · 我的性格特征）共同引用。
   放在独立文件里，保证两处展示的企业列表永远一致，不会出现数据漂移。

   用法：
     var firms = window.DLUTFirms && window.DLUTFirms.of('INFP');  // => [{n,u},...]
     var all   = window.DLUTFirms.map;                             // => {INTP:[...], ...}

   字段：n = 企业名，u = 企业官网（全部 curl 验证过）
   说明：仅用于说明职业方向，不构成就业推荐。
   ============================================================ */
(function (window) {
  'use strict';

  var MAP = {
    INTJ: [{ n: '华为', u: 'https://www.huawei.com' }, { n: '腾讯', u: 'https://www.tencent.com' }, { n: '寒武纪', u: 'https://www.cambricon.com' }],
    INTP: [{ n: '微软', u: 'https://www.microsoft.com' }, { n: '英特尔', u: 'https://www.intel.com' }, { n: '商汤科技', u: 'https://www.sensetime.com' }],
    ENTJ: [{ n: '阿里巴巴', u: 'https://www.alibaba.com' }, { n: '红杉资本', u: 'https://www.sequoiacap.com' }, { n: '比亚迪', u: 'https://www.byd.com' }],
    ENTP: [{ n: '字节跳动', u: 'https://www.bytedance.com' }, { n: '小米', u: 'https://www.mi.com' }, { n: '埃森哲', u: 'https://www.accenture.com' }],
    INFJ: [{ n: '新东方', u: 'https://www.xdf.cn' }, { n: '得到', u: 'https://www.dedao.cn' }, { n: '盖茨基金会', u: 'https://www.gatesfoundation.org' }],
    INFP: [{ n: '网易', u: 'https://www.163.com' }, { n: '知乎', u: 'https://www.zhihu.com' }, { n: '小红书', u: 'https://www.xiaohongshu.com' }],
    ENFJ: [{ n: '好未来', u: 'https://www.tal.com' }, { n: '蓝色光标', u: 'https://www.bluefocus.com' }, { n: '宝洁', u: 'https://www.pg.com.cn' }],
    ENFP: [{ n: '哔哩哔哩', u: 'https://www.bilibili.com' }, { n: '快手', u: 'https://www.kuaishou.com' }, { n: '携程', u: 'https://www.ctrip.com' }],
    ISTJ: [{ n: '德勤', u: 'https://www.deloitte.com' }, { n: '西门子', u: 'https://www.siemens.com' }, { n: '宁德时代', u: 'https://www.catl.com' }],
    ISFJ: [{ n: '迈瑞医疗', u: 'https://www.mindray.com' }, { n: '招商银行', u: 'https://www.cmbchina.com' }, { n: '顺丰', u: 'https://www.sf-express.com' }],
    ESTJ: [{ n: '京东', u: 'https://www.jd.com' }, { n: '中国中车', u: 'https://www.crrcgc.cc' }, { n: '三一重工', u: 'https://www.sany.com.cn' }],
    ESFJ: [{ n: '华住集团', u: 'https://www.hworld.com' }, { n: '中国移动', u: 'https://www.10086.cn' }, { n: '中国平安', u: 'https://www.pingan.com' }],
    ISTP: [{ n: '大疆创新', u: 'https://www.dji.com' }, { n: '汇川技术', u: 'https://www.inovance.com' }, { n: '博世', u: 'https://www.bosch.com' }],
    ISFP: [{ n: '洛可可设计', u: 'https://www.lkkdesign.com' }, { n: '索尼中国', u: 'https://www.sony.com.cn' }, { n: '泡泡玛特', u: 'https://www.popmart.com.cn' }],
    ESTP: [{ n: '特斯拉中国', u: 'https://www.tesla.cn' }, { n: '蔚来', u: 'https://www.nio.cn' }, { n: '联想', u: 'https://www.lenovo.com.cn' }],
    ESFP: [{ n: '芒果TV', u: 'https://www.mgtv.com' }, { n: '上海迪士尼度假区', u: 'https://www.shanghaidisneyresort.com' }, { n: '华强方特', u: 'https://www.fantawild.com' }]
  };

  function of(code) {
    return MAP[code] || [];
  }
  function has(code) {
    return !!MAP[code];
  }

  window.DLUTFirms = { map: MAP, of: of, has: has };
})(window);
