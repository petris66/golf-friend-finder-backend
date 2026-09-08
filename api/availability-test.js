import fs from "fs";
import path from "path";

function loadCourses() {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "data", "courses.json"), "utf8")
  );
}

function hhmm(value) {
  return String(value || "").slice(11, 16);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const courseId = req.query.course || "hyvinkaa";
  const from = req.query.from || "14:00";
  const to = req.query.to || "16:00";
  const playersNeeded = Math.min(4, Math.max(1, Number(req.query.players) || 2));

  const courses = loadCourses();
  const course = courses[courseId];

  if (!course) {
    return res.status(400).json({ ok: false, error: `Tuntematon kenttä: ${courseId}` });
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
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    try { return JSON.parse(text); } catch { return {}; }
  }

  try {
    await get(`reservations/initialization/?productid=${pid}`);
    const calendar = await get(
      `reservations/calendarsettings/?productid=${pid}&date=${day}`
    );
    const reservations = await get(
      `reservations/?productid=${pid}&date=${day}&golf=1`
    );

    const settings = calendar?.reservationSettings || calendar?.settings || {};
    const startTime = String(settings.startTime || "07:00:00").slice(0, 5);
    const endTime = String(settings.endTime || "21:00:00").slice(0, 5);
    const duration = Number(settings.duration) || 10;

    const players = Array.isArray(reservations?.reservationsGolfPlayers)
      ? reservations.reservationsGolfPlayers
      : [];

    const occupied = new Map();
    for (const p of players) {
      const t = hhmm(p.dateTimeStart);
      if (t) occupied.set(t, (occupied.get(t) || 0) + 1);
    }

    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    let minute = sh * 60 + sm;
    const endMinute = eh * 60 + em;

    const teeTimes = [];
    while (minute <= endMinute) {
      const h = String(Math.floor(minute / 60)).padStart(2, "0");
      const m = String(minute % 60).padStart(2, "0");
      const time = `${h}:${m}`;
      const used = occupied.get(time) || 0;
      const free = Math.max(0, 4 - used);

      if (time >= from && time <= to && free >= playersNeeded) {
        teeTimes.push({ time, occupied: used, free });
      }
      minute += duration;
    }

    return res.status(200).json({
      ok: true,
      test: "availability-v1",
      courseId,
      course: course.name,
      date,
      from,
      to,
      players: playersNeeded,
      schedule: { startTime, endTime, duration },
      teeTimes
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      courseId,
      date,
      error: error.message
    });
  }
}
