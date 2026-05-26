CREATE TABLE "page_content" (
  "id" TEXT NOT NULL,
  "page" TEXT NOT NULL,
  "section" TEXT NOT NULL,
  "field_key" TEXT NOT NULL,
  "field_value" TEXT NOT NULL DEFAULT '',
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "page_content_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tags" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_tag_assignments" (
  "product_id" UUID NOT NULL,
  "tag_id" TEXT NOT NULL,

  CONSTRAINT "product_tag_assignments_pkey" PRIMARY KEY ("product_id", "tag_id")
);

CREATE UNIQUE INDEX "page_content_page_section_field_key_key" ON "page_content"("page", "section", "field_key");
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

ALTER TABLE "product_tag_assignments"
ADD CONSTRAINT "product_tag_assignments_product_id_fkey"
FOREIGN KEY ("product_id") REFERENCES "Product"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_tag_assignments"
ADD CONSTRAINT "product_tag_assignments_tag_id_fkey"
FOREIGN KEY ("tag_id") REFERENCES "tags"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
