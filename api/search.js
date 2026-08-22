import fs from "fs";
import path from "path";

function loadCourses() {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "data", "courses.json"), "utf8")
  );
}

async function getRaw(course, date) {
  const url = `${course.api}/api/1.0/reservations/?productid=${course.productId}&date=${date}&golf=1`;

  try {
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    const data = await r.json();

    return {
      course: course.name,
      status: r.status,
      url,
      topLevelKeys: Object.keys(data),
      sampleKeys: data.reservationsGolfPlayers && data.reservationsGolfPlayers[0]
        ? Object.keys(data.reservationsGolfPlayers[0])
        : [],
      sampleRows: data.reservationsGolfPlayers
        ? data.reservationsGolfPlayers.slice(0, 5)
        : [],
      rawCounts: {
        reservationsGolfPlayers: Array.isArray(data.reservationsGolfPlayers)
          ? data.reservationsGolfPlayers.length
          : null
      }
    };
  } catch (e) {
    return { course: course.name, error: e.message };
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const date = req.query.date || new Date().toISOString().slice(0,10);
  const courses = loadCourses();
  const selected = typeof req.query.courses === "string"
    ? req.query.courses.split(",").filter(Boolean)
    : [];

  const results = await Promise.all(
    selected.filter(id => courses[id]).map(id => getRaw(courses[id], date))
  );

  res.status(200).json({
    ok: true,
    version: "0.1.9-debug",
    date,
    results
  });
}
