import { ContentNav } from "@/components/admin/content/content-nav";
import { requireStaff } from "@/lib/auth/dal";

/** Site Content (STAFF and ADMIN): tabs for each kind of shop content. Each page checks access too. */
export default async function ContentLayout({ children }: LayoutProps<"/admin/content">) {
  await requireStaff("/admin/content");
  return (
    <>
      <ContentNav />
      {children}
    </>
  );
}
