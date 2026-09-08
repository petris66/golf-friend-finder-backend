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

    const rows = Array.isArray(reservations?.rows) ? reservations.rows : [];

    // Detect the actual 18-hole golf resource from WiseGolf calendar settings.
    // This avoids course-specific resourceId hardcoding (e.g. Hyvinkää=1, Gumböle=3).
    const calendarResources = Array.isArray(settings.resources) ? settings.resources : [];
    const golfResource = calendarResources.find(
      r => String(r?.resourceCategory || "").toLowerCase() === "golf18"
    );

    if (!golfResource) {
      throw new Error("Golf18 resource not found in calendar settings");
    }

    const golfResourceId = String(golfResource.resourceId);
    const capacity = Math.max(1, Number(golfResource.quantity) || 4);

    // WiseGolf rows represent occupied/blocked capacity for the tee time.
    // Count only normal golf reservation rows (res_golf) for the detected course resource.
    const occupied = new Map();
    for (const row of rows) {
      if (row?.label !== "res_golf") continue;

      const resources = Array.isArray(row?.resources) ? row.resources : [];
      const belongsToCourse = resources.some(
        r => String(r?.resourceId) === golfResourceId
      );
      if (!belongsToCourse) continue;

      const t = hhmm(row.start);
      if (!t) continue;

      const qty = Math.max(1, Number(row.quantity) || 1);
      occupied.set(t, (occupied.get(t) || 0) + qty);
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
      const used = Math.min(capacity, occupied.get(time) || 0);
      const free = Math.max(0, capacity - used);

      if (time >= from && time <= to && free >= playersNeeded) {
        teeTimes.push({ time, occupied: used, free });
      }
      minute += duration;
    }

    return res.status(200).json({
      ok: true,
      test: "availability-auto-resource-v3",
      courseId,
      course: course.name,
      date,
      from,
      to,
      players: playersNeeded,
      resource: { resourceId: golfResource.resourceId, resourceName: golfResource.resourceName, capacity },
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
