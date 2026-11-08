# Suffra — Eleições e Credenciamento

Plataforma de eleições com confirmação de presença de eleitores, voto secreto e
apuração em tempo real. Reescrita generalizada da aplicação
`pcdobConfEstadual2025`, agora multi-eleições e com Firebase otimizado.

## Funcionalidades

- **Multi-eventos**: o admin cria e gerencia quantos eventos quiser, de dois tipos:
  - **Eleição** (presença + voto): eleitores confirmam presença e votam;
  - **Somente credenciamento**: mesários confirmam a presença dos eleitores,
    sem votação.
- **Dois modos de acesso por eleição** (tipo Eleição):
  - *Login e senha* — o sistema gera usuário e senha para cada eleitor;
  - *Link único* — cada eleitor recebe um link exclusivo de votação.
- **Credenciamento por mesário**: o admin cadastra mesários (login/senha por
  evento); na página da mesa o mesário busca o eleitor por **CPF, nome ou
  matrícula** e confirma (ou desfaz) a presença. Contador de presenças ao vivo.
- **Voto secreto**: a cédula é gravada com ID aleatório, sem nenhum vínculo com
  o eleitor; registra-se apenas *que* votou, nunca *em quem*.
- **Painel ao vivo**: presença e apuração em tempo real para o admin.
- **Apuração**: resultado final com percentuais, abstenções e ausentes, com
  exportação em CSV (resultado e lista de presença, com CPF/matrícula e quem
  confirmou).
- **Voto em branco** opcional por eleição.

## Stack

React 19 + Vite + TypeScript + Tailwind CSS · Firebase (Auth, Firestore,
Cloud Functions v2 em `southamerica-east1`, Hosting) · plano **Blaze**.

### Por que é otimizado para o Firebase

- A apuração e a presença em tempo real vêm de **um único documento agregado**
  (`elections/{id}/meta/stats`), incrementado atomicamente pelas functions — o
  painel nunca varre eleitores nem cédulas.
- Listas de eleitores são **paginadas** (50 por página) e a leitura completa só
  acontece em exports pontuais.
- Importação de eleitores em **batches** no servidor.
- Senhas guardadas só como **hash scrypt**; links únicos só como **SHA-256** —
  nada secreto fica legível no banco.
- Security Rules negam acesso de clientes a `ballots` e `accessTokens` e tudo
  que é sensível passa por Cloud Functions transacionais (1 eleitor = 1 voto).

## Desenvolvimento local (emuladores)

Pré-requisitos: Node 20+, Java 17+ (para o emulador do Firestore).

```bash
npm install
npm --prefix functions install
npm --prefix functions run build

# Terminal 1 — emuladores (Auth, Firestore, Functions, Hosting)
npm run emulators

# Terminal 2 — dados de teste + app
npm run seed     # cria admin@suffra.test / suffra123 e uma eleição demo
npm run dev      # http://localhost:5173
```

O `.env` já vem configurado para os emuladores (`VITE_USE_EMULATORS=true`,
projeto `demo-suffra2`).

Teste end-to-end do backend (com os emuladores de pé e após o seed):

```bash
node test/e2e.mjs
```

## Colocando em produção

1. **Crie um projeto** no [Console Firebase](https://console.firebase.google.com)
   com plano **Blaze**, e habilite *Authentication → E-mail/senha* e *Firestore*.
2. **Registre um app Web** no projeto e copie a configuração para um `.env`
   baseado no `.env.example` (com `VITE_USE_EMULATORS=false`).
3. Aponte o projeto: edite `.firebaserc` trocando `demo-suffra2` pelo ID do seu
   projeto.
4. **Deploy** (rules + functions + hosting):
   ```bash
   npx firebase-tools login
   npm run deploy
   ```
5. **Crie o primeiro admin**: baixe a chave de service account (Configurações →
   Contas de serviço → Gerar nova chave privada), salve como
   `serviceAccountKey.json` na raiz e rode:
   ```bash
   node scripts/set-admin.mjs admin@exemplo.com "SenhaForte123" "Nome do Admin"
   ```
   (Outros admins podem ser criados da mesma forma. Não commite a chave — já
   está no `.gitignore`.)

## Fluxo de uso

### Eleição (presença + voto)

1. Admin entra em `/admin`, cria o evento do tipo **Eleição** (escolhendo o modo
   de acesso), cadastra as chapas/candidatos e importa a lista de eleitores.
2. Na importação o sistema gera **logins/senhas ou links únicos** e oferece um
   CSV — **baixe na hora**: por segurança os acessos não ficam salvos em claro
   (é possível regenerar o acesso de qualquer eleitor depois).
3. Admin **abre a eleição**. Eleitores entram (em `/votar/{id}` ou pelo link
   `/v/{token}`), confirmam presença e votam.
4. Admin acompanha o **Painel ao Vivo** e, ao final, **encerra a eleição** e
   exporta a apuração e a lista de presença em CSV na aba **Apuração**.
5. O resultado fica público em `/resultado/{id}` após o encerramento.

### Somente credenciamento (mesário)

1. Admin cria o evento do tipo **Somente credenciamento** e importa a lista de
   eleitores no formato `Nome;CPF;Matrícula` (CPF e matrícula opcionais; CPF
   único no evento).
2. Na aba **Mesários**, cadastra um ou mais mesários — cada um recebe login e
   senha (exibidos uma única vez) e o endereço da mesa `/mesa/{id}`.
3. Admin **abre o credenciamento**. Cada mesário acessa `/mesa/{id}`, faz login
   e, em `/credenciamento/{id}`, busca o eleitor por **CPF, nome ou matrícula** e
   confirma a presença (pode desfazer em caso de engano).
4. O contador de presenças atualiza ao vivo; a aba **Presença** do admin mostra
   os totais e exporta a lista em CSV.

## Estrutura

```
src/                  app React (pages/admin, pages/voter, pages/poll, hooks, utils)
functions/src/        Cloud Functions (auth, vote, presence, staff, voters)
firestore.rules       Security Rules
seed/seed-emulator.mjs  dados de teste para os emuladores
scripts/set-admin.mjs   bootstrap de administradores em produção
test/e2e.mjs            teste end-to-end contra os emuladores
```

### Modelo de dados (Firestore)

```
admins/{uid}                      quem é admin
elections/{id}                    nome, status (draft|open|closed),
                                  kind (election|attendance), authMode
  meta/stats                      agregados: totalVoters, presentCount,
                                  votedCount, results{candidateId: votos}
  candidates/{id}                 chapas/candidatos
  voters/{id}                     nome, cpf?, matricula?, nameLower/nameTokens
                                  (busca), login?, present, presentBy?, hasVoted
  pollworkers/{id}                mesários: nome, login, hash da senha
  ballots/{aleatório}             candidateId + castAt (voto secreto)
accessTokens/{sha256(token)}      mapa token→eleitor (modo link)
```
