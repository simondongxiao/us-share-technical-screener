/* Full histories are loaded per symbol so the initial page stays small. */
const historyRequests = new Map();
const historyLoaded = new Set();
const historyErrors = new Map();
capText = function (stock) {
  if (stock.marketCap == null) return '\u7f3a';
  const value = Number(stock.marketCap);
  return ' ' + fmt(value, value < .01 ? 4 : 2) + '\u4ebf\u7f8e\u5143' + (stock.marketCapEstimated ? '\uff08\u4f30\u7b97\uff09' : '');
};
const historyDate = document.createElement('input');
historyDate.type = 'date';
historyDate.id = 'candleDate';
historyDate.className = 'control';
historyDate.title = '\u5b9a\u4f4d\u4ea4\u6613\u65e5';
historyDate.setAttribute('aria-label', historyDate.title);
document.querySelector('.chartHead > div:last-child').prepend(historyDate);

async function loadFullHistory(stock) {
  if (!stock.historyFile || historyLoaded.has(stock.ticker)) return;
  if (!historyRequests.has(stock.ticker)) {
    const request = (async () => {
      const response = await fetch(stock.historyFile + '?v=' + encodeURIComponent(APP.generatedAt));
      if (!response.ok) throw new Error('History HTTP ' + response.status);
      const bytes = new Uint8Array(await response.arrayBuffer());
      const stream = new Blob([bytes]).stream();
      const body = bytes[0] === 31 && bytes[1] === 139
        ? await new Response(stream.pipeThrough(new DecompressionStream('gzip'))).text()
        : new TextDecoder().decode(bytes);
      const rows = JSON.parse(body);
      if (!Array.isArray(rows) || rows.length !== stock.historyCount || rows.some((r, i) => !Array.isArray(r) || r.length !== 8 || (i && r[0] <= rows[i - 1][0]))) {
        throw new Error('Invalid historical series');
      }
      APP.klines[stock.ticker] = rows;
      historyLoaded.add(stock.ticker);
      historyErrors.delete(stock.ticker);
    })().catch(error => {
      historyErrors.set(stock.ticker, error.message);
    }).finally(() => {
      historyRequests.delete(stock.ticker);
      if (currentStock()?.ticker === stock.ticker) drawChart();
    });
    historyRequests.set(stock.ticker, request);
  }
  await historyRequests.get(stock.ticker);
}

const originalRenderSelected = renderSelected;
renderSelected = function () {
  state.historyOffset = 0;
  originalRenderSelected();
  const stock = currentStock();
  if (!stock) return;
  const status = stock.historyStatus === 'history unavailable' ? '\u6682\u65e0\u53ef\u6838\u5b9e\u5386\u53f2'
    : stock.historyStatus === 'target-session bar unavailable' ? '\u7f3a\u57fa\u51c6\u65e5\u884c\u60c5\uff0c\u4e0d\u53c2\u4e0e\u5f53\u65e5\u6280\u672f\u7b5b\u9009'
    : stock.historyStatus ? '\u5386\u53f2\u4e0d\u8db3 11 \u4e2a\u4ea4\u6613\u65e5' : '';
  $('stockSubtitle').textContent += ` \u00b7 \u884c\u60c5\u65e5 ${stock.priceAsOf || '-'}${status ? ' \u00b7 ' + status : ''}`;
  if (stock.zeroVolumeSession) $('stockSubtitle').textContent += ' \u00b7 \u6570\u636e\u6e90\u8bb0\u5f55\u6210\u4ea4\u91cf\u4e3a 0';
  const source = document.createElement('div');
  source.className = 'source';
  source.textContent = `\u5386\u53f2\u8303\u56f4\uff1a${stock.historyStart || '-'} \u81f3 ${stock.priceAsOf || '-'}\uff1b${stock.historyCount || 0} \u6839\u65e5K\uff1b\u6765\u6e90\uff1a${stock.historySource || '-'}${status ? '\uff1b' + status : ''}`;
  $('detailPanel').prepend(source);
  if (stock.previousTicker) {
    source.textContent += `\uff1b\u539f\u4ee3\u7801 ${stock.previousTicker}\uff0c${stock.symbolEffectiveDate} \u542f\u7528\u65b0\u4ee3\u7801`;
  }
  if (stock.marketCapBasis) {
    const basis = document.createElement('div');
    basis.className = 'source';
    const text = stock.marketCapBasis.startsWith('A+B')
      ? '\u5df2\u62ab\u9732 A+B \u666e\u901a\u80a1\u603b\u6570\u00d7A \u7c7b\u6536\u76d8\u4ef7\uff1b\u975e\u5b8c\u5168\u644a\u8584\u5e02\u503c\uff0c\u4e0d\u662f\u76f4\u63a5\u62a5\u4ef7'
      : stock.marketCapBasis.startsWith('Provider shares date')
      ? 'Yahoo \u80a1\u6570\u00d7\u6700\u65b0\u6536\u76d8\u4ef7\uff1b\u80a1\u6570\u65f6\u70b9\u672a\u63d0\u4f9b\uff1b\u516c\u53f8\u5df2\u516c\u544a\u8d22\u52a1\u62a5\u8868\u9700\u91cd\u8ff0'
      : stock.marketCapBasis;
    basis.textContent = '\u5e02\u503c\u4f30\u7b97\u53e3\u5f84\uff1a' + text;
    if (stock.marketCapSourceUrl) {
      const sourceLink = document.createElement('a');
      sourceLink.href = stock.marketCapSourceUrl;
      sourceLink.textContent = ' \u539f\u59cb\u6765\u6e90';
      sourceLink.target = '_blank';
      sourceLink.rel = 'noopener noreferrer';
      basis.append(sourceLink);
    }
    $('detailPanel').prepend(basis);
  }
  loadFullHistory(stock);
};

function historyWindow() {
  const stock = currentStock();
  const all = stock ? (APP.klines[stock.ticker] || []).filter(r => r[0] <= state.date) : [];
  state.historyOffset = Math.max(0, Math.min(state.historyOffset || 0, Math.max(0, all.length - state.windowSize)));
  const end = all.length - state.historyOffset;
  const start = Math.max(0, end - state.windowSize);
  return {all, start, rows: all.slice(start, end)};
}

moveChart = function (step) {
  if (!chartMeta?.rows.length) return;
  const target = chartMeta.start + (state.chartIndex ?? chartMeta.rows.length - 1) + step;
  selectHistoryIndex(target);
};

function selectHistoryIndex(index) {
  const view = historyWindow();
  if (!view.all.length) return;
  index = Math.max(0, Math.min(view.all.length - 1, index));
  if (index < view.start) state.historyOffset = view.all.length - Math.min(view.all.length, index + state.windowSize);
  else if (index >= view.start + view.rows.length) state.historyOffset = view.all.length - index - 1;
  const next = historyWindow();
  state.chartIndex = index - next.start;
  drawChart();
}

function selectHistoryCandleByClick(event) {
  const view = historyWindow();
  if (!view.rows.length) return;
  const rect = $('kCanvas').getBoundingClientRect();
  const usable = Math.max(1, rect.width - 56 - 16);
  const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left - 56) / usable));
  const localIndex = Math.round(ratio * Math.max(0, view.rows.length - 1));
  selectHistoryIndex(view.start + localIndex);
}

$('kCanvas').addEventListener('click', selectHistoryCandleByClick);

historyDate.addEventListener('change', async () => {
  const stock = currentStock();
  const requested = historyDate.value;
  if (!stock || !requested) return;
  await loadFullHistory(stock);
  if (currentStock()?.ticker !== stock.ticker) return;
  const rows = historyWindow().all;
  let index = rows.findIndex(row => row[0] >= requested);
  if (index < 0) index = rows.length - 1;
  selectHistoryIndex(index);
});

drawChart = function () {
  const canvas = $('kCanvas'), rect = canvas.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1, w = rect.width, h = rect.height;
  canvas.width = Math.max(300, Math.floor(w * dpr));
  canvas.height = Math.max(260, Math.floor(h * dpr));
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const stock = currentStock(), view = historyWindow(), {rows, all, start} = view;
  historyDate.disabled = !rows.length;
  historyDate.min = stock?.historyStart || '';
  historyDate.max = stock?.priceAsOf || state.date || '';
  if (!rows.length) {
    chartMeta = null;
    historyDate.value = '';
    $('chartStatus').textContent = stock ? '\u6682\u65e0\u53ef\u6838\u5b9e\u7684\u65e5K\u6570\u636e' : '';
    $('priceStatus').textContent = '';
    ctx.fillStyle = '#67716e';
    ctx.fillText('\u65e0K\u7ebf\u6570\u636e', 20, 30);
    return;
  }
  const pad = {l: 56, r: 16, t: 34, b: 84}, priceH = h - pad.t - pad.b, volH = 54;
  const minP = Math.min(...rows.map(r => Math.min(r[3], r[6] ?? r[3], r[7] ?? r[3])));
  const maxP = Math.max(...rows.map(r => Math.max(r[2], r[6] ?? r[2], r[7] ?? r[2])));
  const span = Math.max(.01, maxP - minP), step = (w - pad.l - pad.r) / Math.max(1, rows.length - 1);
  const x = i => pad.l + i * step, y = p => pad.t + (maxP - p) / span * priceH;
  const bw = Math.max(2, Math.min(10, (w - pad.l - pad.r) / rows.length * .58));
  drawGrid(ctx, w, h, pad, minP, maxP, y);
  rows.forEach((r, i) => {
    ctx.strokeStyle = r[4] >= r[1] ? '#c84435' : '#11805a';
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath(); ctx.moveTo(x(i), y(r[2])); ctx.lineTo(x(i), y(r[3])); ctx.stroke();
    const top = y(Math.max(r[1], r[4])), bottom = y(Math.min(r[1], r[4]));
    ctx.fillRect(x(i) - bw / 2, top, bw, Math.max(1, bottom - top));
  });
  drawLine(ctx, rows, 6, x, y, '#2e6f9e');
  drawLine(ctx, rows, 7, x, y, '#a8701b');
  drawVolume(ctx, rows, x, w, h, pad, volH);
  const sel = Math.max(0, Math.min(rows.length - 1, state.chartIndex ?? rows.length - 1));
  state.chartIndex = sel;
  chartMeta = {rows, pad, step, start};
  const selected = rows[sel], previous = all[start + sel - 1];
  const pct = previous?.[4] ? (selected[4] / previous[4] - 1) * 100 : null;
  const pctText = pct === null ? '-' : (pct >= 0 ? '+' : '') + fmt(pct) + '%';
  ctx.save();
  ctx.strokeStyle = 'rgba(24,33,31,.55)'; ctx.setLineDash([4, 3]);
  ctx.beginPath(); ctx.moveTo(x(sel), pad.t); ctx.lineTo(x(sel), h - 28); ctx.stroke();
  ctx.setLineDash([]); ctx.fillStyle = pct >= 0 ? '#c84435' : '#11805a';
  ctx.beginPath(); ctx.arc(x(sel), y(selected[4]), 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#18211f'; ctx.fillText(`${selected[0]} ${pctText}`, pad.l, 20); ctx.restore();
  historyDate.value = selected[0];
  const suffix = historyErrors.has(stock.ticker) ? ' \u00b7 \u5b8c\u6574\u5386\u53f2\u52a0\u8f7d\u5931\u8d25'
    : stock.historyFile && !historyLoaded.has(stock.ticker) ? ' \u00b7 \u5b8c\u6574\u5386\u53f2\u52a0\u8f7d\u4e2d' : '';
  $('chartStatus').textContent = `${rows[0][0]} \u2192 ${rows[rows.length - 1][0]} \u00b7 ${start + sel + 1} / ${all.length} \u6839K\u7ebf${suffix}`;
  $('priceStatus').textContent = `${selected[0]} \u6da8\u8dcc\u5e45 ${pctText} \u00b7 O ${fmt(selected[1])} H ${fmt(selected[2])} L ${fmt(selected[3])} C ${fmt(selected[4])} V ${fmt(selected[5], 0)}`;
};
