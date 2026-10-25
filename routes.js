const express = require("express");
const bcrypt = require("bcryptjs");
const {pool} = require("./middleware");

const router = express.Router();

router.post("/api/login", async (req, res, next) => {
  const {username, password} = req.body;

  if (typeof username !== "string" || typeof password !== "string") {
    res.status(400).json({error: "Username and password are required."});
    return;
  }

  try {
    const [users] = await pool.execute(
      "SELECT id, PASSWORD FROM users WHERE USERNAME = ? LIMIT 1",
      [username.trim()],
    );
    const user = users[0];

    if (!user || !(await bcrypt.compare(password, user.PASSWORD))) {
      res.status(401).json({error: "Invalid username or password."});
      return;
    }

    res.json({redirect: "/home.html", userId: user.id});
  } catch (error) {
    next(error);
  }
});

module.exports = router;
