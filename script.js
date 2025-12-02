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
    let intervalId;

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


    // FUNÇÕES DE FORMATAÇÃO
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


    // BUSCA DE TICKERS
    async function fetchTicker(symbol) {
        try {
            const res = await fetch(`${BINANCE}/api/v3/ticker/24hr?symbol=${symbol}`);
            return await res.json();
        } catch {
            return null;
        }
    }


    // BUSCA DE CANDLES (com fallback)
    async function fetchCandles(symbol, interval) {
        try {
            let url = `${BINANCE}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=200`;
            let res = await fetch(url);
            let data = await res.json();

            if (!Array.isArray(data) || data.length < 5) {
                url = `${BINANCE}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=20`;
                res = await fetch(url);
                data = await res.json();
            }

            return data.map(k => ({
                x: new Date(k[0]).toISOString(),
                o: +k[1], h: +k[2], l: +k[3], c: +k[4]
            }));
        } catch {
            return [];
        }
    }


    // GRÁFICO
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
                datasets: [{ label, data, borderColor: "#00d084", backgroundColor: "#00d084" }]
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


    // ANÁLISE DE TENDÊNCIA
    function analizarTrend(c) {
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
            return "Tendência de alta forte.";

        if (pctChange < -0.5 && !topos && !fundos)
            return "Tendência de baixa clara.";

        if (Math.abs(pctChange) < 0.5)
            return "Mercado lateral.";

        return "Movimento indefinido.";
    }


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
        usdRange.textContent = `R$ ${brl(usdbrl.lowPrice)} – R$ ${brl(usdbrl.highPrice)}`;
        addColorClass(usdChange, usdbrl.priceChangePercent);

        btcInfo.textContent = `$ ${usd(btcusdt.lastPrice)} (${pct(btcusdt.priceChangePercent)})`;
        addColorClass(btcInfo, btcusdt.priceChangePercent);

        ethInfo.textContent = `$ ${usd(ethusdt.lastPrice)} (${pct(ethusdt.priceChangePercent)})`;
        addColorClass(ethInfo, ethusdt.priceChangePercent);

        btcbrlInfo.textContent = `R$ ${brl(btcbrl.lastPrice)} (${pct(btcbrl.priceChangePercent)})`;
        addColorClass(btcbrlInfo, btcbrl.priceChangePercent);

        usdAiText.textContent =
            `USD: ${pct(usdbrl.priceChangePercent)} | ` +
            `BTCUSDT: ${pct(btcusdt.priceChangePercent)} | ` +
            `ETHUSDT: ${pct(ethusdt.priceChangePercent)} | ` +
            `BTCBRL: ${pct(btcbrl.priceChangePercent)}`;
    }


    // ATUALIZA TUDO
    async function atualizarTudo() {
        const pair = PAIR_MAP[currentPair];
        const candles = await fetchCandles(pair, currentTF);

        renderChart(candles, pair);

        aiTrendTitle.textContent = `Tendência atual (${pair})`;
        aiTrendText.textContent = analizarTrend(candles);

        atualizarVisaoGeral();
    }


    // EVENTOS SELECT
    pairSelect.addEventListener("change", () => {
        currentPair = pairSelect.value;
        atualizarTudo();
    });

    tfSelect.addEventListener("change", () => {
        currentTF = tfSelect.value;
        atualizarTudo();
    });


    // LOOP AUTOMÁTICO
    intervalId = setInterval(atualizarTudo, 2000);


    // PRIMEIRA EXECUÇÃO
    atualizarTudo();
});
