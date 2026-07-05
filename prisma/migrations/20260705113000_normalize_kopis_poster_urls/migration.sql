UPDATE "Concert"
SET "posterImageUrl" = replace("posterImageUrl", 'http://www.kopis.or.kr', 'https://kopis.or.kr')
WHERE "externalSource" = 'kopis'
  AND "posterImageUrl" LIKE 'http://www.kopis.or.kr%';

UPDATE "Concert"
SET "posterImageUrl" = replace("posterImageUrl", 'http://kopis.or.kr', 'https://kopis.or.kr')
WHERE "externalSource" = 'kopis'
  AND "posterImageUrl" LIKE 'http://kopis.or.kr%';

UPDATE "Concert"
SET "posterImageUrl" = replace("posterImageUrl", 'https://www.kopis.or.kr', 'https://kopis.or.kr')
WHERE "externalSource" = 'kopis'
  AND "posterImageUrl" LIKE 'https://www.kopis.or.kr%';
