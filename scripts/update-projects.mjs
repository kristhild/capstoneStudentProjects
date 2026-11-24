// Builds data/projects.json from the repo's approved project issues.
// Run by .github/workflows/update-projects.yml 
//
// How it works:
//  1. Reads every OPEN issue that has the "approved" label.
//  2. Reads the answers from the "Add a capstone project" form.
//  3. Checks the answers. A project with a problem is skipped (and the issue gets a comment),
//     so one mistake can never break the website.
//  4. Downloads the pictures into images/projects/ and writes data/projects.json.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";

const TOKEN = process.env.GITHUB_TOKEN;
const REPO = process.env.REPO;                    // "owner/name"
const EVENT_ACTION = process.env.EVENT_ACTION || "";
const EVENT_LABEL = process.env.EVENT_LABEL || "";
const ISSUE_NUMBER = Number(process.env.ISSUE_NUMBER) || 0;

const API = process.env.GITHUB_API_URL || "https://api.github.com";
const APPROVED = "approved";
const SUBMISSION = "project submission";
const OUT_FILE = "data/projects.json";
const IMG_DIR = "images/projects";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

// Form question (### heading) -> field name in projects.json
const FIELDS = {
  "Project title": "title",
  "Student names": "students",
  "Team name": "team",
  "Department": "department",
  "Semester": "semester",
  "Project type": "type",
  "Faculty advisor": "advisor",
  "Community partner": "partner",
  "Short summary": "summary",
  "Overview": "overview",
  "Purpose": "purpose",
  "Development process": "process",
  "Outcomes and reflection": "outcomes",
  "Cover picture": "image",
  "More pictures": "more_images",
  "Report link": "report",
  "Presentation link": "presentation",
  "Project website link": "website",
  "Permission": "consent",
};

/* ---------- GitHub API ---------- */
async function gh(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (!res.ok && res.status !== 422) throw new Error(`GitHub API ${res.status} on ${path}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

async function ensureLabel(name, color, description) {
  await gh(`/repos/${REPO}/labels`, { method: "POST", body: JSON.stringify({ name, color, description }) }); // 422 = already exists
}

async function approvedIssues() {
  const all = [];
  for (let page = 1; ; page++) {
    const batch = await gh(`/repos/${REPO}/issues?state=open&labels=${encodeURIComponent(APPROVED)}&per_page=100&page=${page}`);
    all.push(...batch.filter(i => !i.pull_request));
    if (batch.length < 100) return all;
  }
}

async function comment(number, body) {
  // Don't post the same message twice in a row.
  const comments = await gh(`/repos/${REPO}/issues/${number}/comments?per_page=100`);
  const last = [...comments].reverse().find(c => c.user?.type === "Bot");
  if (last && last.body.trim() === body.trim()) return;
  await gh(`/repos/${REPO}/issues/${number}/comments`, { method: "POST", body: JSON.stringify({ body }) });
}

/* ---------- Reading the form ---------- */
export function parseForm(body) {
  const answers = {};
  const parts = (body || "").replace(/\r\n/g, "\n").split(/^###\s+/m).slice(1);
  for (const part of parts) {
    const nl = part.indexOf("\n");
    const heading = (nl < 0 ? part : part.slice(0, nl)).trim();
    const key = FIELDS[heading];
    if (!key) continue;
    let value = (nl < 0 ? "" : part.slice(nl + 1)).trim();
    if (value === "_No response_" || value === "None") value = "";
    answers[key] = value;
  }
  return answers;
}

// Finds picture links 
export function imageUrls(text) {
  const urls = [];
  const re = /!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)|<img[^>]*\ssrc=["'](https?:\/\/[^"']+)["']|(https?:\/\/\S+\.(?:png|jpe?g|gif|webp))/gi;
  let m;
  while ((m = re.exec(text || ""))) urls.push(m[1] || m[2] || m[3]);
  return [...new Set(urls)];
}

const oneLine = s => (s || "").replace(/\s+/g, " ").trim();
const isLink = s => /^https?:\/\/\S+$/i.test(s);

export function check(a) {
  const problems = [];
  if (!oneLine(a.title)) problems.push("**Project title** is empty.");
  if (oneLine(a.title).length > 120) problems.push("**Project title** is longer than 120 characters.");
  if (!oneLine(a.students)) problems.push("**Student names** is empty.");
  if (!oneLine(a.department)) problems.push("**Department** is not chosen.");
  if (!/^(Spring|Summer|Fall|Winter) \d{4}$/i.test(oneLine(a.semester)))
    problems.push(`**Semester** should look like "Fall 2026" (it says "${oneLine(a.semester) || "nothing"}").`);
  if (!oneLine(a.type)) problems.push("**Project type** is not chosen.");
  if (!oneLine(a.summary)) problems.push("**Short summary** is empty.");
  for (const [key, label] of [["report", "Report link"], ["presentation", "Presentation link"], ["website", "Project website link"]]) {
    const v = oneLine(a[key]);
    if (v && !isLink(v)) problems.push(`**${label}** should be a full link starting with https://`);
  }
  if (!/-\s*\[x\]/i.test(a.consent || "")) problems.push("The **Permission** box is not checked.");
  return problems;
}

/* ---------- Pictures ---------- */
const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp" };

async function savePicture(url, issueNumber) {
  const hash = createHash("sha1").update(url).digest("hex").slice(0, 10);
  for (const ext of Object.values(EXT)) {
    const existing = `${IMG_DIR}/${issueNumber}-${hash}.${ext}`;
    if (existsSync(existing)) return existing; // already downloaded on an earlier run
  }
  try {
    // GitHub's own attachment links accept the repo token; other sites are fetched without it.
    const headers = new URL(url).hostname === "github.com" ? { Authorization: `Bearer ${TOKEN}` } : {};
    const res = await fetch(url, { headers, redirect: "follow" });
    const type = (res.headers.get("content-type") || "").split(";")[0].trim();
    if (!res.ok || !EXT[type]) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_IMAGE_BYTES) return null;
    const file = `${IMG_DIR}/${issueNumber}-${hash}.${EXT[type]}`;
    writeFileSync(file, buf);
    return file;
  } catch {
    return null;
  }
}

/* ---------- Main ---------- */
async function main() {
  if (!TOKEN || !REPO) throw new Error("GITHUB_TOKEN and REPO must be set (this runs inside GitHub Actions).");
  mkdirSync(IMG_DIR, { recursive: true });
  await ensureLabel(APPROVED, "2EA44F", "Show this project on the gallery");
  await ensureLabel(SUBMISSION, "8348AD", "Submitted with the Add a capstone project form");

  const issues = await approvedIssues();
  const projects = [];
  const results = {}; // issue number -> { problems, warnings }

  for (const issue of issues.sort((a, b) => b.number - a.number)) {
    const a = parseForm(issue.body);
    if (!Object.keys(a).length) continue; // not a project form (e.g. a normal issue someone labeled)
    const problems = check(a);
    const warnings = [];
    if (problems.length) { results[issue.number] = { problems, warnings }; continue; }

    const cover = imageUrls(a.image)[0];
    let image = "";
    if (cover) {
      image = (await savePicture(cover, issue.number)) || "";
      if (!image) warnings.push("The cover picture could not be downloaded, so the placeholder artwork is shown instead.");
    }
    const more = [];
    for (const url of imageUrls(a.more_images).slice(0, 4)) {
      const file = await savePicture(url, issue.number);
      if (file) more.push(file); else warnings.push("One of the extra pictures could not be downloaded and was skipped.");
    }

    projects.push({
      title: oneLine(a.title),
      label: "",
      students: oneLine(a.students),
      team: oneLine(a.team),
      department: oneLine(a.department),
      semester: oneLine(a.semester).replace(/^\w/, c => c.toUpperCase()),
      type: oneLine(a.type),
      partner: oneLine(a.partner),
      advisor: oneLine(a.advisor),
      summary: oneLine(a.summary),
      overview: (a.overview || "").trim(),
      purpose: (a.purpose || "").trim(),
      process: (a.process || "").trim(),
      outcomes: (a.outcomes || "").trim(),
      image,
      cover_style: "",
      cover_text: "",
      cover_size: "",
      more_images: more.join("|"),
      report: oneLine(a.report),
      presentation: oneLine(a.presentation),
      website: oneLine(a.website),
      issue: issue.number,
    });
    results[issue.number] = { problems, warnings };
  }

  const json = JSON.stringify(projects, null, 2) + "\n";
  const before = existsSync(OUT_FILE) ? readFileSync(OUT_FILE, "utf8") : "";
  if (json !== before) writeFileSync(OUT_FILE, json);
  console.log(`${projects.length} approved project(s) written to ${OUT_FILE}.`);

  // Tell the person on the issue what happened (never fails the run).
  if (!ISSUE_NUMBER || EVENT_ACTION === "deleted") return;
  try { await notify(results); } catch (err) { console.warn("Could not comment on the issue:", err.message); }
}

async function notify(results) {
  const issue = await gh(`/repos/${REPO}/issues/${ISSUE_NUMBER}`);
  const labels = (issue.labels || []).map(l => (typeof l === "string" ? l : l.name));
  const isApproved = issue.state === "open" && labels.includes(APPROVED);
  const isSubmission = labels.includes(SUBMISSION) || Object.keys(parseForm(issue.body)).length > 0;
  if (!isSubmission) return;

  if (EVENT_ACTION === "opened" && !isApproved) {
    await comment(ISSUE_NUMBER, "Thanks for submitting your project! An admin will review it. It will appear on the gallery after it gets the **approved** label.");
  } else if (isApproved && ["labeled", "edited", "reopened", "opened"].includes(EVENT_ACTION)) {
    const r = results[ISSUE_NUMBER];
    if (r?.problems.length) {
      await comment(ISSUE_NUMBER, "⚠️ This project could not be added to the gallery yet. Please **edit the issue** to fix:\n\n" +
        r.problems.map(p => `- ${p}`).join("\n") + "\n\nThe gallery updates automatically after you save.");
    } else if (r) {
      await comment(ISSUE_NUMBER, "✅ This project is now on the gallery. It can take a minute or two to show up." +
        (r.warnings.length ? "\n\nNote:\n" + r.warnings.map(w => `- ${w}`).join("\n") : ""));
    }
  } else if ((EVENT_ACTION === "unlabeled" && EVENT_LABEL === APPROVED) || EVENT_ACTION === "closed") {
    await comment(ISSUE_NUMBER, "This project was removed from the gallery. Add the **approved** label again (and reopen the issue if it's closed) to bring it back.");
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => { console.error(err); process.exit(1); });
}
