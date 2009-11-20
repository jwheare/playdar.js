Playdar.Player = function (soundmanager, url, onready, options) {
    // Merge in defaults
    options = options || {};
    options.url = url;
    for (var k in Playdar.Player.DefaultOptions) {
        options[k] = options[k] || Playdar.Player.DefaultOptions[k];
    }
    Playdar.player = this;
    
    this.streams = {};
    this.nowplayingid = null;
    this.soundmanager = soundmanager;
    // Set soundManager options
    for (var k in options) {
        this.soundmanager[k] = options[k];
    }
    if (onready) {
        this.soundmanager.onready(onready);
    }
};

Playdar.Player.DefaultOptions = {
    waitForWindowLoad: true,
    // Enable flash 9 features, like mpeg4 support
    flashVersion: 9,
    useMovieStar: true,
    // Debug settings
    consoleOnly: true,
    debugMode: false,
    // Set an infinite timeout to allow for flashblockers
    flashLoadTimeout: 0
};

// Those set to true are MPEG4 and require isMovieStar in soundmanager init
Playdar.Player.MIMETYPES = {
    "audio/mpeg": false,
    "audio/aac": true,
    "audio/x-aac": true,
    "audio/flv": true,
    "audio/mov": true,
    "audio/mp4": true,
    "audio/m4v": true,
    "audio/f4v": true,
    "audio/m4a": true,
    "audio/x-m4a": true,
    "audio/x-m4b": true,
    "audio/mp4v": true,
    "audio/3gp": true,
    "audio/3g2": true
};
Playdar.Player.prototype = {
    getMimeTypes: function () {
        var mime_types = [];
        for (var type in Playdar.Player.MIMETYPES) {
            mime_types.push(type);
        }
        return mime_types;
    },
    register_stream: function (result, options) {
        if (this.streams[result.sid]) {
            return false;
        }
        // Register result
        this.streams[result.sid] = result;
        
        var sound_options = Playdar.Util.extendObject({
            id: 's_' + result.sid,
            url: Playdar.client.get_stream_url(result.sid),
            isMovieStar: Playdar.Player.MIMETYPES[result.mimetype] === true,
            bufferTime: 2
        }, options);
        
        var callbackOptions = [options];
        // Wrap sound progress callbacks with status bar
        if (Playdar.statusBar) {
            callbackOptions.push(Playdar.statusBar.getSoundCallbacks(result));
        }
        // Wrap sound lifecycle callbacks in scrobbling calls
        if (Playdar.scrobbler) {
            callbackOptions.push(Playdar.scrobbler.getSoundCallbacks(result));
        }
        Playdar.Util.extendObject(sound_options, Playdar.Util.mergeCallbackOptions(callbackOptions));
        try {
            var sound = this.soundmanager.createSound(sound_options);
        } catch (e) {
            return false;
        }
        return sound;
    },
    play_stream: function (sid) {
        var sound = this.soundmanager.getSoundById('s_' + sid);
        if (this.nowplayingid != sid) {
            this.stop_current();
            if (sound.playState === 0) {
                this.nowplayingid = sid;
                // Update status bar
                if (Playdar.statusBar) {
                    Playdar.statusBar.playHandler(this.streams[sid]);
                }
            }
        }
        
        sound.togglePause();
        return sound;
    },
    stop_current: function (hard) {
        if (hard) {
            if (Playdar.scrobbler) {
                Playdar.scrobbler.stop();
            }
        }
        if (this.nowplayingid) {
            var sound = this.soundmanager.getSoundById('s_' + this.nowplayingid);
            if (sound.playState == 1) {
                sound.setPosition(1);
                sound.stop();
            }
            this.nowplayingid = null;
        }
        // Update status bar
        if (Playdar.statusBar) {
            Playdar.statusBar.stopCurrent();
        }
    },
    stop_stream: function (sid) {
        if (sid && sid == this.nowplayingid) {
            this.stop_current();
            return true;
        }
        return false;
    },
    is_now_playing: function () {
        if (this.nowplayingid) {
            return true;
        }
        return false;
    },
    toggle_nowplaying: function () {
        if (this.nowplayingid) {
            this.play_stream(this.nowplayingid);
        }
    }
};
