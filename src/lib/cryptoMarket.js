import { useEffect, useState } from "react";

export const CRYPTO_ASSETS = [
  { symbol: "BTC", name: "Bitcoin", coinGeckoId: "bitcoin" },
  { symbol: "ETH", name: "Ethereum", coinGeckoId: "ethereum" },
  { symbol: "LTC", name: "Litecoin", coinGeckoId: "litecoin" },
  { symbol: "BNB", name: "BNB", coinGeckoId: "binancecoin" },
];

const COINGECKO_API_URL = "/api/market-prices";
const BINANCE_STREAM_URL =
  "wss://stream.binance.com:9443/stream?streams=btcusdt@ticker/ethusdt@ticker/ltcusdt@ticker/bnbusdt@ticker";
const MAX_HISTORY = 60;
const POLL_INTERVAL_MS = 30000;
const STALE_TTL_MS = POLL_INTERVAL_MS * 2;
const STREAM_RECONNECT_MS = 5000;

function buildAssetState() {
  return Object.fromEntries(
    CRYPTO_ASSETS.map((asset) => [
      asset.symbol,
      {
        symbol: asset.symbol,
        name: asset.name,
        coinGeckoId: asset.coinGeckoId,
        price: null,
        entryPrice: null,
        timestamp: null,
        connected: false,
        loading: true,
        stale: false,
        error: "",
        history: [],
      },
    ]),
  );
}

export function useCryptoMarketData() {
  const [assets, setAssets] = useState(() => buildAssetState());

  useEffect(() => {
    let isActive = true;
    let requestController = null;
    let socket = null;
    let reconnectTimer = null;

    const updateAssetState = (symbol, updater) => {
      setAssets((previous) => {
        const currentValue = previous[symbol];
        if (!currentValue) return previous;
        return { ...previous, [symbol]: updater(currentValue) };
      });
    };

    const applyPrices = (prices) => {
      const timestamp = Date.now();
      setAssets((previous) => {
        const next = { ...previous };
        for (const asset of CRYPTO_ASSETS) {
          const price = Number(prices?.[asset.coinGeckoId]?.usd);
          if (!Number.isFinite(price) || price <= 0) {
            const currentValue = next[asset.symbol];
            next[asset.symbol] = {
              ...currentValue,
              loading: false,
              connected: false,
              error: "CoinGecko did not return a price for this asset.",
            };
            continue;
          }

          const currentValue = next[asset.symbol];
          const nextHistory = [
            ...(currentValue.history || []),
            { timestamp, price },
          ].slice(-MAX_HISTORY);

          next[asset.symbol] = {
            ...currentValue,
            price,
            entryPrice: currentValue.entryPrice || price,
            timestamp,
            connected: true,
            loading: false,
            stale: false,
            error: "",
            history: nextHistory,
          };
        }
        return next;
      });
    };

    const applyStreamPrice = (symbol, rawPrice) => {
      const price = Number(rawPrice);
      if (!Number.isFinite(price) || price <= 0) return;
      const timestamp = Date.now();
      setAssets((previous) => {
        const currentValue = previous[symbol];
        if (!currentValue) return previous;
        return {
          ...previous,
          [symbol]: {
            ...currentValue,
            price,
            entryPrice: currentValue.entryPrice || price,
            timestamp,
            connected: true,
            loading: false,
            stale: false,
            error: "",
            history: [...(currentValue.history || []), { timestamp, price }].slice(-MAX_HISTORY),
          },
        };
      });
    };

    const fetchPrices = async () => {
      requestController?.abort();
      requestController = new AbortController();

      const ids = CRYPTO_ASSETS.map((asset) => asset.coinGeckoId).join(",");
      const url = `${COINGECKO_API_URL}?ids=${ids}&vs_currencies=usd&precision=full`;

      try {
        const timeoutId = window.setTimeout(() => requestController?.abort(), 10000);
        const response = await fetch(url, {
          signal: requestController.signal,
          headers: { Accept: "application/json" },
        });
        window.clearTimeout(timeoutId);
        if (!response.ok) {
          throw new Error(`CoinGecko returned HTTP ${response.status}.`);
        }
        const prices = await response.json();
        if (!isActive) return;
        applyPrices(prices);
      } catch (reason) {
        if (!isActive || reason?.name === "AbortError") return;
        setAssets((previous) => {
          const next = { ...previous };
          for (const asset of CRYPTO_ASSETS) {
            const currentValue = next[asset.symbol];
            if (currentValue.price != null) {
              next[asset.symbol] = {
                ...currentValue,
                loading: false,
                connected: false,
                stale: currentValue.timestamp ? Date.now() - currentValue.timestamp > STALE_TTL_MS : false,
                error: "CoinGecko market data is temporarily unavailable.",
              };
              continue;
            }
            next[asset.symbol] = {
              ...currentValue,
              loading: false,
              connected: false,
              stale: currentValue.price != null,
              error: "CoinGecko market data is temporarily unavailable.",
            };
          }
          return next;
        });
      }
    };

    const connectStream = () => {
      if (!isActive || typeof WebSocket === "undefined") return;
      socket?.close();
      socket = new WebSocket(BINANCE_STREAM_URL);
      socket.onopen = () => {
        setAssets((previous) =>
          Object.fromEntries(
            Object.entries(previous).map(([symbol, value]) => [
              symbol,
              { ...value, error: "" },
            ]),
          ),
        );
      };
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          const streamSymbol = String(payload?.data?.s || "").replace("USDT", "");
          if (CRYPTO_ASSETS.some((asset) => asset.symbol === streamSymbol)) {
            applyStreamPrice(streamSymbol, payload.data.c);
          }
        } catch {
          // Ignore malformed provider frames and keep the REST fallback active.
        }
      };
      socket.onerror = () => socket?.close();
      socket.onclose = () => {
        if (!isActive) return;
        reconnectTimer = window.setTimeout(connectStream, STREAM_RECONNECT_MS);
      };
    };

    fetchPrices();
    connectStream();
    const pollTimer = window.setInterval(fetchPrices, POLL_INTERVAL_MS);
    const staleTimer = window.setInterval(() => {
      const now = Date.now();
      setAssets((previous) => {
        const next = { ...previous };
        let changed = false;

        for (const asset of CRYPTO_ASSETS) {
          const currentValue = next[asset.symbol];
          if (!currentValue.timestamp || now - currentValue.timestamp <= STALE_TTL_MS) {
            continue;
          }
          next[asset.symbol] = {
            ...currentValue,
            connected: false,
            stale: true,
            error: "CoinGecko price data is stale. Retrying...",
          };
          changed = true;
        }
        return changed ? next : previous;
      });
    }, POLL_INTERVAL_MS);

    return () => {
      isActive = false;
      requestController?.abort();
      socket?.close();
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      window.clearInterval(pollTimer);
      window.clearInterval(staleTimer);
    };
  }, []);

  return assets;
}
