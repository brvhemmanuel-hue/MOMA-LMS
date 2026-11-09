# MOMA LMS

A learning management system built for **Mount Olivet Methodist Academy**
(Dansoman-Accra) - quizzes, class exercises, and shared learning materials
for teachers and students.

---

## Stack

- **Frontend:** React (Vite), deploy to **Vercel** - also a fully configured PWA, installable on mobile via [PWA Builder](https://www.pwabuilder.com)
- **Backend:** Node.js / Express, deploy to **Vercel** as a serverless function
- **Database:** Neon (Postgres)
- **File storage:** Vercel Blob (quiz uploads, exercise attachments/submissions, learning materials)

Full deployment walkthrough: **[DEPLOYMENT.md](./DEPLOYMENT.md)**.

---

## Roles

- **Admin**: school-wide oversight - dashboard with totals across every class, every registered student and teacher, and read access to every quiz's and exercise's results (not just their own). Can manage classes and the student roster too, but doesn't author quizzes or exercises - that stays with teachers.
- **Teacher**: creates classes (which then appear in the class dropdown when students sign up), builds and schedules quizzes, sets class exercises, shares learning materials, grades short-answer questions and exercise submissions, views/edits/deletes students in their own classes, and can download an Excel report of results for any quiz or exercise.
- **Student**: picks their class at signup, takes quizzes published for their class, submits exercises, downloads shared materials, and can see their own grades and past attempts.

A student only ever sees their own class's content. A teacher's view of students, quizzes, exercises, and materials is scoped to the classes they're associated with (created, or have set content for). The admin account isn't scoped to any class - it sees everything.

### The seeded admin account

```
Email:    admin@gmail.com
Password: admin123
```

**Change this password immediately after your first login** (Settings → Change password) - this is a well-known default, not something to leave as-is on a real deployment.

---

## Accounts and approval

Anyone can register as a teacher or a student, but **nobody can sign in until the admin approves the account**. New registrations appear under **Approvals** (the admin sees a gold count on the menu and a banner on the dashboard), where the admin can approve or reject each one. A rejected person can simply register again with corrected details.

## Quiz features

- **One question per page** - students move with Previous and Next, see how many they have answered, and can jump to any question. A confirmation shows any unanswered questions before they submit. Answers are saved in the browser as they go, so a refresh does not lose them.
- **Shuffled questions (optional)** - each student gets the questions in their own order, but their numbers always run 1, 2, 3 in sequence. The order is fixed for an attempt, so it survives a refresh and matches the review screen and the PDF.
- **Pictures in questions** - attach a PNG or JPEG to any question while building the quiz, or put the picture straight into the Word template. Large photos are shrunk automatically before they upload.
- **Shared quiz clock (optional)** - for timed quizzes the teacher can make everyone share one clock. The timer starts when the first student begins, a student who starts later only gets the time that is left, and nobody can start once it has run out. The results page shows the clock and has a "Reset clock for a new sitting" button. Without this option every student still gets their own full time.
- **Read-only copy mode (optional)** - when switched on for a quiz, students get a "Read-only (copy)" view that lists every question with its answer choices as plain text, with a copy button for each question and one for the whole quiz (the correct answers are never shown). When it is off, selecting and copying the quiz text is blocked. This is a deterrent in the browser, not a guarantee: a determined student can still photograph the screen.
- **Results PDF for students** - after submitting, a student can download a PDF with the school crest and name, their own name, the quiz title, their score, and every question with their answer and the correct answer marked.

- **Manual question builder** - multiple choice, true/false, or short answer, with per-question points.
- **Upload questions from Word** - download a template, fill it in, upload it; questions are parsed and dropped straight into the (still editable) question list. Anything the parser couldn't understand is flagged with a clear reason, not silently dropped.
- **Scheduling** - set an exact opening date/time and closing date/time, or leave either blank for "always open" / "no deadline".
- **Time limits** - an optional countdown in minutes; the quiz auto-submits when time runs out.
- **Attempt limits** - unlimited, or a fixed number of attempts per student (the gradebook shows their best score across all attempts).
- **Auto-grading** - multiple choice and true/false grade themselves instantly. Short answer questions wait for the teacher to review and score them.
- **Gradebook + Excel export** - every student in the class listed with attempts used, best score, and status (not attempted / pending grading / graded), with a one-click styled `.xlsx` download.

## Exercise features

- File attachments both ways: teachers can attach a brief/handout, students upload their submission.
- Grading with a numeric score and optional written feedback.
- Same Excel export pattern as quizzes.

---

## Project structure

```
moma-lms/
├── DEPLOYMENT.md
├── database/schema.sql
├── backend/     # Express API → Vercel serverless
└── frontend/    # React + Vite PWA → Vercel
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full breakdown of each folder.

## Running locally

```bash
# backend
cd backend
cp .env.example .env   # fill in DATABASE_URL, JWT_SECRET, BLOB_READ_WRITE_TOKEN
npm install
npm run dev              # http://localhost:4000

# frontend
cd frontend
cp .env.example .env     # VITE_API_URL=http://localhost:4000
npm install
npm run dev               # http://localhost:5173
```

## Getting started after deploying

1. Register the **first account as a teacher**.
2. Go to **Classes** and create your school's actual classes (e.g. "Basic 6A", "JHS 2B") - delete the seeded "Demo Class" once you have real ones.
3. Students can now register and will see your classes in the dropdown.
4. Create a quiz or exercise, selecting the class it's for.
5. Log in as the seeded admin account (`admin@gmail.com` / `admin123`) to see the school-wide dashboard, and **change that password immediately** from Settings.
