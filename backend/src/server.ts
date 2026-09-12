import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.ts";

const app = express();
const port = Number(process.env.PORT ?? 4000);
const jwtSecret = process.env.JWT_SECRET ?? "change-me-in-production";
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

type AuthRequest = Request & { user?: { id: string; role: string } };
app.use(cors({ origin: process.env.FRONTEND_URL || true }));
app.use(express.json({ limit: "1mb" }));

function signUser(user: { id: string; role: string }) {
  return jwt.sign({ id: user.id, role: user.role }, jwtSecret, { expiresIn: "7d" });
}

function auth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Authentication required" });
  try {
    req.user = jwt.verify(token, jwtSecret) as { id: string; role: string };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function roles(...allowed: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !allowed.includes(req.user.role)) return res.status(403).json({ error: "Insufficient permissions" });
    next();
  };
}

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.get("/.well-known/appspecific/com.chrome.devtools.json", (_req, res) => res.status(204).end());
app.get("/docs/openapi.json", async (_req, res, next) => {
  try { res.type("application/json").send(await readFile(path.join(process.cwd(), "docs", "openapi.json"), "utf8")); }
  catch (error) { next(error); }
});
app.get("/docs", (_req, res) => res.json({ openapi: "/docs/openapi.json", description: "Northstar Job Portal API documentation" }));

app.post("/auth/register", async (req, res, next) => {
  try {
    const { name, email, password, role = "CANDIDATE", companyName } = req.body;
    if (!name || !email || !password || password.length < 8) return res.status(400).json({ error: "Name, email and an 8+ character password are required" });
    if (!["CANDIDATE", "EMPLOYER"].includes(role)) return res.status(400).json({ error: "Invalid registration role" });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name, email: email.toLowerCase(), passwordHash, role, company: role === "EMPLOYER" && companyName ? { create: { name: companyName } } : undefined },
      select: { id: true, name: true, email: true, role: true },
    });
    res.status(201).json({ user, token: signUser(user) });
  } catch (error: any) {
    if (error.code === "P2002") return res.status(409).json({ error: "Email already registered" });
    next(error);
  }
});

app.post("/auth/login", async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { email: String(req.body.email ?? "").toLowerCase() } });
    if (!user || !(await bcrypt.compare(req.body.password ?? "", user.passwordHash))) return res.status(401).json({ error: "Invalid email or password" });
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role }, token: signUser(user) });
  } catch (error) { next(error); }
});

app.get("/jobs", async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page ?? 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit ?? 20), 1), 100);
    const search = String(req.query.search ?? "");
    const where: any = { status: "OPEN" };
    if (search) where.OR = [{ title: { contains: search, mode: "insensitive" } }, { description: { contains: search, mode: "insensitive" } }, { location: { contains: search, mode: "insensitive" } }];
    if (req.query.location) where.location = { contains: String(req.query.location), mode: "insensitive" };
    if (req.query.workMode) where.workMode = req.query.workMode;
    if (req.query.employmentType) where.employmentType = req.query.employmentType;
    const [jobs, total] = await Promise.all([
      prisma.job.findMany({ where, include: { company: true }, orderBy: { postedDate: "desc" }, skip: (page - 1) * limit, take: limit }),
      prisma.job.count({ where }),
    ]);
    res.json({ data: jobs, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
});

app.get("/jobs/:id", async (req, res, next) => {
  try {
    const job = await prisma.job.findUnique({ where: { id: req.params.id }, include: { company: true, applications: { select: { id: true } } } });
    if (!job) return res.status(404).json({ error: "Job not found" });
    res.json(job);
  } catch (error) { next(error); }
});

app.get("/employer/jobs", auth, roles("EMPLOYER", "ADMIN"), async (req: AuthRequest, res, next) => {
  try {
    const where = req.user!.role === "ADMIN" ? {} : { employerId: req.user!.id };
    const jobs = await prisma.job.findMany({
      where,
      include: { company: true, _count: { select: { applications: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(jobs);
  } catch (error) { next(error); }
});

app.post("/jobs", auth, roles("EMPLOYER", "ADMIN"), async (req: AuthRequest, res, next) => {
  try {
    const { companyId, ...input } = req.body;
    const company = companyId ?? (await prisma.company.findUnique({ where: { ownerId: req.user!.id } }))?.id;
    if (!company) return res.status(400).json({ error: "An employer company is required" });
    const job = await prisma.job.create({ data: { ...input, companyId: company, employerId: req.user!.id } });
    res.status(201).json(job);
  } catch (error) { next(error); }
});

app.put("/jobs/:id", auth, roles("EMPLOYER", "ADMIN"), async (req: AuthRequest, res, next) => {
  try {
    const owned = req.user!.role === "ADMIN" ? true : await prisma.job.count({ where: { id: req.params.id, employerId: req.user!.id } });
    if (!owned) return res.status(404).json({ error: "Job not found" });
    res.json(await prisma.job.update({ where: { id: req.params.id }, data: req.body }));
  } catch (error) { next(error); }
});

app.delete("/jobs/:id", auth, roles("EMPLOYER", "ADMIN"), async (req: AuthRequest, res, next) => {
  try {
    const owned = req.user!.role === "ADMIN" ? true : await prisma.job.count({ where: { id: req.params.id, employerId: req.user!.id } });
    if (!owned) return res.status(404).json({ error: "Job not found" });
    await prisma.job.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (error) { next(error); }
});

app.post("/jobs/:id/apply", auth, roles("CANDIDATE"), async (req: AuthRequest, res, next) => {
  try {
    const application = await prisma.application.create({ data: { jobId: req.params.id, candidateId: req.user!.id, coverLetter: req.body.coverLetter, resumeUrl: req.body.resumeUrl } });
    res.status(201).json(application);
  } catch (error: any) {
    if (error.code === "P2002") return res.status(409).json({ error: "You have already applied to this job" });
    next(error);
  }
});

app.post("/jobs/:id/save", auth, roles("CANDIDATE"), async (req: AuthRequest, res, next) => {
  try { res.status(201).json(await prisma.savedJob.create({ data: { jobId: req.params.id, candidateId: req.user!.id } })); }
  catch (error: any) { if (error.code === "P2002") return res.status(409).json({ error: "Job already saved" }); next(error); }
});

app.get("/applications", auth, async (req: AuthRequest, res, next) => {
  try {
    const where = req.user!.role === "CANDIDATE" ? { candidateId: req.user!.id } : req.user!.role === "ADMIN" ? {} : { job: { employerId: req.user!.id } };
    res.json(await prisma.application.findMany({ where, include: { job: { include: { company: true } }, candidate: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "desc" } }));
  } catch (error) { next(error); }
});

app.put("/applications/:id/status", auth, roles("EMPLOYER", "ADMIN"), async (req: AuthRequest, res, next) => {
  try {
    const allowedStatuses = ["APPLIED", "REVIEWING", "SHORTLISTED", "REJECTED", "HIRED"];
    const status = String(req.body.status ?? "");
    if (!allowedStatuses.includes(status)) return res.status(400).json({ error: "Invalid application status" });
    const application = await prisma.application.findUnique({ where: { id: req.params.id }, include: { job: true } });
    if (!application || (req.user!.role !== "ADMIN" && application.job.employerId !== req.user!.id)) return res.status(404).json({ error: "Application not found" });
    const updated = await prisma.application.update({ where: { id: application.id }, data: { status: status as any }, include: { job: { include: { company: true } }, candidate: { select: { id: true, name: true, email: true } } } });
    res.json(updated);
  } catch (error) { next(error); }
});

app.get("/dashboard", auth, async (req: AuthRequest, res, next) => {
  try {
    if (req.user!.role === "ADMIN") {
      const [users, jobs, companies, applications, scrapedToday, analyticsJobs] = await Promise.all([
        prisma.user.count(),
        prisma.job.count(),
        prisma.company.count(),
        prisma.application.count(),
        prisma.job.count({ where: { scrapedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
        prisma.job.findMany({ select: { skills: true, location: true, company: { select: { name: true } } } }),
      ]);
      const skillCounts = new Map<string, number>();
      const companyCounts = new Map<string, number>();
      const locationCounts = new Map<string, number>();
      for (const job of analyticsJobs) {
        for (const skill of job.skills) skillCounts.set(skill, (skillCounts.get(skill) ?? 0) + 1);
        companyCounts.set(job.company.name, (companyCounts.get(job.company.name) ?? 0) + 1);
        locationCounts.set(job.location, (locationCounts.get(job.location) ?? 0) + 1);
      }
      const top = (counts: Map<string, number>) => [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));
      return res.json({ users, jobs, companies, applications, scrapedToday, topSkills: top(skillCounts), topCompanies: top(companyCounts), topLocations: top(locationCounts) });
    }
    if (req.user!.role === "EMPLOYER") return res.json({ jobs: await prisma.job.count({ where: { employerId: req.user!.id } }), applications: await prisma.application.count({ where: { job: { employerId: req.user!.id } } }) });
    return res.json({ applications: await prisma.application.count({ where: { candidateId: req.user!.id } }), savedJobs: await prisma.savedJob.count({ where: { candidateId: req.user!.id } }) });
  } catch (error) { next(error); }
});

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function mapRemotiveJob(job: any) {
  const type = String(job.job_type ?? "full_time").toLowerCase();
  const employmentType = type === "part_time" ? "PART_TIME" : type === "contract" ? "CONTRACT" : "FULL_TIME";
  return {
    sourceUrl: job.url,
    title: job.title,
    company: job.company_name,
    location: job.candidate_required_location || "Remote",
    description: stripHtml(job.description ?? "No description provided."),
    skills: Array.isArray(job.tags) ? job.tags : [],
    benefits: [],
    workMode: "REMOTE",
    employmentType,
    postedDate: job.publication_date,
  };
}

app.post("/scrape/jobs", auth, roles("ADMIN"), async (req, res, next) => {
  try {
    const source = String(req.body.source ?? "");
    let jobs = Array.isArray(req.body.jobs) ? req.body.jobs : [];
    if (source === "remotive") {
      const search = req.body.search ? `&search=${encodeURIComponent(String(req.body.search))}` : "";
      const feedResponse = await fetch(`https://remotive.com/api/remote-jobs?limit=100${search}`);
      if (!feedResponse.ok) throw new Error(`Remotive returned HTTP ${feedResponse.status}`);
      const feed = await feedResponse.json() as { jobs?: any[] };
      jobs = (feed.jobs ?? []).map(mapRemotiveJob);
    }
    if (!source || !jobs.length) return res.status(400).json({ error: "source and a non-empty jobs array are required" });
  let jobsAdded = 0;
  let duplicatesSkipped = 0;
  const errors: string[] = [];
  for (const item of jobs) {
    try {
      if (!item.sourceUrl || !item.title || !item.company || !item.description || !item.location) throw new Error("sourceUrl, title, company, description and location are required");
      const sourceKey = `scraper:${source}:${item.company}`;
      const company = await prisma.company.upsert({ where: { sourceKey }, update: { location: item.location }, create: { sourceKey, name: item.company, location: item.location } });
      await prisma.job.create({ data: { title: item.title, companyId: company.id, location: item.location, description: item.description, source, sourceUrl: item.sourceUrl, skills: item.skills ?? [], benefits: item.benefits ?? [], workMode: item.workMode ?? "ONSITE", employmentType: item.employmentType ?? "FULL_TIME", postedDate: item.postedDate ? new Date(item.postedDate) : new Date(), scrapedAt: new Date() } });
      jobsAdded++;
    } catch (error: any) {
      if (error.code === "P2002") duplicatesSkipped++;
      else errors.push(`${item.title ?? "unknown job"}: ${error.message}`);
    }
  }
    res.json({ source, jobsFetched: jobs.length, jobsAdded, duplicatesSkipped, errors });
  } catch (error) { next(error); }
});

app.use((error: any, _req: Request, res: Response, _next: NextFunction) => { console.error(error); res.status(500).json({ error: "Internal server error" }); });

app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
