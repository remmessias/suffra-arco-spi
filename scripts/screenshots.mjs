/**
 * Gera capturas de tela em alta resolução (2x) do app para uso em landing page.
 *
 * Pré-requisitos: emuladores rodando, `node seed/seed-demo.mjs` executado e
 * `npm run dev` no ar (http://localhost:5173).
 *
 * Uso: node scripts/screenshots.mjs '<json do seed-demo>'
 * Saída: docs/screenshots/*.png
 */
import { mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = 'http://localhost:5173';
const OUT = 'docs/screenshots';

const cfg = JSON.parse(process.argv[2]);
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--force-device-scale-factor=2', '--hide-scrollbars'],
  defaultViewport: { width: 1280, height: 860, deviceScaleFactor: 2 },
});

const page = await browser.newPage();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function go(path) {
  // networkidle não serve: o app mantém listeners do Firestore e o HMR abertos.
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
  await wait(1500);
}

/** Clica no botão cujo texto casa exatamente. */
async function clickText(text) {
  await page.evaluate((t) => {
    const el = [...document.querySelectorAll('button, a')].find(
      (e) => e.textContent.trim() === t,
    );
    if (el) el.click();
  }, text);
  await wait(900);
}

async function type(selector, value) {
  await page.waitForSelector(selector);
  await page.type(selector, value);
}

/**
 * Captura recortando na altura real do conteúdo (as telas usam min-h-screen,
 * o que deixaria muito espaço vazio embaixo).
 */
async function shot(name, viewport, pad = 32) {
  if (viewport) await page.setViewport({ ...viewport, deviceScaleFactor: 2 });
  await wait(500);
  const bottom = await page.evaluate(() => {
    const visible = [...document.querySelectorAll('body *')].filter((el) => {
      const s = getComputedStyle(el);
      const paintsBg = s.backgroundColor !== 'rgba(0, 0, 0, 0)';
      const isLeafText = el.children.length === 0 && el.textContent.trim();
      return paintsBg || isLeafText;
    });
    return visible.reduce((max, el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 ? Math.max(max, r.bottom) : max;
    }, 0);
  });
  const height = Math.min(
    viewport?.height ?? 860,
    Math.max(240, Math.ceil(bottom + pad)),
  );
  // clip.scale multiplica sobre o deviceScaleFactor: manter 1 para sair em 2x.
  await page.screenshot({
    path: `${OUT}/${name}.png`,
    clip: { x: 0, y: 0, width: viewport.width, height, scale: 1 },
  });
  console.log(
    `✔ ${OUT}/${name}.png  (${viewport.width * 2}×${height * 2}px — ${viewport.width}×${height} @2x)`,
  );
}

const DESKTOP = { width: 1280, height: 1000 };
const PHONE = { width: 440, height: 900 };

// --------------------------------------------------------------- 1. Admin
await go('/admin/login');
await type('input[type=email]', 'admin@suffra.test');
await type('input[type=password]', 'suffra123');
await clickText('Entrar');

await go(`/admin/eleicoes/${cfg.eleicaoId}`);
await clickText('Painel ao Vivo');
await shot('01-painel-ao-vivo', DESKTOP);

await clickText('Apuração');
await shot('02-apuracao', DESKTOP);

await go('/admin');
await shot('03-dashboard', DESKTOP);

// ------------------------------------------------------------- 2. Eleitor
const ctx = browser.defaultBrowserContext();
await page.evaluate(() => { indexedDB.deleteDatabase('firebaseLocalStorageDb'); });
await ctx.clearPermissionOverrides();
await page.deleteCookie(...(await page.cookies()));

await go(`/votar/${cfg.eleicaoId}`);
await page.evaluate(() => { localStorage.clear(); });
await go(`/votar/${cfg.eleicaoId}`);
await type('input[autocomplete=username]', cfg.eleitor.login);
await type('input[type=password]', cfg.eleitor.password);
await clickText('Entrar');
await wait(1200);
await clickText('Confirmar presença');
await wait(1200);
// Deixa uma chapa selecionada: cédula fica mais expressiva e o botão ativo.
await page.evaluate(() => {
  const opt = [...document.querySelectorAll('button')].find((b) =>
    b.textContent.includes('Chapa Unidade e Luta'),
  );
  if (opt) opt.click();
});
await wait(600);
await shot('04-cedula', PHONE, 24);

// ------------------------------------------------------------- 3. Mesário
await page.evaluate(() => { indexedDB.deleteDatabase('firebaseLocalStorageDb'); localStorage.clear(); });
await go(`/mesa/${cfg.credId}`);
await type('input[autocomplete=username]', cfg.mesario.login);
await type('input[type=password]', cfg.mesario.password);
await clickText('Entrar');
await wait(1200);
await page.waitForSelector('input[placeholder^="Buscar"]');
await page.type('input[placeholder^="Buscar"]', 'mariana');
await wait(1500);
await shot('05-credenciamento', PHONE, 24);

await browser.close();
console.log('\nCapturas geradas em', OUT);
