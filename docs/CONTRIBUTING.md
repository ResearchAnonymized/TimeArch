# Contributing

## Quick checks before opening a PR

```bash
npm run lint           # static analysis
npm run format:check   # prettier
npm test               # vitest
```

To auto-fix:

```bash
npm run lint:fix
npm run format
```

## Coding standards

See [`ARCHITECTURE.md`](./ARCHITECTURE.md). Highlights:

- No `console.log` — use `createLogger`.
- No `supabase` imports in `src/components/**` — use a service.
- No `supabase.functions.invoke` outside `src/services/**` and
  `src/lib/invokeFunction.ts`.
- No hardcoded colors in components — semantic tokens only.
- Return `Result<T, AppError>` from service methods.

## Edge functions

- Use shared helpers in `supabase/functions/_shared/`.
- Validate every request body with `parseBody(req, ZodSchema)`.
- Always return HTTP 200; surface failure with `fail("msg")`.

## When in doubt

Open a draft PR and tag it `discuss:` — the architecture team will weigh in.
