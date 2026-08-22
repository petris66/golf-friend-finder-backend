import fs from "fs";
import path from "path";

function loadCourses() {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "data", "courses.json"), "utf8")
  );
}

async function debugCourse(course, date) {
  const url = `${course.api}/api/1.0/reservations/?productid=${course.productId}&date=${date}&golf=1`;

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" }
    });

    const data = await response.json();

    return {
      course: course.name,
      status: response.status,
      topLevelKeys: Object.keys(data),
      counts: {
        reservationsGolfPlayers: Array.isArray(data.reservationsGolfPlayers)
          ? data.reservationsGolfPlayers.length
          : null,
        rows: Array.isArray(data.rows)
          ? data.rows.length
          : null,
        reservations: Array.isArray(data.reservations)
          ? data.reservations.length
          : null
      },
      playerSamples: Array.isArray(data.reservationsGolfPlayers)
        ? data.reservationsGolfPlayers.slice(0,3)
        : [],
      rowSamples: Array.isArray(data.rows)
        ? data.rows.slice(0,3)
        : []
    };

  } catch (e) {
    return { course: course.name, error: e.message };
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const date = req.query.date || new Date().toISOString().slice(0,10);
  const courses = loadCourses();

  const selected = typeof req.query.courses === "string"
    ? req.query.courses.split(",").filter(Boolean)
    : [];

  const results = await Promise.all(
    selected.filter(id => courses[id]).map(id => debugCourse(courses[id], date))
  );

  res.status(200).json({
    ok: true,
    version: "0.2.1-debug",
    date,
    results
  });
}
