import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

// Load environment variables
dotenv.config();

const app = express();

// Middleware - Fix CORS for Live Server
app.use(cors({
  origin: ['http://127.0.0.1:5500', 'http://localhost:5500', 'http://localhost:5000'],
  methods: ['GET', 'POST', 'DELETE'],
  credentials: true
}));

app.use(express.json());

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'Pf@34906304',
  database: process.env.DB_NAME || 'expense_tracker',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

console.log('Database config:', {
  host: dbConfig.host,
  user: dbConfig.user,
  database: dbConfig.database
});

let db;

// Initialize database connection
async function initializeDatabase() {
  try {
    db = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to MySQL database!');
    
    // Create or update tables
    await createOrUpdateTables();
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    
    if (error.code === 'ER_BAD_DB_ERROR') {
      console.log('📁 Database does not exist. Creating it...');
      await createDatabase();
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('🔐 Access denied. Please check your MySQL credentials.');
    }
  }
}

async function createDatabase() {
  let tempDb;
  try {
    // Connect without database
    tempDb = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password
    });
    
    await tempDb.execute(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`);
    console.log(`✅ Database '${dbConfig.database}' created`);
    
    await tempDb.end();
    
    // Reconnect with database
    db = await mysql.createConnection(dbConfig);
    
    // Create tables
    await createOrUpdateTables();
    
  } catch (error) {
    console.error('❌ Failed to create database:', error.message);
    if (tempDb) await tempDb.end();
  }
}

async function createOrUpdateTables() {
  try {
    // Create users table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Users table checked/created');

    // Check if expenses table exists and has user_id column
    const [tables] = await db.execute("SHOW TABLES LIKE 'expenses'");
    
    if (tables.length > 0) {
      // Table exists, check if user_id column exists
      const [columns] = await db.execute("SHOW COLUMNS FROM expenses LIKE 'user_id'");
      
      if (columns.length === 0) {
        console.log('🔄 Adding user_id column to expenses table...');
        
        // Drop the old expenses table and recreate it
        await db.execute('DROP TABLE expenses');
        console.log('✅ Old expenses table dropped');
        
        // Create new expenses table with user_id
        await db.execute(`
          CREATE TABLE expenses (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            category VARCHAR(100) NOT NULL,
            amount DECIMAL(10,2) NOT NULL,
            description TEXT,
            date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        console.log('✅ New expenses table created with user_id');
      } else {
        console.log('✅ Expenses table already has user_id column');
      }
    } else {
      // Create expenses table for the first time
      await db.execute(`
        CREATE TABLE expenses (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          category VARCHAR(100) NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          description TEXT,
          date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Expenses table created');
    }

    console.log('✅ All tables are ready!');
    
  } catch (error) {
    console.error('❌ Table creation error:', error);
    
    // If there's an error, try to create the tables from scratch
    try {
      console.log('🔄 Attempting to recreate tables...');
      
      // Drop and recreate tables
      await db.execute('DROP TABLE IF EXISTS expenses');
      await db.execute('DROP TABLE IF EXISTS users');
      
      // Create users table
      await db.execute(`
        CREATE TABLE users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          email VARCHAR(100) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Create expenses table
      await db.execute(`
        CREATE TABLE expenses (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          category VARCHAR(100) NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          description TEXT,
          date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      console.log('✅ Tables recreated successfully!');
      
    } catch (recreateError) {
      console.error('❌ Failed to recreate tables:', recreateError);
    }
  }
}

// Test endpoint
app.get('/test', (req, res) => {
  res.json({ 
    message: '✅ Backend server is working!', 
    timestamp: new Date().toISOString(),
    database: db ? 'Connected' : 'Disconnected'
  });
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    if (db) {
      await db.execute('SELECT 1');
      res.json({ 
        status: 'healthy', 
        database: 'connected',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({ 
        status: 'unhealthy', 
        database: 'disconnected',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(503).json({ 
      status: 'unhealthy', 
      database: 'error',
      error: error.message
    });
  }
});

// Check database schema endpoint (for debugging)
app.get('/debug/schema', async (req, res) => {
  try {
    const [tables] = await db.execute('SHOW TABLES');
    const schemaInfo = {};
    
    for (const table of tables) {
      const tableName = table[`Tables_in_${dbConfig.database}`];
      const [columns] = await db.execute(`DESCRIBE ${tableName}`);
      schemaInfo[tableName] = columns;
    }
    
    res.json(schemaInfo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// User Registration endpoint
app.post('/register', async (req, res) => {
  let connection;
  try {
    const { username, email, password } = req.body;
    console.log('📝 Registration attempt:', { username, email });
    
    if (!username || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: "Username, email and password are required" 
      });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: "Password must be at least 6 characters long" 
      });
    }
    
    connection = await mysql.createConnection(dbConfig);
    
    // Check if user already exists
    const [existingUsers] = await connection.execute(
      'SELECT * FROM users WHERE username = ? OR email = ?', 
      [username, email]
    );
    
    if (existingUsers.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Username or email already exists" 
      });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Insert new user
    const [result] = await connection.execute(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [username, email, hashedPassword]
    );
    
    console.log('✅ New user registered:', username);
    
    res.json({ 
      success: true,
      message: "Registration successful! You can now login.",
      userId: result.insertId
    });
    
  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({ 
      success: false, 
      message: "Registration failed. Please try again." 
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Login endpoint
app.post('/login', async (req, res) => {
  let connection;
  try {
    const { username, password } = req.body;
    console.log('🔐 Login attempt for user:', username);
    
    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        message: "Username and password are required" 
      });
    }
    
    connection = await mysql.createConnection(dbConfig);
    
    // Find user
    const [users] = await connection.execute(
      'SELECT * FROM users WHERE username = ?', 
      [username]
    );
    
    if (users.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: "Invalid username or password" 
      });
    }
    
    const user = users[0];
    
    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false, 
        message: "Invalid username or password" 
      });
    }
    
    console.log('✅ User logged in:', username);
    
    res.json({ 
      success: true,
      message: "Login successful!",
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
    
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: "Login failed. Please try again." 
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Add expense (user-specific)
app.post('/add-expense', async (req, res) => {
  let connection;
  try {
    const { userId, category, amount, description } = req.body;
    console.log('💰 Adding expense for user:', userId, { category, amount, description });

    if (!userId || !category || !amount) {
      return res.status(400).json({ 
        success: false,
        message: "User ID, category and amount are required" 
      });
    }

    connection = await mysql.createConnection(dbConfig);
    
    const sql = "INSERT INTO expenses (user_id, category, amount, description) VALUES (?, ?, ?, ?)";
    const [result] = await connection.execute(sql, [userId, category, parseFloat(amount), description || '']);
    
    console.log('✅ Expense added successfully, ID:', result.insertId);
    
    res.json({ 
      success: true,
      message: "Expense added successfully!",
      id: result.insertId
    });
  } catch (error) {
    console.error('❌ Add expense error:', error);
    res.status(500).json({ 
      success: false,
      message: "Failed to add expense: " + error.message 
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Get user's expenses
app.get('/expenses/:userId', async (req, res) => {
  let connection;
  try {
    const userId = req.params.userId;
    console.log('📊 Fetching expenses for user:', userId);
    
    connection = await mysql.createConnection(dbConfig);
    
    const [results] = await connection.execute(
      "SELECT * FROM expenses WHERE user_id = ? ORDER BY date DESC", 
      [userId]
    );
    
    console.log(`✅ Found ${results.length} expenses for user ${userId}`);
    
    res.json(results);
  } catch (error) {
    console.error('❌ Get expenses error:', error);
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch expenses: " + error.message 
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Get user's expense summary
app.get('/expenses/summary/:userId', async (req, res) => {
  let connection;
  try {
    const userId = req.params.userId;
    
    connection = await mysql.createConnection(dbConfig);
    
    const [summary] = await connection.execute(`
      SELECT 
        category,
        COUNT(*) as count,
        SUM(amount) as total_amount
      FROM expenses 
      WHERE user_id = ?
      GROUP BY category
      ORDER BY total_amount DESC
    `, [userId]);

    const [total] = await connection.execute(
      'SELECT SUM(amount) as grand_total FROM expenses WHERE user_id = ?', 
      [userId]
    );
    
    console.log(`✅ Summary loaded for user ${userId}`);
    
    res.json({
      success: true,
      byCategory: summary,
      grandTotal: total[0].grand_total || 0
    });
  } catch (error) {
    console.error('❌ Summary error:', error);
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch summary: " + error.message 
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Delete user's expense
app.delete('/expenses/:userId/:id', async (req, res) => {
  let connection;
  try {
    const { userId, id } = req.params;
    
    connection = await mysql.createConnection(dbConfig);
    
    const [result] = await connection.execute(
      'DELETE FROM expenses WHERE id = ? AND user_id = ?', 
      [id, userId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Expense not found' 
      });
    }
    
    console.log(`✅ Expense ${id} deleted for user ${userId}`);
    
    res.json({ 
      success: true,
      message: 'Expense deleted successfully' 
    });
  } catch (error) {
    console.error('❌ Delete expense error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to delete expense: ' + error.message 
    });
  } finally {
    if (connection) await connection.end();
  }
});

// Initialize database and start server
const PORT = process.env.PORT || 5000;

initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 BACKEND SERVER STARTED SUCCESSFULLY!`);
    console.log(`📍 Server running on: http://localhost:${PORT}`);
    console.log(`🧪 Test URL: http://localhost:${PORT}/test`);
    console.log(`🔧 Debug schema: http://localhost:${PORT}/debug/schema`);
    console.log(`❤️  Health check: http://localhost:${PORT}/health`);
  });
}).catch(error => {
  console.error('❌ Failed to initialize database:', error);
});