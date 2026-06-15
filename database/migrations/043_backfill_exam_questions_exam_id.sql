-- Migration 043: Backfill exam_id on exam_questions
-- Links questions to their exam_definitions so getExamQuestions works
-- Uses a two-pass approach:
--   Pass 1: Match by university_id + course_id + year (for university past questions)
--   Pass 2: Match by exam_name + category (for professional exams)

-- ═══════════════════════════════════════════════════════════════
-- PASS 1: University past questions
-- Match exam_questions.university + course_code + year
-- to exam_definitions via exam_universities + exam_courses
-- ═══════════════════════════════════════════════════════════════

UPDATE exam_questions q
SET exam_id = ed.id
FROM exam_definitions ed
JOIN exam_universities eu ON eu.id = ed.university_id
JOIN exam_courses ec ON ec.id = ed.course_id
WHERE q.exam_id IS NULL
  AND q.university IS NOT NULL
  AND q.course_code IS NOT NULL
  AND q.year IS NOT NULL
  AND ed.is_published = true
  AND (
    -- Match university name (case-insensitive, strip commas)
    LOWER(REPLACE(eu.name, ',', '')) = LOWER(REPLACE(q.university, ',', ''))
    OR LOWER(eu.name) LIKE '%' || LOWER(q.university) || '%'
    OR LOWER(q.university) LIKE '%' || LOWER(eu.name) || '%'
    OR (eu.short_name IS NOT NULL AND LOWER(q.university) LIKE '%' || LOWER(eu.short_name) || '%')
  )
  AND LOWER(ec.code) = LOWER(q.course_code)
  AND ed.year = q.year;

-- ═══════════════════════════════════════════════════════════════
-- PASS 2: Professional exams
-- Match exam_questions.exam_name + category to exam_definitions
-- (for questions without university/course_code linkage)
-- ═══════════════════════════════════════════════════════════════

UPDATE exam_questions q
SET exam_id = ed.id
FROM exam_definitions ed
WHERE q.exam_id IS NULL
  AND ed.is_published = true
  AND ed.category = q.exam_category
  AND (
    LOWER(ed.exam_name) = LOWER(q.exam_name)
    OR LOWER(ed.exam_name) LIKE '%' || LOWER(q.exam_name) || '%'
    OR LOWER(q.exam_name) LIKE '%' || LOWER(ed.exam_name) || '%'
  );

-- ═══════════════════════════════════════════════════════════════
-- PASS 3: Remaining university questions without year match
-- Try matching just university + course_code (closest year within 2 years)
-- Uses a simple UPDATE with DISTINCT ON to pick best match per question
-- ═══════════════════════════════════════════════════════════════

UPDATE exam_questions q
SET exam_id = best_match.exam_id
FROM (
  SELECT DISTINCT ON (q2.id)
    q2.id AS q_id,
    ed.id AS exam_id
  FROM exam_questions q2
  JOIN exam_definitions ed ON ed.is_published = true
  JOIN exam_universities eu ON eu.id = ed.university_id
  JOIN exam_courses ec ON ec.id = ed.course_id
  WHERE q2.exam_id IS NULL
    AND q2.university IS NOT NULL
    AND q2.course_code IS NOT NULL
    AND (
      LOWER(REPLACE(eu.name, ',', '')) = LOWER(REPLACE(q2.university, ',', ''))
      OR LOWER(eu.name) LIKE '%' || LOWER(q2.university) || '%'
      OR LOWER(q2.university) LIKE '%' || LOWER(eu.name) || '%'
      OR (eu.short_name IS NOT NULL AND LOWER(q2.university) LIKE '%' || LOWER(eu.short_name) || '%')
    )
    AND LOWER(ec.code) = LOWER(q2.course_code)
    AND ABS(COALESCE(ed.year, 0) - COALESCE(q2.year, 0)) <= 2
  ORDER BY q2.id, ABS(COALESCE(ed.year, 0) - COALESCE(q2.year, 0))
) best_match
WHERE q.id = best_match.q_id;

-- Log results for verification
DO $$
DECLARE
  linked_count INTEGER;
  unlinked_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO linked_count FROM exam_questions WHERE exam_id IS NOT NULL;
  SELECT COUNT(*) INTO unlinked_count FROM exam_questions WHERE exam_id IS NULL;
  RAISE NOTICE 'Backfill complete: % questions linked, % still unlinked', linked_count, unlinked_count;
END $$;
