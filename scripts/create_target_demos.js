#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

// Our 10 target projects - project 9 needs work, others may need checking
const projects = {
  '021928883419675082665': 'General Demo',
  '021929721942233831631': 'General Demo', 
  '021929947569307581528': 'General Demo',
  '021930012125726874464': 'General Demo',
  '021930156791176731488': 'General Demo',
  '021930293617640405221': 'General Demo',
  '021930381840378173063': 'General Demo',
  '021930401323620832979': 'General Demo',
  '021930443110533988619': 'Restaurant & Lifestyle Deals App',
  '021930627546470513421': 'General Demo'
};

async function createBasicInstructions(projectDir, projectType) {
  const content = `# ${projectType} Project

## Project: ${projectType} - Interactive Demo Application

### Objective
Create a professional interactive demo application that showcases modern web development capabilities.

### Requirements
- Modern, responsive web interface
- Interactive features and animations
- Professional design with clean layout
- Cross-browser compatibility
- Mobile-friendly responsive design

### Technical Stack
- HTML5 for structure
- CSS3 with modern features (Grid, Flexbox, Custom Properties)
- Vanilla JavaScript for interactivity
- No external dependencies required

### Key Features
1. **Navigation**: Clean, responsive navigation bar
2. **Hero Section**: Engaging header with call-to-action
3. **Features Section**: Showcase key capabilities
4. **Interactive Demo**: Functional demo area
5. **Professional Styling**: Modern design system

### Deliverables
- index.html (main page)
- style.css (styling)
- script.js (interactivity)
- navigation.yaml (testing workflow)
- DESIGN_SYSTEM.md (design documentation)

This project demonstrates professional web development skills and modern best practices.
`;

  await fs.writeFile(path.join(projectDir, 'instructions.md'), content);
}

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
    <style>
        :root {
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

        .features h2 {
            text-align: center;
            margin-bottom: 3rem;
        }

        .feature-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
        }

        .feature-card {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            text-align: center;
        }

        .demo-section {
            background: white;
            padding: 4rem 0;
        }

        .demo-content {
            margin-top: 2rem;
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
            border: 1px solid var(--border-color);
        }

        .metric-value {
            font-size: 2.5rem;
            font-weight: bold;
            color: var(--primary-color);
            margin-top: 1rem;
            transition: opacity 0.3s;
        }

        footer {
            background: var(--text-color);
            color: white;
            text-align: center;
            padding: 2rem 0;
        }

        @media (max-width: 768px) {
            .nav-menu {
                gap: 1rem;
            }
            
            .hero h1 {
                font-size: 2rem;
            }
            
            .feature-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
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
                <button class="btn-primary" onclick="showAlert()">Get Started</button>
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
                </div>
            </div>
        </section>
    </main>

    <footer>
        <div class="container">
            <p>&copy; 2025 ${projectType} Demo. All rights reserved.</p>
        </div>
    </footer>

    <script>
        // Add smooth scrolling
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                document.querySelector(this.getAttribute('href')).scrollIntoView({
                    behavior: 'smooth'
                });
            });
        });

        function showAlert() {
            alert('Welcome to ${projectType}! This is a demo of professional web development.');
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

        // Initialize demo
        document.addEventListener('DOMContentLoaded', function() {
            console.log('${projectType} demo loaded successfully');
        });
    </script>
</body>
</html>`;

  await fs.writeFile(path.join(projectDir, 'index.html'), content);
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
    script: "return typeof refreshMetrics === 'function'"
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
    const hasIndex = files.includes('index.html');
    const hasNav = files.includes('navigation.yaml');
    const hasInstructions = files.includes('instructions.md');
    
    if (hasIndex && hasNav && hasInstructions) {
      console.log(`✓ Demo already exists for ${projectId}`);
      return 'existing';
    }
    
    // Determine project type from existing instructions if available
    if (files.includes('instructions.md')) {
      try {
        const content = await fs.readFile(path.join(projectDir, 'instructions.md'), 'utf-8');
        const projectMatch = content.match(/## Project: (.+)/);
        if (projectMatch) {
          projectType = projectMatch[1].split(' - ')[0];
          console.log(`Using existing project type: ${projectType}`);
        }
      } catch (error) {
        // Use default
      }
    }
    
    // Create missing files
    if (!hasInstructions) {
      await createBasicInstructions(projectDir, projectType);
    }
    
    await createDesignSystem(projectDir, projectType);
    await createIndexHTML(projectDir, projectType);
    await createNavigationYAML(projectDir, projectType);
    
    console.log(`✓ Successfully created demo for ${projectId}`);
    return 'created';
  } catch (error) {
    console.error(`✗ Failed to create demo for ${projectId}:`, error.message);
    return 'failed';
  }
}

async function main() {
  console.log('Creating demos for target projects...\n');
  
  const results = {
    existing: [],
    created: [],
    failed: []
  };
  
  // Create demos for all projects
  for (const [projectId, projectType] of Object.entries(projects)) {
    const result = await createDemoForProject(projectId, projectType);
    results[result].push(projectId);
  }
  
  console.log('\n=== SUMMARY ===');
  console.log(`✓ Already complete: ${results.existing.length} projects`);
  console.log(`✓ Newly created: ${results.created.length} projects`);
  console.log(`✗ Failed: ${results.failed.length} projects`);
  
  if (results.created.length > 0) {
    console.log(`\nNewly created demos for:`);
    results.created.forEach(id => console.log(`  - ${id}`));
  }
  
  if (results.failed.length > 0) {
    console.log(`\nFailed to create demos for:`);
    results.failed.forEach(id => console.log(`  - ${id}`));
  }
  
  console.log('\nAll projects processed!');
}

main().catch(console.error);