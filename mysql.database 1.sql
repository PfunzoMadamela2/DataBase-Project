CREATE DATABASE expense_tracker;
use expense_tracker;

create table expenses (
id INT auto_increment primary key,
date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
category varchar(50),
amount decimal(10.2),
description varchar(255)
);