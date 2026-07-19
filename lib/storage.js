import { supabase } from "./supabaseClient";

const BUCKET = "media";

// path should be namespaced under the user's own id, e.g. `${userId}/cards/${filename}`
export async function uploadImage(path, file) {
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || "image/png",
  });
  if (error) throw error;
  return path;
}

export function publicUrl(path) {
  if (!path) return null;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteImage(path) {
  if (!path) return;
  await supabase.storage.from(BUCKET).remove([path]);
}

export function newImagePath(userId, folder, extension) {
  const id = Date.now() + "-" + Math.random().toString(36).slice(2, 8);
  return `${userId}/${folder}/${id}.${extension}`;
}
