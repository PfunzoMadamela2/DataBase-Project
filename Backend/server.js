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
  database: process.env.DB_NAME || 'expense_tracker'
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
    console.log(' Connected to MySQL database!');
    
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
    
    // Create expenses table with user_id foreign key
    await db.execute(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        category VARCHAR(100) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        description TEXT,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    
    console.log(' Database tables initialized successfully');
    
  } catch (error) {
    console.error(' Database connection failed:', error.message);
    
    if (error.code === 'ER_BAD_DB_ERROR') {
      console.log(' Database does not exist. Creating it...');
      await createDatabase();
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log(' Access denied. Please check your MySQL credentials.');
      console.log('Trying with simplified connection...');
      await trySimpleConnection();
    }
  }
}

async function createDatabase() {
  try {
    // Connect without database
    const tempDb = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password
    });
    
    await tempDb.execute(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`);
    console.log(` Database '${dbConfig.database}' created`);
    
    await tempDb.end();
    
    // Reconnect with database
    db = await mysql.createConnection(dbConfig);
    
    // Create tables
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await db.execute(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        category VARCHAR(100) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        description TEXT,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    
    console.log(' Tables created successfully');
    
  } catch (error) {
    console.error(' Failed to create database:', error.message);
  }
}

async function trySimpleConnection() {
  try {
    // Try with very basic connection
    const simpleConfig = {
      host: 'localhost',
      user: 'root',
      password: 'Pf@34906304'
    };
    
    const tempDb = await mysql.createConnection(simpleConfig);
    console.log(' Basic MySQL connection successful!');
    
    // Check if database exists
    const [databases] = await tempDb.execute('SHOW DATABASES');
    const dbExists = databases.some(db => db.Database === 'expense_tracker');
    
    if (!dbExists) {
      await tempDb.execute('CREATE DATABASE expense_tracker');
      console.log(' Created expense_tracker database');
    }
    
    await tempDb.end();
    
    // Now connect with database
    db = await mysql.createConnection({
      ...simpleConfig,
      database: 'expense_tracker'
    });
    
    // Create tables
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await db.execute(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        category VARCHAR(100) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        description TEXT,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    
    console.log(' Full database setup complete!');
    
  } catch (error) {
    console.error(' Simple connection also failed:', error.message);
    console.log('\n Please check:');
    console.log('1. Is MySQL running?');
    console.log('2. Is the password correct?');
    console.log('3. Try: sudo mysql -u root -p');
  }
}

// Test endpoint
app.get('/test', (req, res) => {
  res.json({ 
    message: ' Backend server is working!', 
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

// User Registration endpoint
app.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    console.log(' Registration attempt:', { username, email });
    
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
    
    // Check if user already exists
    const [existingUsers] = await db.execute(
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
    const [result] = await db.execute(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [username, email, hashedPassword]
    );
    
    res.json({ 
      success: true,
      message: "Registration successful! You can now login.",
      userId: result.insertId
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false, 
      message: "Registration failed. Please try again." 
    });
  }
});

// Login endpoint
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log(' Login attempt for user:', username);
    
    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        message: "Username and password are required" 
      });
    }
    
    // Find user
    const [users] = await db.execute(
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
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: "Login failed. Please try again." 
    });
  }
});

// Add expense (user-specific)
app.post('/add-expense', async (req, res) => {
  try {
    const { userId, category, amount, description } = req.body;
    console.log(' Adding expense for user:', userId, { category, amount, description });

    if (!userId || !category || !amount) {
      return res.status(400).json({ 
        success: false,
        message: "User ID, category and amount are required" 
      });
    }

    const sql = "INSERT INTO expenses (user_id, category, amount, description) VALUES (?, ?, ?, ?)";
    const [result] = await db.execute(sql, [userId, category, parseFloat(amount), description || '']);
    
    res.json({ 
      success: true,
      message: "Expense added successfully!",
      id: result.insertId
    });
  } catch (error) {
    console.error('Add expense error:', error);
    res.status(500).json({ 
      success: false,
      message: "Failed to add expense" 
    });
  }
});

// Get user's expenses
app.get('/expenses/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    console.log(' Fetching expenses for user:', userId);
    
    const [results] = await db.execute(
      "SELECT * FROM expenses WHERE user_id = ? ORDER BY date DESC", 
      [userId]
    );
    
    res.json(results);
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ message: "Failed to fetch expenses" });
  }
});

// Get user's expense summary
app.get('/expenses/summary/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    const [summary] = await db.execute(`
      SELECT 
        category,
        COUNT(*) as count,
        SUM(amount) as total_amount
      FROM expenses 
      WHERE user_id = ?
      GROUP BY category
      ORDER BY total_amount DESC
    `, [userId]);

    const [total] = await db.execute(
      'SELECT SUM(amount) as grand_total FROM expenses WHERE user_id = ?', 
      [userId]
    );
    
    res.json({
      byCategory: summary,
      grandTotal: total[0].grand_total || 0
    });
  } catch (error) {
    console.error('Summary error:', error);
    res.status(500).json({ message: "Failed to fetch summary" });
  }
});

// Delete user's expense
app.delete('/expenses/:userId/:id', async (req, res) => {
  try {
    const { userId, id } = req.params;
    const [result] = await db.execute(
      'DELETE FROM expenses WHERE id = ? AND user_id = ?', 
      [id, userId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Expense not found' 
      });
    }
    
    res.json({ 
      success: true,
      message: 'Expense deleted successfully' 
    });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to delete expense' 
    });
  }
});

// Initialize database and start server
const PORT = process.env.PORT || 5000;

initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`\n BACKEND SERVER STARTED SUCCESSFULLY!`);
    console.log(` Server running on: http://localhost:${PORT}`);
    console.log(` Test URL: http://localhost:${PORT}/test`);
    console.log(` Health check: http://localhost:${PORT}/health`);
  });
}).catch(error => {
  console.error('Failed to initialize database:', error);
  console.log('\n Starting server without database connection...');
  
  app.listen(PORT, () => {
    console.log(`\n Server running on http://localhost:${PORT} (Limited mode - No database)`);
  });
});