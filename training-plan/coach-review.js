const API_BASE = (window.PLAN_API_BASE || "").replace(/\/$/, "");
const COACH_KEY_STORAGE = "coachReviewKeyV1";

const coachKeyInput = document.getElementById("coachKeyInput");
const rememberCoachKeyInput = document.getElementById("rememberCoachKeyInput");
const loadPendingBtn = document.getElementById("loadPendingBtn");
const reviewStatus = document.getElementById("reviewStatus");
const pendingList = document.getElementById("pendingList");

let pendingSubmissions = [];

init();

function init() {
  registerServiceWorker();
  hydrateCoachKey();
  wireEvents();

  if (!API_BASE) {
    setReviewStatus("API server is not configured. Set PLAN_API_BASE in api-config.js.", "error");
    return;
  }

  loadPending();
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
  coachKeyInput.addEventListener("blur", persistCoachKey);
  rememberCoachKeyInput.addEventListener("change", persistCoachKey);
  loadPendingBtn.addEventListener("click", loadPending);

  pendingList.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    const submissionId = target.dataset.id;
    if (!submissionId) {
      return;
    }

    if (target.dataset.action === "approve") {
      await approveSubmission(submissionId, target);
      return;
    }

    if (target.dataset.action === "reject") {
      await rejectSubmission(submissionId, target);
    }
  });
}

function hydrateCoachKey() {
  try {
    const saved = localStorage.getItem(COACH_KEY_STORAGE);
    if (!saved) {
      return;
    }

    coachKeyInput.value = saved;
    rememberCoachKeyInput.checked = true;
  } catch (_) {
    // Ignore storage errors.
  }
}

function persistCoachKey() {
  try {
    if (rememberCoachKeyInput.checked) {
      localStorage.setItem(COACH_KEY_STORAGE, coachKeyInput.value.trim());
      return;
    }

    localStorage.removeItem(COACH_KEY_STORAGE);
  } catch (_) {
    // Ignore storage errors.
  }
}

async function loadPending() {
  if (!API_BASE) {
    setReviewStatus("API server is not configured.", "error");
    return;
  }

  const coachKey = coachKeyInput.value.trim();
  if (!coachKey) {
    setReviewStatus("Enter your coach access key.", "error");
    return;
  }

  setReviewStatus("Loading pending requests...", "warning");
  loadPendingBtn.disabled = true;

  try {
    const response = await fetch(`${API_BASE}/api/submissions/pending`, {
      headers: {
        "x-coach-key": coachKey,
      },
    });

    if (!response.ok) {
      const message = await readApiError(response);
      throw new Error(message);
    }

    const data = await response.json();
    pendingSubmissions = Array.isArray(data.submissions) ? data.submissions : [];
    renderPendingList();
    setReviewStatus(`Loaded ${pendingSubmissions.length} pending request(s).`, "success");
    persistCoachKey();
  } catch (error) {
    setReviewStatus(error.message || "Could not load pending requests.", "error");
  } finally {
    loadPendingBtn.disabled = false;
  }
}

function renderPendingList() {
  if (pendingSubmissions.length === 0) {
    pendingList.innerHTML = `<p class="note">No pending requests.</p>`;
    return;
  }

  pendingList.innerHTML = pendingSubmissions
    .map((submission) => {
      const plan = submission.updatedClient || {};
      const profile = plan.profile || {};
      const weekOne = plan.weeks?.[0] || {};
      const sessionOne = weekOne.sessions?.[0] || {};

      return `
        <article class="session-card">
          <h3 class="session-heading">${escapeHtml(profile.clientName || submission.clientId || "Student")}</h3>
          <p class="note"><strong>Requested by:</strong> ${escapeHtml(submission.submittedBy || "Unknown")}</p>
          <p class="note"><strong>Submitted:</strong> ${escapeHtml(formatDate(submission.submittedAt))}</p>
          <p class="note"><strong>Message:</strong> ${escapeHtml(submission.note || "None")}</p>
          <p class="note"><strong>Primary goal:</strong> ${escapeHtml(profile.primaryGoal || "Not set")}</p>
          <p class="note"><strong>Week 1 focus:</strong> ${escapeHtml(sessionOne.focus || "Not set")}</p>
          <div class="toolbar">
            <button class="btn" data-action="approve" data-id="${escapeHtml(submission.id)}" type="button">Approve and Publish</button>
            <button class="btn ghost" data-action="reject" data-id="${escapeHtml(submission.id)}" type="button">Reject</button>
          </div>
        </article>
      `;
    })
    .join("");
}

async function approveSubmission(submissionId, button) {
  const coachKey = coachKeyInput.value.trim();
  if (!coachKey) {
    setReviewStatus("Enter your coach access key.", "error");
    return;
  }

  button.disabled = true;
  setReviewStatus("Approving request and publishing live...", "warning");

  try {
    const response = await fetch(`${API_BASE}/api/submissions/${encodeURIComponent(submissionId)}/approve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-coach-key": coachKey,
      },
      body: JSON.stringify({
        approvedBy: "Coach",
      }),
    });

    if (!response.ok) {
      const message = await readApiError(response);
      throw new Error(message);
    }

    const data = await response.json();
    setReviewStatus(
      `Approved and published${data.commitUrl ? `: ${data.commitUrl}` : ""}.`,
      "success"
    );
    await loadPending();
  } catch (error) {
    setReviewStatus(error.message || "Approval failed.", "error");
  } finally {
    button.disabled = false;
  }
}

async function rejectSubmission(submissionId, button) {
  const coachKey = coachKeyInput.value.trim();
  if (!coachKey) {
    setReviewStatus("Enter your coach access key.", "error");
    return;
  }

  const reason = window.prompt("Reason for rejection (optional):", "Needs more detail");
  if (reason === null) {
    return;
  }

  button.disabled = true;
  setReviewStatus("Rejecting request...", "warning");

  try {
    const response = await fetch(`${API_BASE}/api/submissions/${encodeURIComponent(submissionId)}/reject`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-coach-key": coachKey,
      },
      body: JSON.stringify({
        reason: reason.trim(),
      }),
    });

    if (!response.ok) {
      const message = await readApiError(response);
      throw new Error(message);
    }

    setReviewStatus("Request rejected.", "success");
    await loadPending();
  } catch (error) {
    setReviewStatus(error.message || "Reject failed.", "error");
  } finally {
    button.disabled = false;
  }
}

async function readApiError(response) {
  try {
    const data = await response.json();
    if (data?.error) {
      return data.error;
    }

    if (data?.message) {
      return data.message;
    }
  } catch (_) {
    // Ignore parse errors.
  }

  return `${response.status} ${response.statusText}`;
}

function formatDate(isoString) {
  if (!isoString) {
    return "Unknown";
  }

  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return isoString;
  }

  return date.toLocaleString();
}

function setReviewStatus(message, type) {
  reviewStatus.className = `status-line ${statusClass(type)}`;
  reviewStatus.textContent = message;
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

function escapeHtml(input) {
  return String(input)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
