function sendJson(res, statusCode, body) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "public, max-age=15, stale-while-revalidate=30");
  return res.status(statusCode).json(body);
}

const SUPPORTED_COINGECKO_IDS = new Set(["bitcoin", "ethereum", "litecoin"]);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  const ids = String(req.query?.ids || "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => /^[a-z0-9-]+$/.test(id));

  if (!ids.length || ids.length > 20 || ids.some((id) => !SUPPORTED_COINGECKO_IDS.has(id))) {
    return sendJson(res, 400, { error: "Valid CoinGecko asset ids are required." });
  }

  const chart = String(req.query?.chart || "") === "1";
  const days = String(req.query?.days || "1");
  const allowedDays = new Set(["1", "7", "30"]);
  if (chart && (ids.length !== 1 || !allowedDays.has(days))) {
    return sendJson(res, 400, { error: "A single valid asset and chart range are required." });
  }

  const url = chart
    ? new URL(`https://api.coingecko.com/api/v3/coins/${ids[0]}/market_chart`)
    : new URL("https://api.coingecko.com/api/v3/simple/price");
  if (chart) {
    url.searchParams.set("vs_currency", "usd");
    url.searchParams.set("days", days);
    url.searchParams.set("precision", "full");
  } else {
    url.searchParams.set("ids", ids.join(","));
    url.searchParams.set("vs_currencies", "usd");
    url.searchParams.set("precision", "full");
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      const payload = await response.json();
      if (!response.ok) {
        return sendJson(res, response.status, {
          error: "CoinGecko market data request failed.",
        });
      }
      return sendJson(res, 200, payload);
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    if (error?.name === "AbortError") {
      return sendJson(res, 504, { error: "CoinGecko market data request timed out." });
    }
    return sendJson(res, 502, { error: "CoinGecko market data is unavailable." });
  }
}
