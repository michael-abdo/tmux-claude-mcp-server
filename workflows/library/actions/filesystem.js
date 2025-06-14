/**
 * File system actions - File and directory operations
 */

const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');

class FilesystemActions extends EventEmitter {
  constructor(context, options = {}) {
    super();
    this.context = context;
  }

  /**
   * Save content to a file
   */
  async save_file(action) {
    const filePath = this.context.interpolate(action.path);
    const content = this.context.interpolate(action.content);
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    
    // Write file
    await fs.writeFile(filePath, content, 'utf8');
    
    console.log(`Saved file: ${filePath}`);
    return { path: filePath, size: content.length };
  }

  /**
   * Read content from a file
   */
  async read_file(action) {
    const filePath = this.context.interpolate(action.path);
    const content = await fs.readFile(filePath, 'utf8');
    
    return { content, path: filePath, size: content.length };
  }

  /**
   * Delete a file
   */
  async delete_file(action) {
    const filePath = this.context.interpolate(action.path);
    
    try {
      await fs.unlink(filePath);
      console.log(`Deleted file: ${filePath}`);
      return { deleted: true, path: filePath };
    } catch (error) {
      if (action.ignore_missing && error.code === 'ENOENT') {
        return { deleted: false, path: filePath, reason: 'not_found' };
      }
      throw error;
    }
  }

  /**
   * Create a directory
   */
  async create_directory(action) {
    const dirPath = this.context.interpolate(action.path);
    
    await fs.mkdir(dirPath, { recursive: true });
    
    console.log(`Created directory: ${dirPath}`);
    return { created: true, path: dirPath };
  }

  /**
   * Copy a file
   */
  async copy_file(action) {
    const sourcePath = this.context.interpolate(action.source);
    const destPath = this.context.interpolate(action.destination);
    
    // Ensure destination directory exists
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    
    // Copy file
    await fs.copyFile(sourcePath, destPath);
    
    console.log(`Copied file: ${sourcePath} -> ${destPath}`);
    return { copied: true, source: sourcePath, destination: destPath };
  }

  /**
   * List files in a directory
   */
  async list_files(action) {
    const dirPath = this.context.interpolate(action.path);
    const pattern = action.pattern;
    
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    let files = entries.map(entry => ({
      name: entry.name,
      path: path.join(dirPath, entry.name),
      isFile: entry.isFile(),
      isDirectory: entry.isDirectory()
    }));
    
    // Apply pattern filter if specified
    if (pattern) {
      const regex = new RegExp(pattern);
      files = files.filter(file => regex.test(file.name));
    }
    
    return { files, count: files.length, directory: dirPath };
  }

  /**
   * Check if file or directory exists
   */
  async file_exists(action) {
    const filePath = this.context.interpolate(action.path);
    
    try {
      const stats = await fs.stat(filePath);
      return { 
        exists: true, 
        path: filePath,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        size: stats.size,
        modified: stats.mtime
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { exists: false, path: filePath };
      }
      throw error;
    }
  }

  /**
   * Append content to a file
   */
  async append_file(action) {
    const filePath = this.context.interpolate(action.path);
    const content = this.context.interpolate(action.content);
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    
    // Append to file
    await fs.appendFile(filePath, content, 'utf8');
    
    console.log(`Appended to file: ${filePath}`);
    return { path: filePath, appended: content.length };
  }
}

module.exports = FilesystemActions;