# Key Tag Studio (clone)

Full designer + admin. Uses **Pollinations.ai** (free) for AI backgrounds — no OpenAI key.

## Features
- Designer: upload, AI backgrounds (3 options), text lines, drag on canvas, submit
- Admin: login, approve/reject/delete submissions
- API compatible shape with original (`/api/designer/generate-background`)

## Quick start (needs Node 18+)
```bash
cd key-tag-studio
cp .env.example .env
npm install
npx prisma db push
npm run db:seed
npm run dev
```
Open http://localhost:3000

**Admin:** http://localhost:3000/admin/login  
Default: `admin@example.com` / `password@123456`

## Free deploy (Render)
1. Push this folder to GitHub
2. Create **Render Web Service** → connect repo
3. Build: `npm install && npx prisma db push && npm run db:seed && npm run build`
4. Start: `npm start`
5. Add env vars from `.env.example` (change `JWT_SECRET` + admin password)

SQLite file persists on Render disk.

## Change admin password
Edit `.env` then run `npm run db:seed` again.
