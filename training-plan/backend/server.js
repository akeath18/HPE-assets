const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();

const PORT = Number.parseInt(process.env.PORT || "8787", 10);
const COACH_REVIEW_KEY = process.env.COACH_REVIEW_KEY || "";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const GITHUB_OWNER = process.env.GITHUB_OWNER || "akeath18";
const GITHUB_REPO = process.env.GITHUB_REPO || "HPE-assets";
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "main";
const GITHUB_FILE_PATH = process.env.GITHUB_FILE_PATH || "training-plan/data/training-plans.json";
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const STORE_FILE = path.join(__dirname, "data", "submissions.json");

app.use(express.json({ limit: "5mb" }));
app.use(cors(buildCorsOptions()));
app.options("*", cors(buildCorsOptions()));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    now: new Date().toISOString(),
    githubConfigured: Boolean(GITHUB_TOKEN),
    coachKeyConfigured: Boolean(COACH_REVIEW_KEY),
  });
});

app.post("/api/submissions", (req, res) => {
  const validation = validateSubmissionBody(req.body);
  if (!validation.ok) {
    res.status(400).json({ error: validation.error });
    return;
  }

  const store = readStore();
  const submissionId = crypto.randomUUID();

  const submission = {
    id: submissionId,
    status: "pending",
    submittedAt: new Date().toISOString(),
    submittedBy: validation.value.submittedBy,
    note: validation.value.note,
    clientId: validation.value.clientId,
    updatedClient: validation.value.updatedClient,
  };

  store.submissions.push(submission);
  writeStore(store);

  res.status(201).json({ ok: true, submissionId });
});

app.get("/api/submissions/pending", requireCoachKey, (req, res) => {
  const store = readStore();

  const submissions = store.submissions
    .filter((submission) => submission.status === "pending")
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

  res.json({ submissions });
});

app.get("/api/submissions/history", requireCoachKey, (_req, res) => {
  const store = readStore();
  const submissions = store.submissions
    .filter((submission) => submission.status !== "pending")
    .sort((a, b) => new Date(b.reviewedAt || b.submittedAt).getTime() - new Date(a.reviewedAt || a.submittedAt).getTime());

  res.json({ submissions });
});

app.post("/api/submissions/:id/approve", requireCoachKey, async (req, res) => {
  try {
    const submissionId = req.params.id;
    const store = readStore();
    const submission = store.submissions.find((item) => item.id === submissionId);

    if (!submission) {
      res.status(404).json({ error: "Submission not found." });
      return;
    }

    if (submission.status !== "pending") {
      res.status(409).json({ error: `Submission already ${submission.status}.` });
      return;
    }

    const approvedBy = sanitizeText(req.body?.approvedBy || "Coach", 80);
    const publishResult = await publishApprovedClient(submission);

    submission.status = "approved";
    submission.reviewedAt = new Date().toISOString();
    submission.reviewedBy = approvedBy;
    submission.commitUrl = publishResult.commitUrl;

    writeStore(store);

    res.json({
      ok: true,
      submissionId,
      commitUrl: publishResult.commitUrl,
      commitSha: publishResult.commitSha,
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Approval failed." });
  }
});

app.post("/api/submissions/:id/reject", requireCoachKey, (req, res) => {
  const submissionId = req.params.id;
  const store = readStore();
  const submission = store.submissions.find((item) => item.id === submissionId);

  if (!submission) {
    res.status(404).json({ error: "Submission not found." });
    return;
  }

  if (submission.status !== "pending") {
    res.status(409).json({ error: `Submission already ${submission.status}.` });
    return;
  }

  submission.status = "rejected";
  submission.reviewedAt = new Date().toISOString();
  submission.reviewedBy = sanitizeText(req.body?.reviewedBy || "Coach", 80);
  submission.rejectionReason = sanitizeText(req.body?.reason || "", 500);

  writeStore(store);

  res.json({ ok: true, submissionId });
});

app.use((err, _req, res, _next) => {
  res.status(500).json({ error: err.message || "Server error." });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Training plan backend listening on port ${PORT}`);
});

function buildCorsOptions() {
  const allowAll = ALLOWED_ORIGINS.length === 0;

  return {
    origin(origin, callback) {
      if (!origin || allowAll || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin not allowed: ${origin}`));
    },
  };
}

function requireCoachKey(req, res, next) {
  if (!COACH_REVIEW_KEY) {
    res.status(500).json({ error: "COACH_REVIEW_KEY is not configured on the server." });
    return;
  }

  const headerKey = req.get("x-coach-key") || "";
  const authHeader = req.get("authorization") || "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const providedKey = headerKey || bearer;

  if (!providedKey || providedKey !== COACH_REVIEW_KEY) {
    res.status(401).json({ error: "Unauthorized coach key." });
    return;
  }

  next();
}

function validateSubmissionBody(body) {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid request body." };
  }

  const updatedClient = body.updatedClient;
  if (!updatedClient || typeof updatedClient !== "object" || Array.isArray(updatedClient)) {
    return { ok: false, error: "updatedClient must be an object." };
  }

  const clientId = sanitizeClientId(body.clientId || updatedClient.id);
  if (!clientId) {
    return { ok: false, error: "clientId is required." };
  }

  if (!updatedClient.profile || typeof updatedClient.profile !== "object") {
    return { ok: false, error: "updatedClient.profile is required." };
  }

  const submittedBy = sanitizeText(body.submittedBy || "", 80);
  if (!submittedBy) {
    return { ok: false, error: "submittedBy is required." };
  }

  const sanitizedClient = JSON.parse(JSON.stringify(updatedClient));
  sanitizedClient.id = clientId;

  return {
    ok: true,
    value: {
      clientId,
      submittedBy,
      note: sanitizeText(body.note || "", 500),
      updatedClient: sanitizedClient,
    },
  };
}

function sanitizeClientId(input) {
  return String(input || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sanitizeText(input, maxLength) {
  return String(input || "").trim().slice(0, maxLength);
}

function readStore() {
  ensureStoreFile();

  const text = fs.readFileSync(STORE_FILE, "utf8");
  try {
    const data = JSON.parse(text);
    if (!data || typeof data !== "object" || !Array.isArray(data.submissions)) {
      return { submissions: [] };
    }

    return data;
  } catch (_) {
    return { submissions: [] };
  }
}

function writeStore(data) {
  ensureStoreFile();
  fs.writeFileSync(STORE_FILE, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function ensureStoreFile() {
  const dir = path.dirname(STORE_FILE);
  fs.mkdirSync(dir, { recursive: true });

  if (!fs.existsSync(STORE_FILE)) {
    fs.writeFileSync(STORE_FILE, '{"submissions": []}\n', "utf8");
  }
}

async function publishApprovedClient(submission) {
  if (!GITHUB_TOKEN) {
    throw new Error("GITHUB_TOKEN is not configured on server.");
  }

  const encodedPath = GITHUB_FILE_PATH.split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  const contentUrl = `https://api.github.com/repos/${encodeURIComponent(
    GITHUB_OWNER
  )}/${encodeURIComponent(GITHUB_REPO)}/contents/${encodedPath}`;

  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };

  const lookupResponse = await fetch(`${contentUrl}?ref=${encodeURIComponent(GITHUB_BRANCH)}`, {
    headers,
  });

  if (!lookupResponse.ok) {
    const errorMessage = await readGitHubError(lookupResponse);
    throw new Error(`GitHub file lookup failed: ${errorMessage}`);
  }

  const lookup = await lookupResponse.json();
  const decodedContent = Buffer.from(String(lookup.content || "").replace(/\n/g, ""), "base64").toString("utf8");

  let plans;
  try {
    plans = JSON.parse(decodedContent);
  } catch (_) {
    throw new Error("Current training-plans.json is invalid JSON in GitHub.");
  }

  if (!plans || typeof plans !== "object") {
    plans = {};
  }

  if (!Array.isArray(plans.clients)) {
    plans.clients = [];
  }

  const clientIndex = plans.clients.findIndex((client) => client.id === submission.clientId);
  if (clientIndex === -1) {
    plans.clients.push(submission.updatedClient);
  } else {
    plans.clients[clientIndex] = submission.updatedClient;
  }

  plans.lastUpdated = new Date().toISOString().slice(0, 10);

  const updatedContent = `${JSON.stringify(plans, null, 2)}\n`;
  const updateBody = {
    message: `approve plan update for ${submission.updatedClient?.profile?.clientName || submission.clientId}`,
    content: Buffer.from(updatedContent, "utf8").toString("base64"),
    sha: lookup.sha,
    branch: GITHUB_BRANCH,
  };

  const updateResponse = await fetch(contentUrl, {
    method: "PUT",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updateBody),
  });

  if (!updateResponse.ok) {
    const errorMessage = await readGitHubError(updateResponse);
    throw new Error(`GitHub publish failed: ${errorMessage}`);
  }

  const updateResult = await updateResponse.json();

  return {
    commitUrl: updateResult?.commit?.html_url || "",
    commitSha: updateResult?.commit?.sha || "",
  };
}

async function readGitHubError(response) {
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
