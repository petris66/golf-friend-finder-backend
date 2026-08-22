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

  const namedPlayers = players.filter(p => {
    const first = (p.firstName || "").trim();
    const family = (p.familyName || "").trim();

    return first.length > 0 ||
      (family.length > 0 && family.toLowerCase() !== "varattu");
  });

  return {
    course: course.name,
    status: response.status,
    totalPlayers: players.length,
    namedPlayersCount: namedPlayers.length,
    namedPlayers: namedPlayers.map(p => ({
      firstName: p.firstName || "",
      familyName: p.familyName || "",
      dateTimeStart: p.dateTimeStart || null,
      clubName: p.clubName || null,
      playerId: p.playerId || null
    }))
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
    version: "0.2.2-debug",
    date,
    results
  });
}
