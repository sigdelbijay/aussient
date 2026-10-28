"use client";

import { AdminField, inputClass } from "../ui";

/** Start / end date boxes (Sydney time). Blank = no limit. */
export function ScheduleFields({
  startsAt,
  endsAt,
  onChange,
}: {
  startsAt: string;
  endsAt: string;
  onChange: (next: { startsAt: string; endsAt: string }) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <AdminField label="Show from" hint="Sydney time. Blank = straight away.">
        <input type="datetime-local" value={startsAt} onChange={(e) => onChange({ startsAt: e.target.value, endsAt })} className={inputClass} />
      </AdminField>
      <AdminField label="Hide after" hint="Blank = keep showing.">
        <input type="datetime-local" value={endsAt} onChange={(e) => onChange({ startsAt, endsAt: e.target.value })} className={inputClass} />
      </AdminField>
    </div>
  );
}

/** "Scheduled" / "Ended" / "Hidden" note for a list row, or null if it's showing. */
export function scheduleNote(item: { active: boolean; startsAt: string; endsAt: string }, now: string) {
  if (!item.active) return "Hidden";
  // Both are "YYYY-MM-DDTHH:mm" in Sydney time, so they compare as text.
  if (item.endsAt && item.endsAt <= now) return "Ended";
  if (item.startsAt && item.startsAt > now) return "Scheduled";
  return null;
}
