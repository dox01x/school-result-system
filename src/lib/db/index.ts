import { createClient } from "@/lib/supabase/client";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export { createClient as createBrowserDb, createServerSupabaseClient as createServerDb, createAdminClient as createAdminDb };
export type { Database } from "@/types/database";
