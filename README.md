# Silent Doubt Wall

**An anonymous classroom confusion tracker.** Students post doubts without revealing who they are, similar doubts are grouped automatically (even when worded differently), and the teacher sees the top confusion points of each lecture along with an AI-drafted re-explanation.

🔗 **Live demo:** https://silent-doubt-wall.vercel.app
🏆 **Second Place**, CodeZenith 2026 (BCA internal hackathon, Dayananda Sagar College of Arts, Science & Commerce)

## Why this exists

In most classrooms, students stay quiet when they are confused because they don't want to look slow in front of everyone. The teacher moves on without knowing which concept lost the room. Silent Doubt Wall gives students a safe, anonymous way to say "I don't get this" and gives teachers a clear, ranked picture of what to re-explain.

## Features

### For students
- Join a class with a **class code, a link, or a QR code**. No account and no name needed.
- Post doubts **anonymously**. Each browser gets a random session ID that is never linked to a name or account.
- See doubts grouped into confusion points, and react with **Me too**, **Still confused** or **Understood**.
- Read the explanation the teacher publishes for each confusion point.
- Built-in protection: length limits (10–500 characters), a profanity and spam filter, and rate limiting.

### For teachers
- Sign up and log in with **email and password or Google**.
- Create **classes and lectures**, and share the join link and QR code with students.
- A live lecture board showing the **Top 3 confusion points**, ranked by number of doubts, "Me too" votes and "Still confused" votes (counted double).
- **AI re-explanations** generated with Gemini in different styles (default, simpler, analogy, code). Edit the draft, then publish it to the class.
- **Lecture-wise history** charts comparing doubts, votes and comprehension across lectures.

## How the grouping works

1. Every new doubt is converted into an embedding with Gemini (`gemini-embedding-001`, 768 dimensions).
2. It is compared with existing confusion points in the same lecture using cosine similarity.
3. Near-duplicates join the matching group automatically. Borderline matches are checked by a Gemini "judge" prompt that decides whether it is the same specific concept or a different one.
4. If nothing matches, a new group is created and given a short AI-generated label.

This is why "How does Flask know which function to run for a URL?" and "What does the route decorator do?" end up in the same group.

## Tech stack

| Area | Technology |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS 4 |
| Database and auth | Supabase (PostgreSQL, Auth, Google OAuth) |
| AI | Google Gemini API (embeddings and text generation) |
| Charts and QR | Recharts, qrcode.react |
| Hosting | Vercel |

## Project structure

```
app/            Pages and API routes (doubts, clusters, upvotes, teacher history)
components/     StudentView, LectureBoard, ClassManager, AuthForm
lib/            Gemini client, cluster judge, filter, rate limiter, constants
utils/          Supabase clients and anonymous session helper
scripts/        seed.mjs for loading sample doubts
```

## Getting started

Requires Node.js 20 or later, a Supabase project and a Gemini API key.

```bash
git clone https://github.com/Sushen119/silent-doubt-wall.git
cd silent-doubt-wall
npm install
```

Create a `.env.local` file in the project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Never commit these keys. `.env*` files are already in `.gitignore`.

Start the dev server:

```bash
npm run dev
```

Open http://localhost:3000.

To test the grouping with sample doubts (with the dev server running):

```bash
node scripts/seed.mjs <CLASS_CODE>
```

> The Supabase tables the app uses (for example `classes`, `lectures` and `clusters`) need to exist in your project. A schema file is not included in this repo yet.

## Known limitations and next steps

- Rate limiting is in-memory per server instance. A shared store such as Redis would be needed in production.
- The profanity filter is a simple word list.
- Add a database schema file so the project can be set up in one step.

## Team

Built at CodeZenith 2026 by:

- **Sushen Sameer S** ([@Sushen119](https://github.com/Sushen119))
-  *Pranav Athreya** ([@pranavathreya24](https://github.com/pranavathreya24))
- **Shashank MS** ([@ShashankMS206](https://github.com/ShashankMS206))
