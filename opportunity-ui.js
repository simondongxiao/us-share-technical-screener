(function () {
  'use strict';

  var root = document.documentElement;
  var state = { rows: [], filter: 'core', query: '', sort: 'opportunity', desc: true };
  var labels = {
    core: '全部核心机会',
    a: 'TYPE A｜错杀反转 · Fundamental Reversal',
    b: 'TYPE B｜趋势恢复 · Fundamental Trend Recovery',
    c: 'TYPE C｜强趋势 / 突破 · Fundamental Leader / Breakout',
    d: 'TYPE D｜催化驱动 · Fundamental + Catalyst',
    strong_waiting: '基本面强｜等待技术触发',
    pending: '技术强｜基本面待补',
    new: '今日新机会',
    changes: '机会状态变化',
    avoid: '基本面恶化 / Value Trap'
  };

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }
  function num(value, digits) {
    var n = Number(value);
    return Number.isFinite(n) ? n.toFixed(digits == null ? 1 : digits) : 'N/A';
  }
  function cap(value) {
    var n = Number(value);
    return Number.isFinite(n) ? '$' + (n / 1e9).toFixed(1) + 'B' : 'N/A';
  }
  function isType(row, type) {
    return String(row.Opportunity_Type || '').toUpperCase() === type;
  }
  function rowMatches(row) {
    var q = state.query.trim().toLowerCase();
    if (q && !(String(row.ticker || '').toLowerCase().includes(q) || String(row.name || '').toLowerCase().includes(q) || String(row.exchange || '').toLowerCase().includes(q))) return false;
    if (state.filter === 'core') return row.Core_Opportunity === true;
    if (state.filter === 'a') return isType(row, 'TYPE A');
    if (state.filter === 'b') return isType(row, 'TYPE B');
    if (state.filter === 'c') return isType(row, 'TYPE C');
    if (state.filter === 'd') return isType(row, 'TYPE D');
    if (state.filter === 'strong_waiting') return row.Fundamental_Data_Status !== 'INSUFFICIENT' && row.Core_Opportunity !== true;
    if (state.filter === 'pending') return isType(row, 'FUNDAMENTAL PENDING');
    if (state.filter === 'new') return state.newTickers.indexOf(row.ticker) >= 0;
    if (state.filter === 'changes') return state.changeTickers.indexOf(row.ticker) >= 0;
    if (state.filter === 'avoid') return state.avoidTickers.indexOf(row.ticker) >= 0;
    return true;
  }
  function sortRows(rows) {
    var key = state.sort;
    return rows.sort(function (a, b) {
      var av = key === 'alpha' ? String(a.ticker || '') : key === 'cap' ? Number(a.Market_Cap || 0) : Number(a.Opportunity_Score || 0);
      var bv = key === 'alpha' ? String(b.ticker || '') : key === 'cap' ? Number(b.Market_Cap || 0) : Number(b.Opportunity_Score || 0);
      var result = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
      return state.desc ? -result : result;
    });
  }
  function css() {
    if (document.getElementById('opportunityUiStyle')) return;
    var style = document.createElement('style');
    style.id = 'opportunityUiStyle';
    style.textContent = '#opportunityPanel{display:none;position:fixed;inset:0;z-index:20;background:#f6f5f1;color:#18211f;overflow:auto;font:14px/1.45 Arial,"Microsoft YaHei",sans-serif}.oppHead{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 16px;border-bottom:1px solid #dedbd2;background:#ebe7dc}.oppBrand{font-weight:800;font-size:20px;margin-right:8px}.oppBtn,.oppSelect,.oppInput{height:34px;border:1px solid #c9c5b9;background:#fffdfa;border-radius:6px;padding:0 10px}.oppBtn{cursor:pointer}.oppBtn.active{background:#2e6f9e;color:#fff;border-color:#2e6f9e}.oppInput{min-width:220px;flex:1}.oppSummary{display:grid;grid-template-columns:repeat(8,minmax(110px,1fr));gap:8px;padding:12px 16px}.oppStat{background:#fffdfa;border:1px solid #dedbd2;border-radius:6px;padding:8px 10px}.oppStat b{display:block;font-size:18px}.oppStat span{color:#67716e;font-size:12px}.oppBody{padding:0 16px 24px}.oppToolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px}.oppTableWrap{overflow:auto;background:#fffdfa;border:1px solid #dedbd2;border-radius:6px}.oppTable{width:100%;border-collapse:collapse;min-width:1450px}.oppTable th,.oppTable td{padding:8px;border-bottom:1px solid #ece9e1;text-align:left;white-space:nowrap}.oppTable th{position:sticky;top:0;background:#ebe7dc;z-index:1}.oppTable tr:hover{background:#f0eee7}.oppTicker{font:700 13px Consolas,monospace;color:#2e6f9e;cursor:pointer}.oppMuted{color:#67716e}.oppEmpty{text-align:center;padding:36px;color:#67716e}.oppDetail{display:none;position:fixed;right:20px;top:80px;width:min(520px,calc(100vw - 40px));max-height:calc(100vh - 110px);overflow:auto;background:#fffdfa;border:1px solid #c9c5b9;border-radius:8px;box-shadow:0 12px 32px #0002;padding:16px;z-index:22}.oppDetail h3{margin:0 0 10px}.oppDetailGrid{display:grid;grid-template-columns:145px 1fr;gap:7px;border-top:1px solid #ece9e1;padding-top:10px}.oppDetailGrid span{color:#67716e}.oppClose{float:right}.oppMode{margin-left:auto}@media(max-width:900px){.oppSummary{grid-template-columns:repeat(2,1fr)}.oppBrand{width:100%}.oppMode{margin-left:0}}';
    document.head.appendChild(style);
  }
  function makePanel() {
    var panel = document.createElement('section');
    panel.id = 'opportunityPanel';
    panel.innerHTML = '<div class="oppHead"><div class="oppBrand">基本面 × 技术面机会</div><button id="oppBack" class="oppBtn">返回技术筛选</button><select id="oppFilter" class="oppSelect"></select><input id="oppSearch" class="oppInput" placeholder="搜索代码 / 公司 / 交易所" /><select id="oppSort" class="oppSelect"><option value="opportunity">机会分</option><option value="cap">市值</option><option value="alpha">字母</option></select><button id="oppDir" class="oppBtn" title="切换升序 / 降序">↓</button></div><div id="oppSummary" class="oppSummary"></div><div class="oppBody"><div id="oppToolbar" class="oppToolbar"></div><div id="oppTableWrap" class="oppTableWrap"></div></div><div id="oppDetail" class="oppDetail"></div></section>';
    document.querySelector('.app').appendChild(panel);
    Object.keys(labels).forEach(function (key) {
      var option = document.createElement('option'); option.value = key; option.textContent = labels[key]; document.getElementById('oppFilter').appendChild(option);
    });
    document.getElementById('oppBack').onclick = function () { panel.style.display = 'none'; document.querySelector('.main').style.display = ''; };
    document.getElementById('oppFilter').onchange = function (event) { state.filter = event.target.value; render(); };
    document.getElementById('oppSearch').oninput = function (event) { state.query = event.target.value; render(); };
    document.getElementById('oppSort').onchange = function (event) { state.sort = event.target.value; render(); };
    document.getElementById('oppDir').onclick = function () { state.desc = !state.desc; eventlessRender(); };
    return panel;
  }
  function eventlessRender() { document.getElementById('oppDir').textContent = state.desc ? '↓' : '↑'; render(); }
  function renderSummary(data) {
    var c = data.counts;
    document.getElementById('oppSummary').innerHTML = [['数据日期', data.dataDate], ['$10B+ Universe', data.universeCount], ['基本面覆盖', data.fundamentalCoveragePct + '%'], ['Core Opportunities', c.core], ['TYPE A', c.typeA], ['TYPE B', c.typeB], ['TYPE C / D', c.typeC + ' / ' + c.typeD], ['Fundamental Pending', c.pending]].map(function (x) { return '<div class="oppStat"><span>' + esc(x[0]) + '</span><b>' + esc(x[1]) + '</b></div>'; }).join('');
  }
  function render() {
    if (!state.data) return;
    renderSummary(state.data);
    var rows = sortRows(state.rows.filter(rowMatches));
    document.getElementById('oppToolbar').innerHTML = '<span class="oppMuted">' + esc(labels[state.filter]) + ' · ' + rows.length + ' 只</span><span class="oppMuted">覆盖不足的标的保留在 Fundamental Pending，不进入 Core</span>';
    if (!rows.length) { document.getElementById('oppTableWrap').innerHTML = '<div class="oppEmpty">当前暂无符合条件股票</div>'; return; }
    document.getElementById('oppTableWrap').innerHTML = '<table class="oppTable"><thead><tr><th>Ticker</th><th>Company</th><th>Price</th><th>Market Cap</th><th>Opportunity Type</th><th>Fundamental Revision</th><th>Fundamental Score</th><th>Trend State</th><th>Location</th><th>Technical %ile</th><th>RS %ile</th><th>Opportunity Score</th><th>Why Now</th><th>Next Trigger</th><th>Main Risk</th><th>Fundamental Data</th></tr></thead><tbody>' + rows.map(function (r) { return '<tr><td><span class="oppTicker" data-ticker="' + esc(r.ticker) + '">' + esc(r.ticker) + '</span></td><td>' + esc(r.name || 'N/A') + '</td><td>$' + num(r.price, 2) + '</td><td>' + cap(r.Market_Cap) + '</td><td>' + esc(r.Opportunity_Type || 'UNCLASSIFIED') + '</td><td>' + esc(r.Fundamental_Revision_State || 'N/A') + '</td><td>' + num(r.Fundamental_Score) + '</td><td>' + esc(r.trend_state || 'N/A') + '</td><td>' + esc(r.location_state || 'N/A') + '</td><td>' + num(r.Technical_Percentile) + '</td><td>' + num(r.RS_Percentile || r.relative_strength_score) + '</td><td>' + num(r.Opportunity_Score) + '</td><td>' + esc(r.Why_Now || 'N/A') + '</td><td>' + esc(r.Next_Trigger || 'N/A') + '</td><td>' + esc(r.Main_Risk || 'N/A') + '</td><td>' + esc(r.Fundamental_Data_Status || 'N/A') + '</td></tr>'; }).join('') + '</tbody></table>';
    document.querySelectorAll('.oppTicker').forEach(function (node) { node.onclick = function () { showDetail(state.data.byTicker[node.dataset.ticker]); }; });
  }
  function showDetail(row) {
    if (!row) return;
    var detail = document.getElementById('oppDetail');
    var fields = [['Ticker / Company', (row.ticker || '') + ' · ' + (row.name || '')], ['价格 / 市值', '$' + num(row.price, 2) + ' · ' + cap(row.Market_Cap)], ['Opportunity', row.Opportunity_Type], ['基本面状态', (row.Fundamental_Revision_State || 'N/A') + ' · ' + (row.Fundamental_Data_Status || 'N/A')], ['Revenue / EPS trend', (row.Revenue_Revision || 'N/A') + ' / ' + (row.EPS_Revision || 'N/A')], ['Orders / Backlog / KPI', [row.Orders_Trend, row.Backlog_Trend, row.Core_KPI_Trend].map(function (x) { return x || 'N/A'; }).join(' / ')], ['Margin / FCF', [row.Gross_Margin_Trend, row.Operating_Margin_Trend, row.FCF_Trend].map(function (x) { return x || 'N/A'; }).join(' / ')], ['Trend / Location / Regime', [row.trend_state, row.location_state, row.technical_regime].map(function (x) { return x || 'N/A'; }).join(' / ')], ['Technical / RS percentile', num(row.Technical_Percentile) + ' / ' + num(row.RS_Percentile || row.relative_strength_score)], ['Drawdown / daily change', num(row.drawdown_60d_high) + '% / ' + num(row.daily_return) + '%'], ['Catalyst', (row.Catalyst_Tags || 'N/A') + ' · confidence ' + num(row.Catalyst_Score)], ['Why Now', row.Why_Now], ['Next Trigger', row.Next_Trigger], ['Main Risk / Invalidation', row.Main_Risk + ' / technical deterioration ' + num(row.Technical_Deterioration_Score)]];
    detail.innerHTML = '<button class="oppBtn oppClose">关闭</button><h3>' + esc(row.ticker) + ' · ' + esc(row.name) + '</h3><div class="oppDetailGrid">' + fields.map(function (f) { return '<span>' + esc(f[0]) + '</span><b>' + esc(f[1] || 'N/A') + '</b>'; }).join('') + '</div>';
    detail.style.display = 'block'; detail.querySelector('.oppClose').onclick = function () { detail.style.display = 'none'; };
  }
  function openOpportunity() {
    document.querySelector('.main').style.display = 'none'; document.getElementById('opportunityPanel').style.display = 'block'; render();
  }
  function init() {
    css();
    var top = document.querySelector('.top');
    var button = document.createElement('button'); button.id = 'opportunityModeBtn'; button.className = 'btn oppMode'; button.style.width = 'auto'; button.style.fontSize = '14px'; button.textContent = '基本面 × 技术面机会'; button.onclick = openOpportunity; top.querySelector('.controls').insertBefore(button, top.querySelector('.controls').firstChild);
    makePanel();
    fetch('opportunity-data.json', { cache: 'no-store' }).then(function (response) { if (!response.ok) throw new Error('opportunity-data.json ' + response.status); return response.json(); }).then(function (data) { state.data = data; state.rows = data.records || []; data.byTicker = {}; state.newTickers = (data.newOpportunities || []).map(function (x) { return x.Ticker; }); state.changeTickers = (data.changes || []).map(function (x) { return x.Ticker; }); state.avoidTickers = (data.avoidTickers || []); state.rows.forEach(function (row) { data.byTicker[row.ticker] = row; }); if (location.hash === '#opportunity') openOpportunity(); }).catch(function (error) { console.error(error); button.title = 'Opportunity 数据加载失败'; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
}());
