const fs = require('fs');
const path = require('path');

const agentsToInstall = [
  { file: '.agents/vendor/agency-agents/engineering/engineering-frontend-developer.md', slug: 'agency-frontend-developer' },
  { file: '.agents/vendor/agency-agents/engineering/engineering-backend-architect.md', slug: 'agency-backend-architect' },
  { file: '.agents/vendor/agency-agents/engineering/engineering-software-architect.md', slug: 'agency-software-architect' },
  { file: '.agents/vendor/agency-agents/engineering/engineering-database-optimizer.md', slug: 'agency-database-optimizer' },
  { file: '.agents/vendor/agency-agents/engineering/engineering-code-reviewer.md', slug: 'agency-code-reviewer' },
  { file: '.agents/vendor/agency-agents/engineering/engineering-minimal-change-engineer.md', slug: 'agency-minimal-change-engineer' },
  { file: '.agents/vendor/agency-agents/testing/testing-reality-checker.md', slug: 'agency-reality-checker' },
  { file: '.agents/vendor/agency-agents/testing/testing-api-tester.md', slug: 'agency-api-tester' },
  { file: '.agents/vendor/agency-agents/security/security-appsec-engineer.md', slug: 'agency-appsec-engineer' },
  { file: '.agents/vendor/agency-agents/security/security-secrets-credential-engineer.md', slug: 'agency-secrets-engineer' }
];

agentsToInstall.forEach(({ file, slug }) => {
  if (fs.existsSync(file)) {
    const raw = fs.readFileSync(file, 'utf8');
    const descMatch = raw.match(/description:\s*(.+)/i);
    const desc = descMatch ? descMatch[1].trim() : 'Specialized agent persona from Agency Agents';
    
    let body = raw;
    if (raw.startsWith('---')) {
      const secondIdx = raw.indexOf('---', 3);
      if (secondIdx !== -1) {
        body = raw.slice(secondIdx + 3).trim();
      }
    }

    const targetDir = path.join('.agents', 'skills', slug);
    fs.mkdirSync(targetDir, { recursive: true });
    
    const cleanDesc = desc.replace(/"/g, '').replace(/'/g, '');
    const skillContent = `---\nname: ${slug}\ndescription: "${cleanDesc}"\n---\n\n${body}\n`;
    fs.writeFileSync(path.join(targetDir, 'SKILL.md'), skillContent, 'utf8');
    console.log('Installed agency skill:', slug);
  }
});
