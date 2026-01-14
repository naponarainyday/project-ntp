


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


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."whoami"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  select auth.uid();
$$;


ALTER FUNCTION "public"."whoami"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."markets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text",
    "sort_order" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."markets" OWNER TO "postgres";


COMMENT ON TABLE "public"."markets" IS '고터, 양재등 시장 구분';



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
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."receipts" OWNER TO "postgres";


COMMENT ON TABLE "public"."receipts" IS '영수증 값';



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


COMMENT ON TABLE "public"."vendors" IS '상가 (도매인)';



CREATE OR REPLACE VIEW "public"."v_vendor_list_page2" AS
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


ALTER TABLE ONLY "public"."markets"
    ADD CONSTRAINT "markets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."receipts"
    ADD CONSTRAINT "receipts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vendors"
    ADD CONSTRAINT "vendors_pkey" PRIMARY KEY ("id");



CREATE INDEX "vendors_market_id_name_idx" ON "public"."vendors" USING "btree" ("market_id", "name");



ALTER TABLE ONLY "public"."receipts"
    ADD CONSTRAINT "receipts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."receipts"
    ADD CONSTRAINT "receipts_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."vendors"
    ADD CONSTRAINT "vendors_linked_user_id_fkey" FOREIGN KEY ("linked_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."vendors"
    ADD CONSTRAINT "vendors_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE SET NULL;



CREATE POLICY "Markets are publicly readable" ON "public"."markets" FOR SELECT USING (true);



CREATE POLICY "Receipts: user can delete own" ON "public"."receipts" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Receipts: user can insert own" ON "public"."receipts" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Receipts: user can read own" ON "public"."receipts" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Receipts: user can update own" ON "public"."receipts" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Vendors are publicly readable" ON "public"."vendors" FOR SELECT USING (true);



ALTER TABLE "public"."markets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "markets_select_all" ON "public"."markets" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."receipts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "receipts_delete_own" ON "public"."receipts" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "receipts_insert_own" ON "public"."receipts" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "receipts_select_own" ON "public"."receipts" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "receipts_update_own" ON "public"."receipts" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."vendors" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vendors_select_all" ON "public"."vendors" FOR SELECT TO "authenticated" USING (true);





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."whoami"() TO "anon";
GRANT ALL ON FUNCTION "public"."whoami"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."whoami"() TO "service_role";


















GRANT ALL ON TABLE "public"."markets" TO "anon";
GRANT ALL ON TABLE "public"."markets" TO "authenticated";
GRANT ALL ON TABLE "public"."markets" TO "service_role";



GRANT ALL ON TABLE "public"."receipts" TO "anon";
GRANT ALL ON TABLE "public"."receipts" TO "authenticated";
GRANT ALL ON TABLE "public"."receipts" TO "service_role";



GRANT ALL ON TABLE "public"."vendors" TO "anon";
GRANT ALL ON TABLE "public"."vendors" TO "authenticated";
GRANT ALL ON TABLE "public"."vendors" TO "service_role";



GRANT ALL ON TABLE "public"."v_vendor_list_page2" TO "anon";
GRANT ALL ON TABLE "public"."v_vendor_list_page2" TO "authenticated";
GRANT ALL ON TABLE "public"."v_vendor_list_page2" TO "service_role";









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































