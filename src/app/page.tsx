import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "PARENT" ? "/parent" : "/child");

  const userCount = await prisma.user.count();
  redirect(userCount === 0 ? "/setup" : "/login");
}
