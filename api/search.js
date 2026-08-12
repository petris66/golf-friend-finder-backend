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

    return {
      ok: true,
      course: course.name,
      url,
      status: response.status,
      players: (data.reservationsGolfPlayers || [])
        .map(p => ({
          name: `${p.firstName || ""} ${p.familyName || ""}`.trim(),
          course: course.name,
          date,
          time: p.dateTimeStart || null
        }))
        .filter(p => p.name && p.name.toLowerCase() !== "varattu")
    };
  } catch (error) {
    return {
      ok: false,
      course: course.name,
      url,
      errorName: error.name,
      errorMessage: error.message,
      cause: error.cause
        ? {
            code: error.cause.code || null,
            message: error.cause.message || String(error.cause),
            hostname: error.cause.hostname || null
          }
        : null
    };
  }
}

export default async function handler(req, res) {
  const date = typeof req.query.date === "string"
    ? req.query.date
    : new Date().toISOString().slice(0, 10);

  const courses = loadCourses();

  const selected = typeof req.query.courses === "string"
    ? req.query.courses.split(",").map(x => x.trim()).filter(Boolean)
    : Object.keys(courses);

  // Diagnostic special case: when exactly one course is requested,
  // execute only that one fetch in this serverless invocation.
  if (selected.length === 1) {
    const id = selected[0];
    const course = courses[id];

    if (!course) {
      return res.status(400).json({
        ok: false,
        date,
        error: `Unknown course: ${id}`
      });
    }

    const result = await fetchCourse(course, date);

    return res.status(200).json({
      ok: result.ok,
      mode: "single-course-test",
      id,
      date,
      result
    });
  }

  // Keep multi-course mode available for comparison.
  const settled = await Promise.allSettled(
    selected
      .filter(id => courses[id])
      .map(id => fetchCourse(courses[id], date))
  );

  const courseResults = settled.map(item =>
    item.status === "fulfilled"
      ? item.value
      : { ok: false, errorMessage: item.reason?.message || "Unknown error" }
  );

  const results = courseResults.flatMap(r =>
    r.ok && Array.isArray(r.players) ? r.players : []
  );

  return res.status(200).json({
    ok: courseResults.every(r => r.ok),
    mode: "multi-course-test",
    date,
    count: results.length,
    results,
    diagnostics: courseResults
  });
}
