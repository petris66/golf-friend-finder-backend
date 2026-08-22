import fs from "fs";
import path from "path";

function loadCourses() {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "data", "courses.json"), "utf8")
  );
}

async function fetchCourse(course, date) {
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
      return {};
    }
  }

  try {
    await get(`reservations/initialization/?productid=${pid}`);
    await get(`reservations/calendarsettings/?productid=${pid}&date=${day}`);

    const data = await get(
      `reservations/?productid=${pid}&date=${day}&golf=1`
    );

    const players = Array.isArray(data.reservationsGolfPlayers)
      ? data.reservationsGolfPlayers
      : [];

    const namedPlayers = players.filter(p => {
      const first = (p.firstName || "").trim();
      const last = (p.familyName || "").trim();
      return first.length > 0 && last.toLowerCase() !== "varattu";
    });

    return {
      course: course.name,
      status: 200,
      players: namedPlayers
    };
  } catch (error) {
    return {
      course: course.name,
      error: error.message
    };
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
    selected.filter(id => courses[id]).map(id => fetchCourse(courses[id], date))
  );

  res.status(200).json({
    ok: true,
    version: "0.4.3",
    date,
    results
  });
}
