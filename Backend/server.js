import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import db from './db.js';

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Simple password for access (you can make this more advanced)
const PASSWORD = "admin123";

// Login endpoint
app.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === PASSWORD) {
    res.json({ success: true });
  } else {
    res.json({ success: false, message: "Invalid password" });
  }
});

// Add expense
app.post('/add-expense', (req, res) => {
  const { category, amount, description } = req.body;

  if (!category || !amount) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const sql = "INSERT INTO expenses (category, amount, description) VALUES (?, ?, ?)";
  db.query(sql, [category, amount, description], (err, result) => {
    if (err) throw err;
    res.json({ message: "Expense added successfully!" });
  });
});

// Get all expenses
app.get('/expenses', (req, res) => {
  db.query("SELECT * FROM expenses ORDER BY date DESC", (err, results) => {
    if (err) throw err;
    res.json(results);
  });
});

app.listen(5000, () => console.log('Server running on http://localhost:5000'));
