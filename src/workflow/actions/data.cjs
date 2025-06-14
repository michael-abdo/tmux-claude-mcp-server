/**
 * Data processing actions - Transform, template, and manipulate data
 */

const fs = require('fs').promises;
const EventEmitter = require('events');

class DataActions extends EventEmitter {
  constructor(context, options = {}) {
    super();
    this.context = context;
  }

  /**
   * Transform data using various operations
   */
  async transform(action) {
    const input = this.context.interpolate(action.input);
    let output;
    
    switch (action.operation) {
      case 'json_parse':
        output = JSON.parse(input);
        break;
      
      case 'json_stringify':
        const indent = action.indent || 2;
        output = JSON.stringify(input, null, indent);
        break;
      
      case 'regex_extract':
        const regex = new RegExp(action.pattern, action.flags || 'g');
        const matches = input.match(regex);
        output = action.return_all ? matches : (matches ? matches[0] : null);
        break;
      
      case 'regex_replace':
        const replaceRegex = new RegExp(action.pattern, action.flags || 'g');
        output = input.replace(replaceRegex, action.replacement || '');
        break;
      
      case 'split':
        output = input.split(action.delimiter || '\n');
        break;
      
      case 'join':
        output = Array.isArray(input) ? input.join(action.delimiter || '\n') : input;
        break;
      
      case 'lowercase':
        output = input.toLowerCase();
        break;
      
      case 'uppercase':
        output = input.toUpperCase();
        break;
      
      case 'trim':
        output = input.trim();
        break;
      
      case 'base64_encode':
        output = Buffer.from(input, 'utf8').toString('base64');
        break;
      
      case 'base64_decode':
        output = Buffer.from(input, 'base64').toString('utf8');
        break;
      
      case 'url_encode':
        output = encodeURIComponent(input);
        break;
      
      case 'url_decode':
        output = decodeURIComponent(input);
        break;
      
      case 'hash_md5':
        const crypto = require('crypto');
        output = crypto.createHash('md5').update(input).digest('hex');
        break;
      
      case 'hash_sha256':
        const cryptoSha = require('crypto');
        output = cryptoSha.createHash('sha256').update(input).digest('hex');
        break;
      
      case 'length':
        output = Array.isArray(input) || typeof input === 'string' ? input.length : 0;
        break;
      
      case 'slice':
        const start = action.start || 0;
        const end = action.end;
        output = input.slice(start, end);
        break;
      
      case 'filter':
        if (Array.isArray(input)) {
          const filterExpr = action.expression;
          output = input.filter(item => {
            this.context.set('vars._item', item);
            return this.evaluateExpression(filterExpr);
          });
        } else {
          output = input;
        }
        break;
      
      case 'map':
        if (Array.isArray(input)) {
          const mapExpr = action.expression;
          output = input.map(item => {
            this.context.set('vars._item', item);
            return this.evaluateExpression(mapExpr);
          });
        } else {
          output = input;
        }
        break;
      
      case 'sort':
        if (Array.isArray(input)) {
          output = [...input].sort((a, b) => {
            if (action.key) {
              a = a[action.key];
              b = b[action.key];
            }
            if (action.numeric) {
              return Number(a) - Number(b);
            }
            return String(a).localeCompare(String(b));
          });
          if (action.reverse) {
            output.reverse();
          }
        } else {
          output = input;
        }
        break;
      
      case 'unique':
        if (Array.isArray(input)) {
          output = [...new Set(input)];
        } else {
          output = input;
        }
        break;
      
      default:
        throw new Error(`Unknown transform operation: ${action.operation}`);
    }
    
    console.log(`Transform ${action.operation}: ${typeof input} -> ${typeof output}`);
    return output;
  }

  /**
   * Aggregate multiple data sources
   */
  async aggregate(action) {
    const inputs = action.inputs.map(inputPath => this.context.interpolate(inputPath));
    let output;
    
    switch (action.operation) {
      case 'merge':
        output = Object.assign({}, ...inputs);
        break;
      
      case 'merge_arrays':
        output = [].concat(...inputs);
        break;
      
      case 'sum':
        output = inputs.reduce((sum, val) => sum + Number(val), 0);
        break;
      
      case 'average':
        const sum = inputs.reduce((sum, val) => sum + Number(val), 0);
        output = sum / inputs.length;
        break;
      
      case 'max':
        output = Math.max(...inputs.map(Number));
        break;
      
      case 'min':
        output = Math.min(...inputs.map(Number));
        break;
      
      case 'count':
        output = inputs.length;
        break;
      
      case 'concat':
        output = inputs.join(action.separator || '');
        break;
      
      default:
        throw new Error(`Unknown aggregate operation: ${action.operation}`);
    }
    
    return output;
  }

  /**
   * Render template with context data
   */
  async template(action) {
    let template;
    
    if (action.template_file) {
      const templatePath = this.context.interpolate(action.template_file);
      template = await fs.readFile(templatePath, 'utf8');
    } else if (action.template) {
      template = action.template;
    } else {
      throw new Error('No template or template_file specified');
    }
    
    // Simple template rendering - replace ${var} with context values
    let rendered = template.replace(/\${([^}]+)}/g, (match, path) => {
      return this.context.interpolate(`\${${path}}`);
    });
    
    // Handle template functions
    if (action.functions) {
      for (const [funcName, funcExpr] of Object.entries(action.functions)) {
        const regex = new RegExp(`{{${funcName}\\(([^)]+)\\)}}`, 'g');
        rendered = rendered.replace(regex, (match, args) => {
          const argValues = args.split(',').map(arg => this.context.interpolate(arg.trim()));
          return this.evaluateExpression(funcExpr.replace(/\$(\d+)/g, (m, index) => argValues[index - 1]));
        });
      }
    }
    
    return rendered;
  }

  /**
   * Validate data against schema or rules
   */
  async validate(action) {
    const data = this.context.interpolate(action.data);
    const rules = action.rules || {};
    const errors = [];
    
    // Basic validation rules
    for (const [field, rule] of Object.entries(rules)) {
      const value = this.getNestedValue(data, field);
      
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push(`Field '${field}' is required`);
        continue;
      }
      
      if (value !== undefined && value !== null) {
        if (rule.type && typeof value !== rule.type) {
          errors.push(`Field '${field}' must be of type ${rule.type}`);
        }
        
        if (rule.min !== undefined && value < rule.min) {
          errors.push(`Field '${field}' must be at least ${rule.min}`);
        }
        
        if (rule.max !== undefined && value > rule.max) {
          errors.push(`Field '${field}' must be at most ${rule.max}`);
        }
        
        if (rule.pattern && !new RegExp(rule.pattern).test(value)) {
          errors.push(`Field '${field}' must match pattern ${rule.pattern}`);
        }
        
        if (rule.enum && !rule.enum.includes(value)) {
          errors.push(`Field '${field}' must be one of: ${rule.enum.join(', ')}`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      data
    };
  }

  /**
   * Generate synthetic data for testing
   */
  async generate_data(action) {
    const count = action.count || 1;
    const template = action.template || {};
    const results = [];
    
    for (let i = 0; i < count; i++) {
      const item = {};
      
      for (const [key, generator] of Object.entries(template)) {
        if (typeof generator === 'string') {
          item[key] = this.generateValue(generator, i);
        } else if (typeof generator === 'object') {
          item[key] = this.generateValue(generator.type, i, generator);
        }
      }
      
      results.push(item);
    }
    
    return { data: results, count: results.length };
  }

  generateValue(type, index, options = {}) {
    switch (type) {
      case 'uuid':
        const { v4: uuidv4 } = require('uuid');
        return uuidv4();
      
      case 'number':
        const min = options.min || 0;
        const max = options.max || 100;
        return Math.floor(Math.random() * (max - min + 1)) + min;
      
      case 'string':
        const length = options.length || 10;
        const chars = options.chars || 'abcdefghijklmnopqrstuvwxyz';
        return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      
      case 'email':
        const domains = options.domains || ['example.com', 'test.org'];
        const domain = domains[Math.floor(Math.random() * domains.length)];
        return `user${index}@${domain}`;
      
      case 'date':
        const start = options.start ? new Date(options.start) : new Date(2020, 0, 1);
        const end = options.end ? new Date(options.end) : new Date();
        return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString();
      
      case 'boolean':
        return Math.random() < 0.5;
      
      case 'choice':
        const choices = options.choices || ['A', 'B', 'C'];
        return choices[Math.floor(Math.random() * choices.length)];
      
      case 'sequence':
        return (options.start || 0) + index;
      
      default:
        return type; // Return as literal string
    }
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current && current[key], obj);
  }

  evaluateExpression(expression) {
    try {
      return new Function('context', `
        const ctx = context;
        return ${expression};
      `)(this.context.data);
    } catch (error) {
      console.error('Failed to evaluate expression:', expression, error);
      return null;
    }
  }
}

module.exports = DataActions;