import { PrismaClient, type PermissionAction, type PermissionModule } from "@prisma/client";
import { moduleActions } from "../lib/auth/permissions";
import { createSupabaseAdminClient } from "../lib/supabase/admin";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Seed: Admin user
// ---------------------------------------------------------------------------

type BootstrapAuthUserResult = {
  id: string;
  status: "created" | "reused" | "updated";
};

function normalizeOptionalEnv(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

async function findAuthUserByEmail(email: string) {
  const supabase = createSupabaseAdminClient();
  const normalizedEmail = email.toLowerCase();
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 100,
    });

    if (error) {
      throw new Error(`Could not list Supabase Auth users: ${error.message}`);
    }

    const user = data.users.find((authUser) => authUser.email?.toLowerCase() === normalizedEmail);

    if (user) {
      return user;
    }

    if (!data.nextPage) {
      return null;
    }

    page = data.nextPage;
  }
}

async function bootstrapFirstAdminAuthUser(): Promise<BootstrapAuthUserResult | null> {
  const overrideAuthUserId = normalizeOptionalEnv(process.env.FIRST_ADMIN_AUTH_USER_ID);
  const email = normalizeOptionalEnv(process.env.FIRST_ADMIN_EMAIL);
  const password = normalizeOptionalEnv(process.env.FIRST_ADMIN_PASSWORD);
  const displayName = process.env.FIRST_ADMIN_NAME ?? "Furniture Odyssey Admin";

  if (!email) {
    console.log(
      "Skipping admin seed. Set FIRST_ADMIN_EMAIL and FIRST_ADMIN_PASSWORD to bootstrap the first local Admin."
    );
    return null;
  }

  if (!password) {
    throw new Error("FIRST_ADMIN_PASSWORD is required to bootstrap the first local Admin Auth user.");
  }

  const supabase = createSupabaseAdminClient();

  if (overrideAuthUserId) {
    const { data, error } = await supabase.auth.admin.updateUserById(overrideAuthUserId, {
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    });

    if (error) {
      throw new Error(`Could not update override Supabase Auth user: ${error.message}`);
    }

    if (!data.user) {
      throw new Error(`No Supabase Auth user found for FIRST_ADMIN_AUTH_USER_ID=${overrideAuthUserId}.`);
    }

    console.log(`✅ Updated Supabase Auth admin user from FIRST_ADMIN_AUTH_USER_ID (${data.user.id}).`);
    return { id: data.user.id, status: "updated" };
  }

  const existingUser = await findAuthUserByEmail(email);

  if (existingUser) {
    const { data, error } = await supabase.auth.admin.updateUserById(existingUser.id, {
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    });

    if (error) {
      throw new Error(`Could not update existing Supabase Auth admin user: ${error.message}`);
    }

    console.log(`✅ Reused and updated existing Supabase Auth admin user for ${email} (${existingUser.id}).`);
    return { id: data.user?.id ?? existingUser.id, status: "updated" };
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });

  if (error) {
    throw new Error(`Could not create Supabase Auth admin user: ${error.message}`);
  }

  if (!data.user) {
    throw new Error("Supabase Auth admin user creation succeeded without returning a user.");
  }

  console.log(`✅ Created Supabase Auth admin user for ${email} (${data.user.id}).`);
  return { id: data.user.id, status: "created" };
}

async function seedAdminUser() {
  const authUser = await bootstrapFirstAdminAuthUser();
  const email = normalizeOptionalEnv(process.env.FIRST_ADMIN_EMAIL);
  const displayName = process.env.FIRST_ADMIN_NAME ?? "Furniture Odyssey Admin";

  if (!authUser || !email) {
    return null;
  }

  const existingAdmin = await prisma.userProfile.findFirst({
    where: {
      OR: [{ authUserId: authUser.id }, { email }],
    },
    select: { id: true },
  });

  const admin = existingAdmin
    ? await prisma.userProfile.update({
        where: { id: existingAdmin.id },
        data: {
          authUserId: authUser.id,
          email,
          displayName,
          role: "ADMIN",
          status: "ACTIVE",
        },
      })
    : await prisma.userProfile.create({
        data: {
          authUserId: authUser.id,
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

  await prisma.userPermission.createMany({
    data: Object.entries(moduleActions).flatMap(([module, actions]) =>
      actions.map((action) => ({
        userId: admin.id,
        module: module as PermissionModule,
        action: action as PermissionAction,
        allowed: true,
      }))
    ),
    skipDuplicates: true,
  });

  console.log(
    `✅ Seeded active Admin profile for ${email} using ${authUser.status} Supabase Auth user ${authUser.id}.`
  );
  return admin;
}

// ---------------------------------------------------------------------------
// Seed: Catalogue page content
// ---------------------------------------------------------------------------

const pageContentSeed = [
  {
    id: "home-hero-eyebrow",
    page: "home",
    section: "hero",
    fieldKey: "eyebrow",
    fieldValue: "A New Way to Sit",
  },
  {
    id: "home-hero-title",
    page: "home",
    section: "hero",
    fieldKey: "title",
    fieldValue: "Sculpting",
  },
  {
    id: "home-hero-italic",
    page: "home",
    section: "hero",
    fieldKey: "italic",
    fieldValue: "Silence",
  },
  {
    id: "home-hero-description",
    page: "home",
    section: "hero",
    fieldKey: "description",
    fieldValue:
      "Discover the harmony between form and living craft. Every piece is designed to bring a sense of quiet permanence to your contemporary sanctuary.",
  },
  {
    id: "home-hero-btn1",
    page: "home",
    section: "hero",
    fieldKey: "btn1_label",
    fieldValue: "Explore the Collection",
  },
  {
    id: "home-hero-btn2",
    page: "home",
    section: "hero",
    fieldKey: "btn2_label",
    fieldValue: "Our Story",
  },
  {
    id: "home-hero-image1",
    page: "home",
    section: "hero",
    fieldKey: "image1",
    fieldValue: "/images/wooden-cabinet.png",
  },
  {
    id: "home-hero-image2",
    page: "home",
    section: "hero",
    fieldKey: "image2",
    fieldValue: "/images/chair-sage.png",
  },
  {
    id: "home-curators-eyebrow",
    page: "home",
    section: "curators_pick",
    fieldKey: "eyebrow",
    fieldValue: "a daily focus on modern, distinctive classics, handcrafted furniture and more.",
  },
  {
    id: "home-curators-title",
    page: "home",
    section: "curators_pick",
    fieldKey: "title",
    fieldValue: "The Digital Curator's Pick",
  },
  {
    id: "home-materials-title",
    page: "home",
    section: "honest_materials",
    fieldKey: "title",
    fieldValue: "Honest Materials.",
  },
  {
    id: "home-materials-italic",
    page: "home",
    section: "honest_materials",
    fieldKey: "italic",
    fieldValue: "Eternal Design.",
  },
  {
    id: "home-materials-description",
    page: "home",
    section: "honest_materials",
    fieldKey: "description",
    fieldValue:
      "We believe furniture should tell a story worth repeating. In a world of disposable convenience, our \"Honest Material\" movement — where the wood grain is embraced and the visible construction provides testament to the artisan's touch.",
  },
  {
    id: "home-materials-description2",
    page: "home",
    section: "honest_materials",
    fieldKey: "description2",
    fieldValue:
      "Every piece at Furniture Odyssey is crafted to ensure the finest for us, preserving all of nature's warmth for your home's next chapter.",
  },
  {
    id: "home-materials-btn",
    page: "home",
    section: "honest_materials",
    fieldKey: "btn_label",
    fieldValue: "Browse the Craftsmanship →",
  },
  {
    id: "home-materials-image",
    page: "home",
    section: "honest_materials",
    fieldKey: "image",
    fieldValue: "/images/craftsman.png",
  },
  {
    id: "home-materials-quote",
    page: "home",
    section: "honest_materials",
    fieldKey: "quote",
    fieldValue: "Every grain tells a story of patient hands.",
  },
  {
    id: "home-story-eyebrow",
    page: "home",
    section: "featured_story",
    fieldKey: "eyebrow",
    fieldValue: "Featured Story",
  },
  {
    id: "home-story-title",
    page: "home",
    section: "featured_story",
    fieldKey: "title",
    fieldValue: "From Workshop",
  },
  {
    id: "home-story-italic",
    page: "home",
    section: "featured_story",
    fieldKey: "italic",
    fieldValue: "to Sanctuary",
  },
  {
    id: "home-story-description",
    page: "home",
    section: "featured_story",
    fieldKey: "description",
    fieldValue:
      "Follow the journey of a single slab of oak as it transforms from raw timber into a dining table designed to last for generations.",
  },
  {
    id: "home-story-btn",
    page: "home",
    section: "featured_story",
    fieldKey: "btn_label",
    fieldValue: "Read the Story →",
  },
  {
    id: "home-story-image",
    page: "home",
    section: "featured_story",
    fieldKey: "image",
    fieldValue: "/images/modern-sideboard.png",
  },
  {
    id: "chairs-hero-eyebrow",
    page: "chairs",
    section: "hero",
    fieldKey: "eyebrow",
    fieldValue: "The Seat You Deserves",
  },
  {
    id: "chairs-hero-title",
    page: "chairs",
    section: "hero",
    fieldKey: "title",
    fieldValue: "Sculpted",
  },
  {
    id: "chairs-hero-italic",
    page: "chairs",
    section: "hero",
    fieldKey: "italic",
    fieldValue: "Comfort.",
  },
  {
    id: "chairs-hero-description",
    page: "chairs",
    section: "hero",
    fieldKey: "description",
    fieldValue:
      "Discover sculpted silhouettes, classic designs and tactile fabrics — from artisanal studios to your sanctuary. In a chair, every piece is a sanctuary of its own.",
  },
  {
    id: "tables-hero-eyebrow",
    page: "tables",
    section: "hero",
    fieldKey: "eyebrow",
    fieldValue: "The Custom Collection",
  },
  {
    id: "tables-hero-title",
    page: "tables",
    section: "hero",
    fieldKey: "title",
    fieldValue: "Gathering",
  },
  {
    id: "tables-hero-italic",
    page: "tables",
    section: "hero",
    fieldKey: "italic",
    fieldValue: "Redefined.",
  },
  {
    id: "tables-hero-description",
    page: "tables",
    section: "hero",
    fieldKey: "description",
    fieldValue:
      "Crafted from solid oak and steel married, our tables are built to be the heart of your home. Turn every deliberation to your sanctuary.",
  },
  {
    id: "tables-hero-btn",
    page: "tables",
    section: "hero",
    fieldKey: "btn_label",
    fieldValue: "Start Gathering",
  },
  {
    id: "tables-hero-image",
    page: "tables",
    section: "hero",
    fieldKey: "image",
    fieldValue: "/images/wood-grain.png",
  },
  {
    id: "tables-hero-quote",
    page: "tables",
    section: "hero",
    fieldKey: "quote",
    fieldValue: "Every chair follows a table worth sitting around.",
  },
  {
    id: "tables-catalog-title",
    page: "tables",
    section: "catalog",
    fieldKey: "title",
    fieldValue: "Curated Catalog",
  },
  {
    id: "collections-hero-title",
    page: "collections",
    section: "hero",
    fieldKey: "title",
    fieldValue: "Curating Your",
  },
  {
    id: "collections-hero-italic",
    page: "collections",
    section: "hero",
    fieldKey: "italic",
    fieldValue: "Sanctuary",
  },
  {
    id: "collections-hero-description",
    page: "collections",
    section: "hero",
    fieldKey: "description",
    fieldValue:
      "Explore our latest ensemble of curated finished pieces, designed to bring quiet elegance and enduring warmth. A luxury curation of your home.",
  },
  {
    id: "collections-hero-btn",
    page: "collections",
    section: "hero",
    fieldKey: "btn_label",
    fieldValue: "View Catalog",
  },
];

async function seedPageContent() {
  const result = await prisma.pageContent.createMany({
    data: pageContentSeed,
    skipDuplicates: true,
  });

  console.log(`Seeded ${result.count} catalogue page content records.`);
}

// ---------------------------------------------------------------------------
// Seed: Catalogue tags
// ---------------------------------------------------------------------------

const tagSeed = [
  { id: "tag-new-arrivals", name: "New Arrivals" },
  { id: "tag-dining", name: "Dining" },
  { id: "tag-lounge", name: "Lounge" },
  { id: "tag-accent", name: "Accent" },
  { id: "tag-coffee", name: "Coffee" },
  { id: "tag-storage", name: "Storage" },
  { id: "tag-modular", name: "Modular" },
  { id: "tag-decor", name: "Decor" },
  { id: "tag-art", name: "Art" },
  { id: "tag-classic", name: "Classic" },
  { id: "tag-modern", name: "Modern" },
  { id: "tag-handcrafted", name: "Handcrafted" },
];

async function seedTags() {
  const result = await prisma.tag.createMany({
    data: tagSeed,
    skipDuplicates: true,
  });

  console.log(`Seeded ${result.count} catalogue tags.`);
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
  await seedPageContent();
  await seedTags();
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
