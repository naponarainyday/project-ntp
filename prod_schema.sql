-- Session Setup

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

CREATE SCHEMA IF NOT EXISTS "public";

ALTER SCHEMA "public" OWNER TO "postgres";

-- Schema Comment

COMMENT ON SCHEMA "public" IS 'standard public schema';

-- Functions

CREATE OR REPLACE FUNCTION "public"."apply_verified_business_overwrite"("p_profile_id" "uuid", "p_business_id" "uuid", "p_tax_id" "text", "p_company_name" "text", "p_rep_name" "text", "p_business_type" "text" DEFAULT NULL::"text", "p_business_item" "text" DEFAULT NULL::"text", "p_address" "text" DEFAULT NULL::"text", "p_bolta_customer_key" "text" DEFAULT NULL::"text", "p_cert_expires_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_verification_method" "text" DEFAULT 'bolta'::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_now timestamptz := now();
begin
  if p_profile_id is null or p_business_id is null then
    raise exception 'profile_id and business_id are required';
  end if;

  if p_tax_id is null or length(trim(p_tax_id)) < 5 then
    raise exception 'tax_id looks invalid';
  end if;

  -- 1) lock profile
  perform 1
  from public.profiles
  where id = p_profile_id
  for update;

  if not found then
    raise exception 'profile not found: %', p_profile_id;
  end if;

  -- 2) upsert pbv (?ъ씤利??쒕룄 濡쒓렇: requested_at 媛깆떊)
  insert into public.profile_business_verifications (
    profile_id,
    business_id,
    status,
    requested_at,
    created_at,
    updated_at
  )
  values (
    p_profile_id,
    p_business_id,
    'pending',
    v_now,
    v_now,
    v_now
  )
  on conflict (profile_id)
  do update set
    business_id = excluded.business_id,
    requested_at = v_now,
    updated_at = v_now;

  -- lock pbv row
  perform 1
  from public.profile_business_verifications
  where profile_id = p_profile_id
  for update;

  -- 3) lock business row
  perform 1
  from public.businesses
  where id = p_business_id
  for update;

  if not found then
    raise exception 'business not found: %', p_business_id;
  end if;

  -- 4) overwrite businesses with verified data
  update public.businesses
  set
    tax_id = p_tax_id,
    company_name = p_company_name,
    rep_name = p_rep_name,
    business_type = p_business_type,
    business_item = p_business_item,
    address = p_address,
    updated_at = v_now
  where id = p_business_id;

  -- 5) upsert business_bolta (optional)
  if p_bolta_customer_key is not null then
    insert into public.business_bolta (
      business_id,
      bolta_customer_key,
      cert_status,
      cert_expires_at,
      registered_by_profile_id,
      registered_at,
      created_at,
      updated_at
    )
    values (
      p_business_id,
      p_bolta_customer_key,
      'verified',
      p_cert_expires_at,
      p_profile_id,
      v_now,
      v_now,
      v_now
    )
    on conflict (business_id)
    do update set
      bolta_customer_key = excluded.bolta_customer_key,
      cert_status = 'verified',
      cert_expires_at = excluded.cert_expires_at,
      registered_by_profile_id = excluded.registered_by_profile_id,
      registered_at = excluded.registered_at,
      updated_at = v_now;

    -- lock business_bolta row
    perform 1
    from public.business_bolta
    where business_id = p_business_id
    for update;
  end if;

  -- 6) ??overwrite profiles too (display consistency) with bypass flag
  perform set_config('app.bypass_profile_lock', '1', true);

  update public.profiles
  set
    tax_id = p_tax_id,
    company_name = p_company_name,
    rep_name = p_rep_name,
    business_type = p_business_type,
    business_item = p_business_item,
    updated_at = v_now
  where id = p_profile_id;

  -- 7) finalize pbv as verified (snapshots + timestamps)
  update public.profile_business_verifications
  set
    business_id = p_business_id,
    status = 'verified',
    verified_at = v_now,
    locked_at = coalesce(locked_at, v_now),
    verified_tax_id = p_tax_id,
    verified_company_name = p_company_name,
    verified_rep_name = p_rep_name,
    verification_method = p_verification_method,
    verified_by_profile_id = p_profile_id,
    updated_at = v_now
  where profile_id = p_profile_id;

  return p_business_id;
end;
$$;

ALTER FUNCTION "public"."apply_verified_business_overwrite"("p_profile_id" "uuid", "p_business_id" "uuid", "p_tax_id" "text", "p_company_name" "text", "p_rep_name" "text", "p_business_type" "text", "p_business_item" "text", "p_address" "text", "p_bolta_customer_key" "text", "p_cert_expires_at" timestamp with time zone, "p_verification_method" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."enforce_profile_business_lock"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_status text;
  v_bypass text;
begin
  -- ???쒕쾭/RPC?먯꽌留??고쉶 ?덉슜 (?몃옖??뀡 濡쒖뺄 GUC)
  v_bypass := current_setting('app.bypass_profile_lock', true);
  if v_bypass = '1' then
    return new;
  end if;

  select status into v_status
  from public.profile_business_verifications
  where profile_id = old.id;

  if v_status = 'verified' then
    if (new.company_name is distinct from old.company_name)
      or (new.tax_id is distinct from old.tax_id)
      or (new.rep_name is distinct from old.rep_name)
      or (new.business_type is distinct from old.business_type)
      or (new.business_item is distinct from old.business_item)
    then
      raise exception 'Profile business fields are locked after verification. Re-verify to change.';
    end if;
  end if;

  return new;
end;
$$;

ALTER FUNCTION "public"."enforce_profile_business_lock"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."recalc_invoice_request_totals"("p_request_id" "uuid") RETURNS "void"
    LANGUAGE "sql"
    AS $$
  update public.invoice_requests r
  set
    total_amount = coalesce((
      select sum(i.amount_snapshot)
      from public.invoice_request_items i
      where i.invoice_request_id = p_request_id
    ), 0),
    total_count = coalesce((
      select count(*)
      from public.invoice_request_items i
      where i.invoice_request_id = p_request_id
    ), 0),
    vat_amount = coalesce((
      select sum(
        coalesce(
          nullif((i.tax_snapshot->>'vat_amount')::numeric, null),
          nullif((i.tax_snapshot->>'vat')::numeric, null),
          nullif((i.tax_snapshot->>'tax_amount')::numeric, null),
          0
        )
      )
      from public.invoice_request_items i
      where i.invoice_request_id = p_request_id
    ), 0),
    updated_at = now()
  where r.id = p_request_id;
$$;

ALTER FUNCTION "public"."recalc_invoice_request_totals"("p_request_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."set_receipts_user_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.user_id := auth.uid();
  return new;
end;
$$;

ALTER FUNCTION "public"."set_receipts_user_id"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;

ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."trg_invoice_request_items_recalc"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if (tg_op = 'INSERT') then
    perform public.recalc_invoice_request_totals(new.invoice_request_id);
    return new;
  elsif (tg_op = 'DELETE') then
    perform public.recalc_invoice_request_totals(old.invoice_request_id);
    return old;
  else
    perform public.recalc_invoice_request_totals(new.invoice_request_id);
    return new;
  end if;
end;
$$;

ALTER FUNCTION "public"."trg_invoice_request_items_recalc"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."whoami"() RETURNS json
    LANGUAGE "sql" STABLE
    AS $$
  select json_build_object(
    'uid', auth.uid(),
    'role', auth.role()
  );
$$;

ALTER FUNCTION "public"."whoami"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";

-- Tables

CREATE TABLE IF NOT EXISTS "public"."business_bolta" (
    "business_id" "uuid" NOT NULL,
    "bolta_customer_key" "text" NOT NULL,
    "cert_status" "text" DEFAULT 'none'::"text" NOT NULL,
    "cert_expires_at" timestamp with time zone,
    "registered_by_profile_id" "uuid",
    "registered_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_verified_at" timestamp with time zone,
    CONSTRAINT "business_bolta_cert_status_check" CHECK (("cert_status" = ANY (ARRAY['none'::"text", 'pending'::"text", 'registered'::"text", 'verified'::"text", 'failed'::"text", 'expired'::"text", 'revoked'::"text", 'unknown'::"text"])))
);

ALTER TABLE "public"."business_bolta" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."business_emails" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "is_primary" boolean DEFAULT true NOT NULL,
    "status" "text" DEFAULT 'unverified'::"text" NOT NULL,
    "verified_at" timestamp with time zone,
    "verification_method" "text",
    "created_by_profile_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "business_emails_email_format" CHECK ((POSITION(('@'::"text") IN ("email")) > 1)),
    CONSTRAINT "business_emails_status_check" CHECK (("status" = ANY (ARRAY['unverified'::"text", 'verified'::"text", 'superseded'::"text"]))),
    CONSTRAINT "business_emails_verified_requires_time" CHECK ((("status" <> 'verified'::"text") OR ("verified_at" IS NOT NULL)))
);

ALTER TABLE "public"."business_emails" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."businesses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tax_id" "text" NOT NULL,
    "company_name" "text" NOT NULL,
    "rep_name" "text" NOT NULL,
    "business_type" "text",
    "business_item" "text",
    "address" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."businesses" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."email_verifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_email_id" "uuid" NOT NULL,
    "token_hash" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "consumed_at" timestamp with time zone,
    "sent_to_email" "text" NOT NULL,
    "created_by_profile_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "email_verifications_token_hash_len" CHECK (("length"("token_hash") >= 32))
);

ALTER TABLE "public"."email_verifications" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."invoice_request_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_request_id" "uuid" NOT NULL,
    "receipt_id" "uuid" NOT NULL,
    "amount_snapshot" numeric(12,2) NOT NULL,
    "tax_snapshot" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "invoice_request_items_amount_snapshot_check" CHECK (("amount_snapshot" >= (0)::numeric))
);

ALTER TABLE "public"."invoice_request_items" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."invoice_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vendor_id" "uuid" NOT NULL,
    "requester_profile_id" "uuid" NOT NULL,
    "issuer_profile_id" "uuid" NOT NULL,
    "seller_business_id" "uuid" NOT NULL,
    "buyer_business_id" "uuid",
    "buyer_snapshot" "jsonb",
    "tax_category" "text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "memo" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "submitted_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "request_title" "text",
    "period_start" "date",
    "period_end" "date",
    "total_amount" numeric(12,2),
    "total_count" integer,
    "needs_fix_reason" "text",
    "accepted_at" timestamp with time zone,
    "issued_at" timestamp with time zone,
    "rejected_at" timestamp with time zone,
    "updated_by_profile_id" "uuid",
    "thread_id" "uuid",
    "vat_amount" numeric(12,2),
    CONSTRAINT "invoice_requests_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'submitted'::"text", 'accepted'::"text", 'issuing'::"text", 'issued'::"text", 'rejected'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "invoice_requests_tax_category_check" CHECK (("tax_category" = ANY (ARRAY['taxable'::"text", 'exempt'::"text"])))
);

ALTER TABLE "public"."invoice_requests" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_request_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'issuing'::"text" NOT NULL,
    "bolta_issue_key" "text",
    "issued_at" timestamp with time zone,
    "payload" "jsonb",
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "invoices_status_check" CHECK (("status" = ANY (ARRAY['issuing'::"text", 'issued'::"text", 'failed'::"text", 'voided'::"text"])))
);

ALTER TABLE "public"."invoices" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."issuer_accounts" (
    "profile_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'inactive'::"text" NOT NULL,
    "issuer_confirmed" boolean DEFAULT false NOT NULL,
    "confirmed_at" timestamp with time zone,
    "business_verified_cache" boolean DEFAULT false NOT NULL,
    "email_verified_cache" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "issuer_accounts_status_check" CHECK (("status" = ANY (ARRAY['inactive'::"text", 'pending'::"text", 'active'::"text", 'suspended'::"text"])))
);

ALTER TABLE "public"."issuer_accounts" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."markets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text",
    "sort_order" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."markets" OWNER TO "postgres";

COMMENT ON TABLE "public"."markets" IS '怨좏꽣, ?묒옱???쒖옣 援щ텇';

CREATE TABLE IF NOT EXISTS "public"."profile_business_verifications" (
    "profile_id" "uuid" NOT NULL,
    "business_id" "uuid",
    "status" "text" DEFAULT 'unverified'::"text" NOT NULL,
    "verified_at" timestamp with time zone,
    "locked_at" timestamp with time zone,
    "verified_tax_id" "text",
    "verified_company_name" "text",
    "verified_rep_name" "text",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "requested_at" timestamp with time zone,
    "verified_by_profile_id" "uuid",
    "verification_method" "text",
    CONSTRAINT "pbv_verified_requires_fields" CHECK ((("status" <> 'verified'::"text") OR (("business_id" IS NOT NULL) AND ("verified_at" IS NOT NULL) AND ("locked_at" IS NOT NULL)))),
    CONSTRAINT "profile_business_verifications_status_check" CHECK (("status" = ANY (ARRAY['unverified'::"text", 'pending'::"text", 'verified'::"text", 'rejected'::"text", 'revoked'::"text"])))
);

ALTER TABLE "public"."profile_business_verifications" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "company_name" "text" NOT NULL,
    "tax_id" "text" NOT NULL,
    "email" "text" NOT NULL,
    "rep_name" "text" NOT NULL,
    "business_type" "text",
    "business_item" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE "public"."profiles" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."receipt_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "receipt_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "path" "text" NOT NULL,
    "sort_order" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "receipt_images_sort_order_check" CHECK (("sort_order" >= 1))
);

ALTER TABLE "public"."receipt_images" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."receipts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "vendor_id" "uuid",
    "receipt_date" "date",
    "amount" numeric,
    "payment_method" "text",
    "receipt_type" "text" DEFAULT 'standard'::"text",
    "status" "text" DEFAULT 'uploaded'::"text",
    "memo" "text",
    "image_path" "text",
    "deposit_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "image_paths" "text"[],
    "tax_type" "text" DEFAULT 'tax_free'::"text" NOT NULL,
    "vat_amount" integer DEFAULT 0 NOT NULL,
    "total_amount" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "receipts_tax_type_check" CHECK (("tax_type" = ANY (ARRAY['tax_free'::"text", 'tax'::"text", 'zero_rate'::"text"])))
);

ALTER TABLE "public"."receipts" OWNER TO "postgres";

COMMENT ON TABLE "public"."receipts" IS '?곸닔利?媛?;

CREATE TABLE IF NOT EXISTS "public"."vendor_threads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "requester_profile_id" "uuid" NOT NULL,
    "vendor_id" "uuid" NOT NULL,
    "status_summary" "text",
    "last_request_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "vendor_threads_status_summary_chk" CHECK ((("status_summary" IS NULL) OR ("status_summary" = ANY (ARRAY['draft'::"text", 'submitted'::"text", 'accepted'::"text", 'issuing'::"text", 'issued'::"text", 'rejected'::"text", 'cancelled'::"text", 'needs_fix'::"text"]))))
);

ALTER TABLE "public"."vendor_threads" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."vendors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text",
    "market_id" "uuid",
    "invoice_capability" "text" DEFAULT 'not_supported'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "linked_user_id" "uuid",
    "stall_no" "text"
);

ALTER TABLE "public"."vendors" OWNER TO "postgres";

COMMENT ON TABLE "public"."vendors" IS '?곴? (?꾨ℓ??';

-- Views

CREATE OR REPLACE VIEW "public"."v_requests_dashboard" AS
 WITH "my_threads" AS (
         SELECT "vt"."id" AS "thread_id",
            "vt"."vendor_id",
            "vt"."requester_profile_id"
           FROM "public"."vendor_threads" "vt"
          WHERE ("vt"."requester_profile_id" = "auth"."uid"())
        ), "reqs" AS (
         SELECT "r"."id",
            "r"."vendor_id",
            "r"."requester_profile_id",
            "r"."issuer_profile_id",
            "r"."seller_business_id",
            "r"."buyer_business_id",
            "r"."buyer_snapshot",
            "r"."tax_category",
            "r"."status",
            "r"."memo",
            "r"."created_at",
            "r"."submitted_at",
            "r"."updated_at",
            "r"."request_title",
            "r"."period_start",
            "r"."period_end",
            "r"."total_amount",
            "r"."total_count",
            "r"."needs_fix_reason",
            "r"."accepted_at",
            "r"."issued_at",
            "r"."rejected_at",
            "r"."updated_by_profile_id",
            "r"."thread_id",
            "r"."vat_amount",
                CASE
                    WHEN ("r"."status" = 'rejected'::"text") THEN 1
                    WHEN ("r"."status" = ANY (ARRAY['submitted'::"text", 'accepted'::"text", 'issuing'::"text"])) THEN 2
                    WHEN ("r"."status" = 'draft'::"text") THEN 3
                    WHEN ("r"."status" = 'issued'::"text") THEN 4
                    WHEN ("r"."status" = 'cancelled'::"text") THEN 5
                    ELSE 9
                END AS "status_priority",
                CASE
                    WHEN ("r"."status" = 'rejected'::"text") THEN 'needs_fix'::"text"
                    WHEN ("r"."status" = ANY (ARRAY['submitted'::"text", 'accepted'::"text", 'issuing'::"text"])) THEN 'requested'::"text"
                    WHEN ("r"."status" = 'draft'::"text") THEN 'uploaded'::"text"
                    WHEN ("r"."status" = 'issued'::"text") THEN 'completed'::"text"
                    WHEN ("r"."status" = 'cancelled'::"text") THEN 'cancelled'::"text"
                    ELSE 'unknown'::"text"
                END AS "ui_status"
           FROM ("public"."invoice_requests" "r"
             JOIN "my_threads" "t_1" ON (("t_1"."thread_id" = "r"."thread_id")))
        ), "top_req" AS (
         SELECT DISTINCT ON ("reqs"."thread_id") "reqs"."thread_id",
            "reqs"."id" AS "top_request_id",
            "reqs"."ui_status",
            "reqs"."status_priority",
            "reqs"."needs_fix_reason",
            COALESCE("reqs"."submitted_at", "reqs"."created_at") AS "top_request_at"
           FROM "reqs"
          ORDER BY "reqs"."thread_id", "reqs"."status_priority", COALESCE("reqs"."submitted_at", "reqs"."created_at") DESC
        ), "top_req_amounts" AS (
         SELECT "r"."thread_id",
            ("sum"(
                CASE
                    WHEN ("r"."tax_category" = 'exempt'::"text") THEN COALESCE("r"."total_count", 0)
                    ELSE 0
                END))::integer AS "exempt_count",
            "sum"(
                CASE
                    WHEN ("r"."tax_category" = 'exempt'::"text") THEN COALESCE("r"."total_amount", (0)::numeric)
                    ELSE (0)::numeric
                END) AS "exempt_amount",
            "sum"(
                CASE
                    WHEN ("r"."tax_category" = 'exempt'::"text") THEN COALESCE("r"."vat_amount", (0)::numeric)
                    ELSE (0)::numeric
                END) AS "exempt_vat_amount",
            ("sum"(
                CASE
                    WHEN ("r"."tax_category" = 'taxable'::"text") THEN COALESCE("r"."total_count", 0)
                    ELSE 0
                END))::integer AS "taxable_count",
            "sum"(
                CASE
                    WHEN ("r"."tax_category" = 'taxable'::"text") THEN COALESCE("r"."total_amount", (0)::numeric)
                    ELSE (0)::numeric
                END) AS "taxable_amount",
            "sum"(
                CASE
                    WHEN ("r"."tax_category" = 'taxable'::"text") THEN COALESCE("r"."vat_amount", (0)::numeric)
                    ELSE (0)::numeric
                END) AS "taxable_vat_amount"
           FROM ("reqs" "r"
             JOIN "top_req" "tr_1" ON (("tr_1"."top_request_id" = "r"."id")))
          GROUP BY "r"."thread_id"
        ), "last_req" AS (
         SELECT "reqs"."thread_id",
            "max"(COALESCE("reqs"."submitted_at", "reqs"."created_at")) AS "last_request_at"
           FROM "reqs"
          GROUP BY "reqs"."thread_id"
        )
 SELECT "t"."thread_id",
    "t"."vendor_id",
    "v"."name" AS "vendor_name",
    "v"."stall_no",
    "v"."market_id",
    "m"."name" AS "market_name",
    "m"."sort_order" AS "market_sort_order",
    "tr"."ui_status" AS "status_badge",
    "tr"."status_priority",
        CASE
            WHEN ("tr"."ui_status" = 'needs_fix'::"text") THEN "tr"."needs_fix_reason"
            ELSE NULL::"text"
        END AS "needs_fix_reason",
    COALESCE("p"."exempt_count", 0) AS "exempt_count",
    COALESCE("p"."exempt_amount", (0)::numeric) AS "exempt_amount",
    COALESCE("p"."exempt_vat_amount", (0)::numeric) AS "exempt_vat_amount",
    COALESCE("p"."taxable_count", 0) AS "taxable_count",
    COALESCE("p"."taxable_amount", (0)::numeric) AS "taxable_amount",
    COALESCE("p"."taxable_vat_amount", (0)::numeric) AS "taxable_vat_amount",
    (COALESCE("p"."exempt_amount", (0)::numeric) + COALESCE("p"."taxable_amount", (0)::numeric)) AS "total_amount_sum",
    (COALESCE("p"."exempt_vat_amount", (0)::numeric) + COALESCE("p"."taxable_vat_amount", (0)::numeric)) AS "vat_amount_sum",
    "tr"."top_request_id",
    "lr"."last_request_at"
   FROM ((((("my_threads" "t"
     JOIN "public"."vendors" "v" ON (("v"."id" = "t"."vendor_id")))
     LEFT JOIN "public"."markets" "m" ON (("m"."id" = "v"."market_id")))
     LEFT JOIN "top_req" "tr" ON (("tr"."thread_id" = "t"."thread_id")))
     LEFT JOIN "top_req_amounts" "p" ON (("p"."thread_id" = "t"."thread_id")))
     LEFT JOIN "last_req" "lr" ON (("lr"."thread_id" = "t"."thread_id")));

ALTER VIEW "public"."v_requests_dashboard" OWNER TO "postgres";

CREATE OR REPLACE VIEW "public"."v_vendor_list_page2" WITH ("security_invoker"='true') AS
 WITH "receipt_rollup" AS (
         SELECT "r"."vendor_id",
            "count"(*) AS "receipt_count",
            "bool_or"(("r"."status" = 'needs_fix'::"text")) AS "has_needs_fix",
            "bool_or"(("r"."status" = 'requested'::"text")) AS "has_requested",
            "bool_or"(("r"."status" = 'uploaded'::"text")) AS "has_uploaded",
            "bool_and"(("r"."status" = 'completed'::"text")) AS "all_completed"
           FROM "public"."receipts" "r"
          GROUP BY "r"."vendor_id"
        )
 SELECT "v"."id" AS "vendor_id",
    "v"."name",
    "v"."stall_no",
    "v"."invoice_capability",
    "v"."market_id",
    "m"."name" AS "market_name",
    "m"."sort_order" AS "market_sort_order",
        CASE
            WHEN COALESCE("rr"."has_needs_fix", false) THEN 'needs_fix'::"text"
            WHEN COALESCE("rr"."has_requested", false) THEN 'requested'::"text"
            WHEN COALESCE("rr"."has_uploaded", false) THEN 'uploaded'::"text"
            WHEN ((COALESCE("rr"."receipt_count", (0)::bigint) > 0) AND COALESCE("rr"."all_completed", false)) THEN 'completed'::"text"
            ELSE NULL::"text"
        END AS "status_summary",
        CASE
            WHEN COALESCE("rr"."has_needs_fix", false) THEN 1
            WHEN COALESCE("rr"."has_requested", false) THEN 2
            WHEN COALESCE("rr"."has_uploaded", false) THEN 3
            WHEN ((COALESCE("rr"."receipt_count", (0)::bigint) > 0) AND COALESCE("rr"."all_completed", false)) THEN 4
            ELSE 5
        END AS "status_priority",
    (NULLIF("regexp_replace"(COALESCE("v"."stall_no", ''::"text"), '[^0-9]'::"text", ''::"text", 'g'::"text"), ''::"text"))::integer AS "stall_no_num"
   FROM (("public"."vendors" "v"
     LEFT JOIN "public"."markets" "m" ON (("m"."id" = "v"."market_id")))
     LEFT JOIN "receipt_rollup" "rr" ON (("rr"."vendor_id" = "v"."id")));

ALTER VIEW "public"."v_vendor_list_page2" OWNER TO "postgres";

ALTER TABLE ONLY "public"."business_bolta"
    ADD CONSTRAINT "business_bolta_bolta_customer_key_key" UNIQUE ("bolta_customer_key");

ALTER TABLE ONLY "public"."business_bolta"
    ADD CONSTRAINT "business_bolta_pkey" PRIMARY KEY ("business_id");

ALTER TABLE ONLY "public"."business_emails"
    ADD CONSTRAINT "business_emails_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."businesses"
    ADD CONSTRAINT "businesses_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."businesses"
    ADD CONSTRAINT "businesses_tax_id_unique" UNIQUE ("tax_id");

ALTER TABLE ONLY "public"."email_verifications"
    ADD CONSTRAINT "email_verifications_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."invoice_request_items"
    ADD CONSTRAINT "invoice_request_items_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."invoice_requests"
    ADD CONSTRAINT "invoice_requests_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."issuer_accounts"
    ADD CONSTRAINT "issuer_accounts_pkey" PRIMARY KEY ("profile_id");

ALTER TABLE ONLY "public"."markets"
    ADD CONSTRAINT "markets_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."profile_business_verifications"
    ADD CONSTRAINT "profile_business_verifications_pkey" PRIMARY KEY ("profile_id");

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."receipt_images"
    ADD CONSTRAINT "receipt_images_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."receipt_images"
    ADD CONSTRAINT "receipt_images_receipt_id_sort_order_key" UNIQUE ("receipt_id", "sort_order");

ALTER TABLE ONLY "public"."receipts"
    ADD CONSTRAINT "receipts_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."vendor_threads"
    ADD CONSTRAINT "vendor_threads_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."vendors"
    ADD CONSTRAINT "vendors_pkey" PRIMARY KEY ("id");

-- Constraints and Indexes

CREATE INDEX "business_bolta_cert_expires_idx" ON "public"."business_bolta" USING "btree" ("cert_expires_at");

CREATE UNIQUE INDEX "business_emails_business_email_uidx" ON "public"."business_emails" USING "btree" ("business_id", "lower"("email"));

CREATE UNIQUE INDEX "business_emails_single_primary_uidx" ON "public"."business_emails" USING "btree" ("business_id") WHERE (("is_primary" = true) AND ("status" = ANY (ARRAY['unverified'::"text", 'verified'::"text"])));

CREATE INDEX "email_verifications_email_expires_idx" ON "public"."email_verifications" USING "btree" ("business_email_id", "expires_at");

CREATE UNIQUE INDEX "email_verifications_token_hash_uidx" ON "public"."email_verifications" USING "btree" ("token_hash");

CREATE INDEX "invoice_request_items_request_idx" ON "public"."invoice_request_items" USING "btree" ("invoice_request_id");

CREATE UNIQUE INDEX "invoice_request_items_unique_receipt_uidx" ON "public"."invoice_request_items" USING "btree" ("invoice_request_id", "receipt_id");

CREATE INDEX "invoice_requests_issuer_status_idx" ON "public"."invoice_requests" USING "btree" ("issuer_profile_id", "status");

CREATE INDEX "invoice_requests_requester_idx" ON "public"."invoice_requests" USING "btree" ("requester_profile_id");

CREATE INDEX "invoice_requests_seller_status_idx" ON "public"."invoice_requests" USING "btree" ("seller_business_id", "status");

CREATE INDEX "invoice_requests_status_created_idx" ON "public"."invoice_requests" USING "btree" ("status", "created_at" DESC);

CREATE INDEX "invoice_requests_thread_idx" ON "public"."invoice_requests" USING "btree" ("thread_id", "created_at" DESC);

CREATE INDEX "invoice_requests_vendor_idx" ON "public"."invoice_requests" USING "btree" ("vendor_id");

CREATE INDEX "invoice_requests_vendor_tax_idx" ON "public"."invoice_requests" USING "btree" ("vendor_id", "tax_category", "status");

CREATE UNIQUE INDEX "invoices_bolta_issue_key_uidx" ON "public"."invoices" USING "btree" ("bolta_issue_key") WHERE ("bolta_issue_key" IS NOT NULL);

CREATE INDEX "invoices_request_status_idx" ON "public"."invoices" USING "btree" ("invoice_request_id", "status");

CREATE UNIQUE INDEX "pbv_unique_active_business" ON "public"."profile_business_verifications" USING "btree" ("business_id") WHERE ("status" = ANY (ARRAY['pending'::"text", 'verified'::"text"]));

CREATE UNIQUE INDEX "receipt_images_receipt_id_sort_order_idx" ON "public"."receipt_images" USING "btree" ("receipt_id", "sort_order");

CREATE UNIQUE INDEX "receipt_images_receipt_id_sort_order_uniq" ON "public"."receipt_images" USING "btree" ("receipt_id", "sort_order");

CREATE INDEX "vendor_threads_requester_last_idx" ON "public"."vendor_threads" USING "btree" ("requester_profile_id", COALESCE("last_request_at", "created_at") DESC);

CREATE UNIQUE INDEX "vendor_threads_unique_uidx" ON "public"."vendor_threads" USING "btree" ("requester_profile_id", "vendor_id");

CREATE INDEX "vendors_market_id_name_idx" ON "public"."vendors" USING "btree" ("market_id", "name");

CREATE OR REPLACE TRIGGER "trg_business_bolta_updated_at" BEFORE UPDATE ON "public"."business_bolta" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "trg_business_emails_updated_at" BEFORE UPDATE ON "public"."business_emails" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "trg_businesses_updated_at" BEFORE UPDATE ON "public"."businesses" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "trg_invoice_request_items_recalc" AFTER INSERT OR DELETE OR UPDATE ON "public"."invoice_request_items" FOR EACH ROW EXECUTE FUNCTION "public"."trg_invoice_request_items_recalc"();

CREATE OR REPLACE TRIGGER "trg_invoice_requests_updated_at" BEFORE UPDATE ON "public"."invoice_requests" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "trg_invoices_updated_at" BEFORE UPDATE ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "trg_issuer_accounts_updated_at" BEFORE UPDATE ON "public"."issuer_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "trg_profile_biz_verif_updated_at" BEFORE UPDATE ON "public"."profile_business_verifications" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "trg_profiles_business_lock" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_profile_business_lock"();

CREATE OR REPLACE TRIGGER "trg_set_receipts_user_id" BEFORE INSERT ON "public"."receipts" FOR EACH ROW EXECUTE FUNCTION "public"."set_receipts_user_id"();

CREATE OR REPLACE TRIGGER "trg_vendor_threads_updated_at" BEFORE UPDATE ON "public"."vendor_threads" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

ALTER TABLE ONLY "public"."business_bolta"
    ADD CONSTRAINT "business_bolta_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."business_bolta"
    ADD CONSTRAINT "business_bolta_registered_by_profile_id_fkey" FOREIGN KEY ("registered_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."business_emails"
    ADD CONSTRAINT "business_emails_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."business_emails"
    ADD CONSTRAINT "business_emails_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."email_verifications"
    ADD CONSTRAINT "email_verifications_business_email_id_fkey" FOREIGN KEY ("business_email_id") REFERENCES "public"."business_emails"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."email_verifications"
    ADD CONSTRAINT "email_verifications_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."invoice_request_items"
    ADD CONSTRAINT "invoice_request_items_invoice_request_id_fkey" FOREIGN KEY ("invoice_request_id") REFERENCES "public"."invoice_requests"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."invoice_request_items"
    ADD CONSTRAINT "invoice_request_items_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "public"."receipts"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."invoice_requests"
    ADD CONSTRAINT "invoice_requests_buyer_business_id_fkey" FOREIGN KEY ("buyer_business_id") REFERENCES "public"."businesses"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."invoice_requests"
    ADD CONSTRAINT "invoice_requests_issuer_profile_id_fkey" FOREIGN KEY ("issuer_profile_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."invoice_requests"
    ADD CONSTRAINT "invoice_requests_requester_profile_id_fkey" FOREIGN KEY ("requester_profile_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."invoice_requests"
    ADD CONSTRAINT "invoice_requests_seller_business_id_fkey" FOREIGN KEY ("seller_business_id") REFERENCES "public"."businesses"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."invoice_requests"
    ADD CONSTRAINT "invoice_requests_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."vendor_threads"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."invoice_requests"
    ADD CONSTRAINT "invoice_requests_updated_by_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."invoice_requests"
    ADD CONSTRAINT "invoice_requests_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_invoice_request_id_fkey" FOREIGN KEY ("invoice_request_id") REFERENCES "public"."invoice_requests"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."issuer_accounts"
    ADD CONSTRAINT "issuer_accounts_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."profile_business_verifications"
    ADD CONSTRAINT "profile_business_verifications_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."profile_business_verifications"
    ADD CONSTRAINT "profile_business_verifications_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."profile_business_verifications"
    ADD CONSTRAINT "profile_business_verifications_verified_by_profile_id_fkey" FOREIGN KEY ("verified_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."receipt_images"
    ADD CONSTRAINT "receipt_images_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "public"."receipts"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."receipt_images"
    ADD CONSTRAINT "receipt_images_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."receipts"
    ADD CONSTRAINT "receipts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."receipts"
    ADD CONSTRAINT "receipts_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."vendor_threads"
    ADD CONSTRAINT "vendor_threads_requester_profile_id_fkey" FOREIGN KEY ("requester_profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."vendor_threads"
    ADD CONSTRAINT "vendor_threads_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE RESTRICT;

ALTER TABLE ONLY "public"."vendors"
    ADD CONSTRAINT "vendors_linked_user_id_fkey" FOREIGN KEY ("linked_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."vendors"
    ADD CONSTRAINT "vendors_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE SET NULL;

-- RLS and Policies

CREATE POLICY "Markets are publicly readable" ON "public"."markets" FOR SELECT USING (true);

CREATE POLICY "Vendors are publicly readable" ON "public"."vendors" FOR SELECT USING (true);

ALTER TABLE "public"."business_bolta" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "business_bolta_insert_owner" ON "public"."business_bolta" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profile_business_verifications" "pbv"
  WHERE (("pbv"."business_id" = "business_bolta"."business_id") AND ("pbv"."profile_id" = "auth"."uid"()) AND ("pbv"."status" = ANY (ARRAY['pending'::"text", 'verified'::"text"]))))));

CREATE POLICY "business_bolta_select_owner" ON "public"."business_bolta" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profile_business_verifications" "pbv"
  WHERE (("pbv"."business_id" = "business_bolta"."business_id") AND ("pbv"."profile_id" = "auth"."uid"()) AND ("pbv"."status" = ANY (ARRAY['pending'::"text", 'verified'::"text"]))))));

CREATE POLICY "business_bolta_update_owner" ON "public"."business_bolta" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profile_business_verifications" "pbv"
  WHERE (("pbv"."business_id" = "business_bolta"."business_id") AND ("pbv"."profile_id" = "auth"."uid"()) AND ("pbv"."status" = ANY (ARRAY['pending'::"text", 'verified'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profile_business_verifications" "pbv"
  WHERE (("pbv"."business_id" = "business_bolta"."business_id") AND ("pbv"."profile_id" = "auth"."uid"()) AND ("pbv"."status" = ANY (ARRAY['pending'::"text", 'verified'::"text"]))))));

ALTER TABLE "public"."business_emails" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "business_emails_delete_owner" ON "public"."business_emails" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profile_business_verifications" "pbv"
  WHERE (("pbv"."business_id" = "business_emails"."business_id") AND ("pbv"."profile_id" = "auth"."uid"()) AND ("pbv"."status" = ANY (ARRAY['pending'::"text", 'verified'::"text"]))))));

CREATE POLICY "business_emails_insert_owner" ON "public"."business_emails" FOR INSERT WITH CHECK ((("created_by_profile_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."profile_business_verifications" "pbv"
  WHERE (("pbv"."business_id" = "business_emails"."business_id") AND ("pbv"."profile_id" = "auth"."uid"()) AND ("pbv"."status" = ANY (ARRAY['pending'::"text", 'verified'::"text"])))))));

CREATE POLICY "business_emails_select_owner" ON "public"."business_emails" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profile_business_verifications" "pbv"
  WHERE (("pbv"."business_id" = "business_emails"."business_id") AND ("pbv"."profile_id" = "auth"."uid"()) AND ("pbv"."status" = ANY (ARRAY['pending'::"text", 'verified'::"text"]))))));

CREATE POLICY "business_emails_update_owner" ON "public"."business_emails" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profile_business_verifications" "pbv"
  WHERE (("pbv"."business_id" = "business_emails"."business_id") AND ("pbv"."profile_id" = "auth"."uid"()) AND ("pbv"."status" = ANY (ARRAY['pending'::"text", 'verified'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profile_business_verifications" "pbv"
  WHERE (("pbv"."business_id" = "business_emails"."business_id") AND ("pbv"."profile_id" = "auth"."uid"()) AND ("pbv"."status" = ANY (ARRAY['pending'::"text", 'verified'::"text"]))))));

ALTER TABLE "public"."businesses" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "businesses_insert_any_auth" ON "public"."businesses" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));

CREATE POLICY "businesses_select_owner" ON "public"."businesses" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profile_business_verifications" "pbv"
  WHERE (("pbv"."business_id" = "businesses"."id") AND ("pbv"."profile_id" = "auth"."uid"()) AND ("pbv"."status" = ANY (ARRAY['pending'::"text", 'verified'::"text"]))))));

CREATE POLICY "businesses_update_owner" ON "public"."businesses" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profile_business_verifications" "pbv"
  WHERE (("pbv"."business_id" = "businesses"."id") AND ("pbv"."profile_id" = "auth"."uid"()) AND ("pbv"."status" = ANY (ARRAY['pending'::"text", 'verified'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profile_business_verifications" "pbv"
  WHERE (("pbv"."business_id" = "businesses"."id") AND ("pbv"."profile_id" = "auth"."uid"()) AND ("pbv"."status" = ANY (ARRAY['pending'::"text", 'verified'::"text"]))))));

ALTER TABLE "public"."email_verifications" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_verifications_delete_owner" ON "public"."email_verifications" FOR DELETE USING (false);

CREATE POLICY "email_verifications_insert_owner" ON "public"."email_verifications" FOR INSERT WITH CHECK ((("created_by_profile_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM ("public"."business_emails" "be"
     JOIN "public"."profile_business_verifications" "pbv" ON (("pbv"."business_id" = "be"."business_id")))
  WHERE (("be"."id" = "email_verifications"."business_email_id") AND ("pbv"."profile_id" = "auth"."uid"()) AND ("pbv"."status" = ANY (ARRAY['pending'::"text", 'verified'::"text"])))))));

CREATE POLICY "email_verifications_select_owner" ON "public"."email_verifications" FOR SELECT USING (false);

CREATE POLICY "email_verifications_update_owner" ON "public"."email_verifications" FOR UPDATE USING (false) WITH CHECK (false);

ALTER TABLE "public"."invoice_request_items" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoice_request_items_delete_requester" ON "public"."invoice_request_items" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."invoice_requests" "r"
  WHERE (("r"."id" = "invoice_request_items"."invoice_request_id") AND ("r"."requester_profile_id" = "auth"."uid"())))));

CREATE POLICY "invoice_request_items_insert_requester" ON "public"."invoice_request_items" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."invoice_requests" "r"
  WHERE (("r"."id" = "invoice_request_items"."invoice_request_id") AND ("r"."requester_profile_id" = "auth"."uid"())))));

CREATE POLICY "invoice_request_items_select_party" ON "public"."invoice_request_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."invoice_requests" "r"
  WHERE (("r"."id" = "invoice_request_items"."invoice_request_id") AND (("r"."requester_profile_id" = "auth"."uid"()) OR ("r"."issuer_profile_id" = "auth"."uid"()))))));

ALTER TABLE "public"."invoice_requests" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoice_requests_insert_requester" ON "public"."invoice_requests" FOR INSERT WITH CHECK ((("requester_profile_id" = "auth"."uid"()) AND (("thread_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."vendor_threads" "vt"
  WHERE (("vt"."id" = "invoice_requests"."thread_id") AND ("vt"."requester_profile_id" = "auth"."uid"()) AND ("vt"."vendor_id" = "invoice_requests"."vendor_id")))))));

CREATE POLICY "invoice_requests_select_party" ON "public"."invoice_requests" FOR SELECT USING ((("requester_profile_id" = "auth"."uid"()) OR ("issuer_profile_id" = "auth"."uid"())));

CREATE POLICY "invoice_requests_update_party" ON "public"."invoice_requests" FOR UPDATE USING ((("requester_profile_id" = "auth"."uid"()) OR ("issuer_profile_id" = "auth"."uid"()))) WITH CHECK ((("requester_profile_id" = "auth"."uid"()) OR ("issuer_profile_id" = "auth"."uid"())));

ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices_insert_issuer" ON "public"."invoices" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."invoice_requests" "r"
  WHERE (("r"."id" = "invoices"."invoice_request_id") AND ("r"."issuer_profile_id" = "auth"."uid"())))));

CREATE POLICY "invoices_select_party" ON "public"."invoices" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."invoice_requests" "r"
  WHERE (("r"."id" = "invoices"."invoice_request_id") AND (("r"."requester_profile_id" = "auth"."uid"()) OR ("r"."issuer_profile_id" = "auth"."uid"()))))));

CREATE POLICY "invoices_update_issuer" ON "public"."invoices" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."invoice_requests" "r"
  WHERE (("r"."id" = "invoices"."invoice_request_id") AND ("r"."issuer_profile_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."invoice_requests" "r"
  WHERE (("r"."id" = "invoices"."invoice_request_id") AND ("r"."issuer_profile_id" = "auth"."uid"())))));

ALTER TABLE "public"."issuer_accounts" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "issuer_accounts_insert_own" ON "public"."issuer_accounts" FOR INSERT WITH CHECK (("profile_id" = "auth"."uid"()));

CREATE POLICY "issuer_accounts_select_own" ON "public"."issuer_accounts" FOR SELECT USING (("profile_id" = "auth"."uid"()));

CREATE POLICY "issuer_accounts_update_own" ON "public"."issuer_accounts" FOR UPDATE USING (("profile_id" = "auth"."uid"())) WITH CHECK (("profile_id" = "auth"."uid"()));

ALTER TABLE "public"."markets" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "markets_select_all" ON "public"."markets" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "pbv_insert_own" ON "public"."profile_business_verifications" FOR INSERT WITH CHECK (("profile_id" = "auth"."uid"()));

CREATE POLICY "pbv_select_own" ON "public"."profile_business_verifications" FOR SELECT USING (("profile_id" = "auth"."uid"()));

CREATE POLICY "pbv_update_own" ON "public"."profile_business_verifications" FOR UPDATE USING (("profile_id" = "auth"."uid"())) WITH CHECK (("profile_id" = "auth"."uid"()));

ALTER TABLE "public"."profile_business_verifications" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT USING (("id" = "auth"."uid"()));

CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));

CREATE POLICY "profiles_upsert_own" ON "public"."profiles" FOR INSERT WITH CHECK (("id" = "auth"."uid"()));

ALTER TABLE "public"."receipt_images" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "receipt_images_delete_own" ON "public"."receipt_images" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));

CREATE POLICY "receipt_images_insert_own" ON "public"."receipt_images" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "receipt_images_select_own" ON "public"."receipt_images" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));

CREATE POLICY "receipt_images_update_own" ON "public"."receipt_images" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));

ALTER TABLE "public"."receipts" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "receipts_delete_own" ON "public"."receipts" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));

CREATE POLICY "receipts_insert_own" ON "public"."receipts" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));

CREATE POLICY "receipts_select_own" ON "public"."receipts" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));

CREATE POLICY "receipts_update_own" ON "public"."receipts" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));

ALTER TABLE "public"."vendor_threads" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendor_threads_delete_own" ON "public"."vendor_threads" FOR DELETE USING (false);

CREATE POLICY "vendor_threads_insert_own" ON "public"."vendor_threads" FOR INSERT WITH CHECK (("requester_profile_id" = "auth"."uid"()));

CREATE POLICY "vendor_threads_select_own" ON "public"."vendor_threads" FOR SELECT USING (("requester_profile_id" = "auth"."uid"()));

CREATE POLICY "vendor_threads_update_own" ON "public"."vendor_threads" FOR UPDATE USING (("requester_profile_id" = "auth"."uid"())) WITH CHECK (("requester_profile_id" = "auth"."uid"()));

ALTER TABLE "public"."vendors" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendors_select_all" ON "public"."vendors" FOR SELECT TO "authenticated" USING (true);

REVOKE USAGE ON SCHEMA "public" FROM PUBLIC;

-- Grants

GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT ALL ON SCHEMA "public" TO "service_role";

REVOKE ALL ON FUNCTION "public"."apply_verified_business_overwrite"("p_profile_id" "uuid", "p_business_id" "uuid", "p_tax_id" "text", "p_company_name" "text", "p_rep_name" "text", "p_business_type" "text", "p_business_item" "text", "p_address" "text", "p_bolta_customer_key" "text", "p_cert_expires_at" timestamp with time zone, "p_verification_method" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."apply_verified_business_overwrite"("p_profile_id" "uuid", "p_business_id" "uuid", "p_tax_id" "text", "p_company_name" "text", "p_rep_name" "text", "p_business_type" "text", "p_business_item" "text", "p_address" "text", "p_bolta_customer_key" "text", "p_cert_expires_at" timestamp with time zone, "p_verification_method" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."apply_verified_business_overwrite"("p_profile_id" "uuid", "p_business_id" "uuid", "p_tax_id" "text", "p_company_name" "text", "p_rep_name" "text", "p_business_type" "text", "p_business_item" "text", "p_address" "text", "p_bolta_customer_key" "text", "p_cert_expires_at" timestamp with time zone, "p_verification_method" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."enforce_profile_business_lock"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_profile_business_lock"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_profile_business_lock"() TO "service_role";

GRANT ALL ON FUNCTION "public"."recalc_invoice_request_totals"("p_request_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."recalc_invoice_request_totals"("p_request_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalc_invoice_request_totals"("p_request_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."set_receipts_user_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_receipts_user_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_receipts_user_id"() TO "service_role";

GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";

GRANT ALL ON FUNCTION "public"."trg_invoice_request_items_recalc"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_invoice_request_items_recalc"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_invoice_request_items_recalc"() TO "service_role";

GRANT ALL ON FUNCTION "public"."whoami"() TO "anon";
GRANT ALL ON FUNCTION "public"."whoami"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."whoami"() TO "service_role";

GRANT ALL ON TABLE "public"."business_bolta" TO "anon";
GRANT ALL ON TABLE "public"."business_bolta" TO "authenticated";
GRANT ALL ON TABLE "public"."business_bolta" TO "service_role";

GRANT ALL ON TABLE "public"."business_emails" TO "anon";
GRANT ALL ON TABLE "public"."business_emails" TO "authenticated";
GRANT ALL ON TABLE "public"."business_emails" TO "service_role";

GRANT ALL ON TABLE "public"."businesses" TO "anon";
GRANT ALL ON TABLE "public"."businesses" TO "authenticated";
GRANT ALL ON TABLE "public"."businesses" TO "service_role";

GRANT ALL ON TABLE "public"."email_verifications" TO "anon";
GRANT ALL ON TABLE "public"."email_verifications" TO "authenticated";
GRANT ALL ON TABLE "public"."email_verifications" TO "service_role";

GRANT ALL ON TABLE "public"."invoice_request_items" TO "anon";
GRANT ALL ON TABLE "public"."invoice_request_items" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_request_items" TO "service_role";

GRANT ALL ON TABLE "public"."invoice_requests" TO "anon";
GRANT ALL ON TABLE "public"."invoice_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_requests" TO "service_role";

GRANT ALL ON TABLE "public"."invoices" TO "anon";
GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";

GRANT ALL ON TABLE "public"."issuer_accounts" TO "anon";
GRANT ALL ON TABLE "public"."issuer_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."issuer_accounts" TO "service_role";

GRANT ALL ON TABLE "public"."markets" TO "anon";
GRANT ALL ON TABLE "public"."markets" TO "authenticated";
GRANT ALL ON TABLE "public"."markets" TO "service_role";

GRANT ALL ON TABLE "public"."profile_business_verifications" TO "anon";
GRANT ALL ON TABLE "public"."profile_business_verifications" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_business_verifications" TO "service_role";

GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";

GRANT ALL ON TABLE "public"."receipt_images" TO "anon";
GRANT ALL ON TABLE "public"."receipt_images" TO "authenticated";
GRANT ALL ON TABLE "public"."receipt_images" TO "service_role";

GRANT ALL ON TABLE "public"."receipts" TO "anon";
GRANT ALL ON TABLE "public"."receipts" TO "authenticated";
GRANT ALL ON TABLE "public"."receipts" TO "service_role";

GRANT ALL ON TABLE "public"."vendor_threads" TO "anon";
GRANT ALL ON TABLE "public"."vendor_threads" TO "authenticated";
GRANT ALL ON TABLE "public"."vendor_threads" TO "service_role";

GRANT ALL ON TABLE "public"."vendors" TO "anon";
GRANT ALL ON TABLE "public"."vendors" TO "authenticated";
GRANT ALL ON TABLE "public"."vendors" TO "service_role";

GRANT ALL ON TABLE "public"."v_requests_dashboard" TO "anon";
GRANT ALL ON TABLE "public"."v_requests_dashboard" TO "authenticated";
GRANT ALL ON TABLE "public"."v_requests_dashboard" TO "service_role";

GRANT ALL ON TABLE "public"."v_vendor_list_page2" TO "anon";
GRANT ALL ON TABLE "public"."v_vendor_list_page2" TO "authenticated";
GRANT ALL ON TABLE "public"."v_vendor_list_page2" TO "service_role";

-- Default Privileges

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";

-- (2026.02.21 updated)
-- Security hardening and schema consistency patch
-- Run this block in Supabase SQL Editor.

BEGIN;

-- 1) Remove overly broad public-read policies.
DROP POLICY IF EXISTS "Markets are publicly readable" ON public.markets;
DROP POLICY IF EXISTS "Vendors are publicly readable" ON public.vendors;

-- Ensure authenticated-only read policies exist.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'markets' AND p.polname = 'markets_select_all'
  ) THEN
    CREATE POLICY markets_select_all ON public.markets FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'vendors' AND p.polname = 'vendors_select_all'
  ) THEN
    CREATE POLICY vendors_select_all ON public.vendors FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- 2) Tighten EXECUTE permissions for SECURITY DEFINER function.
REVOKE ALL ON FUNCTION public.apply_verified_business_overwrite(
  uuid, uuid, text, text, text, text, text, text, text, timestamptz, text
) FROM anon;
REVOKE ALL ON FUNCTION public.apply_verified_business_overwrite(
  uuid, uuid, text, text, text, text, text, text, text, timestamptz, text
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.apply_verified_business_overwrite(
  uuid, uuid, text, text, text, text, text, text, text, timestamptz, text
) TO service_role;

-- 3) Make dashboard view invoker-secure and restrict anon grants.
ALTER VIEW public.v_requests_dashboard SET (security_invoker = true);
REVOKE ALL ON TABLE public.v_requests_dashboard FROM anon;
REVOKE ALL ON TABLE public.v_requests_dashboard FROM authenticated;
GRANT SELECT ON TABLE public.v_requests_dashboard TO authenticated;
GRANT ALL ON TABLE public.v_requests_dashboard TO service_role;

-- Optional: revoke anon table/view grants for app data surfaces.
REVOKE ALL ON TABLE public.markets FROM anon;
REVOKE ALL ON TABLE public.vendors FROM anon;
REVOKE ALL ON TABLE public.v_vendor_list_page2 FROM anon;

-- 4) Add missing enum-like checks on receipts (safe: NOT VALID first).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'receipts_status_check'
      AND conrelid = 'public.receipts'::regclass
  ) THEN
    ALTER TABLE public.receipts
      ADD CONSTRAINT receipts_status_check
      CHECK (
        status IS NULL
        OR status = ANY (ARRAY['uploaded'::text, 'requested'::text, 'needs_fix'::text, 'completed'::text])
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'receipts_payment_method_check'
      AND conrelid = 'public.receipts'::regclass
  ) THEN
    ALTER TABLE public.receipts
      ADD CONSTRAINT receipts_payment_method_check
      CHECK (
        payment_method IS NULL
        OR payment_method = ANY (ARRAY['cash'::text, 'transfer'::text, 'payable'::text])
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'receipts_receipt_type_check'
      AND conrelid = 'public.receipts'::regclass
  ) THEN
    ALTER TABLE public.receipts
      ADD CONSTRAINT receipts_receipt_type_check
      CHECK (
        receipt_type IS NULL
        OR receipt_type = ANY (ARRAY['standard'::text, 'simple'::text])
      ) NOT VALID;
  END IF;
END $$;

-- Validate only when existing data already satisfies each constraint.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'receipts_status_check'
      AND conrelid = 'public.receipts'::regclass
  ) AND NOT EXISTS (
    SELECT 1 FROM public.receipts
    WHERE status IS NOT NULL
      AND status NOT IN ('uploaded', 'requested', 'needs_fix', 'completed')
  ) THEN
    ALTER TABLE public.receipts VALIDATE CONSTRAINT receipts_status_check;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'receipts_payment_method_check'
      AND conrelid = 'public.receipts'::regclass
  ) AND NOT EXISTS (
    SELECT 1 FROM public.receipts
    WHERE payment_method IS NOT NULL
      AND payment_method NOT IN ('cash', 'transfer', 'payable')
  ) THEN
    ALTER TABLE public.receipts VALIDATE CONSTRAINT receipts_payment_method_check;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'receipts_receipt_type_check'
      AND conrelid = 'public.receipts'::regclass
  ) AND NOT EXISTS (
    SELECT 1 FROM public.receipts
    WHERE receipt_type IS NOT NULL
      AND receipt_type NOT IN ('standard', 'simple')
  ) THEN
    ALTER TABLE public.receipts VALIDATE CONSTRAINT receipts_receipt_type_check;
  END IF;
END $$;

-- 5) Drop duplicate indexes (unique constraint already exists).
DROP INDEX IF EXISTS public.receipt_images_receipt_id_sort_order_idx;
DROP INDEX IF EXISTS public.receipt_images_receipt_id_sort_order_uniq;

-- 6) Restrict direct execution of helper/trigger functions.
REVOKE ALL ON FUNCTION public.enforce_profile_business_lock() FROM anon;
REVOKE ALL ON FUNCTION public.enforce_profile_business_lock() FROM authenticated;
REVOKE ALL ON FUNCTION public.set_receipts_user_id() FROM anon;
REVOKE ALL ON FUNCTION public.set_receipts_user_id() FROM authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM anon;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM authenticated;
REVOKE ALL ON FUNCTION public.trg_invoice_request_items_recalc() FROM anon;
REVOKE ALL ON FUNCTION public.trg_invoice_request_items_recalc() FROM authenticated;

COMMIT;
