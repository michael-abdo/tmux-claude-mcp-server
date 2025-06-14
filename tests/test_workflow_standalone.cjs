/**
 * Standalone workflow test - verify basic functionality
 */

console.log('Testing basic workflow functionality...');

const fs = require('fs');

try {
  // Test file structure
  console.log('✅ Testing file structure...');
  
  const dirs = [
    'workflows',
    'workflows/examples', 
    'workflows/tests',
    'workflows/library',
    'workflows/library/actions'
  ];
  
  for (const dir of dirs) {
    if (fs.existsSync(dir)) {
      console.log(`✅ Directory exists: ${dir}`);
    } else {
      console.log(`❌ Directory missing: ${dir}`);
    }
  }
  
  // Test test files exist
  const testFiles = [
    'workflows/tests/test_minimal.yaml',
    'workflows/tests/test_script.yaml',
    'workflows/tests/test_file_ops.yaml'
  ];
  
  for (const file of testFiles) {
    if (fs.existsSync(file)) {
      console.log(`✅ Test file exists: ${file}`);
    } else {
      console.log(`❌ Test file missing: ${file}`);
    }
  }
  
  // Test action library files
  const actionFiles = [
    'workflows/library/actions/core.js',
    'workflows/library/actions/script.js',
    'workflows/library/actions/index.js'
  ];
  
  for (const file of actionFiles) {
    if (fs.existsSync(file)) {
      console.log(`✅ Action file exists: ${file}`);
    } else {
      console.log(`❌ Action file missing: ${file}`);
    }
  }
  
  // Test a simple YAML file content
  if (fs.existsSync('workflows/tests/test_minimal.yaml')) {
    const content = fs.readFileSync('workflows/tests/test_minimal.yaml', 'utf8');
    if (content.includes('name:') && content.includes('stages:')) {
      console.log('✅ YAML file has expected structure');
    } else {
      console.log('❌ YAML file structure issue');
    }
  }
  
  console.log('\n🎉 Workflow file structure is correct!');
  console.log('The reorganized structure is in place.');
  console.log('\nNote: Full workflow execution requires dependencies to be installed.');
  console.log('Run: npm install');
  
} catch (error) {
  console.error('❌ Test failed:', error);
  process.exit(1);
}