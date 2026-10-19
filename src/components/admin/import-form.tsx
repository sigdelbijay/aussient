"use client";

import { useActionState } from "react";
import { FormAlert, SubmitButton } from "@/components/auth/form-bits";
import { importProductsAction } from "@/lib/admin/product-actions";
import { inputClass } from "./ui";

export function ImportForm() {
  const [state, action] = useActionState(importProductsAction, undefined);

  return (
    <div className="grid gap-4">
      <form action={action} className="grid max-w-lg gap-3">
        <input type="file" name="file" accept=".csv,text/csv" required aria-label="CSV file" className={`${inputClass} py-1.5`} />
        <SubmitButton className="w-auto justify-self-start px-6">Import products</SubmitButton>
      </form>

      {state?.error && <FormAlert tone="error">{state.error}</FormAlert>}
      {state && !state.error && (
        <FormAlert tone={state.problems?.length ? "error" : "success"}>
          {state.created ?? 0} created, {state.updated ?? 0} updated
          {state.problems?.length ? `, ${state.problems.length} skipped:` : "."}
        </FormAlert>
      )}
      {!!state?.problems?.length && (
        <ul className="grid list-disc gap-1 pl-5 text-sm text-destructive">
          {state.problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
