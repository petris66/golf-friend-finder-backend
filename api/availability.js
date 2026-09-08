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

async function fetchAvailability(courseId, course, date, from, to, playersNeeded) {
  if (!course?.api || !course?.productId) {
    return {
      courseId,
      course: course?.name || courseId,
      error: "Course API configuration missing"
    };
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

    const calendarResources = Array.isArray(settings.resources)
      ? settings.resources
      : [];

    const golfResources = calendarResources.filter(
      r => String(r?.resourceCategory || "").toLowerCase() === "golf18"
    );

    if (!golfResources.length) {
      throw new Error("Golf18 resource not found in calendar settings");
    }

    // Most courses expose one golf18 resource. SHG exposes Luukki and Lakisto
    // under the same product, so return each resource separately.
    const rows = Array.isArray(reservations?.rows) ? reservations.rows : [];
    const resources = [];

    for (const golfResource of golfResources) {
      const golfResourceId = String(golfResource.resourceId);
      const capacity = Math.max(1, Number(golfResource.quantity) || 4);

      const occupied = new Map();

      if (courseId === "shg") {
        // SHG shares one product between Luukki and Lakisto. Its rows can contain
        // non-player golf reservations, so player capacity must be calculated
        // from actual reservationsGolfPlayers entries for each resource.
        const players = Array.isArray(reservations?.reservationsGolfPlayers)
          ? reservations.reservationsGolfPlayers
          : [];

        for (const player of players) {
          if (String(player?.resourceId) !== golfResourceId) continue;

          const t = hhmm(player.dateTimeStart);
          if (!t) continue;

          occupied.set(t, (occupied.get(t) || 0) + 1);
        }
      } else {
        for (const row of rows) {
          if (row?.label !== "res_golf") continue;

          const rowResources = Array.isArray(row?.resources) ? row.resources : [];
          const belongsToCourse = rowResources.some(
            r => String(r?.resourceId) === golfResourceId
          );
          if (!belongsToCourse) continue;

          const t = hhmm(row.start);
          if (!t) continue;

          const qty = Math.max(1, Number(row.quantity) || 1);
          occupied.set(t, (occupied.get(t) || 0) + qty);
        }
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

      resources.push({
        resourceId: golfResource.resourceId,
        resourceName: golfResource.resourceName || course.name,
        capacity,
        teeTimes
      });
    }

    return {
      courseId,
      course: course.name,
      status: 200,
      schedule: { startTime, endTime, duration },
      resources
    };
  } catch (error) {
    return {
      courseId,
      course: course.name,
      error: error.message
    };
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const from = req.query.from || "14:00";
  const to = req.query.to || "16:00";
  const playersNeeded = Math.min(
    4,
    Math.max(1, Number(req.query.players) || 1)
  );

  const courses = loadCourses();

  const selected = typeof req.query.courses === "string"
    ? req.query.courses.split(",").map(v => v.trim()).filter(Boolean)
    : [];

  if (!selected.length) {
    return res.status(400).json({
      ok: false,
      error: "Select at least one course with ?courses=..."
    });
  }

  const valid = selected.filter(id => courses[id]);

  if (!valid.length) {
    return res.status(400).json({
      ok: false,
      error: "No valid course ids selected"
    });
  }

  const results = await Promise.all(
    valid.map(id =>
      fetchAvailability(id, courses[id], date, from, to, playersNeeded)
    )
  );

  res.status(200).json({
    ok: true,
    version: "availability-v2-shg-players",
    date,
    from,
    to,
    players: playersNeeded,
    results
  });
}
