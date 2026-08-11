import fs from "fs";
import path from "path";

function loadCourses() {
  const filePath = path.join(process.cwd(), "data", "courses.json");
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export default async function handler(req, res) {
  const date = typeof req.query.date === "string"
    ? req.query.date
    : new Date().toISOString().slice(0, 10);

  const courses = loadCourses();

  const selected = typeof req.query.courses === "string"
    ? req.query.courses.split(",")
    : Object.keys(courses);

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

      for (const player of players) {
        const fullName = `${player.firstName || ""} ${player.familyName || ""}`.trim();
        if (!fullName || fullName.toLowerCase() === "varattu") continue;

        results.push({
          name: fullName,
          course: course.name,
          date,
          time: player.dateTimeStart || null
        });
      }
    } catch (error) {
      results.push({
        course: course.name,
        url,
        errorName: error.name,
        errorMessage: error.message
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
