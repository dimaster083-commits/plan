/* Verify actual served bytes/activated SW/offline with the prior delivery
   chain, then run the same new regressions against that served app, not a
   test-side copy of its calculations. Fresh synthetic profiles only. */
const path = require('node:path');
const { spawn } = require('node:child_process');
const url = process.env.GYM_APP_URL || 'https://dimaster083-commits.github.io/plan/';
async function run(relative) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.resolve(__dirname, relative)], {
      stdio: 'inherit', env: {...process.env, GYM_APP_URL: url}
    });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(relative + ' exit ' + code)));
  });
}
(async () => {
  await run('../1.4.8.8.9/delivery.cjs');
  await run('../../suites/food-delete-undo-oct16.js');
  await run('../../suites/month-report-oct16.js');
  console.log('Actual v10 delivery: canonical/offline/prior UI + food/month regressions passed');
})().catch(e => { console.error('FATAL', e); process.exitCode = 1; });
