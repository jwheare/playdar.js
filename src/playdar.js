/*!
 * Playdar.js JavaScript client library
 * http://www.playdarjs.org/
 *
 * Copyright (c) 2009 James Wheare
 * Distributed under the terms of the BSD licence
 * http://www.playdarjs.org/LICENSE
 */
Playdar = {
    VERSION: "0.5.2",
    SERVER_ROOT: "localhost",
    SERVER_PORT: "60210",
    STATIC_HOST: "http://www.playdar.org",
    STAT_TIMEOUT: 2000,
    AUTH_COOKIE_NAME: "Playdar.Auth",
    AUTH_POPUP_NAME: "Playdar.AuthPopup",
    AUTH_POPUP_SIZE: {
        'w': 500,
        'h': 260
    },
    MAX_POLLS: 4,
    MAX_CONCURRENT_RESOLUTIONS: 5,
    USE_STATUS_BAR: true,
    USE_SCROBBLER: true,
    
    client: null,
    statusBar: null,
    player: null,
    auth_details: {
        name: window.document.title,
        website: window.location.protocol + '//' + window.location.host + '/'
    },
    nop: function () {},
    setupClient: function (listeners) {
        new Playdar.Client(listeners);
    },
    setupPlayer: function (soundmanager, url, onready, options) {
        new Playdar.Player(soundmanager, url, onready, options);
    },
    unload: function () {
        if (Playdar.player) {
            // Stop the music
            Playdar.player.stop_current(true);
        } else if (Playdar.scrobbler) {
            // Stop scrobbling
            Playdar.scrobbler.stop();
        }
    }
};

Playdar.DefaultListeners = {
    onStartStat: Playdar.nop,
    onStat: Playdar.nop,
    onStartManualAuth: Playdar.nop,
    onAuth: Playdar.nop,
    onAuthClear: Playdar.nop,
    onCancelResolve: Playdar.nop,
    onResults: Playdar.nop,
    onResolveIdle: Playdar.nop
};

//= require "client.js"
//= require "scrobbler.js"
//= require "player.js"
//= require "statusbar.js"
//= require "util.js"
//= require "parse.js"
//= require "json2.js"
//= require "sizzle.js"

Playdar.Util.addEvent(window, 'beforeunload', Playdar.unload);