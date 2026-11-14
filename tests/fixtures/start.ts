import { createSupabaseFixture } from "./supabase";
createSupabaseFixture().server.listen(54329, "127.0.0.1", () =>
  console.log("TEST ONLY Supabase contract fixture http://127.0.0.1:54329"),
);
