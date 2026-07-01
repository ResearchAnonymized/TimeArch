# TimeArch — Architecture & Code Conventions

This document is the single source of truth for **how** the TimeArch
codebase is organised and **which patterns** every contributor (human or
AI) must apply.

## 1. Folder layout

```text
src/
  components/      Presentational + composed UI. No direct supabase calls.
  features/<x>/    Feature slices: hooks, types, sub-components.
                   A "feature" owns one user-facing capability end to end.
  hooks/           Cross-feature reusable React hooks.
  lib/             Pure utilities (no React, no Supabase imports
                   except inside `invokeFunction` and `services/*`).
  services/        Repository layer: typed wrappers over Supabase
                   tables and edge functions. Returns `Result<T, AppError>`.
  pages/           Route-level shells. Should be thin — compose features.
  integrations/    Auto-generated Supabase client + types. NEVER edit.

supabase/functions/
  _shared/         http.ts, supabase.ts, validate.ts, llm.ts — used by
                   every edge function. Keep edge code DRY.
  <function-name>/ index.ts (entry) + optional schema.ts / stages/
```

### Hard rules

- **No `supabase` import in `src/components/**`\*\*. Use a service.
- **No `console.log`** in shipped code. Use `createLogger(scope)` from
  `src/lib/logger.ts`.
- **No raw `supabase.functions.invoke`** in components or hooks. Use
  `invokeFunction` (or, preferably, a service method).
- **No hardcoded colors** in components (`text-white`, `#fff`). Always
  semantic tokens from `index.css` / `tailwind.config.ts`.
- **No deep relative imports** (`../../..`). Use `@/`.

## 2. Design patterns in use

| Pattern          | Where                                     | Why                                |
| ---------------- | ----------------------------------------- | ---------------------------------- |
| Repository       | `src/services/*Service.ts`                | Single source of truth for queries |
| Adapter          | `src/lib/invokeFunction.ts`               | Typed, retried edge-function calls |
| Result / Either  | `src/lib/result.ts`                       | Errors as values, not exceptions   |
| Facade           | `src/features/*/hooks.ts`                 | One hook per feature surface       |
| Strategy         | `supabase/functions/run-agent/stages/*`   | One module per lifecycle stage     |
| Error Boundary   | `src/components/FeatureErrorBoundary.tsx` | Isolate render-time crashes        |
| Observer (Toast) | `src/lib/notify.ts`                       | Uniform user-visible feedback      |

## 3. React-query usage

Server state goes through react-query. Wrap service calls with
`useResultQuery` so `Result` failures surface as thrown `Error`s that the
query cache handles uniformly.

Cache keys live in `src/lib/queryKeys.ts` — never inline string arrays.

## 4. Edge function template

```ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handle, ok, fail } from "../_shared/http.ts";
import { getServiceClient, requireUser } from "../_shared/supabase.ts";
import { parseBody, z } from "../_shared/validate.ts";

const Body = z.object({ project_id: z.string().uuid() });

serve(
  handle(async (req) => {
    const user = await requireUser(req);
    const parsed = await parseBody(req, Body);
    if (!parsed.ok) return parsed.response;

    const sb = getServiceClient();
    // ... business logic ...
    return ok({ done: true });
  }),
);
```

Always return HTTP 200; signal failure via `fail("message")`.

## 5. Naming

- Components & files: `PascalCase.tsx`
- Hooks: `useThing.ts` (camelCase)
- Services: `xxxService.ts`
- Types: `PascalCase` exported from `services/*` or `src/types/`
- Test files: `*.test.ts(x)` next to the source file

## 6. Adding a new feature

1. Add types + service method (`src/services/`).
2. Add a feature folder under `src/features/<name>/` with `hooks.ts`,
   any feature-specific sub-components, and `index.ts` barrel.
3. Compose into the relevant page or workspace component.
4. Wrap the new pane in `<FeatureErrorBoundary feature="...">`.
5. Add tests (`*.test.ts`) for non-trivial logic.
