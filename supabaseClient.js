import {
  createClient
} from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

import {
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
} from "/js/config.js";

export const isConfigured =
  Boolean(
    SUPABASE_URL &&
    SUPABASE_PUBLISHABLE_KEY &&
    !SUPABASE_URL.includes("COLE_AQUI") &&
    !SUPABASE_PUBLISHABLE_KEY.includes("COLE_AQUI")
  );

export const supabase =
  isConfigured
    ? createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
      )
    : null;