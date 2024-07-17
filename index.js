const express = require('express');
const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const sqlite3 = require('sqlite3');
const app = express();
const port = 443;

const serversDir = path.join(__dirname, 'servers');
const serverFiles = fs.readdirSync(serversDir);
const activeServers = [];
const inactiveServers = [];
const dbList = [];

serverFiles.forEach(file => {
    if (path.extname(file) === '.js') {
        const serverName = path.basename(file, '.js');
        if (serverName.startsWith('-')) {
            inactiveServers.push(serverName);
        } else {
            activeServers.push(serverName);
            const db = new sqlite3.Database(path.join(__dirname, `./data/${serverName}.db`));
            global[serverName] = db;
            require(path.join(serversDir, file));
            dbList.push(db);
        }
    }
});

console.log('Servers:', chalk.green(activeServers.join(', '), chalk.red(inactiveServers.join(', '))));

app.use(express.static(path.join(__dirname, 'react')));

app.get('/api/servers', (req, res) => {
    res.json(activeServers);
});

app.get('/api/players', (req, res) => {
    const { nick = '', limit = 10 } = req.query;
    const allPlayers = [];
    let pendingQueries = dbList.length;

    dbList.forEach(db => {
        db.all('SELECT * FROM players WHERE nick LIKE ? LIMIT ?', [`${nick}%`, limit], (err, rows) => {
            if (err) {
                console.error(err.message);
                pendingQueries--;
                if (pendingQueries === 0) {
                    res.json(allPlayers);
                }
                return;
            }
            allPlayers.push(...rows);
            pendingQueries--;
            if (pendingQueries === 0) {
                res.json(allPlayers);
            }
        });
    });
});

app.get('/api/player/:nick', async (req, res) => {
    const { nick } = req.params;
    const playerData = [];

    for (let i = 0; i < dbList.length; i++) {
        try {
            const db = dbList[i];
            const players = await new Promise((resolve, reject) => {
                db.all(`SELECT * FROM players WHERE nick = ?`, [nick], (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                });
            });
            if (players.length > 0) {
                playerData.push(...players);
            }
        } catch (err) {
            console.error(err.message);
        }
    }

    res.json(playerData);
});

app.get('/api/player/:nick/messages', (req, res) => {
    const { nick } = req.params;
    const messages = [];

    dbList.forEach(db => {
        db.all(`SELECT * FROM messages WHERE nick = ?`, [nick], (err, rows) => {
            messages.push(...rows);
        });
    });

    res.json(messages);
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});