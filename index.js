import express from 'express';
import mysql from 'mysql2/promise';
import env from 'dotenv';
import fs from 'fs';
import session from 'express-session'
import MySQLStore from 'express-mysql-session';
import { auth } from 'express-openid-connect'
import https from 'https';
import { CreateUser, jsonToString, stringToJson } from './sql.js';

env.config();






const app = express();
app.set('view engine', 'ejs');
const SQLStoreSession = MySQLStore(session);

const mysql_options = {
    host: process.env.DB_HOST,
    port: 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
};
const auth0_config = {
    authRequired: false,
    auth0Logout: true,
    secret: process.env.AUTH0_SECRET,
    baseURL: 'https://localhost:3000',
    clientID: 'loutfK3tWOJmSlBocKII0vYwSibMit94',
    issuerBaseURL: 'https://dev-6m7mvx13.au.auth0.com'
};
const connection = mysql.createPool({
    ...mysql_options,
    waitForConnections: true,
    connectionLimit: 10,
    maxIdle: 10,
    queueLimit: 0
});
const sessionStore = new SQLStoreSession(mysql_options);



app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: true,
    store: sessionStore,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000 * 7, //seven days
        secure: false
    },
    saveUninitialized: true
}));
app.use(express.json());
app.use(auth(auth0_config));
app.get("/", async (req, res) => {
    if (req.oidc.isAuthenticated()) {
        let user = await connection.query("SELECT * FROM users WHERE id = ?", [req.oidc.user.email]);
        if (user[0].length == 0) {
            await CreateUser(connection, req.oidc.user.email);
            user = await connection.query("SELECT * FROM users WHERE id = ?", [req.oidc.user.email]);
        }
        res.render('dash', { families: stringToJson(user[0][0].families) });
    }
    else {
        res.redirect("/login");
    }
});
const daysInMonth = (year, month) => new Date(year, month, 0).getDate();
app.post("/family/create", async (req, res) => {
    console.log(req.body)
})
app.get("/family/:id/:month/:year", async (req, res) => {
    console.log(req.params);
    if (req.oidc.isAuthenticated()) {
        let user = await connection.query("SELECT * FROM users WHERE id = ?", [req.oidc.user.email]);
        if (user[0].length == 0) {
            req.redirect("/");
        }
        let families = stringToJson(user[0][0].families);
        let family_check = families.find((family) => {
            return family.id == req.params.id;
        });
        if (family_check == undefined) {
            return res.redirect("/");
        }
        let family = await connection.query("SELECT * FROM families WHERE id = ?", [req.params.id]);
        if (family[0].length == 0) {
            return res.redirect("/");
        }
        let month = req.params.month;
        let family_id = req.params.id;
        let year = req.params.year;
        let days = []
        let days_in_month = daysInMonth(req.params.year, req.params.month);
        let event_days = []
        for (let i = 1; i <= days_in_month; i++) {
            let events = await connection.query("SELECT * FROM events WHERE family_id = ? AND day = ? AND month = ? AND year = ?", [family_id, i, month, year]);
            if (events[0].length > 0) {
                event_days.push(i);
            }
            days.push({ day: i, events: events[0], month: month, year: year });
        }
        let next_month, next_year
        if (month == 12) {
            next_month = "1";
            next_year = (parseInt(year) + 1).toString();
        }
        else {
            next_month = (parseInt(month) + 1).toString();
            next_year = year;
        }
        for (let i = 1; i <=35-days_in_month; i++) {
            let events = await connection.query("SELECT * FROM events WHERE family_id = ? AND day = ? AND month = ? AND year = ?", [family_id, i, next_month, next_year]);
            if (events[0].length > 0) {
                event_days.push(i+days_in_month);
            }
            days.push({ day: i, events: events[0], month: next_month, year: next_year });
        }
        for (const event_day of event_days) {
            let day = days[event_day-1];
            for (const event of day["events"]) {
                let event_data = JSON.parse(event.data);
                event.data = event_data;
            }
            days[event_day-1]["events"] = day["events"].sort((a, b) => {
                let a_time = a.data["start-time"].split(":");
                let b_time = b.data["start-time"].split(":");
                if (a_time[0] == b_time[0]) {
                    return a_time[1] - b_time[1];
                }
                else {
                    return a_time[0] - b_time[0];
                }
            })
        }
        res.render('family', { family: family, month: req.params.month, year: req.params.year, days: days, user: user[0][0] });
    }
});
// app.listen(3000, () => {
//     console.log("Server is running on port 3000")
// });
https.createServer({
    key: fs.readFileSync('./certs/key.pem', 'utf8'),
    cert: fs.readFileSync('./certs/cert.pem', 'utf8')
}, app).listen(3000, () => {
    console.log('Listening...')
})


// app.listen(3000, () => {
//     console.log("Server is running on port 3000")
// });
// https.createServer({
//     key: privateKey,
//     cert: certificate
// }, app).listen(3000);
