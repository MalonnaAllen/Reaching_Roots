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
    status = "attendee",
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

  if (!["host", "attendee"].includes(status)) {
    return "Status must be host or attendee.";
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

  const {
    username,
    password,
    firstname,
    lastname,
    birthday,
    location,
    status = "attendee",
  } = req.body;

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const locationId =
      location === undefined || location === "" ? null : Number(location);

    const [result] = await pool.execute(
      `INSERT INTO users
        (USERNAME, PASSWORD, PASSWORDVERIFY, FIRSTNAME, LASTNAME, BIRTHDAY, LOCATION, STATUS)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        username.trim(),
        passwordHash,
        passwordHash,
        firstname.trim(),
        lastname.trim(),
        birthday,
        locationId,
        status,
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

module.exports = {createUser, listLocations, pool};
