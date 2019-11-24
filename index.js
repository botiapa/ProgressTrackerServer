const listenPort = process.env.PORT || 80;

const express = require('express');
const bodyParser = require('body-parser');

const dbconn = require('./database')();
const wsHandler = require('./websocket');

const app = express()
.use('/uploads', express.static('./uploads'))
.use(express.json()) // for parsing application/json
.use(express.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded



const routes = require('./routes')(app, wsHandler, dbconn);

const startedApp = app.listen(listenPort, () => {  
	console.log('We are live on ' + listenPort);
});

wsHandler.init(startedApp, dbconn);