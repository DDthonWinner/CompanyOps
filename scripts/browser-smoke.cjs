// UI-only happy path on an existing local fixture server. Creates one new project.
const { chromium } = require('../frontend/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
(async () => {
  const executablePath = process.env.BROWSER_EXECUTABLE || (process.platform === 'win32' ? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' : undefined);
  const browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1080 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const name = `검증 · 첫 프로젝트 ${Date.now()}`;
  let projectId;
  page.on('response', async response => {
    if(response.request().method() === 'POST' && response.url().endsWith('/api/projects') && response.ok()) {
      const project = await response.json(); if(project.name === name) projectId = project.id;
    }
  });
  try {
    // Explicitly verify fixture execution before any project is created.
    const backend = process.env.API_BASE || 'http://127.0.0.1:8000';
    const health = await (await page.request.get(`${backend}/health`)).json();
    if(!health.demo) throw Error('This browser check requires a fixture backend.');
    await page.goto(process.env.APP_URL || 'http://localhost:5173');
    await page.locator('.world-skip').click();
    await page.getByRole('button', { name: '새 프로젝트 시작', exact: true }).click();
    await page.getByLabel('프로젝트 이름', { exact: true }).fill(name);
    await page.getByRole('button', { name: '다음', exact: true }).click();
    await page.getByRole('button', { name: 'M 균형 잡힌 제품 개발', exact: true }).click();
    await page.getByLabel('어떤 프로젝트인지 적어주세요').fill('처음 방문한 사용자가 계획 승인부터 결과 회고까지 수행하는 검증용 프로젝트');
    await page.getByRole('button', { name: '프로젝트 생성', exact: true }).click();
    await page.getByTestId('gebar-tab-dashboard').click();
    await page.getByTestId('agent-recommend').click();
    await page.getByTestId('agent-matching-assign').click();
    const initial = page.getByTestId('initial-plan-instruction');
    await initial.fill('입력한 금액의 합계를 계산하는 함수를 작성하고 사용 예제를 남기세요.');
    await page.getByTestId('dash-view').screenshot({ path: path.join(root, 'screenshots/01-first-plan.png') });
    await page.getByTestId('initial-plan-create').click();
    await page.getByTestId('plan-review-complete-btn').click();
    await page.getByTestId('plan-review-panel').screenshot({ path: path.join(root, 'screenshots/02-plan-approval.png') });
    await page.getByTestId('plan-approve-btn').click();
    const approval = page.locator('[data-testid^="milestone-approve-"]').first();
    await approval.waitFor({ timeout: 30000 });
    await page.getByTestId('development-flow').screenshot({ path: path.join(root, 'screenshots/03-development-flow.png') });
    await page.getByTestId('attention-center').screenshot({ path: path.join(root, 'screenshots/04-result-approval.png') });
    await approval.click();
    await page.getByTestId('header-feedback-generate').click();
    await page.getByTestId('feedback-results').waitFor();
    if(await page.getByTestId('feedback-section').getByRole('button', { name: /펼치기/ }).count()) throw Error('Feedback remained collapsed');
    await page.getByTestId('feedback-section').screenshot({ path: path.join(root, 'screenshots/05-feedback.png') });
    const snapshot = await (await page.request.get(`${backend}/api/projects/${projectId}/snapshot`)).json();
    if(snapshot.project.status !== 'COMPLETED') throw Error('Project not completed');
    const pmRoles = new Set((await (await page.request.get(`${backend}/api/roles`)).json()).filter(r => r.code === 'PM').map(r => r.id));
    if(snapshot.agents.filter(a => a.status !== 'REMOVED' && pmRoles.has(a.roleId)).length !== 1) throw Error('PM duplicated during setup');
    if(errors.length) throw Error(errors.join('\n'));
    fs.writeFileSync(path.join(root, 'screenshots/verification.json'), JSON.stringify({ projectId, executionMode: health.executionMode, projectStatus: snapshot.project.status, tasks: snapshot.tasks.length, agents: snapshot.agents.length, pageErrors: errors, verifiedAt: new Date().toISOString() }, null, 2)+'\n');
    console.log('Verified new project → staffing → plan → approval → completion → feedback:', projectId);
  } catch (error) {
    await page.screenshot({path: path.join(root, 'screenshots/browser-failure.png')});
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
