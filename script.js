document.addEventListener("DOMContentLoaded", () => {

    const BINANCE = "https://api.binance.com";

    const PAIR_MAP = {
        BTCUSD: "BTCUSDT",
        ETHUSD: "ETHUSDT",
        BTCBRL: "BTCBRL",
        ETHBRL: "ETHBRL"
    };

    let currentPair = "BTCUSD";
    let currentTF = "5m";
    let chart = null;


    // ELEMENTOS DO DOM
    const pairSelect = document.getElementById("pair-select");
    const tfSelect = document.getElementById("tf-select");

    const usdPrice = document.getElementById("usd-price");
    const usdChange = document.getElementById("usd-change");
    const usdRange = document.getElementById("usd-range");

    const btcInfo = document.getElementById("btc-info");
    const ethInfo = document.getElementById("eth-info");
    const btcbrlInfo = document.getElementById("btcbrl-info");

    const usdAiText = document.getElementById("usd-ai-text");
    const aiTrendTitle = document.getElementById("ai-trend-title");
    const aiTrendText = document.getElementById("ai-trend-text");


    // FORMATADORES
    const pct = v => (v > 0 ? "+" : "") + Number(v).toFixed(2) + "%";
    const brl = v => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
    const usd = v => Number(v).toLocaleString("en-US", { minimumFractionDigits: 2 });

    function addColorClass(el, v) {
        el.classList.remove("up", "down");
        const num = Number(v);
        if (num > 0.1) el.classList.add("up");
        if (num < -0.1) el.classList.add("down");
    }


    // BUSCA TICKERS
    async function fetchTicker(symbol) {
        const r = await fetch(`${BINANCE}/api/v3/ticker/24hr?symbol=${symbol}`);
        return r.json();
    }


    // CANDLES (com fallback)
    async function fetchCandles(symbol, interval) {
        try {
            let url = `${BINANCE}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=200`;
            let res = await fetch(url);
            let data = await res.json();

            if (data.length < 5) {
                url = `${BINANCE}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=20`;
                res = await fetch(url);
                data = await res.json();
            }

            return data.map(c => ({
                x: new Date(c[0]),
                o: +c[1], h: +c[2], l: +c[3], c: +c[4]
            }));

        } catch {
            return [];
        }
    }


    // GRÁFICO
    function renderChart(data, label) {
        const ctx = document.getElementById("candle-chart").getContext("2d");

        if (chart) {
            chart.destroy();
        }

        chart = new Chart(ctx, {
            type: "candlestick",
            data: { datasets: [{ label, data }] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: "#fff" } } },
                scales: {
                    x: {
                        type: "time",
                        time: { tooltipFormat: "dd/MM HH:mm" },
                        ticks: { color: "#ccc" }
                    },
                    y: {
                        ticks: { color: "#ccc" }
                    }
                }
            }
        });
    }


    // "IA"
    const analisar = c => {
        if (c.length < 4) return "Aguardando dados...";
        const last = c.slice(-4).map(x => x.c);
        const diff = last[3] - last[2];
        if (diff > 0) return "Tendência de alta.";
        if (diff < 0) return "Tendência de baixa.";
        return "Lateral.";
    };


    // VISÃO GERAL
    async function atualizarVisaoGeral() {
        const [usdbrl, btcusdt, ethusdt, btcbrl] = await Promise.all([
            fetchTicker("USDTBRL"),
            fetchTicker("BTCUSDT"),
            fetchTicker("ETHUSDT"),
            fetchTicker("BTCBRL")
        ]);

        usdPrice.textContent = "R$ " + brl(usdbrl.lastPrice);
        usdChange.textContent = pct(usdbrl.priceChangePercent);
        usdRange.textContent =
            "R$ " + brl(usdbrl.lowPrice) + " – R$ " + brl(usdbrl.highPrice);

        btcInfo.textContent =
            `$ ${usd(btcusdt.lastPrice)} (${pct(btcusdt.priceChangePercent)})`;
        ethInfo.textContent =
            `$ ${usd(ethusdt.lastPrice)} (${pct(ethusdt.priceChangePercent)})`;
        btcbrlInfo.textContent =
            `R$ ${brl(btcbrl.lastPrice)} (${pct(btcbrl.priceChangePercent)})`;

        usdAiText.textContent =
            `USD ${pct(usdbrl.priceChangePercent)} | BTCUSDT ${pct(btcusdt.priceChangePercent)} | ETHUSDT ${pct(ethusdt.priceChangePercent)}`;
    }


    // ATUALIZAÇÃO GERAL
    async function atualizarTudo() {
        const symbol = PAIR_MAP[currentPair];
        const candles = await fetchCandles(symbol, currentTF);

        renderChart(candles, symbol);

        aiTrendTitle.textContent = `Tendência atual (${symbol})`;
        aiTrendText.textContent = analisar(candles);

        atualizarVisaoGeral();
    }


    // EVENTOS
    pairSelect.addEventListener("change", () => {
        currentPair = pairSelect.value;
        atualizarTudo();
    });

    tfSelect.addEventListener("change", () => {
        currentTF = tfSelect.value;
        atualizarTudo();
    });


    // LOOP
    setInterval(atualizarTudo, 2000);

    // PRIMEIRA EXECUÇÃO
    atualizarTudo();

});
