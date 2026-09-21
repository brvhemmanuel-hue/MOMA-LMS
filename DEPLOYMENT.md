# Deploying MOMA LMS

Three pieces: **Neon** (database), **Vercel** (backend, as a serverless
function), **Vercel** again (frontend, static build), plus **Vercel Blob**
for file storage (quiz template uploads, exercise attachments/submissions,
learning materials). Then **PWA Builder** to package the frontend as an
installable mobile app.

---

## 1. Create the Neon database

1. [neon.tech](https://neon.tech) → create a project.
2. Open **SQL Editor**, paste in the entire contents of `database/schema.sql`, run it.
   This creates every table, seeds one starter "Demo Class" (rename or delete it once you've added real classes), and seeds the admin account (`admin@gmail.com` / `admin123` - **change this password immediately after your first login**).
   - Already have a live database from a previous deploy and don't want to lose your data? Don't rerun the whole schema - instead run `database/migrations/001_add_admin_role.sql`, which just adds the admin role and seeds that one account.
3. **Connection Details** → copy the **pooled** connection string (host contains `-pooler`):
   ```
   postgresql://user:pass@ep-xxxx-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require
   ```
   Always use the pooled string for the backend - serverless functions can spin up many concurrent instances, and the pooled endpoint keeps that from exhausting Postgres' connection limit.

---

## 2. Deploy the backend to Vercel

1. Push this repo to GitHub.
2. Vercel → **Add New → Project** → import the repo → **Root Directory: `backend`**.
3. Framework preset: **Other**. No build step needed.
4. Environment variables:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | your Neon pooled connection string |
   | `JWT_SECRET` | generate with `openssl rand -base64 48` |
   | `JWT_EXPIRES_IN` | `12h` |
   | `CORS_ORIGINS` | leave blank for now |
   | `BLOB_READ_WRITE_TOKEN` | see step 3 below |

5. Deploy. Note the URL, e.g. `https://moma-lms-backend.vercel.app`. Check `/health` returns `{"status":"ok"}`.

### Enabling file uploads (Vercel Blob)

Quiz docx uploads, exercise attachments/submissions, and learning materials all need somewhere to live - the backend runs as a serverless function with no persistent disk, so files can't just be saved locally.

1. In the **backend** Vercel project → **Storage** tab → **Create Database** → **Blob**.
2. Once created, Vercel automatically adds `BLOB_READ_WRITE_TOKEN` to that project's environment variables - you don't need to paste one in yourself.
3. Redeploy the backend if it was already deployed before you created the store.

---

## 3. Deploy the frontend to Vercel

1. **Add New → Project** again, same repo, **Root Directory: `frontend`**.
2. Framework preset: **Vite** (auto-detected).
3. Environment variable:
   ```
   VITE_API_URL=https://moma-lms-backend.vercel.app
   ```
4. Deploy. Note the URL, e.g. `https://moma-lms.vercel.app`.
5. Back in the **backend** project, set `CORS_ORIGINS` to that frontend URL and redeploy:
   ```
   CORS_ORIGINS=https://moma-lms.vercel.app,http://localhost:5173
   ```
6. Visit the frontend, click **Create an account**, register as a **teacher** first, and create your school's real classes before any students sign up (the class dropdown on the student signup form is empty until a teacher creates at least one).

---

## Local development

```bash
# backend
cd backend
cp .env.example .env   # fill in DATABASE_URL, JWT_SECRET, BLOB_READ_WRITE_TOKEN
npm install
npm run dev             # http://localhost:4000

# frontend
cd frontend
cp .env.example .env    # VITE_API_URL=http://localhost:4000
npm install
npm run dev              # http://localhost:5173
```

For local file uploads to work, `BLOB_READ_WRITE_TOKEN` still needs to point at a real Vercel Blob store (copy it from the Vercel dashboard → Storage → your blob store → the `.env.local` tab) - Blob storage is a hosted service, not something that runs locally.

---

## 4. Packaging the mobile app with PWA Builder

The frontend is already a fully configured PWA (manifest, all icon sizes, offline shell via `vite-plugin-pwa`).

1. Make sure the frontend is deployed over HTTPS (Vercel does this automatically).
2. Go to [pwabuilder.com](https://www.pwabuilder.com), enter your deployed frontend URL, click **Start**.
3. It should score well across the board - manifest, icons, and service worker are already set up.
4. **Package for stores**:
   - **Android**: a signed Trusted Web Activity (`.aab`) for the Google Play Console (needs a $25 one-time Play Developer account).
   - **iOS**: an Xcode project (needs a Mac with Xcode and a $99/year Apple Developer account).
5. In the meantime, no store submission is required for people to use it as an app: Chrome/Edge on Android and desktop show an **Install** prompt automatically, and iOS Safari installs it via **Share → Add to Home Screen** - both give a full-screen app icon experience immediately after deployment.

---

## What's in each folder

```
moma-lms/
├── DEPLOYMENT.md
├── database/
│   └── schema.sql                 # run this once in the Neon SQL editor
├── backend/
│   ├── api/index.js               # Vercel serverless entry point
│   └── src/
│       ├── config/db.js           # Neon connection pool
│       ├── controllers/           # auth, classes, quizzes, quizAttempts, exercises, materials, dashboard
│       ├── middleware/            # JWT auth, multer file upload
│       ├── routes/
│       └── utils/
│           ├── docxQuizParser.js       # parses an uploaded Word doc into quiz questions
│           ├── docxTemplateGenerator.js # generates the downloadable blank template
│           ├── excelReport.js          # styled .xlsx gradebook exports
│           ├── blob.js                 # Vercel Blob upload/delete helper
│           └── asyncHandler.js
└── frontend/
    ├── public/
    │   ├── logo.png, logo-watermark.png    # the school emblem, cropped and a background-watermark version
    │   └── icons/                          # PWA icons, every required size
    └── src/
        ├── api/client.js
        ├── components/          # Layout, Button, Input, Badge, FileDropzone, QuestionEditor, CountdownTimer
        ├── context/AuthContext.jsx
        └── pages/               # Login, Register, Dashboard, Classes, Quizzes, QuizForm, QuizTake,
                                  # QuizGradebook, Exercises, ExerciseForm, ExerciseDetail, Materials, Settings, NotFound
```

## How the quiz Word-upload works

1. A teacher clicks **Download template** on the New Quiz page → gets a `.docx` with the exact format explained inline, plus three worked examples (multiple choice, true/false, short answer).
2. They fill it in following the pattern (`Q:`, `TYPE:`, options as `A)`/`B)`/etc., `ANSWER:`, `POINTS:`) and re-upload it.
3. The backend reads the document's text and turns each question into a structured question, showing the teacher exactly which ones it couldn't understand and why (e.g. "MCQ is missing an ANSWER line") — nothing is silently dropped.
4. Parsed questions land in the same editable question list used for building a quiz by hand, so the teacher can fix, reorder, or add to them before saving.

Everything from date/time scheduling to grading was built with this in mind: this is meant to feel like a real school LMS, not a demo.
