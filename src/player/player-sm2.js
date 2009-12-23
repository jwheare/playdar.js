Playdar.SM2Player = function (soundmanager, swfUrl, onready, options) {
    Playdar.player = this;
    
    this.results = {};
    this.nowplayingid = null;
    
    // soundmanager can be a jsUrl or the soundManager global
    if (typeof soundmanager == 'string') {
        SM2_DEFER = true;
        Playdar.Util.loadJs(soundmanager, 'SoundManager', function (SoundManager) {
            soundManager = new SoundManager();
            Playdar.player.setupSoundmanager(soundManager, swfUrl, onready, options);
        });
    } else {
        Playdar.player.setupSoundmanager(soundmanager, swfUrl, onready, options);
    }
};

Playdar.SM2Player.DefaultOptions = {
    // Enable flash 9 features, like mpeg4 support and video
    flashVersion: 9,
    useMovieStar: true,
    // Debug settings
    consoleOnly: true,
    debugMode: false,
    // Set an infinite timeout to allow for flashblockers
    flashLoadTimeout: 0
};

// Those set to true are MPEG4 and require isMovieStar in soundmanager init
Playdar.SM2Player.MIMETYPES = {
    "audio/mpeg": false,
    "audio/aac": true,
    "audio/x-aac": true,
    "audio/mp4": true,
    "audio/m4a": true,
    "audio/x-m4a": true,
    "audio/x-m4b": true,
    "video/mp4": true,
    "video/mov": true,
    "video/quicktime": true,
    "video/flv": true,
    "video/m4v": true,
    "video/x-m4v": true,
    "video/mp4v": true,
    "video/f4v": true,
    "video/3gp": true,
    "video/3g2": true
};
Playdar.SM2Player.prototype = {
    setupSoundmanager: function (soundmanager, swfUrl, onready, options) {
        this.soundmanager = soundmanager;
        // Merge in defaults
        options = options || {};
        options.url = swfUrl;
        var k;
        for (k in Playdar.SM2Player.DefaultOptions) {
            options[k] = options[k] || Playdar.SM2Player.DefaultOptions[k];
        }
        // Set soundManager options
        for (k in options) {
            this.soundmanager[k] = options[k];
        }
        if (onready) {
            this.soundmanager.onready(onready);
        }
        this.soundmanager.beginDelayedInit();
    },
    getMimeTypes: function () {
        var mime_types = [];
        for (var type in Playdar.SM2Player.MIMETYPES) {
            mime_types.push(type);
        }
        return mime_types;
    },
    register_stream: function (result, options) {
        options = options || {};
        if (!result.sid) {
            result.sid = Playdar.Util.generate_uuid();
            options.external = true;
        }
        if (this.results[result.sid]) {
            return false;
        }
        // Register result
        this.results[result.sid] = result;
        
        var url = options.external ? result.url : Playdar.client.get_stream_url(result.sid);
        var isMp3 = url.match(this.soundmanager.filePatterns.flash8);
        var isNetStream = url.match(this.soundmanager.netStreamPattern);
        var isMovieStar;
        if (isMp3) {
            // MP3s never use movie star
            isMovieStar = false;
        } else {
            // Trust file extension before mime types
            isMovieStar = (isNetStream ? true : false) || Playdar.SM2Player.MIMETYPES[result.mimetype];
        }
        
        var sound_options = Playdar.Util.extendObject({
            id: 's_' + result.sid,
            url: url,
            isMovieStar: isMovieStar,
            useVideo: true,
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
        var sound = this.getSound(sid);
        if (this.nowplayingid != sid) {
            this.stop_current();
            if (sound.playState === 0) {
                this.nowplayingid = sid;
                // Update status bar
                if (Playdar.statusBar) {
                    Playdar.statusBar.playHandler(this.results[sid]);
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
        var nowPlaying = this.getNowPlaying();
        if (nowPlaying) {
            if (nowPlaying.playState == 1) {
                nowPlaying.stop();
            }
            nowPlaying.unload();
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
    getNowPlaying: function () {
        if (this.nowplayingid) {
            return this.getSound(this.nowplayingid);
        }
    },
    getSound: function (sid) {
        return this.soundmanager.getSoundById('s_' + sid);
    },
    toggle_nowplaying: function () {
        if (this.nowplayingid) {
            this.play_stream(this.nowplayingid);
        }
    }
};
