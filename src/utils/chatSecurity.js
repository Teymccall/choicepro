/**
 * Chat Security Utilities
 * Provides input sanitization, validation, and rate limiting for chat messages
 */

// Rate limiting configuration
const RATE_LIMIT = {
  MAX_MESSAGES_PER_MINUTE: 20,
  MAX_MESSAGES_PER_HOUR: 200,
  SPAM_THRESHOLD: 5, // Same message repeated
  MIN_MESSAGE_INTERVAL: 500 // milliseconds between messages
};

// Message history for rate limiting
const messageHistory = new Map();
const lastMessageTime = new Map();

/**
 * Sanitize user input to prevent XSS attacks
 * @param {string} input - Raw user input
 * @returns {string} - Sanitized input
 */
export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return '';
  
  // Remove any HTML tags
  let sanitized = input.replace(/<[^>]*>/g, '');
  
  // Remove script tags and their content
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove event handlers
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
  
  // Remove javascript: protocol
  sanitized = sanitized.replace(/javascript:/gi, '');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  return sanitized;
};

/**
 * Validate message content
 * @param {string} message - Message to validate
 * @returns {{valid: boolean, error: string|null}}
 */
export const validateMessage = (message) => {
  if (!message || typeof message !== 'string') {
    return { valid: false, error: 'Message cannot be empty' };
  }
  
  const sanitized = sanitizeInput(message);
  
  if (sanitized.length === 0) {
    return { valid: false, error: 'Message cannot be empty' };
  }
  
  if (sanitized.length > 5000) {
    return { valid: false, error: 'Message is too long (max 5000 characters)' };
  }
  
  // Check for suspicious patterns
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /onerror=/i,
    /onclick=/i,
    /onload=/i
  ];
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(message)) {
      return { valid: false, error: 'Message contains invalid content' };
    }
  }
  
  return { valid: true, error: null };
};

/**
 * Check rate limiting for user
 * @param {string} userId - User ID
 * @param {string} message - Message content
 * @returns {{allowed: boolean, reason: string|null}}
 */
export const checkRateLimit = (userId, message) => {
  if (!userId) {
    return { allowed: false, reason: 'User not authenticated' };
  }
  
  const now = Date.now();
  const userKey = userId;
  
  // Check minimum interval between messages
  const lastTime = lastMessageTime.get(userKey);
  if (lastTime && (now - lastTime) < RATE_LIMIT.MIN_MESSAGE_INTERVAL) {
    return { allowed: false, reason: 'Please wait before sending another message' };
  }
  
  // Initialize or get message history
  if (!messageHistory.has(userKey)) {
    messageHistory.set(userKey, {
      messages: [],
      recentMessages: []
    });
  }
  
  const history = messageHistory.get(userKey);
  
  // Clean old messages (older than 1 hour)
  const oneHourAgo = now - (60 * 60 * 1000);
  history.messages = history.messages.filter(msg => msg.timestamp > oneHourAgo);
  
  // Clean recent messages (older than 1 minute)
  const oneMinuteAgo = now - (60 * 1000);
  history.recentMessages = history.recentMessages.filter(msg => msg.timestamp > oneMinuteAgo);
  
  // Check messages per minute
  if (history.recentMessages.length >= RATE_LIMIT.MAX_MESSAGES_PER_MINUTE) {
    return { allowed: false, reason: 'Too many messages. Please slow down.' };
  }
  
  // Check messages per hour
  if (history.messages.length >= RATE_LIMIT.MAX_MESSAGES_PER_HOUR) {
    return { allowed: false, reason: 'Message limit reached. Please try again later.' };
  }
  
  // Check for spam (same message repeated)
  const recentSameMessages = history.recentMessages.filter(
    msg => msg.content === message
  ).length;
  
  if (recentSameMessages >= RATE_LIMIT.SPAM_THRESHOLD) {
    return { allowed: false, reason: 'Please don\'t spam the same message' };
  }
  
  // Add message to history
  const messageRecord = { content: message, timestamp: now };
  history.messages.push(messageRecord);
  history.recentMessages.push(messageRecord);
  
  // Update last message time
  lastMessageTime.set(userKey, now);
  
  return { allowed: true, reason: null };
};

/**
 * Verify partner relationship
 * @param {string} userId - Current user ID
 * @param {string} partnerId - Partner user ID
 * @param {object} partner - Partner object from auth context
 * @returns {boolean}
 */
export const verifyPartnerRelationship = (userId, partnerId, partner) => {
  if (!userId || !partnerId || !partner) {
    return false;
  }
  
  // Verify partner ID matches
  if (partner.uid !== partnerId) {
    console.error('Partner ID mismatch - possible security breach');
    return false;
  }
  
  return true;
};

/**
 * Validate file upload for security
 * @param {File} file - File to validate
 * @returns {{valid: boolean, error: string|null}}
 */
export const validateFileUpload = (file) => {
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }
  
  // Check file size (max 10MB)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return { valid: false, error: 'File is too large (max 10MB)' };
  }
  
  // Check file type (images only)
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Invalid file type. Only images are allowed.' };
  }
  
  return { valid: true, error: null };
};

/**
 * Clear rate limit history for user (call on logout)
 * @param {string} userId - User ID
 */
export const clearRateLimitHistory = (userId) => {
  messageHistory.delete(userId);
  lastMessageTime.delete(userId);
};

/**
 * Log security event (for monitoring)
 * @param {string} type - Event type
 * @param {object} details - Event details
 */
export const logSecurityEvent = (type, details) => {
  console.warn(`[SECURITY] ${type}:`, details);
  // In production, send to monitoring service
};
