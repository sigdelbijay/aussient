"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X } from "lucide-react";
import { FormAlert } from "@/components/auth/form-bits";
import { Button } from "@/components/ui/button";
import type { AdminFormState } from "@/lib/admin/form";
import { deleteSizeGuideAction, saveSizeGuideAction } from "@/lib/admin/type-actions";
import { DeleteButton } from "./media-manager";
import { AdminField, inputClass, Panel, textareaClass } from "./ui";

export type SizeGuideValues = { id: string | null; name: string; notes: string; columns: string[]; rows: string[][] };

/** A size chart as an editable table: type in the cells, add or remove rows and columns. */
export function SizeGuideForm({ values, usedBy }: { values: SizeGuideValues; usedBy: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [state, setState] = useState<AdminFormState>();
  const [name, setName] = useState(values.name);
  const [notes, setNotes] = useState(values.notes);
  const [columns, setColumns] = useState(values.columns.length ? values.columns : ["Size", "Chest (cm)", "Length (cm)"]);
  const [rows, setRows] = useState(values.rows.length ? values.rows : [["S", "", ""], ["M", "", ""], ["L", "", ""]]);
  const err = (k: string) => state?.fieldErrors?.[k];

  const setCell = (r: number, c: number, text: string) =>
    setRows((list) => list.map((row, i) => (i === r ? columns.map((_, j) => (j === c ? text : (row[j] ?? ""))) : row)));
  const addColumn = () => {
    setColumns((cols) => [...cols, ""]);
    setRows((list) => list.map((row) => [...row, ""]));
  };
  const removeColumn = (c: number) => {
    setColumns((cols) => cols.filter((_, j) => j !== c));
    setRows((list) => list.map((row) => row.filter((_, j) => j !== c)));
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const result = await saveSizeGuideAction({ id: values.id, name, notes, columns, rows });
          setState(result);
          if (!result?.error) router.refresh();
        });
      }}
      className="grid gap-6"
    >
      {state?.error && <FormAlert tone="error">{state.error}</FormAlert>}
      {state?.message && <FormAlert tone="success">{state.message}</FormAlert>}

      <Panel>
        <div className="grid gap-4 sm:grid-cols-2">
          <AdminField label="Name" error={err("name")} hint="Shown as the pop-up's heading, e.g. T-shirt sizes.">
            <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} className={inputClass} aria-invalid={!!err("name")} />
          </AdminField>
          <AdminField label="Notes" hint="Optional, shown under the table, e.g. “AU sizes. Measurements in cm.”">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} className={textareaClass} />
          </AdminField>
        </div>
      </Panel>

      <Panel title="Table" description="The first row is the column headings.">
        <div className="overflow-x-auto">
          <table className="text-sm">
            <thead>
              <tr>
                {columns.map((col, c) => (
                  <th key={c} className="p-1">
                    <div className="flex items-center gap-1">
                      <input
                        value={col}
                        onChange={(e) => setColumns((cols) => cols.map((x, j) => (j === c ? e.target.value : x)))}
                        placeholder="Heading"
                        aria-label={`Column ${c + 1} heading`}
                        maxLength={40}
                        className={`${inputClass} h-9 w-28 font-semibold`}
                      />
                      {columns.length > 1 && (
                        <button type="button" onClick={() => removeColumn(c)} aria-label={`Remove column ${col || c + 1}`} className="grid size-7 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-destructive">
                          <X className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </th>
                ))}
                <th className="p-1">
                  {columns.length < 12 && (
                    <Button type="button" variant="outline" onClick={addColumn} className="h-9 gap-1 px-2 text-xs">
                      <Plus className="size-3.5" /> Column
                    </Button>
                  )}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r}>
                  {columns.map((_, c) => (
                    <td key={c} className="p-1">
                      <input
                        value={row[c] ?? ""}
                        onChange={(e) => setCell(r, c, e.target.value)}
                        aria-label={`Row ${r + 1}, ${columns[c] || `column ${c + 1}`}`}
                        maxLength={40}
                        className={`${inputClass} h-9 w-28`}
                      />
                    </td>
                  ))}
                  <td className="p-1">
                    <button type="button" onClick={() => setRows((list) => list.filter((_, i) => i !== r))} aria-label={`Remove row ${r + 1}`} className="grid size-7 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-destructive">
                      <X className="size-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {err("table") && <p className="mt-2 text-xs text-destructive">{err("table")}</p>}
        {rows.length < 60 && (
          <Button type="button" variant="outline" onClick={() => setRows((list) => [...list, columns.map(() => "")])} className="mt-3 h-9 gap-1.5 px-3">
            <Plus className="size-4" /> Add row
          </Button>
        )}
      </Panel>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" size="lg" disabled={pending} className="h-11 px-6 font-semibold">
          {pending && <Loader2 className="animate-spin" />}
          {values.id ? "Save size guide" : "Create size guide"}
        </Button>
        {values.id && (
          <div className="grid gap-1">
            <DeleteButton label="Delete size guide" onConfirm={() => start(() => deleteSizeGuideAction(values.id!))} />
            {usedBy.length > 0 && <p className="text-xs text-muted-foreground">Used by {usedBy.join(", ")} — they&apos;ll stop showing a size guide.</p>}
          </div>
        )}
      </div>
    </form>
  );
}
