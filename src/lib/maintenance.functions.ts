import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const setMaintenance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ enabled: z.boolean() }).strict().parse(input))
  .handler(async ({ data, context }) => {
    const { data: enabled, error } = await context.supabase.rpc("set_site_maintenance", { _enabled: data.enabled });
    if (error) throw new Error(error.message);
    return { enabled };
  });