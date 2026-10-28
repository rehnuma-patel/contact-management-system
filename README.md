# ContactHub – Contact Management System

A contact management web app built with HTML, CSS and JavaScript. You can add, view, edit, delete and search contacts, and import or export them as JSON.

**Live demo:** https://rehnuma-patel.github.io/contact-management-system/

## Features
- **CRUD**: add, view, edit and delete contacts. Deleting asks for confirmation, and the toast that follows has an **Undo** button.
- **Form validation**: first name and phone are required. Phone (7–15 digits), email format and birthday (not in the future) are checked, and duplicate phone numbers or emails are blocked.
- **Avatar generator**: every contact gets a generated avatar in one of three styles: **Initials**, a symmetric **Pattern** (identicon) or an **Emoji**. Colours come from a hash of the name, and **Shuffle colors** picks a new palette.
- **Live search**: results update on every keystroke and matches are highlighted. You can search name, phone (digits only also work), email, company, job title, address, group and notes.
- **Filters and sorting**: groups (Family, Friends, Work, Other) and Favorites with counts. Sort by name, date added or company.
- **JSON import / export**: export downloads every contact as a `.json` file. Import checks the file, skips invalid records and lets you **Merge** (duplicates skipped) or **Replace** all contacts. Try it with [`sample-contacts.json`](sample-contacts.json).
- **Details view** with click-to-call, email links, copy-to-clipboard and a birthday countdown
- Stats cards, grid and list layouts, dark mode and keyboard shortcuts (`/` search, `N` new contact, `Esc` clear search)
- Data is saved in **localStorage**, so contacts are still there after a page refresh
- Responsive layout with a slide-in sidebar on mobile, plus accessible dialogs, labels and `aria-live` messages

## Technologies
HTML5 · CSS3 (Grid, Flexbox, custom properties) · JavaScript (ES6+, Array methods `filter`/`map`/`sort`/`find`/`findIndex`/`some`/`every`/`reduce`, `<dialog>`, FileReader/Blob APIs, Web Storage API)

## Project structure
```
index.html            Layout, form and dialogs
css/style.css         Styles, themes and responsive rules
js/avatar.js          Avatar generator (initials, pattern, emoji)
js/store.js           Data layer: CRUD, validation of imported data, localStorage
js/app.js             Rendering, live search, filters, forms, import/export
sample-contacts.json  Example file to test importing
```

## Run locally
Open `index.html` in a browser. No build step or server is needed.

## Author
Rehnuma Patel – [GitHub](https://github.com/rehnuma-patel)
