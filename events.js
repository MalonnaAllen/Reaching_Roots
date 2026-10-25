const crypto = require("crypto");
const {pool} = require("./middleware");

function parseUserId(value) {
  const userId = Number(value);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
}

function validateEventInput(body) {
  if (typeof body.title !== "string" || !body.title.trim()) {
    return "Event title is required.";
  }
  if (body.title.trim().length > 150) {
    return "Event title must be 150 characters or fewer.";
  }
  return null;
}

function createEnrollmentCode() {
  return `ROOT-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

function parseMonth(value) {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
    ? value
    : null;
}

function getAge(birthday) {
  const birthDate = new Date(birthday);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  if (
    today.getMonth() < birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() &&
      today.getDate() < birthDate.getDate())
  ) {
    age -= 1;
  }
  return age;
}

function dateStringsForMonth(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  const days = new Date(year, monthNumber, 0).getDate();
  return Array.from({length: days}, (_, index) => {
    return `${year}-${String(monthNumber).padStart(2, "0")}-${String(
      index + 1,
    ).padStart(2, "0")}`;
  });
}

function dateValueToString(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).slice(0, 10);
}

function displayCityName(city) {
  return city.replace(/\s+(city|town|village)$/, "");
}

function distanceInMiles(latitudeOne, longitudeOne, latitudeTwo, longitudeTwo) {
  const radians = Math.PI / 180;
  const latitudeDifference = (latitudeTwo - latitudeOne) * radians;
  const longitudeDifference = (longitudeTwo - longitudeOne) * radians;
  const a =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(latitudeOne * radians) *
      Math.cos(latitudeTwo * radians) *
      Math.sin(longitudeDifference / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function getHostEvent(eventId, userId) {
  const [events] = await pool.execute(
    "SELECT id FROM events WHERE id = ? AND HOST = ? LIMIT 1",
    [eventId, userId],
  );
  return events[0] || null;
}

async function getEventSuggestions(req, res, next) {
  const eventId = parseUserId(req.params.eventId);
  const userId = parseUserId(req.query.userId);
  const month = parseMonth(req.query.month);
  if (!eventId || !userId || !month) {
    res
      .status(400)
      .json({error: "A valid event, user ID, and month are required."});
    return;
  }

  try {
    if (!(await getHostEvent(eventId, userId))) {
      res
        .status(403)
        .json({error: "Only the event host can request suggestions."});
      return;
    }
    const [participants] = await pool.execute(
      `SELECT u.BIRTHDAY AS birthday, ua.unavailable_date AS unavailable,
              l.LATTITUDE AS latitude, l.LONGITUDE AS longitude
       FROM event_participants ep
       JOIN users u ON u.id = ep.user_id
       LEFT JOIN user_unavailability ua ON ua.user_id = u.id
       LEFT JOIN location l ON l.id = u.LOCATION
       WHERE ep.event_id = ?`,
      [eventId],
    );
    const [locations] = await pool.execute(
      "SELECT id, CITY AS city, STATE AS state, LATTITUDE AS latitude, LONGITUDE AS longitude FROM location",
    );
    const locatedParticipants = participants.filter(
      (participant) =>
        participant.latitude !== null && participant.longitude !== null,
    );
    const locationSuggestions = locations
      .map((candidate) => {
        const olderParticipantCount = locatedParticipants.filter(
          (participant) => getAge(participant.birthday) > 50,
        ).length;
        const score = locatedParticipants.reduce((total, participant) => {
          const age = getAge(participant.birthday);
          const ageWeight = 1 + Math.max(0, age - 50) / 500;
          return (
            total +
            distanceInMiles(
              Number(candidate.latitude),
              Number(candidate.longitude),
              Number(participant.latitude),
              Number(participant.longitude),
            ) *
              ageWeight
          );
        }, 0);
        return {
          id: candidate.id,
          city: displayCityName(candidate.city),
          state: candidate.state,
          score: Math.round(score * 100) / 100,
          explanation:
            locatedParticipants.length === 0
              ? "No participant location data is available yet, so this is a general location suggestion."
              : `This location has the lowest weighted travel-distance score across ${locatedParticipants.length} participant${locatedParticipants.length === 1 ? "" : "s"}${olderParticipantCount ? `, with a small priority applied to ${olderParticipantCount} older participant${olderParticipantCount === 1 ? "" : "s"}` : ""}.`,
        };
      })
      .sort((left, right) => left.score - right.score)
      .slice(0, 3);
    const unavailableDates = new Set(
      participants
        .map((participant) => participant.unavailable)
        .map((date) => dateValueToString(date))
        .filter((date) => date && date.startsWith(month)),
    );
    const dateSuggestions = dateStringsForMonth(month)
      .filter((date) => !unavailableDates.has(date))
      .slice(0, 3)
      .map((date) => ({
        date,
        explanation:
          unavailableDates.size === 0
            ? `This date is within the selected month and no participant has marked it as unavailable.`
            : `This date is within the selected month and does not overlap any of the ${unavailableDates.size} unavailable date${unavailableDates.size === 1 ? "" : "s"} provided by participants.`,
      }));
    res.json({locations: locationSuggestions, dates: dateSuggestions});
  } catch (error) {
    next(error);
  }
}

async function updateEventSchedule(req, res, next) {
  const eventId = parseUserId(req.params.eventId);
  const userId = parseUserId(req.body.userId);
  const eventDate =
    typeof req.body.eventDate === "string" ? req.body.eventDate : "";
  const locationId = parseUserId(req.body.locationId);
  if (
    !eventId ||
    !userId ||
    !/^\d{4}-\d{2}-\d{2}$/.test(eventDate) ||
    !locationId
  ) {
    res.status(400).json({error: "A valid date and location are required."});
    return;
  }

  try {
    if (!(await getHostEvent(eventId, userId))) {
      res
        .status(403)
        .json({error: "Only the event host can update this event."});
      return;
    }
    const [conflicts] = await pool.execute(
      `SELECT 1
       FROM event_participants ep
       JOIN users u ON u.id = ep.user_id
       WHERE ep.event_id = ? AND u.UNAVAILABLE = ?
       LIMIT 1`,
      [eventId, eventDate],
    );
    if (conflicts.length) {
      res
        .status(409)
        .json({error: "That date overlaps an attendee's unavailable date."});
      return;
    }
    const [locations] = await pool.execute(
      "SELECT CITY AS city, STATE AS state FROM location WHERE id = ? LIMIT 1",
      [locationId],
    );
    if (!locations[0]) {
      res.status(400).json({error: "That location does not exist."});
      return;
    }
    const location = `${displayCityName(locations[0].city)}, ${locations[0].state}`;
    await pool.execute(
      "UPDATE events SET EVENTDATE = ?, LOCATION = ? WHERE id = ?",
      [eventDate, location, eventId],
    );
    res.json({message: "Event schedule updated.", eventDate, location});
  } catch (error) {
    next(error);
  }
}

async function listEvents(req, res, next) {
  const userId = parseUserId(req.query.userId);
  if (!userId) {
    res.status(400).json({error: "A valid user ID is required."});
    return;
  }

  try {
    const [events] = await pool.execute(
      `SELECT e.id, e.TITLE AS title, e.EVENTDATE AS eventDate,
              e.EVENTTIME AS eventTime, e.LOCATION AS location,
              e.ENROLLMENTCODE AS enrollmentCode,
              host_user.FIRSTNAME AS hostFirstName,
              host_user.LASTNAME AS hostLastName,
              COUNT(attendee_participant.user_id) AS attendeeCount,
              GROUP_CONCAT(
                DISTINCT CONCAT(participant_user.FIRSTNAME, ' ', participant_user.LASTNAME)
                ORDER BY participant_user.FIRSTNAME, participant_user.LASTNAME SEPARATOR ', '
              ) AS attendees,
              MAX(current_participant.role_id = host_role.id) AS userIsHost
       FROM events e
       JOIN users host_user ON host_user.id = e.HOST
       LEFT JOIN roles host_role ON host_role.name = 'host'
       LEFT JOIN roles attendee_role ON attendee_role.name = 'attendee'
       LEFT JOIN event_participants attendee_participant
         ON attendee_participant.event_id = e.id
        AND attendee_participant.role_id = attendee_role.id
       LEFT JOIN users participant_user
         ON participant_user.id = attendee_participant.user_id
       LEFT JOIN event_participants current_participant
         ON current_participant.event_id = e.id
        AND current_participant.user_id = ?
       WHERE current_participant.user_id IS NOT NULL OR e.HOST = ?
       GROUP BY e.id, host_user.FIRSTNAME, host_user.LASTNAME`,
      [userId, userId],
    );
    res.json(events);
  } catch (error) {
    next(error);
  }
}

async function createEvent(req, res, next) {
  const userId = parseUserId(req.body.userId);
  const validationError = validateEventInput(req.body);
  if (!userId || validationError) {
    res.status(400).json({
      error: validationError || "A valid user ID is required.",
    });
    return;
  }

  try {
    const enrollmentCode = createEnrollmentCode();
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.execute(
        `INSERT INTO events (TITLE, EVENTDATE, EVENTTIME, LOCATION, ENROLLMENTCODE, HOST)
         VALUES (?, NULL, NULL, NULL, ?, ?)`,
        [req.body.title.trim(), enrollmentCode, userId],
      );
      const [hostRole] = await connection.execute(
        "SELECT id FROM roles WHERE name = 'host' LIMIT 1",
      );
      await connection.execute(
        "INSERT INTO event_participants (event_id, user_id, role_id) VALUES (?, ?, ?)",
        [result.insertId, userId, hostRole[0].id],
      );
      await connection.commit();
      res.status(201).json({
        id: result.insertId,
        enrollmentCode,
        message: "Event created.",
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    next(error);
  }
}

async function enrollInEvent(req, res, next) {
  const userId = parseUserId(req.body.userId);
  const code =
    typeof req.body.enrollmentCode === "string"
      ? req.body.enrollmentCode.trim().toUpperCase()
      : "";
  if (!userId || !code) {
    res
      .status(400)
      .json({error: "A user ID and enrollment code are required."});
    return;
  }

  try {
    const [events] = await pool.execute(
      "SELECT id FROM events WHERE ENROLLMENTCODE = ? LIMIT 1",
      [code],
    );
    if (!events[0]) {
      res.status(404).json({error: "That enrollment code could not be found."});
      return;
    }
    const [attendeeRole] = await pool.execute(
      "SELECT id FROM roles WHERE name = 'attendee' LIMIT 1",
    );
    await pool.execute(
      "INSERT INTO event_participants (event_id, user_id, role_id) VALUES (?, ?, ?)",
      [events[0].id, userId, attendeeRole[0].id],
    );
    res.status(201).json({message: "You are enrolled in the event."});
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      res.status(409).json({error: "You are already enrolled in this event."});
      return;
    }
    next(error);
  }
}

async function leaveEvent(req, res, next) {
  const userId = parseUserId(req.body.userId);
  const eventId = parseUserId(req.params.eventId);
  if (!userId || !eventId) {
    res.status(400).json({error: "A valid user ID and event ID are required."});
    return;
  }

  try {
    const [result] = await pool.execute(
      `DELETE ep FROM event_participants ep
       JOIN roles r ON r.id = ep.role_id
       WHERE ep.event_id = ? AND ep.user_id = ? AND r.name = 'attendee'`,
      [eventId, userId],
    );
    if (!result.affectedRows) {
      res.status(404).json({error: "You are not enrolled in this event."});
      return;
    }
    res.json({message: "You left the event."});
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createEvent,
  enrollInEvent,
  getEventSuggestions,
  leaveEvent,
  listEvents,
  updateEventSchedule,
};
