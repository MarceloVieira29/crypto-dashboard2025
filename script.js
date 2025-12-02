const BINANCE = "https://api.binance.com";

const PAIR_MAP = {
  BTCUSD: "BTCUSDT",
  ETHUSD: "ETHUSDT",
  BTCBRL: "BTCBRL",
  ETHBRL: "ETHBRL"
};

let currentPair = "BTCUSD";
let currentTF = "5m";

let chart;
let intervalId;

// =======================================
// UTILIDADES
// =======================================
function pct(v) {
  const n = Number(v);
  if (isNaN(n)) return "--%";
  const s = n > 0 ? "+" : "";
  return s + n.toFixed(2) + "%";
}

function brl(v) {
  return Number(v).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3
  });
}

function usd(v) {
  return Number(v).toLocaleString("en-US", {
    minimumFractionDigits: 2
  });
}

function addColorClass(el, v) {
  el.classList.remove("up", "down");
  const num = Number(v);
  if (num > 0.01) el.classList.add("up");
  if (num < -0.01) el.classList.add("down");
}

// =======================================
// FETCH BINANCE
// =======================================
async function fetchCandles(symbol, interval) {
  let url = `${BINANCE}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=200`;
  let res = await fetch(url);

  if (!res.ok) return [];

  let data = await res.json();
  if (!Array.isArray(data) || data.length < 5) {
    url = `${BINANCE}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=20`;
    res = await fetch(url);
    if (!res.ok) return [];
    data = await res.json();
  }

  return data.map(k => ({
    x: new Date(k[0]).toISOString(),
    o: +k[1], h: +k[2], l: +k[3], c: +k[4]
  }));
}

async function fetchTicker(symbol) {
  const res = await fetch(`${BINANCE}/api/v3/ticker/24hr?symbol=${symbol}`);
  if (!res.ok) return null;
  return res.json();
}

// =======================================
// GRÁFICO
// =======================================
function renderChart(data, label) {
  const ctx = document.getElementById("candle-chart").getContext("2d");

  if (chart) {
    chart.data.datasets[0].data = data;
    chart.data.datasets[0].label = label;
    chart.update();
    return;
  }

  chart = new Chart(ctx, {
    type: "candlestick",
    data: {
      datasets: [
        { label, data, borderColor: "#00d084", backgroundColor: "#00d084" }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: "time",
          time: {
            tooltipFormat: "dd/MM HH:mm",
            displayFormats: {
              minute: "HH:mm",
              hour: "dd/MM HH:mm",
              day: "dd/MM",
              month: "LLL yyyy"
            }
          }
        }
      }
    }
  });
}

// =======================================
// ANÁLISE DE TENDÊNCIA (IA SIMPLES)
// =======================================
function analisarTrend(c) {
  if (!c || c.length < 4)
    return "Aguardando mais candles...";

  const last4 = c.slice(-4);
  const closes = last4.map(x => x.c);
  const opens = last4.map(x => x.o);

  const diff = closes[3] - closes[2];
  const pctChange = (diff / closes[2]) * 100;

  const topos = closes[0] < closes[1] && closes[1] < closes[2] && closes[2] < closes[3];
  const fundos = opens[0] < opens[1] && opens[1] < opens[2] && opens[2] < opens[3];

  if (pctChange > 0.5 && topos && fundos)
    return "Tendência de alta clara: topos e fundos ascendentes.";

  if (pctChange < -0.5 && !topos && !fundos)
    return "Tendência de baixa: rompendo suportes recentes.";

  if (Math.abs(pctChange) < 0.5)
    return "Mercado lateral, aguardando rompimento.";

  return "Movimento misto, sem direção definida.";
}

// =======================================
// VISÃO GERAL
// =======================================
async function atualizarVisaoGeral() {
  const [usdbrl, btcusdt, ethusdt, btcbrl] = await Promise.all([
    fetchTicker("USDTBRL"),
    fetchTicker("BTCUSDT"),
    fetchTicker("ETHUSDT"),
    fetchTicker("BTCBRL")
  ]);

  // USDT/BRL
  usdPrice.textContent = "R$ " + brl(usdbrl.lastPrice);
  usdChange.textContent = pct(usdbrl.priceChangePercent);
  usdRange.textContent =
    `R$ ${brl(usdbrl.lowPrice)} – R$ ${brl(usdbrl.highPrice)}`;
  addColorClass(usdChange, usdbrl.priceChangePercent);

  // BTCUSDT
  btcInfo.textContent =
    `$ ${usd(btcusdt.lastPrice)} (${pct(btcusdt.priceChangePercent)})`;
  addColorClass(btcInfo, btcusdt.priceChangePercent);

  // ETHUSDT
  ethInfo.textContent =
    `$ ${usd(ethusdt.lastPrice)} (${pct(ethusdt.priceChangePercent)})`;
  addColorClass(ethInfo, ethusdt.priceChangePercent);

  // BTCBRL
  btcbrlInfo.textContent =
    `R$ ${brl(btcbrl.lastPrice)} (${pct(btcbrl.priceChangePercent)})`;
  addColorClass(btcbrlInfo, btcbrl.priceChangePercent);

  usdAiText.textContent =
    `USD movimentando ${pct(usdbrl.priceChangePercent)}. ` +
    `BTCUSDT ${pct(btcusdt.priceChangePercent)}, ` +
    `ETHUSDT ${pct(ethusdt.priceChangePercent)}, ` +
    `BTCBRL ${pct(btcbrl.priceChangePercent)}.`;
}

// =======================================
// ATUALIZAÇÃO PRINCIPAL
// =======================================
async function atualizarTudo() {
  const pair = PAIR_MAP[currentPair];
  const candles = await fetchCandles(pair, currentTF);

  renderChart(candles, pair);

  aiTrendTitle.textContent = `Tendência atual (${pair})`;
  aiTrendText.textContent = analisarTrend(candles);

  atualizarVisaoGeral();
}

// =======================================
// EVENTOS
// =======================================
pairSelect.addEventListener("change", () => {
  currentPair = pairSelect.value;
  atualizarTudo();
});

tfSelect.addEventListener("change", () => {
  currentTF = tfSelect.value;
  atualizarTudo();
});

// LOOP a cada 2 segundos
intervalId = setInterval(atualizarTudo, 2000);

// Inicialização
atualizarTudo();
