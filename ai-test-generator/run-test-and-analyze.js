import { execSync } from 'child_process';

try {
  execSync('npm run test:pw', { stdio: 'inherit' });
} catch (e) {
  // Ignore test failures
}

// Always run analysis
execSync('npm run analyze:failures', { stdio: 'inherit' });
