import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import { createDashboardServer } from './serve.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const server = createDashboardServer();
let browser;
let temporaryDirectory;

async function assertOfflineReport(download, expectedFilename, expectedText) {
    assert.equal(download.suggestedFilename(), expectedFilename);
    const path = join(temporaryDirectory, expectedFilename);
    await download.saveAs(path);
    const html = await readFile(path, 'utf8');
    assert.match(html, /<!doctype html/i, 'report should be a standalone HTML document');
    assert.ok(html.includes(expectedText), `report should contain expected assumption text: ${expectedText}`);
    assert.doesNotMatch(html, /<script\b/i, 'offline report must not contain executable scripts');
    assert.doesNotMatch(html, /<(?:script|link|img)\b[^>]*(?:src|href)=["']https?:\/\//i,
        'offline report must not depend on remote assets');
    return html;
}

try {
    temporaryDirectory = await mkdtemp(join(tmpdir(), 'pfo-fire-browser-'));
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const baseUrl = `http://127.0.0.1:${address.port}/`;

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.getByLabel('Current investable portfolio (₹)').fill('10000000');
    await page.locator('#fire-annual-contribution').fill('300000');
    await page.getByLabel('Years until retirement').fill('10');
    await page.getByLabel('Expected annual return (%)').fill('7');
    await page.getByLabel('Annual inflation (%)').fill('3');
    await page.getByLabel("Annual spending in today's money (₹)").fill('600000');
    await page.getByLabel('Initial withdrawal rate (%)').fill('4');

    await page.getByRole('button', { name: 'Calculate readiness' }).click();
    assert.equal(await page.locator('#fire-results').isVisible(), true, 'readiness results should appear');
    assert.notEqual((await page.locator('#fire-projected-portfolio').innerText()).trim(), '—');
    assert.notEqual((await page.locator('#fire-target-corpus').innerText()).trim(), '—');
    process.stdout.write('PASS: FIRE readiness calculates and displays results.\n');

    // Bypass the input event intentionally so this specifically exercises the invalid-submit stale-result guard.
    await page.locator('#fire-spending').evaluate((element) => { element.value = ''; });
    await page.getByRole('button', { name: 'Solve required annual contribution' }).click();
    assert.equal(await page.locator('#fire-results').isHidden(), true,
        'an invalid required-contribution solve must clear stale results');
    assert.equal(await page.locator('#fire-required-result').isHidden(), true,
        'an invalid solve must clear the previous required-contribution message');
    process.stdout.write('PASS: invalid required-contribution submission clears stale results.\n');

    await page.getByLabel("Annual spending in today's money (₹)").fill('600000');
    await page.getByRole('button', { name: 'Solve required annual contribution' }).click();
    assert.equal(await page.locator('#fire-results').isVisible(), true, 'valid solver results should appear');
    assert.equal(await page.locator('#fire-required-result').isVisible(), true,
        'required annual contribution should be displayed');
    assert.match(await page.locator('#fire-required-result').innerText(), /Required constant annual contribution:/);
    process.stdout.write('PASS: required annual contribution solver returns a visible result.\n');

    const [singleDownload] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: 'Download offline HTML report' }).click()
    ]);
    await assertOfflineReport(singleDownload, 'pfo-fire-scenario-report.html', 'Annual spending today:');
    process.stdout.write('PASS: single-scenario report downloads as standalone, script-free HTML.\n');

    await page.getByRole('button', { name: 'Compare scenarios' }).click();
    assert.equal(await page.locator('#fire-comparison').isVisible(), true, 'scenario comparison panel should open');
    await page.getByRole('button', { name: 'Copy current assumptions into all scenarios' }).click();
    await page.locator('#fire-compare-a-name').fill('Conservative');
    await page.locator('#fire-compare-a-contribution').fill('200000');
    await page.locator('#fire-compare-b-name').fill('Baseline');
    await page.locator('#fire-compare-b-contribution').fill('300000');
    await page.locator('#fire-compare-c-name').fill('Higher saving');
    await page.locator('#fire-compare-c-contribution').fill('500000');
    await page.locator('#fire-compare-run').click();
    assert.equal(await page.locator('#fire-compare-results').isVisible(), true, 'comparison results should appear');
    assert.equal(await page.locator('#fire-compare-body tr').count(), 3, 'comparison should render all three scenarios');
    assert.match(await page.locator('#fire-compare-body').innerText(), /Conservative[\s\S]*Baseline[\s\S]*Higher saving/);
    process.stdout.write('PASS: three-scenario comparison renders each scenario in entered order.\n');

    const [comparisonDownload] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: 'Download comparison report' }).click()
    ]);
    await assertOfflineReport(comparisonDownload, 'pfo-fire-comparison-report.html', 'Conservative');
    const comparisonHtml = await readFile(join(temporaryDirectory, 'pfo-fire-comparison-report.html'), 'utf8');
    assert.ok(comparisonHtml.includes('Baseline') && comparisonHtml.includes('Higher saving'),
        'comparison report should include all three scenario names');
    process.stdout.write('PASS: comparison report downloads with all scenario assumptions and no remote dependencies.\n');

    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    await page.locator('#goal-name').fill('Emergency fund');
    await page.locator('#goal-target').fill('1000000');
    await page.locator('#goal-current').fill('250000');
    await page.locator('#goal-date').fill(futureDate.toISOString().slice(0, 10));
    await page.getByRole('button', { name: 'Calculate goal progress' }).click();
    assert.equal(await page.locator('#goal-results').isVisible(), true, 'goal progress results should appear');
    assert.equal((await page.locator('#goal-progress-percent').innerText()).trim(), '25%',
        'goal progress should reflect accumulated amount divided by target');
    assert.equal(await page.locator('#goal-progress-bar').getAttribute('aria-valuetext'), '25 percent of target');
    await page.getByRole('button', { name: 'Reset goal' }).click();
    assert.equal(await page.locator('#goal-results').isHidden(), true, 'reset should clear goal results');
    process.stdout.write('PASS: goal tracker calculates accessible progress and reset clears its results.\\n');

    await page.reload({ waitUntil: 'networkidle' });
    let reachedFireInput = false;
    for (let index = 0; index < 40; index += 1) {
        await page.keyboard.press('Tab');
        if (await page.evaluate(() => globalThis.document.activeElement?.id === 'fire-current-portfolio')) {
            reachedFireInput = true;
            break;
        }
    }
    assert.equal(reachedFireInput, true, 'keyboard tab order should reach the first FIRE planner input');
    await page.setViewportSize({ width: 320, height: 800 });
    const viewport = await page.evaluate(() => ({
        width: globalThis.window.innerWidth,
        documentWidth: globalThis.document.documentElement.scrollWidth,
        offenders: [...globalThis.document.querySelectorAll('body *')]
            .map((element) => ({ tag: element.tagName, id: element.id, className: String(element.className).slice(0, 80),
                left: Math.round(element.getBoundingClientRect().left), right: Math.round(element.getBoundingClientRect().right) }))
            .filter((element) => element.right > globalThis.window.innerWidth + 1 || element.left < -1)
            .slice(0, 12)
    }));
    assert.ok(viewport.documentWidth <= viewport.width,
        `narrow viewport should not cause page-level horizontal overflow (viewport ${viewport.width}, document ${viewport.documentWidth}, offenders ${JSON.stringify(viewport.offenders)})`);
    process.stdout.write('PASS: keyboard tab order reaches FIRE controls and 320px layout has no page-level horizontal overflow.\\n');

    assert.deepEqual(pageErrors, [], 'browser should not report uncaught JavaScript errors');
    process.stdout.write('PASS: no uncaught browser JavaScript errors.\n');
    await context.close();
} catch (error) {
    process.stderr.write('FIRE planner browser smoke test failed.\n');
    throw error;
} finally {
    if (browser) await browser.close();
    if (server.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
}
