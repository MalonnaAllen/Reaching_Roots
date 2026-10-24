const loginTab = document.querySelector("#login-tab");
const signupTab = document.querySelector("#signup-tab");
const loginForm = document.querySelector("#login-form");
const signupForm = document.querySelector("#signup-form");
const heading = document.querySelector("#form-heading");
const description = document.querySelector("#form-description");
const status = document.querySelector("#form-status");
const stateSelect = document.querySelector("#state");
const locationSelect = document.querySelector("#location");
let locations = [];

async function readJsonResponse(response, fallbackMessage) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error(
      "This page is not being served by the app. Start it with `npm start`, then open http://localhost:3000.",
    );
  }

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || fallbackMessage);
  }
  return result;
}

async function loadLocations() {
  try {
    const response = await fetch("/api/locations");
    locations = await readJsonResponse(response, "Unable to load cities.");

    const states = [...new Set(locations.map((location) => location.STATE))];
    stateSelect.replaceChildren(new Option("Select a state", ""));
    states.forEach((state) => {
      const option = document.createElement("option");
      option.value = state;
      option.textContent = state;
      stateSelect.append(option);
    });
    stateSelect.disabled = false;
  } catch (error) {
    stateSelect.replaceChildren(
      new Option("States unavailable - check the app server", ""),
    );
    locationSelect.replaceChildren(
      new Option("Cities unavailable - check the app server", ""),
    );
    status.textContent = error.message;
  }
}

function displayCityName(city) {
  return city.replace(/\s+(city|town|village)$/, "");
}

function updateCities() {
  const selectedState = stateSelect.value;
  const stateLocations = locations.filter(
    (location) => location.STATE === selectedState,
  );

  locationSelect.replaceChildren(new Option("Select a city", ""));
  stateLocations.forEach((location) => {
    const option = document.createElement("option");
    option.value = location.id;
    option.textContent = displayCityName(location.CITY);
    locationSelect.append(option);
  });
  locationSelect.disabled = !selectedState;
}

function setMode(mode) {
  const isLogin = mode === "login";
  loginTab.classList.toggle("is-active", isLogin);
  signupTab.classList.toggle("is-active", !isLogin);
  loginTab.setAttribute("aria-selected", isLogin);
  signupTab.setAttribute("aria-selected", !isLogin);
  loginForm.classList.toggle("is-hidden", !isLogin);
  signupForm.classList.toggle("is-hidden", isLogin);
  heading.textContent = isLogin
    ? "Log in to your account"
    : "Create your account";
  description.textContent = isLogin
    ? "Enter your details to continue."
    : "Join the Reaching Roots community today.";
  status.textContent = "";
  (isLogin ? loginForm : signupForm).querySelector("input").focus();
}

loginTab.addEventListener("click", () => setMode("login"));
signupTab.addEventListener("click", () => setMode("signup"));
stateSelect.addEventListener("change", updateCities);

signupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!signupForm.checkValidity()) {
    signupForm.reportValidity();
    return;
  }

  const password = document.querySelector("#signup-password");
  const confirmation = document.querySelector("#password-verify");
  if (password.value !== confirmation.value) {
    confirmation.setCustomValidity("Passwords must match.");
    confirmation.reportValidity();
    confirmation.setCustomValidity("");
    return;
  }

  const formData = new FormData(signupForm);
  const user = Object.fromEntries(formData.entries());
  status.textContent = "Creating your account...";

  fetch("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  })
    .then((response) =>
      readJsonResponse(response, "Unable to create the account."),
    )
    .then((result) => {
      status.textContent = result.message;
      signupForm.reset();
    })
    .catch((error) => {
      status.textContent = error.message;
    });
});

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!loginForm.checkValidity()) {
    loginForm.reportValidity();
    return;
  }

  status.textContent = "Your login details are ready to be submitted.";
});

loadLocations();
