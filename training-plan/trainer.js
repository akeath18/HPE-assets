const DATA_PATH = "data/training-plans.json";
const SETTINGS_KEY = "planEditorSettingsV2";

const GITHUB_TARGET = {
  owner: "akeath18",
  repo: "HPE-assets",
  branch: "main",
  path: "training-plan/data/training-plans.json",
};

const EXERCISE_ROWS = 5;
const ASSESSMENT_ROWS = 4;

let dataState = null;
let selectedClientId = null;
let selectedWeekIndex = 0;
let dirty = false;

const clientSelect = document.getElementById("clientSelect");
const addClientBtn = document.getElementById("addClientBtn");
const removeClientBtn = document.getElementById("removeClientBtn");
const shareClientBtn = document.getElementById("shareClientBtn");
const openClientBtn = document.getElementById("openClientBtn");

const nameInput = document.getElementById("nameInput");
const trainerInput = document.getElementById("trainerInput");
const startDateInput = document.getElementById("startDateInput");
const endDateInput = document.getElementById("endDateInput");
const goalInput = document.getElementById("goalInput");
const coachedDayInput = document.getElementById("coachedDayInput");
const indDayOneInput = document.getElementById("indDayOneInput");
const indDayTwoInput = document.getElementById("indDayTwoInput");

const goalOwnWordsInput = document.getElementById("goalOwnWordsInput");
const successInput = document.getElementById("successInput");
const improveInput = document.getElementById("improveInput");

const weekSelect = document.getElementById("weekSelect");
const weekDateRangeInput = document.getElementById("weekDateRangeInput");
const weekPhaseInput = document.getElementById("weekPhaseInput");
const weekTaglineInput = document.getElementById("weekTaglineInput");
const sessionsEditor = document.getElementById("sessionsEditor");

const energyInput = document.getElementById("energyInput");
const sorenessInput = document.getElementById("sorenessInput");
const completedInput = document.getElementById("completedInput");
const nextWeekInput = document.getElementById("nextWeekInput");
const winsInput = document.getElementById("winsInput");
const trainerNotesInput = document.getElementById("trainerNotesInput");

const assessmentDateInput = document.getElementById("assessmentDateInput");
const proudInput = document.getElementById("proudInput");
const keepWorkingInput = document.getElementById("keepWorkingInput");
const summaryInput = document.getElementById("summaryInput");
const assessmentTableBody = document.getElementById("assessmentTableBody");

const tokenInput = document.getElementById("tokenInput");
const rememberTokenInput = document.getElementById("rememberTokenInput");
const downloadBackupBtn = document.getElementById("downloadBackupBtn");
const publishBtn = document.getElementById("publishBtn");

const editorStatus = document.getElementById("editorStatus");
const publishStatus = document.getElementById("publishStatus");

init();

async function init() {
  registerServiceWorker();
  hydrateSettings();
  wireEvents();

  try {
    const response = await fetch(DATA_PATH, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to load plan data (${response.status})`);
    }

    dataState = await response.json();
    ensureDataShape(dataState);

    selectedClientId = dataState.clients[0]?.id || null;
    renderClientOptions();
    loadClientIntoForm();
    renderDirtyState();

    setEditorStatus(`Loaded ${dataState.clients.length} student plans.`, "success");
  } catch (error) {
    setEditorStatus(error.message || "Failed to load plans.", "error");
  }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || window.location.protocol === "file:") {
    return;
  }

  navigator.serviceWorker.register("sw.js").catch(() => {
    // Ignore registration errors.
  });
}

function wireEvents() {
  clientSelect.addEventListener("change", onClientChange);
  weekSelect.addEventListener("change", onWeekChange);

  addClientBtn.addEventListener("click", addClient);
  removeClientBtn.addEventListener("click", removeClient);
  shareClientBtn.addEventListener("click", shareClientLink);
  openClientBtn.addEventListener("click", openClientView);

  const profileBindings = [
    [nameInput, (profile, value) => {
      profile.clientName = value;
      const oldId = getSelectedClient().id;
      const newId = slugify(value || oldId);
      if (newId !== oldId && isUniqueClientId(newId, oldId)) {
        getSelectedClient().id = newId;
        selectedClientId = newId;
        renderClientOptions();
      }
    }],
    [trainerInput, (profile, value) => (profile.trainerName = value)],
    [startDateInput, (profile, value) => (profile.programStartDate = value)],
    [endDateInput, (profile, value) => (profile.programEndDate = value)],
    [goalInput, (profile, value) => (profile.primaryGoal = value)],
    [coachedDayInput, (profile, value) => (profile.weeklyCoachedSessionDay = value)],
    [indDayOneInput, (profile, value) => {
      profile.independentSessionDays[0] = value;
    }],
    [indDayTwoInput, (profile, value) => {
      profile.independentSessionDays[1] = value;
    }],
  ];

  profileBindings.forEach(([input, writer]) => {
    input.addEventListener("input", () => {
      const client = getSelectedClient();
      if (!client) {
        return;
      }

      ensureClientShape(client);
      writer(client.profile, input.value.trim());
      touchData();
    });
  });

  const goalBindings = [
    [goalOwnWordsInput, "primaryGoalInOwnWords"],
    [successInput, "successAfter7Weeks"],
    [improveInput, "oneThingToImprove"],
  ];

  goalBindings.forEach(([input, key]) => {
    input.addEventListener("input", () => {
      const client = getSelectedClient();
      if (!client) {
        return;
      }

      client.goals[key] = input.value.trim();
      touchData();
    });
  });

  const weekBindings = [
    [weekDateRangeInput, "dateRange"],
    [weekPhaseInput, "phase"],
    [weekTaglineInput, "tagline"],
  ];

  weekBindings.forEach(([input, key]) => {
    input.addEventListener("input", () => {
      const week = getSelectedWeek();
      if (!week) {
        return;
      }

      week[key] = input.value.trim();
      touchData();
    });
  });

  const checkInBindings = [
    [energyInput, "energy"],
    [sorenessInput, "soreness"],
    [nextWeekInput, "nextWeek"],
    [winsInput, "winsChallenges"],
    [trainerNotesInput, "trainerNotes"],
  ];

  checkInBindings.forEach(([input, key]) => {
    input.addEventListener("input", () => {
      const week = getSelectedWeek();
      if (!week) {
        return;
      }

      week.clientCheckIn[key] = input.value.trim();
      touchData();
    });
  });

  completedInput.addEventListener("input", () => {
    const week = getSelectedWeek();
    if (!week) {
      return;
    }

    week.clientCheckIn.completedSessions = normalizeCount(completedInput.value);
    touchData();
  });

  sessionsEditor.addEventListener("input", onSessionEditorInput);

  assessmentDateInput.addEventListener("input", () => {
    const finalAssessment = getSelectedClient()?.finalAssessment;
    if (!finalAssessment) {
      return;
    }

    finalAssessment.date = assessmentDateInput.value.trim();
    touchData();
  });

  proudInput.addEventListener("input", () => {
    const finalAssessment = getSelectedClient()?.finalAssessment;
    if (!finalAssessment) {
      return;
    }

    finalAssessment.proudOf = proudInput.value.trim();
    touchData();
  });

  keepWorkingInput.addEventListener("input", () => {
    const finalAssessment = getSelectedClient()?.finalAssessment;
    if (!finalAssessment) {
      return;
    }

    finalAssessment.keepWorkingOn = keepWorkingInput.value.trim();
    touchData();
  });

  summaryInput.addEventListener("input", () => {
    const finalAssessment = getSelectedClient()?.finalAssessment;
    if (!finalAssessment) {
      return;
    }

    finalAssessment.trainerSummary = summaryInput.value.trim();
    touchData();
  });

  assessmentTableBody.addEventListener("input", onAssessmentInput);

  rememberTokenInput.addEventListener("change", persistSettings);
  tokenInput.addEventListener("blur", persistSettings);

  downloadBackupBtn.addEventListener("click", downloadBackup);
  publishBtn.addEventListener("click", publishData);
}

function hydrateSettings() {
  const settings = readSettings();
  rememberTokenInput.checked = Boolean(settings.rememberToken);
  tokenInput.value = settings.rememberToken ? settings.token || "" : "";
}

function persistSettings() {
  const settings = {
    rememberToken: rememberTokenInput.checked,
    token: rememberTokenInput.checked ? tokenInput.value.trim() : "",
  };

  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function readSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return { rememberToken: false, token: "" };
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return { rememberToken: false, token: "" };
    }

    return parsed;
  } catch (_) {
    return { rememberToken: false, token: "" };
  }
}

function ensureDataShape(data) {
  if (!data || typeof data !== "object") {
    dataState = { clients: [] };
  }

  if (!Array.isArray(data.clients)) {
    data.clients = [];
  }

  data.clients.forEach((client) => ensureClientShape(client));
}

function ensureClientShape(client) {
  client.id = slugify(client.id || client.profile?.clientName || "student");

  client.profile = client.profile || {};
  client.profile.clientName = client.profile.clientName || "Student";
  client.profile.trainerName = client.profile.trainerName || "Coach";
  client.profile.programStartDate = client.profile.programStartDate || "";
  client.profile.programEndDate = client.profile.programEndDate || "";
  client.profile.primaryGoal = client.profile.primaryGoal || "";
  client.profile.weeklyCoachedSessionDay = client.profile.weeklyCoachedSessionDay || "";
  client.profile.independentSessionDays = Array.isArray(client.profile.independentSessionDays)
    ? client.profile.independentSessionDays.slice(0, 2)
    : ["", ""];
  while (client.profile.independentSessionDays.length < 2) {
    client.profile.independentSessionDays.push("");
  }

  client.goals = client.goals || {};
  client.goals.primaryGoalInOwnWords = client.goals.primaryGoalInOwnWords || "";
  client.goals.successAfter7Weeks = client.goals.successAfter7Weeks || "";
  client.goals.oneThingToImprove = client.goals.oneThingToImprove || "";

  client.programAtAGlance = Array.isArray(client.programAtAGlance) ? client.programAtAGlance : [];

  client.weeks = Array.isArray(client.weeks) ? client.weeks : [];
  while (client.weeks.length < 7) {
    client.weeks.push(buildWeekTemplate(client.weeks.length + 1));
  }

  client.weeks.forEach((week, index) => ensureWeekShape(week, index + 1));

  client.finalAssessment = client.finalAssessment || {};
  client.finalAssessment.date = client.finalAssessment.date || "";
  client.finalAssessment.items = Array.isArray(client.finalAssessment.items)
    ? client.finalAssessment.items
    : [];
  while (client.finalAssessment.items.length < ASSESSMENT_ROWS) {
    client.finalAssessment.items.push({
      assessment: "",
      startingScore: "",
      finalScore: "",
      change: "",
    });
  }
  client.finalAssessment.items = client.finalAssessment.items.slice(0, ASSESSMENT_ROWS);

  client.finalAssessment.proudOf = client.finalAssessment.proudOf || "";
  client.finalAssessment.keepWorkingOn = client.finalAssessment.keepWorkingOn || "";
  client.finalAssessment.trainerSummary = client.finalAssessment.trainerSummary || "";
}

function ensureWeekShape(week, weekNumber) {
  week.number = Number(week.number) || weekNumber;
  week.dateRange = week.dateRange || "";
  week.phase = week.phase || "Foundation";
  week.tagline = week.tagline || "";

  week.sessions = Array.isArray(week.sessions) ? week.sessions : [];
  while (week.sessions.length < 3) {
    week.sessions.push(buildSessionTemplate(week.sessions.length + 1));
  }
  week.sessions = week.sessions.slice(0, 3);

  week.sessions.forEach((session, index) => {
    session.number = Number(session.number) || index + 1;
    session.title = session.title || (index === 0 ? "With Your Trainer" : "On Your Own");
    session.date = session.date || "";
    session.focus = session.focus || "";
    session.exercises = Array.isArray(session.exercises) ? session.exercises : [];

    while (session.exercises.length < EXERCISE_ROWS) {
      session.exercises.push({
        exercise: "",
        equipment: "",
        sets: "",
        reps: "",
        effort: "",
        notes: "",
      });
    }

    session.exercises = session.exercises.slice(0, EXERCISE_ROWS);
  });

  week.clientCheckIn = week.clientCheckIn || {};
  week.clientCheckIn.energy = week.clientCheckIn.energy || "OK";
  week.clientCheckIn.soreness = week.clientCheckIn.soreness || "Mild";
  week.clientCheckIn.winsChallenges = week.clientCheckIn.winsChallenges || "";
  week.clientCheckIn.trainerNotes = week.clientCheckIn.trainerNotes || "";
  week.clientCheckIn.completedSessions = normalizeCount(week.clientCheckIn.completedSessions);
  week.clientCheckIn.nextWeek = week.clientCheckIn.nextWeek || "Continue";
}

function buildWeekTemplate(weekNumber) {
  return {
    number: weekNumber,
    dateRange: "",
    phase: "Foundation",
    tagline: "",
    sessions: [buildSessionTemplate(1), buildSessionTemplate(2), buildSessionTemplate(3)],
    clientCheckIn: {
      energy: "OK",
      soreness: "Mild",
      winsChallenges: "",
      trainerNotes: "",
      completedSessions: 0,
      nextWeek: "Continue",
    },
  };
}

function buildSessionTemplate(sessionNumber) {
  return {
    number: sessionNumber,
    title: sessionNumber === 1 ? "With Your Trainer" : "On Your Own",
    date: "",
    focus: "",
    exercises: Array.from({ length: EXERCISE_ROWS }, () => ({
      exercise: "",
      equipment: "",
      sets: "",
      reps: "",
      effort: "",
      notes: "",
    })),
  };
}

function renderClientOptions() {
  clientSelect.innerHTML = dataState.clients
    .map((client) => {
      const label = escapeHtml(client.profile.clientName || client.id);
      const id = escapeHtml(client.id);
      return `<option value="${id}">${label}</option>`;
    })
    .join("");

  if (selectedClientId) {
    clientSelect.value = selectedClientId;
  }
}

function renderWeekOptions(client) {
  weekSelect.innerHTML = client.weeks
    .map((week, index) => {
      const label = week.dateRange
        ? `Week ${index + 1} (${escapeHtml(week.dateRange)})`
        : `Week ${index + 1}`;
      return `<option value="${index}">${label}</option>`;
    })
    .join("");

  weekSelect.value = String(selectedWeekIndex);
}

function onClientChange() {
  selectedClientId = clientSelect.value;
  selectedWeekIndex = 0;
  loadClientIntoForm();
  renderDirtyState();
}

function onWeekChange() {
  selectedWeekIndex = Number(weekSelect.value) || 0;
  loadWeekIntoForm();
}

function loadClientIntoForm() {
  const client = getSelectedClient();
  if (!client) {
    return;
  }

  ensureClientShape(client);

  nameInput.value = client.profile.clientName;
  trainerInput.value = client.profile.trainerName;
  startDateInput.value = client.profile.programStartDate;
  endDateInput.value = client.profile.programEndDate;
  goalInput.value = client.profile.primaryGoal;
  coachedDayInput.value = client.profile.weeklyCoachedSessionDay;
  indDayOneInput.value = client.profile.independentSessionDays[0];
  indDayTwoInput.value = client.profile.independentSessionDays[1];

  goalOwnWordsInput.value = client.goals.primaryGoalInOwnWords;
  successInput.value = client.goals.successAfter7Weeks;
  improveInput.value = client.goals.oneThingToImprove;

  selectedWeekIndex = Math.min(selectedWeekIndex, client.weeks.length - 1);
  renderWeekOptions(client);
  loadWeekIntoForm();
  loadFinalAssessmentIntoForm(client);

  setEditorStatus(`${client.profile.clientName} loaded.`, "success");
}

function loadWeekIntoForm() {
  const week = getSelectedWeek();
  if (!week) {
    return;
  }

  weekDateRangeInput.value = week.dateRange;
  weekPhaseInput.value = week.phase;
  weekTaglineInput.value = week.tagline;

  energyInput.value = week.clientCheckIn.energy;
  sorenessInput.value = week.clientCheckIn.soreness;
  completedInput.value = String(week.clientCheckIn.completedSessions);
  nextWeekInput.value = week.clientCheckIn.nextWeek;
  winsInput.value = week.clientCheckIn.winsChallenges;
  trainerNotesInput.value = week.clientCheckIn.trainerNotes;

  sessionsEditor.innerHTML = week.sessions
    .map((session, sessionIndex) => renderSessionEditor(session, sessionIndex))
    .join("");
}

function renderSessionEditor(session, sessionIndex) {
  const exerciseRows = session.exercises
    .map(
      (row, rowIndex) => `
      <tr>
        <td>${rowIndex + 1}</td>
        <td><input data-scope="exercise" data-session="${sessionIndex}" data-row="${rowIndex}" data-key="exercise" value="${escapeAttribute(row.exercise)}" /></td>
        <td><input data-scope="exercise" data-session="${sessionIndex}" data-row="${rowIndex}" data-key="equipment" value="${escapeAttribute(row.equipment)}" /></td>
        <td><input data-scope="exercise" data-session="${sessionIndex}" data-row="${rowIndex}" data-key="sets" value="${escapeAttribute(row.sets)}" /></td>
        <td><input data-scope="exercise" data-session="${sessionIndex}" data-row="${rowIndex}" data-key="reps" value="${escapeAttribute(row.reps)}" /></td>
        <td><input data-scope="exercise" data-session="${sessionIndex}" data-row="${rowIndex}" data-key="effort" value="${escapeAttribute(row.effort)}" /></td>
        <td><input data-scope="exercise" data-session="${sessionIndex}" data-row="${rowIndex}" data-key="notes" value="${escapeAttribute(row.notes)}" /></td>
      </tr>
    `
    )
    .join("");

  return `
    <article class="session-card">
      <h3 class="session-heading">Session ${sessionIndex + 1}</h3>
      <div class="form-grid" style="margin-top: 0.45rem;">
        <label class="field">
          <span>Session Type</span>
          <input data-scope="session" data-session="${sessionIndex}" data-key="title" value="${escapeAttribute(session.title)}" />
        </label>
        <label class="field">
          <span>Date</span>
          <input data-scope="session" data-session="${sessionIndex}" data-key="date" value="${escapeAttribute(session.date)}" />
        </label>
        <label class="field field-wide">
          <span>Focus</span>
          <input data-scope="session" data-session="${sessionIndex}" data-key="focus" value="${escapeAttribute(session.focus)}" />
        </label>
      </div>
      <div class="table-wrap" style="margin-top: 0.5rem;">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Exercise</th>
              <th>Equipment</th>
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

function onSessionEditorInput(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  const week = getSelectedWeek();
  if (!week) {
    return;
  }

  const scope = target.dataset.scope;
  const sessionIndex = Number(target.dataset.session);
  const key = target.dataset.key;
  const value = target.value.trim();

  if (!Number.isInteger(sessionIndex) || !key) {
    return;
  }

  if (scope === "session") {
    week.sessions[sessionIndex][key] = value;
    touchData();
    return;
  }

  if (scope === "exercise") {
    const rowIndex = Number(target.dataset.row);
    if (!Number.isInteger(rowIndex)) {
      return;
    }

    week.sessions[sessionIndex].exercises[rowIndex][key] = value;
    touchData();
  }
}

function loadFinalAssessmentIntoForm(client) {
  const finalAssessment = client.finalAssessment;

  assessmentDateInput.value = finalAssessment.date;
  proudInput.value = finalAssessment.proudOf;
  keepWorkingInput.value = finalAssessment.keepWorkingOn;
  summaryInput.value = finalAssessment.trainerSummary;

  assessmentTableBody.innerHTML = finalAssessment.items
    .map(
      (row, rowIndex) => `
      <tr>
        <td><input data-row="${rowIndex}" data-key="assessment" value="${escapeAttribute(row.assessment)}" /></td>
        <td><input data-row="${rowIndex}" data-key="startingScore" value="${escapeAttribute(row.startingScore)}" /></td>
        <td><input data-row="${rowIndex}" data-key="finalScore" value="${escapeAttribute(row.finalScore)}" /></td>
        <td><input data-row="${rowIndex}" data-key="change" value="${escapeAttribute(row.change)}" /></td>
      </tr>
    `
    )
    .join("");
}

function onAssessmentInput(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  const client = getSelectedClient();
  if (!client) {
    return;
  }

  const rowIndex = Number(target.dataset.row);
  const key = target.dataset.key;

  if (!Number.isInteger(rowIndex) || !key) {
    return;
  }

  client.finalAssessment.items[rowIndex][key] = target.value.trim();
  touchData();
}

function addClient() {
  const name = window.prompt("Enter new student name:", "New Student");
  if (!name) {
    return;
  }

  const id = uniqueClientId(slugify(name));
  const client = {
    id,
    profile: {
      clientName: name.trim(),
      trainerName: "Coach",
      programStartDate: "",
      programEndDate: "",
      primaryGoal: "",
      weeklyCoachedSessionDay: "",
      independentSessionDays: ["", ""],
    },
    programAtAGlance: [],
    goals: {
      primaryGoalInOwnWords: "",
      successAfter7Weeks: "",
      oneThingToImprove: "",
    },
    weeks: Array.from({ length: 7 }, (_, index) => buildWeekTemplate(index + 1)),
    finalAssessment: {
      date: "",
      items: Array.from({ length: ASSESSMENT_ROWS }, () => ({
        assessment: "",
        startingScore: "",
        finalScore: "",
        change: "",
      })),
      proudOf: "",
      keepWorkingOn: "",
      trainerSummary: "",
    },
  };

  dataState.clients.push(client);
  selectedClientId = client.id;
  selectedWeekIndex = 0;
  touchData();
  renderClientOptions();
  loadClientIntoForm();
  setEditorStatus(`Added ${name.trim()}.`, "success");
}

function removeClient() {
  const client = getSelectedClient();
  if (!client) {
    return;
  }

  const confirmed = window.confirm(`Remove ${client.profile.clientName}?`);
  if (!confirmed) {
    return;
  }

  dataState.clients = dataState.clients.filter((item) => item.id !== client.id);
  selectedClientId = dataState.clients[0]?.id || null;
  selectedWeekIndex = 0;
  touchData();

  renderClientOptions();
  loadClientIntoForm();
  setEditorStatus("Student removed.", "warning");
}

async function shareClientLink() {
  const client = getSelectedClient();
  if (!client) {
    return;
  }

  const url = buildClientUrl(client.id);
  const shareData = {
    title: `${client.profile.clientName} Training Plan`,
    text: "Here is your updated training plan.",
    url,
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      setEditorStatus("Student link shared.", "success");
      return;
    } catch (_) {
      // User canceled share.
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    setEditorStatus("Student link copied.", "success");
  } catch (_) {
    setEditorStatus(`Copy this link: ${url}`, "warning");
  }
}

function openClientView() {
  const client = getSelectedClient();
  if (!client) {
    return;
  }

  window.open(buildClientUrl(client.id), "_blank", "noopener");
}

function downloadBackup() {
  if (!dataState) {
    return;
  }

  const payload = JSON.stringify(dataState, null, 2) + "\n";
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `training-plans-backup-${todayIso()}.json`;
  link.click();
  URL.revokeObjectURL(url);
  setPublishStatus("Backup downloaded.", "success");
}

async function publishData() {
  if (!dataState) {
    setPublishStatus("No data to publish.", "error");
    return;
  }

  const token = tokenInput.value.trim();
  if (!token) {
    setPublishStatus("Enter publishing key first.", "error");
    return;
  }

  const issues = validateData(dataState);
  if (issues.length > 0) {
    setPublishStatus(`Cannot post yet: ${issues.join(" | ")}`, "error");
    return;
  }

  setPublishStatus("Posting updates live...", "warning");
  publishBtn.disabled = true;
  publishBtn.textContent = "Posting...";

  try {
    dataState.lastUpdated = todayIso();
    const encodedPath = GITHUB_TARGET.path
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");

    const contentUrl = `https://api.github.com/repos/${encodeURIComponent(
      GITHUB_TARGET.owner
    )}/${encodeURIComponent(GITHUB_TARGET.repo)}/contents/${encodedPath}`;

    const headers = {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    };

    const lookupResponse = await fetch(
      `${contentUrl}?ref=${encodeURIComponent(GITHUB_TARGET.branch)}`,
      { headers }
    );

    if (!lookupResponse.ok) {
      const message = await readApiError(lookupResponse);
      throw new Error(`Could not load live file: ${message}`);
    }

    const lookup = await lookupResponse.json();
    const payload = JSON.stringify(dataState, null, 2) + "\n";

    const updateResponse = await fetch(contentUrl, {
      method: "PUT",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `update training plans (${new Date().toISOString().slice(0, 16).replace("T", " ")})`,
        content: toBase64Unicode(payload),
        sha: lookup.sha,
        branch: GITHUB_TARGET.branch,
      }),
    });

    if (!updateResponse.ok) {
      const message = await readApiError(updateResponse);
      throw new Error(`Post failed: ${message}`);
    }

    const result = await updateResponse.json();
    persistSettings();
    dirty = false;
    renderDirtyState();
    setPublishStatus(
      `Posted live. ${result.commit?.html_url || "Update complete"}. Site refresh may take about 1 minute.`,
      "success"
    );
  } catch (error) {
    setPublishStatus(error.message || "Post failed.", "error");
  } finally {
    publishBtn.disabled = false;
    publishBtn.textContent = "Post Updates Live";
  }
}

async function readApiError(response) {
  try {
    const data = await response.json();
    if (data?.message) {
      return data.message;
    }
  } catch (_) {
    // Ignore parse errors.
  }

  return `${response.status} ${response.statusText}`;
}

function validateData(data) {
  const issues = [];
  if (!Array.isArray(data.clients) || data.clients.length === 0) {
    issues.push("Add at least one student plan");
    return issues;
  }

  const ids = new Set();
  data.clients.forEach((client, index) => {
    if (!client.id) {
      issues.push(`Student ${index + 1} missing id`);
    }

    if (ids.has(client.id)) {
      issues.push(`Duplicate student id: ${client.id}`);
    }

    ids.add(client.id);

    if (!client.profile?.clientName) {
      issues.push(`Student ${index + 1} missing name`);
    }

    if (!Array.isArray(client.weeks) || client.weeks.length < 1) {
      issues.push(`${client.profile?.clientName || client.id} missing weeks`);
    }
  });

  return issues;
}

function getSelectedClient() {
  return dataState?.clients?.find((client) => client.id === selectedClientId) || null;
}

function getSelectedWeek() {
  const client = getSelectedClient();
  if (!client) {
    return null;
  }

  return client.weeks[selectedWeekIndex] || null;
}

function touchData() {
  dirty = true;
  dataState.lastUpdated = todayIso();
  renderDirtyState();
}

function renderDirtyState() {
  if (dirty) {
    setEditorStatus("You have unsent changes. Click Post Updates Live when ready.", "warning");
    return;
  }

  setEditorStatus("All changes are posted.", "success");
}

function uniqueClientId(base) {
  let candidate = base || "student";
  let index = 2;

  while (!isUniqueClientId(candidate)) {
    candidate = `${base}-${index}`;
    index += 1;
  }

  return candidate;
}

function isUniqueClientId(candidate, currentId = null) {
  return !dataState.clients.some((client) => client.id === candidate && client.id !== currentId);
}

function normalizeCount(value) {
  const count = Number.parseInt(value, 10);
  if (Number.isNaN(count)) {
    return 0;
  }

  return Math.min(3, Math.max(0, count));
}

function buildClientUrl(clientId) {
  const base = `${window.location.origin}${window.location.pathname.replace("trainer.html", "index.html")}`;
  return `${base}?client=${encodeURIComponent(clientId)}`;
}

function setEditorStatus(message, type) {
  editorStatus.className = `status-line ${statusClass(type)}`;
  editorStatus.textContent = message;
}

function setPublishStatus(message, type) {
  publishStatus.className = `status-line ${statusClass(type)}`;
  publishStatus.textContent = message;
}

function statusClass(type) {
  if (type === "success") {
    return "status-success";
  }

  if (type === "error") {
    return "status-error";
  }

  return "status-warning";
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "student";
}

function toBase64Unicode(value) {
  const bytes = new TextEncoder().encode(value);
  const chunkSize = 0x8000;
  let binary = "";

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function escapeHtml(input) {
  return String(input)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(input) {
  return escapeHtml(input).replaceAll("`", "");
}
