const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "reaching_roots",
  waitForConnections: true,
  connectionLimit: 10,
});

function validateUserInput(body) {
  const {
    username,
    password,
    passwordverify,
    firstname,
    lastname,
    birthday,
    location,
  } = body;

  if (
    typeof username !== "string" ||
    typeof password !== "string" ||
    typeof passwordverify !== "string" ||
    typeof firstname !== "string" ||
    typeof lastname !== "string" ||
    typeof birthday !== "string"
  ) {
    return "All required fields must be provided.";
  }

  if (
    !username.trim() ||
    !firstname.trim() ||
    !lastname.trim() ||
    !birthday.trim()
  ) {
    return "All required fields must be provided.";
  }

  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }

  if (password !== passwordverify) {
    return "Passwords must match.";
  }

  if (location !== undefined && location !== null && location !== "") {
    const locationId = Number(location);
    if (!Number.isInteger(locationId) || locationId < 1) {
      return "Location must be a valid location ID.";
    }
  }

  return null;
}

async function createUser(req, res, next) {
  const validationError = validateUserInput(req.body);
  if (validationError) {
    res.status(400).json({error: validationError});
    return;
  }

  const {username, password, firstname, lastname, birthday, location} =
    req.body;

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const locationId =
      location === undefined || location === "" ? null : Number(location);

    const [result] = await pool.execute(
      `INSERT INTO users
        (USERNAME, PASSWORD, PASSWORDVERIFY, FIRSTNAME, LASTNAME, BIRTHDAY, LOCATION)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        username.trim(),
        passwordHash,
        passwordHash,
        firstname.trim(),
        lastname.trim(),
        birthday,
        locationId,
      ],
    );

    res.status(201).json({id: result.insertId, message: "Account created."});
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      res.status(409).json({error: "That username is already in use."});
      return;
    }

    if (error.code === "ER_NO_REFERENCED_ROW_2") {
      res.status(400).json({error: "That location does not exist."});
      return;
    }

    next(error);
  }
}

async function listLocations(req, res, next) {
  try {
    const [locations] = await pool.query(
      "SELECT id, CITY, STATE FROM location ORDER BY STATE, CITY",
    );
    res.json(locations);
  } catch (error) {
    next(error);
  }
}

function parseUserId(value) {
  const userId = Number(value);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return date.toISOString().slice(0, 10) === value;
}

async function getAvailability(req, res, next) {
  const userId = parseUserId(req.params.userId);
  if (!userId) {
    res.status(400).json({error: "A valid user ID is required."});
    return;
  }

  try {
    const [users] = await pool.execute(
      "SELECT id FROM users WHERE id = ? LIMIT 1",
      [userId],
    );
    if (!users[0]) {
      res.status(404).json({error: "That user does not exist."});
      return;
    }
    const [dates] = await pool.execute(
      "SELECT id, unavailable_date AS unavailable FROM user_unavailability WHERE user_id = ? ORDER BY unavailable_date",
      [userId],
    );
    res.json({unavailable: dates});
  } catch (error) {
    next(error);
  }
}

async function getUserProfile(req, res, next) {
  const userId = parseUserId(req.params.userId);
  if (!userId) {
    res.status(400).json({error: "A valid user ID is required."});
    return;
  }

  try {
    const [users] = await pool.execute(
      "SELECT FIRSTNAME AS firstName, LASTNAME AS lastName FROM users WHERE id = ? LIMIT 1",
      [userId],
    );
    if (!users[0]) {
      res.status(404).json({error: "That user does not exist."});
      return;
    }
    res.json(users[0]);
  } catch (error) {
    next(error);
  }
}

async function updateAvailability(req, res, next) {
  const userId = parseUserId(req.params.userId);
  const unavailable = req.body.unavailable;
  if (
    !userId ||
    !Array.isArray(unavailable) ||
    unavailable.some(
      (date) => typeof date !== "string" || !isValidDate(date),
    ) ||
    new Set(unavailable).size !== unavailable.length
  ) {
    res
      .status(400)
      .json({error: "Unavailable must be a list of unique valid dates."});
    return;
  }

  try {
    const [users] = await pool.execute(
      "SELECT id FROM users WHERE id = ? LIMIT 1",
      [userId],
    );
    if (!users[0]) {
      res.status(404).json({error: "That user does not exist."});
      return;
    }
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(
        "DELETE FROM user_unavailability WHERE user_id = ?",
        [userId],
      );
      for (const date of unavailable) {
        await connection.execute(
          "INSERT INTO user_unavailability (user_id, unavailable_date) VALUES (?, ?)",
          [userId, date],
        );
      }
      await connection.commit();
      res.json({unavailable, message: "Availability updated."});
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

module.exports = {
  createUser,
  getAvailability,
  getUserProfile,
  listLocations,
  pool,
  updateAvailability,
};
