import { redirectOrNotFound } from "@/lib/redirects";

/**
 * Any shop address that isn't a real page lands here: if the admin set up a
 * redirect for it (Site Content → Redirects), go there; otherwise "not found".
 */
export default async function UnknownPage({ params }: PageProps<"/[...path]">) {
  const { path } = await params;
  return redirectOrNotFound(`/${path.join("/")}`);
}
