const DATA_PATH = "data/training-plans.json";
const DEFAULT_ROW_COUNT = 5;

let deferredInstallPrompt = null;

const pageTitle = document.getElementById("pageTitle");
const subtitle = document.getElementById("subtitle");
const app = document.getElementById("app");
const shareBtn = document.getElementById("shareBtn");
const copyBtn = document.getElementById("copyBtn");
const installAppBtn = document.getElementById("installAppBtn");

init();

async function init() {
  wireGlobalActions();
  registerServiceWorker();
  enableInstallPrompt();

  try {
    const response = await fetch(DATA_PATH, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Could not load plan data (${response.status})`);
    }

    const data = await response.json();
    const clientId = new URL(window.location.href).searchParams.get("client");

    if (!Array.isArray(data.clients) || data.clients.length === 0) {
      renderError("No clients found in training-plan data.");
      return;
    }

    if (!clientId) {
      renderClientDirectory(data);
      return;
    }

    const plan = data.clients.find((client) => client.id === clientId);
    if (!plan) {
      renderClientNotFound(data, clientId);
      return;
    }

    renderPlan(data, plan);
  } catch (error) {
    renderError(error.message || "Could not load the training plan.");
  }
}

function wireGlobalActions() {
  shareBtn.addEventListener("click", async () => {
    const shareData = {
      title: document.title,
      text: "Open your updated training plan.",
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (_) {
        // User canceled share UI.
      }
      return;
    }

    await copyUrl();
  });

  copyBtn.addEventListener("click", copyUrl);

  installAppBtn.addEventListener("click", async () => {
    if (!deferredInstallPrompt) {
      return;
    }

    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installAppBtn.hidden = true;
  });
}

async function copyUrl() {
  try {
    await navigator.clipboard.writeText(window.location.href);
    copyBtn.textContent = "Link Copied";
    window.setTimeout(() => {
      copyBtn.textContent = "Copy Link";
    }, 1500);
  } catch (_) {
    copyBtn.textContent = "Copy Failed";
    window.setTimeout(() => {
      copyBtn.textContent = "Copy Link";
    }, 1500);
  }
}

function enableInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    installAppBtn.hidden = false;
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || window.location.protocol === "file:") {
    return;
  }

  navigator.serviceWorker.register("sw.js").catch(() => {
    // Ignore service worker registration errors.
  });
}

function renderClientDirectory(data) {
  pageTitle.textContent = `${safeValue(data.programTitle, "Training Plan Portal")}`;
  subtitle.textContent = "Choose a client/student link below, or send a direct client link.";

  const cards = data.clients
    .map((client) => {
      const url = buildClientUrl(client.id);
      return `
        <a class="client-link" href="${url}">
          <p class="client-name">${escapeHtml(safeValue(client.profile?.clientName, client.id))}</p>
          <p class="client-role">${escapeHtml(safeValue(client.profile?.primaryGoal, "Training plan"))}</p>
          <p class="note">Open: ${escapeHtml(url)}</p>
        </a>
      `;
    })
    .join("");

  app.innerHTML = `
    <section class="panel">
      <h2 class="section-title">Client Links</h2>
      <p class="section-subtitle">Each card opens a mobile-friendly training plan.</p>
      <div class="client-grid">${cards}</div>
    </section>
    ${renderDataUpdatePanel(data)}
  `;
}

function renderClientNotFound(data, clientId) {
  pageTitle.textContent = "Client Link Not Found";
  subtitle.textContent = "This link does not match any current plan.";

  app.innerHTML = `
    <section class="panel">
      <h2 class="section-title">No matching client ID</h2>
      <p class="section-subtitle">Requested ID: <code>${escapeHtml(clientId)}</code></p>
      <p class="note">Use one of the links below instead.</p>
      <div class="client-grid">
        ${data.clients
          .map((client) => {
            const url = buildClientUrl(client.id);
            return `<a class="client-link" href="${url}">${escapeHtml(safeValue(client.profile?.clientName, client.id))}</a>`;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderPlan(data, plan) {
  const profile = plan.profile || {};
  const weeks = Array.isArray(plan.weeks) ? plan.weeks : [];

  pageTitle.textContent = `${safeValue(profile.clientName, "Training Plan")}`;
  subtitle.textContent = `${safeValue(profile.programStartDate, "Start date not set")} to ${safeValue(profile.programEndDate, "End date not set")}`;

  const overviewCards = [
    ["Client Name", safeValue(profile.clientName)],
    ["Trainer Name", safeValue(profile.trainerName)],
    ["Program Start", safeValue(profile.programStartDate)],
    ["Program End", safeValue(profile.programEndDate)],
    ["Primary Goal", safeValue(profile.primaryGoal)],
    ["Coached Session Day", safeValue(profile.weeklyCoachedSessionDay)],
    ["Independent Day 1", safeValue(profile.independentSessionDays?.[0])],
    ["Independent Day 2", safeValue(profile.independentSessionDays?.[1])],
  ]
    .map(
      ([label, value]) => `
      <article class="info-card">
        <p class="info-label">${escapeHtml(label)}</p>
        <p class="info-value">${escapeHtml(value)}</p>
      </article>
    `
    )
    .join("");

  const glanceRows = (plan.programAtAGlance || [])
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(safeValue(item.phase))}</td>
        <td>${escapeHtml(safeValue(item.weeks))}</td>
        <td>${escapeHtml(safeValue(item.focus))}</td>
        <td>${escapeHtml(safeValue(item.loadIntensity))}</td>
        <td>${escapeHtml(safeValue(item.notice))}</td>
      </tr>
    `
    )
    .join("");

  const goals = plan.goals || {};
  const effortScale = Array.isArray(data.effortScale) ? data.effortScale : [];

  app.innerHTML = `
    <section class="panel">
      <h2 class="section-title">A. Profile and Program Overview</h2>
      <p class="section-subtitle">Based on your existing plan template.</p>
      <div class="info-grid">${overviewCards}</div>
    </section>

    <section class="panel">
      <h2 class="section-title">7-Week Program at a Glance</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Phase</th>
              <th>Weeks</th>
              <th>Focus</th>
              <th>Load / Intensity</th>
              <th>What You Will Notice</th>
            </tr>
          </thead>
          <tbody>
            ${glanceRows || `<tr><td colspan="5" class="empty">No phase summary added yet.</td></tr>`}
          </tbody>
        </table>
      </div>

      <h3 class="section-title" style="margin-top: 0.85rem;">Your Goals</h3>
      <ul class="inline-list">
        <li><strong>Primary Goal:</strong> ${escapeHtml(safeValue(goals.primaryGoalInOwnWords))}</li>
        <li><strong>Success After 7 Weeks:</strong> ${escapeHtml(safeValue(goals.successAfter7Weeks))}</li>
        <li><strong>Focus Skill:</strong> ${escapeHtml(safeValue(goals.oneThingToImprove))}</li>
      </ul>

      <h3 class="section-title" style="margin-top: 0.85rem;">Effort Scale (1-10)</h3>
      <div class="chips">
        ${effortScale
          .map(
            (band) =>
              `<span class="chip">${escapeHtml(safeValue(band.range))}: ${escapeHtml(safeValue(band.description))}</span>`
          )
          .join("")}
      </div>
    </section>

    <section class="panel">
      <h2 class="section-title">B. Weekly Training Sessions</h2>
      <p class="section-subtitle">1 coached + 2 independent sessions each week.</p>
      ${weeks.map((week, index) => renderWeek(week, index === 0)).join("")}
    </section>

    <section class="panel">
      <h2 class="section-title">C. Final Assessment</h2>
      ${renderFinalAssessment(plan.finalAssessment)}
    </section>

    ${renderGuidelinesPanel(data)}
    ${renderDataUpdatePanel(data)}
  `;
}

function renderWeek(week, openByDefault) {
  const sessions = Array.isArray(week.sessions) ? week.sessions : [];
  const checkIn = week.clientCheckIn || {};

  return `
    <details class="week-card" ${openByDefault ? "open" : ""}>
      <summary>
        <div>
          <strong>Week ${escapeHtml(String(safeValue(week.number, "-")))}</strong>
          <p class="week-meta">${escapeHtml(safeValue(week.dateRange))} | ${escapeHtml(safeValue(week.phase))}</p>
        </div>
        <span class="chip">${escapeHtml(safeValue(week.tagline, "Training Week"))}</span>
      </summary>
      <div class="week-body">
        <div class="session-grid">
          ${sessions.map((session) => renderSession(session)).join("")}
        </div>
        <div class="session-card" style="margin-top: 0.65rem;">
          <h4 class="session-heading">Client Check-In</h4>
          <div class="status-row">
            ${renderEnergyBadge(checkIn.energy)}
            ${renderSorenessBadge(checkIn.soreness)}
            <span class="badge ${checkIn.completedSessions >= 3 ? "success" : "warning"}">
              Sessions Completed: ${escapeHtml(String(safeValue(checkIn.completedSessions, 0)))}
            </span>
            <span class="badge ${safeValue(checkIn.nextWeek, "Continue") === "Adjust" ? "warning" : "success"}">
              Next Week: ${escapeHtml(safeValue(checkIn.nextWeek, "Continue"))}
            </span>
          </div>
          <p class="note"><strong>What went well / challenge:</strong> ${escapeHtml(safeValue(checkIn.winsChallenges))}</p>
          <p class="note"><strong>Trainer notes:</strong> ${escapeHtml(safeValue(checkIn.trainerNotes))}</p>
        </div>
      </div>
    </details>
  `;
}

function renderSession(session) {
  const exerciseRows = createExerciseRows(session.exercises);

  return `
    <article class="session-card">
      <h4 class="session-heading">Session ${escapeHtml(String(safeValue(session.number, "-")))}: ${escapeHtml(safeValue(session.title))}</h4>
      <p class="session-meta">
        ${escapeHtml(safeValue(session.date, "Date not set"))} | Focus: ${escapeHtml(safeValue(session.focus, "Not set"))}
      </p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Exercise</th>
              <th>Equipment / Setup</th>
              <th>Sets</th>
              <th>Reps</th>
              <th>Effort</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${exerciseRows}
          </tbody>
        </table>
      </div>
    </article>
  `;
}

function createExerciseRows(exercises) {
  const rows = Array.isArray(exercises) ? exercises : [];
  const paddedRows = [];

  for (let i = 0; i < DEFAULT_ROW_COUNT; i += 1) {
    const row = rows[i] || {};
    paddedRows.push(`
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(safeValue(row.exercise))}</td>
        <td>${escapeHtml(safeValue(row.equipment))}</td>
        <td>${escapeHtml(safeValue(row.sets))}</td>
        <td>${escapeHtml(safeValue(row.reps))}</td>
        <td>${escapeHtml(safeValue(row.effort))}</td>
        <td>${escapeHtml(safeValue(row.notes))}</td>
      </tr>
    `);
  }

  return paddedRows.join("");
}

function renderFinalAssessment(finalAssessment) {
  if (!finalAssessment) {
    return `<p class="empty">Final assessment has not been added yet.</p>`;
  }

  const rows = (finalAssessment.items || [])
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(safeValue(item.assessment))}</td>
        <td>${escapeHtml(safeValue(item.startingScore))}</td>
        <td>${escapeHtml(safeValue(item.finalScore))}</td>
        <td>${escapeHtml(safeValue(item.change))}</td>
      </tr>
    `
    )
    .join("");

  return `
    <p class="section-subtitle">Assessment Date: ${escapeHtml(safeValue(finalAssessment.date))}</p>
    <div class="table-wrap" style="margin-top: 0.6rem;">
      <table>
        <thead>
          <tr>
            <th>Assessment</th>
            <th>Starting Score</th>
            <th>Final Score</th>
            <th>Change</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="4" class="empty">No final assessment scores yet.</td></tr>`}
        </tbody>
      </table>
    </div>
    <ul class="inline-list">
      <li><strong>Most proud of:</strong> ${escapeHtml(safeValue(finalAssessment.proudOf))}</li>
      <li><strong>Keep working on:</strong> ${escapeHtml(safeValue(finalAssessment.keepWorkingOn))}</li>
      <li><strong>Trainer summary:</strong> ${escapeHtml(safeValue(finalAssessment.trainerSummary))}</li>
    </ul>
  `;
}

function renderGuidelinesPanel(data) {
  const guidelines = Array.isArray(data.guidelines) ? data.guidelines : [];
  if (guidelines.length === 0) {
    return "";
  }

  return `
    <section class="panel">
      <h2 class="section-title">A Few Things to Keep in Mind</h2>
      <ul class="inline-list">
        ${guidelines.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    </section>
  `;
}

function renderDataUpdatePanel(data) {
  const updatedDate = safeValue(data.lastUpdated, "Not set");
  return `
    <section class="panel">
      <h2 class="section-title">Plan Update Info</h2>
      <p class="section-subtitle">Last data update: ${escapeHtml(updatedDate)}</p>
      <p class="note">To update plans, edit <code>training-plan-webapp/data/training-plans.json</code> and republish this folder.</p>
    </section>
  `;
}

function renderError(message) {
  pageTitle.textContent = "Training Plan Unavailable";
  subtitle.textContent = "There was a problem loading plan data.";
  app.innerHTML = `
    <section class="panel">
      <p class="empty">${escapeHtml(message)}</p>
    </section>
  `;
}

function buildClientUrl(clientId) {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}?client=${encodeURIComponent(clientId)}`;
}

function renderEnergyBadge(energy) {
  const value = safeValue(energy, "OK");
  const variant = value === "Great" ? "success" : value === "Low" ? "warning" : "success";
  return `<span class="badge ${variant}">Energy: ${escapeHtml(value)}</span>`;
}

function renderSorenessBadge(soreness) {
  const value = safeValue(soreness, "Mild");
  const variant = value === "High" ? "danger" : value === "None" ? "success" : "warning";
  return `<span class="badge ${variant}">Soreness: ${escapeHtml(value)}</span>`;
}

function safeValue(value, fallback = "Not added") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  return String(value);
}

function escapeHtml(input) {
  return String(input)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
