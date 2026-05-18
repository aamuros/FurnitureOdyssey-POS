import { PrismaClient, type PermissionAction, type PermissionModule } from "@prisma/client";
import { moduleActions } from "../lib/auth/permissions";

const prisma = new PrismaClient();

async function main() {
  const authUserId = process.env.FIRST_ADMIN_AUTH_USER_ID;
  const email = process.env.FIRST_ADMIN_EMAIL;
  const displayName = process.env.FIRST_ADMIN_NAME ?? "Furniture Odyssey Admin";

  if (!authUserId || !email) {
    console.log("Skipping seed. Set FIRST_ADMIN_AUTH_USER_ID and FIRST_ADMIN_EMAIL to create the first Admin profile.");
    return;
  }

  await prisma.userProfile.upsert({
    where: {
      authUserId
    },
    update: {
      email,
      displayName,
      role: "ADMIN",
      status: "ACTIVE"
    },
    create: {
      authUserId,
      email,
      displayName,
      role: "ADMIN",
      status: "ACTIVE",
      permissions: {
        createMany: {
          data: Object.entries(moduleActions).flatMap(([module, actions]) =>
            actions.map((action) => ({
              module: module as PermissionModule,
              action: action as PermissionAction,
              allowed: true
            }))
          )
        }
      }
    }
  });

  console.log(`Seeded active Admin profile for ${email}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
