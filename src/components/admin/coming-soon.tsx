import { PageHeader, Panel } from "./ui";

/** Placeholder for admin sections that haven't been built yet. */
export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <>
      <PageHeader title={title} />
      <Panel>
        <p className="text-sm text-muted-foreground">{description}</p>
        <p className="mt-2 text-sm text-muted-foreground">This section hasn&apos;t been built yet.</p>
      </Panel>
    </>
  );
}
