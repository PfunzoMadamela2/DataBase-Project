import mysql from 'mysql2';

const db = mysql.createConnection({
    host: 'localhost',
    user: 'Pfunzo',
    password: 'Pf@34906304',
    database: 'expense_tracker '
});

db.connect((err) => {
    if (err) {
        console.error('Database connection failed: ', err);
    } else {
        console.log('Connected to the database.');
    }
});
export default db;