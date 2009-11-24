Playdar.Scrobbler = function () {
    Playdar.scrobbler = this;
};
Playdar.Scrobbler.prototype = {
    getUrl: function (method, query_params) {
        query_params = query_params || {};
        query_params.call_id = new Date().getTime();
        query_params.jsonp = query_params.jsonp || 'Playdar.nop';
        Playdar.client.addAuthToken(query_params);
        return Playdar.client.getBaseUrl("/audioscrobbler/" + method, query_params);
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
        Playdar.Util.loadJs(this.getUrl("stop"), {
            jsonp: Playdar.scrobbler.stopCallback
        });
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
            onload: function () {
                if (this.readyState == 2) { // failed/error
                    scrobbler.stop();
                    this.unload();
                }
            },
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
                if (!this.chained) {
                    scrobbler.stop();
                }
            },
            whileplaying: function () {
                // At this point we've finished the initial load and are actually playing
                if (this.scrobbleStart) {
                    this.scrobbleStart = false;
                    scrobbler.start(result.artist, result.track, result.album, result.duration);
                }
            }
        };
    }
};
