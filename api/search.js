import fs from "fs";
import path from "path";

function loadCourses() {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "data", "courses.json"), "utf8")
  );
}

async function inspectCourse(course, date) {
  const url = `${course.api}/api/1.0/reservations/?productid=${course.productId}&date=${date}&golf=1`;

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" }
    });

    const data = await response.json();
    const players = Array.isArray(data.reservationsGolfPlayers)
      ? data.reservationsGolfPlayers
      : [];

    const rowsWithFirstName = players.filter(
      p => typeof p.firstName === "string" && p.firstName.trim() !== ""
    ).length;

    const rowsWithFamilyName = players.filter(
      p => typeof p.familyName === "string" && p.familyName.trim() !== ""
    ).length;

    const rowsNotReserved = players.filter(
      p => (p.familyName || "").trim().toLowerCase() !== "varattu"
    ).length;

    const namedSamples = players
      .filter(p => (p.firstName || "").trim() !== "")
      .slice(0, 10)
      .map(p => ({
        firstName: p.firstName ?? null,
        familyName: p.familyName ?? null,
        dateTimeStart: p.dateTimeStart ?? null,
        clubName: p.clubName ?? null,
        namePublic: p.namePublic ?? null
      }));

    return {
      course: course.name,
      status: response.status,
      url,
      totalFromAPI: players.length,
      rowsWithFirstName,
      rowsWithFamilyName,
      rowsNotReserved,
      first20: players.slice(0, 20).map(p => ({
        firstName: p.firstName ?? null,
        familyName: p.familyName ?? null,
        dateTimeStart: p.dateTimeStart ?? null,
        clubName: p.clubName ?? null,
        namePublic: p.namePublic ?? null
      })),
      namedSamples
    };
  } catch (error) {
    return {
      course: course.name,
      url,
      errorName: error.name,
      errorMessage: error.message
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
    : [];

  const results = await Promise.all(
    selected
      .filter(id => courses[id])
      .map(id => inspectCourse(courses[id], date))
  );

  return res.status(200).json({
    ok: true,
    version: "0.1.7",
    date,
    results
  });
}
