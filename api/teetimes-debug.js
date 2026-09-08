import fs from "fs";
import path from "path";

function loadCourses() {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "data", "courses.json"), "utf8")
  );
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const courseId = req.query.course || "hyvinkaa";
  const courses = loadCourses();
  const course = courses[courseId];

  if (!course) {
    return res.status(400).json({
      ok: false,
      error: `Tuntematon kenttä: ${courseId}`
    });
  }

  const base = `${course.api}/api/1.0/`;
  const pid = encodeURIComponent(course.productId);
  const day = encodeURIComponent(date);

  const headers = {
    Accept: "application/json",
    "X-Session-Type": "wisegolf"
  };

  if (process.env.WISEGOLF_TOKEN) {
    headers.Authorization = process.env.WISEGOLF_TOKEN;
  }

  async function get(endpoint) {
    const response = await fetch(`${base}${endpoint}`, {
      cache: "no-store",
      headers
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    try {
      return JSON.parse(text);
    } catch {
      return { rawText: text };
    }
  }

  try {
    const initialization = await get(
      `reservations/initialization/?productid=${pid}`
    );

    const calendarSettings = await get(
      `reservations/calendarsettings/?productid=${pid}&date=${day}`
    );

    const reservations = await get(
      `reservations/?productid=${pid}&date=${day}&golf=1`
    );

    return res.status(200).json({
      ok: true,
      debug: "tee-times-v1",
      courseId,
      course: course.name,
      productId: course.productId,
      date,

      initializationKeys:
        initialization && typeof initialization === "object"
          ? Object.keys(initialization)
          : [],

      calendarSettings,

      reservations: {
        keys:
          reservations && typeof reservations === "object"
            ? Object.keys(reservations)
            : [],
        rows: Array.isArray(reservations?.rows) ? reservations.rows : [],
        reservationsGolfPlayers: Array.isArray(
          reservations?.reservationsGolfPlayers
        )
          ? reservations.reservationsGolfPlayers
          : [],
        resourceComments: reservations?.resourceComments ?? null
      }
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      courseId,
      course: course.name,
      date,
      error: error.message
    });
  }
}
