-- Two-user isolation test for the Research Lab server-only data model.
-- Runs only in the disposable PostgreSQL service container used by GitHub Actions.
-- No production user IDs or data are used.

BEGIN;

INSERT INTO auth.users (id) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

SET LOCAL ROLE service_role;

INSERT INTO public.research_cases (id, owner_user_id, title)
VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Tenant A test case'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Tenant B test case');

INSERT INTO public.research_case_reviewers (case_id, reviewer_user_id, assigned_by)
VALUES (
  'aaaaaaaa-0000-4000-8000-000000000001',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
);

INSERT INTO public.research_case_approvals
  (case_id, plan_hash, target_origin, target_path, method, test_category, reviewer_user_id)
VALUES (
  'aaaaaaaa-0000-4000-8000-000000000001',
  repeat('a', 64),
  'https://owned.example',
  '/security/check',
  'GET',
  'passive_header_review',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
);

INSERT INTO public.research_case_events (case_id, actor_user_id, event_type)
VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'case.created'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'case.created');

RESET ROLE;

DO $$
DECLARE
  table_name text;
  table_names text[] := ARRAY[
    'research_cases',
    'research_case_reviewers',
    'research_case_approvals',
    'research_case_events'
  ];
BEGIN
  IF NOT (SELECT rolbypassrls FROM pg_roles WHERE rolname = 'service_role') THEN
    RAISE EXCEPTION 'service_role must bypass RLS as in Supabase';
  END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.research_cases'::regclass) THEN
    RAISE EXCEPTION 'Research Lab RLS is not enabled';
  END IF;

  IF NOT (SELECT bool_and(relrowsecurity)
          FROM pg_class
          WHERE oid IN (
            'public.research_cases'::regclass,
            'public.research_case_reviewers'::regclass,
            'public.research_case_approvals'::regclass,
            'public.research_case_events'::regclass
          )) THEN
    RAISE EXCEPTION 'RLS must be enabled on all Research Lab tables';
  END IF;

  FOREACH table_name IN ARRAY table_names LOOP
    IF has_table_privilege('anon', format('public.%I', table_name), 'SELECT')
       OR has_table_privilege('authenticated', format('public.%I', table_name), 'SELECT')
       OR has_table_privilege('authenticated', format('public.%I', table_name), 'INSERT')
       OR has_table_privilege('authenticated', format('public.%I', table_name), 'UPDATE')
       OR has_table_privilege('authenticated', format('public.%I', table_name), 'DELETE') THEN
      RAISE EXCEPTION 'Client role unexpectedly has direct privileges on %', table_name;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policy p
      WHERE p.polrelid = format('public.%I', table_name)::regclass
        AND p.polname = CASE table_name
          WHEN 'research_cases' THEN 'No direct client access to research cases'
          WHEN 'research_case_reviewers' THEN 'No direct client access to research case reviewers'
          WHEN 'research_case_approvals' THEN 'No direct client access to research case approvals'
          ELSE 'No direct client access to research case events'
        END
        AND pg_get_expr(p.polqual, p.polrelid) = 'false'
        AND pg_get_expr(p.polwithcheck, p.polrelid) = 'false'
    ) THEN
      RAISE EXCEPTION 'Explicit deny-all RLS policy missing or weakened on %', table_name;
    END IF;
  END LOOP;
END
$$;

SET LOCAL ROLE service_role;
DO $$
BEGIN
  IF (SELECT count(*) FROM public.research_cases) <> 2
     OR (SELECT count(*) FROM public.research_case_reviewers) <> 1
     OR (SELECT count(*) FROM public.research_case_approvals) <> 1
     OR (SELECT count(*) FROM public.research_case_events) <> 2 THEN
    RAISE EXCEPTION 'Trusted service role cannot read the expected fixture rows';
  END IF;
END
$$;
RESET ROLE;

SET LOCAL ROLE authenticated;
DO $$
DECLARE
  test_user uuid;
  table_name text;
  table_names text[] := ARRAY[
    'research_cases',
    'research_case_reviewers',
    'research_case_approvals',
    'research_case_events'
  ];
  visible_rows bigint;
BEGIN
  FOREACH test_user IN ARRAY ARRAY[
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid
  ] LOOP
    PERFORM set_config('request.jwt.claim.sub', test_user::text, true);

    FOREACH table_name IN ARRAY table_names LOOP
      BEGIN
        EXECUTE format('SELECT count(*) FROM public.%I', table_name) INTO visible_rows;
        RAISE EXCEPTION 'User % unexpectedly read % row(s) from %', test_user, visible_rows, table_name;
      EXCEPTION
        WHEN insufficient_privilege THEN
          NULL;
      END;
    END LOOP;
  END LOOP;
END
$$;
RESET ROLE;

SET LOCAL ROLE anon;
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'research_cases',
    'research_case_reviewers',
    'research_case_approvals',
    'research_case_events'
  ] LOOP
    BEGIN
      EXECUTE format('SELECT count(*) FROM public.%I', table_name);
      RAISE EXCEPTION 'anon unexpectedly accessed %', table_name;
    EXCEPTION
      WHEN insufficient_privilege THEN
        NULL;
    END;
  END LOOP;
END
$$;
RESET ROLE;

ROLLBACK;

SELECT 'PASS: two distinct authenticated users and anon cannot read Research Lab case, reviewer, approval, or audit records; service_role can.' AS result;
