#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

const projects = {
  '021929944919006658321': 'Voice AI Consultant',
  '021930015005142799484': 'Unknown - needs check',
  '021930257392096132881': 'Unknown - needs check',
  '021930287495333139580': 'Unknown - needs check',
  '021929947185876948092': 'Unknown - needs check',
  '021929016736789551311': 'AI/MLOps Architect'
};

async function createDesignSystem(projectDir, projectType) {
  const content = `# Design System

## Color Palette
- Primary: #0066cc
- Secondary: #00a86b
- Background: #f8f9fa
- Text: #333333
- Border: #dee2e6

## Typography
- Font Family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif
- Heading 1: 2.5rem, bold
- Heading 2: 2rem, bold
- Body: 1rem, regular
- Small: 0.875rem

## Components
- Cards with shadow and rounded corners
- Primary buttons with hover effects
- Clean navigation bar
- Professional layout with proper spacing
`;

  await fs.writeFile(path.join(projectDir, 'DESIGN_SYSTEM.md'), content);
}

async function createIndexHTML(projectDir, projectType) {
  let content = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectType} Demo</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <nav class="navbar">
        <div class="container">
            <h1 class="logo">${projectType}</h1>
            <ul class="nav-menu">
                <li><a href="#home">Home</a></li>
                <li><a href="#features">Features</a></li>
                <li><a href="#demo">Demo</a></li>
                <li><a href="#contact">Contact</a></li>
            </ul>
        </div>
    </nav>

    <main>
        <section id="home" class="hero">
            <div class="container">
                <h1>Professional ${projectType} Solutions</h1>
                <p>Expert implementation and consulting services</p>
                <button class="btn-primary">Get Started</button>
            </div>
        </section>

        <section id="features" class="features">
            <div class="container">
                <h2>Key Features</h2>
                <div class="feature-grid">
                    <div class="feature-card">
                        <h3>Advanced Technology</h3>
                        <p>Cutting-edge solutions using the latest technologies</p>
                    </div>
                    <div class="feature-card">
                        <h3>Scalable Architecture</h3>
                        <p>Built for growth and performance</p>
                    </div>
                    <div class="feature-card">
                        <h3>Expert Support</h3>
                        <p>Professional guidance every step of the way</p>
                    </div>
                </div>
            </div>
        </section>

        <section id="demo" class="demo-section">
            <div class="container">
                <h2>Interactive Demo</h2>
                <div id="demo-content" class="demo-content">
                    <!-- Dynamic content will be inserted here -->
                </div>
            </div>
        </section>
    </main>

    <footer>
        <div class="container">
            <p>&copy; 2025 ${projectType} Demo. All rights reserved.</p>
        </div>
    </footer>

    <script src="script.js"></script>
</body>
</html>`;

  await fs.writeFile(path.join(projectDir, 'index.html'), content);
}

async function createStyleCSS(projectDir) {
  const content = `:root {
    --primary-color: #0066cc;
    --secondary-color: #00a86b;
    --background-color: #f8f9fa;
    --text-color: #333333;
    --border-color: #dee2e6;
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: var(--text-color);
    background-color: var(--background-color);
    line-height: 1.6;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 20px;
}

.navbar {
    background: white;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    padding: 1rem 0;
}

.navbar .container {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.logo {
    font-size: 1.5rem;
    color: var(--primary-color);
}

.nav-menu {
    display: flex;
    list-style: none;
    gap: 2rem;
}

.nav-menu a {
    text-decoration: none;
    color: var(--text-color);
    transition: color 0.3s;
}

.nav-menu a:hover {
    color: var(--primary-color);
}

.hero {
    background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
    color: white;
    padding: 4rem 0;
    text-align: center;
}

.hero h1 {
    font-size: 2.5rem;
    margin-bottom: 1rem;
}

.btn-primary {
    background: white;
    color: var(--primary-color);
    border: none;
    padding: 12px 30px;
    font-size: 1rem;
    border-radius: 5px;
    cursor: pointer;
    transition: transform 0.3s;
}

.btn-primary:hover {
    transform: translateY(-2px);
}

.features {
    padding: 4rem 0;
}

.feature-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2rem;
    margin-top: 2rem;
}

.feature-card {
    background: white;
    padding: 2rem;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    transition: transform 0.3s;
}

.feature-card:hover {
    transform: translateY(-5px);
}

.demo-section {
    padding: 4rem 0;
    background: white;
}

.demo-content {
    margin-top: 2rem;
    padding: 2rem;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    min-height: 400px;
}

footer {
    background: var(--text-color);
    color: white;
    text-align: center;
    padding: 2rem 0;
}
`;

  await fs.writeFile(path.join(projectDir, 'style.css'), content);
}

async function createScriptJS(projectDir, projectType) {
  const content = `// Initialize demo
document.addEventListener('DOMContentLoaded', function() {
    console.log('${projectType} Demo Initialized');
    
    // Demo content based on project type
    const demoContent = document.getElementById('demo-content');
    
    // Add interactive demo based on project type
    if ('${projectType}'.includes('AI') || '${projectType}'.includes('ML')) {
        demoContent.innerHTML = \`
            <div class="ml-demo">
                <h3>ML Pipeline Visualization</h3>
                <div class="pipeline-stages">
                    <div class="stage">Data Ingestion</div>
                    <div class="arrow">→</div>
                    <div class="stage">Feature Engineering</div>
                    <div class="arrow">→</div>
                    <div class="stage">Model Training</div>
                    <div class="arrow">→</div>
                    <div class="stage">Deployment</div>
                </div>
                <button onclick="simulatePipeline()" class="btn-primary">Run Pipeline</button>
                <div id="pipeline-output"></div>
            </div>
        \`;
    } else if ('${projectType}'.includes('Voice')) {
        demoContent.innerHTML = \`
            <div class="voice-demo">
                <h3>Voice AI Platform Comparison</h3>
                <table class="comparison-table">
                    <tr>
                        <th>Platform</th>
                        <th>Latency</th>
                        <th>Quality</th>
                        <th>Cost</th>
                    </tr>
                    <tr>
                        <td>ElevenLabs</td>
                        <td>Low</td>
                        <td>Excellent</td>
                        <td>$$$</td>
                    </tr>
                    <tr>
                        <td>Ultravox</td>
                        <td>Very Low</td>
                        <td>Good</td>
                        <td>$$</td>
                    </tr>
                    <tr>
                        <td>Cartesia</td>
                        <td>Low</td>
                        <td>Very Good</td>
                        <td>$$</td>
                    </tr>
                </table>
                <button onclick="testVoice()" class="btn-primary">Test Voice Synthesis</button>
            </div>
        \`;
    } else {
        demoContent.innerHTML = \`
            <div class="general-demo">
                <h3>Interactive Dashboard</h3>
                <div class="dashboard-grid">
                    <div class="metric-card">
                        <h4>Performance</h4>
                        <div class="metric-value">98%</div>
                    </div>
                    <div class="metric-card">
                        <h4>Uptime</h4>
                        <div class="metric-value">99.9%</div>
                    </div>
                    <div class="metric-card">
                        <h4>Response Time</h4>
                        <div class="metric-value">45ms</div>
                    </div>
                </div>
                <button onclick="refreshMetrics()" class="btn-primary">Refresh Metrics</button>
            </div>
        \`;
    }
    
    // Add smooth scrolling
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            document.querySelector(this.getAttribute('href')).scrollIntoView({
                behavior: 'smooth'
            });
        });
    });
});

// Demo functions
function simulatePipeline() {
    const output = document.getElementById('pipeline-output');
    output.innerHTML = '<p>Pipeline running...</p>';
    
    setTimeout(() => {
        output.innerHTML = '<p style="color: green;">✓ Pipeline completed successfully!</p>';
    }, 2000);
}

function testVoice() {
    alert('Voice synthesis demo would play here in production');
}

function refreshMetrics() {
    document.querySelectorAll('.metric-value').forEach(el => {
        el.style.opacity = '0.5';
        setTimeout(() => {
            el.style.opacity = '1';
            // Update with random values for demo
            if (el.textContent.includes('%')) {
                el.textContent = Math.floor(Math.random() * 10 + 90) + '%';
            } else if (el.textContent.includes('ms')) {
                el.textContent = Math.floor(Math.random() * 50 + 20) + 'ms';
            }
        }, 500);
    });
}

// Add additional styles for demo elements
const style = document.createElement('style');
style.textContent = \`
    .pipeline-stages {
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 2rem 0;
        flex-wrap: wrap;
    }
    
    .stage {
        background: var(--primary-color);
        color: white;
        padding: 1rem 2rem;
        border-radius: 5px;
        margin: 0.5rem;
    }
    
    .arrow {
        font-size: 2rem;
        color: var(--primary-color);
        margin: 0 1rem;
    }
    
    .comparison-table {
        width: 100%;
        border-collapse: collapse;
        margin: 2rem 0;
    }
    
    .comparison-table th,
    .comparison-table td {
        padding: 1rem;
        text-align: left;
        border-bottom: 1px solid var(--border-color);
    }
    
    .comparison-table th {
        background: var(--primary-color);
        color: white;
    }
    
    .dashboard-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 2rem;
        margin: 2rem 0;
    }
    
    .metric-card {
        background: var(--background-color);
        padding: 2rem;
        border-radius: 8px;
        text-align: center;
    }
    
    .metric-value {
        font-size: 2.5rem;
        font-weight: bold;
        color: var(--primary-color);
        margin-top: 1rem;
        transition: opacity 0.3s;
    }
    
    #pipeline-output {
        margin-top: 2rem;
        font-size: 1.2rem;
    }
\`;
document.head.appendChild(style);
`;

  await fs.writeFile(path.join(projectDir, 'script.js'), content);
}

async function createNavigationYAML(projectDir, projectType) {
  const content = `name: "${projectType} - Demo Workflow"
description: "Automated testing workflow for ${projectType} demo"
version: "1.0.0"

config:
  headless: true
  timeout: 15000
  viewport:
    width: 1280
    height: 720

steps:
  - type: navigate
    description: "Navigate to demo homepage"
    url: "file://${projectDir}/index.html"
    screenshot: true
    
  - type: wait-for-selector
    description: "Wait for main content to load"
    selector: "main"
    
  - type: assertText
    description: "Verify page title loaded"
    selector: "h1.logo"
    expected: "${projectType}"
    
  - type: click
    description: "Click Features link"
    selector: "a[href='#features']"
    
  - type: wait-for-selector
    description: "Wait for features section"
    selector: "#features"
    
  - type: assertText
    description: "Verify features section"
    selector: "#features h2"
    expected: "Key Features"
    
  - type: screenshot
    description: "Capture features section"
    
  - type: click
    description: "Click Demo link"
    selector: "a[href='#demo']"
    
  - type: wait-for-selector
    description: "Wait for demo section"
    selector: "#demo"
    
  - type: assertText
    description: "Verify demo section loaded"
    selector: "#demo h2"
    expected: "Interactive Demo"
    
  - type: click
    description: "Test primary button in hero"
    selector: ".hero .btn-primary"
    
  - type: screenshot
    description: "Final screenshot of demo"
    
  - type: evaluate
    description: "Verify JavaScript loaded"
    script: "return typeof simulatePipeline === 'function' || typeof testVoice === 'function' || typeof refreshMetrics === 'function'"
    expected: true
`;

  await fs.writeFile(path.join(projectDir, 'navigation.yaml'), content);
}

async function createDemoForProject(projectId, projectType) {
  const projectDir = `/Users/Mike/Desktop/programming/2_proposals/upwork/${projectId}`;
  
  try {
    console.log(`Creating demo for ${projectId} (${projectType})...`);
    
    // Check if demo files already exist
    const files = await fs.readdir(projectDir);
    if (files.includes('index.html') && files.includes('navigation.yaml')) {
      console.log(`✓ Demo already exists for ${projectId}`);
      return;
    }
    
    // Create all demo files
    await createDesignSystem(projectDir, projectType);
    await createIndexHTML(projectDir, projectType);
    await createStyleCSS(projectDir);
    await createScriptJS(projectDir, projectType);
    await createNavigationYAML(projectDir, projectType);
    
    console.log(`✓ Successfully created demo for ${projectId}`);
  } catch (error) {
    console.error(`✗ Failed to create demo for ${projectId}:`, error.message);
  }
}

async function main() {
  // First, let's check what type of projects these are
  for (const [projectId, projectType] of Object.entries(projects)) {
    if (projectType === 'Unknown - needs check') {
      try {
        const instructionsPath = `/Users/Mike/Desktop/programming/2_proposals/upwork/${projectId}/instructions.md`;
        const content = await fs.readFile(instructionsPath, 'utf-8');
        const projectMatch = content.match(/## Project: (.+)/);
        if (projectMatch) {
          projects[projectId] = projectMatch[1].split(' - ')[0];
          console.log(`Identified ${projectId} as: ${projects[projectId]}`);
        }
      } catch (error) {
        projects[projectId] = 'General Demo';
      }
    }
  }
  
  // Create demos for all projects
  for (const [projectId, projectType] of Object.entries(projects)) {
    await createDemoForProject(projectId, projectType);
  }
  
  console.log('\nAll demos created successfully!');
}

main().catch(console.error);