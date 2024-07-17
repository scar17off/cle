const mineflayer = require('mineflayer');
const path = require('path');

const servers = {
    "s1": "Йота-1",
    "s2": "Эпсилон-2",
    "s3": "Неон-3",
    "s4": "Эмеральд-4",
    "s5": "Альфа-5",
    "s6": "Омега-6",
    "s7": "Сигма-7",
    "s8": "Зета-8"
}

const ranks = [
    "Игрок",
    "Вип",
    "Премиум",
    "Креатив",
    "Гл.Админ",
    "Лорд",
    "Элита",
    "Модер",
    "Легенда",
    "Король",
    "Оператор",
    "Спонсор",
    "Владелец",
    "АнтиГрифер",
    "Властелин"
]

const db = MasedWorld;

const tables = [
    `CREATE TABLE IF NOT EXISTS players(
        nick TEXT,
        server TEXT,
        rank TEXT DEFAULT "Игрок",
        clan TEXT DEFAULT NULL,
        last_login DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (nick, server)
    )`,
    `CREATE TABLE IF NOT EXISTS messages(
        server TEXT,
        nick TEXT,
        raw TEXT,
        content TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS bans(
        server TEXT,
        nick TEXT,
        reason TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS kicks(
        server TEXT,
        nick TEXT,
        reason TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS mutes(
        server TEXT,
        nick TEXT,
        reason TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
];

for (const query of tables) {
    db.run(query, (err) => {
        if (err) console.error(err.message);
    });
}

function createBot(nick, server) {
    const bot = mineflayer.createBot({
        host: 'mc.masedworld.net',
        port: 25565,
        username: nick,
        version: "1.20.6"
    });

    bot.on('login', () => {
        bot.chat("/login " + process.env.password);
    });

    let spawnTime = 0;

    bot.on('spawn', () => {
        spawnTime++;
        if (spawnTime === 1) {
            bot.chat(`/${server}`);
        }
        if(server.startsWith("s")) server = servers[server];
    });

    bot.on('messagestr', (msg) => {
        const rawMsg = msg;
        if(checkMessage(bot, msg)) return;

        console.log(`<${msg}>`);
        const args = msg.split(' ');
        
        if(args[0].includes("ɢ") || args[0].includes("ʟ")) { // Global or local chat
            args.shift();

            const a = args[0];
            const b = args[1];
            const c = args[2];

            let nick = null;
            let rank = null;
            let clan = null;

            if(ranks.includes(a) && !ranks.includes(b)) { // [rank] [nick]
                rank = a;
                nick = b;
            } else if(ranks.includes(a) && ranks.includes(b)) { // [clan] [rank] [nick]
                clan = a;
                rank = b;
                nick = c;
            } else if(!ranks.includes(a) && !ranks.includes(b)) { // [clan] [nick]
                clan = a;
                nick = b;
            } else if(!ranks.includes(a) && ranks.includes(b)) { // [clan] [rank] [nick]
                clan = a;
                rank = b;
                nick = c;
            }

            db.get(`SELECT * FROM players WHERE nick = ? AND server = ?`, [nick, server], (err, row) => {
                if (err) {
                    console.error(err.message);
                    return;
                }
                if (!row) {
                    db.run(`INSERT INTO players (nick, server, rank, clan) VALUES (?, ?, ?, ?)`, [nick, server, rank, clan], (err) => {
                        if (err) {
                            console.error(err.message);
                        }
                    });
                } else {
                    db.run(`UPDATE players SET rank = ?, clan = ? WHERE nick = ? AND server = ?`, [rank, clan, nick, server], (err) => {
                        if (err) {
                            console.error(err.message);
                        }
                    });
                }
            });

            const arrowIndex = msg.indexOf('⇨');
            if (arrowIndex !== -1) {
                message = msg.slice(arrowIndex + 1).trim();
            } else {
                message = '';
            }
            
            db.run(`INSERT INTO messages (server, nick, raw, content, timestamp) VALUES (?, ?, ?, ?, ?)`, [server, nick, rawMsg, message, new Date().toISOString()], (err) => {
                if (err) {
                    console.error(err.message);
                }
            });
        }
    });

    bot.on("playerJoined", (player) => {
        if(player.username.startsWith("DataMine") || player.username.startsWith("[NPC]")) return;
        const now = new Date().toISOString();
        db.get(`SELECT * FROM players WHERE nick = ? AND server = ?`, [player.username, server], (err, row) => {
            if (err) {
                console.error(err.message);
                return;
            }
            if (!row) {
                db.run(`INSERT INTO players (nick, server, rank, last_login) VALUES (?, ?, ?, ?)`, [player.username, server, "Игрок", now], (err) => {
                    if (err) {
                        console.error(err.message);
                    }
                });
            }
            db.run(`UPDATE players SET last_login = ? WHERE nick = ? AND server = ?`, [now, player.username, server], (err) => {
                if (err) {
                    console.error(err.message);
                }
            });
        });
    });

    bot.on("playerLeft", (player) => {
        if(player.username.startsWith("DataMine") || player.username.startsWith("[NPC]")) return;
        const now = new Date().toISOString();
        db.run(`UPDATE players SET last_seen = ? WHERE nick = ? AND server = ?`, [now, player.username, server], (err) => {
            if (err) {
                console.error(err.message);
            }
        });
    });
}

function checkMessage(bot, msg) {
    msg = msg.trim();
    if(msg == '') return true;

    if(msg.startsWith('› Зарегистрируйтесь') || msg.startsWith("› Для начала необходимо зарегистрироваться")) {
        bot.chat("/register " + process.env.password + " " + process.env.password);
        return true;
    }

    if (msg.startsWith('› ') || msg.startsWith("♦") || msg.startsWith("[+]") || msg.startsWith("▪") || msg.startsWith("Ответь на вопрос:") || msg.startsWith("Правильный ответ:") || msg.startsWith("Победил игрок:") || msg.startsWith("Вы перемещены в лобби") || msg.startsWith("Решите") || msg.startsWith("Награда")) return true;
    if(msg == "Для чего это нужно" ||
        msg == "Добро пожаловать на проект MasedWorld" ||
        msg == `Важно для вашей безопасности!!! 
Привяжите аккаунт к соц. сети командой:

▪ ВКонтакте - /2fa addvk
▪ Телеграм - /2fa addtg

Для чего это нужно (Наведи мышкой)` ||
        msg == `
 ♦ У нас есть режим анархия, там можно рейдить,
 ♦ проходить квесты и лутать крутые предметы.
 ♦ Команда для входа - /anarchy
` ||
        msg == `
 ♦ Хочешь получить любой арт из интернета прямо в игре?
 ♦ Привилегии Владелец за 8250 479 руб.
 ♦ Доступна такая команда: /pic [ссылка]
` ||
        msg == "Для чего это нужно (Наведи мышкой)" ||
        msg == "Наш сайт: masedworld.net (Выгодная покупка)" ||
        msg == "Там можно преобрести кейсы, привилегии." ||
        msg == "Там мы публикуем новости, записи игроков и т.д." ||
        msg == "Наша группа Вконтакте: vk.com/mased_world" ||
        msg == "› Вы уже авторизовались" ||
        msg == "-----------------------------------------" ||
        msg == "** Покупка кейса производится на сайте » www.masedworld.net" ||
        msg == "." ||
        msg == "ЧАТ-ИГРА" ||
        msg == "Вы уже на сервере!" ||
        msg == "Не удается подключиться на сервер, повторите попытку чуть позже." ||
        msg == "АвтоШахта » Шахта обновлена, телепортироваться - /warp mine"
    ) return true;

    return false;
}

(async () => {
    for (let i = 1; i <= 4; i++) {
        createBot(`DataMine${i}`, `s${i}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
})();

module.exports = db;