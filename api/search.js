import fs from "fs";
import path from "path";

function loadCourses() {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "data", "courses.json"), "utf8")
  );
}

async function fetchCourse(course, date) {
  const url = `${course.api}/api/1.0/reservations/?productid=${course.productId}&date=${date}&golf=1`;

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" }
    });

    const data = await response.json();
    const players = data.reservationsGolfPlayers || [];

    return players
      .filter(player => {
        const family = (player.familyName || "").trim().toLowerCase();
        return family && family !== "varattu";
      })
      .map(player => ({
        firstName: player.firstName || "",
        familyName: player.familyName || "",
        name: `${player.firstName || ""} ${player.familyName || ""}`.trim(),
        course: course.name,
        date,
        time: player.dateTimeStart || null,
        club: player.clubName || null
      }));

  } catch (error) {
    return [{
      error: true,
      course: course.name,
      message: error.message
    }];
  }
}

export default async function handler(req, res) {
  const date = typeof req.query.date === "string"
    ? req.query.date
    : new Date().toISOString().slice(0, 10);

  const courses = loadCourses();

  const selected = typeof req.query.courses === "string"
    ? req.query.courses.split(",").map(x => x.trim()).filter(Boolean)
    : [];

  const results = await Promise.all(
    selected
      .filter(id => courses[id])
      .map(id => fetchCourse(courses[id], date))
  );

  const flat = results.flat();

  return res.status(200).json({
    ok: true,
    date,
    count: flat.length,
    results: flat
  });
}
