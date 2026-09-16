const environment = process.env.STAGING === 'true' ? 'staging' : 'production';
const isStaging = environment === 'staging';

module.exports = { environment, isStaging };
