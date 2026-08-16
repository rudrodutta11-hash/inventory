/**
 * Asserts prefers-reduced-motion disables the pour animation.
 *
 *   node scripts/verify-motion.mjs [url]
 *
 * The control case matters as much as the assertion: if the animation were
 * broken outright, a "no movement under reduce" check would pass for the
 * wrong reason. So both preferences are exercised.
 */
import { chromium } from 'playwright';

const URL_BASE = (process.argv[2] ?? 'http://localhost:4173/inventory/').replace(/\/*$/, '/');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' });

async function pourAndMeasure(reducedMotion, serial) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion });
  const page = await ctx.newPage();
  await page.goto(`${URL_BASE}#/settings`);
  await page.click('text=Load demo cabinet');
  await page.waitForTimeout(800);
  await page.goto(`${URL_BASE}#/b/${serial}`);
  await page.waitForSelector('.fill-readout');

  const liquid = page.locator('.bottle--animate .bottle-liquid').first();
  const transition = await liquid.evaluate((el) => getComputedStyle(el).transition);
  const animation = await page.locator('.bottle--animate .bottle-meniscus').first()
    .evaluate((el) => getComputedStyle(el).animationName);

  await page.click('button:has-text("Pour")');
  await page.click('.sheet button:has-text("45 ml")');
  await page.waitForSelector('text=Poured 45 ml.');

  const immediately = await liquid.evaluate((el) => el.getBoundingClientRect().top);
  await page.waitForTimeout(900);
  const settled = await liquid.evaluate((el) => el.getBoundingClientRect().top);
  await ctx.close();
  return { transition, animation, moved: Math.abs(settled - immediately) };
}

const reduce = await pourAndMeasure('reduce', '001');
const normal = await pourAndMeasure('no-preference', '001');

console.log('reduced-motion: transition =', JSON.stringify(reduce.transition));
console.log('reduced-motion: meniscus animation =', JSON.stringify(reduce.animation));
console.log(`reduced-motion: level moved ${reduce.moved.toFixed(2)}px after the pour was logged`);
console.log('normal:         transition =', JSON.stringify(normal.transition));
console.log(`normal:         level moved ${normal.moved.toFixed(2)}px after the pour was logged`);

const snapped = reduce.transition === 'none' && reduce.animation === 'none' && reduce.moved < 0.5;
const animates = normal.transition !== 'none' && normal.moved > 0.5;

console.log(`\n${snapped ? 'PASS' : 'FAIL'}  reduced motion snaps to the new level with no transition`);
console.log(`${animates ? 'PASS' : 'FAIL'}  control: normal motion does animate`);

await browser.close();
process.exit(snapped && animates ? 0 : 1);
