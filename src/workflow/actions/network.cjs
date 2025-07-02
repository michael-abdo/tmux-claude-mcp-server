/**
 * Network and integration actions - HTTP requests, webhooks, APIs
 */

const axios = require('axios');
const EventEmitter = require('events');

class NetworkActions extends EventEmitter {
  constructor(context, options = {}) {
    super();
    this.context = context;
  }

  /**
   * Make HTTP request
   */
  async http_request(action) {
    const config = {
      method: action.method || 'GET',
      url: this.context.interpolate(action.url),
      headers: action.headers ? this.interpolateObject(action.headers) : {},
      timeout: (action.timeout || 30) * 1000
    };
    
    if (action.body) {
      config.data = this.interpolateObject(action.body);
    }
    
    if (action.params) {
      config.params = this.interpolateObject(action.params);
    }
    
    console.log(`HTTP ${config.method} ${config.url}`);
    
    try {
      const response = await axios(config);
      return {
        status: response.status,
        headers: response.headers,
        body: response.data,
        success: true
      };
    } catch (error) {
      if (error.response) {
        const result = {
          status: error.response.status,
          headers: error.response.headers,
          body: error.response.data,
          success: false,
          error: true
        };
        
        if (action.allow_errors || action.expect_status === error.response.status) {
          return result;
        } else {
          throw new Error(`HTTP ${error.response.status}: ${error.response.statusText}`);
        }
      }
      throw error;
    }
  }

  /**
   * Send webhook notification
   */
  async webhook(action) {
    const payload = action.payload ? this.interpolateObject(action.payload) : {
      workflow: this.context.get('workflow.name'),
      run_id: this.context.get('workflow.run_id'),
      timestamp: new Date().toISOString(),
      message: this.context.interpolate(action.message || 'Workflow notification')
    };
    
    return await this.http_request({
      method: 'POST',
      url: action.url,
      headers: {
        'Content-Type': 'application/json',
        ...action.headers
      },
      body: payload,
      timeout: action.timeout
    });
  }

  /**
   * Send Slack notification
   */
  async slack_notify(action) {
    const message = this.context.interpolate(action.message);
    const webhookUrl = this.context.interpolate(action.webhook_url || action.url);
    
    const payload = {
      text: message,
      username: action.username || 'Workflow Bot',
      icon_emoji: action.icon || ':robot_face:',
      channel: action.channel
    };
    
    if (action.attachments) {
      payload.attachments = this.interpolateObject(action.attachments);
    }
    
    return await this.http_request({
      method: 'POST',
      url: webhookUrl,
      body: payload,
      timeout: action.timeout
    });
  }

  /**
   * Discord notification
   */
  async discord_notify(action) {
    const content = this.context.interpolate(action.message);
    const webhookUrl = this.context.interpolate(action.webhook_url || action.url);
    
    const payload = {
      content,
      username: action.username || 'Workflow Bot',
      avatar_url: action.avatar_url
    };
    
    if (action.embeds) {
      payload.embeds = this.interpolateObject(action.embeds);
    }
    
    return await this.http_request({
      method: 'POST',
      url: webhookUrl,
      body: payload,
      timeout: action.timeout
    });
  }

  /**
   * Download file from URL
   */
  async download_file(action) {
    const url = this.context.interpolate(action.url);
    const destinationPath = this.context.interpolate(action.destination);
    
    console.log(`Downloading ${url} to ${destinationPath}`);
    
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
      timeout: (action.timeout || 300) * 1000
    });
    
    const fs = require('fs');
    const path = require('path');
    
    // Ensure directory exists
    await require('fs').promises.mkdir(path.dirname(destinationPath), { recursive: true });
    
    const writer = fs.createWriteStream(destinationPath);
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        resolve({
          downloaded: true,
          url,
          destination: destinationPath,
          size: response.headers['content-length']
        });
      });
      writer.on('error', reject);
    });
  }

  /**
   * Upload file to URL
   */
  async upload_file(action) {
    const url = this.context.interpolate(action.url);
    const filePath = this.context.interpolate(action.file_path);
    
    console.log(`Uploading ${filePath} to ${url}`);
    
    const fs = require('fs');
    const FormData = require('form-data');
    
    const form = new FormData();
    form.append(action.field_name || 'file', fs.createReadStream(filePath));
    
    // Add additional fields if specified
    if (action.fields) {
      for (const [key, value] of Object.entries(action.fields)) {
        form.append(key, this.context.interpolate(value));
      }
    }
    
    const config = {
      method: 'POST',
      url: url,
      data: form,
      headers: {
        ...form.getHeaders(),
        ...action.headers
      },
      timeout: (action.timeout || 300) * 1000
    };
    
    const response = await axios(config);
    
    return {
      uploaded: true,
      status: response.status,
      url,
      file_path: filePath,
      response: response.data
    };
  }

  interpolateObject(obj) {
    if (typeof obj === 'string') {
      return this.context.interpolate(obj);
    } else if (Array.isArray(obj)) {
      return obj.map(item => this.interpolateObject(item));
    } else if (obj && typeof obj === 'object') {
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.interpolateObject(value);
      }
      return result;
    }
    return obj;
  }
}

module.exports = NetworkActions;