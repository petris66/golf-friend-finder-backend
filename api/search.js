import fs from "fs";
import path from "path";

function loadCourses() {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "data", "courses.json"), "utf8")
  );
}

async function inspectCourse(course, date) {
  const url = `${course.api}/api/1.0/reservations/?productid=${course.productId}&date=${date}&golf=1`;

  const response = await fetch(url, {
    headers: { Accept: "application/json" }
  });

  const data = await response.json();

  const players = Array.isArray(data.reservationsGolfPlayers)
    ? data.reservationsGolfPlayers
    : [];

  return {
    course: course.name,
    status: response.status,
    totalPlayers: players.length,
    playerKeys: players.length ? Object.keys(players[0]) : [],
    firstPlayers: players.slice(0, 5)
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const date = req.query.date || new Date().toISOString().slice(0,10);
  const courses = loadCourses();

  const selected = typeof req.query.courses === "string"
    ? req.query.courses.split(",").filter(Boolean)
    : [];

  const results = await Promise.all(
    selected.filter(id => courses[id]).map(id => inspectCourse(courses[id], date))
  );

  res.status(200).json({
    ok: true,
    version: "0.3.2-debug",
    date,
    results
  });
}
