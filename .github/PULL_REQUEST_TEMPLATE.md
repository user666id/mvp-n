<!-- Thanks for contributing to mvp-n! Keep PRs focused and small where possible. -->

## What & why

<!-- What does this change do, and why? Link any related issue (#123). -->

## Affected components

<!-- Tick all that apply. -->

- [ ] `api` &nbsp; [ ] `connect` &nbsp; [ ] `awg-server` &nbsp; [ ] `bot`
- [ ] `frontend` &nbsp; [ ] `nginx` &nbsp; [ ] `scripts` &nbsp; [ ] docs

## Checklist

- [ ] Builds locally (`go build ./...` per Go module; `npm run build` for `frontend`/`bot`)
- [ ] `gofmt` clean and `go vet ./...` passes; `tsc --noEmit` passes for TS
- [ ] Tests added/updated where it makes sense (`go test ./...`)
- [ ] No secrets, tokens, private keys, or real server IPs added to the repo
- [ ] User-facing strings go through i18n (no new hardcoded UI text); code & comments are in English
- [ ] Docs updated if behavior/architecture/config changed

## Notes for reviewers

<!-- Anything reviewers should pay special attention to, test manually, or be aware of. -->

---

> Production tracks the `release` branch. Merging to `main` does **not** deploy;
> shipping is a separate `git push origin main:release`.
