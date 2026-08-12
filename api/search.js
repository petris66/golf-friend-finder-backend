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

    const text = await response.text();
    const data = JSON.parse(text);

    return (data.reservationsGolfPlayers || [])
      .map(p => ({
        name: `${p.firstName || ""} ${p.familyName || ""}`.trim(),
        course: course.name,
        date,
        time: p.dateTimeStart || null
      }))
      .filter(p => p.name && p.name.toLowerCase() !== "varattu");

  } catch (error) {
    return [{
      course: course.name,
      url,
      errorName: error.name,
      errorMessage: error.message
    }];
  }
}

export default async function handler(req, res) {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const courses = loadCourses();

  const selected = typeof req.query.courses === "string"
    ? req.query.courses.split(",")
    : Object.keys(courses);

  const results = await Promise.all(
    selected
      .filter(id => courses[id])
      .map(id => fetchCourse(courses[id], date))
  );

  return res.status(200).json({
    ok: true,
    date,
    count: results.flat().length,
    results: results.flat()
  });
}
