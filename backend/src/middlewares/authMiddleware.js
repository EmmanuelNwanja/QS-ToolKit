const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');
const { error } = require('../utils/responseHelper');

exports.protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json(error('No token provided'));
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { data: user } = await supabase
      .from('users')
      .select('id, email, user_type, plan_id, subscription_status, org_role, organization_id')
      .eq('id', decoded.id)
      .single();

    if (!user) return res.status(401).json(error('User not found'));

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json(error('Invalid or expired token'));
  }
};

exports.requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.org_role)) {
    return res.status(403).json(error('Insufficient permissions'));
  }
  next();
};
