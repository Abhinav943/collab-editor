import { prisma } from "../src/lib/prisma.js";

async function main() {
  const existing = await prisma.project.findFirst({
    where: { name: "Demo project" },
  });
  if (existing) {
    console.log("demo project already exists:", existing.id);
    return;
  }
  const project = await prisma.project.create({
    data: { name: "Demo project" },
  });
  await prisma.file.create({
    data: {
      projectId: project.id,
      path: "index.js",
      content: 'console.log("hello from the demo project");\n',
    },
  });
  console.log("seeded demo project:", project.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
