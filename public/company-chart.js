(() => {
  const mount = document.getElementById("companyPriceChart");
  const status = document.getElementById("companyPriceStatus");
  const link = document.getElementById("companyPriceLink");
  if (!mount || !status || !link) return;
  let activeSymbol = "";
  let timeout;
  window.CompanyPriceChart = {
    load(value) {
      const symbol = String(value || "").trim().toUpperCase();
      if (!/^[A-Z0-9][A-Z0-9.:-]{0,23}$/.test(symbol)) return;
      if (symbol === activeSymbol && mount.querySelector("iframe")) return;
      activeSymbol = symbol;
      clearTimeout(timeout);
      mount.replaceChildren();
      mount.hidden = false;
      status.textContent = `Loading ${symbol} price chart…`;
      link.href = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}`;
      const container = document.createElement("div");
      container.className = "tradingview-widget-container";
      const widget = document.createElement("div");
      widget.className = "tradingview-widget-container__widget";
      const credit = document.createElement("div");
      credit.className = "tradingview-widget-copyright";
      const attribution = document.createElement("a");
      attribution.href = link.href;
      attribution.target = "_blank";
      attribution.rel = "noopener nofollow";
      attribution.textContent = `${symbol} chart by TradingView`;
      credit.append(attribution);
      const script = document.createElement("script");
      script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
      script.async = true;
      script.textContent = JSON.stringify({
        autosize: true, symbol, interval: "D", timezone: "Etc/UTC", theme: "dark",
        style: "2", locale: "en", backgroundColor: "#08050d",
        gridColor: "rgba(196,155,250,0.05)", allow_symbol_change: false,
        hide_side_toolbar: true, hide_top_toolbar: false, hide_volume: false,
        withdateranges: true, save_image: false, calendar: false,
        support_host: "https://www.tradingview.com",
        overrides: { "mainSeriesProperties.lineStyle.color": "#c49bfa" }
      });
      const observer = new MutationObserver(() => {
        const frame = container.querySelector("iframe");
        if (!frame) return;
        frame.title = `${symbol} interactive stock price chart`;
        clearTimeout(timeout);
        status.textContent = `${symbol} · TradingView market chart · exchange delays may apply`;
        observer.disconnect();
      });
      observer.observe(container, { childList: true, subtree: true });
      script.onerror = () => {
        if (activeSymbol !== symbol) return;
        clearTimeout(timeout);
        observer.disconnect();
        status.textContent = `The ${symbol} chart could not connect. Try searching again or open it on TradingView below.`;
      };
      container.append(widget, credit, script);
      mount.append(container);
      timeout = setTimeout(() => {
        observer.disconnect();
        if (activeSymbol === symbol && !container.querySelector("iframe")) {
          status.textContent = `The ${symbol} chart is taking longer to load. Try again or open it on TradingView below.`;
        }
      }, 20000);
    }
  };
})();
