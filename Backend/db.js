import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:', missingEnvVars);
  console.log('Using default configuration...');
}

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'Pf@34906304',
  database: process.env.DB_NAME || 'expense_tracker',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  reconnect: true,
  timezone: '+00:00'
};

console.log('Database configuration:', {
  host: dbConfig.host,
  user: dbConfig.user,
  database: dbConfig.database,
  hasPassword: !!dbConfig.password
});

const pool = mysql.createPool(dbConfig);

// Test connection with better error handling
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log(' Connected to MySQL database successfully!');
    connection.release();
    
    // Initialize database tables
    await initializeDatabase();
  } catch (error) {
    console.error(' Database connection failed:');
    console.error('Error details:', error.message);
    console.error('Please check:');
    console.error('1. Is MySQL running?');
    console.error('2. Are the database credentials correct?');
    console.error('3. Does the database exist?');
    
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n Access denied. Please verify:');
      console.error('- Username: ', dbConfig.user);
      console.error('- Password: ', dbConfig.password ? '***' : 'NOT SET');
    }
    
    if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('\n Database does not exist. Creating it...');
      await createDatabase();
    }
  }
}

async function createDatabase() {
  try {
    // Create a connection without specifying the database
    const tempConfig = { ...dbConfig };
    delete tempConfig.database;
    
    const tempPool = mysql.createPool(tempConfig);
    const connection = await tempPool.getConnection();
    
    await connection.execute(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`);
    console.log(` Database '${dbConfig.database}' created successfully`);
    
    connection.release();
    await tempPool.end();
    
    // Retest connection with database
    await testConnection();
  } catch (error) {
    console.error(' Failed to create database:', error.message);
  }
}

async function initializeDatabase() {
  try {
    // Create users table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);

    // Create expenses table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        category VARCHAR(100) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        description TEXT,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    // Create default admin user if not exists
    const [users] = await pool.execute('SELECT * FROM users WHERE username = ?', ['admin']);
    if (users.length === 0) {
      const bcrypt = await import('bcryptjs');
      const hashedPassword = await bcrypt.default.hash('admin123', 12);
      await pool.execute(
        'INSERT INTO users (username, password_hash) VALUES (?, ?)',
        ['admin', hashedPassword]
      );
      console.log(' Default admin user created (username: admin, password: admin123)');
    }

    console.log(' Database tables initialized successfully');
  } catch (error) {
    console.error(' Database initialization failed:', error.message);
  }
}



export default pool;