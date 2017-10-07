'use strict';

var util = require('util');
var path = require('path');
var fs = require('fs');
var SQLite = require('sqlite3').verbose();
var Bot = require('slackbots');

// Setting up all variables that the bot needs
// @param settings object is an extension of the original bot class. It-
// should contain a token and a name.
var NorrisBot = function Constructor(settings) {
    this.settings = settings;
    this.settings.name = this.settings.name || 'norrisbot';
    this.dbPath = settings.dbPath || path.resolve(process.cwd(), 'data', 'norrisbot.db');

    // used to store the current user info and connection instance to the DB
    this.user = null;
    this.db = null;
};

// Inherits methods and properties from the Bot constructor
util.inherits(NorrisBot, Bot);

// This method is for instantiating the bot, but won't connect
// to the slack servers unless you explicitly call the run method.
// This method calls the original constructor of the Bot class
// and attaches two callback functions respectively to the 
// 'start' event and to the 'message' event. The latter event
// is fired when a real time message is received in the
// underline websocket connection managed by the Slackbots
// module.
NorrisBot.prototype.run = function () {
    NorrisBot.super_.call(this, this.settings);

    this.on('start', this._onStart);
    this.on('message', this._onMessage);
};

// When the bot connects to the Slack server, we want it to do
// the following:
// 1. Load all metadata related to the user representing the
//    bot itself on the current Slack organisation.
// 2. Connect to the SQLite database.
// 3. Check if it's the first time the bot is executed and if
//    so send a greeting message to all the users.
// These 3 tasks are divided into 3 separate functions
NorrisBot.prototype._onStart = function () {
    this._loadBotUser();
    this._connectDb();
    this._firstRunCheck();
};

// When the original Bot class connects to the Slack server it
// downloads a list with all the users in the organisation and
// saves it in the users attribute as an array of objects. We
// just need to find the object that has the same username as
// our bot within that array.
NorrisBot.prototype._loadBotUser = function () {
    var self = this;
    this.user = this.users.filter(function (user) {
        return user.name === self.name;
    })[0];
};

// We check if the database file exists, then we create a new
// SQLite database instance.
NorrisBot.prototype._connectDb = function () {
    if (!fs.existsSync(this.dbPath)) {
        console.error('Database path ' + '"' + this.dbPath + '" does not exist or it\'s not ReadableStream.'); 
        process.exit(1);
    }

    this.db = new SQLite.Database(this.dbPath);
};

// We are using the 'info' table (defined as a key-value table)
// to see if the bot has been previously run. We also check if 
// the record with name 'lastrun' already exists in the table,
// if it exists we update the timestamp to the current one, 
// otherwise we call the function '_welcomeMessage' and create
// a new 'lastrun' record.
NorrisBot.prototype._firstRunCheck = function () {
    var self = this;
    self.db.get('SELECT val FROM info WHERE name = "lastrun" LIMIT 1', function (err, record) {
        if (err) {
            return console.error('DATABASE ERROR:', err);
        }

        var currentTime = (new Date()).toJSON();

        // this is a first run
        if (!record) {
            self._welcomeMessage();
            return self.db.run('INSERT INTO info(name, val) VALUES("lastrun", ?)', currentTime);
        }

        // updates with new last running time
        self.db.run('UPDATE info SET val = ? WHERE name = "lastrun"', currentTime);
    });
};

// We are using the function 'postMessageToChannel' of the 
// 'Bot' class. We select the first channel where the Bot is
// installed. An important detail to notice is the 'as_user' 
// attribute passed in the configuration object. It allows the 
// bot to post the message as itself (the message will be
// visualised with the avatar of the bot and it's name).
NorrisBot.prototype._welcomeMessage = function () {
    this.postMessageToChannel(this.channels[0].name, 'Hi guys, roundhouse-kick anyone?' + '\n I can tell jokes, but very honest ones. Just say `Chuck Norris` or `' + this.name + '` to invoke me!', {as_user: true});
};

// The function receives a message object as a paramter.
// The message contains all the information that describes the 
// real time event received through the Slack real time API.
NorrisBot.prototype._onMessage = function (message) {
    if (this._isChatMessage(message) &&
        this._isChannelConversation(message) &&
        !this._isFromNorrisBot(message) &&
        this._isMentioningChuckNorris(message)
    ) {
        this._replyWithRandomJoke(message);
    }
};

// Checking if a real time event corresponds to a message sent
// by a user. Basically checking if the message is of type
// 'message' and if it contains some text.
NorrisBot.prototype._isChatMessage = function (message) {
    return message.type === 'message' && Boolean(message.text);
};

// Checking if the message is directed to a channel. Almost 
// every RTM contains the attribute 'channel that's an ID of
// the channel to which an event occurred. We can have a look 
// at the first character of the ID. When it starts with a "C"
// it represents a chat channel.
NorrisBot.prototype._isChannelConversation = function (message) {
    return typeof message.channel === 'string' && message.channel[0] === 'C';
};

// This is to avoid an infinite loop of infinite jokes
// that will occur when the bot is replying to itself.
NorrisBot.prototype._isFromNorrisBot = function (message) {
    return message.user === this.user.id;
};

// Checking to see if the text message mentions Chuck
// Norris ot the name we chose for our NorrisBot.
NorrisBot.prototype._isMentioningChuckNorris = function (message) {
    return message.text.toLowerCase().indexOf('chuck norris') > -1 || message.text.toLowerCase().indexOf(this.name) > -1;
};

// We call this function if all the above checks pass.
// It extracts a joke at random from the database and posts it 
// in the channel where the original message was written.
// We are using another helper function called _getChannelById.
// RTMs reference channels with IDs, but all the functions to 
// post messages use the name of the channel as a parameter, 
// so we need to retrieve the name of the channel given its ID.
NorrisBot.prototype._replyWithRandomJoke = function (originalMessage) {
    var self = this;
    self.db.get('SELECT id, joke FROM jokes ORDER BY used ASC, RANDOM() LIMIT 1', function (err, record) {
        if (err) {
            return console.error('DATABASE ERROR:', err);
        }

        var channel = self._getChannelById(originalMessage.channel);
        self.postMessageToChannel(channel.name, record.joke, {as_user: true});
        self.db.run('UPDATE jokes SET used = used + 1 WHERE id = ?', record.id);
    });
};

// Returns an object with channel details of the
// channel ID passed.
NorrisBot.prototype._getChannelById = function (channelId) {
    return this.channels.filter(function (item) {
        return item.id === channelId;
    })[0];
};

module.exports = NorrisBot;