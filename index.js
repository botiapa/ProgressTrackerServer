async function init() {
const listenPort = process.env.PORT || 80;

const express = require('express');
const bodyParser = require('body-parser');

const db = require('./database');
await db.init();
const wsHandler = require('./websocket');

const app = express()
.use('/uploads', express.static('./uploads'))
.use(express.json()) // for parsing application/json
.use(express.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded



const routes = require('./routes')(app, wsHandler, db);

const startedApp = app.listen(listenPort, () => {  
	console.log('We are live on ' + listenPort);
});

wsHandler.init(startedApp, db);
};

init();
