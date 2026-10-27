const pool = require('../config/database');

// Records who did what. Never throws: a logging failure must not break the action itself.
const logActivity = async ({
  actor = null,          // req.user, or null for events like failed sign-ins
  action,                // e.g. 'USER_BLOCKED', 'LOGIN_FAILED'
  targetType = null,     // e.g. 'user'
  targetId = null,
  oldValues = null,
  newValues = null,
  details = null,
  ip = null
}) => {
  try {
    await pool.query(
      `INSERT INTO activity_log
        (actor_id, actor_name, actor_role, action, target_type, target_id,
         old_values, new_values, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        actor ? actor.id : null,
        actor ? `${actor.first_name} ${actor.last_name}` : null,
        actor ? actor.role : null,
        action,
        targetType,
        targetId,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        details,
        ip
      ]
    );
  } catch (error) {
    console.error('Activity log error:', error.message);
  }
};

module.exports = { logActivity };