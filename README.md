# invictus-quiz

Registration landing page + child personality quiz for انفكتوس فايتر, served at https://join.invictus-ksa.info (Hostinger auto-deploys `main` into `public_html/join`).

- Edit `src/form.html`, `src/quiz.html`, `src/quiz-data.js`, then run `python3 build.py` (generates `/`, `/snap`, `/insta`, `/google`, `/quiz`).
- Pixel IDs per page: `PAGES` in `build.py`.
- Backend URL: `assets/config.js` (`endpoint`). Empty = demo mode, nothing is saved.
- Backend code: `apps-script/` (Google Apps Script web app, writes to the "مايو" sheet A:H + I:L, results in a separate file).
