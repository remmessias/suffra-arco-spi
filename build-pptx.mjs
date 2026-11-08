import pptxgen from 'pptxgenjs';

const INK = '17171A', MUTED = '6A6A6E', LINE = 'DCDCDE';
const PANEL = 'F6F6F7', PLAT = 'EDEDEE', WHITE = 'FFFFFF';
const DARK = '141416', DARKSUB = 'D9D9DE', DARKEYE = 'C9C9CF';
const F = 'Arial';
const WMB = 'assets/omnes-wm-black.png', WMW = 'assets/omnes-wm-white.png';

const p = new pptxgen();
p.defineLayout({ name: 'W', width: 13.333, height: 7.5 });
p.layout = 'W';

const wm = (s, dark = false) =>
  s.addImage({ path: dark ? WMW : WMB, x: 12.42, y: 0.34, w: 0.46, h: 0.5, transparency: dark ? 72 : 86 });

const eyebrow = (s, t, dark = false) =>
  s.addText(t.toUpperCase(), { x: 0.7, y: 0.82, w: 11, h: 0.3, fontFace: F, fontSize: 12, bold: true, color: dark ? DARKEYE : INK, charSpacing: 3, margin: 0 });

const title = (s, t, dark = false, size = 30) =>
  s.addText(t, { x: 0.7, y: 1.12, w: 11.9, h: 1.0, fontFace: F, fontSize: size, bold: true, color: dark ? WHITE : INK, margin: 0 });

const kicker = (s, t) =>
  s.addText(t, { x: 0.7, y: 1.95, w: 10.6, h: 0.7, fontFace: F, fontSize: 15, color: MUTED, margin: 0, lineSpacingMultiple: 1.15 });

function arrow(s, x1, y1, x2, y2, { color = MUTED, width = 1.75, dash = false } = {}) {
  s.addShape('line', {
    x: Math.min(x1, x2), y: Math.min(y1, y2),
    w: Math.max(Math.abs(x2 - x1), 0.001), h: Math.max(Math.abs(y2 - y1), 0.001),
    line: { color, width, endArrowType: 'triangle', dashType: dash ? 'dash' : 'solid' },
    flipH: x2 < x1, flipV: y2 < y1,
  });
}

// card com título+subtítulo alinhados à esquerda
function card(s, x, y, w, h, t, sub, { fill = PANEL, outline = LINE, ow = 1, tcolor = INK, ts = 14 } = {}) {
  s.addShape('roundRect', { x, y, w, h, rectRadius: 0.09, fill: { color: fill }, line: { color: outline, width: ow } });
  s.addText(t, { x: x + 0.2, y: y + 0.14, w: w - 0.32, h: 0.34, fontFace: F, fontSize: ts, bold: true, color: tcolor, margin: 0, valign: 'top' });
  if (sub) s.addText(sub, { x: x + 0.2, y: y + 0.5, w: w - 0.32, h: 0.32, fontFace: F, fontSize: 11.5, color: MUTED, margin: 0, valign: 'top' });
}
// card centralizado
function cardC(s, x, y, w, h, t, sub, { fill = PANEL, outline = LINE, ow = 1, tcolor = INK } = {}) {
  s.addShape('roundRect', { x, y, w, h, rectRadius: 0.09, fill: { color: fill }, line: { color: outline, width: ow } });
  s.addText(t, { x: x + 0.1, y: y + (sub ? h * 0.24 : 0), w: w - 0.2, h: sub ? 0.34 : h, fontFace: F, fontSize: 14, bold: true, color: tcolor, align: 'center', valign: sub ? 'top' : 'middle', margin: 0 });
  if (sub) s.addText(sub, { x: x + 0.1, y: y + h * 0.52, w: w - 0.2, h: 0.3, fontFace: F, fontSize: 11.5, color: MUTED, align: 'center', valign: 'top', margin: 0 });
}

const lightSlide = () => { const s = p.addSlide(); s.background = { color: WHITE }; wm(s); return s; };
const darkSlide = () => { const s = p.addSlide(); s.background = { color: DARK }; wm(s, true); return s; };

// ---------------------------------------------------------------- 1 · CAPA
{
  const s = darkSlide();
  s.addShape('roundRect', { x: 0.7, y: 1.5, w: 0.7, h: 0.7, rectRadius: 0.12, fill: { color: '2A2A30' }, line: { color: '4A4A52', width: 1 } });
  s.addText('S', { x: 0.7, y: 1.5, w: 0.7, h: 0.7, fontFace: F, fontSize: 30, bold: true, color: WHITE, align: 'center', valign: 'middle', margin: 0 });
  s.addText('APRESENTAÇÃO', { x: 0.7, y: 2.5, w: 8, h: 0.3, fontFace: F, fontSize: 12, bold: true, color: DARKEYE, charSpacing: 3, margin: 0 });
  s.addText('Suffra: como funciona\ne por que é seguro', { x: 0.68, y: 2.85, w: 11, h: 1.9, fontFace: F, fontSize: 42, bold: true, color: WHITE, margin: 0, lineSpacingMultiple: 1.0 });
  s.addText('Credenciamento de presença e eleições com voto secreto — tudo na nuvem, pelo navegador.', { x: 0.7, y: 4.85, w: 8.2, h: 0.8, fontFace: F, fontSize: 17, color: DARKSUB, margin: 0, lineSpacingMultiple: 1.2 });
  s.addText('Uma plataforma · vários eventos · sem instalação', { x: 0.7, y: 6.7, w: 9, h: 0.3, fontFace: F, fontSize: 13, color: DARKSUB, margin: 0 });
}

// ---------------------------------------------------------------- 2 · DESAFIO
{
  const s = lightSlide();
  eyebrow(s, 'O desafio'); title(s, 'Eventos grandes, decisões importantes');
  const items = [
    ['Confirmar quem está presente', 'sem filas e sem planilha na mão.'],
    ['Coletar votos com sigilo', 'e sem risco de fraude.'],
    ['Saber o quórum e o resultado na hora', 'sem contar manualmente.'],
    ['Proteger os dados dos participantes', 'do começo ao fim.'],
  ];
  let y = 2.6;
  for (const [a, b] of items) {
    s.addShape('ellipse', { x: 0.72, y: y + 0.16, w: 0.16, h: 0.16, fill: { color: INK }, line: { color: INK, width: 0 } });
    s.addText([{ text: a + '  ', options: { bold: true, color: INK } }, { text: b, options: { color: MUTED } }],
      { x: 1.05, y: y - 0.02, w: 10.5, h: 0.55, fontFace: F, fontSize: 18, margin: 0, valign: 'top' });
    y += 0.92;
  }
}

// ---------------------------------------------------------------- 3 · VISÃO GERAL
{
  const s = lightSlide();
  eyebrow(s, 'Visão geral'); title(s, 'Uma plataforma, três papéis');
  kicker(s, 'Cada pessoa acessa só o que precisa. Nada para instalar — funciona no computador ou no celular.');
  s.addText('QUEM USA', { x: 0.7, y: 3.0, w: 3, h: 0.25, fontFace: F, fontSize: 11, bold: true, color: MUTED, charSpacing: 2, margin: 0 });
  s.addText('ENTREGAS', { x: 9.95, y: 3.0, w: 3, h: 0.25, fontFace: F, fontSize: 11, bold: true, color: MUTED, charSpacing: 2, margin: 0 });
  const CW = 2.7, CH = 0.95, ys = [3.35, 4.45, 5.55];
  const left = [['Organizador', 'monta o evento'], ['Eleitor', 'vota'], ['Mesário', 'confirma presença']];
  const right = [['Acompanhamento de quórum', 'Quórum atingido em tempo real'], ['Lista de presença', 'comprovação do quórum'], ['Relatórios', 'exportação em planilha']];
  // todos os seis cards com o mesmo desenho (título 12.5 cabe o mais longo)
  left.forEach(([a, b], i) => card(s, 0.7, ys[i], CW, CH, a, b, { ts: 12.5 }));
  right.forEach(([a, b], i) => card(s, 9.95, ys[i], CW, CH, a, b, { ts: 12.5 }));
  s.addShape('roundRect', { x: 5.4, y: 4.15, w: 2.55, h: 1.5, rectRadius: 0.14, fill: { color: PLAT }, line: { color: INK, width: 1.5 } });
  s.addText('SUFFRA', { x: 5.4, y: 4.45, w: 2.55, h: 0.5, fontFace: F, fontSize: 22, bold: true, color: INK, align: 'center', margin: 0 });
  s.addText('na nuvem', { x: 5.4, y: 4.95, w: 2.55, h: 0.4, fontFace: F, fontSize: 12, color: MUTED, align: 'center', margin: 0 });
  ys.forEach((y) => arrow(s, 3.4, y + CH / 2, 5.4, 4.9, {}));
  ys.forEach((y) => arrow(s, 7.95, 4.9, 9.95, y + CH / 2, { color: INK }));
}

// ---------------------------------------------------------------- 4 · SEÇÃO
function section(bignum, h1, sub) {
  const s = darkSlide();
  s.addText(bignum, { x: 0.7, y: 2.6, w: 8, h: 0.4, fontFace: F, fontSize: 16, color: DARKEYE, charSpacing: 2, margin: 0 });
  s.addText(h1, { x: 0.68, y: 3.0, w: 11, h: 1.2, fontFace: F, fontSize: 40, bold: true, color: WHITE, margin: 0 });
  s.addText(sub, { x: 0.7, y: 4.3, w: 9, h: 0.6, fontFace: F, fontSize: 17, color: DARKSUB, margin: 0 });
}
section('Parte 1', 'Os dados dos eleitores', 'Como a lista é enviada, onde fica guardada e como é usada.');

// ---------------------------------------------------------------- 5 · UPLOAD
{
  const s = lightSlide();
  eyebrow(s, 'A base eleitoral · passo 1'); title(s, 'Subir a lista é rápido e simples');
  kicker(s, 'O organizador envia uma planilha com Nome, CPF e matrícula. Só ele faz isso. Em minutos a lista do evento está pronta.');
  s.addShape('roundRect', { x: 0.7, y: 3.4, w: 3.6, h: 1.9, rectRadius: 0.1, fill: { color: PANEL }, line: { color: LINE, width: 1 } });
  s.addText('Planilha do organizador', { x: 0.9, y: 3.6, w: 3.2, h: 0.35, fontFace: F, fontSize: 15, bold: true, color: INK, margin: 0 });
  s.addText('Nome · CPF · Matrícula', { x: 0.9, y: 4.05, w: 3.2, h: 0.3, fontFace: F, fontSize: 12, color: MUTED, margin: 0 });
  s.addShape('line', { x: 0.9, y: 4.45, w: 3.2, h: 0.001, line: { color: LINE, width: 1 } });
  s.addText('Maria Silva · … · 2025-001\nJoão Souza · … · 2025-002', { x: 0.9, y: 4.55, w: 3.2, h: 0.6, fontFace: F, fontSize: 12, color: MUTED, margin: 0, lineSpacingMultiple: 1.2 });
  cardC(s, 5.35, 3.95, 2.6, 0.8, 'Importar', 'validação automática', { fill: PLAT, outline: INK, ow: 1.5 });
  s.addShape('roundRect', { x: 9.0, y: 3.4, w: 3.6, h: 1.9, rectRadius: 0.1, fill: { color: PANEL }, line: { color: INK, width: 1.75 } });
  s.addText('Lista do evento', { x: 9.2, y: 3.7, w: 3.2, h: 0.35, fontFace: F, fontSize: 15, bold: true, color: INK, margin: 0 });
  s.addText('pronta e protegida', { x: 9.2, y: 4.15, w: 3.2, h: 0.3, fontFace: F, fontSize: 12, bold: true, color: INK, margin: 0 });
  s.addText('isolada dos outros eventos', { x: 9.2, y: 4.65, w: 3.2, h: 0.3, fontFace: F, fontSize: 12, color: MUTED, margin: 0 });
  arrow(s, 4.3, 4.35, 5.35, 4.35, {});
  arrow(s, 7.95, 4.35, 9.0, 4.35, {});
}

// ---------------------------------------------------------------- 6 · ONDE FICA
{
  const s = lightSlide();
  eyebrow(s, 'A base eleitoral · passo 2'); title(s, 'Onde os dados ficam guardados');
  kicker(s, 'Em infraestrutura de nuvem guiada por computação distribuída — a mesma usada por bancos e grandes apps. Protegida por vários mecanismos:');
  cardC(s, 0.7, 3.7, 2.7, 1.0, 'Navegador', 'computador · celular', {});
  arrow(s, 3.4, 4.2, 5.2, 4.2, {});
  // lock
  s.addShape('ellipse', { x: 4.05, y: 3.62, w: 0.34, h: 0.34, fill: { color: WHITE }, line: { color: INK, width: 2 } });
  s.addShape('roundRect', { x: 4.0, y: 3.86, w: 0.44, h: 0.34, rectRadius: 0.04, fill: { color: INK }, line: { color: INK, width: 0 } });
  s.addText('conexão cifrada', { x: 3.55, y: 4.28, w: 1.35, h: 0.3, fontFace: F, fontSize: 11.5, color: INK, align: 'center', bold: true, margin: 0 });
  // cloud box
  s.addShape('roundRect', { x: 5.3, y: 3.15, w: 7.3, h: 2.6, rectRadius: 0.14, fill: { color: PLAT }, line: { color: INK, width: 1.5 } });
  s.addText('Nuvem', { x: 5.6, y: 3.4, w: 4, h: 0.5, fontFace: F, fontSize: 20, bold: true, color: INK, margin: 0 });
  cardC(s, 5.6, 4.15, 3.1, 0.6, 'Dados cifrados em repouso', null, {});
  cardC(s, 5.6, 4.9, 3.1, 0.6, 'Cada evento isolado', null, {});
  s.addShape('roundRect', { x: 8.85, y: 4.15, w: 3.45, h: 1.35, rectRadius: 0.09, fill: { color: PANEL }, line: { color: INK, width: 1.75 } });
  s.addText('Senha vira código\ncifrado e irreversível', { x: 8.9, y: 4.35, w: 3.35, h: 0.6, fontFace: F, fontSize: 13.5, bold: true, color: INK, align: 'center', margin: 0, lineSpacingMultiple: 1.1 });
  s.addText('nem a equipe consegue ler', { x: 8.9, y: 5.05, w: 3.35, h: 0.3, fontFace: F, fontSize: 11.5, color: MUTED, align: 'center', margin: 0 });
}

// ---------------------------------------------------------------- 7 · USO
{
  const s = lightSlide();
  eyebrow(s, 'A base eleitoral · passo 3'); title(s, 'Uso mínimo e sempre controlado');
  kicker(s, 'Os dados servem a um propósito só: confirmar presença e votar. O mesário busca uma pessoa e recebe apenas aquele registro — nunca a lista inteira.');
  cardC(s, 0.7, 3.75, 3.0, 1.0, 'Mesário busca', 'CPF · nome · matrícula', {});
  cardC(s, 5.15, 3.6, 3.0, 1.3, 'Servidor valida', 'busca protegida', { fill: PLAT, outline: INK, ow: 1.5 });
  cardC(s, 9.6, 3.75, 3.0, 1.0, 'Só aquela pessoa', 'um resultado por vez', { fill: PANEL, outline: INK, ow: 1.75 });
  arrow(s, 3.7, 4.25, 5.15, 4.25, {});
  arrow(s, 8.15, 4.25, 9.6, 4.25, {});
}

// ---------------------------------------------------------------- 8 · SEÇÃO 2
section('Parte 2', 'O credenciamento na prática', 'O coração do sistema: confirmar presença com rapidez e segurança.');

// ---------------------------------------------------------------- 9 · 3 PASSOS
{
  const s = lightSlide();
  eyebrow(s, 'Credenciamento'); title(s, 'Três passos, poucos segundos');
  const steps = [
    ['Mesário entra', 'login e senha próprios', 'na página da mesa', PANEL, LINE, 1],
    ['Busca o eleitor', 'CPF · nome · matrícula', 'acha em segundos', PANEL, LINE, 1],
    ['Confirma presença', 'um toque', 'quórum sobe na hora', PANEL, INK, 1.75],
  ];
  const w = 3.5, h = 1.8, gap = 0.6; let x = 0.9; const y = 3.4;
  steps.forEach(([t, s1, s2, fill, oc, ow], i) => {
    s.addShape('roundRect', { x, y, w, h, rectRadius: 0.1, fill: { color: fill }, line: { color: oc, width: ow } });
    s.addShape('ellipse', { x: x + 0.25, y: y + 0.28, w: 0.5, h: 0.5, fill: { color: PLAT }, line: { color: INK, width: 1.5 } });
    s.addText(String(i + 1), { x: x + 0.25, y: y + 0.28, w: 0.5, h: 0.5, fontFace: F, fontSize: 18, bold: true, color: INK, align: 'center', valign: 'middle', margin: 0 });
    s.addText(t, { x: x + 0.95, y: y + 0.32, w: w - 1.1, h: 0.4, fontFace: F, fontSize: 16, bold: true, color: INK, margin: 0 });
    s.addText(s1, { x: x + 0.95, y: y + 0.78, w: w - 1.1, h: 0.3, fontFace: F, fontSize: 12.5, color: MUTED, margin: 0 });
    s.addText(s2, { x: x + 0.95, y: y + 1.12, w: w - 1.1, h: 0.3, fontFace: F, fontSize: 12.5, color: MUTED, margin: 0 });
    if (i < 2) arrow(s, x + w + 0.06, y + h / 2, x + w + gap - 0.06, y + h / 2, {});
    x += w + gap;
  });
}

// ---------------------------------------------------------------- 10 · RÁPIDO
{
  const s = lightSlide();
  eyebrow(s, 'Credenciamento'); title(s, 'Rápido, em equipe e auditável');
  const cards = [
    ['SEM FILAS', 'Vários mesários ao mesmo tempo', 'Quantas mesas você precisar, trabalhando em paralelo na mesma lista — sem duplicar presença.'],
    ['AO VIVO', 'Quórum atualiza sozinho', 'Cada confirmação aparece no painel na hora. Ninguém precisa contar manualmente.'],
    ['RASTREÁVEL', 'Registro de quem confirmou', 'Toda presença guarda o mesário e o horário — trilha de auditoria para conferência.'],
    ['SEM ENGANO', 'Correção controlada', 'Confirmou errado? Dá para desfazer, e o quórum se ajusta automaticamente.'],
  ];
  const w = 5.75, h = 1.7, gx = 0.4, gy = 0.35; const x0 = 0.7, y0 = 2.7;
  cards.forEach(([k, t, d], i) => {
    const x = x0 + (i % 2) * (w + gx), y = y0 + Math.floor(i / 2) * (h + gy);
    s.addShape('roundRect', { x, y, w, h, rectRadius: 0.09, fill: { color: PANEL }, line: { color: LINE, width: 1 } });
    s.addText(k, { x: x + 0.25, y: y + 0.2, w: w - 0.5, h: 0.25, fontFace: F, fontSize: 11, bold: true, color: INK, charSpacing: 2, margin: 0 });
    s.addText(t, { x: x + 0.25, y: y + 0.5, w: w - 0.5, h: 0.4, fontFace: F, fontSize: 17, bold: true, color: INK, margin: 0 });
    s.addText(d, { x: x + 0.25, y: y + 0.95, w: w - 0.5, h: 0.65, fontFace: F, fontSize: 12.5, color: MUTED, margin: 0, lineSpacingMultiple: 1.15 });
  });
}

// ---------------------------------------------------------------- 11 · OFFLINE
{
  const s = lightSlide();
  eyebrow(s, 'Credenciamento · resiliência'); title(s, 'Funciona mesmo com internet ruim');
  kicker(s, 'Salão sem sinal? O credenciamento não para. As confirmações ficam guardadas no aparelho e sincronizam sozinhas quando a conexão volta — sem contar duas vezes.');
  s.addShape('roundRect', { x: 4.7, y: 3.15, w: 3.95, h: 2.35, rectRadius: 0.1, fill: { color: PANEL }, line: { color: INK, width: 1.25, dashType: 'dash' } });
  s.addText('SEM INTERNET', { x: 4.7, y: 3.28, w: 3.95, h: 0.3, fontFace: F, fontSize: 11, bold: true, color: INK, align: 'center', charSpacing: 2, margin: 0 });
  cardC(s, 0.7, 3.75, 3.4, 1.05, 'Antes / online', 'lista disponível no aparelho', {});
  s.addShape('roundRect', { x: 4.85, y: 3.75, w: 3.65, h: 1.05, rectRadius: 0.09, fill: { color: WHITE }, line: { color: LINE, width: 1 } });
  s.addText('Confirma normalmente', { x: 5.05, y: 3.95, w: 3.3, h: 0.35, fontFace: F, fontSize: 14, bold: true, color: INK, align: 'center', margin: 0 });
  s.addText('entra na fila · “pendente”', { x: 5.05, y: 4.35, w: 3.3, h: 0.3, fontFace: F, fontSize: 12, bold: true, color: INK, align: 'center', margin: 0 });
  s.addShape('roundRect', { x: 9.2, y: 3.75, w: 3.4, h: 1.05, rectRadius: 0.09, fill: { color: PANEL }, line: { color: INK, width: 1.75 } });
  s.addText('Reconectou', { x: 9.4, y: 3.98, w: 3.0, h: 0.35, fontFace: F, fontSize: 14, bold: true, color: INK, align: 'center', margin: 0 });
  s.addText('sincroniza sozinho · quórum certo', { x: 9.3, y: 4.38, w: 3.2, h: 0.3, fontFace: F, fontSize: 11.5, color: MUTED, align: 'center', margin: 0 });
  arrow(s, 4.1, 4.28, 4.85, 4.28, {});
  arrow(s, 8.5, 4.28, 9.2, 4.28, { color: INK });
}

// ---------------------------------------------------------------- 12 · SEGURANÇA
{
  const s = lightSlide();
  eyebrow(s, 'Por que confiar'); title(s, 'Segurança em cinco camadas');
  const items = [
    ['Dados cifrados', 'Guardados na nuvem, protegidos em trânsito e em repouso.'],
    ['Nada gravado “no escuro”', 'Toda ação passa pelo servidor, que valida antes de gravar.'],
    ['Permissões baseadas em papéis', 'Cada perfil vê só o que precisa; eventos isolados entre si.'],
    ['Voto secreto', 'O sistema registra que a pessoa votou, nunca em quem.'],
    ['Trilha de auditoria', 'Quem confirmou cada presença, e quando, fica registrado.'],
  ];
  const colX = [0.7, 6.9], w = 5.5; const rowY = [2.9, 4.05, 5.2];
  items.forEach(([t, d], i) => {
    const x = colX[i % 2], y = rowY[Math.floor(i / 2)];
    s.addShape('roundRect', { x, y, w: 0.5, h: 0.5, rectRadius: 0.09, fill: { color: PLAT }, line: { color: LINE, width: 0 } });
    s.addText(String(i + 1), { x, y, w: 0.5, h: 0.5, fontFace: F, fontSize: 16, bold: true, color: INK, align: 'center', valign: 'middle', margin: 0 });
    s.addText(t, { x: x + 0.7, y: y - 0.04, w, h: 0.35, fontFace: F, fontSize: 17, bold: true, color: INK, margin: 0 });
    s.addText(d, { x: x + 0.7, y: y + 0.34, w, h: 0.5, fontFace: F, fontSize: 13, color: MUTED, margin: 0, lineSpacingMultiple: 1.1 });
  });
}

// ---------------------------------------------------------------- 13 · VOTO SECRETO
{
  const s = lightSlide();
  eyebrow(s, 'No modo eleição'); title(s, 'Como o voto fica secreto');
  kicker(s, 'Duas informações são guardadas separadas e sem ligação: que a pessoa votou, e o voto em si. Nem a organização consegue descobrir em quem alguém votou.');
  s.addText('QUEM VOTOU', { x: 1.4, y: 3.4, w: 4, h: 0.25, fontFace: F, fontSize: 11, bold: true, color: MUTED, charSpacing: 2, align: 'center', margin: 0 });
  s.addText('EM QUEM VOTOU', { x: 7.9, y: 3.4, w: 4, h: 0.25, fontFace: F, fontSize: 11, bold: true, color: MUTED, charSpacing: 2, align: 'center', margin: 0 });
  cardC(s, 1.4, 3.75, 4.0, 1.1, '“Fulano já votou”', 'controla 1 pessoa = 1 voto', {});
  cardC(s, 7.9, 3.75, 4.0, 1.1, 'Voto anônimo', 'sem nome · sem identificação', { fill: PANEL, outline: INK, ow: 1.75 });
  arrow(s, 5.4, 4.3, 6.35, 4.3, { color: INK, dash: true, width: 2 });
  arrow(s, 6.95, 4.3, 7.9, 4.3, { color: INK, dash: true, width: 2 });
  s.addShape('line', { x: 6.5, y: 4.1, w: 0.3, h: 0.4, line: { color: INK, width: 2.5 } });
  s.addShape('line', { x: 6.5, y: 4.1, w: 0.3, h: 0.4, line: { color: INK, width: 2.5 }, flipH: true });
  s.addText('sem ligação', { x: 5.65, y: 4.6, w: 2.0, h: 0.3, fontFace: F, fontSize: 12, bold: true, color: INK, align: 'center', margin: 0 });
}

// ---------------------------------------------------------------- 14 · FECHO
{
  const s = darkSlide();
  s.addText('EM RESUMO', { x: 0.7, y: 1.5, w: 8, h: 0.3, fontFace: F, fontSize: 12, bold: true, color: DARKEYE, charSpacing: 3, margin: 0 });
  s.addText('Seguro. Rápido.\nSem instalação.', { x: 0.68, y: 1.9, w: 11, h: 2.0, fontFace: F, fontSize: 42, bold: true, color: WHITE, margin: 0, lineSpacingMultiple: 1.0 });
  const pts = ['Credenciamento em segundos, mesmo com internet instável', 'Dados protegidos e uso controlado do começo ao fim', 'Voto secreto e resultado em tempo real'];
  let y = 4.3;
  for (const t of pts) {
    s.addShape('ellipse', { x: 0.74, y: y + 0.13, w: 0.15, h: 0.15, fill: { color: WHITE }, line: { color: WHITE, width: 0 } });
    s.addText(t, { x: 1.05, y: y - 0.03, w: 10.5, h: 0.45, fontFace: F, fontSize: 17, color: WHITE, margin: 0 });
    y += 0.62;
  }
  s.addText('Suffra · eleições e credenciamento na nuvem', { x: 0.7, y: 6.7, w: 9, h: 0.3, fontFace: F, fontSize: 13, color: DARKSUB, margin: 0 });
}

await p.writeFile({ fileName: 'docs/suffra-apresentacao.pptx' });
console.log('pptx-done');
