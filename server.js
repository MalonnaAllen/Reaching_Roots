require("dotenv").config();

const express = require("express");
const path = require("path");
const { createUser, listLocations } = require("./middleware");

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.get("/api/locations", listLocations);
app.post("/api/users", createUser);

app.use((error, req, res, next) => {
  console.error(error);
  const message =
    req.path === "/api/locations"
      ? "Unable to load cities. Check the database connection."
      : "Unable to create the account right now.";
  res.status(500).json({ error: message });
});

app.listen(port, () => {
  console.log(`Reaching Roots is running at http://localhost:${port}`);
});
