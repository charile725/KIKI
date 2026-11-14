import type { SupabaseClient } from "@supabase/supabase-js";
import type { Avatar, Body, Fit, Profile } from "../../shared/types";
export const bucket = "kiki-private";
export function ensure(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}
export async function saveAvatar(
  db: SupabaseClient,
  userId: string,
  body: Body,
  fit: Fit,
  personalize: boolean,
  files: { front: Blob | null; side: Blob | null },
  existing: Avatar | null,
) {
  const uploaded: string[] = [];
  const paths = {
    front: existing?.front_path || "",
    side: existing?.side_path || "",
  };
  try {
    for (const key of ["front", "side"] as const)
      if (files[key]) {
        const path = `${userId}/photos/${crypto.randomUUID()}-${key}.jpg`;
        const { error } = await db.storage
          .from(bucket)
          .upload(path, files[key]!, {
            contentType: "image/jpeg",
            upsert: false,
          });
        ensure(error);
        uploaded.push(path);
        paths[key] = path;
      }
    if (!paths.front || !paths.side) throw new Error("請提供正面與側面照片。");
    // 先完成上傳，再更新資料；失敗時保留原分身並清理這次上傳。
    const { data, error } = await db
      .from("kiki_avatars")
      .upsert(
        {
          ...(existing ? { id: existing.id } : {}),
          user_id: userId,
          ...body,
          shoulder: body.shoulder ?? null,
          chest: body.chest ?? null,
          waist: body.waist ?? null,
          hip: body.hip ?? null,
          front_path: paths.front,
          side_path: paths.side,
        },
        { onConflict: "user_id" },
      )
      .select()
      .single();
    ensure(error);
    const { error: pe } = await db
      .from("kiki_profiles")
      .update({ fit_preference: fit, personalize })
      .eq("user_id", userId);
    ensure(pe);
    if (existing) {
      const old = [existing.front_path, existing.side_path].filter(
        (p) => p !== paths.front && p !== paths.side,
      );
      if (old.length) {
        const { error: cleanup } = await db.storage.from(bucket).remove(old);
        if (cleanup)
          throw new Error(
            "分身已更新，但舊照片清理失敗；請在衣櫃使用刪除私人資料重試。",
          );
      }
    }
    return data as Avatar;
  } catch (error) {
    // 已提交的分身不可刪除新照片。以實際資料確認後再清理未使用檔案。
    const { data: current, error: ce } = await db
      .from("kiki_avatars")
      .select("front_path,side_path")
      .eq("user_id", userId)
      .maybeSingle();
    if (!ce) {
      const unused = uploaded.filter(
        (p) => p !== current?.front_path && p !== current?.side_path,
      );
      if (unused.length) await db.storage.from(bucket).remove(unused);
    }
    throw error;
  }
}
export async function deletePrivateData(db: SupabaseClient, userId: string) {
  // Storage 刪除須透過 Storage API；不可直接刪除 storage.objects metadata。
  for (const folder of ["photos", "results"]) {
    while (true) {
      const { data, error } = await db.storage
        .from(bucket)
        .list(`${userId}/${folder}`, { limit: 100, offset: 0 });
      ensure(error);
      if (!data?.length) break;
      const { error: de } = await db.storage
        .from(bucket)
        .remove(data.map((f) => `${userId}/${folder}/${f.name}`));
      ensure(de);
    }
  }
  const { error } = await db
    .from("kiki_avatars")
    .delete()
    .eq("user_id", userId);
  ensure(error);
  const { error: pe } = await db
    .from("kiki_profiles")
    .update({ personalize: false, external_ai_consent: false })
    .eq("user_id", userId);
  ensure(pe);
}
export async function updateProfile(
  db: SupabaseClient,
  userId: string,
  values: Partial<
    Pick<
      Profile,
      "fit_preference" | "personalize" | "external_ai_consent" | "display_name"
    >
  >,
) {
  const { error } = await db
    .from("kiki_profiles")
    .update(values)
    .eq("user_id", userId);
  ensure(error);
}
