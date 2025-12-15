const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

class AuthUtils {
  static async hashPassword(password) {
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    return bcrypt.hash(password, saltRounds);
  }

  static async comparePassword(password, hashedPassword) {
    return bcrypt.compare(password, hashedPassword);
  }

  static generateToken(payload) {
    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    });
  }

  static generateRefreshToken(payload) {
    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
    });
  }

  static verifyToken(token) {
    return jwt.verify(token, process.env.JWT_SECRET);
  }

  static generateRequestId(prefix = 'REQ') {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}-${timestamp}-${random}`.toUpperCase();
  }
}

module.exports = AuthUtils;