# Interview Prep — Visual content editor

Use this editor to update **city page content** without editing JSON by hand.

**You can edit:** Amsterdam, Austin, Chicago, London, New York City, San Francisco, Virtual, Warsaw  
**Locked:** Redwood City (your teammate owns that page on `main`)

---

## Start the editor (every time you work)

1. Open **Cursor** with your `candidate-portal` project.
2. Top menu → **Terminal** → **New Terminal**.
3. Copy and paste these two lines, pressing **Return** after each:

```bash
cd interview-prep-guide
npm run editor
```

4. Leave that terminal window open while you work.
5. Open your web browser and go to:

**http://localhost:3456**

You should see the editor: form fields on the left, live preview on the right.

To stop the editor later: click the terminal and press **Ctrl + C**.

---

## Edit a city (visual — recommended)

1. At the top left, open the **City page** dropdown and pick a city (not Redwood City).
2. On the **preview** (right side), **click any text** you want to change — city name, address, parking bullets, etc.
3. Type your changes directly on the page.
4. Click outside the text (or press Tab) when you are done with that field.
5. Click **Save changes** (top right) to write your updates to the `.json` files.

Editable text is highlighted with a dashed blue outline when you hover over it.

### Optional: form fields

Click **Show form fields** if you prefer a traditional form (left sidebar) instead of clicking on the preview. Both methods update the same JSON files.

---

## Edit a city (form fields)

1. Click **Show form fields**.
2. Expand each section (Hero, Address, Parking & transit, etc.).
3. Type in the fields.
4. Click **Save changes**.

---

## Save your work

1. Click **Save changes** (top right).
2. Wait for the green message: *Saved to JSON + HTML (Redwood City unchanged)*.

This updates:

- the `.json` content file for that city
- that city’s `.html` page

It does **not** rebuild Redwood City.

---

## Push to GitHub

After you save one or more cities:

1. In Cursor, click **Source Control** (branch icon on the left).
2. You should see changed files under `interview-prep-guide/content/locations/` and `interview-prep-guide/locations/`.
3. Type a short message, e.g. `Update Amsterdam and Austin content`.
4. Click **Commit**.
5. Click **Sync Changes** or **Publish Branch** to send to GitHub.

---

## Tips

- **Redwood City** in the dropdown is preview-only — use it to compare layout, but edit other cities.
- **Rebuild all pages** refreshes every city HTML file except Redwood City. You usually only need **Save changes** per city.
- If the preview looks stale, click **Refresh**.
- Use **Desktop / Mobile** toggles to check how the page looks on a phone.

---

## If something goes wrong

| Problem | What to do |
|--------|------------|
| Browser says “can’t connect” | Make sure `npm run editor` is still running in the terminal |
| `command not found: npm` | Install Node.js from https://nodejs.org, then try again |
| Preview is blank | Hard-refresh the page (**Cmd + Shift + R**), pick a city from the dropdown, then click **Refresh** |
| Accidentally closed terminal | Run `cd interview-prep-guide` and `npm run editor` again |

For layout changes (colors, spacing, Redwood City design), your teammate handles that separately on `main`.
