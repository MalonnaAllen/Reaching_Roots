const profileMenuButton = document.querySelector("#profile-menu-button");
const profileMenu = document.querySelector("#profile-menu");
const profileDialog = document.querySelector("#profile-dialog");
const availabilityDialog = document.querySelector("#availability-dialog");
const enrollDialog = document.querySelector("#enroll-dialog");
const createDialog = document.querySelector("#create-dialog");
const scheduleDialog = document.querySelector("#schedule-dialog");
const scheduleForm = document.querySelector("#schedule-form");
const scheduleSuggestions = document.querySelector("#schedule-suggestions");
const eventList = document.querySelector("#event-list");
const eventCount = document.querySelector("#event-count");
const emptyState = document.querySelector("#empty-state");
const profileName = document.querySelector("#profile-name");
const profileAvatar = document.querySelector("#profile-avatar");
const dashboardHeading = document.querySelector("#dashboard-heading");
const profileUnavailable = document.querySelector("#profile-unavailable");
const availabilityForm = document.querySelector("#availability-form");
const unavailableDateList = document.querySelector("#unavailable-date-list");
const availabilityStatus = document.querySelector("#availability-status");
const userId = window.localStorage.getItem("reachingRootsUserId");
let events = [];
let schedulingEventId = null;
let unavailableDates = [];

function openDialog(dialog) {
  dialog.showModal();
}

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character],
  );
}

async function readJsonResponse(response, fallbackMessage) {
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || fallbackMessage);
  }
  return result;
}

function formatEventDate(event) {
  if (!event.eventDate) {
    return {
      day: "--",
      month: "TBD",
      details: "Date and time will be determined later.",
    };
  }

  const eventDate = String(event.eventDate).slice(0, 10);
  const date = new Date(`${eventDate}T${event.eventTime || "00:00"}`);
  return {
    day: date.getDate().toString().padStart(2, "0"),
    month: date.toLocaleDateString("en-US", {month: "short"}).toUpperCase(),
    details: date.toLocaleDateString("en-US", {
      dateStyle: "full",
      timeStyle: event.eventTime ? "short" : undefined,
    }),
  };
}

function renderEvents() {
  eventCount.textContent = `${events.length} event${events.length === 1 ? "" : "s"}`;
  emptyState.classList.toggle("is-hidden", events.length !== 0);
  eventList.classList.toggle("is-hidden", events.length === 0);
  eventList.replaceChildren(
    ...events.map((event) => {
      const date = formatEventDate(event);
      const host = [event.hostFirstName, event.hostLastName]
        .filter(Boolean)
        .join(" ");
      const card = document.createElement("article");
      card.className = "event-card";
      card.innerHTML = `
        <div class="event-date"><strong>${escapeHtml(date.day)}</strong><span>${escapeHtml(date.month)}</span></div>
        <div class="event-details">
          <span class="event-type">${event.userIsHost ? "Hosted event" : "Community event"}</span>
          <h3>${escapeHtml(event.title)}</h3>
          <p>${escapeHtml(date.details)}</p>
          <p>${escapeHtml(event.location || "Location will be determined later.")}</p>
          <div class="event-meta">
            <span class="host-line">Hosted by ${escapeHtml(host || "Reaching Roots member")}</span>
            <span class="host-line">Attendees enrolled: ${escapeHtml(event.attendees || "None yet")}</span>
          </div>
          ${
            event.userIsHost
              ? `<div class="event-meta">
                   <span class="host-line">Enrollment code: ${escapeHtml(event.enrollmentCode)}</span>
                 </div>`
              : ""
          }
        </div>
        ${
          event.userIsHost
            ? `<button class="event-action-button" type="button" data-schedule-event="${escapeHtml(event.id)}">Set date and location</button>`
            : `<button class="text-button" type="button" data-remove-event="${escapeHtml(event.id)}">Leave event</button>`
        }
      `;
      return card;
    }),
  );
}

function renderSuggestions(suggestions) {
  scheduleSuggestions.innerHTML = `
    <p class="eyebrow">Suggested dates</p>
    <div class="suggestion-list">
      ${
        suggestions.dates
          .map(
            (date) =>
              `<label>
                <input type="radio" name="eventDate" value="${escapeHtml(date.date)}" required />
                <span>
                  <strong>${escapeHtml(date.date)}</strong>
                  <small>${escapeHtml(date.explanation)}</small>
                </span>
              </label>`,
          )
          .join("") || "<p>No available dates were found in this month.</p>"
      }
    </div>
    <p class="eyebrow">Suggested locations</p>
    <div class="suggestion-list">
      ${
        suggestions.locations
          .map(
            (location) =>
              `<label>
                <input type="radio" name="locationId" value="${escapeHtml(location.id)}" required />
                <span>
                  <strong>${escapeHtml(location.city)}, ${escapeHtml(location.state)}</strong>
                  <small>${escapeHtml(location.explanation)}</small>
                </span>
              </label>`,
          )
          .join("") || "<p>No participant locations are available yet.</p>"
      }
    </div>
  `;
}

async function loadSuggestions() {
  const month = document.querySelector("#schedule-month").value;
  if (!schedulingEventId || !month) return;
  scheduleSuggestions.replaceChildren();
  try {
    const suggestions = await fetch(
      `/api/events/${schedulingEventId}/suggestions?userId=${encodeURIComponent(userId)}&month=${encodeURIComponent(month)}`,
    ).then((response) =>
      readJsonResponse(response, "Unable to calculate suggestions."),
    );
    renderSuggestions(suggestions);
  } catch (error) {
    document.querySelector("#schedule-status").textContent = error.message;
  }
}

async function loadEvents() {
  if (!userId) {
    document.querySelector("#enroll-status").textContent =
      "Log in before viewing or joining events.";
    return;
  }

  try {
    events = await fetch(
      `/api/events?userId=${encodeURIComponent(userId)}`,
    ).then((response) => readJsonResponse(response, "Unable to load events."));
    renderEvents();
  } catch (error) {
    emptyState.textContent = error.message;
    emptyState.classList.remove("is-hidden");
  }
}

async function loadUserProfile() {
  if (!userId) return;
  try {
    const profile = await fetch(
      `/api/users/${encodeURIComponent(userId)}/profile`,
    ).then((response) =>
      readJsonResponse(response, "Unable to load your profile."),
    );
    const fullName = `${profile.firstName} ${profile.lastName}`.trim();
    profileName.textContent = fullName;
    profileAvatar.textContent =
      `${profile.firstName[0] || ""}${profile.lastName[0] || ""}`.toUpperCase();
    dashboardHeading.textContent = `Good morning, ${profile.firstName}.`;
    document.querySelector("#profile-first-name").value = profile.firstName;
    document.querySelector("#profile-last-name").value = profile.lastName;
  } catch (error) {
    document.querySelector("#profile-status").textContent = error.message;
  }
}

function renderUnavailableDates() {
  unavailableDateList.replaceChildren(
    ...unavailableDates.map((date) => {
      const item = document.createElement("div");
      item.className = "unavailable-date-item";
      item.innerHTML = `
        <span>${escapeHtml(date)}</span>
        <button type="button" class="text-button" data-remove-unavailable="${escapeHtml(date)}">Remove</button>
      `;
      return item;
    }),
  );
}

async function loadAvailability() {
  if (!userId) return;
  try {
    const result = await fetch(
      `/api/users/${encodeURIComponent(userId)}/availability`,
    ).then((response) =>
      readJsonResponse(response, "Unable to load availability."),
    );
    unavailableDates = result.unavailable.map((entry) =>
      String(entry.unavailable).slice(0, 10),
    );
    renderUnavailableDates();
  } catch (error) {
    availabilityStatus.textContent = error.message;
  }
}

profileMenuButton.addEventListener("click", () => {
  profileMenu.hidden = !profileMenu.hidden;
  profileMenuButton.setAttribute("aria-expanded", String(!profileMenu.hidden));
});

document.querySelector("#edit-profile-button").addEventListener("click", () => {
  profileMenu.hidden = true;
  profileMenuButton.setAttribute("aria-expanded", "false");
  document.querySelector("#profile-status").textContent = "";
  openDialog(profileDialog);
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".site-nav")) {
    profileMenu.hidden = true;
    profileMenuButton.setAttribute("aria-expanded", "false");
  }
});

document.querySelector("#enroll-button").addEventListener("click", () => {
  document.querySelector("#enroll-status").textContent = "";
  openDialog(enrollDialog);
});

document.querySelector("#create-button").addEventListener("click", () => {
  document.querySelector("#create-status").textContent = "";
  openDialog(createDialog);
});

document.querySelector("#availability-button").addEventListener("click", () => {
  availabilityStatus.textContent = "";
  loadAvailability();
  openDialog(availabilityDialog);
});

document
  .querySelector("#add-unavailable-button")
  .addEventListener("click", () => {
    const date = profileUnavailable.value;
    if (!date) return;
    if (!unavailableDates.includes(date)) {
      unavailableDates.push(date);
      unavailableDates.sort();
      renderUnavailableDates();
    }
    profileUnavailable.value = "";
  });

unavailableDateList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-unavailable]");
  if (!button) return;
  unavailableDates = unavailableDates.filter(
    (date) => date !== button.dataset.removeUnavailable,
  );
  renderUnavailableDates();
});

document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => button.closest("dialog").close());
});

document
  .querySelector("#enroll-form")
  .addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const code = new FormData(form).get("code").toString().trim();
    try {
      await fetch("/api/events/enroll", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({userId, enrollmentCode: code}),
      }).then((response) =>
        readJsonResponse(response, "Unable to enroll in the event."),
      );
      form.reset();
      enrollDialog.close();
      await loadEvents();
    } catch (error) {
      document.querySelector("#enroll-status").textContent = error.message;
    }
  });

document
  .querySelector("#create-form")
  .addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const title = new FormData(form).get("title");
    try {
      const result = await fetch("/api/events", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({userId, title}),
      }).then((response) =>
        readJsonResponse(response, "Unable to create the event."),
      );
      form.reset();
      document.querySelector("#create-status").textContent =
        `Event created. Enrollment code: ${result.enrollmentCode}`;
      await loadEvents();
    } catch (error) {
      document.querySelector("#create-status").textContent = error.message;
    }
  });

document
  .querySelector("#profile-form")
  .addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const firstName = formData.get("firstName");
    const lastName = formData.get("lastName");
    profileName.textContent = `${firstName} ${lastName}`.trim();
    profileAvatar.textContent =
      `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase();
    dashboardHeading.textContent = `Good morning, ${firstName}.`;
    document.querySelector("#profile-status").textContent = "Profile updated.";
  });

availabilityForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await fetch(`/api/users/${encodeURIComponent(userId)}/availability`, {
      method: "PATCH",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({unavailable: unavailableDates}),
    }).then((response) =>
      readJsonResponse(response, "Unable to update availability."),
    );
    availabilityStatus.textContent = "Unavailable dates updated.";
  } catch (error) {
    availabilityStatus.textContent = error.message;
  }
});

eventList.addEventListener("click", async (event) => {
  const scheduleButton = event.target.closest("[data-schedule-event]");
  if (scheduleButton) {
    schedulingEventId = scheduleButton.dataset.scheduleEvent;
    document.querySelector("#schedule-status").textContent = "";
    scheduleSuggestions.replaceChildren();
    openDialog(scheduleDialog);
    return;
  }
  const button = event.target.closest("[data-remove-event]");
  if (!button) return;
  try {
    await fetch(`/api/events/${button.dataset.removeEvent}/participants`, {
      method: "DELETE",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({userId}),
    }).then((response) =>
      readJsonResponse(response, "Unable to leave the event."),
    );
    await loadEvents();
  } catch (error) {
    document.querySelector("#enroll-status").textContent = error.message;
  }
});

document
  .querySelector("#schedule-month")
  .addEventListener("change", loadSuggestions);

scheduleForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  try {
    await fetch(`/api/events/${schedulingEventId}/schedule`, {
      method: "PATCH",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        userId,
        eventDate: formData.get("eventDate"),
        locationId: formData.get("locationId"),
      }),
    }).then((response) =>
      readJsonResponse(response, "Unable to update the event schedule."),
    );
    scheduleDialog.close();
    await loadEvents();
  } catch (error) {
    document.querySelector("#schedule-status").textContent = error.message;
  }
});

loadUserProfile();
loadEvents();
