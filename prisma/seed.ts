import { PrismaClient, type PermissionAction, type PermissionModule } from "@prisma/client";
import { moduleActions } from "../lib/auth/permissions";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Seed: Admin user
// ---------------------------------------------------------------------------

async function seedAdminUser() {
  const authUserId = process.env.FIRST_ADMIN_AUTH_USER_ID;
  const email = process.env.FIRST_ADMIN_EMAIL;
  const displayName = process.env.FIRST_ADMIN_NAME ?? "Furniture Odyssey Admin";

  if (!authUserId || !email) {
    console.log(
      "Skipping admin seed. Set FIRST_ADMIN_AUTH_USER_ID and FIRST_ADMIN_EMAIL to create the first Admin profile."
    );
    return null;
  }

  const admin = await prisma.userProfile.upsert({
    where: { authUserId },
    update: {
      email,
      displayName,
      role: "ADMIN",
      status: "ACTIVE",
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
              allowed: true,
            }))
          ),
        },
      },
    },
  });

  console.log(`✅ Seeded active Admin profile for ${email}.`);
  return admin;
}

// ---------------------------------------------------------------------------
// Seed: Products with hardcoded Cloudinary image data
// ---------------------------------------------------------------------------

type ProductSeedData = {
  code: string;
  name: string;
  category: string;
  description: string;
  specifications: string;
  referencePrice: number | null;
  referenceCost: number | null;
  image: {
    cloudinaryPublicId: string;
    secureUrl: string;
    resourceType: string;
    format: string;
    width: number;
    height: number;
    bytes: number;
  };
};

const productSeedData: ProductSeedData[] = [
  {
    code: "TOLIX-CHAIR-BLK",
    name: "Tolix Chair - Black",
    category: "Chairs",
    description:
      "Industrial-style Tolix metal chair in classic black. Stackable, durable, and ideal for restaurants, cafés, and commercial spaces.",
    specifications: "Material: Steel | Color: Black | Stackable: Yes | Weight capacity: 120kg",
    referencePrice: 1500,
    referenceCost: 900,
    image: {
      cloudinaryPublicId: "products/seed/tolix-chair-blk",
      secureUrl:
        "https://res.cloudinary.com/desyeqfap/image/upload/v1779432044/products/seed/tolix-chair-blk.png",
      resourceType: "image",
      format: "png",
      width: 1122,
      height: 1402,
      bytes: 960319,
    },
  },
  {
    code: "TOLIX-CHAIR-RED",
    name: "Tolix Chair - Red",
    category: "Chairs",
    description:
      "Industrial-style Tolix metal chair in vibrant red. Stackable, durable, and ideal for restaurants, cafés, and commercial spaces.",
    specifications: "Material: Steel | Color: Red | Stackable: Yes | Weight capacity: 120kg",
    referencePrice: 1500,
    referenceCost: 900,
    image: {
      cloudinaryPublicId: "products/seed/tolix-chair-red",
      secureUrl:
        "https://res.cloudinary.com/desyeqfap/image/upload/v1779432046/products/seed/tolix-chair-red.png",
      resourceType: "image",
      format: "png",
      width: 1122,
      height: 1402,
      bytes: 860240,
    },
  },
  {
    code: "TOLIX-CHAIR-SLV",
    name: "Tolix Chair - Silver",
    category: "Chairs",
    description:
      "Industrial-style Tolix metal chair in silver/galvanized finish. Stackable, durable, and ideal for restaurants, cafés, and commercial spaces.",
    specifications: "Material: Steel | Color: Silver | Stackable: Yes | Weight capacity: 120kg",
    referencePrice: 1500,
    referenceCost: 900,
    image: {
      cloudinaryPublicId: "products/seed/tolix-chair-slv",
      secureUrl:
        "https://res.cloudinary.com/desyeqfap/image/upload/v1779432047/products/seed/tolix-chair-slv.png",
      resourceType: "image",
      format: "png",
      width: 1122,
      height: 1402,
      bytes: 972898,
    },
  },
  {
    code: "TOLIX-CHAIR-YLW",
    name: "Tolix Chair - Yellow",
    category: "Chairs",
    description:
      "Industrial-style Tolix metal chair in bright yellow. Stackable, durable, and ideal for restaurants, cafés, and commercial spaces.",
    specifications: "Material: Steel | Color: Yellow | Stackable: Yes | Weight capacity: 120kg",
    referencePrice: 1500,
    referenceCost: 900,
    image: {
      cloudinaryPublicId: "products/seed/tolix-chair-ylw",
      secureUrl:
        "https://res.cloudinary.com/desyeqfap/image/upload/v1779432048/products/seed/tolix-chair-ylw.png",
      resourceType: "image",
      format: "png",
      width: 1122,
      height: 1402,
      bytes: 847719,
    },
  },
  {
    code: "TOLIX-LSTOOL-BLK",
    name: "Tolix Long Stool - Black",
    category: "Stools",
    description:
      "Industrial-style Tolix metal barstool / long stool in black. Stackable and suitable for bars, counters, and high tables.",
    specifications:
      "Material: Steel | Color: Black | Style: Bar height | Stackable: Yes | Weight capacity: 120kg",
    referencePrice: 1300,
    referenceCost: 850,
    image: {
      cloudinaryPublicId: "products/seed/tolix-lstool-blk",
      secureUrl:
        "https://res.cloudinary.com/desyeqfap/image/upload/v1779432049/products/seed/tolix-lstool-blk.png",
      resourceType: "image",
      format: "png",
      width: 1122,
      height: 1402,
      bytes: 934383,
    },
  },
  {
    code: "TOLIX-LSTOOL-RED",
    name: "Tolix Long Stool - Red",
    category: "Stools",
    description:
      "Industrial-style Tolix metal barstool / long stool in red. Stackable and suitable for bars, counters, and high tables.",
    specifications:
      "Material: Steel | Color: Red | Style: Bar height | Stackable: Yes | Weight capacity: 120kg",
    referencePrice: 1300,
    referenceCost: 850,
    image: {
      cloudinaryPublicId: "products/seed/tolix-lstool-red",
      secureUrl:
        "https://res.cloudinary.com/desyeqfap/image/upload/v1779432050/products/seed/tolix-lstool-red.png",
      resourceType: "image",
      format: "png",
      width: 1122,
      height: 1402,
      bytes: 933937,
    },
  },
  {
    code: "TOLIX-LSTOOL-WHT",
    name: "Tolix Long Stool - White",
    category: "Stools",
    description:
      "Industrial-style Tolix metal barstool / long stool in white. Stackable and suitable for bars, counters, and high tables.",
    specifications:
      "Material: Steel | Color: White | Style: Bar height | Stackable: Yes | Weight capacity: 120kg",
    referencePrice: 1300,
    referenceCost: 850,
    image: {
      cloudinaryPublicId: "products/seed/tolix-lstool-wht",
      secureUrl:
        "https://res.cloudinary.com/desyeqfap/image/upload/v1779432051/products/seed/tolix-lstool-wht.png",
      resourceType: "image",
      format: "png",
      width: 1122,
      height: 1402,
      bytes: 913886,
    },
  },
  {
    code: "TOLIX-LSTOOL-YLW",
    name: "Tolix Long Stool - Yellow",
    category: "Stools",
    description:
      "Industrial-style Tolix metal barstool / long stool in yellow. Stackable and suitable for bars, counters, and high tables.",
    specifications:
      "Material: Steel | Color: Yellow | Style: Bar height | Stackable: Yes | Weight capacity: 120kg",
    referencePrice: 1300,
    referenceCost: 850,
    image: {
      cloudinaryPublicId: "products/seed/tolix-lstool-ylw",
      secureUrl:
        "https://res.cloudinary.com/desyeqfap/image/upload/v1779432052/products/seed/tolix-lstool-ylw.png",
      resourceType: "image",
      format: "png",
      width: 1122,
      height: 1402,
      bytes: 884392,
    },
  },
];

async function seedProducts(adminId: string | null) {
  console.log(`\n📦 Seeding ${productSeedData.length} products...\n`);

  for (const data of productSeedData) {
    // Upsert the product by code so this seed is re-runnable
    const product = await prisma.product.upsert({
      where: { code: data.code },
      update: {
        name: data.name,
        category: data.category,
        description: data.description,
        specifications: data.specifications,
        referencePrice: data.referencePrice,
        referenceCost: data.referenceCost,
        status: "ACTIVE",
        ...(adminId ? { updatedById: adminId } : {}),
      },
      create: {
        code: data.code,
        name: data.name,
        category: data.category,
        description: data.description,
        specifications: data.specifications,
        referencePrice: data.referencePrice,
        referenceCost: data.referenceCost,
        currency: "PHP",
        status: "ACTIVE",
        ...(adminId ? { createdById: adminId } : {}),
      },
    });

    console.log(`  ✅ Product: ${data.name} (${product.id})`);

    // Check if this product already has an image with this public_id
    const existingImage = await prisma.productImage.findFirst({
      where: {
        productId: product.id,
        cloudinaryPublicId: data.image.cloudinaryPublicId,
      },
    });

    if (existingImage) {
      console.log(`     ↳ Image already linked, skipping.`);
      continue;
    }

    await prisma.productImage.create({
      data: {
        productId: product.id,
        cloudinaryPublicId: data.image.cloudinaryPublicId,
        secureUrl: data.image.secureUrl,
        resourceType: data.image.resourceType,
        format: data.image.format,
        width: data.image.width,
        height: data.image.height,
        bytes: data.image.bytes,
        altText: data.name,
        sortOrder: 0,
        isPrimary: true,
      },
    });

    console.log(`     ✅ Image linked: ${data.image.cloudinaryPublicId}`);
  }

  console.log(`\n📦 Product seeding complete.\n`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const admin = await seedAdminUser();
  await seedProducts(admin?.id ?? null);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
