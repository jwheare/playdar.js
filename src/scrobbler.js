Playdar.Scrobbler = function () {
    Playdar.scrobbler = this;
};
Playdar.Scrobbler.prototype = {
    getUrl: function (method, query_params, callback) {
        query_params = query_params || {};
        query_params.call_id = new Date().getTime();
        Playdar.client.addAuthToken(query_params);
        if (Playdar.USE_JSONP) {
            // Add the callback, as a string jsonp parameter to the URL
            callback ? ("Playdar.scrobbler." + callback) : "Playdar.nop";
            query_params.jsonp = callback;
            return Playdar.client.getBaseUrl("/audioscrobbler/" + method, query_params);
        } else {
            // Return the callback along with the URL
            var onLoad = Playdar.nop;
            if (callback) {
                onLoad = function () {
                    Playdar.scrobbler[callback].apply(Playdar.scrobbler, arguments);
                };
            }
            return [Playdar.client.getBaseUrl("/audioscrobbler/" + method, query_params), onLoad];
        }
    },
    
    start: function (artist, track, album, duration, track_number, mbid) {
        var query_params = {
            a: artist,
            t: track,
            o: 'P'
        };
        if (album) {
            query_params['b'] = album;
        }
        if (duration) {
            query_params['l'] = duration;
        }
        if (track_number) {
            query_params['n'] = track_number;
        }
        if (mbid) {
            query_params['m'] = mbid;
        }
        Playdar.Util.loadJs(this.getUrl("start", query_params));
    },
    stopCallback: function () {
        this.stopping = false;
    },
    stop: function (sleep) {
        this.stopping = true;
        Playdar.Util.loadJs(this.getUrl("stop"), {}, "stopCallback");
        if (sleep) {
            Playdar.Util.sleep(100, function () {
                return Playdar.scrobbler.stopping == false;
            });
        }
    },
    pause: function () {
        Playdar.Util.loadJs(this.getUrl("pause"));
    },
    resume: function () {
        Playdar.Util.loadJs(this.getUrl("resume"));
    },
    getSoundCallbacks: function (result) {
        var scrobbler = this;
        return {
            onplay: function () {
                // scrobbler.start isn't called until the first whileplaying callback
                this.scrobbleStart = true;
            },
            onpause: function () {
                scrobbler.pause();
            },
            onresume: function () { 
                scrobbler.resume();
            },
            onfinish: function () {
                if (!this.options.chained) {
                    scrobbler.stop();
                }
            },
            whileplaying: function () {
                // At this point we've finished the initial load and are actually playing
                if (this.scrobbleStart) {
                    this.scrobbleStart = false;
                    // If the result doesn't have a duration, use an estimate from SoundManager2
                    var durationEstimate = Math.floor(this.durationEstimate/1000);
                    if (durationEstimate < 30) {
                        durationEstimate = 31;
                    }
                    var duration = result.duration || durationEstimate;
                    scrobbler.start(result.artist, result.track, result.album, duration);
                }
            }
        };
    }
};
