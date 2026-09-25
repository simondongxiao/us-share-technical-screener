(function () {
  'use strict';

  var state = { data: null };
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]; }); }
  function num(value, digits) { var n = Number(value); return Number.isFinite(n) ? n.toFixed(digits == null ? 2 : digits) : '待成熟'; }
  function pct(value) { var n = Number(value); return Number.isFinite(n) ? (n >= 0 ? '+' : '') + n.toFixed(2) + '%' : '待成熟'; }
  function css() {
    if (document.getElementById('strategyBacktestStyle')) return;
    var style = document.createElement('style'); style.id = 'strategyBacktestStyle';
    style.textContent = '#strategyBacktestPanel{display:none;position:fixed;inset:0;z-index:24;background:#f6f5f1;color:#18211f;overflow:auto;font:14px/1.45 Arial,"Microsoft YaHei",sans-serif}.stratHead{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 16px;border-bottom:1px solid #dedbd2;background:#ebe7dc}.stratBrand{font-weight:800;font-size:20px;margin-right:8px}.stratBtn{height:34px;border:1px solid #c9c5b9;background:#fffdfa;border-radius:6px;padding:0 10px;cursor:pointer}.stratBody{padding:14px 16px 28px}.stratNote{border:1px solid #c9c5b9;background:#fffdfa;padding:10px 12px;margin-bottom:12px}.stratCards{display:grid;grid-template-columns:repeat(6,minmax(120px,1fr));gap:8px;margin-bottom:12px}.stratCard{background:#fffdfa;border:1px solid #dedbd2;border-radius:6px;padding:9px}.stratCard span{display:block;color:#67716e;font-size:12px}.stratCard b{display:block;font-size:17px;margin-top:3px}.stratSection{background:#fffdfa;border:1px solid #dedbd2;border-radius:6px;padding:12px;margin-bottom:12px}.stratSection h3{margin:0 0 8px;font-size:16px}.stratSection h3 span{font-size:12px;color:#67716e;font-weight:400}.stratTableWrap{overflow:auto}.stratTable{width:100%;border-collapse:collapse;min-width:1050px}.stratTable th,.stratTable td{padding:7px 8px;border-bottom:1px solid #ece9e1;text-align:right;white-space:nowrap}.stratTable th:first-child,.stratTable td:first-child,.stratTable th:nth-child(2),.stratTable td:nth-child(2),.stratTable th:nth-child(3),.stratTable td:nth-child(3){text-align:left}.stratTable th{background:#ebe7dc}.stratPositive{color:#c84435}.stratNegative{color:#11805a}.stratMuted{color:#67716e}.stratGrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.stratSmall{font-size:12px;color:#67716e;margin-top:7px}.stratClose{margin-left:auto}.stratBadge{display:inline-block;border:1px solid #c9c5b9;border-radius:999px;padding:2px 7px;font-size:12px}.stratTopRisk{color:#8d4b1e;border-color:#d7b48f;background:#fff7ed}@media(max-width:900px){.stratCards{grid-template-columns:repeat(2,1fr)}.stratGrid{grid-template-columns:1fr}.stratBrand{width:100%}.stratClose{margin-left:0}}';
    document.head.appendChild(style);
  }
  function metricTable(title, rows, group) {
    var body = Object.keys(rows || {}).map(function (key) {
      var item = rows[key], h = item.horizons || {};
      return '<tr><td>' + esc(item.label || (group === 'top' ? '顶部风险' : key)) + '</td><td>' + esc(key) + '</td>' + ['5','10','20'].map(function (d) { var s = h[d] || {}; return '<td>' + esc(s.matureSessions || 0) + '</td><td>' + pct(s.averagePct) + '</td><td>' + pct(s.winRatePct) + '</td><td>' + pct(s.maxDrawdownPct) + '</td>'; }).join('') + '</tr>';
    }).join('');
    return '<div class="stratSection"><h3>' + title + ' <span>每个信号日取前20等权</span></h3><div class="stratTableWrap"><table class="stratTable"><thead><tr><th>模式</th><th>参数</th><th colspan="4">5个交易日</th><th colspan="4">10个交易日</th><th colspan="4">20个交易日</th></tr><tr><th></th><th></th><th>成熟批次</th><th>平均收益</th><th>胜率</th><th>最大回撤</th><th>成熟批次</th><th>平均收益</th><th>胜率</th><th>最大回撤</th><th>成熟批次</th><th>平均收益</th><th>胜率</th><th>最大回撤</th></tr></thead><tbody>' + (body || '<tr><td colspan="14">暂无回测数据</td></tr>') + '</tbody></table></div></div>';
  }
  function signalTable(title, rows, risk) {
    var body = (rows || []).map(function (r, i) {
      var score = risk ? r.topRiskScore : r.longScore;
      var reason = risk ? (r.topRiskConfirmed ? '确认型顶部风险' : '顶部风险观察') : '长期机会候选';
      return '<tr><td>#' + esc(i + 1) + '</td><td><b>' + esc(r.ticker) + '</b><br><span class="stratMuted">' + esc(r.name) + '</span></td><td>' + num(r.price) + '</td><td>' + num(score) + '</td><td>' + pct(r.return5Pct) + '</td><td>' + pct(r.return20Pct) + '</td><td>' + esc(reason) + '</td><td>' + esc(r.action || (risk ? '2x反向 / Put候选' : '2x做多 / Call候选')) + '</td></tr>';
    }).join('');
    return '<div class="stratSection"><h3>' + title + ' <span>信号日 ' + esc(state.data.current.signalDate) + '</span></h3><div class="stratTableWrap"><table class="stratTable"><thead><tr><th>排名</th><th>Ticker / 公司</th><th>价格</th><th>信号分</th><th>历史5日</th><th>历史20日</th><th>状态</th><th>执行代理</th></tr></thead><tbody>' + (body || '<tr><td colspan="8">暂无符合数据的标的</td></tr>') + '</tbody></table></div></div>';
  }
  function evolution() {
    var ev = state.data.evolution || {}, blocks = ev.walkForwardBlocks || [];
    var body = blocks.slice(-12).map(function (b) { var s = b.outOfSample && b.outOfSample['5']; return '<tr><td>' + esc(b.testStart) + ' → ' + esc(b.testEnd) + '</td><td>' + esc(b.selectedConfigLabel) + '</td><td>' + esc(JSON.stringify(b.trainAverage2x5Pct)) + '</td><td>' + (s ? pct(s.averagePct) : '待成熟') + '</td><td>' + (s ? esc(s.matureSessions) : '0') + '</td></tr>'; }).join('');
    return '<div class="stratSection"><h3>Walk-forward 自我进化 <span>只用过去126日选择下一段63日参数</span></h3><div class="stratCards"><div class="stratCard"><span>当前冠军</span><b>' + esc(ev.currentChampionLabel || ev.currentChampion || 'N/A') + '</b></div><div class="stratCard"><span>样本外批次</span><b>' + esc(ev.outOfSample && ev.outOfSample.sessions || 0) + '</b></div><div class="stratCard"><span>候选参数</span><b>' + esc((ev.candidateConfigs || []).length) + '</b></div></div><div class="stratTableWrap"><table class="stratTable"><thead><tr><th>测试窗口</th><th>选中模式</th><th>训练期5日均值</th><th>样本外5日均值</th><th>样本外批次</th></tr></thead><tbody>' + (body || '<tr><td colspan="5">样本不足，尚未形成 walk-forward 批次</td></tr>') + '</tbody></table></div><div class="stratSmall">这不是自动追涨或用未来数据调参；每次只在历史训练窗口内比较均衡、趋势跟随、反转优先三种固定候选，下一测试窗口才使用胜出者。</div></div>';
  }
  function render() {
    var d = state.data, ev = d.evolution || {}, option = d.instrumentBoundary || {};
    document.getElementById('strategyBacktestBody').innerHTML = '<div class="stratNote"><b>回测边界：</b>当前页面已有机会名单收益跟踪；本模块新增正股1x、每日重置2x多头和2x反向代理。历史期权链尚未接入，因此 Call / Put 只作为方向候选，不把代理收益冒充期权权利金收益。<br><span class="stratMuted">回测区间 ' + esc(d.backtestStartDate || '-') + ' → ' + esc(d.backtestEndDate || '-') + ' · 信号日 ' + esc(d.eligibleSignalDates || 0) + ' · 当前 walk-forward 模式 ' + esc(ev.currentChampionLabel || '-') + '</span></div><div class="stratCards"><div class="stratCard"><span>长期机会前20</span><b>' + esc((d.current.longTop20 || []).length) + '</b></div><div class="stratCard"><span>顶部风险前20</span><b>' + esc((d.current.topRiskTop20 || []).length) + '</b></div><div class="stratCard"><span>历史文件</span><b>' + esc(d.universeHistoryFiles || 0) + '</b></div><div class="stratCard"><span>当前信号日</span><b>' + esc(d.current.signalDate) + '</b></div><div class="stratCard"><span>真实期权回测</span><b>' + (option.actualOptionBacktest ? '已接入' : '未接入') + '</b></div><div class="stratCard"><span>期权链状态</span><b>' + esc(option.status || 'N/A') + '</b></div></div>' + signalTable('长期机会前20：2x做多 / Call方向候选', d.current.longTop20, false) + signalTable('顶部区域风险前20：2x做空 / Put方向候选', d.current.topRiskTop20, true) + metricTable('长期机会回测', d.longStrategies, 'long') + metricTable('顶部风险回测', {top_risk: d.topRiskStrategy}, 'top') + evolution() + '<div class="stratNote"><b>真实期权接入条件：</b>需要逐日历史期权 bid/ask、到期日、行权价、隐含波动率、Delta、成交量、滑点和拆股/分红调整。接入后才会显示真实 Call/Put 权利金、到期收益、最大亏损和波动率暴露。</div>';
  }
  function init() {
    var app = document.querySelector('.app'), controls = document.querySelector('.controls'); if (!app || !controls) return;
    css();
    var button = document.createElement('button'); button.id = 'strategyBacktestBtn'; button.className = 'btn'; button.style.width = 'auto'; button.style.fontSize = '14px'; button.textContent = '策略回测 / 自我进化'; controls.insertBefore(button, controls.firstChild);
    var panel = document.createElement('section'); panel.id = 'strategyBacktestPanel'; panel.innerHTML = '<div class="stratHead"><div class="stratBrand">策略回测 / 自我进化</div><button id="strategyBacktestBack" class="stratBtn stratClose">返回技术筛选</button></div><div id="strategyBacktestBody" class="stratBody"><div class="stratNote">策略回测数据加载中...</div></div>'; app.appendChild(panel);
    button.onclick = function () { document.querySelector('.main').style.display = 'none'; panel.style.display = 'block'; if (state.data) render(); };
    document.getElementById('strategyBacktestBack').onclick = function () { panel.style.display = 'none'; document.querySelector('.main').style.display = ''; };
    fetch('strategy-backtest.json', { cache: 'no-store' }).then(function (response) { if (!response.ok) throw new Error('strategy-backtest.json ' + response.status); return response.json(); }).then(function (data) { state.data = data; if (panel.style.display === 'block') render(); }).catch(function (error) { console.error(error); document.getElementById('strategyBacktestBody').innerHTML = '<div class="stratNote">策略回测数据加载失败：' + esc(error.message) + '</div>'; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
}());
