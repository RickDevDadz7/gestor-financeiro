"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { generateDailyBrief } from "@/lib/brief";

export async function generateNow() {
  await requireUser();
  await generateDailyBrief();
  revalidatePath("/", "layout");
}
