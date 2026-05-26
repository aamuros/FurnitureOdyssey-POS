ALTER TABLE public."Product"
ADD COLUMN "websitePages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
