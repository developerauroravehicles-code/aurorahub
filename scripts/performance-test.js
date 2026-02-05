/**
 * Performance Test Script
 * Tests various performance metrics of the application
 */

const fs = require('fs');
const path = require('path');

// Create performance reports directory
const reportsDir = path.join(process.cwd(), 'performance-reports');
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

// Performance test results
const performanceReport = {
  timestamp: new Date().toISOString(),
  tests: [],
  summary: {
    totalTests: 0,
    passed: 0,
    failed: 0,
    warnings: 0,
  },
  recommendations: [],
};

// Test 1: Check for select('*') queries
function testSelectAllQueries() {
  console.log('🔍 Testing: Database Query Optimization (select *)...');
  
  const srcDir = path.join(process.cwd(), 'src');
  const files = getAllFiles(srcDir);
  const selectAllMatches = [];
  
  files.forEach(file => {
    if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      const content = fs.readFileSync(file, 'utf8');
      const matches = content.match(/\.select\(['"]\*['"]\)/g);
      if (matches) {
        selectAllMatches.push({
          file: file.replace(process.cwd(), ''),
          count: matches.length,
        });
      }
    }
  });
  
  const testResult = {
    name: 'Database Query Optimization',
    status: selectAllMatches.length > 0 ? 'warning' : 'passed',
    details: {
      totalFilesWithSelectAll: selectAllMatches.length,
      files: selectAllMatches,
    },
  };
  
  if (selectAllMatches.length > 0) {
    performanceReport.recommendations.push({
      type: 'optimization',
      priority: 'medium',
      message: `Found ${selectAllMatches.length} files using select('*'). Consider selecting only required columns for better performance.`,
      files: selectAllMatches.map(f => f.file),
    });
  }
  
  performanceReport.tests.push(testResult);
  performanceReport.summary.totalTests++;
  if (testResult.status === 'passed') performanceReport.summary.passed++;
  else if (testResult.status === 'warning') performanceReport.summary.warnings++;
  
  console.log(`   ${testResult.status === 'passed' ? '✅' : '⚠️'}  Found ${selectAllMatches.length} files with select('*')`);
}

// Test 2: Check for large client components
function testClientComponents() {
  console.log('🔍 Testing: Client Component Analysis...');
  
  const srcDir = path.join(process.cwd(), 'src');
  const files = getAllFiles(srcDir);
  const clientComponents = [];
  
  files.forEach(file => {
    if (file.endsWith('.tsx')) {
      const content = fs.readFileSync(file, 'utf8');
      if (content.includes("'use client'") || content.includes('"use client"')) {
        const lines = content.split('\n').length;
        const size = fs.statSync(file).size;
        clientComponents.push({
          file: file.replace(process.cwd(), ''),
          lines,
          size,
        });
      }
    }
  });
  
  const largeComponents = clientComponents.filter(c => c.lines > 500 || c.size > 50000);
  
  const testResult = {
    name: 'Client Component Size Analysis',
    status: largeComponents.length > 0 ? 'warning' : 'passed',
    details: {
      totalClientComponents: clientComponents.length,
      largeComponents: largeComponents,
    },
  };
  
  if (largeComponents.length > 0) {
    performanceReport.recommendations.push({
      type: 'optimization',
      priority: 'medium',
      message: `Found ${largeComponents.length} large client components (>500 lines or >50KB). Consider code splitting.`,
      files: largeComponents.map(c => c.file),
    });
  }
  
  performanceReport.tests.push(testResult);
  performanceReport.summary.totalTests++;
  if (testResult.status === 'passed') performanceReport.summary.passed++;
  else if (testResult.status === 'warning') performanceReport.summary.warnings++;
  
  console.log(`   ${testResult.status === 'passed' ? '✅' : '⚠️'}  Found ${clientComponents.length} client components (${largeComponents.length} large)`);
}

// Test 3: Check for missing React.memo
function testReactMemo() {
  console.log('🔍 Testing: React.memo Usage...');
  
  const srcDir = path.join(process.cwd(), 'src');
  const files = getAllFiles(srcDir);
  const componentsWithoutMemo = [];
  
  files.forEach(file => {
    if (file.endsWith('.tsx')) {
      const content = fs.readFileSync(file, 'utf8');
      if (content.includes("'use client'") || content.includes('"use client"')) {
        const hasProps = content.match(/export\s+(?:function|const)\s+\w+\s*[({]/);
        const hasMemo = content.includes('React.memo') || content.includes('memo(');
        if (hasProps && !hasMemo) {
          componentsWithoutMemo.push({
            file: file.replace(process.cwd(), ''),
          });
        }
      }
    }
  });
  
  const testResult = {
    name: 'React.memo Optimization',
    status: componentsWithoutMemo.length > 10 ? 'warning' : 'passed',
    details: {
      componentsWithoutMemo: componentsWithoutMemo.length,
      files: componentsWithoutMemo.slice(0, 10), // Limit to first 10
    },
  };
  
  if (componentsWithoutMemo.length > 10) {
    performanceReport.recommendations.push({
      type: 'optimization',
      priority: 'low',
      message: `Found ${componentsWithoutMemo.length} client components that could benefit from React.memo for re-render optimization.`,
    });
  }
  
  performanceReport.tests.push(testResult);
  performanceReport.summary.totalTests++;
  if (testResult.status === 'passed') performanceReport.summary.passed++;
  else if (testResult.status === 'warning') performanceReport.summary.warnings++;
  
  console.log(`   ${testResult.status === 'passed' ? '✅' : '⚠️'}  Found ${componentsWithoutMemo.length} components without React.memo`);
}

// Test 4: Check for missing dynamic imports
function testDynamicImports() {
  console.log('🔍 Testing: Dynamic Import Usage...');
  
  const srcDir = path.join(process.cwd(), 'src');
  const files = getAllFiles(srcDir);
  const heavyImports = [];
  
  files.forEach(file => {
    if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      const content = fs.readFileSync(file, 'utf8');
      // Check for heavy imports that could be lazy loaded
      const heavyImportPatterns = [
        /import.*from.*['"]lucide-react['"]/,
        /import.*from.*['"]date-fns['"]/,
      ];
      
      heavyImportPatterns.forEach(pattern => {
        if (pattern.test(content) && !content.includes('dynamic') && !content.includes('lazy')) {
          heavyImports.push({
            file: file.replace(process.cwd(), ''),
            pattern: pattern.toString(),
          });
        }
      });
    }
  });
  
  const testResult = {
    name: 'Dynamic Import Optimization',
    status: heavyImports.length > 5 ? 'warning' : 'passed',
    details: {
      filesWithHeavyImports: heavyImports.length,
      files: heavyImports.slice(0, 10),
    },
  };
  
  if (heavyImports.length > 5) {
    performanceReport.recommendations.push({
      type: 'optimization',
      priority: 'low',
      message: `Found ${heavyImports.length} files with heavy imports that could benefit from dynamic imports.`,
    });
  }
  
  performanceReport.tests.push(testResult);
  performanceReport.summary.totalTests++;
  if (testResult.status === 'passed') performanceReport.summary.passed++;
  else if (testResult.status === 'warning') performanceReport.summary.warnings++;
  
  console.log(`   ${testResult.status === 'passed' ? '✅' : '⚠️'}  Found ${heavyImports.length} files with heavy imports`);
}

// Test 5: Check Next.js config optimizations
function testNextConfig() {
  console.log('🔍 Testing: Next.js Configuration...');
  
  const configPath = path.join(process.cwd(), 'next.config.ts');
  if (!fs.existsSync(configPath)) {
    performanceReport.tests.push({
      name: 'Next.js Configuration',
      status: 'failed',
      details: { message: 'next.config.ts not found' },
    });
    performanceReport.summary.totalTests++;
    performanceReport.summary.failed++;
    console.log('   ❌ next.config.ts not found');
    return;
  }
  
  const content = fs.readFileSync(configPath, 'utf8');
  const checks = {
    compress: content.includes('compress:'),
    images: content.includes('images:'),
    optimizePackageImports: content.includes('optimizePackageImports'),
  };
  
  const allPassed = Object.values(checks).every(v => v);
  
  const testResult = {
    name: 'Next.js Configuration',
    status: allPassed ? 'passed' : 'warning',
    details: checks,
  };
  
  if (!allPassed) {
    performanceReport.recommendations.push({
      type: 'configuration',
      priority: 'high',
      message: 'Next.js configuration could be optimized. Check compress, images, and optimizePackageImports settings.',
    });
  }
  
  performanceReport.tests.push(testResult);
  performanceReport.summary.totalTests++;
  if (testResult.status === 'passed') performanceReport.summary.passed++;
  else if (testResult.status === 'warning') performanceReport.summary.warnings++;
  
  console.log(`   ${testResult.status === 'passed' ? '✅' : '⚠️'}  Configuration checks: ${JSON.stringify(checks)}`);
}

// Helper function to get all files recursively
function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Skip node_modules and .next
      if (!file.startsWith('.') && file !== 'node_modules' && file !== '.next') {
        getAllFiles(filePath, fileList);
      }
    } else {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Run all tests
console.log('🚀 Starting Performance Tests...\n');

testSelectAllQueries();
testClientComponents();
testReactMemo();
testDynamicImports();
testNextConfig();

// Generate report
const reportPath = path.join(reportsDir, `performance-report-${Date.now()}.json`);
fs.writeFileSync(reportPath, JSON.stringify(performanceReport, null, 2));

// Generate markdown report
const markdownReport = generateMarkdownReport(performanceReport);
const markdownPath = path.join(reportsDir, `performance-report-${Date.now()}.md`);
fs.writeFileSync(markdownPath, markdownReport);

console.log('\n📊 Performance Test Summary:');
console.log(`   Total Tests: ${performanceReport.summary.totalTests}`);
console.log(`   ✅ Passed: ${performanceReport.summary.passed}`);
console.log(`   ⚠️  Warnings: ${performanceReport.summary.warnings}`);
console.log(`   ❌ Failed: ${performanceReport.summary.failed}`);
console.log(`\n📄 Reports generated:`);
console.log(`   JSON: ${reportPath}`);
console.log(`   Markdown: ${markdownPath}`);

function generateMarkdownReport(report) {
  let md = `# Performance Test Report\n\n`;
  md += `**Generated:** ${report.timestamp}\n\n`;
  md += `## Summary\n\n`;
  md += `- Total Tests: ${report.summary.totalTests}\n`;
  md += `- ✅ Passed: ${report.summary.passed}\n`;
  md += `- ⚠️  Warnings: ${report.summary.warnings}\n`;
  md += `- ❌ Failed: ${report.summary.failed}\n\n`;
  
  md += `## Test Results\n\n`;
  report.tests.forEach(test => {
    md += `### ${test.name}\n\n`;
    md += `**Status:** ${test.status === 'passed' ? '✅ Passed' : test.status === 'warning' ? '⚠️ Warning' : '❌ Failed'}\n\n`;
    md += `**Details:**\n\`\`\`json\n${JSON.stringify(test.details, null, 2)}\n\`\`\`\n\n`;
  });
  
  if (report.recommendations.length > 0) {
    md += `## Recommendations\n\n`;
    report.recommendations.forEach((rec, index) => {
      md += `${index + 1}. **[${rec.priority.toUpperCase()}]** ${rec.message}\n`;
      if (rec.files) {
        md += `   - Files: ${rec.files.slice(0, 5).join(', ')}${rec.files.length > 5 ? '...' : ''}\n`;
      }
      md += `\n`;
    });
  }
  
  return md;
}

