function sendJson(res, statusCode, body) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "public, max-age=15, stale-while-revalidate=30");
  return res.status(statusCode).json(body);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  const ids = String(req.query?.ids || "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => /^[a-z0-9-]+$/.test(id));

  if (!ids.length || ids.length > 20) {
    return sendJson(res, 400, { error: "Valid CoinGecko asset ids are required." });
  }

  const url = new URL("https://api.coingecko.com/api/v3/simple/price");
  url.searchParams.set("ids", ids.join(","));
  url.searchParams.set("vs_currencies", "usd");
  url.searchParams.set("precision", "full");

  try {
    const response = await fetch(url);
    const payload = await response.json();
    if (!response.ok) {
      return sendJson(res, response.status, {
        error: "CoinGecko market data request failed.",
      });
    }
    return sendJson(res, 200, payload);
  } catch {
    return sendJson(res, 502, { error: "CoinGecko market data is unavailable." });
  }
}
