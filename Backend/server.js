import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

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
    
    // Create expenses table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        category VARCHAR(100) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        description TEXT,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log(' Expenses table ready');
    
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
    await db.execute(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        category VARCHAR(100) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        description TEXT,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    
    await db.execute(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        category VARCHAR(100) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        description TEXT,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

// Login endpoint
app.post('/login', (req, res) => {
  const { password } = req.body;
  console.log(' Login attempt received');
  
  //  password check
  if (password === "admin123") {
    res.json({ 
      success: true,
      message: "Login successful"
    });
  } else {
    res.status(401).json({ 
      success: false, 
      message: "Invalid password" 
    });
  }
});

// Add expense
app.post('/add-expense', async (req, res) => {
  try {
    const { category, amount, description } = req.body;
    console.log(' Adding expense:', { category, amount, description });

    if (!category || !amount) {
      return res.status(400).json({ message: "Category and amount are required" });
    }

    const sql = "INSERT INTO expenses (category, amount, description) VALUES (?, ?, ?)";
    const [result] = await db.execute(sql, [category, parseFloat(amount), description || '']);
    
    res.json({ 
      message: "Expense added successfully!",
      id: result.insertId
    });
  } catch (error) {
    console.error('Add expense error:', error);
    res.status(500).json({ message: "Failed to add expense" });
  }
});

// Get all expenses
app.get('/expenses', async (req, res) => {
  try {
    console.log(' Fetching expenses...');
    const [results] = await db.execute("SELECT * FROM expenses ORDER BY date DESC");
    res.json(results);
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ message: "Failed to fetch expenses" });
  }
});

// Get summary
app.get('/expenses/summary', async (req, res) => {
  try {
    const [summary] = await db.execute(`
      SELECT 
        category,
        COUNT(*) as count,
        SUM(amount) as total_amount
      FROM expenses 
      GROUP BY category
      ORDER BY total_amount DESC
    `);

    const [total] = await db.execute('SELECT SUM(amount) as grand_total FROM expenses');
    
    res.json({
      byCategory: summary,
      grandTotal: total[0].grand_total || 0
    });
  } catch (error) {
    console.error('Summary error:', error);
    res.status(500).json({ message: "Failed to fetch summary" });
  }
});

// Delete expense
app.delete('/expenses/:id', async (req, res) => {
  try {
    const expenseId = req.params.id;
    const [result] = await db.execute('DELETE FROM expenses WHERE id = ?', [expenseId]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Expense not found' });
    }
    
    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ message: 'Failed to delete expense' });
  }
});

// Initialize database and start server
const PORT = process.env.PORT || 5000;

initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`\n BACKEND SERVER STARTED SUCCESSFULLY!`);
    console.log(` Server running on: http://localhost:${PORT}`);
    console.log(` Test URL: http://localhost:${PORT}/test`);
    console.log(`  Health check: http://localhost:${PORT}/health`);
  });
}).catch(error => {
  console.error('Failed to initialize database:', error);
  console.log('\n Starting server without database connection...');
  
  app.listen(PORT, () => {
    console.log(`\n Server running on http://localhost:${PORT} (Limited mode - No database)`);
  });
});

app.get('/expenses', async (req, res) => {
  try {
    console.log(' Fetching expenses...');
    
    if (!db) {
      console.log(' Database connection not available');
      return res.status(503).json({ message: "Database not available" });
    }

    const [results] = await db.execute("SELECT * FROM expenses ORDER BY date DESC");
    console.log(` Found ${results.length} expenses`);
    
    // Log the first few expenses to verify data
    if (results.length > 0) {
      console.log('Sample expenses:', results.slice(0, 3));
    }
    
    res.json(results);
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ message: "Failed to fetch expenses" });
  }
});