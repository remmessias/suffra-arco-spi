# Capturas de tela (landing page)

Imagens em **2x** (retina), recortadas na altura do conteúdo — prontas para uso
em landing page, README ou apresentação.

| Arquivo | Tela | Tamanho |
|---|---|---|
| `01-painel-ao-vivo.png` | Painel ao vivo do admin: presença + apuração em tempo real | 2560×1270 |
| `02-apuracao.png` | Apuração com resultado, percentuais e exportação em CSV | 2560×1416 |
| `03-dashboard.png` | Lista de eventos (eleição e credenciamento) | 2560×674 |
| `04-cedula.png` | Cédula de votação do eleitor (mobile) | 880×1212 |
| `05-credenciamento.png` | Mesa do mesário: busca por CPF/nome/matrícula (mobile) | 880×708 |

**Sugestão de uso:** `01-painel-ao-vivo.png` como imagem principal (hero) — é a
tela que melhor comunica o produto. As duas mobile funcionam bem lado a lado
numa seção de recursos.

## Como regerar

Os dados são fictícios, criados por `seed/seed-demo.mjs` nos emuladores.

```bash
npm run emulators
```

Em outro terminal (o seed imprime um JSON com os ids e credenciais gerados):

```bash
node seed/seed-demo.mjs
```

Com o `npm run dev` no ar, passe esse JSON para o script de captura:

```bash
node scripts/screenshots.mjs '<json impresso pelo seed-demo>'
```
