'use strict';

var NorrisBot = require('../lib/norrisbot');

var token = process.env.BOT_API_KEY;
var dbPath = process.env.BOT_DB_PATH;
var name = process.env.BOT_NAME;

var norrisbot = new NorrisBot({
    token: token,
    dbPath: dbPath,
    name: name
});

norrisbot.run();

// We're importing our NorrisBot class, instantiating it and
// launching the bot with the 'run' method. We're also using 
// some env vars to make our bot configurable:
// 1. BOT_API_KEY: this one is mandatory and must be used to
//    specify the API token needed by the bot to connect to 
//    your Slack org.
// 2. BOT_DB_PATH: optional. Allows you to use a different DB
//    or move the default one to a different path.
// 3. BOT_NAME: optional. Will default to 'norrisbot' if none
//    is selected.