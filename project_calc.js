// 项目测算模块：测算表 + 税费 + 敏感性分析
// 独立文件，不影响 index.html 原有逻辑

function runProjectCalc() {
  var result = window._lastResult;
  if (!result) {  return; }

  var r = result;
  var l = r.land || {};
  var pp = r.population || {};
  var pk = r.parking || {};

  // === 从指标表读取面积 ===
  var resArea = r.resArea || 0;
  var comArea = r.comArea || 0;
  var totalFar = r.totalFar || 0;
  var totalBuilding = r.totalBuilding || 0;
  var buildLand = l.build_land || 0;
  var nonBuild = l.land_area - l.construction_land_area;

  // 商业拆分
  var comBottomPct = getVal('com_bottom', 0);
  var comCentralPct = getVal('com_central', 0);
  var comComplexPct = getVal('com_complex', 0);
  var comBottomArea = comArea * comBottomPct / 100;
  var comCentralArea = comArea * comCentralPct / 100;
  var comComplexArea = comArea * comComplexPct / 100;
  var remainingComArea = comArea - comBottomArea - comCentralArea - comComplexArea;

  // 配套面积
  var sptTotal = 0;
  var schList = r.schools || [];
  for (var si = 0; si < schList.length; si++) sptTotal += schList[si].area;
  var cfList = r.customFacs || [];
  for (var ci = 0; ci < cfList.length; ci++) sptTotal += cfList[ci].area;
  var dynF = typeof getFacilities === 'function' ? getFacilities(pp.population, totalFar, comArea, pp.units) : [];
  for (var di = 0; di < dynF.length; di++) sptTotal += dynF[di].area;

  var totalUnits = pp.units;
  var parkingCount = (r.underground && (r.underground.civilPark != null || r.underground.nonCivilPark != null))
    ? ((r.underground.civilPark || 0) + (r.underground.nonCivilPark || 0))
    : (pk.total || 0);
  var civilPark = r.underground ? (r.underground.civilPark || 0) : 0;
  var nonCivilPark = r.underground ? (r.underground.nonCivilPark || 0) : 0;
  var parkingValueCount = nonCivilPark;

  // 住宅不可售
  var resUnsalable = getVal('res_unsalable', 0);
  var unitUnsalable = getVal('unit_unsalable', 0);
  var unsalableUnits = unitUnsalable > 0 ? Math.round(resUnsalable / unitUnsalable) : 0;
  var salableArea = Math.max(0, resArea - resUnsalable);
  var salableUnits = Math.max(0, totalUnits - unsalableUnits);
  var monthlySales = getVal('monthly_sales', 30);
  var salesMonths = monthlySales > 0 ? Math.round(salableUnits / monthlySales) : 0;

  // === 读取价格输入 ===
  var priceRes = getVal('price_res', 7500);
  var priceComBottom = getVal('price_com_bottom', 10000);
  var priceComCentral = getVal('price_com_central', 0);
  var priceComComplex = getVal('price_com_complex', 0);
  var priceParking = getVal('price_parking', 30000);
  var priceLand = getVal('price_land', 1200);
  var priceBuild = getVal('price_build', 4000);
  var rateSales = getVal('rate_sales', 5);
  var rateManage = getVal('rate_manage', 2);
  // 前融成本
  var finLandTotal = getVal('fin_land_total', 0);
  var finLandCost = getVal('fin_land_cost', 0);
  var finLandYears = getVal('fin_land_years', 0);
  var finLandFee = finLandTotal * (finLandCost / 100) * finLandYears;
  var landTaxRate = getVal('land_tax_rate', 3); // 契税税率
  var landFeeRes = getVal('land_fee_res', 50); // 配套费住宅 元/㎡
  var landFeeCom = getVal('land_fee_com', 90); // 配套费商业 元/㎡

  // === 货值计算 ===
  var valueRes = salableArea * priceRes / 10000;
  var saleRatioBottom = getVal('sale_ratio_bottom', 100);
  var saleRatioCentral = getVal('sale_ratio_central', 100);
  var saleRatioComplex = getVal('sale_ratio_complex', 100);
  var valueComBottom = comBottomArea * priceComBottom / 10000 * saleRatioBottom / 100;
  var valueComCentral = comCentralArea * priceComCentral / 10000 * saleRatioCentral / 100;
  var valueComComplex = comComplexArea * priceComComplex / 10000 * saleRatioComplex / 100;
  var saleRatioPark = getVal('sale_ratio_park', 100);
  var parkSel = document.getElementById('park_mode_select');
  var parkMode = (parkSel ? parkSel.value : null) || window._parkModeForCalc || '1';
  window._parkModeForCalc = parkMode;
  // 1=销售无产权 2=赠送无产权 3=销售有产权 4=赠送有产权
  var parkIsSale = (parkMode === '1' || parkMode === '3');
  var parkIsGift = (parkMode === '2' || parkMode === '4');
  var parkHasRights = (parkMode === '3' || parkMode === '4');
  var parkNoDeduct = (parkMode === '2'); // 仅赠送无产权：所得税车位建安不得扣除
  // 赠送类：计税时住宅收入需拆分，测算表不收影响
  var parkGiftValue = 0;
  if (parkIsGift) {
    var giftPrice = getVal('park_gift_price', priceParking);
    parkGiftValue = parkingValueCount * giftPrice / 10000 * saleRatioPark / 100;
  }
  var valueParkingCalc = parkIsSale ? parkingValueCount * priceParking / 10000 * saleRatioPark / 100 : (parkIsGift ? parkGiftValue : 0);
  var valueParking = parkIsSale ? valueParkingCalc : 0; // 赠送类测算表不计车位收入
  if (parkIsSale && (!priceParking || priceParking === 0)) priceParking = 30000;
  var totalValue = valueRes + valueComBottom + valueComCentral + valueComComplex + valueParking;

  // === 成本计算 ===
  var landTotal = totalFar * priceLand / 10000;
  var landTax = landTotal * landTaxRate / 100;
  var landExtra = getVal('land_extra', 0);
  var landFeeTotal = (resArea * landFeeRes + comArea * landFeeCom) / 10000;
  var landCostTotal = landTotal + landTax + landFeeTotal + landExtra;
  var buildTotal = totalFar * priceBuild / 10000;
  var directCostTotal = landCostTotal + buildTotal;

  // 建安融资（依赖 buildTotal，需在成本计算之后）
  var finBuildRatio = getVal('fin_build_ratio', 50);
  var finBuildCost = getVal('fin_build_cost', 4);
  var finBuildYears = getVal('fin_build_years', 2);
  var finBuildFee = buildTotal * (finBuildRatio / 100) * (finBuildCost / 100) * finBuildYears;

  // === 费用计算 ===
  var salesFee = totalValue * rateSales / 100;
  var manageFee = totalValue * rateManage / 100;
  var eduFee = getVal('rate_edu', 0);
  var financeFee = finLandFee + finBuildFee;
  var feeTotal = salesFee + manageFee + financeFee + eduFee;

  // === 税费计算（Module 2） ===
  // 住宅与商业货值拆分
  var resValue = valueRes;
  var resValueTax = parkIsGift ? (resValue - parkGiftValue) : resValue; // 赠送类计税用拆分值
  if (resValueTax < 0) resValueTax = 0;
  var comValue = valueComBottom + valueComCentral + valueComComplex + valueParkingCalc;
  // 成本拆分（按计容面积比例）
  var resAreaRatio = totalFar > 0 ? resArea / totalFar : 0;
  var comAreaRatio = totalFar > 0 ? comArea / totalFar : 0;
  var resLandCost = landCostTotal * resAreaRatio;
  var comLandCost = landCostTotal * comAreaRatio;
  var resLandOnly = landTotal * resAreaRatio; // 不含契税的住宅土地成本
  var comLandOnly = landTotal * comAreaRatio;
  var resBuildCost = buildTotal * resAreaRatio;
  var comBuildCost = buildTotal * comAreaRatio;
  // 费用拆分（按货值比例）
  var resValueRatio = totalValue > 0 ? resValue / totalValue : 0;
  var comValueRatio = totalValue > 0 ? comValue / totalValue : 0;
  var resFeeTotal = feeTotal * resValueRatio;
  var comFeeTotal = feeTotal * comValueRatio;

  function calcLatTax(value, landCostTotal2, buildCost2, landOnly, buildOnly, surcharge, exempt20) {
    // 不含税收入 = 含税收入 - 销项税额（差额征税：销项=(含税收入-土地出让金)/1.09×9%）
    var landDeduct = landOnly || 0;
    var vatSales = (value - landDeduct) / 1.09 * 0.09;
    var taxExclusiveValue = value - vatSales;
    var base = landCostTotal2 + buildCost2;
    var other = base * 0.10;
    var extra = base * 0.20;
    var totalDeduction = base + other + extra + surcharge;
    var valueAdded = taxExclusiveValue - totalDeduction;
    var rate = totalDeduction > 0 ? valueAdded / totalDeduction * 100 : 0;
    var tax = 0, note = '';
    if (valueAdded <= 0) { note = '增值额≤0，不征税'; }
    else if (exempt20 && rate <= 20) { note = '增值率≤20%，免征'; }
    else if (rate <= 50) { tax = Math.round(valueAdded * 0.30); note = '税率30%'; }
    else if (rate <= 100) { tax = Math.round(valueAdded * 0.40 - totalDeduction * 0.05); note = '税率40%，速算扣除5%'; }
    else if (rate <= 200) { tax = Math.round(valueAdded * 0.50 - totalDeduction * 0.15); note = '税率50%，速算扣除15%'; }
    else { tax = Math.round(valueAdded * 0.60 - totalDeduction * 0.35); note = '税率60%，速算扣除35%'; }
    return { tax: tax, base: base, other: other, extra: extra, totalDeduction: totalDeduction, valueAdded: valueAdded, rate: rate, note: note };
  }

  // 住宅增值税
  var invoiceRate = getVal('invoice_rate', 90);
  var vatResSales = (resValueTax - resLandOnly) / 1.09 * 0.09;
  var vatResInput = resBuildCost / 1.09 * 0.09 * invoiceRate / 100;
  var vatRes = Math.max(0, vatResSales - vatResInput);
  // 商业增值税
  var vatComSales = (comValue - comLandOnly) / 1.09 * 0.09;
  var vatComInput = comBuildCost / 1.09 * 0.09 * invoiceRate / 100;
  var vatCom = Math.max(0, vatComSales - vatComInput);

  var vatTax = vatRes + vatCom;
  var vatSurchargeRes = vatRes * 0.12;
  var vatSurchargeCom = vatCom * 0.12;
  var vatSurcharge = vatSurchargeRes + vatSurchargeCom;

  // 土地增值税（住宅和商业分别计算，住宅适用20%免征）
  var latResDetail = calcLatTax(resValueTax, resLandCost, resBuildCost, resLandOnly, resBuildCost, vatSurchargeRes, true);
  var latComDetail = calcLatTax(comValue, comLandCost, comBuildCost, comLandOnly, comBuildCost, vatSurchargeCom, false);
  var latTax = latResDetail.tax + latComDetail.tax;

  // 印花税
  var stampTax = totalValue * 0.0005;

  // 企业所得税
  if (typeof runDetailedLAT === 'function') runDetailedLAT();
  var detailLat = window._detailedLatResult;
  var finalLatTax = (detailLat && detailLat.total != null) ? detailLat.total : latTax;
  // 统一用详细土增的增值税（避免简化版与详细版口径不一致）
  var finalVatTax = (detailLat && detailLat.totalVat != null) ? detailLat.totalVat : vatTax;
  var finalVatSurcharge = (detailLat && detailLat.totalVatSur != null) ? detailLat.totalVatSur : vatSurcharge;
  // 赠送类(2,4)：车位建安不得税前扣除
  var parkNotDeduct = (parkMode === '2' && detailLat) ? (detailLat.buildBsm || 0) : 0;
  var incomeCostTotal = directCostTotal - parkNotDeduct;
  // 利润总额 = 不含税收入 - 不含税成本 - 税金及附加 - 期间费用
  // 所得税：收入不含税，建安成本不含税（土地无增值税）
  var deductibleBuildCost = buildTotal - parkNotDeduct;
  var profitBeforeTax = totalValue / 1.09 - landCostTotal - deductibleBuildCost / 1.09 - finalVatSurcharge - finalLatTax - stampTax - feeTotal;
  var incomeTax = Math.max(0, profitBeforeTax * 0.25);

  var taxTotalDetail = Math.round(finalVatTax) + Math.round(finalVatSurcharge) + Math.round(finalLatTax) + Math.round(stampTax) + Math.round(incomeTax);
  var useEstTax = document.getElementById('use_est_tax');
  var estTaxRate = getVal('est_tax_rate', 8);
  var estTaxTotal = totalValue * estTaxRate / 100;
  var taxTotal = (useEstTax && useEstTax.checked) ? estTaxTotal : taxTotalDetail;
  var netProfit = totalValue - directCostTotal - feeTotal - taxTotal;
  var profitRate = totalValue > 0 ? netProfit / totalValue * 100 : 0;

  function getTempDetailedLat(inputId, tempValue) {
    var el = document.getElementById(inputId);
    if (!el || typeof runDetailedLAT !== 'function') return null;
    var oldValue = el.value;
    el.value = tempValue;
    runDetailedLAT();
    var detail = window._detailedLatResult;
    var snapshot = detail ? {
      total: detail.total,
      totalVat: detail.totalVat,
      totalVatSur: detail.totalVatSur,
      buildBsm: detail.buildBsm
    } : null;
    el.value = oldValue;
    return snapshot;
  }

  // === 辅助函数：临时改地价模拟完整计算链 ===
  function calcScenario(newLandPrice, newLandTax, newLandCostTotal, newDirectCost) {
    var nLat, nVatTax2, nVatSurcharge2;
    var tempDetail = getTempDetailedLat('price_land', newLandPrice);
    if (tempDetail) {
      nLat = tempDetail.total; nVatTax2 = tempDetail.totalVat || vatTax; nVatSurcharge2 = tempDetail.totalVatSur || vatSurcharge;
    } else if (typeof recalcDetailedLatForLand === 'function') {
      var r3 = recalcDetailedLatForLand(newLandPrice, newLandTax, landFeeTotal);
      nLat = r3.lat; nVatTax2 = r3.vat; nVatSurcharge2 = r3.vatSur;
    } else {
      nLat = latTax; nVatTax2 = vatTax; nVatSurcharge2 = vatSurcharge;
    }
    var nStampTax = totalValue * 0.0005;
    // 赠送类车位建安不得税前扣除（与主计算保持一致）
    var nParkNotDeduct = (parkMode === '2' && tempDetail) ? (tempDetail.buildBsm || 0) : ((parkMode === '2' && window._detailedLatResult) ? (window._detailedLatResult.buildBsm || 0) : 0);
    var nDeductBuild = (buildTotal - nParkNotDeduct) / 1.09;
    var nProfitBT = totalValue / 1.09 - newLandCostTotal - nDeductBuild - nVatSurcharge2 - nLat - nStampTax - feeTotal;
    var nIncomeTax = Math.max(0, nProfitBT * 0.25);
    var nTaxTD = Math.round(nVatTax2) + Math.round(nVatSurcharge2) + Math.round(nLat) + Math.round(nStampTax) + Math.round(nIncomeTax);
    var nTaxTotal = (useEstTax && useEstTax.checked) ? totalValue * estTaxRate / 100 : nTaxTD;
    var nNetProfit = totalValue - newDirectCost - feeTotal - nTaxTotal;
    var nProfitRate = totalValue > 0 ? nNetProfit / totalValue * 100 : 0;
    return { vat: nVatTax2, vatSur: nVatSurcharge2, lat: nLat, net: nNetProfit, rate: nProfitRate };
  }

  // === 敏感性分析：楼面价（Module 3）===
  var sensGroups = getVal('sens_groups', 5);
  var sensStep = getVal('sens_step', 100);
  var sensInputs = [];
  for (var sg = 1; sg <= sensGroups; sg++) {
    sensInputs.push(getVal('sens_d' + sg, -sg * sensStep));
    sensInputs.push(getVal('sens_u' + sg, sg * sensStep));
  }
  var sensValues = [0].concat(sensInputs).sort(function(a, b) { return a - b; });
  for (var si2 = 0; si2 < sensValues.length; si2++) {
    var change = sensValues[si2];
    var newLandPrice = priceLand + change;
    if (newLandPrice < 0) continue;
    var newLandTotal = totalFar * newLandPrice / 10000;
    var nNewLandCostTotal = newLandTotal + newLandTotal * landTaxRate / 100 + landFeeTotal + landExtra;
    var nResult = calcScenario(newLandPrice, newLandTotal * landTaxRate / 100, nNewLandCostTotal, nNewLandCostTotal + buildTotal);
    var nNetProfit = nResult.net;
    var nProfitRate = nResult.rate;

    sensValues[si2] = {
      change: change,
      landPrice: newLandPrice,
      landTotal: newLandTotal,
      netProfit: change === 0 ? netProfit : nNetProfit,
      profitRate: change === 0 ? profitRate : nProfitRate,
      rateChange: change === 0 ? 0 : nProfitRate - profitRate
    };
  }

  // === 敏感性分析：住宅均价 ===
  var prsGroups = getVal('prs_groups', 5);
  var prsStep = getVal('prs_step', 100);
  var priceResSens = [], priceResInputs = [];
  for (var pg = 1; pg <= prsGroups; pg++) {
    priceResInputs.push(getVal('prs_d' + pg, -pg * prsStep));
    priceResInputs.push(getVal('prs_u' + pg, pg * prsStep));
  }
  var priceResValues = [0].concat(priceResInputs).sort(function(a, b) { return a - b; });
  for (var pv = 0; pv < priceResValues.length; pv++) {
    var pChange = priceResValues[pv];
    var newPriceRes = priceRes + pChange;
    if (newPriceRes < 0) continue;
    var nValueRes = salableArea * newPriceRes / 10000;
    var nTotalValue = nValueRes + valueComBottom + valueComCentral + valueComComplex + valueParking;
    var nResValue = nTotalValue > 0 ? nValueRes / nTotalValue : 0;
    var nComValue = nTotalValue > 0 ? (valueComBottom + valueComCentral + valueComComplex + valueParking) / nTotalValue : 0;
    var nSalesFee = nTotalValue * rateSales / 100;
    var nManageFee = nTotalValue * rateManage / 100;
    var nFeeTotal = nSalesFee + nManageFee + financeFee + eduFee;
    // 住宅均价变动：土地成本不变，LAT不变，仅收入/VAT/费用变化
    // 覆写住宅均价→重算详细土增→读结果
    var resInput = document.getElementById('price_res');
    var savedRes = resInput ? resInput.value : priceRes;
    if (resInput) resInput.value = newPriceRes;
    if (typeof runDetailedLAT === 'function') runDetailedLAT();
    var sim2 = window._detailedLatResult;
    var nLat2 = sim2 ? sim2.total : finalLatTax;
    var nVat2 = sim2 ? (sim2.totalVat || vatTax) : vatTax;
    var nSur2 = sim2 ? (sim2.totalVatSur || vatSurcharge) : vatSurcharge;
    if (resInput) resInput.value = savedRes;
    var nStamp2 = nTotalValue * 0.0005;
    var nParkNotDeduct2 = (parkMode === '2' && sim2) ? (sim2.buildBsm || 0) : 0;
    var nDeductBuild2 = (buildTotal - nParkNotDeduct2) / 1.09;
    var nProfitBT2 = nTotalValue / 1.09 - landCostTotal - nDeductBuild2 - nSur2 - nLat2 - nStamp2 - nFeeTotal;
    var nIncome2 = Math.max(0, nProfitBT2 * 0.25);
    var nTaxTD2 = Math.round(nVat2) + Math.round(nSur2) + Math.round(nLat2) + Math.round(nStamp2) + Math.round(nIncome2);
    var nTax2 = (useEstTax && useEstTax.checked) ? nTotalValue * estTaxRate / 100 : nTaxTD2;
    var nNet = nTotalValue - directCostTotal - nFeeTotal - nTax2;
    var nRate = nTotalValue > 0 ? nNet / nTotalValue * 100 : 0;
    priceResSens.push({ change: pChange, price: newPriceRes, totalValue: pChange === 0 ? totalValue : nTotalValue, netProfit: pChange === 0 ? netProfit : nNet, profitRate: pChange === 0 ? profitRate : nRate, rateChange: pChange === 0 ? 0 : nRate - profitRate });
  }
  if (typeof runDetailedLAT === 'function') runDetailedLAT();

  // === 渲染 ===
  
  renderProjectCalc({
    summary: {
      resArea: resArea, comArea: comArea, totalFar: totalFar, totalBuilding: totalBuilding,
      totalUnits: totalUnits, parkingCount: parkingCount, buildLand: buildLand,
      comBottomArea: comBottomArea, comCentralArea: comCentralArea, comComplexArea: comComplexArea,
      sptTotal: sptTotal, nonBuild: nonBuild,
      resUnsalable: resUnsalable, unitUnsalable: unitUnsalable,
      unsalableUnits: unsalableUnits, salableArea: salableArea, salableUnits: salableUnits,
      monthlySales: monthlySales, salesMonths: salesMonths,
      civilPark: civilPark, nonCivilPark: nonCivilPark,
      priceRes: priceRes, priceComBottom: priceComBottom, priceComCentral: priceComCentral,
      priceComComplex: priceComComplex, priceParking: priceParking,
      saleRatioBottom: saleRatioBottom, saleRatioCentral: saleRatioCentral, saleRatioComplex: saleRatioComplex,
      saleRatioPark: saleRatioPark, parkIsSale: parkIsSale, parkIsGift: parkIsGift, parkGiftValue: parkGiftValue, parkMode: parkMode,
      priceLand: priceLand, priceBuild: priceBuild,
      rateSales: rateSales, rateManage: rateManage,
      finLandTotal: finLandTotal, finLandCost: finLandCost, finLandYears: finLandYears, finLandFee: finLandFee,
      finBuildRatio: finBuildRatio, finBuildCost: finBuildCost, finBuildYears: finBuildYears, finBuildFee: finBuildFee,
      eduFee: eduFee,
      valueRes: valueRes, valueComBottom: valueComBottom, valueComCentral: valueComCentral,
      valueComComplex: valueComComplex, valueParking: valueParking, totalValue: totalValue,
      landTotal: landTotal, landTax: landTax, landFeeTotal: landFeeTotal, landCostTotal: landCostTotal, landExtra: landExtra, sptTotal: sptTotal, resArea: resArea, comArea: comArea,
      buildTotal: buildTotal, directCostTotal: directCostTotal,
      landTaxRate: landTaxRate, landFeeRes: landFeeRes, landFeeCom: landFeeCom,
      salesFee: salesFee, manageFee: manageFee, financeFee: financeFee, feeTotal: feeTotal,
      useEstTax: useEstTax ? useEstTax.checked : false, estTaxRate: estTaxRate, estTaxTotal: estTaxTotal, invoiceRate: invoiceRate,
      vatTax: finalVatTax, vatSurcharge: finalVatSurcharge, latTax: finalLatTax,
      vatRes: vatRes, vatCom: vatCom, vatSurchargeRes: vatSurchargeRes, vatSurchargeCom: vatSurchargeCom,
      latRes: latResDetail.tax, latCom: latComDetail.tax,
      latResDetail: latResDetail, latComDetail: latComDetail,
      stampTax: stampTax, incomeTax: incomeTax, taxTotal: taxTotal, taxTotalDetail: taxTotalDetail,
      netProfit: netProfit, profitRate: profitRate, profitBeforeTax: profitBeforeTax
    },
    sensitivity: sensValues,
    priceResSens: priceResSens
  });
}

function renderProjectCalc(data) {
  
  var container = document.getElementById('projectCalcArea');
  if (!container) {
    var baArea = document.getElementById('buildingAnalysisArea');
    var target = baArea || document.getElementById('resultArea');
    console.log('renderProjectCalc: baArea=' + !!baArea + ' target=' + !!target + ' parent=' + (target ? !!target.parentNode : 'N/A'));
    if (!target || !target.parentNode) {  return; }
    container = document.createElement('div');
    container.id = 'projectCalcArea';
    target.parentNode.insertBefore(container, target.nextSibling);
    
  }
  

  var d = function(v) { if (v == null || isNaN(v)) return '-'; return v.toLocaleString('zh-CN', {maximumFractionDigits:0}); };
  var d1 = function(v) { if (v == null || isNaN(v)) return '-'; return v.toLocaleString('zh-CN', {maximumFractionDigits:1}); };
  var d2 = function(v) { if (v == null || isNaN(v)) return '-'; return v.toLocaleString('zh-CN', {maximumFractionDigits:2}); };
  var s = data.summary;
  var sens = data.sensitivity;
  var prs = data.priceResSens || [];

  // 获取项目名称
  var distNames = {nanming:'南明区',yunyan:'云岩区',guanshanhu:'观山湖区',huaxi:'花溪区',baiyun:'白云区',jingkai:'经开区',gaoxin:'高新区'};
  var distEl = document.getElementById('district');
  var dn = distEl && distNames[distEl.value] ? distNames[distEl.value] : '';
  var pnEl = document.getElementById('project_name');
  var pn = pnEl ? pnEl.value.trim() : '项目';
  var projTitle = dn + (dn && pn ? ' ' : '') + pn;

  var resPct = s.totalFar > 0 ? s.resArea / s.totalFar * 100 : 0;
  var comPct = s.totalFar > 0 ? s.comArea / s.totalFar * 100 : 0;
  var farVal = typeof getVal === 'function' ? getVal('far', 0) : 0;

  window._projectTaxSummary = s;
  window._projectSensitivityChartData = { floor: sens || [], res: prs || [], summary: s };

  var h = '<style>#projectCalcArea .bld-table td,#projectCalcArea .bld-table th{border:1px solid #c5c1bc;padding:3px 5px;vertical-align:middle;text-align:center}#projectCalcArea .bld-table th{font-weight:700}#projectCalcArea input[type=number]::-webkit-outer-spin-button,#projectCalcArea input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}#projectCalcArea input[type=number]{-moz-appearance:textfield}#projectCalcArea .tax-plan-btn,#projectCalcArea .tax-opt-btn,#projectCalcArea .shot-btn,#projectCalcArea .sens-chart-btn{border:1px solid #2563eb;background:#fff;color:#2563eb;border-radius:6px;padding:5px 12px;font-size:0.72rem;cursor:pointer}#projectCalcArea .tax-plan-btn:hover,#projectCalcArea .tax-opt-btn:hover,#projectCalcArea .shot-btn:hover,#projectCalcArea .sens-chart-btn:hover{background:#eff6ff}#projectCalcArea .tax-opt-btn{border-color:#d97706;color:#d97706}#projectCalcArea .tax-opt-btn:hover{background:#fffbeb}#projectCalcArea .shot-btn{border-color:#16a34a;color:#16a34a}#projectCalcArea .shot-btn:hover{background:#f0fdf4}#projectCalcArea .sens-chart-btn{border-color:#0f766e;color:#0f766e}#projectCalcArea .sens-chart-btn:hover{background:#f0fdfa}#projectCalcArea .tax-actions{margin-left:auto;display:flex;align-items:center;gap:8px;flex-shrink:0}@media (max-width:640px){#projectCalcArea .bld-table{min-width:760px;max-width:none}#projectCalcArea .bld-table td,#projectCalcArea .bld-table th{padding:3px 4px;font-size:0.68rem}#projectCalcArea .card h2{flex-wrap:wrap!important;align-items:flex-start!important}#projectCalcArea .tax-actions{margin-left:0;justify-content:flex-end;flex-wrap:wrap;width:100%}#projectCalcArea .card>div[style*="font-size:0.75rem"]{white-space:normal;line-height:2}#projectCalcArea .card>div[style*="font-size:0.75rem"] input{margin:2px 1px}}</style>';
  h += '<div class="card" id="projectMeasureCard" style="margin-top:0px">';
  h += '<h2 style="display:flex;align-items:center;gap:12px;justify-content:space-between;margin-top:0">项目测算<span style="display:flex;align-items:center;gap:8px"><button type="button" id="projectShotBtn" class="shot-btn" onclick="generateProjectMeasureImage()">生成测算简报</button></span></h2>';

  // ========== 模块一：测算表（严格按XML模板） ==========
  h += '<div style="overflow-x:auto">';
  h += '<table class="bld-table" style="width:100%;border-collapse:collapse;font-size:0.74rem;table-layout:fixed">';
  h += '<colgroup><col style="width:10%"><col style="width:12%"><col style="width:11%"><col style="width:7%"><col style="width:11%"><col style="width:11%"><col style="width:11%"><col style="width:auto"></colgroup>';
  // Row 1: 项目信息行
  h += '<tr style="background:#FCE4D6;font-weight:700">';
  h += '<td style="white-space:nowrap">项目名称：</td><td>' + escHtml(projTitle) + '</td>';
  h += '<td>容积率：</td><td>' + d1(farVal) + '</td>';
  h += '<td>住宅占比：</td><td>' + d1(resPct) + '%</td>';
  h += '<td>商业占比：</td><td>' + d1(comPct) + '%</td>';
  h += '</tr>';
  // Row 2: 列头
  h += '<tr style="background:#A6A6A6;color:#fff;font-weight:700">';
  h += '<th colspan="2">科目名称</th><th>指标<br>(㎡)</th><th>单位</th><th>面积占比</th><th>销售均价<br>(元)</th><th>货值<br>(万元)</th><th>备注</th>';
  h += '</tr>';

  // === 1、项目货值 ===
  var goodsRows = 8;
  var resNote = '共' + d(s.totalUnits) + '套（可售' + d(s.salableUnits) + '套），月均去化<input id="monthly_sales" type="number" value="' + s.monthlySales + '" style="width:45px;padding:1px 3px;font-size:0.68rem;text-align:center" onchange="runProjectCalc()">套，去化周期约' + d(s.salesMonths) + '月';
  var unsalableNote = '不可售，<input id="res_unsalable" type="number" value="' + s.resUnsalable + '" style="width:55px;padding:1px 3px;font-size:0.68rem;text-align:center" onchange="runProjectCalc()">㎡，户均<input id="unit_unsalable" type="number" value="' + s.unitUnsalable + '" style="width:55px;padding:1px 3px;font-size:0.68rem;text-align:center" onchange="runProjectCalc()">㎡/户，约' + d(s.unsalableUnits) + '户';
  var parkNote = '合计' + d(s.parkingCount) + '个车位（人防' + d(s.civilPark) + '个，非人防' + d(s.nonCivilPark) + '个）';
  h += '<tr style="font-weight:700;background:#EDEDED"><td colspan="2">1、项目货值</td><td>' + d(s.totalFar) + '</td><td>㎡</td><td>100%</td><td></td><td>' + d(s.totalValue) + '</td><td></td></tr>';
  h += subHead('其中', goodsRows);
  h += subItem('住宅（可售）', s.salableArea, '㎡', d1(s.totalFar > 0 ? s.salableArea/s.totalFar*100 : 0), 'price_res', s.priceRes, s.valueRes, resNote, true);
  h += subItem('住宅（不可售）', s.resUnsalable, '㎡', d1(s.totalFar > 0 ? s.resUnsalable/s.totalFar*100 : 0), '', '', '', unsalableNote, false, '', '');
  var noteBottom = '去化<input id="sale_ratio_bottom" type="number" value="' + s.saleRatioBottom + '" step="5" style="width:45px;padding:1px 3px;font-size:0.68rem;text-align:center" onchange="runProjectCalc()">%';
  var noteCentral = '去化<input id="sale_ratio_central" type="number" value="" placeholder="" step="5" style="width:45px;padding:1px 3px;font-size:0.68rem;text-align:center" onchange="runProjectCalc()">%';
  var noteComplex = '去化<input id="sale_ratio_complex" type="number" value="" placeholder="" step="5" style="width:45px;padding:1px 3px;font-size:0.68rem;text-align:center" onchange="runProjectCalc()">%';
  h += subItem('裙楼商业', s.comBottomArea, '㎡', d1(s.comBottomArea/s.totalFar*100), 'price_com_bottom', s.priceComBottom, s.valueComBottom, noteBottom, false);
  h += subItem('集中商业', s.comCentralArea, '㎡', d1(s.comCentralArea/s.totalFar*100), 'price_com_central', s.priceComCentral, s.valueComCentral, noteCentral, false);
  h += subItem('商业综合楼', s.comComplexArea, '㎡', d1(s.comComplexArea/s.totalFar*100), 'price_com_complex', s.priceComComplex, s.valueComComplex, noteComplex, false);
  h += subItem('计容配套', s.sptTotal, '㎡', d1(s.sptTotal/s.totalFar*100), '', '', '', '不可售', false);
  h += subItem('不计容配套', s.nonBuild, '㎡', '/', '', '', '', '不可售', false);
  // 车位（不在"其中"内）
  var parkModes = {'1':'销售无产权','2':'赠送无产权','3':'销售有产权','4':'赠送有产权'};
  var curParkMode = s.parkMode || '2';
  var parkSelect = '<select id="park_mode_select" onchange="window._parkModeForCalc=this.value;runProjectCalc();runDetailedLAT()" style="font-size:0.65rem;padding:1px;width:auto">';
  for (var pk in parkModes) parkSelect += '<option value="' + pk + '"' + (curParkMode === pk ? ' selected' : '') + '>' + parkModes[pk] + '</option>';
  parkSelect += '</select>';
  var parkGiftNote = s.parkIsGift ? '<span class="park-gift-price-note"> 公允价值<input id="park_gift_price" type="number" value="' + getVal('park_gift_price', s.priceParking || 30000) + '" style="width:65px;padding:1px 3px;font-size:0.68rem;text-align:center" onchange="runProjectCalc()">元/个</span>' : '';
  var parkNoteFull = parkNote + ' 非人防去化<input id="sale_ratio_park" type="number" value="' + s.saleRatioPark + '" step="5" style="width:45px;padding:1px 3px;font-size:0.68rem;text-align:center" onchange="runProjectCalc()">%，' + parkSelect + parkGiftNote;
  h += '<tr><td colspan="1" style="text-align:left;padding-left:8px">车位</td><td>' + d(s.parkingCount) + '</td><td>个</td><td>/</td><td><input id="price_parking" type="number" value="' + (s.parkIsSale ? (s.priceParking || '') : '') + '" style="width:80px;padding:2px 4px;font-size:0.72rem;text-align:center" onchange="runProjectCalc()"></td><td>' + (s.parkIsSale ? (s.valueParking ? d(s.valueParking) : '-') : '-') + '</td><td style="font-size:0.7rem;color:var(--muted);text-align:left">' + parkNoteFull + '</td></tr>';

  // === 2、项目直接成本 ===
  var costRows = 3;
  var costNote = s.totalValue > 0 ? '占总货值' + d1(s.directCostTotal/s.totalValue*100) + '%' : '';
  h += '<tr style="font-weight:700;background:#EDEDED"><td colspan="2">2、项目直接成本</td><td></td><td></td><td>货值占比</td><td>成本单方</td><td>' + d(s.directCostTotal) + '</td><td style="font-size:0.7rem;color:var(--muted)">' + costNote + '</td></tr>';
  h += subHead('其中', costRows);
  var landFloorPrice = s.totalFar > 0 ? Math.round(s.landCostTotal * 10000 / s.totalFar) : 0;
  var landNote = '①含契税<input id="land_tax_rate" type="number" value="' + s.landTaxRate + '" step="0.5" style="width:42px;padding:1px 3px;font-size:0.68rem;text-align:center" onchange="runProjectCalc()">%(' + d(s.landTax) + '万)';
  landNote += ' <br>②含配套费：住宅<input id="land_fee_res" type="number" value="' + s.landFeeRes + '" style="width:42px;padding:1px 3px;font-size:0.68rem;text-align:center" onchange="runProjectCalc()">元/㎡，商业<input id="land_fee_com" type="number" value="' + s.landFeeCom + '" style="width:42px;padding:1px 3px;font-size:0.68rem;text-align:center" onchange="runProjectCalc()">元/㎡(' + d(s.landFeeTotal) + '万)';
  var landExtraVal = getVal('land_extra', 0);
  landNote += ' <br>③补缴土地款<input id="land_extra" type="number" value="' + landExtraVal + '" style="width:70px;padding:1px 3px;font-size:0.68rem;text-align:center" onchange="runProjectCalc()">万元';
  landNote += ' <br>④确权土地成本' + d(s.landTotal) + '万元，合计后楼面价' + d(landFloorPrice) + '元/㎡';
  h += '<tr><td style="text-align:left;padding-left:8px">2.1、土地成本</td>';
  h += '<td>' + d(s.totalFar) + '</td><td>㎡</td>';
  h += '<td>' + d1(s.landCostTotal/s.totalValue*100) + '%</td>';
  h += '<td><input id="price_land" type="number" value="' + s.priceLand + '" style="width:80px;padding:2px 4px;font-size:0.72rem;text-align:center" onchange="runProjectCalc()"></td>';
  h += '<td>' + d(s.landCostTotal) + '</td>';
  h += '<td style="font-size:0.63rem;color:var(--muted);text-align:left">' + landNote + '</td></tr>';
  var buildUnitNote = s.totalBuilding > 0 ? '建面单方' + d(Math.round(s.buildTotal * 10000 / s.totalBuilding)) + '元/㎡' : '';
  h += costItem('2.2、建安成本', s.totalFar, '㎡', d1(s.buildTotal/s.totalValue*100), 'price_build', s.priceBuild, s.buildTotal, buildUnitNote, false);

  // === 3、项目费用 ===
  var feeRows = 5;
  var feeTotal = s.feeTotal + s.taxTotal;
  h += '<tr style="font-weight:700;background:#EDEDED"><td colspan="2">3、项目费用</td><td></td><td></td><td></td><td>成本单方</td><td id="proj_fee_total_val">' + d(feeTotal) + '</td><td></td></tr>';
  h += subHead('其中', feeRows);
  var unitSales = s.totalFar > 0 ? Math.round(s.salesFee * 10000 / s.totalFar) : 0;
  var unitManage = s.totalFar > 0 ? Math.round(s.manageFee * 10000 / s.totalFar) : 0;
  var unitFinance = s.totalFar > 0 ? Math.round(s.financeFee * 10000 / s.totalFar) : 0;
  var unitTax = s.totalFar > 0 ? Math.round(s.taxTotal * 10000 / s.totalFar) : 0;
  h += feeItem('3.1、销售费用', d(s.totalValue), d1(s.salesFee/s.totalValue*100), 'rate_sales', s.rateSales, s.salesFee, unitSales, '货值×费率', true);
  h += feeItem('3.2、管理费用', d(s.totalValue), d1(s.manageFee/s.totalValue*100), 'rate_manage', s.rateManage, s.manageFee, unitManage, '货值×费率', false);
  var finNote = '①前融成本：总额<input id="fin_land_total" type="number" value="' + s.finLandTotal + '" step="1000" style="width:55px;padding:1px 3px;font-size:0.68rem;text-align:center" onchange="runProjectCalc()">万元×成本<input id="fin_land_cost" type="number" value="' + s.finLandCost + '" step="0.5" style="width:42px;padding:1px 3px;font-size:0.68rem;text-align:center" onchange="runProjectCalc()">%×<input id="fin_land_years" type="number" value="' + s.finLandYears + '" step="0.5" style="width:38px;padding:1px 3px;font-size:0.68rem;text-align:center" onchange="runProjectCalc()">年=' + d(s.finLandFee) + '万';
  finNote += ' <br>②开发贷成本：建安<input id="fin_build_ratio" type="number" value="' + s.finBuildRatio + '" step="5" style="width:42px;padding:1px 3px;font-size:0.68rem;text-align:center" onchange="runProjectCalc()">%×成本<input id="fin_build_cost" type="number" value="' + s.finBuildCost + '" step="0.5" style="width:38px;padding:1px 3px;font-size:0.68rem;text-align:center" onchange="runProjectCalc()">%×<input id="fin_build_years" type="number" value="' + s.finBuildYears + '" step="0.5" style="width:38px;padding:1px 3px;font-size:0.68rem;text-align:center" onchange="runProjectCalc()">年=' + d(s.finBuildFee) + '万';
  h += '<tr><td style="text-align:left;padding-left:8px">3.3、财务费用</td>';
  h += '<td>' + d(s.totalValue) + '</td><td>万元</td>';
  h += '<td>' + (s.totalValue > 0 ? d1(s.financeFee/s.totalValue*100) : '0') + '%</td>';
  h += '<td>' + d(unitFinance) + '</td>';
  h += '<td>' + d(s.financeFee) + '</td>';
  h += '<td style="font-size:0.63rem;color:var(--muted);text-align:left">' + finNote + '</td></tr>';
  h += '<tr><td style="text-align:left;padding-left:8px">3.4、相关税费</td>';
  h += '<td>' + d(s.totalValue) + '</td><td>万元</td>';
  h += '<td id="proj_tax_pct">' + (s.totalValue > 0 ? d1(s.taxTotal/s.totalValue*100) : '0') + '%</td>';
  h += '<td id="proj_tax_unit">' + d(unitTax) + '</td>';
  h += '<td id="proj_tax_val">' + d(s.taxTotal) + '</td>';
  h += '<td style="font-size:0.68rem;color:var(--muted);text-align:left">后续根据税筹方式进行调整</td></tr>';
  var unitEdu = s.totalFar > 0 ? Math.round(s.eduFee * 10000 / s.totalFar) : 0;
  h += '<tr><td style="text-align:left;padding-left:8px">3.5、教育配套费</td>';
  h += '<td>' + d(s.totalValue) + '</td><td>万元</td>';
  h += '<td>' + (s.totalValue > 0 ? d1(s.eduFee/s.totalValue*100) : '0') + '%</td>';
  h += '<td>' + d(unitEdu) + '</td>';
  h += '<td>' + d(s.eduFee) + '</td>';
  h += '<td style="font-size:0.68rem;text-align:left"><input id="rate_edu" type="number" value="' + s.eduFee + '" step="100" style="width:70px;padding:1px 3px;font-size:0.68rem;text-align:center" onchange="runProjectCalc()"> 万元</td></tr>';

  // === 4、项目利润 ===
  h += '<tr style="font-weight:700;background:#EDEDED"><td colspan="2">4、项目利润</td><td></td><td></td><td></td><td></td><td id="proj_net_profit_val" style="color:' + (s.netProfit >= 0 ? 'var(--green)' : 'var(--red)') + '">' + d(s.netProfit) + '</td><td></td></tr>';
  h += '<tr><td colspan="2">利润率</td><td></td><td></td><td></td><td></td><td id="proj_profit_rate_val" style="font-weight:700;color:' + (s.profitRate >= 0 ? 'var(--green)' : 'var(--red)') + '">' + d2(s.profitRate) + '%</td><td style="text-align:left">净利润/货值</td></tr>';

  h += '</tbody></table></div>';

  // ========== 模块二：税费测算（独立卡片） ==========
  h += '</div>'; // 关闭测算表卡片
  h += '<div class="card" style="margin-top:12px">';
  h += '<h2 style="display:flex;align-items:center;gap:12px;margin-bottom:14px"><span>税费测算</span><span style="font-weight:400;font-size:0.7rem;color:var(--muted);margin-right:12px;"><input id="use_est_tax" type="checkbox" onchange="runProjectCalc()"' + (s.useEstTax ? ' checked' : '') + '>  采用预估税率<input id="est_tax_rate" type="number" value="' + s.estTaxRate + '" step="0.5" style="width:45px;padding:1px 3px;font-size:0.7rem;text-align:center" onchange="runProjectCalc()">%计算项目税额</span><span class="tax-actions"><button type="button" class="tax-plan-btn" onclick="showTaxPlanningAdvice()">税筹建议</button><button type="button" class="tax-opt-btn" onclick="showTaxOptimization()">模拟优化</button></span></h2>';
  h += '<div style="overflow-x:auto">';
  h += '<table class="bld-table" style="width:100%;border-collapse:collapse;font-size:0.74rem">';
  h += '<thead><tr style="background:#A6A6A6;color:#fff"><th>税种</th><th>计算过程</th><th style="width:120px">金额(万元)</th><th style="width:100px">占货值比</th></tr></thead><tbody>';

  h += taxRow('增值税', '销项税额 - 进项税额', s.vatTax, s.vatTax/s.totalValue*100, 'tax_vat_val', 'tax_vat_pct');
  h += taxRow('增值税附加', '增值税 × 12%', s.vatSurcharge, s.vatSurcharge/s.totalValue*100, 'tax_sur_val', 'tax_sur_pct');
  var dl3 = window._detailedLatResult;
  var displayLatTax = (dl3 && dl3.total != null) ? dl3.total : s.latTax;
  h += '<tr><td style="font-weight:600">土地增值税</td><td style="font-size:0.7rem;color:var(--muted)">取自详细土增计算</td><td style="text-align:center" id="tax_lat_val">' + d(displayLatTax) + '</td><td style="text-align:center" id="tax_lat_pct">' + d1(displayLatTax/s.totalValue*100) + '%</td></tr>';
  h += taxRow('印花税', '货值' + d(s.totalValue) + ' × 0.05%', s.stampTax, s.stampTax/s.totalValue*100, 'tax_stamp_val', 'tax_stamp_pct');
  h += taxRow('企业所得税', '利润总额 × 25%', s.incomeTax, s.incomeTax/s.totalValue*100, 'tax_income_val', 'tax_income_pct');
  var detailTaxDisplay = Math.round(s.vatTax) + Math.round(s.vatSurcharge) + Math.round(displayLatTax) + Math.round(s.stampTax) + Math.round(s.incomeTax);
  var totalTaxDisplay = detailTaxDisplay;
  h += '<tr style="font-weight:700;background:#FFFF00"><td>税费合计</td><td></td><td style="text-align:center"><span id="tax_total_val">' + d(totalTaxDisplay) + '</span><span id="tax_total_val_delta" style="' + estimateTaxDeltaStyle(s.useEstTax, s.estTaxTotal - totalTaxDisplay) + '">' + estimateTaxAmountDeltaText(s.useEstTax, totalTaxDisplay, s.estTaxTotal) + '</span></td><td style="text-align:center"><span id="tax_total_pct">' + d1(totalTaxDisplay/s.totalValue*100) + '%</span><span id="tax_total_pct_delta" style="' + estimateTaxDeltaStyle(s.useEstTax, s.estTaxRate - (s.totalValue > 0 ? totalTaxDisplay / s.totalValue * 100 : 0)) + '">' + estimateTaxRateDeltaText(s.useEstTax, totalTaxDisplay, s.estTaxRate, s.totalValue) + '</span></td></tr>';
  h += '';

  h += '</tbody></table></div>';

  // 税费计算说明
  var dl2 = window._detailedLatResult;
  var parkMode2 = s.parkMode || '1';
  var isSale = (parkMode2 === '1' || parkMode2 === '3');
  var isGift = (parkMode2 === '2' || parkMode2 === '4');
  var hasRights = (parkMode2 === '3' || parkMode2 === '4');
  var modeNames = {'1':'销售无产权','2':'赠送无产权','3':'销售有产权','4':'赠送有产权'};
  var modeDesc = isGift ? '车位无实际收款，按公允价值确认视同销售收入' : '购房合同+车位使用权合同（有价款）';
  if (hasRights) modeDesc = isGift ? '车位无实际收款，按公允价值确认视同销售收入，有产权车位可扣建安成本' : '增加补土成本，有产权车位可扣建安成本';
  var resRevTax = isGift ? s.valueRes - (s.parkGiftValue || 0) : s.valueRes;
  if (resRevTax < 0) resRevTax = 0;
  var landOnly = s.landTotal;
  var resLandDeduct = s.totalFar > 0 ? landOnly * (s.resArea + (s.sptTotal || 0)) / s.totalFar : 0;
  var comLandDeduct = s.totalFar > 0 ? landOnly * s.comArea / s.totalFar : 0;
  var resVatSales = Math.round((resRevTax - resLandDeduct) / 1.09 * 0.09);
  var comVatSales = Math.round((s.valueComBottom + s.valueComCentral + s.valueComComplex - comLandDeduct) / 1.09 * 0.09);
  var parkVatSales = Math.round((s.valueParking || (s.parkGiftValue || 0)) / 1.09 * 0.09);
  var vatInputVal = Math.round(s.buildTotal / 1.09 * 0.09 * (s.invoiceRate || 90) / 100);
  var explainLat = (dl2 && dl2.total != null) ? dl2.total : s.latTax;
  var bsmNotDeduct = (parkMode2 === '2' && dl2) ? (dl2.buildBsm || 0) : 0;
  var explainCost = s.landCostTotal + Math.round(s.buildTotal / 1.09) - Math.round(bsmNotDeduct / 1.09);

  h += '<div style="margin-top:8px;font-size:0.68rem;color:var(--muted);line-height:1.6">';
  h += '<b>计算说明（' + (modeNames[parkMode2] || '销售无产权') + '）：' + modeDesc + '</b></div>';
  h += '<div style="display:flex;gap:24px;margin-top:4px;font-size:0.68rem;color:var(--muted);line-height:1.6">';
  // 左侧：收入构成 + 成本分摊 + 增值税及附加
  h += '<div style="flex:1">';
  h += '<b>▎收入构成</b><br>';
  h += '&nbsp;&nbsp;住宅含税收入：' + d(resRevTax) + '万' + (isGift ? '（' + d(s.valueRes) + ' - ' + d(s.parkGiftValue||0) + '，从住宅总价中拆分出车位价值）' : '') + '<br>';
  h += '&nbsp;&nbsp;商业含税收入：' + d(s.valueComBottom + s.valueComCentral + s.valueComComplex) + '万<br>';
  h += '&nbsp;&nbsp;车位含税' + (isGift ? '视同销售' : '') + '收入：' + d(s.parkGiftValue || s.valueParking) + '万' + (isGift ? '（公允价值）' : '') + '<br>';
  var comValueTotal = s.valueComBottom + s.valueComCentral + s.valueComComplex;
  var parkValueExplain = s.parkGiftValue || s.valueParking;
  var totalTaxInclusive = resRevTax + comValueTotal + parkValueExplain;
  h += '&nbsp;&nbsp;不含税收入合计=(' + d(resRevTax) + '+' + d(comValueTotal) + '+' + d(parkValueExplain) + ')÷1.09=' + d(totalTaxInclusive / 1.09) + '万<br>';
  h += '<b>▎成本分摊</b><br>';
  h += '&nbsp;&nbsp;土地总成本=摘牌地价' + d(landOnly) + '+契税' + d(s.landTax||0) + '+配套费' + d(s.landFeeTotal||0) + '+补缴' + d(s.landExtra||0) + '=' + d(s.landCostTotal) + '万<br>';
  h += '&nbsp;&nbsp;土地成本仅地上可售面积分摊：车位=0<br>';
  if (dl2 && dl2.buildBsm != null) {
    h += '&nbsp;&nbsp;建安成本按总可售面积比分摊：住宅' + d(dl2.buildRes) + '万，商业' + d(dl2.buildCom) + '万，车位' + d(dl2.buildBsm) + '万<br>';
    if (isGift) h += '&nbsp;&nbsp;赠送类：车位建安成本' + d(dl2.buildBsm) + '万并入住宅成本，但所得税不得税前扣除<br>';
  }
  h += '<b>▎增值税及附加</b><br>';
  h += '&nbsp;&nbsp;住宅销项=(' + d(resRevTax) + '-' + d(resLandDeduct) + ')÷1.09×9%=' + d(resVatSales) + '万<br>';
  h += '&nbsp;&nbsp;商业销项=(' + d(s.valueComBottom + s.valueComCentral + s.valueComComplex) + '-' + d(comLandDeduct) + ')÷1.09×9%=' + d(comVatSales) + '万<br>';
  h += '&nbsp;&nbsp;车位销项=' + d(s.parkGiftValue || s.valueParking) + '÷1.09×9%=' + d(parkVatSales) + '万（不得差额扣除）<br>';
  h += '&nbsp;&nbsp;进项=建安' + d(s.buildTotal) + '/1.09×9%×取票率' + d(s.invoiceRate||90) + '%=' + d(vatInputVal) + '万（取票率<input id="invoice_rate" type="number" value="' + (s.invoiceRate || 90) + '" step="5" max="100" style="width:42px;padding:1px 3px;font-size:0.68rem;text-align:center" onchange="runProjectCalc()">%）<br>';
  h += '&nbsp;&nbsp;应交增值税=(' + d(resVatSales) + '+' + d(comVatSales) + '+' + d(parkVatSales) + '-' + d(vatInputVal) + ')=' + d(s.vatTax) + '万<br>';
  h += '&nbsp;&nbsp;增值税附加=' + d(s.vatTax) + '×12%=' + d(s.vatSurcharge) + '万<br>';
  h += '</div>';
  // 右侧：土地增值税 + 印花税 + 企业所得税 + 税费合计
  h += '<div style="flex:1.1">';
  h += '<b>▎土地增值税</b>（详见下方"详细土增计算"表）：土增合计=<span id="explain_lat_val">' + d(explainLat) + '</span>万<br>';
  h += '<b>▎印花税</b> = ' + d(s.totalValue/1.09) + '×0.05%=' + d(s.stampTax) + '万<br>';
  h += '<b>▎企业所得税</b><br>';
  h += '&nbsp;&nbsp;营业收入(不含税)=' + d(s.totalValue/1.09) + '万<br>';
  h += '&nbsp;&nbsp;营业成本=土地' + d(s.landCostTotal) + '+不含税建安' + d(Math.round(s.buildTotal/1.09)) + (bsmNotDeduct > 0 ? '-车位建安不得扣除' + d(Math.round(bsmNotDeduct/1.09)) : '') + '=' + d(explainCost) + '万<br>';
  h += '&nbsp;&nbsp;税金及附加=附加' + d(s.vatSurcharge) + '+土增' + d(explainLat) + '+印花税' + d(s.stampTax) + '=' + d(s.vatSurcharge + explainLat + s.stampTax) + '万<br>';
  h += '&nbsp;&nbsp;利润总额=' + d(s.profitBeforeTax) + '万<br>';
  h += '&nbsp;&nbsp;所得税=' + d(s.profitBeforeTax) + '×25%=' + d(s.incomeTax) + '万<br>';
  var rVat = Math.round(s.vatTax), rSur = Math.round(s.vatSurcharge), rLat = Math.round(explainLat), rStp = Math.round(s.stampTax), rInc = Math.round(s.incomeTax);
  h += '<b>▎税费合计</b> = 增值税' + d(rVat) + '+附加' + d(rSur) + '+土增' + d(rLat) + '+印花税' + d(rStp) + '+所得税' + d(rInc) + '=<span id="explain_tax_total">' + d(rVat + rSur + rLat + rStp + rInc) + '</span>万<br>';
  h += '</div>';
  h += '</div>';

  // 详细土增计算（由 detailed_lat.js 渲染）
  h += '<div id="detailedLatInline"></div>';
  h += '</div>'; // 关闭税费卡片

  // ========== 模块三：敏感性分析（独立卡片） ==========
  h += '<div class="card" style="margin-top:12px">';
  h += '<h2 style="display:flex;align-items:center;gap:12px;justify-content:space-between;flex-wrap:wrap;margin-top:0"><span>敏感性分析<span style="font-size:0.7rem;font-weight:400;color:var(--muted)">    楼面价变化</span></span><button type="button" class="sens-chart-btn" onclick="showSensitivityChartModal()">敏感性分析图表</button></h2>';
  h += '<div style="margin-bottom:8px;font-size:0.75rem;color:var(--muted)">';
  var sg2 = getVal('sens_groups', 5);
  h += '变化值：';
  for (var sd = sg2; sd >= 1; sd--) h += '<input id="sens_d' + sd + '" type="number" value="' + getVal('sens_d' + sd, -sd * 100) + '" step="50" style="width:55px;padding:2px 4px;font-size:0.7rem;text-align:center" onchange="runProjectCalc()">';
  h += ' <b>0</b>';
  for (var su = 1; su <= sg2; su++) h += '<input id="sens_u' + su + '" type="number" value="' + getVal('sens_u' + su, su * 100) + '" step="50" style="width:55px;padding:2px 4px;font-size:0.7rem;text-align:center" onchange="runProjectCalc()">';
  h += ' 元/㎡ 步长<input id="sens_step" type="number" value="' + getVal('sens_step', 100) + '" step="10" style="width:50px;padding:1px 3px;font-size:0.65rem;text-align:center" onchange="applySensStep(\'sens\')">';
  h += ' 组数<select id="sens_groups" onchange="applySensStep(\'sens\')" style="font-size:0.65rem;padding:1px;width:auto;min-width:0">';
  for (var go = 3; go <= 10; go++) h += '<option value="' + go + '"' + (sg2 === go ? ' selected' : '') + '>' + go + '组</option>';
  h += '</select></div>';

  h += '<div style="overflow-x:auto">';
  h += '<table class="bld-table" style="width:100%;border-collapse:collapse;font-size:0.74rem">';
  h += '<thead><tr style="background:#A6A6A6;color:#fff">';
  h += '<th>楼面价变化</th><th>土地单方(元/㎡)</th><th>土地总价(万元)<br><span style="font-weight:400;font-size:0.65rem">楼面价×计容面积</span></th><th>净利润(万元)</th><th>利润率</th><th>利润率变化</th>';
  h += '</tr></thead><tbody>';

  for (var si = 0; si < sens.length; si++) {
    var sn = sens[si];
    var isBase = sn.change === 0;
    var label = sn.change === 0 ? '起始价' : (sn.change > 0 ? '+' + sn.change : '' + sn.change);
    var changeColor = sn.rateChange >= 0 ? 'var(--green)' : 'var(--red)';
    h += '<tr' + (isBase ? ' style="font-weight:700;background:#FCE4D6"' : '') + '>';
    h += '<td style="text-align:center">' + label + '</td>';
    h += '<td style="text-align:center">' + d(sn.landPrice) + '</td>';
    h += '<td style="text-align:center">' + d(sn.landTotal) + '</td>';
    h += '<td style="text-align:center;color:' + (sn.netProfit >= 0 ? 'var(--green)' : 'var(--red)') + '">' + d(sn.netProfit) + '</td>';
    h += '<td style="text-align:center">' + d2(sn.profitRate) + '%</td>';
    h += '<td style="text-align:center;color:' + changeColor + '">' + (sn.rateChange >= 0 ? '↑' : '↓') + d2(Math.abs(sn.rateChange)) + '%</td>';
    h += '</tr>';
  }

  h += '</tbody></table></div>';

  // === 住宅均价敏感性 ===
  h += '<h2 style="margin-top:16px">敏感性分析<span style="font-size:0.7rem;font-weight:400;color:var(--muted)">    住宅均价变化</span></h2>';
  h += '<div style="margin-bottom:8px;font-size:0.75rem;color:var(--muted)">';
  var pg2 = getVal('prs_groups', 5);
  h += '变化值：';
  for (var pd = pg2; pd >= 1; pd--) h += '<input id="prs_d' + pd + '" type="number" value="' + getVal('prs_d' + pd, -pd * 100) + '" step="50" style="width:55px;padding:2px 4px;font-size:0.7rem;text-align:center" onchange="runProjectCalc()">';
  h += ' <b>0</b>';
  for (var pu = 1; pu <= pg2; pu++) h += '<input id="prs_u' + pu + '" type="number" value="' + getVal('prs_u' + pu, pu * 100) + '" step="50" style="width:55px;padding:2px 4px;font-size:0.7rem;text-align:center" onchange="runProjectCalc()">';
  h += ' 元/㎡ 步长<input id="prs_step" type="number" value="' + getVal('prs_step', 100) + '" step="10" style="width:50px;padding:1px 3px;font-size:0.65rem;text-align:center" onchange="applySensStep(\'prs\')">';
  h += ' 组数<select id="prs_groups" onchange="applySensStep(\'prs\')" style="font-size:0.65rem;padding:1px;width:auto;min-width:0">';
  for (var go2 = 3; go2 <= 10; go2++) h += '<option value="' + go2 + '"' + (pg2 === go2 ? ' selected' : '') + '>' + go2 + '组</option>';
  h += '</select></div>';
  h += '<div style="overflow-x:auto">';
  h += '<table class="bld-table" style="width:100%;border-collapse:collapse;font-size:0.74rem;table-layout:fixed">';
  h += '<thead><tr style="background:#A6A6A6;color:#fff">';
  h += '<th>住宅均价变化</th><th>住宅均价(元/㎡)</th><th>总货值(万元)</th><th>净利润(万元)</th><th>利润率</th><th>利润率变化</th>';
  h += '</tr></thead><tbody>';
  for (var pj = 0; pj < prs.length; pj++) {
    var pn = prs[pj];
    var isBase = pn.change === 0;
    var label = pn.change === 0 ? '住宅均价' : (pn.change > 0 ? '+' + pn.change : '' + pn.change);
    var chColor = pn.rateChange >= 0 ? 'var(--green)' : 'var(--red)';
    h += '<tr' + (isBase ? ' style="font-weight:700;background:#FCE4D6"' : '') + '>';
    h += '<td style="text-align:center">' + label + '</td>';
    h += '<td style="text-align:center">' + d(pn.price) + '</td>';
    h += '<td style="text-align:center">' + d(pn.totalValue) + '</td>';
    h += '<td style="text-align:center;color:' + (pn.netProfit >= 0 ? 'var(--green)' : 'var(--red)') + '">' + d(pn.netProfit) + '</td>';
    h += '<td style="text-align:center">' + d2(pn.profitRate) + '%</td>';
    h += '<td style="text-align:center;color:' + chColor + '">' + (pn.rateChange >= 0 ? '↑' : '↓') + d2(Math.abs(pn.rateChange)) + '%</td>';
    h += '</tr>';
  }
  h += '</table></div>';

  h += '</div>'; // card

  // 保存DOM销毁前的有效系数，供详细土增重算使用
  // 保存有效系数到全局，避免DOM销毁后详细土增重算不一致
  container.innerHTML = h;
  if (typeof runDetailedLAT === 'function') {
    runDetailedLAT();
    // 用详细土增重算后的数值更新所有税费表显示
    var freshLat = window._detailedLatResult;
    if (freshLat && freshLat.total != null) {
      var fVat = freshLat.totalVat || s.vatTax;
      var fSur = freshLat.totalVatSur || s.vatSurcharge;
      var fLat = freshLat.total;
      // 重算所得税
      var fParkNotDeduct = (s.parkMode === '2' && freshLat) ? (freshLat.buildBsm || 0) : 0;
      var fDeductBuild = (s.buildTotal - fParkNotDeduct) / 1.09;
      var fProfitBT = s.totalValue / 1.09 - s.landCostTotal - fDeductBuild - fSur - fLat - s.stampTax - s.feeTotal;
      var fIncomeTax = Math.max(0, fProfitBT * 0.25);
      var fDetailTotal = Math.round(fVat) + Math.round(fSur) + Math.round(fLat) + Math.round(s.stampTax) + Math.round(fIncomeTax);
      var fProjectTotal = s.useEstTax ? s.estTaxTotal : fDetailTotal;
      var fFeeTotal = s.feeTotal + fProjectTotal;
      var fNetProfit = s.totalValue - s.directCostTotal - s.feeTotal - fProjectTotal;
      var fProfitRate = s.totalValue > 0 ? fNetProfit / s.totalValue * 100 : 0;
      var fTaxUnit = s.totalFar > 0 ? Math.round(fProjectTotal * 10000 / s.totalFar) : 0;
      // 更新所有单元格
      var setCell = function(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; };
      var setCellColor = function(id, val, color) { var el = document.getElementById(id); if (el) { el.textContent = val; el.style.color = color; } };
      setCell('proj_fee_total_val', d(fFeeTotal));
      setCell('proj_tax_pct', d2(fProjectTotal / s.totalValue * 100) + '%');
      setCell('proj_tax_unit', d(fTaxUnit));
      setCell('proj_tax_val', d(fProjectTotal));
      setCellColor('proj_net_profit_val', d(fNetProfit), fNetProfit >= 0 ? 'var(--green)' : 'var(--red)');
      setCellColor('proj_profit_rate_val', d2(fProfitRate) + '%', fProfitRate >= 0 ? 'var(--green)' : 'var(--red)');
      setCell('tax_vat_val', d(fVat));
      setCell('tax_vat_pct', d2(fVat / s.totalValue * 100) + '%');
      setCell('tax_sur_val', d(fSur));
      setCell('tax_sur_pct', d2(fSur / s.totalValue * 100) + '%');
      setCell('tax_lat_val', d(fLat));
      setCell('tax_lat_pct', d2(fLat / s.totalValue * 100) + '%');
      setCell('tax_stamp_val', d(s.stampTax));
      setCell('tax_stamp_pct', d2(s.stampTax / s.totalValue * 100) + '%');
      setCell('tax_income_val', d(fIncomeTax));
      setCell('tax_income_pct', d2(fIncomeTax / s.totalValue * 100) + '%');
      setCell('tax_total_val', d(fDetailTotal));
      setCell('tax_total_pct', d2(fDetailTotal / s.totalValue * 100) + '%');
      setEstimateTaxDelta('tax_total_val_delta', estimateTaxAmountDeltaText(s.useEstTax, fDetailTotal, s.estTaxTotal), s.estTaxTotal - fDetailTotal);
      setEstimateTaxDelta('tax_total_pct_delta', estimateTaxRateDeltaText(s.useEstTax, fDetailTotal, s.estTaxRate, s.totalValue), s.estTaxRate - (s.totalValue > 0 ? fDetailTotal / s.totalValue * 100 : 0));
      // 同步更新说明文字中的土增税值和税费合计
      setCell('explain_lat_val', d(fLat));
      setCell('explain_tax_total', d(fDetailTotal));
    }
  }
}

// 辅助渲染函数（严格按XML模板格式）
function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function d(v) { if (v == null || isNaN(v)) return '-'; return v.toLocaleString('zh-CN', {maximumFractionDigits:0}); }
function d2(v) { if (v == null || isNaN(v)) return '-'; return v.toLocaleString('zh-CN', {maximumFractionDigits:2}); }

function estimateTaxDeltaStyle(enabled, diff) {
  if (!enabled) return 'display:none';
  var color = Math.abs(diff) < 0.005 ? 'var(--muted)' : (diff > 0 ? 'var(--red)' : 'var(--green)');
  return 'margin-left:4px;font-size:0.68rem;color:' + color;
}

function estimateTaxAmountDeltaText(enabled, detailTotal, estTotal) {
  if (!enabled) return '';
  var diff = estTotal - detailTotal;
  if (Math.abs(diff) < 0.5) return '（持平）';
  return '（' + (diff > 0 ? '↑' : '↓') + d(Math.abs(diff)) + '）';
}

function estimateTaxRateDeltaText(enabled, detailTotal, estTaxRate, totalValue) {
  if (!enabled) return '';
  var detailRate = totalValue > 0 ? detailTotal / totalValue * 100 : 0;
  var diff = estTaxRate - detailRate;
  if (Math.abs(diff) < 0.005) return '（持平）';
  return '（' + (diff > 0 ? '↑' : '↓') + d2(Math.abs(diff)) + '%）';
}

function setEstimateTaxDelta(id, text, diff) {
  var el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.style.cssText = estimateTaxDeltaStyle(text !== '', diff);
}

var HTML2CANVAS_CDN = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
var _html2CanvasLoading = false;

function loadHtml2Canvas() {
  return new Promise(function(resolve, reject) {
    if (window.html2canvas) { resolve(); return; }
    if (_html2CanvasLoading) {
      var timer = setInterval(function() {
        if (window.html2canvas) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
      setTimeout(function() {
        if (!window.html2canvas) {
          clearInterval(timer);
          reject(new Error('截图组件加载超时'));
        }
      }, 10000);
      return;
    }
    _html2CanvasLoading = true;
    var script = document.createElement('script');
    script.src = HTML2CANVAS_CDN;
    script.onload = function() {
      _html2CanvasLoading = false;
      resolve();
    };
    script.onerror = function() {
      _html2CanvasLoading = false;
      reject(new Error('截图组件加载失败'));
    };
    document.head.appendChild(script);
  });
}

function projectMeasureImageName() {
  var nameEl = document.getElementById('project_name');
  var name = nameEl && nameEl.value ? nameEl.value.trim() : '项目';
  name = name.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_') || '项目';
  return name + '_项目测算表_' + new Date().toISOString().slice(0, 10) + '.png';
}

function dataUrlToBlob(dataUrl) {
  var parts = dataUrl.split(',');
  var mimeMatch = parts[0].match(/:(.*?);/);
  var mime = mimeMatch ? mimeMatch[1] : 'image/png';
  var binary = atob(parts[1]);
  var len = binary.length;
  var bytes = new Uint8Array(len);
  for (var i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function copyProjectMeasurePreviewImage() {
  var img = document.getElementById('projectMeasurePreviewImg');
  if (!img || !img.src) return;
  try {
    if (!navigator.clipboard || !window.ClipboardItem) throw new Error('当前浏览器不支持复制图片');
    var blob = dataUrlToBlob(img.src);
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    var msg = document.getElementById('projectMeasureImageMsg');
    if (msg) msg.textContent = '已复制图片';
  } catch (e) {
    alert('复制失败：' + e.message);
  }
}

function saveProjectMeasurePreviewImage() {
  var img = document.getElementById('projectMeasurePreviewImg');
  var src = (window._projectMeasurePreviewDataUrl || (img && img.src)) || '';
  if (!img || !src) return;
  var link = document.createElement('a');
  link.download = projectMeasureImageName();
  link.href = src;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  var msg = document.getElementById('projectMeasureImageMsg');
  if (msg) msg.textContent = '已触发保存';
}

function measureFmtInt(v) {
  if (v == null || isNaN(v)) return '-';
  return Number(v).toLocaleString('zh-CN', { maximumFractionDigits: 0 });
}

function measureFmt1(v) {
  if (v == null || isNaN(v)) return '-';
  return Number(v).toLocaleString('zh-CN', { maximumFractionDigits: 1 });
}

function measureFmt2(v) {
  if (v == null || isNaN(v)) return '-';
  return Number(v).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
}

function measureFmtTrim(v, digits) {
  if (v == null || isNaN(v)) return '-';
  var n = Number(v);
  var s = n.toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits == null ? 2 : digits
  });
  return s;
}

function escapeProjectMeasureHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(ch) {
    return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch];
  });
}

function getProjectMeasureTitleText() {
  var distNames = { nanming:'南明区', yunyan:'云岩区', guanshanhu:'观山湖区', huaxi:'花溪区', baiyun:'白云区', jingkai:'经开区', gaoxin:'高新区' };
  var distEl = document.getElementById('district');
  var pnEl = document.getElementById('project_name');
  var dn = distEl && distNames[distEl.value] ? distNames[distEl.value] : '';
  var pn = pnEl && pnEl.value ? pnEl.value.trim() : '';
  return (dn + (dn && pn ? ' ' : '') + pn) || '项目';
}

function getProjectMeasureOrdinaryRate(summary) {
  var dl = window._detailedLatResult || {};
  var types = dl.types || [];
  for (var i = 0; i < types.length; i++) {
    if (String(types[i].name || '') === '普通住宅') return types[i].rate || null;
  }
  return null;
}

function buildProjectMeasureDefaultNote() {
  var s = window._projectTaxSummary || {};
  var totalValue = s.totalValue || 0;
  var farVal = typeof getVal === 'function' ? getVal('far', 0) : 0;
  var landFloorPrice = s.priceLand != null ? s.priceLand : null;
  var landMuPrice = landFloorPrice != null && farVal > 0 ? landFloorPrice * farVal * 666.6667 / 10000 : null;
  var landAmountYi = s.landTotal != null ? s.landTotal / 10000 : null;
  var landCostRatio = totalValue > 0 && s.landCostTotal != null ? s.landCostTotal / totalValue * 100 : null;
  var buildAmountYi = s.buildTotal != null ? s.buildTotal / 10000 : null;
  var buildFarUnit = s.priceBuild != null ? s.priceBuild : null;
  var buildAreaUnit = s.totalBuilding > 0 && s.buildTotal != null ? s.buildTotal * 10000 / s.totalBuilding : null;
  var buildCostRatio = totalValue > 0 && s.buildTotal != null ? s.buildTotal / totalValue * 100 : null;
  var comValue = (s.valueComBottom || 0) + (s.valueComCentral || 0) + (s.valueComComplex || 0);
  var comSaleArea = (s.comBottomArea || 0) * (s.saleRatioBottom || 0) / 100 +
    (s.comCentralArea || 0) * (s.saleRatioCentral || 0) / 100 +
    (s.comComplexArea || 0) * (s.saleRatioComplex || 0) / 100;
  var comAvgPrice = comSaleArea > 0 ? comValue * 10000 / comSaleArea : (s.priceComBottom || s.priceComCentral || s.priceComComplex || null);
  var financeRate = totalValue > 0 ? (s.financeFee || 0) / totalValue * 100 : null;
  var feeRate = (s.rateSales != null || s.rateManage != null || financeRate != null)
    ? (s.rateSales || 0) + (s.rateManage || 0) + (financeRate || 0)
    : null;
  var devLoanYi = s.buildTotal != null ? s.buildTotal * (s.finBuildRatio || 0) / 100 / 10000 : null;
  var taxRate = totalValue > 0 && s.taxTotal != null ? s.taxTotal / totalValue * 100 : null;
  var profitRate = s.profitRate != null ? s.profitRate : null;
  var profitAmount = s.netProfit != null ? s.netProfit : null;
  var landParts = [];
  var landTaxEl = document.getElementById('land_tax_rate');
  var landTaxRate = landTaxEl && String(landTaxEl.value || '').trim() !== '' ? Number(landTaxEl.value) : s.landTaxRate;
  if (s.landTax != null && s.landTax > 0) {
    landParts.push('含' + measureFmtTrim(landTaxRate, 1) + '%契税约' + measureFmtInt(s.landTax) + '万');
  }
  if (s.landFeeTotal != null && s.landFeeTotal > 0) {
    landParts.push('配套费' + measureFmtInt(s.landFeeTotal) + '万');
  }
  if (s.landExtra != null && s.landExtra > 0) {
    landParts.push('补缴地价款' + measureFmtInt(s.landExtra) + '万元');
  }
  if (s.landCostTotal != null && s.landCostTotal > 0) {
    landParts.push('合计土地成本约' + measureFmtInt(s.landCostTotal) + '万元');
    landParts.push('楼面价' + measureFmtInt(s.totalFar > 0 ? s.landCostTotal * 10000 / s.totalFar : 0) + '元/㎡');
  }
  var landTail = landParts.length ? '（' + landParts.join('，') + '）' : '';
  var eduEl = document.getElementById('rate_edu');
  var eduRaw = eduEl ? String(eduEl.value || '').trim() : '';
  var eduText = eduRaw === '' ? '未计入教育配套费' : '计入教育配套费' + measureFmtInt(s.eduFee || 0) + '万元';
  var lines = [];
  lines.push('测算说明');
  lines.push('①地价：测算地价' + (landMuPrice != null ? measureFmtInt(landMuPrice) : '200') + '万/亩，楼面价' + (landFloorPrice != null ? measureFmtInt(landFloorPrice) : '1,200') + '元/㎡，土地款' + (landAmountYi != null ? measureFmtTrim(landAmountYi, 2) : '1.5') + '亿元，土地成本货值占比' + (landCostRatio != null ? measureFmtTrim(landCostRatio, 1) : '16.7') + '%' + landTail + '；');
  lines.push('②成本：建安成本总额约' + (buildAmountYi != null ? measureFmtTrim(buildAmountYi, 2) : '5') + '亿元，预估建安成本计容单方' + (buildFarUnit != null ? measureFmtInt(buildFarUnit) : '4,000') + '元/㎡（考虑装配式，跃层赠送），建面单方' + (buildAreaUnit != null ? measureFmtInt(buildAreaUnit) : '2,998') + '元/㎡，建造成本货值占比' + (buildCostRatio != null ? measureFmtTrim(buildCostRatio, 1) : '52') + '%；');
  lines.push('③售价：其中住宅均价' + (s.priceRes != null ? measureFmtInt(s.priceRes) : '7,500') + '元/㎡，商业均价' + (comAvgPrice != null ? measureFmtInt(comAvgPrice) : '10,000') + '元/㎡，住宅月均去化' + (s.monthlySales != null ? measureFmtInt(s.monthlySales) : 'XX') + '套，去化周期约' + (s.salesMonths != null ? measureFmtInt(s.salesMonths) : 'XX') + '月；');
  lines.push('④三费：销售费率' + measureFmtTrim(s.rateSales != null ? s.rateSales : 5, 1) + '%，管理费率' + measureFmtTrim(s.rateManage != null ? s.rateManage : 2, 1) + '%，资金费率' + (financeRate != null ? measureFmtTrim(financeRate, 1) : '2.1') + '%，合计' + measureFmtTrim(feeRate != null ? feeRate : 9.1, 1) + '%（前期投入未计息，仅考虑开发贷约' + (devLoanYi != null ? measureFmtTrim(devLoanYi, 2) : '2.5') + '亿元，成本' + measureFmtTrim(s.finBuildCost != null ? s.finBuildCost : 4, 1) + '%，' + measureFmtTrim(s.finBuildYears != null ? s.finBuildYears : 2, 1) + '年）；');
  lines.push('⑤税费：占比' + (taxRate != null ? measureFmtTrim(taxRate, 1) : '14') + '%（项目实操根据税筹方式进行调整）；');
  lines.push('⑥车位：' + (s.valueParking > 0 ? ('非人防车位按' + measureFmtTrim(s.saleRatioPark != null ? s.saleRatioPark : 0, 1) + '%去化计货值') : '人防车位考虑赠送或资产自持') + '；');
  lines.push('⑦教育配套：' + eduText + '；');
  lines.push('⑧项目收益：项目利润率' + (profitRate != null ? measureFmtTrim(profitRate, 1) : 'X.x') + '%，利润额约' + (profitAmount != null ? measureFmtInt(profitAmount) : 'XX') + '万元。');
  return lines.join('\n');
}

function buildProjectMeasureNoteHtml(note) {
  var text = String(note == null ? '' : note).replace(/\r/g, '');
  var lines = text.split('\n');
  var html = '';
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var cls = 'project-measure-note-line';
    if (i === 0) cls += ' project-measure-note-title';
    if (/^⑧/.test(line) || /项目收益/.test(line)) cls += ' project-measure-note-em';
    var m = String(line || '').match(/^([①②③④⑤⑥⑦⑧][^：]*：)(.*)$/);
    if (m) {
      html += '<div class="' + cls + '"><span class="project-measure-note-label">' + escapeProjectMeasureHtml(m[1]) + '</span><span class="project-measure-note-body">' + escapeProjectMeasureHtml(m[2]) + '</span></div>';
    } else {
      html += '<div class="' + cls + '">' + escapeProjectMeasureHtml(line) + '</div>';
    }
  }
  return html;
}

function wrapProjectMeasureText(ctx, text, maxWidth) {
  var lines = [];
  var paragraphs = String(text || '').replace(/\r/g, '').split('\n');
  for (var p = 0; p < paragraphs.length; p++) {
    var para = paragraphs[p];
    if (!para) {
      lines.push('');
      continue;
    }
    var line = '';
    for (var i = 0; i < para.length; i++) {
      var ch = para.charAt(i);
      var test = line + ch;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = ch.trim() ? ch : '';
      } else {
        line = test;
      }
    }
    lines.push(line);
  }
  return lines;
}

function composeProjectMeasureImage(baseDataUrl, noteText) {
  return new Promise(function(resolve, reject) {
    var img = new Image();
    img.onload = function() {
      try {
        var note = (noteText && String(noteText).trim()) ? String(noteText).trim() : buildProjectMeasureDefaultNote();
        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');
        var width = img.width;
        var padX = 48;
        var padTop = 34;
        var titleSize = 34;
        var bodySize = 26;
        var titleLineH = 40;
        var bodyLineH = 38;
        var maxWidth = width - padX * 2;
        ctx.font = bodySize + 'px "Microsoft YaHei", "PingFang SC", Arial, sans-serif';
        var lines = wrapProjectMeasureText(ctx, note, maxWidth);
        var noteHeight = padTop + titleLineH + 18 + lines.length * bodyLineH + 28;
        canvas.width = width;
        canvas.height = img.height + noteHeight;
        ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fafaf9';
        ctx.fillRect(0, 0, width, noteHeight);
        ctx.strokeStyle = '#d6d3d1';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, noteHeight + 1);
        ctx.lineTo(width, noteHeight + 1);
        ctx.stroke();
        ctx.fillStyle = '#1c1917';
        ctx.font = '700 ' + titleSize + 'px "Microsoft YaHei", "PingFang SC", Arial, sans-serif';
        ctx.fillText('测算说明', padX, padTop + titleSize - 4);
        ctx.fillStyle = '#334155';
        ctx.font = bodySize + 'px "Microsoft YaHei", "PingFang SC", Arial, sans-serif';
        var y = padTop + titleLineH + 10;
        for (var i = 0; i < lines.length; i++) {
          if (!lines[i]) {
            y += bodyLineH * 0.55;
            continue;
          }
          ctx.fillText(lines[i], padX, y);
          y += bodyLineH;
        }
        ctx.drawImage(img, 0, noteHeight);
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = function() { reject(new Error('图片加载失败')); };
    img.src = baseDataUrl;
  });
}

async function refreshProjectMeasurePreviewImage(noteText) {
  var finalDataUrl = await captureProjectMeasureImageDataUrl(noteText || window._projectMeasureNoteText || buildProjectMeasureDefaultNote());
  window._projectMeasurePreviewDataUrl = finalDataUrl;
  var img = document.getElementById('projectMeasurePreviewImg');
  if (img) img.src = finalDataUrl;
  var msg = document.getElementById('projectMeasureImageMsg');
  if (msg) msg.textContent = '说明已更新';
}

function showProjectMeasureImagePreview(dataUrl) {
  hideProjectMeasureImagePreview();
  var modal = document.createElement('div');
  modal.id = 'projectMeasureImageModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(28,25,23,0.58);z-index:99999;display:flex;align-items:center;justify-content:center;padding:24px';
  modal.onclick = function(e) { if (e.target === modal) hideProjectMeasureImagePreview(); };
  modal.oncontextmenu = function(e) { e.preventDefault(); return false; };
  modal.innerHTML =
    '<div style="width:min(1180px,100%);max-height:92vh;background:#fff;border-radius:10px;box-shadow:0 18px 60px rgba(0,0,0,0.3);display:flex;flex-direction:column;overflow:hidden">' +
      '<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-bottom:1px solid #e7e5e4">' +
        '<div style="font-size:0.95rem;font-weight:700;color:#1c1917">项目测算简报</div>' +
        '<div id="projectMeasureImageMsg" style="font-size:0.72rem;color:#78716c">可复制或保存图片</div>' +
        '<div style="margin-left:auto;display:flex;align-items:center;gap:8px;flex-shrink:0">' +
          '<button type="button" onclick="copyProjectMeasurePreviewImage()" style="border:1px solid #2563eb;background:#fff;border-radius:6px;padding:5px 12px;cursor:pointer;color:#2563eb">复制</button>' +
          '<button type="button" onclick="saveProjectMeasurePreviewImage()" style="border:1px solid #16a34a;background:#fff;border-radius:6px;padding:5px 12px;cursor:pointer;color:#16a34a">保存</button>' +
          '<button type="button" onclick="showProjectMeasureNoteEditor()" style="border:1px solid #d97706;background:#fff;border-radius:6px;padding:5px 12px;cursor:pointer;color:#d97706">测算说明</button>' +
          '<button type="button" aria-label="关闭" onclick="hideProjectMeasureImagePreview()" style="border:1px solid #d6d3d1;background:#fff;border-radius:6px;width:30px;height:30px;line-height:1;cursor:pointer;color:#44403c;font-size:1rem">×</button>' +
        '</div>' +
      '</div>' +
      '<div style="overflow:auto;padding:14px;background:#f5f5f4">' +
        '<img id="projectMeasurePreviewImg" src="' + dataUrl + '" alt="项目测算表" oncontextmenu="return false" style="display:block;max-width:100%;height:auto;margin:0 auto;background:#fff;border:1px solid #e7e5e4">' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);
  window._projectMeasurePreviewDataUrl = dataUrl;
}

function hideProjectMeasureImagePreview() {
  var modal = document.getElementById('projectMeasureImageModal');
  if (modal && modal.parentNode) modal.parentNode.removeChild(modal);
}

function hideProjectMeasureNoteEditor() {
  var modal = document.getElementById('projectMeasureNoteModal');
  if (modal && modal.parentNode) modal.parentNode.removeChild(modal);
}

function showProjectMeasureNoteEditor() {
  hideProjectMeasureNoteEditor();
  var modal = document.createElement('div');
  modal.id = 'projectMeasureNoteModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(28,25,23,0.45);z-index:100000;display:flex;align-items:center;justify-content:center;padding:24px';
  modal.onclick = function(e) { if (e.target === modal) hideProjectMeasureNoteEditor(); };
  var noteText = window._projectMeasureNoteText || buildProjectMeasureDefaultNote();
  modal.innerHTML =
    '<div style="width:min(820px,100%);max-height:88vh;overflow:auto;background:#fff;border-radius:10px;box-shadow:0 18px 60px rgba(0,0,0,0.28);padding:18px 20px;color:#1c1917">' +
      '<div style="display:flex;align-items:center;gap:12px;border-bottom:1px solid #e7e5e4;padding-bottom:10px;margin-bottom:12px">' +
        '<div style="font-size:1rem;font-weight:700">测算说明</div>' +
        '<div style="font-size:0.72rem;color:#78716c">编辑后会显示在图片表头上方</div>' +
        '<button type="button" onclick="hideProjectMeasureNoteEditor()" style="margin-left:auto;border:1px solid #d6d3d1;background:#fff;border-radius:6px;padding:5px 12px;cursor:pointer;color:#44403c">关闭</button>' +
      '</div>' +
        '<textarea id="projectMeasureNoteText" style="width:100%;min-height:260px;resize:vertical;border:1px solid #d6d3d1;border-radius:8px;padding:12px;font-size:0.82rem;line-height:1.7;color:#1c1917;outline:none;white-space:pre-wrap">' + escapeProjectMeasureHtml(noteText) + '</textarea>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">' +
        '<button type="button" onclick="document.getElementById(\'projectMeasureNoteText\').value=buildProjectMeasureDefaultNote()" style="border:1px solid #d6d3d1;background:#fff;border-radius:6px;padding:5px 12px;cursor:pointer;color:#44403c">恢复默认</button>' +
        '<button type="button" onclick="saveProjectMeasureNote()" style="border:1px solid #16a34a;background:#fff;border-radius:6px;padding:5px 12px;cursor:pointer;color:#16a34a">保存并更新</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);
}

async function saveProjectMeasureNote() {
  var ta = document.getElementById('projectMeasureNoteText');
  var text = ta ? String(ta.value || '').trim() : '';
  if (!text) text = buildProjectMeasureDefaultNote();
  window._projectMeasureNoteText = text;
  hideProjectMeasureNoteEditor();
  await refreshProjectMeasurePreviewImage(text);
}

function applyProjectMeasureImageStyles(doc, clonedTarget, exportWidth) {
  clonedTarget.classList.add('project-measure-export');
  clonedTarget.style.width = exportWidth + 'px';
  clonedTarget.style.maxWidth = 'none';
  clonedTarget.style.margin = '0';
  clonedTarget.style.padding = '26px 28px 30px';
  clonedTarget.style.border = '0';
  clonedTarget.style.borderRadius = '0';
  clonedTarget.style.boxShadow = 'none';
  clonedTarget.style.background = '#ffffff';

  var title = clonedTarget.querySelector('h2');
  if (title) {
    title.innerHTML =
      '<span>项目测算</span>' +
      '<span class="project-measure-export-meta">生成日期：' + new Date().toLocaleDateString('zh-CN') + '</span>';
  }

  var style = doc.createElement('style');
  style.textContent =
    '.project-measure-export{font-family:"Microsoft YaHei","PingFang SC",Arial,sans-serif!important;color:#1f2933!important;}' +
    '.project-measure-export h2{display:flex!important;align-items:flex-end!important;justify-content:space-between!important;margin:0 0 14px!important;padding:0 0 12px!important;border-bottom:3px solid #1f4e79!important;font-size:24px!important;font-weight:700!important;color:#17365d!important;letter-spacing:0!important;}' +
    '.project-measure-export .project-measure-export-meta{font-size:12px!important;font-weight:400!important;color:#64748b!important;}' +
    '.project-measure-export .project-measure-note{margin:0 0 14px!important;padding:12px 14px!important;border:1px solid #cbd5e1!important;border-radius:8px!important;background:#f8fafc!important;color:#0f172a!important;line-height:1.7!important;font-size:14px!important;word-break:break-word!important;}' +
    '.project-measure-export .project-measure-note-line{margin:0 0 3px!important;line-height:1.7!important;white-space:normal!important;}' +
    '.project-measure-export .project-measure-note-title{font-weight:700!important;}' +
    '.project-measure-export .project-measure-note-label{color:#111827!important;font-weight:700!important;}' +
    '.project-measure-export .project-measure-note-body{color:inherit!important;font-weight:400!important;}' +
    '.project-measure-export .project-measure-note-em{color:#dc2626!important;font-weight:700!important;}' +
    '.project-measure-export>div{overflow:visible!important;}' +
    '.project-measure-export table{width:100%!important;min-width:0!important;border-collapse:collapse!important;table-layout:fixed!important;font-size:13px!important;background:#fff!important;}' +
    '.project-measure-export th,.project-measure-export td{border:1px solid #9aa6b2!important;padding:6px 7px!important;line-height:1.45!important;vertical-align:middle!important;color:#1f2933!important;word-break:break-word!important;}' +
    '.project-measure-export th{background:#334155!important;color:#fff!important;font-weight:700!important;}' +
    '.project-measure-export tr[style*="background:#FCE4D6"] td{background:#eaf2f8!important;color:#17365d!important;font-weight:700!important;}' +
    '.project-measure-export tr[style*="background:#A6A6A6"] th{background:#1f4e79!important;color:#fff!important;}' +
    '.project-measure-export tr[style*="background:#EDEDED"] td{background:#eef3f7!important;color:#17365d!important;font-weight:700!important;}' +
    '.project-measure-export tr[style*="background:#FFFF00"] td{background:#fff2cc!important;color:#7c2d12!important;font-weight:700!important;}' +
    '.project-measure-export td[style*="text-align:left"]{text-align:left!important;}' +
    '.project-measure-export td[style*="var(--muted)"]{color:#52616f!important;}' +
    '.project-measure-export span.project-export-value{display:inline-block!important;min-width:26px!important;padding:1px 4px!important;border-radius:3px!important;background:#f8fafc!important;color:#111827!important;font-weight:600!important;text-align:center!important;line-height:1.35!important;white-space:nowrap!important;}' +
    '.project-measure-export td span.project-export-value:only-child{background:transparent!important;padding:0!important;font-weight:inherit!important;}' +
    '.project-measure-export br{line-height:1.7!important;}';
  doc.head.appendChild(style);
}

async function captureProjectMeasureImageDataUrl(noteText) {
  var target = document.getElementById('projectMeasureCard');
  if (!target) { throw new Error('请先生成项目测算表'); }
  var btn = document.getElementById('projectShotBtn');
  var oldText = btn ? btn.textContent : '';
  var oldVisibility = btn ? btn.style.visibility : '';
  var exportWidth = Math.max(target.scrollWidth || 0, target.offsetWidth || 0, 1120);
  var note = (noteText && String(noteText).trim()) ? String(noteText).trim() : (window._projectMeasureNoteText || buildProjectMeasureDefaultNote());

  if (btn) { btn.disabled = true; btn.textContent = '生成中'; }
  try {
    await loadHtml2Canvas();
    if (btn) btn.style.visibility = 'hidden';
    var canvas = await window.html2canvas(target, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      logging: false,
      windowWidth: exportWidth + 80,
      width: exportWidth,
      scrollX: 0,
      scrollY: -window.scrollY,
      onclone: function(doc) {
        var clonedTarget = doc.getElementById('projectMeasureCard');
        if (!clonedTarget) return;
        applyProjectMeasureImageStyles(doc, clonedTarget, exportWidth);
        var shotBtn = doc.getElementById('projectShotBtn');
        if (shotBtn && shotBtn.parentNode) shotBtn.parentNode.removeChild(shotBtn);
        var giftNote = clonedTarget.querySelector('.park-gift-price-note');
        if (giftNote && giftNote.parentNode) giftNote.parentNode.removeChild(giftNote);
        var title = clonedTarget.querySelector('h2');
        if (title) {
          var noteBlock = doc.createElement('div');
          noteBlock.className = 'project-measure-note';
          noteBlock.innerHTML = buildProjectMeasureNoteHtml(note);
          title.parentNode.insertBefore(noteBlock, title.nextSibling);
        }
        var inputs = clonedTarget.querySelectorAll('input, select, textarea');
        for (var i = 0; i < inputs.length; i++) {
          var el = inputs[i];
          var value = '';
          if (el.tagName === 'SELECT') {
            value = el.selectedOptions && el.selectedOptions.length ? el.selectedOptions[0].textContent : '';
          } else if (el.type === 'checkbox' || el.type === 'radio') {
            value = el.checked ? '√' : '';
          } else {
            value = el.value != null && String(el.value).trim() !== '' ? String(el.value) : (el.placeholder || '');
          }
          if (value == null || String(value).trim() === '') value = '-';
          var span = doc.createElement('span');
          span.className = 'project-export-value';
          span.textContent = value;
          span.style.cssText = 'display:inline-block;min-width:1em;padding:0;border:none;background:transparent;color:#1c1917;font:inherit;line-height:1.3;text-align:center;white-space:nowrap;box-sizing:border-box;';
          if (el.tagName === 'SELECT') {
            span.style.whiteSpace = 'normal';
            span.style.textAlign = 'center';
          }
          if (el.parentNode) el.parentNode.replaceChild(span, el);
        }
      }
    });
    return canvas.toDataURL('image/png');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = oldText || '生成测算简报'; btn.style.visibility = oldVisibility; }
  }
}

async function generateProjectMeasureImage() {
  try {
    var finalDataUrl = await captureProjectMeasureImageDataUrl(window._projectMeasureNoteText || buildProjectMeasureDefaultNote());
    window._projectMeasurePreviewDataUrl = finalDataUrl;
    showProjectMeasureImagePreview(finalDataUrl);
  } catch (e) {
    alert('生成图片失败：' + e.message);
  }
}

function sensitivityChartRange(values, minPad) {
  var nums = [];
  for (var i = 0; i < values.length; i++) {
    var n = Number(values[i]);
    if (!isNaN(n) && isFinite(n)) nums.push(n);
  }
  if (!nums.length) return { min: 0, max: 1 };
  var min = Math.min.apply(null, nums);
  var max = Math.max.apply(null, nums);
  var pad = Math.max(Math.abs(max - min) * 0.12, minPad || 1);
  if (min === max) pad = Math.max(Math.abs(max) * 0.12, minPad || 1);
  return { min: min - pad, max: max + pad };
}

function sensitivityChartData(raw) {
  var data = [];
  raw = raw || [];
  for (var i = 0; i < raw.length; i++) {
    var p = raw[i] || {};
    if (isNaN(p.change) || isNaN(p.netProfit) || isNaN(p.profitRate)) continue;
    data.push({
      change: Number(p.change),
      netProfit: Number(p.netProfit),
      profitRate: Number(p.profitRate)
    });
  }
  data.sort(function(a, b) { return a.change - b.change; });
  return data;
}

function sensitivityChangeText(v) {
  if (v === 0) return '0';
  return (v > 0 ? '+' : '') + measureFmtInt(v);
}

function buildSensitivityChartSvg(raw, title, xUnit) {
  var data = sensitivityChartData(raw);
  if (data.length < 2) {
    return '<div style="padding:28px;text-align:center;color:#78716c">暂无足够数据生成图表，请先完成敏感性分析。</div>';
  }
  var w = 920, h = 300;
  var left = 76, right = 72, top = 42, bottom = 46;
  var plotW = w - left - right;
  var plotH = h - top - bottom;
  var xVals = data.map(function(p) { return p.change; });
  var xMin = Math.min.apply(null, xVals);
  var xMax = Math.max.apply(null, xVals);
  if (xMin === xMax) { xMin -= 1; xMax += 1; }
  var profitRange = sensitivityChartRange(data.map(function(p) { return p.netProfit; }), 100);
  var rateRange = sensitivityChartRange(data.map(function(p) { return p.profitRate; }), 1);
  var xOf = function(v) { return left + (v - xMin) / (xMax - xMin) * plotW; };
  var yProfit = function(v) { return top + (profitRange.max - v) / (profitRange.max - profitRange.min) * plotH; };
  var yRate = function(v) { return top + (rateRange.max - v) / (rateRange.max - rateRange.min) * plotH; };
  var profitPts = data.map(function(p) { return xOf(p.change).toFixed(1) + ',' + yProfit(p.netProfit).toFixed(1); }).join(' ');
  var ratePts = data.map(function(p) { return xOf(p.change).toFixed(1) + ',' + yRate(p.profitRate).toFixed(1); }).join(' ');
  var html = '';
  html += '<svg viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + escapeProjectMeasureHtml(title) + '" style="display:block;width:100%;height:auto;background:#fff;border:1px solid #e7e5e4;border-radius:8px">';
  html += '<rect x="0" y="0" width="' + w + '" height="' + h + '" fill="#fff"/>';
  html += '<text x="' + left + '" y="24" fill="#1c1917" font-size="16" font-weight="700">' + escapeProjectMeasureHtml(title) + '</text>';
  html += '<line x1="' + left + '" y1="' + (top + plotH) + '" x2="' + (left + plotW) + '" y2="' + (top + plotH) + '" stroke="#9ca3af"/>';
  html += '<line x1="' + left + '" y1="' + top + '" x2="' + left + '" y2="' + (top + plotH) + '" stroke="#9ca3af"/>';
  html += '<line x1="' + (left + plotW) + '" y1="' + top + '" x2="' + (left + plotW) + '" y2="' + (top + plotH) + '" stroke="#9ca3af"/>';
  for (var i = 0; i <= 4; i++) {
    var ratio = i / 4;
    var y = top + plotH * ratio;
    var profitVal = profitRange.max - (profitRange.max - profitRange.min) * ratio;
    var rateVal = rateRange.max - (rateRange.max - rateRange.min) * ratio;
    html += '<line x1="' + left + '" y1="' + y.toFixed(1) + '" x2="' + (left + plotW) + '" y2="' + y.toFixed(1) + '" stroke="#e5e7eb"/>';
    html += '<text x="' + (left - 8) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end" fill="#2563eb" font-size="11">' + measureFmtInt(profitVal) + '</text>';
    html += '<text x="' + (left + plotW + 8) + '" y="' + (y + 4).toFixed(1) + '" fill="#16a34a" font-size="11">' + measureFmt1(rateVal) + '%</text>';
  }
  if (xMin < 0 && xMax > 0) {
    var zeroX = xOf(0);
    html += '<line x1="' + zeroX.toFixed(1) + '" y1="' + top + '" x2="' + zeroX.toFixed(1) + '" y2="' + (top + plotH) + '" stroke="#f59e0b" stroke-dasharray="4 4"/>';
  }
  html += '<polyline points="' + profitPts + '" fill="none" stroke="#2563eb" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
  html += '<polyline points="' + ratePts + '" fill="none" stroke="#16a34a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
  var labelEvery = Math.max(1, Math.ceil(data.length / 11));
  for (var pIndex = 0; pIndex < data.length; pIndex++) {
    var point = data[pIndex];
    var x = xOf(point.change);
    var yp = yProfit(point.netProfit);
    var yr = yRate(point.profitRate);
    var isBase = point.change === 0;
    html += '<circle cx="' + x.toFixed(1) + '" cy="' + yp.toFixed(1) + '" r="' + (isBase ? 4 : 3) + '" fill="#2563eb"/>';
    html += '<circle cx="' + x.toFixed(1) + '" cy="' + yr.toFixed(1) + '" r="' + (isBase ? 4 : 3) + '" fill="#16a34a"/>';
    html += '<text x="' + x.toFixed(1) + '" y="' + (yp - 8).toFixed(1) + '" text-anchor="middle" fill="#2563eb" font-size="10">' + measureFmtInt(point.netProfit) + '万</text>';
    html += '<text x="' + x.toFixed(1) + '" y="' + (yr + 16).toFixed(1) + '" text-anchor="middle" fill="#16a34a" font-size="10">' + measureFmt1(point.profitRate) + '%</text>';
    if (pIndex === 0 || pIndex === data.length - 1 || isBase || pIndex % labelEvery === 0) {
      html += '<text x="' + x.toFixed(1) + '" y="' + (top + plotH + 25) + '" text-anchor="middle" fill="#57534e" font-size="11">' + sensitivityChangeText(point.change) + '</text>';
    }
  }
  html += '<text x="' + left + '" y="' + (h - 8) + '" fill="#2563eb" font-size="11">左轴：净利润（万元）</text>';
  html += '<text x="' + (left + plotW) + '" y="' + (h - 8) + '" text-anchor="end" fill="#16a34a" font-size="11">右轴：利润率</text>';
  html += '<text x="' + (left + plotW / 2) + '" y="' + (h - 8) + '" text-anchor="middle" fill="#78716c" font-size="11">横轴：' + escapeProjectMeasureHtml(xUnit) + '（元/㎡）</text>';
  html += '<line x1="' + (w - 246) + '" y1="20" x2="' + (w - 218) + '" y2="20" stroke="#2563eb" stroke-width="3"/><text x="' + (w - 212) + '" y="24" fill="#334155" font-size="12">净利润</text>';
  html += '<line x1="' + (w - 146) + '" y1="20" x2="' + (w - 118) + '" y2="20" stroke="#16a34a" stroke-width="3"/><text x="' + (w - 112) + '" y="24" fill="#334155" font-size="12">利润率</text>';
  html += '</svg>';
  return html;
}

function showSensitivityChartModal() {
  var data = window._projectSensitivityChartData || {};
  var rawFloor = data.floor || [];
  var rawRes = data.res || [];
  var floor = sensitivityChartData(rawFloor);
  var res = sensitivityChartData(rawRes);
  if (floor.length < 2 || res.length < 2) {
    alert('暂无足够敏感性分析数据，请先生成项目测算表');
    return;
  }
  var baseFloor = null;
  for (var bf = 0; bf < rawFloor.length; bf++) {
    if (rawFloor[bf] && Number(rawFloor[bf].change) === 0) baseFloor = rawFloor[bf].landPrice;
  }
  var baseRes = null;
  for (var br = 0; br < rawRes.length; br++) {
    if (rawRes[br] && Number(rawRes[br].change) === 0) baseRes = rawRes[br].price;
  }
  var floorTitle = '楼面价变化趋势' + (baseFloor != null && !isNaN(baseFloor) ? '（基准楼面价：' + measureFmtInt(baseFloor) + '元/㎡）' : '');
  var resTitle = '住宅均价变化趋势' + (baseRes != null && !isNaN(baseRes) ? '（基准住宅均价：' + measureFmtInt(baseRes) + '元/㎡）' : '');
  hideSensitivityChartModal();
  var modal = document.createElement('div');
  modal.id = 'sensitivityChartModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(28,25,23,0.48);z-index:99999;display:flex;align-items:center;justify-content:center;padding:24px';
  modal.onclick = function(e) { if (e.target === modal) hideSensitivityChartModal(); };
  modal.innerHTML =
    '<div style="width:min(1080px,100%);max-height:92vh;background:#fff;border-radius:10px;box-shadow:0 18px 60px rgba(0,0,0,0.28);display:flex;flex-direction:column;overflow:hidden">' +
      '<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid #e7e5e4">' +
        '<div style="font-size:1rem;font-weight:700;color:#1c1917">敏感性分析图表</div>' +
        '<div style="font-size:0.72rem;color:#78716c">楼面价变化 / 住宅均价变化</div>' +
        '<button type="button" aria-label="关闭" onclick="hideSensitivityChartModal()" style="margin-left:auto;border:1px solid #d6d3d1;background:#fff;border-radius:6px;width:30px;height:30px;line-height:1;cursor:pointer;color:#44403c;font-size:1rem">×</button>' +
      '</div>' +
      '<div style="overflow:auto;padding:14px 16px;background:#f5f5f4">' +
        '<div style="padding:10px 12px;margin-bottom:12px;border:1px solid #e7e5e4;border-radius:8px;background:#fff;color:#57534e;font-size:0.78rem;line-height:1.7">蓝线为净利润，绿线为利润率；曲线斜率越大，说明该参数对项目收益越敏感。楼面价上升通常压低收益，住宅均价上升通常抬高收益，接近拐点时应重点复核税费跳档和利润率变化。</div>' +
        '<div style="display:grid;grid-template-columns:1fr;gap:12px">' +
          '<div>' + buildSensitivityChartSvg(floor, floorTitle, '楼面价变化') + '</div>' +
          '<div>' + buildSensitivityChartSvg(res, resTitle, '住宅均价变化') + '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);
}

function hideSensitivityChartModal() {
  var modal = document.getElementById('sensitivityChartModal');
  if (modal && modal.parentNode) modal.parentNode.removeChild(modal);
}

function subHead(label, rowspan) {
  return '<tr><td rowspan="' + rowspan + '" style="text-align:center;font-weight:600;background:#fff">' + label + '</td>';
}

function subItem(name, area, unit, pct, priceId, price, value, note, first, areaId, unitId) {
  var h = (first ? '' : '<tr>');
  h += '<td style="text-align:left;padding-left:8px">' + name + '</td>';
  h += '<td>' + (areaId ? '<input id="' + areaId + '" type="number" value="' + area + '" style="width:70px;padding:2px 4px;font-size:0.72rem;text-align:center" onchange="runProjectCalc()">' : d(area)) + '</td>';
  h += '<td>' + unit + '</td>';
  h += '<td>' + (pct === '/' ? '/' : pct + '%') + '</td>';
  h += '<td>' + (priceId ? '<input id="' + priceId + '" type="number" value="' + (price || '') + '" style="width:80px;padding:2px 4px;font-size:0.72rem;text-align:center" onchange="runProjectCalc()">' : '-') + '</td>';
  h += '<td>' + (value !== '' ? (value ? d(value) : '-') : '-') + '</td>';
  h += '<td style="font-size:0.68rem;color:var(--muted);text-align:left">' + (note || '') +
    (unitId ? ' 户均<input id="' + unitId + '" type="number" value="' + (typeof getVal==='function'?getVal(unitId,0):0) + '" style="width:55px;padding:1px 3px;font-size:0.68rem;text-align:center" onchange="runProjectCalc()">㎡/户' : '') +
    '</td>';
  return h + '</tr>';
}

function costItem(name, area, unit, pct, priceId, price, value, note, first) {
  var h = (first ? '' : '<tr>');
  h += '<td style="text-align:left;padding-left:8px">' + name + '</td>';
  h += '<td>' + d(area) + '</td><td>' + unit + '</td>';
  h += '<td>' + pct + '%</td>';
  h += '<td><input id="' + priceId + '" type="number" value="' + price + '" style="width:80px;padding:2px 4px;font-size:0.72rem;text-align:center" onchange="runProjectCalc()"></td>';
  h += '<td>' + d(value) + '</td>';
  h += '<td style="font-size:0.7rem;color:var(--muted);text-align:left">' + note + '</td></tr>';
  return h;
}

function feeItem(name, totalValueStr, pct, rateId, rate, value, unitCost, note, first) {
  var h = (first ? '' : '<tr>');
  h += '<td style="text-align:left;padding-left:8px">' + name + '</td>';
  h += '<td>' + totalValueStr + '</td><td>万元</td>';
  h += '<td><input id="' + rateId + '" type="number" value="' + rate + '" step="0.5" style="width:70px;padding:2px 4px;font-size:0.72rem;text-align:center" onchange="runProjectCalc()"> %</td>';
  h += '<td>' + d(unitCost) + '</td>';
  h += '<td>' + d(value) + '</td>';
  h += '<td style="font-size:0.7rem;color:var(--muted);text-align:left">' + note + '</td></tr>';
  return h;
}

function feeItemTax(name, totalValueStr, pct, rateId, rate, value, unitCost, note) {
  var h = '<tr>';
  h += '<td style="text-align:left;padding-left:8px">' + name + '</td>';
  h += '<td>' + totalValueStr + '</td><td>万元</td>';
  h += '<td style="font-size:0.7rem;color:var(--red)">从税费测算取</td>';
  h += '<td>' + d(unitCost) + '</td>';
  h += '<td>' + d(value) + '</td>';
  h += '<td style="font-size:0.7rem;color:var(--muted);text-align:left">' + note + '</td></tr>';
  return h;
}

function feeTaxItem(name, totalValueStr, pct, rateId, rate, value, unitCost, note) {
  var h = '<tr>';
  h += '<td style="text-align:left;padding-left:8px">' + name + '</td>';
  h += '<td>' + totalValueStr + '</td><td>万元</td>';
  h += '<td>' + (rateId ? '<input id="' + rateId + '" type="number" value="' + rate + '" step="0.5" style="width:70px;padding:2px 4px;font-size:0.72rem;text-align:center" onchange="runProjectCalc()"> %' : '-') + '</td>';
  h += '<td>' + d(unitCost) + '</td>';
  h += '<td>' + (value ? d(value) : '-') + '</td>';
  h += '<td style="font-size:0.7rem;color:var(--muted)">' + note + '</td></tr>';
  return h;
}

function taxRow(name, calc, amount, pct, idVal, idPct) {
  var d = function(v) { if (v == null || isNaN(v)) return '-'; return v.toLocaleString('zh-CN', {maximumFractionDigits:0}); };
  var d2 = function(v) { if (v == null || isNaN(v)) return '-'; return v.toLocaleString('zh-CN', {maximumFractionDigits:2}); };
  var h = '<tr>';
  h += '<td style="font-weight:600">' + name + '</td>';
  h += '<td style="font-size:0.7rem;color:var(--muted)">' + calc + '</td>';
  h += '<td style="text-align:center"' + (idVal ? ' id="' + idVal + '"' : '') + '>' + d(amount) + '</td>';
  h += '<td style="text-align:center"' + (idPct ? ' id="' + idPct + '"' : '') + '>' + d2(pct) + '%</td>';
  h += '</tr>';
  return h;
}

function taxPlanList(items) {
  if (!items || items.length === 0) return '<div style="color:#78716c;font-size:0.78rem">暂无明显触发项，建议保持现有口径并关注后续售价、成本和车位模式变化。</div>';
  var h = '<ul style="margin:6px 0 0 18px;padding:0;line-height:1.7">';
  for (var i = 0; i < items.length; i++) h += '<li>' + items[i] + '</li>';
  return h + '</ul>';
}

function taxRisk(text) {
  return '<span style="color:#dc2626;font-weight:700">' + text + '</span>';
}

function taxWarn(text) {
  return '<span style="color:#d97706;font-weight:700">' + text + '</span>';
}

function taxGood(text) {
  return '<span style="color:#16a34a;font-weight:700">' + text + '</span>';
}

function taxEm(text) {
  return '<span style="font-weight:700;color:#1c1917">' + text + '</span>';
}

function buildTaxPlanningAdviceHtml(s) {
  var dl = window._detailedLatResult || {};
  var totalValue = s.totalValue || 0;
  var vatTax = dl.totalVat != null ? dl.totalVat : s.vatTax;
  var vatSur = dl.totalVatSur != null ? dl.totalVatSur : s.vatSurcharge;
  var latTax = dl.total != null ? dl.total : s.latTax;
  var parkNotDeduct = (s.parkMode === '2' && dl.buildBsm) ? dl.buildBsm : 0;
  var profitBeforeTax = totalValue / 1.09 - s.landCostTotal - (s.buildTotal - parkNotDeduct) / 1.09 - vatSur - latTax - s.stampTax - s.feeTotal;
  var incomeTax = Math.max(0, profitBeforeTax * 0.25);
  var totalTax = Math.round(vatTax) + Math.round(vatSur) + Math.round(latTax) + Math.round(s.stampTax) + Math.round(incomeTax);
  var taxRate = totalValue > 0 ? totalTax / totalValue * 100 : 0;
  var vatRate = totalValue > 0 ? vatTax / totalValue * 100 : 0;
  var latRate = totalValue > 0 ? latTax / totalValue * 100 : 0;
  var incomeRate = totalValue > 0 ? incomeTax / totalValue * 100 : 0;
  var invoiceRate = s.invoiceRate || 90;
  var landValueRate = totalValue > 0 ? s.landCostTotal / totalValue * 100 : 0;
  var buildValueRate = totalValue > 0 ? s.buildTotal / totalValue * 100 : 0;
  var directValueRate = totalValue > 0 ? s.directCostTotal / totalValue * 100 : 0;
  var projectProfitText = readProjectMeasureText('proj_net_profit_val', d(s.netProfit));

  var costTips = [];
  if (landValueRate < 15) {
    costTips.push('土地成本占货值仅' + taxRisk(d2(landValueRate) + '%') + '，明显偏低。土地成本是土地增值税的重要扣除项目，比例过低会推高增值额和增值率，对土增税跳档影响较大。');
  } else if (landValueRate < 25) {
    costTips.push('土地成本占货值约' + taxWarn(d2(landValueRate) + '%') + '，扣除基础偏薄。若土增税已接近20%、50%、100%等临界点，应优先校验土地价款、契税、配套费、补缴土地款等是否完整计入。');
  } else {
    costTips.push('土地成本占货值约' + taxGood(d2(landValueRate) + '%') + '，土地扣除基础相对充分，但仍需关注不同业态间土地成本分摊是否与税务口径一致。');
  }
  if (buildValueRate < 25) {
    costTips.push('建安成本占货值约' + taxRisk(d2(buildValueRate) + '%') + '，偏低。建安成本会影响增值税进项抵扣、土地增值税扣除项目和企业所得税税前扣除，偏低会同时抬高多个税种压力。');
  } else if (buildValueRate < 35) {
    costTips.push('建安成本占货值约' + taxWarn(d2(buildValueRate) + '%') + '，处于需要关注区间。建议核对地下室、配套、车位、精装及不可售部分成本是否完整归集。');
  } else {
    costTips.push('建安成本占货值约' + taxGood(d2(buildValueRate) + '%') + '，建安扣除基础相对充分，后续重点关注发票取得比例和成本分摊口径。');
  }
  if (directValueRate < 45) {
    costTips.push('土地+建安直接成本合计占货值约' + taxRisk(d2(directValueRate) + '%') + '，整体成本底盘偏低。若当前土增税较高，优先从“降低售价”和“增加真实可扣成本”两侧测算临界点。');
  } else if (directValueRate < 60) {
    costTips.push('土地+建安直接成本合计占货值约' + taxWarn(d2(directValueRate) + '%') + '，需结合土增增值率判断是否存在跳档风险。');
  } else {
    costTips.push('土地+建安直接成本合计占货值约' + taxGood(d2(directValueRate) + '%') + '，综合扣除基础较好，税筹重点可转向收入结构、车位模式和进项抵扣。');
  }

  var vatTips = [];
  vatTips.push('增值税=销项税额-进项税额，当前应交增值税约' + taxRisk(d(vatTax) + '万元') + '，占货值' + taxWarn(d2(vatRate) + '%') + '。若销售价格仍可调整，' + taxRisk('降低含税售价') + '会同步压低销项税额，但需同时评估利润率影响。');
  if (invoiceRate < 100) {
    vatTips.push('当前取票率为' + taxRisk(d2(invoiceRate) + '%') + '，可优先提高建安、配套及费用类增值税专票取得比例。按本模型，' + taxRisk('取票率越高，进项抵扣越充分') + '，应交增值税和附加税越低。');
  } else {
    vatTips.push('当前取票率已按' + taxGood('100%') + '考虑，增值税优化空间主要在销售收入结构、土地差额扣除资料完整性和车位收入口径。');
  }
  if (s.valueParking > 0 || s.parkGiftValue > 0) {
    vatTips.push(taxRisk('车位收入在模型中不得参与土地差额扣除') + '。车位售价、公允价值或去化比例越高，通常会增加销项税额，应结合销售策略控制车位收入确认节奏。');
  }
  if (s.useEstTax) {
    vatTips.push('当前勾选了' + taxWarn('预估税率对比') + '，税费合计仍按明细税额计算，括号内展示预估税额相对明细税额的差异。');
  }

  var latTips = [];
  var types = dl.types || [];
  if (types.length === 0) {
    latTips.push('未读取到详细土增分业态结果，建议先展开或刷新详细土增计算后再判断跳档空间。');
  }
  for (var i = 0; i < types.length; i++) {
    var t = types[i];
    var rate = t.rate || 0;
    if (t.valueAdded <= 0) {
      latTips.push(taxGood(t.name + '当前增值额小于等于0') + '，暂不征土地增值税，后续售价上调或成本下降时需要重新校验。');
      continue;
    }
    if (t.exempt20 && rate <= 20) {
      latTips.push(t.name + '当前增值率约' + taxGood(d2(rate) + '%') + '，已控制在' + taxGood('20%免征线以内') + '，后续售价上调前应先测算是否突破20%。');
    } else if (t.exempt20 && rate > 20) {
      latTips.push(t.name + '当前增值率约' + taxRisk(d2(rate) + '%') + '，已超过' + taxRisk('20%免征线') + '。可优先通过' + taxRisk('降低住宅售价、增加可扣除建安/配套成本、优化土地成本分摊') + '等方式，争取压回20%以内。');
    }
    if (rate > 0 && rate <= 50 && rate >= 45) {
      latTips.push(t.name + '当前增值率约' + taxWarn(d2(rate) + '%') + '，接近' + taxWarn('50%跳档线') + '，应重点控制售价上调和成本下降，避免进入40%税率档。');
    } else if (rate > 50 && rate <= 100) {
      latTips.push(t.name + '当前增值率约' + taxRisk(d2(rate) + '%') + '，处于' + taxRisk('40%税率档') + '。若接近50%，可测算少量降价或增加扣除项目能否回到30%税率档；若接近100%，避免继续上跳。');
    } else if (rate > 100 && rate <= 200) {
      latTips.push(t.name + '当前增值率约' + taxRisk(d2(rate) + '%') + '，处于' + taxRisk('50%税率档') + '。建议测算增加可扣成本、降低商业/车位价格或调整收入归属，优先避免靠近200%档。');
    } else if (rate > 200) {
      latTips.push(t.name + '当前增值率约' + taxRisk(d2(rate) + '%') + '，已进入' + taxRisk('最高档') + '。税筹重点应放在增加可扣成本、降低高增值业态收入、重新校验土地和建安分摊依据。');
    }
  }
  latTips.push('土地增值税对' + taxRisk('售价和扣除项目') + '非常敏感。实操上建议用“住宅均价敏感性”和“楼面价敏感性”反复测算，优先寻找' + taxWarn('20%、50%、100%、200%临界点') + '附近的最优方案。');

  var incomeTips = [];
  if (incomeTax > 0) {
    incomeTips.push('当前利润总额约' + taxRisk(d(profitBeforeTax) + '万元') + '，企业所得税约' + taxRisk(d(incomeTax) + '万元') + '。所得税优化本质是降低应纳税所得额：' + taxRisk('降低收入、增加可税前扣除成本费用、减少不得扣除项') + '。');
    incomeTips.push('建安成本、营销费用、管理费用、财务费用应尽量取得合法有效票据并准确归集。' + taxRisk('能税前扣除的真实成本越完整，企业所得税越低') + '。');
  } else {
    incomeTips.push(taxGood('当前利润总额小于等于0') + '，模型下暂不产生企业所得税。后续售价上调、成本下降或土增税降低后，需重新观察所得税是否恢复。');
  }
  if (s.parkMode === '2' && parkNotDeduct > 0) {
    incomeTips.push('当前车位模式为“赠送无产权”，模型中车位建安成本约' + taxRisk(d(parkNotDeduct) + '万元不得税前扣除') + '，会抬高企业所得税。若销售策略允许，可对比销售类或有产权口径的综合税负。');
  } else if (s.parkIsGift) {
    incomeTips.push('当前车位为' + taxWarn('赠送类') + '，需关注公允价值视同销售收入与建安成本扣除口径，避免因赠送安排导致所得税或土增税口径不利。');
  }
  incomeTips.push('若项目利润率较高，可重点测算：' + taxRisk('适度降低售价、增加真实可扣成本、提高融资和配套费用的合规入账完整度') + '，观察所得税与土增税是否同步下降。');

  var strategyTips = [];
  strategyTips.push('优先顺序建议：先看' + taxRisk('土地增值税跳档线') + '，再看' + taxWarn('增值税进项抵扣') + '，最后看所得税利润总额。土增跳档通常对综合税负影响最大。');
  strategyTips.push(taxRisk('“降售价”') + '会降低增值税、土增税和所得税，但也会降低货值和利润；' + taxRisk('“增成本”') + '会降低土增税和所得税，且可能提高进项抵扣，但必须真实、合规、可取得票据。');
  strategyTips.push('税筹结论应以本地税务口径、合同安排、发票链条、成本归集资料为准，当前弹窗仅按本测算模型给出方向性建议。');

  var h = '';
  h += taxPlanSection('成本货值占比诊断', costTips);
  h += '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:14px">';
  h += taxPlanMetric('综合税负', d(totalTax) + '万', d2(taxRate) + '%');
  h += taxPlanMetric('增值税', d(vatTax) + '万', d2(vatRate) + '%');
  h += taxPlanMetric('土增税', d(latTax) + '万', d2(latRate) + '%');
  h += taxPlanMetric('所得税', d(incomeTax) + '万', d2(incomeRate) + '%');
  h += taxPlanMetric('项目利润', projectProfitText + '万', '取自项目测算表');
  h += '</div>';
  h += taxPlanSection('增值税优化', vatTips);
  h += taxPlanSection('土地增值税优化', latTips);
  h += taxPlanSection('企业所得税优化', incomeTips);
  h += taxPlanSection('综合策略', strategyTips);
  return h;
}

function readProjectMeasureText(id, fallback) {
  var el = document.getElementById(id);
  var text = el ? (el.textContent || '').trim() : '';
  return text || fallback || '-';
}

function taxPlanMetric(label, value, sub) {
  return '<div style="border:1px solid #e7e5e4;border-radius:6px;padding:8px 10px;background:#fafaf9"><div style="font-size:0.68rem;color:#78716c">' + label + '</div><div style="font-size:0.95rem;font-weight:700;color:#1c1917">' + value + '</div><div style="font-size:0.68rem;color:#78716c">' + sub + '</div></div>';
}

function taxOptimizationMetric(label, value, rateText, deltaText, color, bg) {
  return '<div style="border:1px solid ' + color + ';border-radius:6px;padding:8px 10px;background:' + bg + '"><div style="font-size:0.68rem;color:#78716c">' + label + '</div><div style="font-size:0.95rem;font-weight:700;color:' + color + '">' + value + '</div><div style="font-size:0.68rem;color:#78716c">' + rateText + ' <span style="color:' + color + ';font-weight:700">' + deltaText + '</span></div></div>';
}

function taxPlanSection(title, items) {
  return '<section style="margin-top:12px"><h3 style="font-size:0.9rem;margin:0 0 4px 0;color:#292524">' + title + '</h3>' + taxPlanList(items) + '</section>';
}

function showTaxPlanningAdvice() {
  var s = window._projectTaxSummary;
  if (!s) {
    alert('请先生成项目测算后再查看税筹建议');
    return;
  }
  hideTaxPlanningAdvice();
  var modal = document.createElement('div');
  modal.id = 'taxPlanModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(28,25,23,0.45);z-index:99999;display:flex;align-items:center;justify-content:center;padding:24px';
  modal.onclick = function(e) { if (e.target === modal) hideTaxPlanningAdvice(); };
  modal.innerHTML =
    '<div style="width:min(980px,100%);max-height:88vh;overflow:auto;background:#fff;border-radius:10px;box-shadow:0 18px 60px rgba(0,0,0,0.28);padding:18px 20px;color:#1c1917">' +
      '<div style="display:flex;align-items:center;gap:12px;border-bottom:1px solid #e7e5e4;padding-bottom:10px;margin-bottom:12px">' +
        '<div style="font-size:1rem;font-weight:700">税筹建议</div>' +
        '<div style="font-size:0.72rem;color:#78716c">基于当前税费测算、详细土增和车位模式自动生成</div>' +
        '<button type="button" onclick="hideTaxPlanningAdvice()" style="margin-left:auto;border:1px solid #d6d3d1;background:#fff;border-radius:6px;padding:5px 12px;cursor:pointer;color:#44403c">关闭</button>' +
      '</div>' +
      '<div style="font-size:0.78rem">' + buildTaxPlanningAdviceHtml(s) + '</div>' +
    '</div>';
  document.body.appendChild(modal);
}

function hideTaxPlanningAdvice() {
  var modal = document.getElementById('taxPlanModal');
  if (modal && modal.parentNode) modal.parentNode.removeChild(modal);
}

function taxOptimizationFmt(v, digits) {
  if (v == null || isNaN(v)) return '-';
  return Number(v).toLocaleString('zh-CN', { maximumFractionDigits: digits || 0 });
}

function taxOptimizationInputValue(id, fallback) {
  var el = document.getElementById(id);
  if (!el) return fallback || 0;
  var v = parseFloat(el.value);
  return isNaN(v) ? (fallback || 0) : v;
}

function taxOptimizationSetInput(id, value) {
  var el = document.getElementById(id);
  if (!el) return;
  el.value = Math.round(value);
}

function taxOptimizationReadState() {
  var s = window._projectTaxSummary || {};
  var parkingInputId = s.parkIsGift ? 'park_gift_price' : 'price_parking';
  return {
    parkMode: s.parkMode || window._parkModeForCalc || '1',
    parkingInputId: parkingInputId,
    priceRes: taxOptimizationInputValue('price_res', s.priceRes || 0),
    priceComBottom: taxOptimizationInputValue('price_com_bottom', s.priceComBottom || 0),
    priceComCentral: taxOptimizationInputValue('price_com_central', s.priceComCentral || 0),
    priceComComplex: taxOptimizationInputValue('price_com_complex', s.priceComComplex || 0),
    priceBuild: taxOptimizationInputValue('price_build', s.priceBuild || 0),
    priceParking: taxOptimizationInputValue(parkingInputId, s.priceParking || 30000),
    invoiceRate: taxOptimizationInputValue('invoice_rate', s.invoiceRate || 90)
  };
}

function taxOptimizationCloneState(state) {
  var next = {};
  for (var k in state) if (Object.prototype.hasOwnProperty.call(state, k)) next[k] = state[k];
  return next;
}

function taxOptimizationApplyState(state) {
  taxOptimizationSetInput('price_res', state.priceRes);
  taxOptimizationSetInput('price_com_bottom', state.priceComBottom);
  taxOptimizationSetInput('price_com_central', state.priceComCentral);
  taxOptimizationSetInput('price_com_complex', state.priceComComplex);
  taxOptimizationSetInput('price_build', state.priceBuild);
  taxOptimizationSetInput(state.parkingInputId, state.priceParking);
  taxOptimizationSetInput('invoice_rate', state.invoiceRate);
  var parkSel = document.getElementById('park_mode_select');
  if (parkSel) parkSel.value = state.parkMode;
  window._parkModeForCalc = state.parkMode;
  if (typeof runProjectCalc === 'function') runProjectCalc();
}

function taxOptimizationCollectMetrics(state) {
  var s = window._projectTaxSummary || {};
  var dl = window._detailedLatResult || {};
  var types = dl.types || [];
  var taxTotal = s.taxTotalDetail != null ? s.taxTotalDetail : (s.taxTotal || 0);
  var netProfit = (s.totalValue || 0) - (s.directCostTotal || 0) - (s.feeTotal || 0) - taxTotal;
  var profitRate = s.totalValue > 0 ? netProfit / s.totalValue * 100 : 0;
  var ordinaryRate = null;
  var jumpScore = 0;
  for (var i = 0; i < types.length; i++) {
    var t = types[i];
    var rate = t.rate || 0;
    if (String(t.name || '') === '普通住宅') ordinaryRate = rate;
    if (t.exempt20 && rate > 20) jumpScore += 100 + (rate - 20) * 2;
    if (rate > 50) jumpScore += 20;
    if (rate > 100) jumpScore += 40;
    if (rate > 200) jumpScore += 80;
    if (rate > 45 && rate <= 50) jumpScore += 2;
    if (rate > 95 && rate <= 100) jumpScore += 2;
    if (rate > 195 && rate <= 200) jumpScore += 2;
  }
  var ordinaryPenalty = ordinaryRate != null && ordinaryRate > 20 ? ordinaryRate - 20 : 0;
  return {
    state: taxOptimizationCloneState(state),
    totalValue: s.totalValue || 0,
    taxTotal: taxTotal,
    taxRate: s.totalValue > 0 ? taxTotal / s.totalValue * 100 : 0,
    latTax: dl.total != null ? dl.total : (s.latTax || 0),
    netProfit: netProfit,
    profitRate: profitRate,
    ordinaryRate: ordinaryRate,
    ordinaryPenalty: ordinaryPenalty,
    jumpScore: jumpScore
  };
}

function taxOptimizationMinProfitRate() {
  var s = window._projectTaxSummary || {};
  var baseRate = s.profitRate != null && !isNaN(s.profitRate) ? s.profitRate : 0;
  return Math.max(0, baseRate - 0.3);
}

function taxOptimizationCompare(a, b) {
  if (!b) return -1;
  var minRate = taxOptimizationMinProfitRate();
  var aOk = a.profitRate >= minRate;
  var bOk = b.profitRate >= minRate;
  if (aOk !== bOk) return aOk ? -1 : 1;
  if (!aOk && Math.abs(a.profitRate - b.profitRate) > 0.01) return b.profitRate - a.profitRate;
  if (aOk && Math.abs(a.profitRate - b.profitRate) > 0.5) return b.profitRate - a.profitRate;
  if (Math.abs(a.ordinaryPenalty - b.ordinaryPenalty) > 0.01) return a.ordinaryPenalty - b.ordinaryPenalty;
  if (Math.abs(a.jumpScore - b.jumpScore) > 0.01) return a.jumpScore - b.jumpScore;
  if (Math.abs(a.taxTotal - b.taxTotal) > 1) return a.taxTotal - b.taxTotal;
  if (Math.abs(a.netProfit - b.netProfit) > 1) return b.netProfit - a.netProfit;
  return b.profitRate - a.profitRate;
}

function taxOptimizationUniqueValues(values) {
  var out = [];
  var seen = {};
  for (var i = 0; i < values.length; i++) {
    var v = Math.max(0, Math.round(values[i]));
    if (!seen[v]) { seen[v] = true; out.push(v); }
  }
  return out;
}

function taxOptimizationGroups(base) {
  var groups = [
    { key: 'priceRes', label: '住宅单价', values: taxOptimizationUniqueValues([base.priceRes - 500, base.priceRes - 250, base.priceRes, base.priceRes + 250, base.priceRes + 500]) }
  ];
  if (base.priceComBottom > 0) groups.push({ key: 'priceComBottom', label: '裙楼商业单价', values: taxOptimizationUniqueValues([base.priceComBottom - 500, base.priceComBottom, base.priceComBottom + 500]) });
  if (base.priceComCentral > 0) groups.push({ key: 'priceComCentral', label: '集中商业单价', values: taxOptimizationUniqueValues([base.priceComCentral - 500, base.priceComCentral, base.priceComCentral + 500]) });
  if (base.priceComComplex > 0) groups.push({ key: 'priceComComplex', label: '商业综合楼单价', values: taxOptimizationUniqueValues([base.priceComComplex - 500, base.priceComComplex, base.priceComComplex + 500]) });
  groups.push({ key: 'priceBuild', label: '建安单方', values: taxOptimizationUniqueValues([base.priceBuild - 200, base.priceBuild, base.priceBuild + 200, base.priceBuild + 400]) });
  groups.push({ key: 'priceParking', label: base.parkingInputId === 'park_gift_price' ? '车位公允价' : '车位单价', values: taxOptimizationUniqueValues([base.priceParking - 5000, base.priceParking, base.priceParking + 5000]) });
  groups.push({ key: 'invoiceRate', label: '取票率', values: taxOptimizationUniqueValues([80, 85, 90, 95, 100]) });
  return groups;
}

function taxOptimizationTrialState(current, group, value) {
  var next = taxOptimizationCloneState(current);
  if (group.key === 'commercialDelta') {
    next.priceComBottom = current.priceComBottom > 0 ? Math.max(0, current.priceComBottom + value) : 0;
    next.priceComCentral = current.priceComCentral > 0 ? Math.max(0, current.priceComCentral + value) : 0;
    next.priceComComplex = current.priceComComplex > 0 ? Math.max(0, current.priceComComplex + value) : 0;
  } else {
    next[group.key] = Math.max(0, Math.round(value));
  }
  if (group.key === 'invoiceRate') next.invoiceRate = Math.min(100, Math.max(0, Math.round(value)));
  return next;
}

function taxOptimizationReadSelection() {
  var checks = document.querySelectorAll('#taxOptimizationResult input[data-opt-key]');
  var selection = { hasControls: checks.length > 0, selectedCount: 0, map: null };
  if (!selection.hasControls) return selection;
  selection.map = {};
  for (var i = 0; i < checks.length; i++) {
    var key = checks[i].getAttribute('data-opt-key');
    selection.map[key] = checks[i].checked;
    if (checks[i].checked) selection.selectedCount++;
  }
  return selection;
}

function taxOptimizationFilterGroups(groups, selection) {
  if (!selection || !selection.hasControls || !selection.map) return groups;
  var out = [];
  for (var i = 0; i < groups.length; i++) {
    if (selection.map[groups[i].key] !== false) out.push(groups[i]);
  }
  return out;
}

function taxOptimizationIsChecked(key, selectionMap) {
  return !selectionMap || selectionMap[key] !== false;
}

function taxOptimizationTick() {
  return new Promise(function(resolve) { setTimeout(resolve, 0); });
}

async function runTaxOptimizationSearch() {
  var modal = document.getElementById('taxOptimizationModal');
  if (!modal) return;
  var status = document.getElementById('taxOptimizationStatus');
  var progressBar = document.getElementById('taxOptimizationProgressBar');
  var progressText = document.getElementById('taxOptimizationProgressText');
  var resultBox = document.getElementById('taxOptimizationResult');
  var applyBtn = document.getElementById('taxOptimizationApplyBtn');
  var runBtn = document.getElementById('taxOptimizationRunBtn');
  var selection = taxOptimizationReadSelection();
  if (selection.hasControls && selection.selectedCount === 0) {
    alert('请至少勾选一项参与模拟优化');
    return;
  }
  if (applyBtn) applyBtn.disabled = true;
  if (runBtn) runBtn.disabled = true;
  if (resultBox) resultBox.innerHTML = '';
  if (progressBar) progressBar.style.width = '0%';
  if (progressText) progressText.textContent = '0%';

  var baseState = taxOptimizationReadState();
  var main = document.getElementById('mainContent');
  var oldOpacity = main ? main.style.opacity : '';
  if (main) main.style.opacity = '0.35';

  var best = null;
  var currentState = taxOptimizationCloneState(baseState);
  var evalCount = 0;
  try {
    taxOptimizationApplyState(baseState);
    var baseEval = taxOptimizationCollectMetrics(baseState);
    best = baseEval;
    var currentEval = baseEval;
    var groups = taxOptimizationFilterGroups(taxOptimizationGroups(baseState), selection);
    var totalEval = 0;
    for (var tg = 0; tg < groups.length; tg++) totalEval += groups[tg].values.length;
    totalEval = totalEval * 2;
    for (var round = 0; round < 2; round++) {
      for (var gi = 0; gi < groups.length; gi++) {
        var group = groups[gi];
        var groupBest = currentEval;
        var groupBestState = taxOptimizationCloneState(currentState);
        for (var vi = 0; vi < group.values.length; vi++) {
          if (window._taxOptimizationAbort) {
            taxOptimizationApplyState(baseState);
            return;
          }
          var pct = totalEval > 0 ? Math.min(99, Math.round(evalCount / totalEval * 100)) : 0;
          if (progressBar) progressBar.style.width = pct + '%';
          if (progressText) progressText.textContent = pct + '%';
          if (status) status.textContent = '模拟中：第' + (round + 1) + '轮，调整' + group.label + '（' + (evalCount + 1) + '/' + totalEval + '组）';
          var trial = taxOptimizationTrialState(currentState, group, group.values[vi]);
          taxOptimizationApplyState(trial);
          var ev = taxOptimizationCollectMetrics(trial);
          evalCount++;
          pct = totalEval > 0 ? Math.min(99, Math.round(evalCount / totalEval * 100)) : 0;
          if (progressBar) progressBar.style.width = pct + '%';
          if (progressText) progressText.textContent = pct + '%';
          if (taxOptimizationCompare(ev, groupBest) < 0) {
            groupBest = ev;
            groupBestState = taxOptimizationCloneState(trial);
          }
          await taxOptimizationTick();
        }
        currentState = groupBestState;
        currentEval = groupBest;
        if (taxOptimizationCompare(groupBest, best) < 0) best = groupBest;
      }
    }
    taxOptimizationApplyState(baseState);
    window._taxOptimizationBest = { baseState: baseState, baseEval: baseEval, bestState: best.state, bestEval: best, evalCount: evalCount };
    if (progressBar) progressBar.style.width = '100%';
    if (progressText) progressText.textContent = '100%';
    if (status) status.textContent = '模拟完成：已搜索' + evalCount + '组组合，当前页面仍保持原输入，点击“应用推荐”后回写。';
    if (resultBox) resultBox.innerHTML = buildTaxOptimizationResultHtml(baseState, baseEval, best.state, best, evalCount, selection.map);
    if (applyBtn) applyBtn.disabled = false;
  } finally {
    if (main) main.style.opacity = oldOpacity;
    if (runBtn) runBtn.disabled = false;
  }
}

function buildTaxOptimizationResultHtml(baseState, baseEval, bestState, bestEval, evalCount, selectionMap) {
  var normalNow = baseEval.ordinaryRate == null ? '-' : taxOptimizationFmt(baseEval.ordinaryRate, 2) + '%';
  var normalBest = bestEval.ordinaryRate == null ? '-' : taxOptimizationFmt(bestEval.ordinaryRate, 2) + '%';
  var taxDelta = bestEval.taxTotal - baseEval.taxTotal;
  var profitDelta = bestEval.netProfit - baseEval.netProfit;
  var taxColor = taxDelta <= 0 ? '#dc2626' : '#16a34a';
  var taxBg = taxDelta <= 0 ? '#fef2f2' : '#f0fdf4';
  var profitColor = profitDelta >= 0 ? '#16a34a' : '#dc2626';
  var profitBg = profitDelta >= 0 ? '#f0fdf4' : '#fef2f2';
  var taxDeltaText = '（' + (taxDelta <= 0 ? '↓' : '↑') + taxOptimizationFmt(Math.abs(taxDelta)) + '万）';
  var profitDeltaText = '（' + (profitDelta >= 0 ? '↑' : '↓') + taxOptimizationFmt(Math.abs(profitDelta)) + '万）';
  var h = '';
  h += '<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:12px 0">';
  h += taxPlanMetric('当前税费', taxOptimizationFmt(baseEval.taxTotal) + '万', taxOptimizationFmt(baseEval.taxRate, 2) + '%');
  h += taxOptimizationMetric('优化税费', taxOptimizationFmt(bestEval.taxTotal) + '万', taxOptimizationFmt(bestEval.taxRate, 2) + '%', taxDeltaText, taxColor, taxBg);
  h += taxPlanMetric('当前净利润', taxOptimizationFmt(baseEval.netProfit) + '万', taxOptimizationFmt(baseEval.profitRate, 2) + '%');
  h += taxOptimizationMetric('优化净利润', taxOptimizationFmt(bestEval.netProfit) + '万', taxOptimizationFmt(bestEval.profitRate, 2) + '%', profitDeltaText, profitColor, profitBg);
  h += '</div>';
  h += '<table style="width:100%;border-collapse:collapse;font-size:0.76rem;margin-top:10px">';
  h += '<thead><tr style="background:#e8ecf0"><th style="padding:6px;border:1px solid #ddd;text-align:left">项目</th><th style="padding:6px;border:1px solid #ddd">当前</th><th style="padding:6px;border:1px solid #ddd">推荐</th><th style="padding:6px;border:1px solid #ddd">说明</th></tr></thead><tbody>';
  h += taxOptimizationRow('priceRes', '住宅单价', baseState.priceRes, bestState.priceRes, '影响普通住宅增值率和所得税', selectionMap);
  if (baseState.priceComBottom > 0) h += taxOptimizationRow('priceComBottom', '裙楼商业单价', baseState.priceComBottom, bestState.priceComBottom, '商业土增税跳档敏感项', selectionMap);
  if (baseState.priceComCentral > 0) h += taxOptimizationRow('priceComCentral', '集中商业单价', baseState.priceComCentral, bestState.priceComCentral, '商业土增税跳档敏感项', selectionMap);
  if (baseState.priceComComplex > 0) h += taxOptimizationRow('priceComComplex', '商业综合楼单价', baseState.priceComComplex, bestState.priceComComplex, '商业土增税跳档敏感项', selectionMap);
  h += taxOptimizationRow('priceBuild', '建安单方', baseState.priceBuild, bestState.priceBuild, '影响进项抵扣、土增扣除和所得税成本', selectionMap);
  h += taxOptimizationRow('priceParking', baseState.parkingInputId === 'park_gift_price' ? '车位公允价' : '车位单价', baseState.priceParking, bestState.priceParking, '按非人防车位去化口径测算', selectionMap);
  h += '<tr><td style="padding:6px;border:1px solid #ddd;white-space:nowrap"><label style="display:inline-flex;align-items:center;gap:6px;flex-direction:row;white-space:nowrap"><input type="checkbox" data-opt-key="invoiceRate"' + (taxOptimizationIsChecked('invoiceRate', selectionMap) ? ' checked' : '') + ' style="width:auto;accent-color:#d97706;flex:0 0 auto">取票率</label></td><td style="padding:6px;border:1px solid #ddd;text-align:center">' + taxOptimizationFmt(baseState.invoiceRate, 1) + '%</td><td style="padding:6px;border:1px solid #ddd;text-align:center;font-weight:700">' + taxOptimizationFmt(bestState.invoiceRate, 1) + '%</td><td style="padding:6px;border:1px solid #ddd;color:#78716c">影响增值税进项和土增建安扣除</td></tr>';
  h += '<tr><td style="padding:6px;border:1px solid #ddd">普通住宅增值率</td><td style="padding:6px;border:1px solid #ddd;text-align:center">' + normalNow + '</td><td style="padding:6px;border:1px solid #ddd;text-align:center;font-weight:700;color:' + (bestEval.ordinaryRate != null && bestEval.ordinaryRate <= 20 ? '#16a34a' : '#dc2626') + '">' + normalBest + '</td><td style="padding:6px;border:1px solid #ddd;color:#78716c">优先争取控制在20%免征线内</td></tr>';
  h += '<tr><td style="padding:6px;border:1px solid #ddd">土地增值税</td><td style="padding:6px;border:1px solid #ddd;text-align:center">' + taxOptimizationFmt(baseEval.latTax) + '万</td><td style="padding:6px;border:1px solid #ddd;text-align:center;font-weight:700">' + taxOptimizationFmt(bestEval.latTax) + '万</td><td style="padding:6px;border:1px solid #ddd;color:#78716c">兼顾20%、50%、100%、200%临界点</td></tr>';
  h += '</tbody></table>';
  h += '<div style="font-size:0.72rem;color:#78716c;margin-top:10px">勾选项会参与下一次“重新模拟”；取消勾选后，该项保持当前输入值不参与搜索。模拟范围：住宅单价±500元/㎡、商业单价±500元/㎡、建安单方-200至+400元/㎡、车位单价±5000元/个、取票率80%-100%。排序优先保证项目收益率不低于当前收益率约0.3个百分点以内，再比较普通住宅20%免征线、土增跳档和综合税费。</div>';
  return h;
}

function taxOptimizationRow(key, label, fromValue, toValue, note, selectionMap) {
  var color = toValue > fromValue ? '#16a34a' : (toValue < fromValue ? '#dc2626' : '#44403c');
  var delta = toValue - fromValue;
  var deltaText = delta === 0 ? '不变' : ((delta > 0 ? '+' : '') + taxOptimizationFmt(delta));
  return '<tr><td style="padding:6px;border:1px solid #ddd;white-space:nowrap"><label style="display:inline-flex;align-items:center;gap:6px;flex-direction:row;white-space:nowrap"><input type="checkbox" data-opt-key="' + key + '"' + (taxOptimizationIsChecked(key, selectionMap) ? ' checked' : '') + ' style="width:auto;accent-color:#d97706;flex:0 0 auto">' + label + '</label></td><td style="padding:6px;border:1px solid #ddd;text-align:center">' + taxOptimizationFmt(fromValue) + '</td><td style="padding:6px;border:1px solid #ddd;text-align:center;font-weight:700;color:' + color + '">' + taxOptimizationFmt(toValue) + '（' + deltaText + '）</td><td style="padding:6px;border:1px solid #ddd;color:#78716c">' + note + '</td></tr>';
}

function showTaxOptimization() {
  var s = window._projectTaxSummary;
  if (!s) {
    alert('请先生成项目测算后再进行模拟优化');
    return;
  }
  hideTaxPlanningAdvice();
  hideTaxOptimization();
  window._taxOptimizationAbort = false;
  var modal = document.createElement('div');
  modal.id = 'taxOptimizationModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(28,25,23,0.45);z-index:99999;display:flex;align-items:center;justify-content:center;padding:24px';
  modal.onclick = function(e) { if (e.target === modal) hideTaxOptimization(); };
  modal.innerHTML =
    '<div style="width:min(1080px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:10px;box-shadow:0 18px 60px rgba(0,0,0,0.28);padding:18px 20px;color:#1c1917">' +
      '<div style="display:flex;align-items:center;gap:12px;border-bottom:1px solid #e7e5e4;padding-bottom:10px;margin-bottom:12px">' +
        '<div><div style="font-size:1rem;font-weight:700">模拟优化</div><div style="font-size:0.72rem;color:#78716c">自动搜索单价、建安单方和取票率组合，优先压住普通住宅20%免征线和土增跳档。</div></div>' +
        '<div style="margin-left:auto;display:flex;gap:8px;flex-shrink:0">' +
          '<button id="taxOptimizationRunBtn" type="button" onclick="runTaxOptimizationSearch()" style="border:1px solid #d97706;background:#fff;border-radius:6px;padding:5px 12px;cursor:pointer;color:#d97706">重新模拟</button>' +
          '<button id="taxOptimizationApplyBtn" type="button" onclick="applyTaxOptimization()" disabled style="border:1px solid #16a34a;background:#fff;border-radius:6px;padding:5px 12px;cursor:pointer;color:#16a34a">应用推荐</button>' +
          '<button type="button" onclick="hideTaxOptimization()" style="border:1px solid #d6d3d1;background:#fff;border-radius:6px;padding:5px 12px;cursor:pointer;color:#44403c">关闭</button>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:10px;margin:10px 0 8px">' +
        '<div style="height:8px;flex:1;background:#f1f5f9;border-radius:999px;overflow:hidden;border:1px solid #e2e8f0">' +
          '<div id="taxOptimizationProgressBar" style="height:100%;width:0%;background:#d97706;border-radius:999px;transition:width 0.16s ease"></div>' +
        '</div>' +
        '<div id="taxOptimizationProgressText" style="width:42px;text-align:right;font-size:0.72rem;color:#78716c;font-variant-numeric:tabular-nums">0%</div>' +
      '</div>' +
      '<div id="taxOptimizationStatus" style="font-size:0.76rem;color:#78716c">准备模拟...</div>' +
      '<div id="taxOptimizationResult" style="font-size:0.78rem"></div>' +
    '</div>';
  document.body.appendChild(modal);
  setTimeout(function() { runTaxOptimizationSearch(); }, 0);
}

function applyTaxOptimization() {
  var best = window._taxOptimizationBest;
  if (!best || !best.bestState) {
    alert('暂无可应用的推荐方案，请先完成模拟优化');
    return;
  }
  taxOptimizationApplyState(best.bestState);
  hideTaxOptimization();
}

function hideTaxOptimization() {
  window._taxOptimizationAbort = true;
  var modal = document.getElementById('taxOptimizationModal');
  if (modal && modal.parentNode) modal.parentNode.removeChild(modal);
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    hideProjectMeasureNoteEditor();
    hideProjectMeasureImagePreview();
    hideTaxPlanningAdvice();
    hideTaxOptimization();
    hideSensitivityChartModal();
  }
});

window.showTaxPlanningAdvice = showTaxPlanningAdvice;
window.hideTaxPlanningAdvice = hideTaxPlanningAdvice;
window.showTaxOptimization = showTaxOptimization;
window.hideTaxOptimization = hideTaxOptimization;
window.runTaxOptimizationSearch = runTaxOptimizationSearch;
window.applyTaxOptimization = applyTaxOptimization;
window.showSensitivityChartModal = showSensitivityChartModal;
window.hideSensitivityChartModal = hideSensitivityChartModal;
window.generateProjectMeasureImage = generateProjectMeasureImage;
window.copyProjectMeasurePreviewImage = copyProjectMeasurePreviewImage;
window.saveProjectMeasurePreviewImage = saveProjectMeasurePreviewImage;
window.hideProjectMeasureImagePreview = hideProjectMeasureImagePreview;
window.showProjectMeasureNoteEditor = showProjectMeasureNoteEditor;
window.hideProjectMeasureNoteEditor = hideProjectMeasureNoteEditor;
window.saveProjectMeasureNote = saveProjectMeasureNote;
window.buildProjectMeasureDefaultNote = buildProjectMeasureDefaultNote;
window.runProjectCalc = runProjectCalc;
