exports.success = (message, data = {}) => ({ success: true, message, ...data });
exports.error   = (message, data = {}) => ({ success: false, message, ...data });
