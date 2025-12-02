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

    let chart;
    let candleSeries;

    // Criar gráfico TradingView
    function initChart() {
        chart = LightweightCharts.createChart(document.getElementById("chart"), {
            layout: {
                background: { color: "#0a0f1f" },
                textColor: "#d1e4ff"
            },
            grid: {
                vertLines: { color: "#0f1c30" },
                horzLines: { color: "#0f1c30" }
            },
            timeScale: { borderColor: "#1c2c45" },
            rightPriceScale: { borderColor: "#1c2c45" },
        });

        candleSeries = chart.addCandlestickSeries({
            upColor: "#00ff99",
            downColor: "#ff4d4d",
            borderDownColor: "#ff4d4d",
            borderUpColor: "#00ff99",
            wickDownColor: "#ff4d4d",
            wickUpColor: "#00ff99",
        });
    }

    initChart();


    // Formatadores
    const pct = v => Number(v).toFixed(2) + "%";
    const brl = v => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
    const usd = v => Number(v).toLocaleString("en-US", { minimumFractionDigits: 2 });


    function addColorClass(el, v) {
        el.classList.remove("up", "down");
        const num = Number(v);
        if (num > 0) el.classList.add("up");
        if (num < 0) el.classList.add("down");
    }


    // Buscar candles
    async function fetchCandles(symbol, interval) {
        const url = `${BINANCE}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=200`;
        const res = await fetch(url);
        const data = await res.json();

        return data.map(c => ({
            time: c[0] / 1000,
            open: +c[1],
            high: +c[2],
            low: +c[3],
            close: +c[4]
        }));
    }


    // Tickers da visão geral
    async function fetchTicker(symbol) {
        const r = await fetch(`${BINANCE}/api/v3/ticker/24hr?symbol=${symbol}`);
        return r.json();
    }


    // Atualizar visão geral
    async function atualizarVisao() {

        const [usdbrl, btcusdt, ethusdt, btcbrl] = await Promise.all([
            fetchTicker("USDTBRL"),
            fetchTicker("BTCUSDT"),
            fetchTicker("ETHUSDT"),
            fetchTicker("BTCBRL")
        ]);

        usdPrice.textContent = "R$ " + brl(usdbrl.lastPrice);
        usdChange.textContent = pct(usdbrl.priceChangePercent);
        usdRange.textContent = `Faixa: R$ ${brl(usdbrl.lowPrice)} – R$ ${brl(usdbrl.highPrice)}`;
        addColorClass(usdChange, usdbrl.priceChangePercent);

        btcInfo.textContent = `$ ${usd(btcusdt.lastPrice)} (${pct(btcusdt.priceChangePercent)})`;
        addColorClass(btcInfo, btcusdt.priceChangePercent);

        ethInfo.textContent = `$ ${usd(ethusdt.lastPrice)} (${pct(ethusdt.priceChangePercent)})`;
        addColorClass(ethInfo, ethusdt.priceChangePercent);

        btcbrlInfo.textContent = `R$ ${brl(btcbrl.lastPrice)} (${pct(btcbrl.priceChangePercent)})`;
        addColorClass(btcbrlInfo, btcbrl.priceChangePercent);

        usdAiText.textContent =
            `USD ${pct(usdbrl.priceChangePercent)} | BTC ${pct(btcusdt.priceChangePercent)} | ETH ${pct(ethusdt.priceChangePercent)}`;
    }


    // Tendência da "IA"
    function analisarTrend(c) {
        if (!c || c.length < 5) return "Aguardando candles...";

        const last = c.slice(-4);
        const diff = last[3].close - last[2].close;

        if (diff > 0) return "Tendência de alta.";
        if (diff < 0) return "Tendência de baixa.";
        return "Mercado lateral.";
    }


    // Atualização geral
    async function atualizarTudo() {

        const symbol = PAIR_MAP[currentPair];

        const candles = await fetchCandles(symbol, currentTF);

        candleSeries.setData(candles);

        aiTrendTitle.textContent = `Tendência atual (${symbol})`;
        aiTrendText.textContent = analisarTrend(candles);

        atualizarVisao();
    }


    // Eventos selects
    pairSelect.addEventListener("change", () => {
        currentPair = pairSelect.value;
        atualizarTudo();
    });

    tfSelect.addEventListener("change", () => {
        currentTF = tfSelect.value;
        atualizarTudo();
    });

    // Atualização 2s
    setInterval(atualizarTudo, 2000);

    atualizarTudo();

});
