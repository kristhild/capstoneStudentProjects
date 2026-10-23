# Capstone Gallery (first draft, v2)

Purpose: Create a university-themed web gallery exhibiting student projects in order to connect students, professors, alumni, and UST community partners on projects students have made.

Members: Erica Ganske, Parnian Semsar, Kristina Hildebrandt

Fall 2026


A static website (HTML, CSS, JavaScript, no backend) that shows student capstone projects at the University of St. Thomas. Hosted on GitHub Pages.

## Files

```
index.html      Gallery (home): hero, search, department buttons, project cards
search.html     Search results: search, filters, sort
about.html      About Capstone page
projects.csv    THE LIST OF PROJECTS (edit this to add/delete projects)
css/style.css   Design, colors and fonts
js/main.js      Reads projects.csv and builds the pages
images/         Logo, hero photo and project pictures
```

## Add or delete a project

All changes happen in **`projects.csv`** on github.com:

1. Open `projects.csv` and click the **pencil icon**.
2. **Add:** add one line at the bottom. **Delete:** remove that project's line.
3. Click **Commit changes**. The site updates in about 1–2 minutes.

| Column | What to put |
|---|---|
| title | Project name |
| label | Small purple word above the title. Leave empty to show the semester. `Placeholder` marks sample projects |
| students | Student names, e.g. `Student A · Student B` |
| team | Team name (optional) |
| department | e.g. `Engineering`. Used for the department buttons, filter and menu |
| semester | e.g. `Spring 2026`. Used for sorting and the semester filter |
| type | e.g. `Prototype`, `Research`, `Publication`, `Creative work` |
| partner | Community partner name, or empty if none |
| advisor | Faculty advisor |
| summary | One short sentence shown at the top of the project |
| overview, purpose, process, outcomes | The four sections of the project page |
| image | Cover picture, e.g. `images/my-project.jpg`. Empty = placeholder artwork |
| cover_style | Placeholder artwork color: `mist`, `deep`, `cream` or `lavender` (only used when there's no image) |
| cover_text | Words on the placeholder artwork. Use `\|` for a new line |
| cover_size | Card shape: width ÷ height, e.g. `0.8` (tall), `1` (square). Empty = picture's own shape |
| more_images | Pictures for "A closer look", separated by `\|` |
| report, presentation, website | Links (PDF or website). Empty = not shown |

Notes:
- If text contains a comma, wrap it in quotes: `"Water, reconsidered"`.
- Upload pictures and PDFs to the `images` folder (or a `files` folder) first, then use their path.
- Text in `[brackets]` is placeholder text from the design. Real projects don't need brackets.
- The order of the department buttons is set at the top of `js/main.js` (`DEPARTMENT_ORDER`).
- Each project has its own link you can share, e.g. `index.html?project=water-reconsidered`.

## Run locally

VS Code **Live Server** (right-click `index.html` → Open with Live Server), or run `python3 -m http.server 8001` in this folder and open http://localhost:8001.

## Publish

Repo **Settings → Pages → Deploy from a branch → main → / (root)**.

## TODO

- [ ] Replace placeholder projects and photos with real ones
- [ ] Confirm official UST colors and fonts with University Marketing
- [ ] Approved text for the About page
- [ ] Change the Add/Delete approach
