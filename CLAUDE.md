# Suffra2

Plataforma de eleições (voto secreto + credenciamento) em React/Vite/TS +
Firebase. Visão completa da arquitetura e fluxos no [README.md](README.md).

## Comandos

- `npm run dev` — app em http://localhost:5173 (usa emuladores via `.env`)
- `npm run emulators` — Auth/Firestore/Functions/Hosting (exige Java; o script
  procura um JRE em `~/.local/java` se não houver `java` no PATH)
- `npm run seed` — admin de teste `admin@suffra.test / suffra123` + eleição demo
- `node test/e2e.mjs` — teste end-to-end do backend contra os emuladores
- `npm --prefix functions run build` — obrigatório antes de subir os emuladores
  após mudar `functions/src`

## Invariantes importantes

- **Dois tipos de evento** (`election.kind`): `election` (presença + voto) e
  `attendance` (somente credenciamento por mesário). No tipo `attendance` o
  eleitor não loga: mesários (`pollworkers`) buscam por CPF/nome/matrícula e
  confirmam presença via `setVoterPresence`. Eleitores antigos sem `kind` são
  tratados como `election`.
- **Busca de eleitor** (`searchVoters`, [functions/src/presence.ts](functions/src/presence.ts)):
  feita no servidor (mesário nunca lê `voters` direto). Depende dos campos
  desnormalizados `cpf`/`matricula`/`nameLower`/`nameTokens` gravados no import.
- **Credenciamento offline** (`election.offlinePresence`, opcional por evento):
  quando ligado, o mesário lê a lista e grava só os campos de presença **direto**
  no Firestore (rules em [firestore.rules](firestore.rules) via `offlineEnabled`
  + `onlyPresenceFields`), tolerando internet instável pela fila/cache do SDK.
  Nesses eventos o `presentCount` é mantido pelo gatilho `syncOfflinePresence`
  (idempotente) — as funções **não** incrementam para não contar em dobro.
  Eventos sem a flag seguem 100% via Cloud Functions (padrão).
- **Voto secreto**: `ballots` nunca pode conter referência ao eleitor; a
  garantia 1-eleitor-1-voto vive na transação de `castVote`
  ([functions/src/vote.ts](functions/src/vote.ts)), não nas rules.
- **Leituras otimizadas**: painéis leem só `elections/{id}/meta/stats`
  (agregado mantido pelas functions). Nunca somar votos varrendo coleções.
- Clientes não escrevem em `voters`, `ballots`, `meta/stats` nem `accessTokens`
  — tudo via Cloud Functions ([firestore.rules](firestore.rules)).
- Segredos nunca persistem em claro: senhas como hash scrypt, links como
  SHA-256 (doc id de `accessTokens`). Os valores em claro só existem na
  resposta de `importVoters`/`resetVoterAccess`.
- Região das functions: `southamerica-east1` — definida em
  [functions/src/init.ts](functions/src/init.ts) e usada pelo cliente em
  [src/lib/firebase.ts](src/lib/firebase.ts); mudar exige os dois lados.
