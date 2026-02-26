const DATA_PATH = "data/training-plans.json";
const SETTINGS_KEY = "trainerPortalSettingsV1";

const DEFAULT_SETTINGS = {
  owner: "akeath18",
  repo: "HPE-assets",
  branch: "main",
  path: "training-plan/data/training-plans.json",
  rememberToken: false,
  token: "",
};

let dataState = null;
let selectedClientId = null;
let loadedEditorValue = "";

const ownerInput = document.getElementById("ownerInput");
const repoInput = document.getElementById("repoInput");
const branchInput = document.getElementById("branchInput");
const pathInput = document.getElementById("pathInput");
const tokenInput = document.getElementById("tokenInput");
const rememberTokenInput = document.getElementById("rememberTokenInput");

const validateDataBtn = document.getElementById("validateDataBtn");
const downloadBackupBtn = document.getElementById("downloadBackupBtn");
const publishBtn = document.getElementById("publishBtn");
const publishStatus = document.getElementById("publishStatus");

const clientSelect = document.getElementById("clientSelect");
const addClientBtn = document.getElementById("addClientBtn");
const removeClientBtn = document.getElementById("removeClientBtn");
const shareClientBtn = document.getElementById("shareClientBtn");
const openClientBtn = document.getElementById("openClientBtn");
const applyQuickFieldsBtn = document.getElementById("applyQuickFieldsBtn");

const nameInput = document.getElementById("nameInput");
const trainerInput = document.getElementById("trainerInput");
const startDateInput = document.getElementById("startDateInput");
const endDateInput = document.getElementById("endDateInput");
const goalInput = document.getElementById("goalInput");
const coachedDayInput = document.getElementById("coachedDayInput");
const indDayOneInput = document.getElementById("indDayOneInput");
const indDayTwoInput = document.getElementById("indDayTwoInput");

const clientJsonEditor = document.getElementById("clientJsonEditor");
const saveDraftBtn = document.getElementById("saveDraftBtn");
const resetEditorBtn = document.getElementById("resetEditorBtn");
const editorStatus = document.getElementById("editorStatus");

init();

async function init() {
  registerServiceWorker();
  hydrateSettings();
  wireEvents();

  try {
    const response = await fetch(DATA_PATH, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to load data (${response.status})`);
    }

    dataState = await response.json();
    ensureCoreStructure();

    selectedClientId = dataState.clients[0]?.id || null;
    renderClientSelect();
    loadSelectedClientIntoEditor();

    setPublishStatus(`Loaded ${dataState.clients.length} client plans.`, "success");
  } catch (error) {
    setPublishStatus(error.message || "Failed to load plan data.", "error");
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
  [ownerInput, repoInput, branchInput, pathInput, tokenInput, rememberTokenInput].forEach((element) => {
    element.addEventListener("change", persistSettings);
    element.addEventListener("blur", persistSettings);
  });

  validateDataBtn.addEventListener("click", () => {
    const issues = validateData(dataState);
    if (issues.length === 0) {
      setPublishStatus("Data validation passed.", "success");
      return;
    }

    setPublishStatus(`Validation issues: ${issues.join(" | ")}`, "error");
  });

  downloadBackupBtn.addEventListener("click", downloadBackupFile);
  publishBtn.addEventListener("click", publishToGitHub);

  clientSelect.addEventListener("change", () => {
    if (!confirmDraftSwitch()) {
      clientSelect.value = selectedClientId;
      return;
    }

    selectedClientId = clientSelect.value;
    loadSelectedClientIntoEditor();
  });

  addClientBtn.addEventListener("click", addClient);
  removeClientBtn.addEventListener("click", removeClient);
  shareClientBtn.addEventListener("click", shareClientLink);
  openClientBtn.addEventListener("click", openClientView);
  applyQuickFieldsBtn.addEventListener("click", applyQuickFieldsToEditor);

  saveDraftBtn.addEventListener("click", saveClientDraft);
  resetEditorBtn.addEventListener("click", loadSelectedClientIntoEditor);

  clientJsonEditor.addEventListener("input", updateEditorDirtyState);
}

function hydrateSettings() {
  const stored = safelyReadStoredSettings();
  const settings = { ...DEFAULT_SETTINGS, ...stored };

  ownerInput.value = settings.owner;
  repoInput.value = settings.repo;
  branchInput.value = settings.branch;
  pathInput.value = settings.path;
  rememberTokenInput.checked = Boolean(settings.rememberToken);
  tokenInput.value = settings.rememberToken ? settings.token || "" : "";
}

function persistSettings() {
  const settings = {
    owner: ownerInput.value.trim(),
    repo: repoInput.value.trim(),
    branch: branchInput.value.trim(),
    path: pathInput.value.trim(),
    rememberToken: rememberTokenInput.checked,
    token: rememberTokenInput.checked ? tokenInput.value : "",
  };

  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function safelyReadStoredSettings() {
  try {
    const value = localStorage.getItem(SETTINGS_KEY);
    if (!value) {
      return null;
    }

    const parsed = JSON.parse(value);
    if (typeof parsed !== "object" || !parsed) {
      return null;
    }

    return parsed;
  } catch (_) {
    return null;
  }
}

function ensureCoreStructure() {
  if (!dataState || typeof dataState !== "object") {
    dataState = { clients: [] };
  }

  if (!Array.isArray(dataState.clients)) {
    dataState.clients = [];
  }
}

function renderClientSelect() {
  const options = dataState.clients
    .map((client) => {
      const label = client.profile?.clientName || client.id;
      const escapedLabel = escapeHtml(label);
      const escapedId = escapeHtml(client.id);
      return `<option value="${escapedId}">${escapedLabel} (${escapedId})</option>`;
    })
    .join("");

  clientSelect.innerHTML = options;

  if (selectedClientId) {
    clientSelect.value = selectedClientId;
  }
}

function loadSelectedClientIntoEditor() {
  const client = getSelectedClient();
  if (!client) {
    clientJsonEditor.value = "";
    loadedEditorValue = "";
    fillQuickFields({});
    updateEditorStatus("No client selected.", "warning");
    return;
  }

  loadedEditorValue = serializeClient(client);
  clientJsonEditor.value = loadedEditorValue;
  fillQuickFields(client);
  updateEditorStatus(`Loaded ${client.profile?.clientName || client.id}.`, "success");
  updateEditorDirtyState();
}

function fillQuickFields(client) {
  const profile = client.profile || {};
  nameInput.value = profile.clientName || "";
  trainerInput.value = profile.trainerName || "";
  startDateInput.value = profile.programStartDate || "";
  endDateInput.value = profile.programEndDate || "";
  goalInput.value = profile.primaryGoal || "";
  coachedDayInput.value = profile.weeklyCoachedSessionDay || "";
  indDayOneInput.value = profile.independentSessionDays?.[0] || "";
  indDayTwoInput.value = profile.independentSessionDays?.[1] || "";
}

function applyQuickFieldsToEditor() {
  const parsed = parseEditorJson();
  if (!parsed.ok) {
    updateEditorStatus(parsed.error, "error");
    return;
  }

  const client = parsed.value;
  client.profile = client.profile || {};

  client.profile.clientName = nameInput.value.trim();
  client.profile.trainerName = trainerInput.value.trim();
  client.profile.programStartDate = startDateInput.value.trim();
  client.profile.programEndDate = endDateInput.value.trim();
  client.profile.primaryGoal = goalInput.value.trim();
  client.profile.weeklyCoachedSessionDay = coachedDayInput.value.trim();
  client.profile.independentSessionDays = [indDayOneInput.value.trim(), indDayTwoInput.value.trim()];

  if (!client.id || !client.id.trim()) {
    client.id = slugify(client.profile.clientName || "new-client");
  }

  clientJsonEditor.value = serializeClient(client);
  updateEditorStatus("Quick fields applied to editor. Save draft to keep changes.", "success");
  updateEditorDirtyState();
}

function saveClientDraft() {
  const parsed = parseEditorJson();
  if (!parsed.ok) {
    updateEditorStatus(parsed.error, "error");
    return false;
  }

  const client = parsed.value;
  if (!client.id || typeof client.id !== "string" || !client.id.trim()) {
    updateEditorStatus("Client JSON must include a non-empty string id.", "error");
    return false;
  }

  client.id = slugify(client.id);

  const issues = validateClient(client);
  if (issues.length > 0) {
    updateEditorStatus(`Client validation failed: ${issues.join(" | ")}`, "error");
    return false;
  }

  const selectedIndex = dataState.clients.findIndex((item) => item.id === selectedClientId);
  const duplicateIndex = dataState.clients.findIndex(
    (item, index) => item.id === client.id && index !== selectedIndex
  );

  if (duplicateIndex !== -1) {
    updateEditorStatus(`Client id '${client.id}' already exists.`, "error");
    return false;
  }

  if (selectedIndex === -1) {
    dataState.clients.push(client);
  } else {
    dataState.clients[selectedIndex] = client;
  }

  selectedClientId = client.id;
  setUpdatedDate();
  renderClientSelect();
  loadSelectedClientIntoEditor();
  setPublishStatus("Draft saved in browser memory. Click Publish to push live.", "warning");
  return true;
}

function addClient() {
  if (!confirmDraftSwitch()) {
    return;
  }

  const newClient = buildNewClientTemplate(dataState.clients);
  dataState.clients.push(newClient);
  selectedClientId = newClient.id;
  setUpdatedDate();
  renderClientSelect();
  loadSelectedClientIntoEditor();
  setPublishStatus(`Added new client template '${newClient.id}'.`, "warning");
}

function removeClient() {
  const client = getSelectedClient();
  if (!client) {
    return;
  }

  const confirmed = window.confirm(`Remove ${client.profile?.clientName || client.id}? This cannot be undone.`);
  if (!confirmed) {
    return;
  }

  dataState.clients = dataState.clients.filter((item) => item.id !== client.id);
  setUpdatedDate();

  selectedClientId = dataState.clients[0]?.id || null;
  renderClientSelect();
  loadSelectedClientIntoEditor();
  setPublishStatus("Client removed from draft data.", "warning");
}

function confirmDraftSwitch() {
  if (!isEditorDirty()) {
    return true;
  }

  return window.confirm("You have unsaved editor changes. Continue without saving?");
}

function parseEditorJson() {
  try {
    const parsed = JSON.parse(clientJsonEditor.value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, error: "Client JSON must be an object." };
    }

    return { ok: true, value: parsed };
  } catch (error) {
    return { ok: false, error: `Invalid JSON: ${error.message}` };
  }
}

async function publishToGitHub() {
  if (!dataState) {
    setPublishStatus("No data available to publish.", "error");
    return;
  }

  if (isEditorDirty()) {
    const shouldSave = window.confirm("You have unsaved editor changes. Save draft before publishing?");
    if (shouldSave) {
      const saved = saveClientDraft();
      if (!saved) {
        return;
      }
    }
  }

  const issues = validateData(dataState);
  if (issues.length > 0) {
    setPublishStatus(`Cannot publish. Validation issues: ${issues.join(" | ")}`, "error");
    return;
  }

  const owner = ownerInput.value.trim();
  const repo = repoInput.value.trim();
  const branch = branchInput.value.trim();
  const path = pathInput.value.trim();
  const token = tokenInput.value.trim();

  if (!owner || !repo || !branch || !path || !token) {
    setPublishStatus("Owner, repo, branch, path, and token are required.", "error");
    return;
  }

  publishBtn.disabled = true;
  publishBtn.textContent = "Publishing...";
  setPublishStatus("Publishing update to GitHub...", "warning");

  try {
    const content = JSON.stringify(dataState, null, 2) + "\n";
    const encodedPath = path
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    const contentUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}`;

    const baseHeaders = {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    };

    const lookupResponse = await fetch(`${contentUrl}?ref=${encodeURIComponent(branch)}`, {
      headers: baseHeaders,
    });

    if (!lookupResponse.ok) {
      const message = await extractGitHubError(lookupResponse);
      throw new Error(`File lookup failed: ${message}`);
    }

    const lookup = await lookupResponse.json();
    const sha = lookup.sha;

    const commitMessage = `update training plans (${new Date().toISOString().slice(0, 16).replace("T", " ")})`;

    const updateResponse = await fetch(contentUrl, {
      method: "PUT",
      headers: {
        ...baseHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: commitMessage,
        content: toBase64Unicode(content),
        sha,
        branch,
      }),
    });

    if (!updateResponse.ok) {
      const message = await extractGitHubError(updateResponse);
      throw new Error(`Publish failed: ${message}`);
    }

    const updateResult = await updateResponse.json();
    setPublishStatus(
      `Published successfully. Commit: ${updateResult.commit?.html_url || updateResult.commit?.sha || "created"}. GitHub Pages may take up to 1 minute to refresh.`,
      "success"
    );
    persistSettings();
  } catch (error) {
    setPublishStatus(error.message || "Publish failed.", "error");
  } finally {
    publishBtn.disabled = false;
    publishBtn.textContent = "Publish Update to GitHub";
  }
}

async function extractGitHubError(response) {
  try {
    const data = await response.json();
    if (data?.message) {
      return data.message;
    }
  } catch (_) {
    // Ignore JSON parse errors.
  }

  return `${response.status} ${response.statusText}`;
}

function downloadBackupFile() {
  if (!dataState) {
    setPublishStatus("No data to download yet.", "error");
    return;
  }

  const payload = JSON.stringify(dataState, null, 2) + "\n";
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `training-plans-backup-${todayIso()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  setPublishStatus("Backup JSON downloaded.", "success");
}

async function shareClientLink() {
  const client = getSelectedClient();
  if (!client) {
    updateEditorStatus("Select a client first.", "error");
    return;
  }

  const url = buildClientUrl(client.id);
  const shareData = {
    title: `${client.profile?.clientName || client.id} Training Plan`,
    text: "Here is your updated training plan link.",
    url,
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      updateEditorStatus("Client link shared.", "success");
      return;
    } catch (_) {
      // User canceled share.
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    updateEditorStatus("Client link copied to clipboard.", "success");
  } catch (_) {
    updateEditorStatus(`Copy this client link manually: ${url}`, "warning");
  }
}

function openClientView() {
  const client = getSelectedClient();
  if (!client) {
    return;
  }

  window.open(buildClientUrl(client.id), "_blank", "noopener");
}

function buildClientUrl(clientId) {
  const base = `${window.location.origin}${window.location.pathname.replace("trainer.html", "index.html")}`;
  return `${base}?client=${encodeURIComponent(clientId)}`;
}

function getSelectedClient() {
  return dataState?.clients?.find((item) => item.id === selectedClientId) || null;
}

function serializeClient(client) {
  return JSON.stringify(client, null, 2);
}

function updateEditorDirtyState() {
  if (isEditorDirty()) {
    editorStatus.className = "status-line status-warning";
    editorStatus.textContent = "Unsaved changes in editor.";
    return;
  }

  editorStatus.className = "status-line status-success";
  editorStatus.textContent = "Editor is synced with current draft data.";
}

function isEditorDirty() {
  return clientJsonEditor.value.trim() !== loadedEditorValue.trim();
}

function updateEditorStatus(message, type) {
  const variant = statusVariant(type);
  editorStatus.className = `status-line ${variant}`;
  editorStatus.textContent = message;
}

function setPublishStatus(message, type) {
  const variant = statusVariant(type);
  publishStatus.className = `status-line ${variant}`;
  publishStatus.textContent = message;
}

function statusVariant(type) {
  if (type === "success") {
    return "status-success";
  }

  if (type === "error") {
    return "status-error";
  }

  return "status-warning";
}

function validateData(data) {
  const issues = [];

  if (!data || typeof data !== "object") {
    issues.push("Root data must be an object");
    return issues;
  }

  if (!Array.isArray(data.clients)) {
    issues.push("clients must be an array");
    return issues;
  }

  const ids = new Set();
  data.clients.forEach((client, index) => {
    const clientIssues = validateClient(client);
    if (clientIssues.length > 0) {
      issues.push(`Client ${index + 1}: ${clientIssues.join(", ")}`);
    }

    if (client?.id && ids.has(client.id)) {
      issues.push(`Duplicate client id: ${client.id}`);
    }
    ids.add(client?.id);
  });

  return issues;
}

function validateClient(client) {
  const issues = [];

  if (!client || typeof client !== "object" || Array.isArray(client)) {
    issues.push("must be an object");
    return issues;
  }

  if (!client.id || typeof client.id !== "string") {
    issues.push("missing id");
  }

  if (!client.profile || typeof client.profile !== "object") {
    issues.push("missing profile");
  }

  if (!client.profile?.clientName) {
    issues.push("missing profile.clientName");
  }

  if (!Array.isArray(client.weeks)) {
    issues.push("missing weeks array");
  }

  return issues;
}

function buildNewClientTemplate(existingClients) {
  const id = nextClientId(existingClients);

  return {
    id,
    profile: {
      clientName: "New Client",
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
    weeks: [
      {
        number: 1,
        dateRange: "",
        phase: "Foundation",
        tagline: "",
        sessions: [
          {
            number: 1,
            title: "With Your Trainer",
            date: "",
            focus: "",
            exercises: [],
          },
          {
            number: 2,
            title: "On Your Own",
            date: "",
            focus: "",
            exercises: [],
          },
          {
            number: 3,
            title: "On Your Own",
            date: "",
            focus: "",
            exercises: [],
          },
        ],
        clientCheckIn: {
          energy: "OK",
          soreness: "Mild",
          winsChallenges: "",
          trainerNotes: "",
          completedSessions: 0,
          nextWeek: "Continue",
        },
      },
    ],
    finalAssessment: {
      date: "",
      items: [],
      proudOf: "",
      keepWorkingOn: "",
      trainerSummary: "",
    },
  };
}

function nextClientId(existingClients) {
  const base = "new-client";
  let index = 1;
  let candidate = `${base}-${index}`;
  const used = new Set(existingClients.map((client) => client.id));

  while (used.has(candidate)) {
    index += 1;
    candidate = `${base}-${index}`;
  }

  return candidate;
}

function setUpdatedDate() {
  dataState.lastUpdated = todayIso();
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "client";
}

function toBase64Unicode(value) {
  const bytes = new TextEncoder().encode(value);
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
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
