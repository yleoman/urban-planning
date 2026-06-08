// 详细土地增值税计算模块
// 独立文件，在税费测算表下方展示

function runDetailedLAT() {
  var result = window._lastResult;
  if (!result) return;

  var r = result;
  var l = r.land, pp = r.population, pk = r.parking;

  // === 从指标表读取面积 ===
  var resArea = r.resArea || 0;
  var comArea = r.comArea || 0;
  var totalFar = r.totalFar || 0;
  var totalBuilding = r.totalBuilding || 0;
  var undergroundTotal = r.underground ? r.underground.total : 0;
  var sptTotal = 0;
  var schList = r.schools || [];
  for (var si = 0; si < schList.length; si++) sptTotal += schList[si].area;
  var cfList = r.customFacs || [];
  for (var ci = 0; ci < cfList.length; ci++) sptTotal += cfList[ci].area;

  // 地下室面积（从指标表取）
  var basementArea = undergroundTotal || (totalBuilding - totalFar) || 0;

  // === 从测算表读取货值和价格 ===
  var priceRes = getVal('price_res', 6500);
  var priceComBottom = getVal('price_com_bottom', 10000);
  var priceComCentral = getVal('price_com_central', 8000);
  var priceComComplex = getVal('price_com_complex', 7000);
  var priceParking = getVal('price_parking', 30000);

  var comBottomPct = getVal('com_bottom', 0);
  var comCentralPct = getVal('com_central', 0);
  var comComplexPct = getVal('com_complex', 0);
  var comBottomArea = comArea * comBottomPct / 100;
  var comCentralArea = comArea * comCentralPct / 100;
  var comComplexArea = comArea * comComplexPct / 100;

  var resUnsalable = getVal('res_unsalable', 0);
  var salableArea = Math.max(0, resArea - resUnsalable);
  var parkingCount = (r.underground && (r.underground.civilPark != null || r.underground.nonCivilPark != null))
    ? ((r.underground.civilPark || 0) + (r.underground.nonCivilPark || 0))
    : (pk.total || 0);
  var parkingValueCount = r.underground ? (r.underground.nonCivilPark || 0) : parkingCount;

  // 货值（含税）
  var saleRatioBottom = getVal('sale_ratio_bottom', 100);
  var saleRatioCentral = getVal('sale_ratio_central', 100);
  var saleRatioComplex = getVal('sale_ratio_complex', 100);
  var saleRatioPark = getVal('sale_ratio_park', 100);
  var resValue = salableArea * priceRes / 10000;
  var comBottomValue = comBottomArea * priceComBottom / 10000 * saleRatioBottom / 100;
  var comCentralValue = comCentralArea * priceComCentral / 10000 * saleRatioCentral / 100;
  var comComplexValue = comComplexArea * priceComComplex / 10000 * saleRatioComplex / 100;
  var parkValue = parkingValueCount * priceParking / 10000 * saleRatioPark / 100;
  var totalValue = resValue + comBottomValue + comCentralValue + comComplexValue + parkValue;

  // === 成本 ===
  var priceLand = getVal('price_land', 1200);
  var landTotal = totalFar * priceLand / 10000;
  var landTaxRate = getVal('land_tax_rate', 3);
  var landTax = landTotal * landTaxRate / 100;
  var landFeeRes = getVal('land_fee_res', 50);
  var landFeeCom = getVal('land_fee_com', 90);
  var landExtra = getVal('land_extra', 0);
  var landFeeTotal = (resArea * landFeeRes + comArea * landFeeCom) / 10000;
  var landCostTotal = landTotal + landTax + landFeeTotal + landExtra;
  var priceBuild = getVal('price_build', 4000);
  var buildTotal = totalFar * priceBuild / 10000;

  // === 产品户型面积归类（普通/非普通住宅） ===
  // 读取各产品户型面积，判断是否有 >144㎡
  var products = [
    { id: 't4', units: [getVal('unit_t4a',120), getVal('unit_t4b',95)], pct: getVal('res_t4',0) },
    { id: 't3', units: [getVal('unit_t3a',120), getVal('unit_t3b',95)], pct: getVal('res_t3',0) },
    { id: 't2h', units: [getVal('unit_t2h',0)], pct: getVal('res_t2h',0) },
    { id: 't2m', units: [getVal('unit_t2m',0)], pct: getVal('res_t2m',0) },
    { id: 'yf', units: [getVal('unit_yf',0)], pct: getVal('res_yf',0) },
    { id: 'bs', units: [getVal('unit_bs',0)], pct: getVal('res_bs',0) }
  ];

  var ordinaryResArea = 0, nonOrdinaryResArea = 0;
  for (var pi = 0; pi < products.length; pi++) {
    var prod = products[pi];
    if (prod.pct <= 0) continue;
    var prodArea = salableArea * prod.pct / 100;
    // 按户型面积加权拆分普通/非普通
    var totalWeight = 0, nonOrdWeight = 0;
    for (var ui = 0; ui < prod.units.length; ui++) {
      var uSize = prod.units[ui];
      if (uSize <= 0) continue;
      var cnt = 1;
      if (prod.id === 't4') cnt = 2;
      else if (prod.id === 't3') cnt = (ui === 0 ? 2 : 1);
      else if (prod.id === 't2h' || prod.id === 't2m' || prod.id === 'yf') cnt = 2;
      else if (prod.id === 'bs') cnt = 1;
      var w = uSize * cnt;
      totalWeight += w;
      if (uSize > 144) nonOrdWeight += w;
    }
    if (totalWeight > 0) {
      nonOrdinaryResArea += prodArea * nonOrdWeight / totalWeight;
      ordinaryResArea += prodArea * (totalWeight - nonOrdWeight) / totalWeight;
    }
  }

  // === 车位四种情况 ===
  var parkSel = document.getElementById('park_mode_select');
  var parkModeRadio = document.querySelector('input[name="park_mode"]:checked');
  var parkMode = (parkSel ? parkSel.value : null) || (parkModeRadio ? parkModeRadio.value : null) || window._parkModeForCalc || '2';
  window._parkModeForCalc = parkMode;
  // 存储供测算表使用
  window._parkModeForCalc = parkMode;
  var parkMarketPrice = getVal('park_market_price', priceParking);

  // 1=销售无产权 2=赠送无产权 3=销售有产权 4=赠送有产权
  var parkIncluded = (parkMode === '3' || parkMode === '4');
  var parkHasRevenue = (parkMode === '1' || parkMode === '3');
  var parkDeemedSale = (parkMode === '4');

  // === 成本三分法：系数加权，等比缩放保证合计=总建安 ===
  // 先读取用户设置的系数（从DOM或全局缓存），默认1.00
  var coefRes = getVal('coef_res', window._savedCoefRes || 1.00);
  var coefCom = getVal('coef_com', window._savedCoefCom || 1.00);
  var coefBsm = getVal('coef_bsm', window._savedCoefBsm || 1.00);
  window._savedCoefRes = coefRes; window._savedCoefCom = coefCom; window._savedCoefBsm = coefBsm;
  // 权重 = (面积/总建筑面积) × 系数，三方分摊后等比缩放
  var rawRes = totalBuilding > 0 ? (resArea + sptTotal) / totalBuilding * coefRes : 0;
  var rawCom = totalBuilding > 0 ? comArea / totalBuilding * coefCom : 0;
  var rawBsm = totalBuilding > 0 ? basementArea / totalBuilding * coefBsm : 0;
  var rawTotal = rawRes + rawCom + rawBsm;
  var buildRes = rawTotal > 0 ? rawRes / rawTotal * buildTotal : 0;
  var buildCom = rawTotal > 0 ? rawCom / rawTotal * buildTotal : 0;
  var buildBsm = rawTotal > 0 ? rawBsm / rawTotal * buildTotal : 0;
  // 无产权(1/2)：车位建安不抵扣，不并入住宅
  if (parkMode === '1' || parkMode === '2') {
    buildBsm = 0;
  }

  // 土地成本分摊：仅地上可售面积
  var groundSalable = ordinaryResArea + nonOrdinaryResArea + comArea;
  var landOrdinary = groundSalable > 0 ? landCostTotal * ordinaryResArea / groundSalable : 0;
  var landNonOrdinary = groundSalable > 0 ? landCostTotal * nonOrdinaryResArea / groundSalable : 0;
  var landCom = groundSalable > 0 ? landCostTotal * comArea / groundSalable : 0;
  var landRemain = landCostTotal - landOrdinary - landNonOrdinary - landCom;
  if (ordinaryResArea + nonOrdinaryResArea > 0) {
    landOrdinary += landRemain * ordinaryResArea / (ordinaryResArea + nonOrdinaryResArea);
    landNonOrdinary += landRemain * nonOrdinaryResArea / (ordinaryResArea + nonOrdinaryResArea);
  }

  // 增值税差额扣除基数（仅土地出让金，车位=0）
  var landOnly = landTotal;
  var landOnlyOrdinary = groundSalable > 0 ? landOnly * ordinaryResArea / groundSalable : 0;
  var landOnlyNonOrdinary = groundSalable > 0 ? landOnly * nonOrdinaryResArea / groundSalable : 0;
  var landOnlyCom = groundSalable > 0 ? landOnly * comArea / groundSalable : 0;

  // 住宅内部建安再分普通/非普通
  var buildOrdinary = (ordinaryResArea + nonOrdinaryResArea > 0) ? buildRes * ordinaryResArea / (ordinaryResArea + nonOrdinaryResArea) : 0;
  var buildNonOrdinary = buildRes - buildOrdinary;

  // === 各业态收入 ===
  // 赠送类：车位公允价值需从住宅货值中拆分
  var parkGiftValue = 0;
  if (parkMode === '2' || parkMode === '4') {
    var giftPrice = getVal('park_gift_price', priceParking);
    parkGiftValue = parkingValueCount * giftPrice / 10000 * saleRatioPark / 100;
  }
  var resValueForLat = (parkMode === '2' || parkMode === '4') ? Math.max(0, resValue - parkGiftValue) : resValue;
  var valueOrdinary = ordinaryResArea > 0 ? resValueForLat * ordinaryResArea / salableArea : 0;
  var valueNonOrdinary = nonOrdinaryResArea > 0 ? resValueForLat * nonOrdinaryResArea / salableArea : 0;
  var valueCom = comBottomValue + comCentralValue + comComplexValue;
  var valuePark = parkDeemedSale ? parkGiftValue : (parkHasRevenue ? parkValue : 0);

  // === 逐业态计算土增 ===
  var invoiceRate = getVal('invoice_rate', 90);
  function calcTypeLAT(name, value, landCost, landOnlyParam, buildCost, exempt20) {
    // 增值税
    var vatSales = (value - (landOnlyParam || landCost)) / 1.09 * 0.09;
    var vatInput = buildCost / 1.09 * 0.09 * invoiceRate / 100;
    var vatTax = Math.max(0, vatSales - vatInput);
    // 不含税收入 = 含税货值 - 销项税额
    var taxExclusiveValue = value - vatSales;
    // 扣除项目（不含附加税，附加税后续按不含税收入比分摊）
    // ②建安成本：含税建安 × 取票率（不可取得发票部分不得扣除）
    var deductibleBuild = buildCost * invoiceRate / 100;
    var base = landCost + deductibleBuild;
    var other = base * 0.10;
    var extra = base * 0.20;
    var deductionNoSur = base + other + extra;
    // 增值额（暂不含附加）
    var valueAddedNoSur = taxExclusiveValue - deductionNoSur;
    var vatDeductBase = (landOnlyParam || landCost); // VAT差额扣除基数（土地出让金，不含契税）
    return { name: name, value: value, taxExclusiveValue: taxExclusiveValue, landCost: landCost, buildCost: deductibleBuild, vatTax: vatTax, vatSales: vatSales, vatInput: vatInput, vatDeductBase: vatDeductBase, base: base, other: other, extra: extra, deductionNoSur: deductionNoSur, valueAddedNoSur: valueAddedNoSur, exempt20: exempt20 };
  }

  var types = [];
  if (ordinaryResArea > 0) types.push(calcTypeLAT('普通住宅', valueOrdinary, landOrdinary, landOnlyOrdinary, buildOrdinary, true));
  if (nonOrdinaryResArea > 0) types.push(calcTypeLAT('非普通住宅', valueNonOrdinary, landNonOrdinary, landOnlyNonOrdinary, buildNonOrdinary, false));
  types.push(calcTypeLAT('非住宅-商业', valueCom, landCom, landOnlyCom, buildCom, false));
  if (parkIncluded && parkingCount > 0) {
    types.push(calcTypeLAT(parkDeemedSale ? '非住宅-车位<br>(视同销售)' : '非住宅-车位', valuePark, 0, 0, buildBsm, false));
  }

  // === 第二遍：附加税按不含税收入比分摊 ===
  var totalVatAll = 0, totalTaxExclusiveAll = 0;
  for (var tv = 0; tv < types.length; tv++) { totalVatAll += types[tv].vatTax; totalTaxExclusiveAll += types[tv].taxExclusiveValue; }
  var totalVatSurcharge = totalVatAll * 0.12;
  for (var ts = 0; ts < types.length; ts++) {
    var t = types[ts];
    var allocSurcharge = totalTaxExclusiveAll > 0 ? totalVatSurcharge * (t.taxExclusiveValue / totalTaxExclusiveAll) : 0;
    t.vatSurcharge = allocSurcharge;
    t.totalDeduction = t.deductionNoSur + allocSurcharge;
    t.valueAdded = t.taxExclusiveValue - t.totalDeduction;
    t.rate = t.totalDeduction > 0 ? t.valueAdded / t.totalDeduction * 100 : 0;
    t.tax = 0; t.note = '';
    if (t.valueAdded <= 0) { t.note = '增值额≤0，不征税'; }
    else if (t.exempt20 && t.rate <= 20) { t.note = '增值率≤20%，免征'; }
    else if (t.rate <= 50) { t.tax = Math.round(t.valueAdded * 0.30); t.note = '税率30%'; }
    else if (t.rate <= 100) { t.tax = Math.round(t.valueAdded * 0.40 - t.totalDeduction * 0.05); t.note = '税率40%，扣除5%'; }
    else if (t.rate <= 200) { t.tax = Math.round(t.valueAdded * 0.50 - t.totalDeduction * 0.15); t.note = '税率50%，扣除15%'; }
    else { t.tax = Math.round(t.valueAdded * 0.60 - t.totalDeduction * 0.35); t.note = '税率60%，扣除35%'; }
  }

  // 存储结果供税费测算表引用
  var totalDetailLat = 0, totalVatAll2 = 0, totalVatSurAll2 = 0;
  for (var tk = 0; tk < types.length; tk++) { totalDetailLat += types[tk].tax; totalVatAll2 += types[tk].vatTax; totalVatSurAll2 += types[tk].vatSurcharge; }
  window._detailedLatResult = { types: types, total: totalDetailLat, totalVat: totalVatAll2, totalVatSur: totalVatSurAll2, parkMode: parkMode, ordinaryResArea: ordinaryResArea, nonOrdinaryResArea: nonOrdinaryResArea, buildRes: buildRes, buildCom: buildCom, buildBsm: buildBsm, parkIsGift: (parkMode === '2' || parkMode === '4') };
  renderDetailedLAT({
    types: types,
    summary: {
      ordinaryResArea: ordinaryResArea, nonOrdinaryResArea: nonOrdinaryResArea,
      resArea: resArea, sptTotal: sptTotal, comArea: comArea, parkingCount: parkingCount,
      landCostTotal: landCostTotal, landTotal: landTotal, landTax: landTax, landFeeTotal: landFeeTotal, buildTotal: buildTotal, basementArea: basementArea,
      totalFar: totalFar, totalBuilding: totalBuilding,
      buildRes: buildRes, buildCom: buildCom, buildBsm: buildBsm,
      coefRes: coefRes, coefCom: coefCom, coefBsm: coefBsm, parkIncluded: parkIncluded, sumTax: totalDetailLat, invoiceRate: invoiceRate,
      parkMode: parkMode, parkMarketPrice: parkMarketPrice
    }
  });
}

function renderDetailedLAT(data) {
  var container = document.getElementById('detailedLatInline');
  if (!container) return;

  var d = function(v) { if (v==null||isNaN(v)) return '-'; return v.toLocaleString('zh-CN', {maximumFractionDigits:0}); };
  var d1 = function(v) { if (v==null||isNaN(v)) return '-'; return v.toLocaleString('zh-CN', {maximumFractionDigits:1}); };
  var s = data.summary;
  var types = data.types;

  var h = '<style>#detailedLatInline .dlt td,#detailedLatInline .dlt th{border:1px solid #c5c1bc;padding:3px 5px;vertical-align:middle;text-align:center;font-size:0.72rem}#detailedLatInline .dlt th{font-weight:700;background:#e8ecf0}@media (max-width:640px){#detailedLatInline{overflow-x:auto}#detailedLatInline .dlt{min-width:760px;max-width:none}#detailedLatInline div[style*="display:flex;gap:16px"]{flex-direction:column!important;gap:8px!important}#detailedLatInline div[style*="border-left:1px"]{border-left:0!important;border-top:1px solid #ddd;padding-left:0!important;padding-top:8px}}</style>';
  h += '<h2 style="margin-top:16px">详细土增计算</h2>';

  // 分摊系数
  var unitBuildRes = (s.resArea + s.sptTotal) > 0 ? Math.round(s.buildRes * 10000 / (s.resArea + s.sptTotal)) : 0;
  var unitBuildCom = s.comArea > 0 ? Math.round(s.buildCom * 10000 / s.comArea) : 0;
  var unitBuildBsm = s.basementArea > 0 ? Math.round(s.buildBsm * 10000 / s.basementArea) : 0;
  h += '<div style="margin-bottom:8px;font-size:0.68rem;color:var(--muted);line-height:1.8">分摊系数：';
  h += '<span style="background:#FFF2CC;padding:1px 4px">住宅</span><input id="coef_res" type="number" value="' + s.coefRes.toFixed(2) + '" step="0.01" style="width:50px;padding:1px 3px;font-size:0.7rem;text-align:center" onchange="runDetailedLAT();runProjectCalc()">（' + d(s.buildRes) + '万，' + d(unitBuildRes) + '元/㎡） ';
  h += '<span style="background:#EAF2FA;padding:1px 4px">商业</span><input id="coef_com" type="number" value="' + s.coefCom.toFixed(2) + '" step="0.01" style="width:50px;padding:1px 3px;font-size:0.7rem;text-align:center" onchange="runDetailedLAT();runProjectCalc()">（' + d(s.buildCom) + '万，' + d(unitBuildCom) + '元/㎡） ';
  h += '<span style="background:#E2EFDA;padding:1px 4px">地下</span><input id="coef_bsm" type="number" value="' + s.coefBsm.toFixed(2) + '" step="0.01" style="width:50px;padding:1px 3px;font-size:0.7rem;text-align:center" onchange="runDetailedLAT();runProjectCalc()">（' + d(s.buildBsm) + '万，' + d(unitBuildBsm) + '元/㎡）';
  h += ' 合计' + d(s.buildRes + s.buildCom + s.buildBsm) + '万</div>';

  // 成本拆分汇总
  h += '<table class="dlt" style="width:100%;border-collapse:collapse;margin-bottom:12px">';
  h += '<tr style="background:#FCE4D6"><th>业态</th><th>可售面积(㎡)</th><th>含税收入(万)</th><th>不含税收入(万)</th><th>分摊土地(万)</th><th>分摊建安(万)</th><th>扣除项目(万)</th><th>增值额(万)</th><th>增值率</th><th>税率说明</th><th>土增税(万)</th></tr>';
  var totalTax = 0;
  for (var ti = 0; ti < types.length; ti++) {
    var t = types[ti];
    totalTax += t.tax;
    h += '<tr>';
    h += '<td style="text-align:left;padding-left:6px">' + t.name + '</td>';
    h += '<td>' + d(t.landCost > 0 || t.buildCost > 0 ? (t.name.indexOf('商业')>=0 ? s.comArea : (t.name.indexOf('车位')>=0 ? s.parkingCount : (t.name.indexOf('非普通')>=0 ? s.nonOrdinaryResArea : s.ordinaryResArea))) : '-') + '</td>';
    h += '<td>' + d(t.value) + '</td>';
    h += '<td>' + d(t.taxExclusiveValue) + '</td>';
    h += '<td>' + d(t.landCost) + '</td>';
    h += '<td>' + d(t.buildCost) + '</td>';
    h += '<td>' + d(t.totalDeduction) + '</td>';
    h += '<td>' + d(t.valueAdded) + '</td>';
    h += '<td>' + d1(t.rate) + '%</td>';
    h += '<td style="font-size:0.65rem">' + t.note + '</td>';
    h += '<td style="font-weight:700">' + d(t.tax) + '</td>';
    h += '</tr>';
  }
  h += '<tr style="font-weight:700;background:#FFFF00"><td>合计</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td>' + d(totalTax) + '</td></tr>';
  h += '</table>';

  // 逐业态详细计算
  h += '<div style="font-size:0.68rem;color:var(--muted);line-height:1.7;margin-top:8px">';
  h += '<div style="display:flex;gap:16px;margin-bottom:8px">';
  h += '<div style="flex:1;font-size:0.68rem;color:var(--muted);line-height:1.7">';
  h += '<b>▎数据来源</b><br>';
  h += '&nbsp;&nbsp;总建筑面积=' + d(s.totalBuilding) + '㎡，总建安成本=' + d(s.buildTotal) + '万（测算表）<br>';
  h += '&nbsp;&nbsp;总土地成本=' + d(s.landCostTotal) + '万（出让金' + d(s.landTotal) + '万+契税' + d(s.landTax) + '万+配套费' + d(s.landFeeTotal) + '万），地下室面积=' + d(s.basementArea) + '㎡<br>';
  h += '<b>▎成本三分法（按总建安' + d(s.buildTotal) + '万等比缩放）</b><br>';
  var sumCheck = s.buildRes + s.buildCom + s.buildBsm;
  h += '&nbsp;&nbsp;①住宅权重=(' + d(s.resArea + s.sptTotal) + '/' + d(s.totalBuilding) + ')×' + s.coefRes + '=' + d1(s.buildRes/s.buildTotal*100) + '%，建安=' + d(s.buildRes) + '万，单方' + d(unitBuildRes) + '元/㎡<br>';
  h += '&nbsp;&nbsp;②商业权重=(' + d(s.comArea) + '/' + d(s.totalBuilding) + ')×' + s.coefCom + '=' + d1(s.buildCom/s.buildTotal*100) + '%，建安=' + d(s.buildCom) + '万，单方' + d(unitBuildCom) + '元/㎡<br>';
  h += '&nbsp;&nbsp;③地下权重=(' + d(s.basementArea) + '/' + d(s.totalBuilding) + ')×' + s.coefBsm + '=' + d1(s.buildBsm/s.buildTotal*100) + '%，建安=' + d(s.buildBsm) + '万，单方' + d(unitBuildBsm) + '元/㎡<br>';
  h += '&nbsp;&nbsp;合计=' + d(sumCheck) + '万 = 总建安' + d(s.buildTotal) + '万 ✓<br>';
  h += '<b>▎土地成本分摊（按计容面积比，车位不分摊）</b><br>';
  h += '&nbsp;&nbsp;计容面积=' + d(s.totalFar) + '㎡，土地总计=' + d(s.landCostTotal) + '万<br>';
  h += '&nbsp;&nbsp;普通住宅：总土地' + d(s.landCostTotal) + '×(' + d(s.ordinaryResArea) + '/' + d(s.totalFar) + ')=' + d(s.landCostTotal * s.ordinaryResArea / s.totalFar) + '万<br>';
  if (s.nonOrdinaryResArea > 0) h += '&nbsp;&nbsp;非普通住宅：总土地' + d(s.landCostTotal) + '×(' + d(s.nonOrdinaryResArea) + '/' + d(s.totalFar) + ')=' + d(s.landCostTotal * s.nonOrdinaryResArea / s.totalFar) + '万<br>';
  h += '&nbsp;&nbsp;非住宅：总土地' + d(s.landCostTotal) + '×(' + d(s.comArea) + '/' + d(s.totalFar) + ')=' + d(s.landCostTotal * s.comArea / s.totalFar) + '万<br>';
  h += '</div>';
  // 车位类型说明
  h += '<div style="flex:0.68;font-size:0.68rem;color:var(--muted);line-height:1.7;border-left:1px solid #ddd;padding-left:12px">';
  h += '<b>▎车位类型说明：</b><br>';
  h += '1、销售无产权：购房合同+车位使用权合同（有价款），土增收入不确认，成本不扣除。<br>';
  h += '2、赠送无产权：车位无实际收款，按公允价值确认视同销售收入，土增收入不确认，成本不扣除。<br>';
  h += '3、销售有产权：增加补土成本，土增收入确认，成本扣除。<br>';
  h += '4、赠送有产权：按公允价值确认视同销售收入，土增收入确认，成本扣除。';
  h += '</div></div>';

  // 逐业态对比表
  var colNames = [];
  for (var tk = 0; tk < types.length; tk++) colNames.push(types[tk].name);
  h += '<table class="dlt" style="width:100%;border-collapse:collapse;margin-top:8px;font-size:0.68rem">';
  h += '<tr style="background:#A6A6A6;color:#000"><th style="text-align:left;padding-left:6px">计算步骤</th>';
  for (var cn = 0; cn < colNames.length; cn++) h += '<th>' + colNames[cn] + '</th>';
  h += '<th style="background:#FFFF00">合计</th></tr>';
  function addRow(label, vals, unit, bold) {
    h += '<tr' + (bold ? ' style="font-weight:700"' : '') + '><td style="text-align:left;padding-left:6px">' + label + '</td>';
    for (var vi = 0; vi < colNames.length; vi++) h += '<td>' + (vals[vi] !== '' ? vals[vi] + (unit||'') : '-') + '</td>';
    h += '</tr>';
  }
  // 合计行数据
  var sumArea = s.ordinaryResArea + s.nonOrdinaryResArea + s.comArea;
  var sumAreaStr = d(sumArea + (s.parkIncluded ? s.basementArea : 0)) + '㎡';
  var sumVal = types.reduce(function(a,t){return a+t.value;},0);
  var sumTaxExclusive = types.reduce(function(a,t){return a+t.taxExclusiveValue;},0);
  var sumLand = types.reduce(function(a,t){return a+t.landCost;},0);
  var sumBuild = types.reduce(function(a,t){return a+t.buildCost;},0);
  var sumBase = sumLand + sumBuild;
  var sumVat = types.reduce(function(a,t){return a+t.vatTax;},0);
  var sumSurcharge = types.reduce(function(a,t){return a+t.vatSurcharge;},0);
  var sumDeduction = sumBase + sumBase*0.1 + sumSurcharge + sumBase*0.2;
  var sumValueAdded = sumTaxExclusive - sumDeduction;
  var sumTax = types.reduce(function(a,t){return a+t.tax;},0);
  function typeArea(t) {
    if (t.name.indexOf('商业')>=0) return s.comArea;
    if (t.name.indexOf('车位')>=0) return s.basementArea;
    if (t.name.indexOf('非普通')>=0) return s.nonOrdinaryResArea;
    return s.ordinaryResArea;
  }
  var rows = [
    ['可售面积(㎡)', types.map(function(t){ return d(typeArea(t))+'㎡'; }), '', sumAreaStr],
    ['含税收入(万)', types.map(function(t){ return d(t.value); }), '', d(sumVal)],
    ['不含税收入(万)', types.map(function(t){ return d(t.value) + '/1.09=' + d(t.taxExclusiveValue); }), '含税收入/1.09', d(sumTaxExclusive)],
    ['①分摊土地(万)', types.map(function(t){
      if (t.landCost <= 0) return '车位不分摊';
      var rawVal = s.landCostTotal * typeArea(t) / s.totalFar;
      var diff = t.landCost - rawVal;
      var formula = d(s.landCostTotal) + '×(' + d(typeArea(t)) + '/' + d(s.totalFar) + ')<br>=' + d(rawVal);
      if (Math.abs(diff) > 1) formula += '<br>+' + d(diff) + '=' + d(t.landCost);
      return formula;
    }), '', d(sumLand)],
    ['②分摊建安(万)', types.map(function(t){
      return d(t.buildCost) + '（权重' + d1(t.buildCost/s.buildTotal*100) + '%）';
    }), '', d(sumBuild)],
    ['③开发费用(万)', types.map(function(t){ return '(' + d(t.landCost + t.buildCost) + ')×10%=' + d(t.other); }), '(①+②)×10%', d1(sumBase*0.1)],
    ['④增值税附加(万)', types.map(function(t){
      return d1(sumVat * 0.12) + '×(' + d(t.taxExclusiveValue) + '/' + d(sumTaxExclusive) + ')=' + d(t.vatSurcharge);
    }), '总附加' + d1(sumVat * 0.12) + '按不含税收入比分摊', d1(sumSurcharge)],
    ['⑤加计扣除(万)', types.map(function(t){ return '(' + d(t.landCost + t.buildCost) + ')×20%=' + d(t.extra); }), '(①+②)×20%', d1(sumBase*0.2)],
    ['总扣除(万)', types.map(function(t){ return '①+②+③+④+⑤='+d(t.totalDeduction); }), '', d(sumDeduction)],
    ['增值额(万)', types.map(function(t){ return d(t.taxExclusiveValue) + '-' + d(t.totalDeduction) + '=' + d(t.valueAdded); }), '不含税收入-总扣除', d(sumValueAdded)],
    ['增值率', types.map(function(t){ return d1(t.rate)+'%' + (t.exempt20 ? '(≤20%免征)' : ''); }), '增值额/总扣除', '-'],
    ['土增税(万)', types.map(function(t){
      if (t.tax <= 0) return '<b>0</b>';
      if (t.rate <= 50) return d(t.valueAdded)+'×30%-'+d(t.totalDeduction)+'×0%=' + '<b>'+d(t.tax)+'</b>';
      if (t.rate <= 100) return d(t.valueAdded)+'×40%-'+d(t.totalDeduction)+'×5%=' + '<b>'+d(t.tax)+'</b>';
      if (t.rate <= 200) return d(t.valueAdded)+'×50%-'+d(t.totalDeduction)+'×15%=' + '<b>'+d(t.tax)+'</b>';
      return d(t.valueAdded)+'×60%-'+d(t.totalDeduction)+'×35%=' + '<b>'+d(t.tax)+'</b>';
    }), '增值额×税率-扣除额×速算扣除系数', true, '<b>'+d(sumTax)+'</b>']
  ];
  for (var ri = 0; ri < rows.length; ri++) {
    var rw = rows[ri];
    var bold = rw[4] || rw[3]; // bold if either flag set
    var total = rw.length > 4 ? rw[4] : rw[3]; // total in col 4 or col 3
    if (typeof total === 'boolean') total = '';
    var rowHtml = '<tr' + (bold ? ' style="font-weight:700"' : '') + '><td style="text-align:left;padding-left:6px">' + rw[0] + '</td>';
    for (var vi = 0; vi < rw[1].length; vi++) rowHtml += '<td>' + (rw[1][vi] !== '' ? rw[1][vi] : '-') + '</td>';
    rowHtml += '<td style="background:#FFFDE7;' + (bold ? 'font-weight:700' : '') + '">' + (total || '') + '</td></tr>';
    h += rowHtml;
  }
  h += '</table>';
  h += '</div>';

  container.innerHTML = h;
}

window.runDetailedLAT = runDetailedLAT;

// 敏感性分析用：按新的土地成本重算详细土增，返回总额
function recalcDetailedLatForLand(newLandPrice, newLandTax, landFeeTotal) {
  var result = window._lastResult;
  if (!result) return 0;
  var r = result;
  var resArea = r.resArea || 0, comArea = r.comArea || 0, totalFar = r.totalFar || 0, totalBuilding = r.totalBuilding || 0;
  var undergroundTotal = r.underground ? r.underground.total : 0;
  var basementArea = undergroundTotal || (totalBuilding - totalFar) || 0;
  var sptTotal = 0;
  if (r.schools) for (var si = 0; si < r.schools.length; si++) sptTotal += r.schools[si].area;
  if (r.customFacs) for (var ci = 0; ci < r.customFacs.length; ci++) sptTotal += r.customFacs[ci].area;
  var ordinaryResArea = window._detailedLatResult ? window._detailedLatResult.ordinaryResArea || 0 : 0;
  var nonOrdinaryResArea = window._detailedLatResult ? window._detailedLatResult.nonOrdinaryResArea || 0 : 0;
  if (!ordinaryResArea && !nonOrdinaryResArea) { ordinaryResArea = resArea; }
  var parkMode = window._parkModeForCalc || '3';
  var parkIncluded = (parkMode === '3' || parkMode === '4');
  var buildTotal = totalFar * getVal('price_build', 4000) / 10000;
  // 系数加权分摊（与主计算一致）
  var coefRes2 = window._savedCoefRes || getVal('coef_res', 1.00);
  var coefCom2 = window._savedCoefCom || getVal('coef_com', 1.00);
  var coefBsm2 = window._savedCoefBsm || getVal('coef_bsm', 1.00);
  var rawRes = totalBuilding > 0 ? (resArea + sptTotal) / totalBuilding * coefRes2 : 0;
  var rawCom = totalBuilding > 0 ? comArea / totalBuilding * coefCom2 : 0;
  var rawBsm = totalBuilding > 0 ? basementArea / totalBuilding * coefBsm2 : 0;
  var rawTotal = rawRes + rawCom + rawBsm;
  var buildRes = rawTotal > 0 ? rawRes / rawTotal * buildTotal : 0;
  var buildCom = rawTotal > 0 ? rawCom / rawTotal * buildTotal : 0;
  var buildBsm = rawTotal > 0 ? rawBsm / rawTotal * buildTotal : 0;
  if (parkMode === '1' || parkMode === '2') { buildBsm = 0; }
  var newLandTotal = totalFar * newLandPrice / 10000;
  var landExtra = getVal('land_extra', 0);
  var newLandCostTotal = newLandTotal + newLandTax + landFeeTotal + landExtra;
  var groundSalable = ordinaryResArea + nonOrdinaryResArea + comArea;
  var landOrdinary = groundSalable > 0 ? newLandCostTotal * ordinaryResArea / groundSalable : 0;
  var landNonOrdinary = groundSalable > 0 ? newLandCostTotal * nonOrdinaryResArea / groundSalable : 0;
  var landCom = groundSalable > 0 ? newLandCostTotal * comArea / groundSalable : 0;
  var landRemain = newLandCostTotal - landOrdinary - landNonOrdinary - landCom;
  if (ordinaryResArea + nonOrdinaryResArea > 0) {
    landOrdinary += landRemain * ordinaryResArea / (ordinaryResArea + nonOrdinaryResArea);
    landNonOrdinary += landRemain * nonOrdinaryResArea / (ordinaryResArea + nonOrdinaryResArea);
  }
  var buildOrdinary = (ordinaryResArea + nonOrdinaryResArea > 0) ? buildRes * ordinaryResArea / (ordinaryResArea + nonOrdinaryResArea) : 0;
  var buildNonOrdinary = (ordinaryResArea + nonOrdinaryResArea > 0) ? buildRes * nonOrdinaryResArea / (ordinaryResArea + nonOrdinaryResArea) : 0;
  var invoiceRate = getVal('invoice_rate', 90);
  var tempTypes = [];
  function calcOne(name, value, landCost, landOnly, buildCost, exempt20) {
    var vatSales = (value - landOnly) / 1.09 * 0.09;
    var vatInput = buildCost / 1.09 * 0.09 * invoiceRate / 100;
    var vatTax = Math.max(0, vatSales - vatInput);
    var taxExclusiveValue = value - vatSales; // 不含税收入
    var deductibleBuild = buildCost * invoiceRate / 100;
    var base = landCost + deductibleBuild, other = base * 0.10, extra = base * 0.20;
    var deductionNoSur = base + other + extra;
    var valueAddedNoSur = taxExclusiveValue - deductionNoSur;
    tempTypes.push({ name: name, value: value, taxExclusiveValue: taxExclusiveValue, landCost: landCost, buildCost: deductibleBuild, vatTax: vatTax, vatSales: vatSales, base: base, other: other, extra: extra, deductionNoSur: deductionNoSur, valueAddedNoSur: valueAddedNoSur, exempt20: exempt20 });
  }
  var priceRes = getVal('price_res', 6500), priceComBottom = getVal('price_com_bottom', 10000);
  var priceComCentral = getVal('price_com_central', 8000), priceComComplex = getVal('price_com_complex', 7000);
  var salableArea = resArea - getVal('res_unsalable', 0);
  if (salableArea < 0) salableArea = resArea;
  var resValue = salableArea * priceRes / 10000;
  var comBottomArea = comArea * getVal('com_bottom', 0) / 100, comCentralArea = comArea * getVal('com_central', 0) / 100;
  var comComplexArea = comArea * getVal('com_complex', 0) / 100;
  var comBottomValue = comBottomArea * priceComBottom / 10000 * getVal('sale_ratio_bottom', 100) / 100;
  var comCentralValue = comCentralArea * priceComCentral / 10000 * getVal('sale_ratio_central', 100) / 100;
  var comComplexValue = comComplexArea * priceComComplex / 10000 * getVal('sale_ratio_complex', 100) / 100;
  var comValue = comBottomValue + comCentralValue + comComplexValue;
  var total = 0;
  var ordinaryLandOnly = groundSalable > 0 ? newLandTotal * ordinaryResArea / groundSalable : 0;
  var nonOrdinaryLandOnly = groundSalable > 0 ? newLandTotal * nonOrdinaryResArea / groundSalable : 0;
  var comLandOnly = groundSalable > 0 ? newLandTotal * comArea / groundSalable : 0;
  if (ordinaryResArea > 0) calcOne('普通住宅', resValue * ordinaryResArea / salableArea, landOrdinary, ordinaryLandOnly, buildOrdinary, true);
  if (nonOrdinaryResArea > 0) calcOne('非普通住宅', resValue * nonOrdinaryResArea / salableArea, landNonOrdinary, nonOrdinaryLandOnly, buildNonOrdinary, false);
  calcOne('非住宅-商业', comValue, landCom, comLandOnly, buildCom, false);
  if (parkIncluded) calcOne('非住宅-车位', 0, 0, 0, buildBsm, false);

  // 附加税按不含税收入比分摊
  var totalVatAll = 0, totalTaxExclusiveAll = 0;
  for (var ti2 = 0; ti2 < tempTypes.length; ti2++) { totalVatAll += tempTypes[ti2].vatTax; totalTaxExclusiveAll += tempTypes[ti2].taxExclusiveValue; }
  var totalVatSur = totalVatAll * 0.12;
  var totalLat = 0;
  for (var tj = 0; tj < tempTypes.length; tj++) {
    var tt = tempTypes[tj];
    var allocSur = totalTaxExclusiveAll > 0 ? totalVatSur * (tt.taxExclusiveValue / totalTaxExclusiveAll) : 0;
    var totalDeduction = tt.deductionNoSur + allocSur;
    var valueAdded = tt.taxExclusiveValue - totalDeduction;
    var rate = totalDeduction > 0 ? valueAdded / totalDeduction * 100 : 0;
    if (valueAdded <= 0) continue;
    if (tt.exempt20 && rate <= 20) continue;
    if (rate <= 50) totalLat += Math.round(valueAdded * 0.30);
    else if (rate <= 100) totalLat += Math.round(valueAdded * 0.40 - totalDeduction * 0.05);
    else if (rate <= 200) totalLat += Math.round(valueAdded * 0.50 - totalDeduction * 0.15);
    else totalLat += Math.round(valueAdded * 0.60 - totalDeduction * 0.35);
  }
  return { lat: totalLat, vat: totalVatAll, vatSur: totalVatSur };
}
window.recalcDetailedLatForLand = recalcDetailedLatForLand;
