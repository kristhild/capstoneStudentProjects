# Capstone Gallery (first draft, v2)

Purpose: Create a university-themed web gallery exhibiting student projects in order to connect students, professors, alumni, and UST community partners on projects students have made.

Members: Erica Ganske, Parnian Semsar, Kristina Hildebrandt

Fall 2026


A static website (HTML, CSS, JavaScript, no backend) that shows student capstone projects at the University of St. Thomas. Hosted on GitHub Pages.

## Files

```
index.html                    Gallery (home): hero, search, department buttons, project cards
search.html                   Search results: search, filters, sort
about.html                    About Capstone page
data/projects.json            Real projects. Written automatically from approved GitHub issues, don't edit by hand
data/sample-projects.json     Placeholder projects. Delete this file when real projects are in
css/style.css                 Design, colors and fonts
js/main.js                    Reads the data files and builds the pages
images/                       Logo, hero photo and sample pictures
images/projects/              Project pictures, saved automatically
.github/ISSUE_TEMPLATE/       The "Add a capstone project" form
.github/workflows/            The automation that updates the gallery
scripts/update-projects.mjs   The script the automation runs
```

## Add, edit or remove a project (no coding)

Projects are managed with **GitHub Issues**. There is no file to edit, so a typo can't break the site.

**Add**
1. In this repo, go to **Issues → New issue → Add a capstone project**.
2. Fill in the form (title, names, department, semester, summary, pictures, links) and click **Create**.
3. An admin reviews it and adds the **approved** label. Within about a minute the project is on the gallery,
   and a comment on the issue confirms it.

**Edit:** open the project's issue, click **⋯ → Edit**, change the answers and save. The gallery updates automatically.

**Remove:** remove the **approved** label, or close the issue.

**If something is wrong** (for example the semester isn't written like "Fall 2026"), the project is not added and the
issue gets a comment listing what to fix. The rest of the gallery is never affected.

Notes:
- Only people with access to this repo can add the **approved** label, so nothing goes live without an admin.
- Students need a free GitHub account to use the form, or they can send their answers to the admin, who fills in the form for them.
- The department and project type choices are set in `.github/ISSUE_TEMPLATE/add-project.yml`.
- The order of the department buttons is set at the top of `js/main.js` (`DEPARTMENT_ORDER`).
- Each project has its own link you can share, e.g. `index.html?project=solar-bench`.
- To rebuild the gallery by hand: **Actions → Update gallery projects → Run workflow**.

## Run locally

VS Code **Live Server** (right-click `index.html` → Open with Live Server), or run `python3 -m http.server 8001` in this folder and open http://localhost:8001.

## Publish

Repo **Settings → Pages → Deploy from a branch → main → / (root)**.

## TODO

- [ ] Replace placeholder projects and photos with real ones
- [x] Confirm official UST colors and fonts with University Marketing
- [ ] Approved text for the About page
- [x] Change the Add/Delete approach (GitHub Issue form + automation)
