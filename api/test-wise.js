export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const date = typeof req.query.date === "string"
    ? req.query.date
    : new Date().toISOString().slice(0, 10);

  const url =
    `https://api.espoogolf.fi/api/1.0/reservations/?productid=29&date=${encodeURIComponent(date)}&golf=1`;

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      redirect: "manual"
    });

    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();

    let body = text;
    if (contentType.includes("application/json")) {
      try { body = JSON.parse(text); } catch {}
    }

    return res.status(200).json({
      ok: response.ok,
      test: "Vercel -> WiseGolf API",
      target: "Gumböle Golf 18r",
      date,
      wiseGolfStatus: response.status,
      wiseGolfContentType: contentType,
      responsePreview: typeof body === "string" ? body.slice(0, 1000) : body
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      test: "Vercel -> WiseGolf API",
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
