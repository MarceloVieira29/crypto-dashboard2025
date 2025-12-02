// ==========================
// CONFIGURAÇÃO BÁSICA
// ==========================
const BINANCE_BASE = "https://api.binance.com";

const PAIR_MAP = {
  BTCUSD: "BTCUSDT",
  ETHUSD: "ETHUSDT",
  BTCBRL: "BTCBRL",
  ETHBRL: "ETHBRL"
};

let currentPairKey = "BTCBRL"; // pode trocar o default
let currentTfInterval = "4h";
let candleChart = null;
let liveIntervalId = null;

// ==========================
// UTILIDADES
// ==========================
function formatPercent(p) {
  const num = Number(p);
  if (isNaN(num)) return "--%";
  const sign = num > 0 ? "+" : "";
  return `${sign}${num.toFixed(2)}%`;
}

function setChangeClass(el, value) {
  el.classList.remove("up", "down");
  const num = Number(value);
  if (isNaN(num)) return;
  if (num > 0.01) el.classList.add("up");
  if (num < -0.01) el.classList.add("down");
}

function formatBRL(v) {
  return v.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3
  });
}

function formatUSD(v) {
  return v.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// ==========================
// FETCH BINANCE
// ==========================
async function fetchTicker24h(symbol) {
  const url = `${BINANCE_BASE}/api/v3/ticker/24hr?symbol=${symbol}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Erro ticker " + symbol);
  return res.json();
}

async function fetchCandles(symbol, interval) {
  const url = `${BINANCE_BASE}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=80`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Erro candles " + symbol);
  const data = await res.json();

  return data.map(k => {
    const openTime = k[0];
    const o = parseFloat(k[1]);
    const h = parseFloat(k[2]);
    const l = parseFloat(k[3]);
    const c = parseFloat(k[4]);
    return {
      x: new Date(openTime).toISOString(),
      o,
      h,
      l,
      c
    };
  });
}

// ==========================
// GRÁFICO
// ==========================
function initOrUpdateChart(dataset, label) {
  const ctx = document.getElementById("candle-chart").getContext("2d");

  if (candleChart) {
    candleChart.data.datasets[0].data = dataset;
    candleChart.data.datasets[0].label = label;
    candleChart.update();
    return;
  }

  candleChart = new Chart(ctx, {
    type: "candlestick",
    data: {
      datasets: [
        {
          label: label,
          data: dataset,
          borderColor: "#00d084",
          backgroundColor: "#00d084"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: "#f4f6fb",
            font: { size: 11 }
          }
        },
        tooltip: {
          mode: "index",
          intersect: false,
          callbacks: {
            label: function (ctx) {
              const v = ctx.raw;
              return ` O:${v.o}  H:${v.h}  L:${v.l}  C:${v.c}`;
            }
          }
        }
      },
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
          },
          grid: {
            color: "rgba(255,255,255,0.05)"
          },
          ticks: {
            color: "#a7b1c5",
            maxTicksLimit: 8
          }
        },
        y: {
          grid: {
            color: "rgba(255,255,255,0.08)"
          },
          ticks: {
            color: "#a7b1c5"
          }
        }
      }
    }
  });
}

// ==========================
// "IA" DE TENDÊNCIA
// ==========================
function analisarTendencia(dataset) {
  if (!dataset || dataset.length < 4) {
    return {
      tipo: "indefinida",
      texto: "Poucos dados para análise. Aguarde mais candles."
    };
  }

  const len = dataset.length;
  const last4 = dataset.slice(len - 4);
  const closes = last4.map(d => d.c);
  const opens = last4.map(d => d.o);

  const ultimo = closes[3];
  const penultimo = closes[2];
  const dif = ultimo - penultimo;
  const pct = (dif / penultimo) * 100;

  const topos = closes[0] < closes[1] && closes[1] < closes[2] && closes[2] < closes[3];
  const fundos = opens[0] < opens[1] && opens[1] < opens[2] && opens[2] < opens[3];

  if (pct > 0.6 && topos && fundos) {
    return {
      tipo: "alta",
      texto:
        "Tendência de alta: topos e fundos ascendentes e fechamentos acima das últimas velas. Mercado favorece compras com gestão de risco."
    };
  }

  if (pct < -0.6 && !topos && !fundos) {
    return {
      tipo: "baixa",
      texto:
        "Pressão vendedora: fechamentos rompendo suportes recentes. Cenário favorece proteção das posições compradas ou operações de venda."
    };
  }

  if (Math.abs(pct) <= 0.6) {
    return {
      tipo: "lateral",
      texto:
        "Movimento de consolidação: variação pequena nas últimas velas. Melhor aguardar rompimento de suporte ou resistência antes de entrar."
    };
  }

  return {
    tipo: "neutra",
    texto:
      "Movimento misto, sem direção clara. Observe volume, regiões de suporte/resistência e contexto de prazo maior."
  };
}

function atualizarAnaliseCripto(dataset, pairLabel) {
  const aiTrendTitle = document.getElementById("ai-trend-title");
  const aiTrendText = document.getElementById("ai-trend-text");
  const analise = analisarTendencia(dataset);

  aiTrendTitle.textContent = `Tendência atual (${pairLabel}):`;
  aiTrendText.textContent = analise.text;
}

// ==========================
// VISÃO GERAL / DÓLAR + CRIPTOS
// ==========================
async function atualizarVisaoGeral() {
  try {
    const [usdtBrl, btcUsdt, ethUsdt, btcBrl] = await Promise.all([
      fetchTicker24h("USDTBRL"),
      fetchTicker24h("BTCUSDT"),
      fetchTicker24h("ETHUSDT"),
      fetchTicker24h("BTCBRL")
    ]);

    // Dólar (USDT/BRL)
    const usdPriceEl = document.getElementById("usd-price");
    const usdChangeEl = document.getElementById("usd-change");
    const usdRangeEl = document.getElementById("usd-range");
    const usdAiTextEl = document.getElementById("usd-ai-text");

    const p = Number(usdtBrl.lastPrice);
    const chg = Number(usdtBrl.priceChangePercent);
    usdPriceEl.textContent = `R$ ${formatBRL(p)}`;
    usdChangeEl.textContent = formatPercent(chg);
    usdRangeEl.textContent = `R$ ${formatBRL(Number(usdtBrl.lowPrice))} – R$ ${formatBRL(
      Number(usdtBrl.highPrice)
    )}`;
    setChangeClass(usdChangeEl, chg);

    // Criptos – valores + % (BTCUSDT, ETHUSDT, BTCBRL)
    const btcInfoEl = document.getElementById("btc-info");
    const ethInfoEl = document.getElementById("eth-info");
    const btcBrlInfoEl = document.getElementById("btcbrl-info");

    const btcPrice = Number(btcUsdt.lastPrice);
    const btcChg = Number(btcUsdt.priceChangePercent);
    btcInfoEl.textContent = `$ ${formatUSD(btcPrice)} (${formatPercent(btcChg)})`;
    setChangeClass(btcInfoEl, btcChg);

    const ethPrice = Number(ethUsdt.lastPrice);
    const ethChg = Number(ethUsdt.priceChangePercent);
    ethInfoEl.textContent = `$ ${formatUSD(ethPrice)} (${formatPercent(ethChg)})`;
    setChangeClass(ethInfoEl, ethChg);

    const btcBrlPrice = Number(btcBrl.lastPrice);
    const btcBrlChg = Number(btcBrl.priceChangePercent);
    btcBrlInfoEl.textContent = `R$ ${formatBRL(btcBrlPrice)} (${formatPercent(btcBrlChg)})`;
    setChangeClass(btcBrlInfoEl, btcBrlChg);

    // Comentário "IA" misturando dólar + criptos
    let msg;
    if (chg > 0.7) {
      msg =
        "Dólar em alta mais forte nas últimas 24h. Tende a pressionar ativos de risco em BRL. ";
    } else if (chg > 0.1) {
      msg =
        "Dólar em leve alta de curto prazo. Movimento ainda controlado, mas bom acompanhar suportes. ";
    } else if (chg < -0.7) {
      msg =
        "Dólar em queda mais acentuada. Em geral favorece fluxos para ativos de risco e criptos. ";
    } else if (chg < -0.1) {
      msg =
        "Dólar em leve queda. Movimento suave, porém relevante para quem opera pares em BRL. ";
    } else {
      msg =
        "Dólar praticamente estável nas últimas 24h. Mercado sem direcional forte na moeda. ";
    }

    msg += `BTCUSDT: ${formatPercent(btcChg)} • ETHUSDT: ${formatPercent(
      ethChg
    )} • BTCBRL: ${formatPercent(btcBrlChg)}.`;

    usdAiTextEl.textContent = msg;

    document.getElementById("market-status").textContent = "Online";
  } catch (err) {
    console.error("Erro visão geral:", err);
    document.getElementById("market-status").textContent = "Instável";
  }
}

// ==========================
// LOOP DE ATUALIZAÇÃO
// ==========================
async function atualizarDadosPrincipais() {
  const pairBinance = PAIR_MAP[currentPairKey];
  if (!pairBinance) return;

  try {
    const candles = await fetchCandles(pairBinance, currentTfInterval);

    let labelPair;
    switch (currentPairKey) {
      case "BTCUSD":
        labelPair = "BTC / USD (BTCUSDT)";
        break;
      case "ETHUSD":
        labelPair = "ETH / USD (ETHUSDT)";
        break;
      case "BTCBRL":
        labelPair = "BTC / BRL";
        break;
      case "ETHBRL":
        labelPair = "ETH / BRL";
        break;
      default:
        labelPair = pairBinance;
    }

    initOrUpdateChart(candles, labelPair);
    atualizarAnaliseCripto(candles, labelPair);
  } catch (err) {
    console.error("Erro ao atualizar candles:", err);
  }

  // Visão geral também
  atualizarVisaoGeral();
}

function iniciarLoop() {
  if (liveIntervalId) clearInterval(liveIntervalId);
  atualizarDadosPrincipais();
  liveIntervalId = setInterval(atualizarDadosPrincipais, 2000); // 2s
}

// ==========================
// EVENTOS DE UI
// ==========================
function setupUI() {
  const pairSelect = document.getElementById("pair-select");
  const tfSelect = document.getElementById("tf-select");
  const periodLabel = document.getElementById("period-label");

  // inicial
  currentPairKey = pairSelect.value;
  currentTfInterval = tfSelect.value;
  periodLabel.textContent = tfSelect.options[tfSelect.selectedIndex].text;

  pairSelect.addEventListener("change", () => {
    currentPairKey = pairSelect.value;
    iniciarLoop();
  });

  tfSelect.addEventListener("change", () => {
    currentTfInterval = tfSelect.value;
    periodLabel.textContent = tfSelect.options[tfSelect.selectedIndex].text;
    iniciarLoop();
  });
}

// ==========================
// BOOT
// ==========================
document.addEventListener("DOMContentLoaded", () => {
  setupUI();
  iniciarLoop();
});
