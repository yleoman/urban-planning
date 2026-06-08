// 楼栋配置与可行性分析模块
// 独立文件，不影响 index.html 原有逻辑

function analyzeBuildings() {
  var result = window._lastResult;
  if (!result) return;

  var inp = result.inp;
  if (!inp) return;

  var heightLimit = inp.height_limit || 80;
  var density = inp.building_density || 22;
  var constructionLand = inp.construction_land_area || inp.land_area || 50000;
  var balanceLand = result.land ? (result.land.balance_land || 0) : getVal('balance_land_area', 0);
  var buildLand = constructionLand + balanceLand;
  var allowedProjection = buildLand * density / 100;
  var resArea = result.resArea || 0;
  var comArea = result.comArea || 0;

  // 产品类型定义
  var productDefs = [
    { id: 't4', name: 'T4高层', unitsPerFloor: 4, type: 'high' },
    { id: 't3', name: 'T3高层', unitsPerFloor: 3, type: 'high' },
    { id: 't2h', name: 'T2高层', unitsPerFloor: 2, type: 'high' },
    { id: 't2m', name: 'T2小高层', unitsPerFloor: 2, type: 'mid' },
    { id: 'yf', name: 'T2洋房', unitsPerFloor: 2, type: 'low' },
    { id: 'bs', name: '别墅', unitsPerFloor: 1, type: 'villa' }
  ];

  function maxFloors(type) {
    switch (type) {
      case 'high': return Math.floor((heightLimit - 4.5 - 1.8 - 0.3) / 3.0) + 1;
      case 'mid':  return 18;
      case 'low':  return 6;
      case 'villa': return 3;
      default: return 25;
    }
  }

  function buildingHeight(floors) {
    return 4.5 + (floors - 1) * 3.0 + 1.8 + 0.3;
  }

  var configs = [];
  var totalProjection = 0;

  for (var i = 0; i < productDefs.length; i++) {
    var def = productDefs[i];
    var pct = getVal('res_' + def.id, 0);
    if (pct <= 0) continue;

    var productArea = resArea * pct / 100;
    var maxF = maxFloors(def.type);

    // 获取子户型
    var subTypes = [];
    if (def.id === 't4' || def.id === 't3') {
      var subA = def.id + 'a', subB = def.id + 'b';
      var unitA = getVal('unit_' + subA, 0), unitB = getVal('unit_' + subB, 0);
      var splitA = getVal('split_' + subA, 50), splitB = getVal('split_' + subB, 50);
      var totalSplit = splitA + splitB;
      if (totalSplit === 0 || unitA <= 0 || unitB <= 0) continue;
      var cntA = Math.round(def.unitsPerFloor * splitA / totalSplit);
      var cntB = def.unitsPerFloor - cntA;
      subTypes.push({ name: def.id.toUpperCase() + '-A', size: unitA, cnt: cntA });
      subTypes.push({ name: def.id.toUpperCase() + '-B', size: unitB, cnt: cntB });
    } else {
      var unitSize = getVal('unit_' + def.id, 0);
      if (unitSize <= 0) continue;
      subTypes.push({ name: def.name, size: unitSize, cnt: def.unitsPerFloor });
    }

    // 标准层面积
    var stdFloorArea = 0;
    for (var s = 0; s < subTypes.length; s++) {
      stdFloorArea += subTypes[s].size * subTypes[s].cnt;
    }

    // 均层法：让各楼栋层数尽量接近，栋数差最小
    var totalFloorsNeeded = productArea / stdFloorArea;
    var minBuildings = Math.max(1, Math.ceil(totalFloorsNeeded / maxF));
    var bestGroups = null, bestDiff = Infinity;

    for (var nBld = minBuildings; nBld <= minBuildings + 3; nBld++) {
      var avgF = totalFloorsNeeded / nBld;
      if (avgF < maxF * 0.6 || avgF > maxF) continue;
      var highF = Math.min(maxF, Math.ceil(avgF));
      var lowF = Math.floor(avgF);
      if (lowF < 1) lowF = 1;
      var fDiff = highF - lowF;
      if (highF === lowF) {
        // 单层高
        if (fDiff <= bestDiff) { bestDiff = fDiff; bestGroups = [{ floors: highF, count: nBld, height: buildingHeight(highF).toFixed(1) }]; }
      } else {
        var highCnt = Math.round((totalFloorsNeeded - nBld * lowF) / (highF - lowF));
        var lowCnt = nBld - highCnt;
        if (highCnt > 0 && lowCnt > 0 && fDiff < bestDiff) {
          bestDiff = fDiff;
          bestGroups = [];
          if (highCnt > 0) bestGroups.push({ floors: highF, count: highCnt, height: buildingHeight(highF).toFixed(1) });
          if (lowCnt > 0) bestGroups.push({ floors: lowF, count: lowCnt, height: buildingHeight(lowF).toFixed(1) });
        }
      }
    }
    // 兜底
    if (!bestGroups) bestGroups = [{ floors: maxF, count: minBuildings, height: buildingHeight(maxF).toFixed(1) }];

    var buildingLabel = formatBuildingLabel(def, subTypes);

    var bldGroups = bestGroups;

    for (var g = 0; g < bldGroups.length; g++) {
      var grp = bldGroups[g];
      var grpFloors = grp.floors;
      var grpCount = grp.count;
      var grpHeight = grp.height;
      var fpCoef = getVal('footprint_coef', 1.1);
      var footprint = Math.round(stdFloorArea * fpCoef);
      var perBldCapacity = Math.round(stdFloorArea * grpFloors);
      var perBldUnits = def.unitsPerFloor * grpFloors;
      var totalCap = perBldCapacity * grpCount;
      var totalUnt = perBldUnits * grpCount;
      var isExtra = false;

      totalProjection += footprint * grpCount;

      for (var s2 = 0; s2 < subTypes.length; s2++) {
        var st = subTypes[s2];
        var isMain = (s2 === 0);
        configs.push({
          type: isMain ? def.name : '',
          buildingLabel: isMain ? buildingLabel : '',
          unitName: st.name,
          unitSize: st.size,
          footprint: isMain ? footprint : '',
          stdFloorArea: isMain ? stdFloorArea : '',
          unitsPerFloor: st.cnt,
          floors: isMain ? grpFloors : '',
          height: isMain ? grpHeight : '',
          perBldCapacity: isMain ? perBldCapacity : '',
          perBldUnits: st.cnt * grpFloors,
          buildingCount: isMain ? grpCount : '',
          totalCapacity: isMain ? totalCap : '',
          totalUnits: isMain ? totalUnt : '',
          isMain: isMain,
          subCount: subTypes.length,
          isExtra: isExtra
        });
      }
    }
  }

  // 汇总
  var totalBuiltArea = 0, totalBuiltUnits = 0;
  for (var ci = 0; ci < configs.length; ci++) {
    if (configs[ci].isMain) {
      totalBuiltArea += configs[ci].totalCapacity;
      totalBuiltUnits += configs[ci].totalUnits;
    }
  }

  // 学校配套用地
  var schools = result.schools || [];
  var schoolLandTotal = 0;
  for (var si = 0; si < schools.length; si++) {
    schoolLandTotal += schools[si].land || 0;
  }

  // 商业投影：裙楼商业优先塞入住宅塔楼底部
  // 裙楼商业面积从指标表取，集中商业/综合楼另行独立占地
  // 裙楼层数：从已选radio取值，默认2F
  var comBottomPct = getVal('com_bottom', 0);
  var comBottomArea = comArea * comBottomPct / 100; // 裙楼商业面积
  var comPodiumFloors = window._comPodiumFloors || 2;
  // 裙楼商业面积系数：从输入框读取
  var podiumCoef = comPodiumFloors === 1 ? getVal('podium_coef_1', 1.0) : comPodiumFloors === 2 ? getVal('podium_coef_2', 1.2) : getVal('podium_coef_3', 1.4);
  var comAdjArea = comBottomArea * podiumCoef; // 系数调整后的有效面积
  var comFootprint = Math.ceil(comAdjArea / comPodiumFloors); // 裙楼商业投影面积
  var comProjIndependent = Math.max(0, comFootprint - totalProjection); // 超出住宅投影的部分

  // 集中商业+综合楼独立投影（默认3F）
  var comCentralPct = getVal('com_central', 0);
  var comComplexPct = getVal('com_complex', 0);
  var comCentralArea = comArea * comCentralPct / 100;
  var comComplexArea = comArea * comComplexPct / 100;
  var comOtherArea = comCentralArea + comComplexArea;
  var comOtherProj = comOtherArea > 0 ? Math.ceil(comOtherArea / 3) : 0;

  var totalComProj = comProjIndependent + comOtherProj; // 商业总投影
  var totalProj = totalProjection + totalComProj + schoolLandTotal;
  var calcDensity = totalProj / buildLand * 100;
  var feasible = totalProj <= allowedProjection;

  // 商业层数对比：不同层数影响投影面积
  var comFloorsArr = [1, 2, 3];
  var comProjections = [];
  for (var c = 0; c < comFloorsArr.length; c++) {
    var cf = comFloorsArr[c];
    var coef = cf === 1 ? getVal('podium_coef_1', 1.0) : cf === 2 ? getVal('podium_coef_2', 1.2) : getVal('podium_coef_3', 1.4);
    var projF = Math.ceil(comBottomArea * coef / cf); // 裙楼商业×系数/层数 = 投影面积
    var indF = Math.max(0, projF - totalProjection); // 超出住宅投影 = 独立投影面积
    var totalF = totalProjection + indF + schoolLandTotal;
    comProjections.push({
      floors: cf,
      projection: projF,
      independent: indF,
      total: totalF,
      density: totalF / buildLand * 100
    });
  }

  renderBuildingAnalysis({
    configs: configs,
    summary: {
      constructionLand: constructionLand,
      buildLand: buildLand,
      heightLimit: heightLimit,
      density: density,
      allowedProjection: allowedProjection,
      totalResProjection: totalProjection,
      comArea: comArea,
      comBottomArea: comBottomArea,
      comPodiumFloors: comPodiumFloors,
      podiumCoef: podiumCoef,
      comFootprint: comFootprint,
      comProjIndependent: comProjIndependent,
      comOtherArea: comOtherArea,
      comOtherProj: comOtherProj,
      totalComProj: totalComProj,
      totalProj: totalProj,
      calcDensity: calcDensity,
      feasible: feasible,
      schools: schools,
      schoolLandTotal: schoolLandTotal,
      comProjections: comProjections,
      resArea: resArea,
      totalBuiltArea: totalBuiltArea,
      totalBuiltUnits: totalBuiltUnits,
      targetUnits: result.population ? result.population.units : 0
    }
  });
}

function formatBuildingLabel(def, subTypes) {
  var parts = [];
  for (var i = 0; i < subTypes.length; i++) {
    parts.push(subTypes[i].size + '×' + subTypes[i].cnt);
  }
  return def.name.replace('高层','') + '<br>' + parts.join('+');
}

window.toggleCorrection = function() {
  window._bldCorrected = !window._bldCorrected;
  try {
    window.analyzeBuildings();
  } catch(e) {
    alert('修正出错: ' + e.message);
  }
};

function renderBuildingAnalysis(data) {
  var container = document.getElementById('buildingAnalysisArea');
  if (!container) return;

  var d = function(v) {
    if (v == null || v === '' || isNaN(v)) return '-';
    return v.toLocaleString('zh-CN', { maximumFractionDigits: 0 });
  };
  var d1 = function(v) {
    if (v == null || v === '' || isNaN(v)) return '-';
    return v.toLocaleString('zh-CN', { maximumFractionDigits: 1 });
  };

  var s = data.summary;
  var cfgs = data.configs;

  // 保留用户已输入的占地系数，避免重绘时被覆盖
  var oldFpInput = document.getElementById('footprint_coef');
  var fpCoefVal = oldFpInput ? parseFloat(oldFpInput.value) : 1.1;
  if (isNaN(fpCoefVal) || fpCoefVal <= 0) fpCoefVal = 1.1;

  var h = '<div class="card">';
  var conclusion = s.feasible
    ? '<span style="color:var(--green)">分析结论：✅ 可行，密度余量 ' + d(s.allowedProjection - s.totalProj) + ' ㎡（' + d1((s.allowedProjection - s.totalProj) / s.buildLand * 100) + '%）</span>'
    : '<span style="color:var(--red)">分析结论：❌ 密度不足，超出 ' + d(s.totalProj - s.allowedProjection) + ' ㎡（' + d1((s.totalProj - s.allowedProjection) / s.buildLand * 100) + '%）</span>';
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">';
  h += '<h2 style="margin:0">楼栋配置与可行性分析 <span style="font-weight:400;font-size:0.72rem;color:var(--muted);margin-left:12px">占地系数 <input id="footprint_coef" type="text" value="' + fpCoefVal.toFixed(2) + '" inputmode="decimal" style="width:55px;padding:2px 4px;font-size:0.75rem;text-align:center" onchange="this.value=parseFloat(this.value||1.1).toFixed(2);analyzeBuildings()"> <span style="font-size:0.68rem;color:var(--muted);font-weight:400">（通过标准层面积估算占地面积）</span></h2>';
  h += conclusion;
  h += '</div>';

  // 楼栋配置表
  h += '<div style="overflow-x:auto">';
  h += '<style>#buildingAnalysisArea .bld-table td,#buildingAnalysisArea .bld-table th{border:1px solid #c5c1bc;padding:3px 4px;vertical-align:middle;text-align:center}#buildingAnalysisArea .bld-table th{background:#e8ecf0;font-weight:700}@media (max-width:640px){#buildingAnalysisArea .bld-table{min-width:980px;max-width:none}#buildingAnalysisArea .card>div:first-child{flex-direction:column!important;align-items:flex-start!important;gap:8px}#buildingAnalysisArea .card>div[style*="grid-template-columns:1fr 1fr"]{grid-template-columns:minmax(0,1fr)!important}#buildingAnalysisArea h2 span{display:inline-flex;flex-wrap:wrap;margin-left:0!important}#buildingAnalysisArea .section-block{overflow-x:auto}#buildingAnalysisArea table:not(.bld-table){min-width:360px}}</style><table class="bld-table" style="width:100%;border-collapse:collapse;font-size:0.74rem;table-layout:fixed">';
  h += '<colgroup><col style="width:6%"><col style="width:14%"><col style="width:6%"><col style="width:8%"><col style="width:8%"><col style="width:5%"><col style="width:5%"><col style="width:8%"><col style="width:8%"><col style="width:7%"><col style="width:5%"><col style="width:8%"><col style="width:7%"></colgroup>';
  h += '<thead><tr>';
  h += '<th>类型</th><th>楼型</th><th>户型<br>(㎡)</th><th>占地面积<br>(㎡)</th><th>标准层<br>面积(㎡)</th><th>层<br>户数</th><th>层数<br>(F)</th><th>建筑<br>高度(m)</th>';
  h += '<th>单栋计容<br>(㎡)</th><th>单栋<br>户数</th><th style="color:#C65911">栋数</th><th>总计容<br>(㎡)</th><th>总户数</th>';
  h += '</tr></thead><tbody>';

  // 修正模式：按比例调整每个产品的总计容和总户数
  var corrected = window._bldCorrected || false;
  var adjCfgs = cfgs;
  if (corrected && s.totalBuiltArea > 0 && s.totalBuiltUnits > 0) {
    var areaRatio = s.resArea / s.totalBuiltArea;
    var unitRatio = s.targetUnits / s.totalBuiltUnits;
    adjCfgs = [];
    for (var ai = 0; ai < cfgs.length; ai++) {
      var ac = {}, oc = cfgs[ai];
      for (var k in oc) { ac[k] = oc[k]; }
      if (ac.totalCapacity !== '') ac.totalCapacity = Math.round(ac.totalCapacity * areaRatio);
      if (ac.totalUnits !== '') ac.totalUnits = Math.round(ac.totalUnits * unitRatio);
      if (ac.perBldCapacity !== '') ac.perBldCapacity = Math.round(ac.perBldCapacity * areaRatio);
      if (ac.perBldUnits !== '') ac.perBldUnits = Math.round(ac.perBldUnits * unitRatio);
      adjCfgs.push(ac);
    }
  }

  for (var i = 0; i < adjCfgs.length; i++) {
    var c = adjCfgs[i];
    var unitBg = '';
    if (c.unitSize > 0 && c.unitName) {
      if (c.unitName.indexOf('-A') >= 0) unitBg = 'background:#FFF2CC;color:#C65911;font-weight:700';
      else if (c.unitName.indexOf('-B') >= 0) unitBg = 'background:#EAF2FA;color:#1F4E79;font-weight:700';
      else unitBg = 'background:#FFF2CC;color:#C65911;font-weight:700';
    }
    var tdStyle = ' style="' + unitBg + '"';
    h += '<tr>';
    if (c.isMain && c.subCount > 1) {
      h += '<td style="text-align:center" rowspan="' + c.subCount + '">' + c.type + '</td>';
    } else if (!c.isMain) {
      // rowspan covers
    } else {
      h += '<td style="text-align:center">' + c.type + '</td>';
    }
    var bldLabel = (c.buildingLabel || '') + (c.isExtra ? '<br><span style="font-size:0.65rem;color:var(--amber)">调整栋</span>' : '');
    if (c.isMain && c.subCount > 1) {
      h += '<td style="text-align:center" rowspan="' + c.subCount + '">' + bldLabel + '</td>';
    } else if (!c.isMain) {
      // rowspan covers
    } else {
      h += '<td style="text-align:center">' + bldLabel + '</td>';
    }
    h += '<td' + tdStyle + '> ' + d(c.unitSize) + '</td>';
    if (c.isMain && c.subCount > 1) {
      h += '<td style="text-align:center" rowspan="' + c.subCount + '">' + d(c.footprint) + '</td>';
    } else if (c.isMain) {
      h += '<td style="text-align:center">' + d(c.footprint) + '</td>';
    }
    if (c.isMain && c.subCount > 1) {
      h += '<td style="text-align:center" rowspan="' + c.subCount + '">' + d(c.stdFloorArea) + '</td>';
    } else if (c.isMain) {
      h += '<td style="text-align:center">' + d(c.stdFloorArea) + '</td>';
    }
    h += '<td style="text-align:center">' + (c.unitsPerFloor !== '' ? c.unitsPerFloor : '') + '</td>';
    if (c.isMain && c.subCount > 1) {
      h += '<td style="text-align:center" rowspan="' + c.subCount + '">' + c.floors + '</td>';
    } else if (c.isMain) {
      h += '<td style="text-align:center">' + c.floors + '</td>';
    }
    if (c.isMain && c.subCount > 1) {
      h += '<td style="text-align:center" rowspan="' + c.subCount + '">' + c.height + '</td>';
    } else if (c.isMain) {
      h += '<td style="text-align:center">' + c.height + '</td>';
    }
    if (c.isMain && c.subCount > 1) {
      h += '<td style="text-align:center" rowspan="' + c.subCount + '">' + d(c.perBldCapacity) + '</td>';
    } else if (c.isMain) {
      h += '<td style="text-align:center">' + d(c.perBldCapacity) + '</td>';
    }
    h += '<td style="text-align:center">' + (c.perBldUnits !== '' ? d(c.perBldUnits) : '') + '</td>';
    if (c.isMain && c.subCount > 1) {
      h += '<td style="text-align:center;font-weight:700;color:#C65911" rowspan="' + c.subCount + '">' + c.buildingCount + '</td>';
    } else if (c.isMain) {
      h += '<td style="text-align:center;font-weight:700;color:#C65911">' + c.buildingCount + '</td>';
    }
    if (c.isMain && c.subCount > 1) {
      h += '<td style="text-align:center" rowspan="' + c.subCount + '">' + d(c.totalCapacity) + '</td>';
    } else if (c.isMain) {
      h += '<td style="text-align:center">' + d(c.totalCapacity) + '</td>';
    }
    if (c.isMain && c.subCount > 1) {
      h += '<td style="text-align:center" rowspan="' + c.subCount + '">' + d(c.totalUnits) + '</td>';
    } else if (c.isMain) {
      h += '<td style="text-align:center">' + d(c.totalUnits) + '</td>';
    }
    h += '</tr>';
  }

  // 合计行（使用 adjCfgs，修正模式下已自动调整）
  var totFootprint = 0, totBuildings = 0, totCap = 0, totUnt = 0;
  for (var ti = 0; ti < adjCfgs.length; ti++) {
    if (adjCfgs[ti].isMain) {
      totFootprint += adjCfgs[ti].footprint * adjCfgs[ti].buildingCount;
      totBuildings += adjCfgs[ti].buildingCount;
      totCap += adjCfgs[ti].totalCapacity;
      totUnt += adjCfgs[ti].totalUnits;
    }
  }

  var correctedBg = corrected ? '#e8f5e9' : '#f5f3f0';
  h += '<tr style="font-weight:700;background:' + correctedBg + '">';
  h += '<td colspan="2" style="text-align:center">合计' + (corrected ? '<span style="font-size:0.6rem;color:var(--green);margin-left:4px">已修正</span>' : '') + '</td>';
  h += '<td></td>';
  h += '<td style="text-align:center">' + d(totFootprint) + '</td>';
  h += '<td></td><td></td><td></td><td></td><td></td><td></td>';
  h += '<td style="text-align:center;color:#C65911">' + totBuildings + '</td>';
  h += '<td style="text-align:center">' + d(totCap) + '</td>';
  h += '<td style="text-align:center">' + d(totUnt) + '</td>';
  h += '</tr>';

  // 面积/户数核对行
  var areaDiff = s.totalBuiltArea - s.resArea;
  var areaOk = Math.abs(areaDiff) < s.resArea * 0.005;
  var areaColor = areaOk ? 'var(--green)' : 'var(--amber)';
  var unitDiff = s.totalBuiltUnits - s.targetUnits;
  var unitOk = Math.abs(unitDiff) <= 2;
  var unitColor = unitOk ? 'var(--green)' : 'var(--amber)';
  var btnText = corrected ? '返回' : '修正';
  h += '<tr style="font-size:0.7rem">';
  h += '<td colspan="11" style="text-align:left;padding-left:8px;border-right:none">';
  if (corrected) {
    h += '<b>已修正：</b>各产品总计容/总户数已按比例调整至与指标表一致';
  } else {
    h += '<b>面积核对：</b>配置 ' + d(s.totalBuiltArea) + '㎡ / 指标表 ' + d(s.resArea) + '㎡，差值 <span style="color:' + areaColor + ';font-weight:700">' + (areaDiff >= 0 ? '+' : '') + d(areaDiff) + '㎡ (' + d1(Math.abs(areaDiff)/s.resArea*100) + '%)</span><br><b>户数核对：</b>配置 ' + d(s.totalBuiltUnits) + '户 / 指标表 ' + d(s.targetUnits) + '户，差值 <span style="color:' + unitColor + ';font-weight:700">' + (unitDiff >= 0 ? '+' : '') + unitDiff + '户</span>';
  }
  h += '</td>';
  h += '<td colspan="2" style="text-align:right;padding-right:8px;border-left:none"><button type="button" onclick="window.toggleCorrection()" style="font-size:0.65rem;padding:1px 8px;cursor:pointer;border:1px solid #999;border-radius:3px;background:#fff">' + btnText + '</button></td>';
  h += '</tr>';

  h += '</tbody></table></div>';

  // 密度校验 + 商业对比
  h += '<div style="margin-top:16px;display:grid;grid-template-columns:1fr 1fr;gap:16px">';

  // 密度校验
  h += '<div class="section-block">';
  h += '<h3 style="font-size:0.85rem;margin-bottom:8px">密度校验</h3>';
  h += '<table style="width:100%;font-size:0.78rem">';
  h += '<tr><td>建设用地面积</td><td style="text-align:center">' + d(s.buildLand) + ' ㎡</td></tr>';
  h += '<tr><td>设定建筑密度</td><td style="text-align:center">' + d1(s.density) + '%</td></tr>';
  h += '<tr style="font-weight:700"><td>允许投影面积</td><td style="text-align:center">' + d(s.allowedProjection) + ' ㎡</td></tr>';
  h += '<tr style="border-top:1px solid #ddd"><td>住宅投影</td><td style="text-align:center">' + d(s.totalResProjection) + ' ㎡</td></tr>';
  var comNote = '（裙楼独立投影 + 集中/综合楼投影' + (s.comOtherArea > 0 ? '，集中+综合楼=' + d(s.comOtherArea) + '㎡' : '') + '）';
  h += '<tr><td>商业投影</td><td style="text-align:center">' + d(s.totalComProj) + ' ㎡</td></tr>';
  h += '<tr><td colspan="2" style="font-size:0.68rem;color:var(--muted);text-align:left;border:none">' + comNote + '</td></tr>';
  var schs = s.schools || [];
  for (var si = 0; si < schs.length; si++) {
    var sc = schs[si];
    h += '<tr><td>' + sc.name + '用地</td><td style="text-align:center">' + d(sc.land) + ' ㎡</td></tr>';
  }
  h += '<tr style="font-weight:700"><td>总投影</td><td style="text-align:center">' + d(s.totalProj) + ' ㎡</td></tr>';
  h += '<tr style="font-weight:700;color:' + (s.feasible ? 'var(--green)' : 'var(--red)') + '"><td>测算建筑密度</td><td style="text-align:center">' + d1(s.calcDensity) + '%</td></tr>';
  h += '</table>';
  h += '<div style="font-size:0.65rem;color:var(--muted);margin-top:6px;text-align:left">计算规则：裙楼商业面积×系数 / 层数 = 投影面积；投影面积 - 住宅占地 = 独立投影面积</div>';
  var saveCoef = function(key, def) {
    var el = document.getElementById(key);
    var v = el ? parseFloat(el.value) : def;
    return (isNaN(v) || v <= 0) ? def : v;
  };
  var coef1 = saveCoef('podium_coef_1', 1.0), coef2 = saveCoef('podium_coef_2', 1.2), coef3 = saveCoef('podium_coef_3', 1.4);
  h += '<div style="font-size:0.65rem;color:var(--muted);margin-top:4px;text-align:left;display:flex;gap:12px;align-items:center">系数：1F×<input id="podium_coef_1" type="text" value="' + coef1.toFixed(1) + '" inputmode="decimal" style="width:36px;padding:1px 3px;font-size:0.65rem;text-align:center" onchange="this.value=parseFloat(this.value||1.0).toFixed(1);analyzeBuildings()"> 2F×<input id="podium_coef_2" type="text" value="' + coef2.toFixed(1) + '" inputmode="decimal" style="width:36px;padding:1px 3px;font-size:0.65rem;text-align:center" onchange="this.value=parseFloat(this.value||1.2).toFixed(1);analyzeBuildings()"> 3F×<input id="podium_coef_3" type="text" value="' + coef3.toFixed(1) + '" inputmode="decimal" style="width:36px;padding:1px 3px;font-size:0.65rem;text-align:center" onchange="this.value=parseFloat(this.value||1.4).toFixed(1);analyzeBuildings()"></div>';
  h += '</div>';

  // 商业布局对密度的影响
  h += '<div class="section-block">';
  h += '<h3 style="font-size:0.85rem;margin-bottom:8px">商业布局对密度的影响</h3>';
  h += '<table style="width:100%;font-size:0.78rem">';
  h += '<tr><th style="text-align:center">裙楼层数</th><th style="text-align:center">投影面积(㎡)</th><th style="text-align:center">独立投影面积(㎡)</th><th style="text-align:center">测算密度</th><th></th></tr>';
  for (var j = 0; j < s.comProjections.length; j++) {
    var cp = s.comProjections[j];
    var ok = cp.total <= s.allowedProjection;
    var checked = (cp.floors === s.comPodiumFloors) ? ' checked' : '';
    h += '<tr>';
    h += '<td style="text-align:center;white-space:nowrap"><input type="radio" name="com_podium_floors" value="' + cp.floors + '"' + checked + ' onchange="window._comPodiumFloors=' + cp.floors + ';analyzeBuildings()" style="width:auto;margin:0;vertical-align:middle">' + cp.floors + 'F</td>';
    h += '<td style="text-align:center">' + d(cp.projection) + '</td>';
    h += '<td style="text-align:center">' + (cp.independent > 0 ? d(cp.independent) : '-') + '</td>';
    h += '<td style="text-align:center">' + d1(cp.density) + '%</td>';
    h += '<td style="text-align:center;color:' + (ok ? 'var(--green)' : 'var(--red)') + ';font-weight:700">' + (ok ? '✅' : '❌') + '</td>';
    h += '</tr>';
  }
  h += '</table>';

  // 集中商业/商业综合楼分析
  var remDensity = s.density - s.calcDensity; // 剩余密度
  var remProj = s.allowedProjection - s.totalResProjection - s.schoolLandTotal; // 剩余可投影面积
  // 集中商业+综合楼面积
  var comCentralPct = getVal('com_central', 0);
  var comComplexPct = getVal('com_complex', 0);
  var comCentralArea = s.comArea * comCentralPct / 100;
  var comComplexArea = s.comArea * comComplexPct / 100;
  var comOtherArea = comCentralArea + comComplexArea; // 集中+综合楼总面积

  var suggestion = '';
  var remDensityVal = s.density - s.calcDensity;
  if (!s.feasible) {
    suggestion = '建议：测算密度' + d1(s.calcDensity) + '%已超出设定密度' + d1(s.density) + '%，超出' + d1(-remDensityVal) + '%。建议减少裙楼商业面积或增加商业层数，结合方案增加集中商业或商业综合楼';
  } else if (remDensityVal > 3) {
    suggestion = '建议：测算密度' + d1(s.calcDensity) + '%低于设定密度' + d1(s.density) + '%，余量' + d1(remDensityVal) + '%，密度指标充裕，可结合方案进行优化';
  } else if (remDensityVal > 0) {
    suggestion = '建议：测算密度' + d1(s.calcDensity) + '%低于设定密度' + d1(s.density) + '%，余量' + d1(remDensityVal) + '%，指标可用，需注意方案细节';
  } else {
    suggestion = '建议：测算密度与设定密度一致，指标用尽，需严格控制';
  }

  h += '<div style="margin-top:12px;padding-top:10px;border-top:1px dashed #ccc">';
  h += '<div style="font-weight:600;font-size:0.78rem;color:#57534e;margin-bottom:6px">集中商业 / 商业综合楼分析</div>';
  h += '<table style="width:100%;font-size:0.75rem">';
  h += '<tr><td>剩余密度</td><td style="text-align:center">' + d1(remDensity) + '%</td><td></td></tr>';
  h += '<tr><td>剩余可投影面积</td><td style="text-align:center">' + d(remProj) + ' ㎡</td><td></td></tr>';
  h += '<tr><td>集中商业 + 综合楼面积</td><td style="text-align:center">' + d(comOtherArea) + ' ㎡</td><td></td></tr>';
  if (comOtherArea > 0 && remProj > 0) {
    var minFloors = Math.ceil(comOtherArea / remProj);
    h += '<tr><td>最少层数</td><td style="text-align:center;font-weight:700;color:#C65911">' + minFloors + 'F</td><td></td></tr>';
  }
  h += '<tr><td colspan="3" style="padding-top:6px;font-size:0.75rem;color:' + (s.feasible ? 'var(--green)' : 'var(--amber)') + '">' + suggestion + '</td></tr>';
  h += '</table>';
  h += '</div>';

  h += '</div>';
  h += '</div>';

  // 可行性建议
  h += '<div class="section-block" style="margin-top:12px;background:' + (s.feasible ? '#f0fdf4' : '#fef2f2') + '">';
  h += '<h3 style="font-size:0.85rem;margin-bottom:4px">可行性建议</h3>';
  var actualFAR = window._lastResult ? window._lastResult.totalFar / s.buildLand : 0;
  if (s.feasible) {
    if (s.calcDensity < s.density - 5) {
      h += '<p style="font-size:0.78rem">当前条件（容积率' + d1(actualFAR) + '，限高' + d(s.heightLimit) + 'm，密度' + d1(s.density) + '%）下指标可轻松实现，密度余量充裕，可考虑提高容积率。</p>';
    } else if (s.calcDensity < s.density - 1) {
      h += '<p style="font-size:0.78rem">当前条件（容积率' + d1(actualFAR) + '，限高' + d(s.heightLimit) + 'm，密度' + d1(s.density) + '%）下指标可实现，密度余量适中。</p>';
    } else {
      h += '<p style="font-size:0.78rem;color:var(--amber)">当前条件可实现，但密度余量紧张（仅' + d1(s.density - s.calcDensity) + '%），建议商业≥2层，注意方案细节优化。</p>';
    }
  } else {
    h += '<p style="font-size:0.78rem;color:var(--red);font-weight:700">当前指标不可行：测算密度' + d1(s.calcDensity) + '% &gt; 设定密度' + d1(s.density) + '%。</p>';
    h += '<p style="font-size:0.78rem">可尝试：</p>';
    h += '<ul style="font-size:0.76rem;padding-left:20px">';
    h += '<li>增加商业层数至3F（扩大底商容量，减少独立占地）</li>';
    h += '<li>降低容积率</li>';
    h += '<li>提高建筑限高（增加层数，减少栋数，释放投影空间）</li>';
    h += '<li>提高建筑密度上限</li>';
    h += '</ul>';
  }
  h += '</div>';

  h += '</div>'; // card

  container.innerHTML = h;
}

window.analyzeBuildings = analyzeBuildings;
