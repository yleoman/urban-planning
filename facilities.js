// 配套数据规则库。页面维护后保存到 localStorage，计算时读取当前规则。
var FACILITY_RULES_KEY = 'guiyang_facility_rules_v1';
var ACTIVE_FACILITY_RULES = null;
var FACILITY_LOCAL_READY = false;
var FACILITY_JSON_LOAD_ERROR = '';
var FACILITY_RULE_SOURCE = 'default';

var DEFAULT_FACILITY_RULES = [
  {id:'prop_mgmt', enabled:true, group:'人口分段配套', source:'贵阳市城市规划管理技术规定 (试行)', matchMode:'cascade', metric:'population', min:1000, max:4999, name:'物业管理与服务用房', areaType:'property', baseMetric:'totalFar', value:0, step:0, areaPerStep:0, note:'总建筑面积不足10万平方米按3‰配置且不低于90㎡；10万以上分段增加。'},
  {id:'store', enabled:true, group:'人口分段配套', source:'城市居住区规划设计标准 GB50180-2018', matchMode:'cascade', metric:'population', min:1000, max:4999, name:'便利店', areaType:'step', baseMetric:'population', value:0, step:3000, areaPerStep:50, note:'每1000人-3000人设置1处，每处50㎡'},
  {id:'trash', enabled:true, group:'人口分段配套', source:'贵阳市城市规划管理技术规定 (试行)', matchMode:'cascade', metric:'population', min:1000, max:4999, name:'生活垃圾收集点', areaType:'fixed', baseMetric:'population', value:20, step:0, areaPerStep:0, note:'生活垃圾收集点≥20㎡'},
  {id:'community_station', enabled:true, group:'人口分段配套', source:'贵阳市城市规划管理技术规定 (试行)', matchMode:'cascade', metric:'population', min:5000, max:14999, name:'社区服务站', areaType:'fixed', baseMetric:'population', value:600, step:0, areaPerStep:0, note:'社区服务站≥600㎡'},
  {id:'culture_station', enabled:true, group:'人口分段配套', source:'贵阳市城市规划管理技术规定 (试行)', matchMode:'cascade', metric:'population', min:5000, max:14999, name:'文化活动站', areaType:'fixed', baseMetric:'population', value:300, step:0, areaPerStep:0, note:'文化活动站≥300㎡'},
  {id:'elder_daycare', enabled:true, group:'人口分段配套', source:'贵阳市城市规划管理技术规定 (试行)', matchMode:'cascade', metric:'population', min:5000, max:14999, name:'老年人日间照料中心、托老所', areaType:'fixed', baseMetric:'population', value:350, step:0, areaPerStep:0, note:'老年人日间照料中心、托老所≥350㎡'},
  {id:'health_station', enabled:true, group:'人口分段配套', source:'贵阳市城市规划管理技术规定 (试行)', matchMode:'cascade', metric:'population', min:5000, max:14999, name:'卫生服务站', areaType:'fixed', baseMetric:'population', value:150, step:0, areaPerStep:0, note:'卫生服务站≥150㎡'},
  {id:'toilet', enabled:true, group:'人口分段配套', source:'贵阳市城市规划管理技术规定 (试行)', matchMode:'cascade', metric:'population', min:5000, max:14999, name:'公厕', areaType:'fixed', baseMetric:'population', value:30, step:0, areaPerStep:0, note:'公厕≥30㎡'},
  {id:'fresh_market', enabled:true, group:'人口分段配套', source:'贵阳市城市规划管理技术规定 (试行)', matchMode:'cascade', metric:'population', min:15000, max:49999, name:'农贸市场、生鲜超市', areaType:'fixed', baseMetric:'population', value:1000, step:0, areaPerStep:0, note:'农贸市场、生鲜超市≥1000㎡'},
  {id:'health_center', enabled:true, group:'人口分段配套', source:'贵阳市城市规划管理技术规定 (试行)', matchMode:'cascade', metric:'population', min:50000, max:0, name:'卫生服务中心', areaType:'fixed', baseMetric:'population', value:1700, step:0, areaPerStep:0, note:'卫生服务中心≥1700㎡'},
  {id:'nursing_home', enabled:true, group:'人口分段配套', source:'贵阳市城市规划管理技术规定 (试行)', matchMode:'cascade', metric:'population', min:50000, max:0, name:'养老院、老年养护院', areaType:'fixed', baseMetric:'population', value:3500, step:0, areaPerStep:0, note:'养老院、老年养护院≥3500㎡'},
  {id:'culture_center', enabled:true, group:'人口分段配套', source:'贵阳市城市规划管理技术规定 (试行)', matchMode:'cascade', metric:'population', min:50000, max:0, name:'文化活动中心', areaType:'fixed', baseMetric:'population', value:3000, step:0, areaPerStep:0, note:'文化活动中心≥3000㎡'},
  {id:'community_center', enabled:true, group:'人口分段配套', source:'贵阳市城市规划管理技术规定 (试行)', matchMode:'cascade', metric:'population', min:50000, max:0, name:'社区服务中心', areaType:'fixed', baseMetric:'population', value:700, step:0, areaPerStep:0, note:'社区服务中心≥700㎡'},
  {id:'judicial_office', enabled:true, group:'人口分段配套', source:'贵阳市城市规划管理技术规定 (试行)', matchMode:'cascade', metric:'population', min:50000, max:0, name:'司法所', areaType:'fixed', baseMetric:'population', value:80, step:0, areaPerStep:0, note:'司法所≥80㎡'},
  {id:'switching_station', enabled:true, group:'人口分段配套', source:'贵阳市城市规划管理技术规定 (试行)', matchMode:'cascade', metric:'population', min:50000, max:0, name:'开闭所', areaType:'fixed', baseMetric:'population', value:200, step:0, areaPerStep:0, note:'开闭所≥200㎡'},

  {id:'lib_small', enabled:true, group:'文化设施_300', source:'贵阳市新建改建居住区公共文化配套设施建设管理规定（暂行）', matchMode:'single', metric:'populationOrUnits', min:1001, minUnits:301, name:'图书室', areaType:'fixed', baseMetric:'population', value:60, step:0, areaPerStep:0, note:'规划户数300-1500或人口1000-4499人，建筑面积50-100㎡'},
  {id:'eread_small', enabled:true, group:'文化设施_300', source:'贵阳市新建改建居住区公共文化配套设施建设管理规定（暂行）', matchMode:'single', metric:'populationOrUnits', min:1001, minUnits:301, name:'公共电子阅览室', areaType:'fixed', baseMetric:'population', value:60, step:0, areaPerStep:0, note:'规划户数300-1500或人口1000-4499人，建筑面积50-80㎡'},
  {id:'multi_small', enabled:true, group:'文化设施_300', source:'贵阳市新建改建居住区公共文化配套设施建设管理规定（暂行）', matchMode:'single', metric:'populationOrUnits', min:1001, minUnits:301, name:'多功能室', areaType:'fixed', baseMetric:'population', value:100, step:0, areaPerStep:0, note:'规划户数300-1500或人口1000-4499人，建筑面积50-200㎡'},
  {id:'sports_small', enabled:true, group:'文化设施_300', source:'贵阳市新建改建居住区公共文化配套设施建设管理规定（暂行）', matchMode:'single', metric:'populationOrUnits', min:1001, minUnits:301, name:'文体活动室', areaType:'fixed', baseMetric:'population', value:80, step:0, areaPerStep:0, note:'规划户数300-1500或人口1000-4499人，建筑面积50㎡以上'},
  {id:'lib_mid', enabled:true, group:'文化设施_1500', source:'贵阳市新建改建居住区公共文化配套设施建设管理规定（暂行）', matchMode:'single', metric:'populationOrUnits', min:4501, minUnits:1501, name:'图书室', areaType:'fixed', baseMetric:'population', value:80, step:0, areaPerStep:0, note:'规划户数1500-3000或人口4500-9000人，建筑面积60-100㎡'},
  {id:'eread_mid', enabled:true, group:'文化设施_1500', source:'贵阳市新建改建居住区公共文化配套设施建设管理规定（暂行）', matchMode:'single', metric:'populationOrUnits', min:4501, minUnits:1501, name:'公共电子阅览室', areaType:'fixed', baseMetric:'population', value:80, step:0, areaPerStep:0, note:'规划户数1500-3000或人口4500-9000人，建筑面积60-100㎡'},
  {id:'multi_mid', enabled:true, group:'文化设施_1500', source:'贵阳市新建改建居住区公共文化配套设施建设管理规定（暂行）', matchMode:'single', metric:'populationOrUnits', min:4501, minUnits:1501, name:'多功能室', areaType:'fixed', baseMetric:'population', value:150, step:0, areaPerStep:0, note:'规划户数1500-3000或人口4500-9000人，建筑面积100-250㎡'},
  {id:'sports_mid', enabled:true, group:'文化设施_1500', source:'贵阳市新建改建居住区公共文化配套设施建设管理规定（暂行）', matchMode:'single', metric:'populationOrUnits', min:4501, minUnits:1501, name:'文体活动室', areaType:'fixed', baseMetric:'population', value:100, step:0, areaPerStep:0, note:'规划户数1500-3000或人口4500-9000人，建筑面积80㎡以上'},
  {id:'lib_large', enabled:true, group:'文化设施_3000', source:'贵阳市新建改建居住区公共文化配套设施建设管理规定（暂行）', matchMode:'single', metric:'populationOrUnits', min:9001, minUnits:3001, name:'图书室', areaType:'fixed', baseMetric:'population', value:100, step:0, areaPerStep:0, note:'规划户数3000-5000或人口9000-15000人，建筑面积80-150㎡'},
  {id:'eread_large', enabled:true, group:'文化设施_3000', source:'贵阳市新建改建居住区公共文化配套设施建设管理规定（暂行）', matchMode:'single', metric:'populationOrUnits', min:9001, minUnits:3001, name:'公共电子阅览室', areaType:'fixed', baseMetric:'population', value:100, step:0, areaPerStep:0, note:'规划户数3000-5000或人口9000-15000人，建筑面积80-150㎡'},
  {id:'multi_large', enabled:true, group:'文化设施_3000', source:'贵阳市新建改建居住区公共文化配套设施建设管理规定（暂行）', matchMode:'single', metric:'populationOrUnits', min:9001, minUnits:3001, name:'多功能室', areaType:'fixed', baseMetric:'population', value:180, step:0, areaPerStep:0, note:'规划户数3000-5000或人口9000-15000人，建筑面积120-300㎡'},
  {id:'sports_large', enabled:true, group:'文化设施_3000', source:'贵阳市新建改建居住区公共文化配套设施建设管理规定（暂行）', matchMode:'single', metric:'populationOrUnits', min:9001, minUnits:3001, name:'文体活动室', areaType:'fixed', baseMetric:'population', value:140, step:0, areaPerStep:0, note:'规划户数3000-5000或人口9000-15000人，建筑面积120㎡以上'},

  {id:'commercial_express', enabled:true, group:'快递综合服务站', source:'关于建设项目规划设置快递综合服务站指导意见（试行）', matchMode:'always', metric:'always', min:0, max:0, name:'商业快递综合服务站', areaType:'step', baseMetric:'comArea', value:0, step:10000, areaPerStep:30, note:'商业面积每1万-3万㎡需设置1处，向上取整，每处30㎡'},
  {id:'residential_express', enabled:true, group:'快递综合服务站', source:'关于建设项目规划设置快递综合服务站指导意见（试行）', matchMode:'always', metric:'always', min:0, max:0, name:'住宅快递综合服务站', areaType:'step', baseMetric:'totalUnits', value:0, step:600, areaPerStep:30, note:'每300-1000户需设置1处，向上取整，每处30㎡'}
];

function cloneFacilityRules(rules) {
  return JSON.parse(JSON.stringify(rules || []));
}

function getFacilityRules() {
  if (ACTIVE_FACILITY_RULES) return cloneFacilityRules(ACTIVE_FACILITY_RULES);
  loadFacilityRulesFromLocalStorage();
  if (ACTIVE_FACILITY_RULES) return cloneFacilityRules(ACTIVE_FACILITY_RULES);
  return cloneFacilityRules(DEFAULT_FACILITY_RULES);
}

function loadFacilityRulesFromLocalStorage() {
  if (FACILITY_LOCAL_READY) return;
  FACILITY_LOCAL_READY = true;
  try {
    var raw = localStorage.getItem(FACILITY_RULES_KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        ACTIVE_FACILITY_RULES = syncOriginalFacilityDefaults(normalizeFacilityRules(parsed));
        FACILITY_RULE_SOURCE = 'localStorage';
      }
    }
  } catch (e) {}
}

function saveFacilityRules(rules) {
  ACTIVE_FACILITY_RULES = syncOriginalFacilityDefaults(normalizeFacilityRules(rules));
  FACILITY_RULE_SOURCE = 'localStorage';
  try {
    localStorage.setItem(FACILITY_RULES_KEY, JSON.stringify(ACTIVE_FACILITY_RULES));
  } catch (e) {
    throw new Error('浏览器本地存储失败，请导出 JSON 备份后清理浏览器数据');
  }
}

function resetFacilityRules() {
  ACTIVE_FACILITY_RULES = null;
  FACILITY_RULE_SOURCE = 'default';
  FACILITY_LOCAL_READY = true;
  try {
    localStorage.removeItem(FACILITY_RULES_KEY);
  } catch (e) {}
}

function hasSavedFacilityRules() {
  loadFacilityRulesFromLocalStorage();
  return !!ACTIVE_FACILITY_RULES;
}

function setFacilityRulesForSession(rules) {
  ACTIVE_FACILITY_RULES = syncOriginalFacilityDefaults(normalizeFacilityRules(rules));
  FACILITY_RULE_SOURCE = 'facility.json';
}

async function loadFacilityRulesFromJson(url) {
  FACILITY_JSON_LOAD_ERROR = '';
  try {
    var resp = await fetch(url || 'facility.json', {cache: 'no-store'});
    if (!resp.ok) {
      FACILITY_JSON_LOAD_ERROR = 'facility.json 读取失败：HTTP ' + resp.status;
      return false;
    }
    var data = await resp.json();
    var rules = Array.isArray(data) ? data : data.rules;
    if (!Array.isArray(rules) || rules.length === 0) {
      FACILITY_JSON_LOAD_ERROR = 'facility.json 中未找到有效 rules 数组';
      return false;
    }
    setFacilityRulesForSession(rules);
    return true;
  } catch (e) {
    FACILITY_JSON_LOAD_ERROR = 'facility.json 解析失败：' + (e && e.message ? e.message : e);
    if (typeof location !== 'undefined' && location.protocol === 'file:') {
      FACILITY_JSON_LOAD_ERROR += '。当前是 file:// 直接打开，浏览器通常会拦截读取本地 JSON，请用本地服务访问。';
    }
    if (typeof console !== 'undefined' && console.warn) console.warn(FACILITY_JSON_LOAD_ERROR);
    return false;
  }
}

function normalizeFacilityRules(rules) {
  var out = [];
  for (var i = 0; i < (rules || []).length; i++) {
    var r = rules[i] || {};
    out.push({
      id: r.id || ('rule_' + Date.now() + '_' + i),
      enabled: r.enabled !== false,
      group: String(r.group || '自定义配套'),
      source: String(r.source || ''),
      matchMode: r.matchMode || 'cascade',
      metric: r.metric || 'population',
      min: Number(r.min) || 0,
      max: Number(r.max) || 0,
      minUnits: Number(r.minUnits) || 0,
      name: String(r.name || '未命名配套'),
      areaType: r.areaType || 'fixed',
      baseMetric: r.baseMetric || 'population',
      value: Number(r.value) || 0,
      step: Number(r.step) || 0,
      areaPerStep: Number(r.areaPerStep) || 0,
      ratio: Number(r.ratio) || 0,
      note: String(r.note || '')
    });
  }
  return out;
}

function syncOriginalFacilityDefaults(rules) {
  var oldThresholds = {
    lib_small:[1000,300,1001,301], eread_small:[1000,300,1001,301], multi_small:[1000,300,1001,301], sports_small:[1000,300,1001,301],
    lib_mid:[4500,1500,4501,1501], eread_mid:[4500,1500,4501,1501], multi_mid:[4500,1500,4501,1501], sports_mid:[4500,1500,4501,1501],
    lib_large:[9000,3000,9001,3001], eread_large:[9000,3000,9001,3001], multi_large:[9000,3000,9001,3001], sports_large:[9000,3000,9001,3001]
  };
  for (var i = 0; i < rules.length; i++) {
    var r = rules[i];
    var t = oldThresholds[r.id];
    if (t && r.min === t[0] && r.minUnits === t[1]) {
      r.min = t[2];
      r.minUnits = t[3];
    }
  }
  return rules;
}

function facilityMetricValue(metric, ctx) {
  if (metric === 'totalFar') return ctx.totalFar;
  if (metric === 'comArea') return ctx.comArea;
  if (metric === 'totalUnits') return ctx.totalUnits;
  return ctx.population;
}

function facilityRuleMatches(rule, ctx) {
  if (!rule.enabled) return false;
  if (rule.metric === 'always') return true;
  if (rule.metric === 'populationOrUnits') {
    var popOk = rule.min > 0 && ctx.population >= rule.min;
    var unitsOk = rule.minUnits > 0 && ctx.totalUnits >= rule.minUnits;
    return popOk || unitsOk;
  }
  var v = facilityMetricValue(rule.metric, ctx);
  if (v < rule.min) return false;
  if (rule.max > 0 && v > rule.max && rule.matchMode !== 'cascade') return false;
  return true;
}

function propertyManagementArea(totalFar) {
  if (totalFar < 100000) return Math.round(Math.max(90, totalFar * 0.003));
  if (totalFar < 500000) return Math.round(300 + (totalFar - 100000) * 0.002);
  return Math.round(1100 + (totalFar - 500000) * 0.001);
}

function calculateFacilityArea(rule, ctx) {
  if (rule.areaType === 'property') return propertyManagementArea(ctx.totalFar);
  if (rule.areaType === 'ratio') {
    return Math.round(facilityMetricValue(rule.baseMetric, ctx) * (rule.ratio || rule.value || 0));
  }
  if (rule.areaType === 'step') {
    var base = facilityMetricValue(rule.baseMetric, ctx);
    if (!base || !rule.step || !rule.areaPerStep) return 0;
    return Math.ceil(base / rule.step) * rule.areaPerStep;
  }
  return Math.round(rule.value || 0);
}

function getFacilitiesFromRules(rules, population, totalFar, comArea, totalUnits) {
  var ctx = {
    population: Number(population) || 0,
    totalFar: Number(totalFar) || 0,
    comArea: Number(comArea) || 0,
    totalUnits: Number(totalUnits) || 0
  };
  var normalized = normalizeFacilityRules(rules);
  var singleRanks = {};

  for (var i = 0; i < normalized.length; i++) {
    var rule = normalized[i];
    if (!facilityRuleMatches(rule, ctx)) continue;
    if (rule.matchMode === 'single') {
      var family = rule.group.replace(/_[^_]+$/, '');
      var rank = Math.max(rule.min || 0, rule.minUnits ? rule.minUnits * 3 : 0);
      if (!singleRanks[family] || rank > singleRanks[family].rank) {
        singleRanks[family] = {rank: rank, rules: []};
      }
      if (singleRanks[family].rank === rank) singleRanks[family].rules.push(rule);
    }
  }

  var f = [];
  for (var si = 0; si < normalized.length; si++) {
    var r = normalized[si];
    if (!facilityRuleMatches(r, ctx)) continue;
    if (r.matchMode === 'single') {
      var singleFamily = r.group.replace(/_[^_]+$/, '');
      var picked = singleRanks[singleFamily];
      if (!picked || picked.rules.indexOf(r) === -1) continue;
    }
    var area = calculateFacilityArea(r, ctx);
    if (area > 0) {
      f.push({name: r.name, area: area, note: r.note || r.source || '', ruleId: r.id});
    }
  }
  return f;
}

function getFacilities(population, totalFar, comArea, totalUnits) {
  return getFacilitiesFromRules(getFacilityRules(), population, totalFar, comArea, totalUnits);
}
