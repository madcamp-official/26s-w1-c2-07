DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Review'
      AND column_name = 'zoneName'
  ) THEN
    ALTER TABLE "Review" ALTER COLUMN "zoneName" DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Review'
      AND column_name = 'imageUrls'
  ) THEN
    UPDATE "Review" SET "imageUrls" = ARRAY[]::TEXT[] WHERE "imageUrls" IS NULL;
    ALTER TABLE "Review" ALTER COLUMN "imageUrls" SET DEFAULT ARRAY[]::TEXT[];
    ALTER TABLE "Review" ALTER COLUMN "imageUrls" SET NOT NULL;
  END IF;
END $$;
