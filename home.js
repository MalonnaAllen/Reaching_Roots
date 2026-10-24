const profileMenuButton = document.querySelector("#profile-menu-button");
const profileMenu = document.querySelector("#profile-menu");
const profileDialog = document.querySelector("#profile-dialog");
const enrollDialog = document.querySelector("#enroll-dialog");
const createDialog = document.querySelector("#create-dialog");
const roleBadge = document.querySelector("#role-badge");
const createButton = document.querySelector("#create-button");
const eventList = document.querySelector("#event-list");
const eventCount = document.querySelector("#event-count");
const emptyState = document.querySelector("#empty-state");
const profileName = document.querySelector("#profile-name");
const dashboardHeading = document.querySelector("#dashboard-heading");

const events = [
  {
    id: "1",
    date: "18",
    month: "JUN",
    type: "Community garden",
    title: "Summer planting day",
    details: "Saturday, June 18 · 10:00 AM",
    location: "Maple Street Community Garden",
    host: "Green Neighbors",
    code: "ROOT-4821",
    enrolled: true,
  },
  {
    id: "2",
    date: "24",
    month: "JUN",
    type: "Neighborhood meetup",
    title: "Porch conversation",
    details: "Friday, June 24 · 6:30 PM",
    location: "Oakwood Library courtyard",
    host: "Oakwood Neighbors",
    code: "ROOT-6394",
    enrolled: true,
  },
];

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

function updateRole(role) {
  const isHost = role === "host";
  roleBadge.textContent = isHost ? "Host" : "Attendee";
  createButton.classList.toggle("is-hidden", !isHost);
}

function renderEvents() {
  const enrolledEvents = events.filter((event) => event.enrolled);
  const count = enrolledEvents.length;
  eventCount.textContent = `${count} event${count === 1 ? "" : "s"}`;
  emptyState.classList.toggle("is-hidden", count !== 0);
  eventList.classList.toggle("is-hidden", count === 0);
  eventList.replaceChildren(
    ...enrolledEvents.map((event) => {
      const card = document.createElement("article");
      card.className = "event-card";
      card.innerHTML = `
        <div class="event-date"><strong>${escapeHtml(event.date)}</strong><span>${escapeHtml(event.month)}</span></div>
        <div class="event-details">
          <span class="event-type">${escapeHtml(event.type)}</span>
          <h3>${escapeHtml(event.title)}</h3>
          <p>${escapeHtml(event.details)}</p>
          <p>${escapeHtml(event.location)}</p>
          <span class="host-line">Hosted by ${escapeHtml(event.host)}</span>
        </div>
        <button class="text-button" type="button" data-remove-event="${escapeHtml(event.id)}">
          Leave event
        </button>
      `;
      return card;
    }),
  );
}

profileMenuButton.addEventListener("click", () => {
  profileMenu.hidden = !profileMenu.hidden;
  profileMenuButton.setAttribute("aria-expanded", String(!profileMenu.hidden));
});

document.querySelector("#edit-profile-button").addEventListener("click", () => {
  profileMenu.hidden = true;
  profileMenuButton.setAttribute("aria-expanded", "false");
  openDialog(profileDialog);
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".site-nav")) {
    profileMenu.hidden = true;
    profileMenuButton.setAttribute("aria-expanded", "false");
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    profileMenu.hidden = true;
    profileMenuButton.setAttribute("aria-expanded", "false");
  }
});

document.querySelector("#enroll-button").addEventListener("click", () => {
  document.querySelector("#enroll-status").textContent = "";
  openDialog(enrollDialog);
});

createButton.addEventListener("click", () => {
  document.querySelector("#create-status").textContent = "";
  openDialog(createDialog);
});

document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => button.closest("dialog").close());
});

document.querySelector("#enroll-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const code = new FormData(event.currentTarget).get("code").toString().trim();
  const joinedEvent = events.find(
    (item) => item.code === code.toUpperCase(),
  );
  if (!joinedEvent) {
    document.querySelector("#enroll-status").textContent =
      "That enrollment code could not be found.";
    return;
  }

  if (joinedEvent.enrolled) {
    document.querySelector("#enroll-status").textContent =
      "You’re already enrolled in this event.";
    return;
  }

  joinedEvent.enrolled = true;
  renderEvents();
  event.currentTarget.reset();
  enrollDialog.close();
});

document.querySelector("#create-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const title = formData.get("title");
  const date = new Date(`${formData.get("date")}T${formData.get("time")}`);
  const dateLabel = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  const enrollmentCode = `ROOT-${Math.floor(1000 + Math.random() * 9000)}`;
  events.push({
    id: crypto.randomUUID(),
    date: date.getDate().toString().padStart(2, "0"),
    month: dateLabel.split(" ")[0].toUpperCase(),
    type: "Community event",
    title,
    details: `${dateLabel} · ${date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    })}`,
    location: formData.get("location"),
    host: "You",
    code: enrollmentCode,
    enrolled: true,
  });
  renderEvents();
  event.currentTarget.reset();
  document.querySelector("#create-status").textContent =
    `Event created. Enrollment code: ${enrollmentCode}`;
});

document.querySelector("#profile-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const firstName = formData.get("firstName");
  const role = formData.get("role");
  profileName.textContent = firstName;
  dashboardHeading.textContent = `Good morning, ${firstName}.`;
  updateRole(role);
  document.querySelector("#profile-status").textContent = "Profile updated.";
});

eventList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-event]");
  if (!button) return;
  const index = events.findIndex((item) => item.id === button.dataset.removeEvent);
  if (index !== -1) events[index].enrolled = false;
  renderEvents();
});

updateRole("attendee");
renderEvents();
