#!/usr/bin/env node

/**
 * Workflow Scaffolding Tool
 * Create new workflows from templates with interactive prompts
 */

const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');

class WorkflowScaffolder {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    this.templatesDir = path.join(__dirname, '../library/templates');
    this.outputDir = path.join(__dirname, '../user');
  }

  async question(prompt) {
    return new Promise(resolve => {
      this.rl.question(prompt, resolve);
    });
  }

  async main() {
    try {
      console.log('🚀 Workflow Scaffolding Tool');
      console.log('=' .repeat(40));
      
      // List available templates
      const templates = await this.getAvailableTemplates();
      console.log('\nAvailable templates:');
      templates.forEach((template, index) => {
        console.log(`  ${index + 1}. ${template.name} - ${template.description}`);
      });
      
      // Select template
      const templateChoice = await this.question('\nSelect template (1-' + templates.length + '): ');
      const selectedTemplate = templates[parseInt(templateChoice) - 1];
      
      if (!selectedTemplate) {
        console.log('Invalid template selection');
        process.exit(1);
      }
      
      console.log(`\nSelected: ${selectedTemplate.name}`);
      
      // Get workflow details
      const workflowName = await this.question('Workflow name: ');
      const workflowDescription = await this.question('Workflow description: ');
      const outputPath = await this.question(`Output file (default: ${workflowName.toLowerCase().replace(/\s+/g, '_')}.yaml): `);
      
      // Load template and get placeholders
      const templateContent = await fs.readFile(selectedTemplate.path, 'utf8');
      const placeholders = this.extractPlaceholders(templateContent);
      
      // Collect placeholder values
      const values = {
        WORKFLOW_NAME: workflowName,
        WORKFLOW_DESCRIPTION: workflowDescription
      };
      
      for (const placeholder of placeholders) {
        if (!values[placeholder]) {
          const value = await this.question(`${placeholder}: `);
          values[placeholder] = value;
        }
      }
      
      // Generate workflow
      const generatedContent = this.fillTemplate(templateContent, values);
      
      // Save workflow
      const finalPath = outputPath || `${workflowName.toLowerCase().replace(/\s+/g, '_')}.yaml`;
      const fullPath = path.join(this.outputDir, finalPath);
      
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, generatedContent);
      
      console.log(`\n✅ Workflow created: ${fullPath}`);
      console.log('\nTo run your workflow:');
      console.log(`npm run workflow:run ${fullPath}`);
      
    } catch (error) {
      console.error('Error creating workflow:', error);
      process.exit(1);
    } finally {
      this.rl.close();
    }
  }

  async getAvailableTemplates() {
    const templates = [];
    const files = await fs.readdir(this.templatesDir);
    
    for (const file of files) {
      if (file.endsWith('.yaml')) {
        const filePath = path.join(this.templatesDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const nameMatch = content.match(/^name:\s*"(.+)"/m);
        const descMatch = content.match(/^description:\s*"(.+)"/m);
        
        templates.push({
          name: nameMatch ? nameMatch[1] : file.replace('.yaml', ''),
          description: descMatch ? descMatch[1] : 'No description',
          path: filePath,
          file: file
        });
      }
    }
    
    return templates;
  }

  extractPlaceholders(content) {
    const placeholders = new Set();
    const regex = /\{([A-Z_]+)\}/g;
    let match;
    
    while ((match = regex.exec(content)) !== null) {
      placeholders.add(match[1]);
    }
    
    return Array.from(placeholders).filter(p => 
      !['WORKFLOW_NAME', 'WORKFLOW_DESCRIPTION'].includes(p)
    );
  }

  fillTemplate(content, values) {
    let result = content;
    
    for (const [key, value] of Object.entries(values)) {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      result = result.replace(regex, value);
    }
    
    return result;
  }
}

// CLI interface
if (require.main === module) {
  const scaffolder = new WorkflowScaffolder();
  scaffolder.main().catch(console.error);
}

module.exports = WorkflowScaffolder;