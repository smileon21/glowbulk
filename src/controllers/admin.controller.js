const pool = require('../config/database');

// Get admin dashboard stats
const getDashboardStats = async (req, res) => {
  try {
    // Get total users count
    const totalUsersResult = await pool.query('SELECT COUNT(*) FROM users');
    const totalUsers = parseInt(totalUsersResult.rows[0].count);

    // Get admins count
    const adminsResult = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'admin'");
    const admins = parseInt(adminsResult.rows[0].count);

    // Get marketing users count
    const marketingResult = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'marketing'");
    const marketing = parseInt(marketingResult.rows[0].count);

    // Get customers count
    const customersResult = await pool.query('SELECT COUNT(*) FROM customers');
    const customers = parseInt(customersResult.rows[0].count);

    res.json({
      success: true,
      data: {
        totalUsers,
        admins,
        marketing,
        customers
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard stats',
      error: error.message
    });
  }
};

// Get all system users
const getSystemUsers = async (req, res) => {
  try {
    const query = `
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.role,
        u.created_at as joined_date,
        u.is_active as status,
        CASE 
          WHEN u.role = 'customer' THEN c.company_name
          ELSE NULL
        END as company_name
      FROM users u
      LEFT JOIN customers c ON u.id = c.user_id
      ORDER BY u.created_at DESC
    `;
    
    const result = await pool.query(query);
    
    // Format the data for frontend
    const formattedUsers = result.rows.map(user => ({
      ...user,
      name: `${user.first_name} ${user.last_name}`,
      status: user.status ? 'active' : 'inactive'
    }));
    
    res.json({
      success: true,
      data: formattedUsers
    });
  } catch (error) {
    console.error('Error fetching system users:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching system users',
      error: error.message
    });
  }
};

// Get admin profile
const getAdminProfile = async (req, res) => {
  try {
    const query = `
      SELECT 
        id,
        first_name,
        last_name,
        email,
        role,
        created_at as joined_date,
        is_active as status
      FROM users 
      WHERE id = $1 AND role = 'admin'
    `;
    
    const result = await pool.query(query, [req.user.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Admin profile not found'
      });
    }
    
    const user = result.rows[0];
    // Format the response
    const formattedUser = {
      id: user.id,
      name: `${user.first_name} ${user.last_name}`,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      role: user.role,
      joined_date: user.joined_date,
      status: user.status ? 'active' : 'inactive'
    };
    
    res.json({
      success: true,
      data: formattedUser
    });
  } catch (error) {
    console.error('Error fetching admin profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching admin profile',
      error: error.message
    });
  }
};

// Update admin profile
const updateAdminProfile = async (req, res) => {
  try {
    const { name, email, first_name, last_name } = req.body;
    
    // If name is provided but not first_name/last_name, split it
    let firstName = first_name;
    let lastName = last_name;
    
    if (name && !first_name && !last_name) {
      const nameParts = name.split(' ');
      firstName = nameParts[0] || '';
      lastName = nameParts.slice(1).join(' ') || '';
    }
    
    const query = `
      UPDATE users 
      SET 
        first_name = $1,
        last_name = $2,
        email = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4 AND role = 'admin'
      RETURNING id, first_name, last_name, email, role, created_at as joined_date, is_active as status
    `;
    
    const result = await pool.query(query, [firstName, lastName, email, req.user.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Admin profile not found'
      });
    }
    
    const user = result.rows[0];
    const formattedUser = {
      id: user.id,
      name: `${user.first_name} ${user.last_name}`,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      role: user.role,
      joined_date: user.joined_date,
      status: user.status ? 'active' : 'inactive'
    };
    
    res.json({
      success: true,
      message: 'Admin profile updated successfully',
      data: formattedUser
    });
  } catch (error) {
    console.error('Error updating admin profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating admin profile',
      error: error.message
    });
  }
};

// Update user status (activate/deactivate)
const updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;
    
    // Convert status string to boolean
    const isActive = status === 'active';
    
    // Prevent admin from deactivating themselves
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot change your own status'
      });
    }
    
    const query = `
      UPDATE users 
      SET 
        is_active = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, first_name, last_name, email, role, is_active as status
    `;
    
    const result = await pool.query(query, [isActive, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const user = result.rows[0];
    res.json({
      success: true,
      message: `User ${status === 'active' ? 'activated' : 'deactivated'} successfully`,
      data: {
        ...user,
        name: `${user.first_name} ${user.last_name}`,
        status: user.status ? 'active' : 'inactive'
      }
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating user status',
      error: error.message
    });
  }
};

// Delete user
const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Prevent admin from deleting themselves
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account'
      });
    }
    
    const query = 'DELETE FROM users WHERE id = $1 RETURNING id, first_name, last_name, email';
    const result = await pool.query(query, [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const user = result.rows[0];
    res.json({
      success: true,
      message: `User ${user.first_name} ${user.last_name} deleted successfully`,
      data: user
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting user',
      error: error.message
    });
  }
};

module.exports = {
  getDashboardStats,
  getSystemUsers,
  getAdminProfile,
  updateAdminProfile,
  updateUserStatus,
  deleteUser
};