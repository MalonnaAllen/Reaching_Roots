require("dotenv").config();

const express = require("express");
const path = require("path");
const {
  createUser,
  getAvailability,
  getUserProfile,
  listLocations,
  updateAvailability,
} = require("./middleware");
const {
  createEvent,
  enrollInEvent,
  getEventSuggestions,
  leaveEvent,
  listEvents,
  updateEventSchedule,
} = require("./events");
const routes = require("./routes");

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.use(routes);
app.get("/api/locations", listLocations);
app.post("/api/users", createUser);
app.get("/api/users/:userId/availability", getAvailability);
app.patch("/api/users/:userId/availability", updateAvailability);
app.get("/api/users/:userId/profile", getUserProfile);
app.get("/api/events", listEvents);
app.post("/api/events", createEvent);
app.post("/api/events/enroll", enrollInEvent);
app.delete("/api/events/:eventId/participants", leaveEvent);
app.get("/api/events/:eventId/suggestions", getEventSuggestions);
app.patch("/api/events/:eventId/schedule", updateEventSchedule);

app.use((error, req, res, next) => {
  console.error(error);
  const message =
    req.path === "/api/locations"
      ? "Unable to load cities. Check the database connection."
      : req.path === "/api/login"
        ? "Unable to log in right now."
        : req.path.startsWith("/api/events")
          ? "Unable to update events right now."
          : "Unable to create the account right now.";
  res.status(500).json({error: message});
});

app.listen(port, () => {
  console.log(`Reaching Roots is running at http://localhost:${port}`);
});
