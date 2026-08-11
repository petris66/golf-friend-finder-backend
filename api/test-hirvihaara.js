export default async function handler(req, res) {
  const url =
    "https://api.hirvihaarangolf.fi/api/1.0/reservations/?productid=7&date=2026-08-11&golf=1";

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json"
      }
    });

    const text = await response.text();

    return res.status(200).json({
      ok: true,
      status: response.status,
      contentType: response.headers.get("content-type"),
      preview: text.slice(0, 500)
    });
  } catch (error) {
    return res.status(200).json({
      ok: false,
      url,
      errorName: error.name,
      errorMessage: error.message,
      cause: error.cause || null
    });
  }
}
