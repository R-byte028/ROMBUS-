"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const credentialsSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
});

export async function signIn(formData: FormData) {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) redirect("/login?error=invalid");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) redirect("/login?error=credentials");
  redirect("/dashboard");
}

export async function signUp(formData: FormData) {
  const parsed = credentialsSchema.extend({
    businessName: z.string().trim().min(2).max(120),
  }).safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    businessName: formData.get("businessName"),
  });
  if (!parsed.success) redirect("/signup?error=invalid");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { business_name: parsed.data.businessName },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/auth/callback?next=/dashboard`,
    },
  });

  if (error) redirect("/signup?error=signup");
  if (data.session) redirect("/dashboard");
  redirect("/login?checkEmail=1");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
