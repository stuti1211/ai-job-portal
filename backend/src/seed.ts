import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.ts";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const jobs = [
  {
    title: "Senior Product Designer",
    company: "Juniper Labs",
    location: "New York, NY",
    workMode: "HYBRID" as const,
    skills: ["Figma", "Research", "Systems"],
    description: "Shape a calm, intelligent workspace for teams building the next generation of climate tools.",
    sourceUrl: "https://northstar.local/jobs/juniper-senior-product-designer",
  },
  {
    title: "Frontend Engineer",
    company: "Morrow Health",
    location: "Remote",
    workMode: "REMOTE" as const,
    skills: ["React", "TypeScript", "Accessibility"],
    description: "Build humane care experiences with a small product team that sweats the details.",
    sourceUrl: "https://northstar.local/jobs/morrow-frontend-engineer",
  },
  {
    title: "Growth Marketing Lead",
    company: "Field Notes",
    location: "Austin, TX",
    workMode: "ONSITE" as const,
    skills: ["Strategy", "Content", "Analytics"],
    description: "Turn a loved independent publishing platform into a wider creative community.",
    sourceUrl: "https://northstar.local/jobs/field-notes-growth-lead",
  },
];

async function main() {
  for (const job of jobs) {
  const sourceKey = `seed:${job.company}`;
  const company = await prisma.company.upsert({
    where: { sourceKey },
    update: { location: job.location },
    create: { sourceKey, name: job.company, location: job.location },
  });
  const existing = await prisma.job.findFirst({ where: { source: "northstar-demo", sourceUrl: job.sourceUrl } });
  if (!existing) {
    await prisma.job.create({
      data: {
        title: job.title,
        companyId: company.id,
        location: job.location,
        workMode: job.workMode,
        employmentType: "FULL_TIME",
        skills: job.skills,
        description: job.description,
        benefits: [],
        source: "northstar-demo",
        sourceUrl: job.sourceUrl,
      },
    });
  }
  }
  console.log(`Seeded ${jobs.length} demo jobs.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
