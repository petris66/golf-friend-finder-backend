import fs from "fs";
import path from "path";

function loadCourses() {
  const filePath = path.join(process.cwd(), "data", "courses.json");
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export default async function handler(req, res) {
  const date = typeof req.query.date === "string"
    ? req.query.date
    : "2026-08-11";

  const courses = loadCourses();

  const selected = typeof req.query.courses === "string"
    ? req.query.courses.split(",")
    : Object.keys(courses);

  const debug = [];

  for (const id of selected) {
    const course = courses[id];
    if (!course) continue;

    const url = `${course.api}/api/1.0/reservations/?productid=${course.productId}&date=${date}&golf=1`;

    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json"
        }
      });

      const text = await response.text();

      debug.push({
        id,
        course: course.name,
        url,
        status: response.status,
        preview: text.slice(0, 200)
      });

    } catch (error) {
      debug.push({
        id,
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
    debug
  });
}
