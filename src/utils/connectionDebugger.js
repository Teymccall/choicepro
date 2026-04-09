/**
 * Connection Debugger Utility
 * Helps diagnose Firestore and network connection issues
 */

export class ConnectionDebugger {
  constructor() {
    this.logs = [];
    this.maxLogs = 100;
    this.startTime = Date.now();
  }

  log(category, message, data = {}) {
    const entry = {
      timestamp: Date.now(),
      elapsed: Date.now() - this.startTime,
      category,
      message,
      data,
      navigator: {
        onLine: navigator.onLine,
        connection: navigator.connection ? {
          effectiveType: navigator.connection.effectiveType,
          downlink: navigator.connection.downlink,
          rtt: navigator.connection.rtt,
          saveData: navigator.connection.saveData
        } : null
      }
    };

    this.logs.push(entry);
    
    // Keep only the last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Console output with color coding
    const color = this.getCategoryColor(category);
    console.log(
      `%c[${category}] ${message}`,
      `color: ${color}; font-weight: bold;`,
      data
    );

    return entry;
  }

  getCategoryColor(category) {
    const colors = {
      'FIRESTORE': '#4285f4',
      'NETWORK': '#34a853',
      'ERROR': '#ea4335',
      'WARNING': '#fbbc04',
      'SUCCESS': '#34a853',
      'INFO': '#4285f4'
    };
    return colors[category] || '#666';
  }

  error(message, error) {
    return this.log('ERROR', message, {
      code: error?.code,
      message: error?.message,
      stack: error?.stack
    });
  }

  warning(message, data) {
    return this.log('WARNING', message, data);
  }

  info(message, data) {
    return this.log('INFO', message, data);
  }

  success(message, data) {
    return this.log('SUCCESS', message, data);
  }

  network(message, data) {
    return this.log('NETWORK', message, data);
  }

  firestore(message, data) {
    return this.log('FIRESTORE', message, data);
  }

  getLogs(category = null) {
    if (category) {
      return this.logs.filter(log => log.category === category);
    }
    return this.logs;
  }

  getRecentErrors(count = 10) {
    return this.logs
      .filter(log => log.category === 'ERROR')
      .slice(-count);
  }

  exportLogs() {
    return {
      logs: this.logs,
      summary: {
        totalLogs: this.logs.length,
        errors: this.logs.filter(l => l.category === 'ERROR').length,
        warnings: this.logs.filter(l => l.category === 'WARNING').length,
        duration: Date.now() - this.startTime,
        browser: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language
        },
        network: {
          onLine: navigator.onLine,
          connection: navigator.connection ? {
            effectiveType: navigator.connection.effectiveType,
            downlink: navigator.connection.downlink,
            rtt: navigator.connection.rtt
          } : null
        }
      }
    };
  }

  clear() {
    this.logs = [];
    this.startTime = Date.now();
  }

  // Diagnose common connection issues
  diagnose() {
    const recentErrors = this.getRecentErrors(5);
    const diagnosis = {
      issues: [],
      recommendations: []
    };

    // Check for network issues
    if (!navigator.onLine) {
      diagnosis.issues.push('Device is offline');
      diagnosis.recommendations.push('Check your internet connection');
    }

    // Check for repeated connection errors
    const connectionErrors = recentErrors.filter(e => 
      e.data?.code?.includes('network') || 
      e.data?.code?.includes('unavailable')
    );

    if (connectionErrors.length >= 3) {
      diagnosis.issues.push('Repeated network connection failures');
      diagnosis.recommendations.push('Check firewall or proxy settings');
      diagnosis.recommendations.push('Verify Firebase project configuration');
    }

    // Check for permission errors
    const permissionErrors = recentErrors.filter(e => 
      e.data?.code?.includes('permission')
    );

    if (permissionErrors.length > 0) {
      diagnosis.issues.push('Permission denied errors detected');
      diagnosis.recommendations.push('Verify Firestore security rules');
      diagnosis.recommendations.push('Check user authentication status');
    }

    // Check connection quality
    if (navigator.connection) {
      const conn = navigator.connection;
      if (conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g') {
        diagnosis.issues.push('Slow network connection detected');
        diagnosis.recommendations.push('Connection may be unstable due to slow network');
      }
      
      if (conn.rtt > 1000) {
        diagnosis.issues.push(`High latency detected (${conn.rtt}ms)`);
        diagnosis.recommendations.push('Network latency is high, may cause timeouts');
      }
    }

    return diagnosis;
  }
}

// Create singleton instance
export const connectionDebugger = new ConnectionDebugger();

// Export helper functions
export const logFirestoreEvent = (message, data) => connectionDebugger.firestore(message, data);
export const logNetworkEvent = (message, data) => connectionDebugger.network(message, data);
export const logError = (message, error) => connectionDebugger.error(message, error);
export const logWarning = (message, data) => connectionDebugger.warning(message, data);
export const logInfo = (message, data) => connectionDebugger.info(message, data);
export const logSuccess = (message, data) => connectionDebugger.success(message, data);
