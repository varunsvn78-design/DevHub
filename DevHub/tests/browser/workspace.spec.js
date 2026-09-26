const { test, expect } = require('@playwright/test');
const repo = { full_name: 'acme/engine', name: 'engine', description: 'A useful open-source engine.', stargazers_count: 12500, forks_count: 400, language: 'JavaScript', html_url: 'https://github.com/acme/engine', open_issues_count: 250, subscribers_count: 18 };
test.beforeEach(async ({ page }) => {
  await page.route('**/api/ratelimit', r => r.fulfill({ json: { github: { remaining: 55, limit: 60 } } }));
  await page.route('**/api/search/repos?**', r => r.fulfill({ json: { items: [repo], total_count: 30 } }));
  await page.route('**/api/search/users?**', r => r.fulfill({ json: { items: [{ login: 'alice', type: 'User', avatar_url: 'https://github.com/alice.png' }], total_count: 1 } }));
});
test('search supports pagination and developer results', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'engine', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.getByText('Page 2 of 3')).toBeVisible();
  await page.getByRole('tab', { name: 'Developers' }).click();
  await page.getByRole('searchbox').fill('alice');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'alice', exact: true })).toBeVisible();
});
test('login errors are visible and the modal is keyboard dismissible', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Sign in/ }).click();
  await page.getByLabel('Username or email').fill('nonexistent');
  await page.locator('#loginForm').getByLabel('Password', { exact: true }).fill('bad-password');
  await page.getByRole('button', { name: 'Sign in to your workspace' }).click();
  await expect(page.getByRole('alert')).toContainText('invalid credentials');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});
test('repository displays full issue count, watchers and pending analytics', async ({ page }) => {
  await page.route('**/api/repo/acme/engine', r => r.fulfill({ json: { repo, activity: [], contributors: [], languageDistribution: [], openIssues: [{ title: 'Example' }], sectionStatus: { activity: 'pending', languages: 'unavailable', contributors: 'ready', issues: 'ready' } } }));
  await page.goto('/#/repo/acme/engine');
  await expect(page.locator('.tile').filter({ hasText: 'Open issues & PRs' })).toContainText('250');
  await expect(page.locator('.tile').filter({ hasText: 'Watchers' })).toContainText('18');
  await expect(page.getByText(/GitHub is preparing/)).toBeVisible();
  await expect(page.getByText(/Language data is temporarily unavailable/)).toBeVisible();
});
test('registration, save, reload and remove collection', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Sign in/ }).click();
  await page.getByRole('tab', { name: 'Create account' }).click();
  const username = `user${Date.now()}`;
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Email', { exact: true }).fill(`${username}@test.dev`);
  await page.locator('#registerForm').getByLabel('Password', { exact: true }).fill('password123');
  await page.getByRole('button', { name: 'Create your workspace' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Save acme/engine', exact: true }).click();
  await page.getByRole('link', { name: /My collection/ }).click();
  await expect(page.getByRole('heading', { name: 'acme/engine' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'acme/engine' })).toBeVisible();
  await page.getByRole('button', { name: 'Remove acme/engine' }).click();
  await expect(page.getByText('Your collection starts here')).toBeVisible();
});
test('mobile layout fits the viewport and navigation works', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'engine', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('link', { name: 'Compare', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A little perspective.' })).toBeVisible();
});
test('both comparison forms render labelled metrics and sample limits', async ({ page }) => {
  await page.route('**/api/compare/repos?**', r => r.fulfill({ json: { comparison: [{ metric: 'stars', a: 120, b: 240 }] } }));
  await page.route('**/api/compare/devs?**', r => r.fulfill({ json: { comparison: [{ metric: 'totalStars', a: 50, b: null }], sample: { a: { analyzed: 100, total: 220, available: true }, b: { analyzed: 0, total: 80, available: false } } } }));
  await page.goto('/#/compare');
  await page.getByLabel('First repository').fill('acme/one');
  await page.getByLabel('Second repository').fill('acme/two');
  await page.getByRole('button', { name: 'Compare repositories' }).click();
  await expect(page.getByRole('table')).toContainText('240');
  await page.getByLabel('First developer').fill('alice');
  await page.getByLabel('Second developer').fill('bob');
  await page.getByRole('button', { name: 'Compare developers' }).click();
  await expect(page.getByText(/alice: 100 of 220; bob: unavailable/)).toBeVisible();
  await expect(page.getByRole('table')).toContainText('Stars in analyzed repos');
  await expect(page.getByRole('table')).toContainText('—');
});
test('developer profiles disclose samples and link to repositories', async ({ page }) => {
  await page.route('**/api/dev/alice', r => r.fulfill({ json: { profile: { login: 'alice', name: 'Alice Example', public_repos: 200, followers: 10, bio: 'Building useful software.' }, repos: [repo], stats: { totalStars: 12500, totalForks: 400, sampled: true, analyzedRepos: 1, reposAvailable: true, topLanguages: [{ language: 'JavaScript', count: 1 }] } } }));
  await page.goto('/#/dev/alice');
  await expect(page.getByRole('heading', { name: 'Alice Example' })).toBeVisible();
  await expect(page.getByText(/1 most recently updated repositories out of 200/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'engine', exact: true })).toHaveAttribute('href', '#/repo/acme/engine');
});
test('search renders rate-limit retries and genuine no-results states', async ({ page }) => {
  let attempts = 0;
  await page.route('**/api/search/repos?**', r => ++attempts === 1 ? r.fulfill({ status: 429, json: { error: 'GitHub rate limit exceeded.', retryAfter: 35 } }) : r.fulfill({ json: { items: [], total_count: 0 } }));
  await page.goto('/');
  await expect(page.getByText(/Retry in 35 seconds/)).toBeVisible();
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { name: 'Nothing here yet' })).toBeVisible();
});
test('navigation cancels stale developer responses', async ({ page }) => {
  await page.route('**/api/dev/slow', async r => { await new Promise(resolve => setTimeout(resolve, 500)); await r.fulfill({ json: { profile: { login: 'slow', name: 'Slow Profile' }, repos: [], stats: {} } }).catch(() => {}); });
  await page.goto('/#/dev/slow');
  await page.getByRole('link', { name: 'Compare', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A little perspective.' })).toBeVisible();
  await page.waitForTimeout(700);
  await expect(page.getByRole('heading', { name: 'A little perspective.' })).toBeVisible();
  await expect(page.getByText('Slow Profile')).not.toBeVisible();
});
test('expired sessions clear the token and allow signing in again', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('devhub_token', 'expired-token'));
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Sign in/ })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('devhub_token'))).toBeNull();
  await page.getByRole('button', { name: /Sign in/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});
test('skip link focuses main content without changing the route', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.locator('#view')).toBeFocused();
  await expect(page.getByRole('heading', { name: 'engine', exact: true })).toBeVisible();
});
