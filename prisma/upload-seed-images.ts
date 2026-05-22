import "dotenv/config";
import path from "path";
import fs from "fs";

/**
 * One-time script: uploads images from the /images folder to Cloudinary
 * and saves the results to prisma/seed-data/cloudinary-images.json.
 *
 * Run once with: npx tsx prisma/upload-seed-images.ts
 *
 * After running, the seed script will read from the JSON — no further
 * Cloudinary uploads needed.
 */

function getCloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Cloudinary environment variables (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) are not configured."
    );
  }

  return { cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true };
}

type CloudinaryResult = {
  public_id: string;
  secure_url: string;
  resource_type: string;
  format: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
};

type ImageMapping = {
  imageFile: string;
  productCode: string;
  cloudinary: CloudinaryResult;
};

const imageToProductCode: Record<string, string> = {
  "tolix chair black.png": "TOLIX-CHAIR-BLK",
  "Tolix Chair Red.png": "TOLIX-CHAIR-RED",
  "tolix chair silver.png": "TOLIX-CHAIR-SLV",
  "tolix chair yellow.png": "TOLIX-CHAIR-YLW",
  "tolix long stool black.png": "TOLIX-LSTOOL-BLK",
  "tolix long stool red.png": "TOLIX-LSTOOL-RED",
  "tolix long stool white.png": "TOLIX-LSTOOL-WHT",
  "tolix long stool yellow.png": "TOLIX-LSTOOL-YLW",
};

async function main() {
  const { v2: cloudinary } = await import("cloudinary");
  cloudinary.config(getCloudinaryConfig());

  const imagesDir = path.resolve(__dirname, "..", "images");
  const outputDir = path.resolve(__dirname, "seed-data");
  const outputPath = path.join(outputDir, "cloudinary-images.json");

  if (!fs.existsSync(imagesDir)) {
    throw new Error(`Images directory not found at: ${imagesDir}`);
  }

  // Load existing results to avoid re-uploading
  let existingResults: ImageMapping[] = [];
  if (fs.existsSync(outputPath)) {
    existingResults = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
    console.log(`Found existing results for ${existingResults.length} image(s). Will skip those.\n`);
  }

  const existingCodes = new Set(existingResults.map((r) => r.productCode));
  const results: ImageMapping[] = [...existingResults];

  for (const [imageFile, productCode] of Object.entries(imageToProductCode)) {
    if (existingCodes.has(productCode)) {
      console.log(`⏭️  Skipping ${imageFile} — already uploaded (${productCode}).`);
      continue;
    }

    const imagePath = path.join(imagesDir, imageFile);

    if (!fs.existsSync(imagePath)) {
      console.log(`⚠️  Image not found: ${imageFile}, skipping.`);
      continue;
    }

    const fileId = productCode.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    // Use a stable public_id based on product code (no product DB id needed)
    const publicId = `products/seed/${fileId}`;

    console.log(`⬆️  Uploading ${imageFile} → ${publicId}...`);

    try {
      const result = await new Promise<CloudinaryResult>((resolve, reject) => {
        cloudinary.uploader.upload(
          imagePath,
          {
            public_id: publicId,
            resource_type: "image",
            overwrite: false,
            use_filename: false,
            unique_filename: false,
          },
          (error, uploadResult) => {
            if (error || !uploadResult) {
              reject(error ?? new Error(`Upload failed for ${imageFile}`));
              return;
            }
            resolve({
              public_id: uploadResult.public_id,
              secure_url: uploadResult.secure_url,
              resource_type: uploadResult.resource_type ?? "image",
              format: uploadResult.format ?? null,
              width: typeof uploadResult.width === "number" ? uploadResult.width : null,
              height: typeof uploadResult.height === "number" ? uploadResult.height : null,
              bytes: typeof uploadResult.bytes === "number" ? uploadResult.bytes : null,
            });
          }
        );
      });

      results.push({ imageFile, productCode, cloudinary: result });
      console.log(`✅ Done: ${result.public_id} (${result.width}x${result.height})\n`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed: ${message}\n`);
    }
  }

  // Save results
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), "utf-8");
  console.log(`\n💾 Saved ${results.length} result(s) to: ${outputPath}`);
  console.log("You can now run the seed: npm run seed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
