CREATE OR REPLACE FUNCTION public."_review_image_urls_to_text_array"(input_json JSONB)
RETURNS TEXT[]
LANGUAGE SQL
IMMUTABLE
AS 'SELECT COALESCE(array_agg(item), ARRAY[]::TEXT[]) FROM jsonb_array_elements_text(input_json) AS items(item)';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Review'
      AND column_name = 'imageUrls'
      AND udt_name = 'jsonb'
  ) THEN
    ALTER TABLE "Review" ALTER COLUMN "imageUrls" DROP DEFAULT;
    ALTER TABLE "Review" ALTER COLUMN "imageUrls" TYPE TEXT[] USING (
      CASE
        WHEN "imageUrls" IS NULL THEN ARRAY[]::TEXT[]
        WHEN jsonb_typeof("imageUrls") = 'array' THEN public."_review_image_urls_to_text_array"("imageUrls")
        WHEN jsonb_typeof("imageUrls") = 'string' THEN ARRAY["imageUrls" #>> '{}']::TEXT[]
        ELSE ARRAY[]::TEXT[]
      END
    );
    ALTER TABLE "Review" ALTER COLUMN "imageUrls" SET DEFAULT ARRAY[]::TEXT[];
  END IF;
END $$;

DROP FUNCTION IF EXISTS public."_review_image_urls_to_text_array"(JSONB);
