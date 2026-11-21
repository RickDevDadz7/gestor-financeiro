import { BottomNav, SideNav } from "@/components/nav";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="flex min-h-dvh">
      <SideNav name={user.name} />
      <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 pb-28 pt-6 sm:px-6 md:pb-10">{children}</main>
      <BottomNav />
    </div>
  );
}
