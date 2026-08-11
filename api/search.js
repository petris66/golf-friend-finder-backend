import courses from "../data/courses.json" assert { type: "json" };

export default async function handler(req, res) {
  const date = typeof req.query.date === "string"
    ? req.query.date
    : new Date().toISOString().slice(0, 10);

  const selected = typeof req.query.courses === "string"
    ? req.query.courses.split(",")
    : Object.keys(courses);

  const names = typeof req.query.names === "string"
    ? req.query.names.toLowerCase().split(",").map(x => x.trim())
    : [];

  const results = [];

  for (const id of selected) {
    const course = courses[id];
    if (!course) continue;

    const url = `${course.api}/api/1.0/reservations/?productid=${course.productId}&date=${date}&golf=1`;

    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" }
      });

      const data = await response.json();

      const players = data.reservationsGolfPlayers || [];

      for (const p of players) {
        const fullName = `${p.firstName || ""} ${p.familyName || ""}`.trim();

        if (!names.length || names.some(n => fullName.toLowerCase().includes(n))) {
          results.push({
            name: fullName,
            course: course.name,
            date,
            time: p.dateTimeStart || null
          });
        }
      }
    } catch (e) {
      results.push({
        course: course.name,
        error: e.message
      });
    }
  }

  return res.status(200).json({
    ok: true,
    date,
    count: results.length,
    results
  });
}
