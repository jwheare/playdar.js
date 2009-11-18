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
    setupPlayer: function (soundmanager) {
        new Playdar.Player(soundmanager);
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

Playdar.Client = function (listeners) {
    Playdar.client = this;
    
    this.auth_token = false;
    this.authPopup = null;
    
    this.listeners = {};
    this.resultsCallbacks = {};
    
    this.resolveQids = [];
    this.lastQid = "";
    this.pollCounts = {};
    
    /**
     * A query resolution queue consumed by processResolutionQueue, which is called
     * each time a final_answer is received from the daemon.
    **/
    this.initialiseResolve();
    
    // Setup listeners
    this.register_listeners(Playdar.DefaultListeners);
    this.register_listeners(listeners);
    
    this.uuid = Playdar.Util.generate_uuid();
};
Playdar.Client.prototype = {
    register_listener: function (event, callback) {
        callback = callback || Playdar.nop;
        this.listeners[event] = function () { return callback.apply(Playdar.client, arguments); };
    },
    register_listeners: function (listeners) {
        if (!listeners) {
            return;
        }
        for (var event in listeners) {
            this.register_listener(event, listeners[event]);
        }
        return true;
    },
    // Custom search result handlers can be bound to a specific qid
    register_results_handler: function (handler, qid) {
        if (qid) {
            this.resultsCallbacks[qid] = handler;
        } else {
            this.register_listener('onResults', handler);
        }
    },
    
    // INIT / STAT / AUTH
    
    go: function () {
        if (!this.is_authed()) {
            this.auth_token = Playdar.Util.getCookie(Playdar.AUTH_COOKIE_NAME);
        }
        this.stat();
    },
    
    stat: function (postAuth) {
        this.statResponse = null;
        if (!postAuth) {
            this.listeners.onStartStat();
        }
        setTimeout(function () {
            Playdar.client.onStatTimeout();
        }, Playdar.STAT_TIMEOUT);
        Playdar.Util.loadJs(this.getUrl("stat", "handleStat"));
    },
    isAvailable: function () {
        return this.statResponse && this.statResponse.name == "playdar";
    },
    onStatTimeout: function () {
        if (!this.isAvailable()) {
            this.listeners.onStat(false);
        }
    },
    handleStat: function (response) {
        this.statResponse = response;
        // Update status bar
        if (Playdar.USE_STATUS_BAR) {
            new Playdar.StatusBar();
            Playdar.statusBar.handleStat(response);
        }
        this.listeners.onStat(response);
        
        if (response.authenticated) {
            // Setup scrobbling if we haven't already, if it's enabled globally
            // and if the daemon has it enabled
            if (!Playdar.scrobbler && Playdar.USE_SCROBBLER && response.capabilities.audioscrobbler) {
                new Playdar.Scrobbler();
            }
            this.listeners.onAuth();
        } else if (this.is_authed()) {
            this.clearAuth();
        }
    },
    clearAuth: function () {
        Playdar.unload();
        // Revoke auth at the server
        Playdar.Util.loadJs(this.getRevokeUrl());
        // Clear auth token
        this.auth_token = false;
        Playdar.Util.deleteCookie(Playdar.AUTH_COOKIE_NAME);
        // Stop resolving
        this.cancel_resolve();
        // Stat again
        this.stat();
        // Callback
        this.listeners.onAuthClear();
        // Update status bar
        if (Playdar.statusBar) {
            Playdar.statusBar.offline();
        }
    },
    is_authed: function () {
        if (this.auth_token) {
            return true;
        }
        return false;
    },
    getAuthUrl: function () {
        return this.getBaseUrl("/auth_1/", Playdar.auth_details);
    },
    getRevokeUrl: function () {
        return this.getBaseUrl("/authcodes", {
            revoke: this.auth_token,
            jsonp: 'Playdar.nop'
        });
    },
    get_stat_link_html: function (title) {
        title = title || "Retry";
        var html = '<a href="#"'
            + ' onclick="Playdar.client.go(); return false;'
            + '">' + title + '</a>';
        return html;
    },
    get_auth_link_html: function (title) {
        title = title || "Connect";
        var html = '<a href="' + this.getAuthUrl()
            + '" target="' + Playdar.AUTH_POPUP_NAME
            + '" onclick="Playdar.client.start_auth(); return false;'
        + '">' + title + '</a>';
        return html;
    },
    get_disconnect_link_html: function (text) {
        text = text || "Disconnect";
        var html = '<a href="' + this.getRevokeUrl()
            + '" onclick="Playdar.client.clearAuth(); return false;'
        + '">' + text + '</a>';
        return html;
    },
    start_auth: function () {
        if (!this.authPopup || this.authPopup.closed) {
            this.authPopup = window.open(
                this.getAuthUrl(),
                Playdar.AUTH_POPUP_NAME,
                Playdar.Util.getPopupOptions(Playdar.AUTH_POPUP_SIZE)
            );
        } else {
            this.authPopup.focus();
        }
        if (!Playdar.auth_details.receiverurl) {
            this.listeners.onStartManualAuth();
            // Show manual auth form
            if (Playdar.statusBar) {
                Playdar.statusBar.startManualAuth();
            }
        }
    },
    
    auth_callback: function (token) {
        Playdar.Util.setCookie(Playdar.AUTH_COOKIE_NAME, token, 365);
        if (this.authPopup && !this.authPopup.closed) {
            this.authPopup.close();
            this.authPopup = null;
        }
        this.auth_token = token;
        this.stat(true);
    },
    manualAuthCallback: function (input_id) {
        var input = document.getElementById(input_id);
        if (input && input.value) {
            this.auth_callback(input.value);
        }
    },
    
    /**
     * Playdar.client.autodetect([callback][, context])
     * - callback (Function): Function to be run for each track to be resolved
     *      Will be passed the track object. If this returns a qid, it will be
     *      passed on to the resolve call.
     * - context (DOMElement): A DOM node to use to scope the selector
     * 
     * Attempts to detect any mentions of a track on a page or within a node
     * and resolves them.
    **/
    autodetect: function (callback, context) {
        if (!this.is_authed()) {
            return false;
        }
        var qid, i, j, list, track;
        try {
            var mf = Playdar.Parse.microformats(context);
            var rdfa = Playdar.Parse.rdfa(context);
            var data = mf.concat(rdfa);
            for (i = 0; i < data.length; i++) {
                list = data[i];
                for (j = 0; j < list.tracks.length; j++) {
                    track = list.tracks[j];
                    if (callback) {
                        qid = callback(track);
                    }
                    this.resolve(track.artist, track.title, track.album, qid);
                }
            }
            return data;
        } catch (error) {
            console.warn(error);
        }
    },
    
    // CONTENT RESOLUTION
    /**
     * Playdar.client.resolve(artist, track[, album][, qid][, results])
     * - artist (String): Track artist
     * - track (String): Track title
     * - album (String): Track album. This will only be used for sorting results
     * - qid (UUID): ID to use for this query
     * - results (Array): An array of result objects to seed the response set with
     * 
     * Queries the Playdar API by first calling the `resolve` method then initiates polling of `get_results`
    **/    
    resolve: function (artist, track, album, qid, results) {
        if (!this.is_authed()) {
            return false;
        }
        var query = {
            artist: artist || '',
            album: album || '',
            track: track || '',
            qid: qid || Playdar.Util.generate_uuid()
        };
        if (results) {
            query.results = results;
        }
        // List player's supported mimetypes
        if (Playdar.player) {
            query.mimetypes = Playdar.player.getMimeTypes().join(',');
        }
        // Update resolving progress status
        if (Playdar.statusBar) {
            Playdar.statusBar.incrementRequests();
        }
        
        this.resolutionQueue.push(query);
        this.processResolutionQueue();
    },
    processResolutionQueue: function() {
        if (this.resolutionsInProgress.count >= Playdar.MAX_CONCURRENT_RESOLUTIONS) {
            return false;
        }
        // Check we've got nothing queued up or in progress
        var resolution_count = this.resolutionQueue.length + this.resolutionsInProgress.count;
        if (resolution_count) {
            var available_resolution_slots = Playdar.MAX_CONCURRENT_RESOLUTIONS - this.resolutionsInProgress.count;
            for (var i = 1; i <= available_resolution_slots; i++) {
                var query = this.resolutionQueue.shift();
                if (!query) {
                    break;
                }
                this.resolutionsInProgress.queries[query.qid] = query;
                this.resolutionsInProgress.count++;
                Playdar.Util.loadJs(this.getUrl("resolve", "handleResolution", query));
            }
        } else {
            this.listeners.onResolveIdle();
        }
    },
    cancel_resolve: function () {
        this.initialiseResolve();
        // Callbacks
        this.listeners.onResolveIdle();
        this.listeners.onCancelResolve();
        if (Playdar.statusBar) {
            Playdar.statusBar.cancelResolve();
        }
    },
    initialiseResolve: function () {
        this.resolutionQueue = [];
        this.resolutionsInProgress = {
            count: 0,
            queries: {}
        };
    },
    recheck_results: function (qid) {
        var query = {
            qid: qid 
        };
        this.resolutionsInProgress.queries[qid] = query;
        this.resolutionsInProgress.count++;
        this.handleResolution(query);
    },
    handleResolution: function (query) {
        // Check resolving hasn't been cancelled
        if (this.resolutionsInProgress.queries[query.qid]) {
            this.lastQid = query.qid;
            this.resolveQids.push(this.lastQid);
            this.getResults(query.qid);
        }
    },
    
    // poll results for a query id
    getResults: function (qid) {
        // Check resolving hasn't been cancelled
        if (this.resolutionsInProgress.queries[qid]) {
            if (!this.pollCounts[qid]) {
                this.pollCounts[qid] = 0;
            }
            this.pollCounts[qid]++;
            Playdar.Util.loadJs(this.getUrl("get_results", "handleResults", {
                qid: qid,
                poll: this.pollCounts[qid]
            }));
        }
    },
    pollResults: function (response, callback, scope) {
        // figure out if we should re-poll, or if the query is solved/failed:
        var final_answer = this.shouldStopPolling(response);
        scope = scope || this;
        if (!final_answer) {
            setTimeout(function () {
                callback.call(scope, response.qid);
            }, response.poll_interval || response.refresh_interval);
            // response.refresh_interval is deprecated.
        }
        return final_answer;
    },
    shouldStopPolling: function (response) {
        // Stop if the server tells us to
        // response.refresh_interval is deprecated. (undefined <= 0 === false)
        if (response.poll_interval <= 0 || response.refresh_interval <= 0) {
            return true;
        }
        // Stop if the query is solved
        if (response.solved === true) {
            return true;
        }
        // Stop if we've exceeded our poll limit
        if (this.pollCounts[response.qid] >= (response.poll_limit || Playdar.MAX_POLLS)) {
            return true;
        }
        return false;
    },
    handleResults: function (response) {
        // Check resolving hasn't been cancelled
        if (this.resolutionsInProgress.queries[response.qid]) {
            var final_answer = this.pollResults(response, this.getResults);
            // Status bar handler
            if (Playdar.statusBar) {
                Playdar.statusBar.handleResults(response, final_answer);
            }
            if (this.resultsCallbacks[response.qid]) {
                // try a custom handler registered for this query id
                this.resultsCallbacks[response.qid](response, final_answer);
            } else {
                // fall back to standard handler
                this.listeners.onResults(response, final_answer);
            }
            // Check to see if we can make some more resolve calls
            if (final_answer) {
                delete this.resolutionsInProgress.queries[response.qid];
                this.resolutionsInProgress.count--;
                this.processResolutionQueue();
            }
        }
    },
    get_last_results: function () {
        if (this.lastQid) {
            if (Playdar.statusBar) {
                Playdar.statusBar.incrementRequests();
            }
            this.getResults(this.lastQid);
        }
    },
    
    // UTILITY FUNCTIONS
    
    getBaseUrl: function (path, query_params) {
        var url = "http://" + Playdar.SERVER_ROOT + ":" + Playdar.SERVER_PORT;
        if (path) {
            url += path;
        }
        if (query_params) {
            url += '?' + Playdar.Util.toQueryString(query_params);
        }
        return url;
    },
    
    /**
     * Playdar.client.getUrl(method, jsonp[, query_params]) -> String
     * - method (String): Method to call on the Playdar API
     * - jsonp (String | Array): JSONP Callback name.
     *     If a string, will be passed to Playdar.client.jsonpCallback to build
     *     a callback of the form Playdar.client.<callback>
     *     If an array, will be joined together with dot notation.
     * - query_params (Object): An optional object that defines extra query params
     * 
     * Builds an API URL from a method name, jsonp parameter and an optional object
     * of extra query parameters.
    **/
    getUrl: function (method, jsonp, query_params) {
        query_params = query_params || {};
        query_params.call_id = new Date().getTime();
        query_params.method = method;
        if (!query_params.jsonp) {
            if (jsonp.join) { // duck type check for array
                query_params.jsonp = jsonp.join('.');
            } else {
                query_params.jsonp = this.jsonpCallback(jsonp);
            }
        }
        this.addAuthToken(query_params);
        return this.getBaseUrl("/api/", query_params);
    },
    
    addAuthToken: function (query_params) {
        if (this.is_authed()) {
            query_params.auth = this.auth_token;
        }
        return query_params;
    },
    
    // turn a source id into a stream url
    get_stream_url: function (sid) {
        return this.getBaseUrl("/sid/" + sid);
    },
    
    // build the jsonp callback string
    jsonpCallback: function (callback) {
        return "Playdar.client." + callback;
    }
};

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
    stop: function () {
        Playdar.Util.loadJs(this.getUrl("stop"));
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

Playdar.Player = function (soundmanager) {
    Playdar.player = this;
    
    this.streams = {};
    this.nowplayingid = null;
    this.soundmanager = soundmanager;
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

Playdar.StatusBar = function () {
    Playdar.statusBar = this;
    
    this.progressBarWidth = 200;
    
    this.requestCount = 0;
    this.pendingCount = 0;
    this.successCount = 0;
    
    this.build();
};
Playdar.StatusBar.prototype = {
    build: function () {
        /* Status bar
           ---------- */
        var statusBar = document.createElement("div");
        statusBar.style.position = 'fixed';
        statusBar.style.bottom = 0;
        statusBar.style.left = 0;
        statusBar.style.zIndex = 100;
        statusBar.style.width = '100%';
        statusBar.style.height = '36px';
        statusBar.style.padding = '7px 0';
        statusBar.style.borderTop = '2px solid #4c7a0f';
        statusBar.style.font = 'normal 13px/18px "Calibri", "Lucida Grande", sans-serif';
        statusBar.style.color = "#335507";
        statusBar.style.background = '#e8f9bb';
        
        /* Left column
           ----------- */
        var leftCol = document.createElement("div");
        leftCol.style.padding = "0 7px";
        // Logo
        var logo = '<img src="' + Playdar.STATIC_HOST + '/static/playdar_logo_32x32.png" width="32" height="32" style="vertical-align: middle; float: left; margin: 0 10px 0 0; border: 0; line-height: 36px;" />';
        leftCol.innerHTML = logo;
        
        // - Status message
        this.status = document.createElement("p");
        this.status.style.margin = "0";
        this.status.style.padding = "0 8px";
        this.status.style.lineHeight = "36px";
        this.status.style.fontSize = "15px";
        leftCol.appendChild(this.status);
        
        // - Playback
        this.playback = document.createElement("div");
        this.playback.style.padding = "0 7px";
        this.playback.style.display = "none";
        // - Now playing track
        var trackTitle = document.createElement("p");
        trackTitle.style.margin = "0";
        this.trackLink = document.createElement("a");
        this.trackLink.style.textDecoration = "none";
        
        this.artistName = document.createElement("span");
        this.artistName.style.textTransform = "uppercase";
        this.artistName.style.color = "#4c7a0f";
        
        this.trackName = document.createElement("strong");
        this.trackName.style.margin = "0 0 0 10px";
        this.trackName.style.color = "#335507";
        
        this.trackLink.appendChild(this.artistName);
        this.trackLink.appendChild(this.trackName);
        trackTitle.appendChild(this.trackLink);
        this.playback.appendChild(trackTitle);
        
        // Playback Progress table
        var progressTable = document.createElement("table");
        progressTable.setAttribute('cellpadding', 0);
        progressTable.setAttribute('cellspacing', 0);
        progressTable.setAttribute('border', 0);
        progressTable.style.color = "#4c7a0f";
        progressTable.style.font = 'normal 10px/16px "Verdana", sans-serif';
        var progressTbody = document.createElement("tbody");
        var progressRow = document.createElement("tr");
        // L: - Time elapsed
        this.trackElapsed = document.createElement("td");
        this.trackElapsed.style.verticalAlign = "middle";
        progressRow.appendChild(this.trackElapsed);
        // M: Bar column
        var progressCell = document.createElement("td");
        progressCell.style.padding = "0 5px";
        progressCell.style.verticalAlign = "middle";
        // Bar container
        var progressBar = document.createElement("div");
        progressBar.style.width = this.progressBarWidth + "px";
        progressBar.style.height = "9px";
        progressBar.style.border = "1px solid #4c7a0f";
        progressBar.style.background = "#fff";
        progressBar.style.position = "relative";
        // - Loading progress
        this.loadHead = document.createElement("div");
        this.loadHead.style.position = "absolute";
        this.loadHead.style.width = 0;
        this.loadHead.style.height = "9px";
        this.loadHead.style.background = "#d2f380";
        progressBar.appendChild(this.loadHead);
        // - Playback progress
        this.playHead = document.createElement("div");
        this.playHead.style.position = "absolute";
        this.playHead.style.width = 0;
        this.playHead.style.height = "9px";
        this.playHead.style.background = "#6ea31e";
        progressBar.appendChild(this.playHead);
        // Click to toggle pause
        progressBar.onclick = function () {
            Playdar.player.toggle_nowplaying();
        };
        progressCell.appendChild(progressBar);
        progressRow.appendChild(progressCell);
        // R: - Track duration
        this.trackDuration = document.createElement("td");
        this.trackDuration.style.verticalAlign = "middle";
        progressRow.appendChild(this.trackDuration);
        
        progressTbody.appendChild(progressRow);
        progressTable.appendChild(progressTbody);
        this.playback.appendChild(progressTable);
        
        leftCol.appendChild(this.playback);
        
        /* Right column
           ------------ */
        var rightCol = document.createElement("div");
        rightCol.style.cssFloat = "right";
        rightCol.style.padding = "0 8px";
        rightCol.style.textAlign = "right";
        // Settings link
        var settingsLink = document.createElement("p");
        settingsLink.style.margin = 0;
        settingsLink.innerHTML = '<a href="' + Playdar.client.getBaseUrl() + '" target="_blank">Settings</a>';
        rightCol.appendChild(settingsLink);
        // - Disconnect link
        this.playdarLinks = document.createElement("p");
        this.playdarLinks.style.margin = 0;
        
        this.playdarLinks.innerHTML = Playdar.client.get_disconnect_link_html();
        rightCol.appendChild(this.playdarLinks);
        
        // - Query count
        this.queryCount = document.createElement("span");
        this.queryCount.style.margin = "0 5px 0 5px";
        this.queryCount.style.fontSize = "11px";
        this.queryCount.style.fontWeight = "normal";
        this.queryCount.style.color = "#6ea31e";
        this.playdarLinks.insertBefore(this.queryCount, this.playdarLinks.firstChild);
        
        /* Build status bar
           --------------- */
        statusBar.appendChild(rightCol);
        statusBar.appendChild(leftCol);
        
        /* Build status bar */
        document.body.appendChild(statusBar);
        
        // Adjust the page bottom margin to fit status bar
        var marginBottom = document.body.style.marginBottom;
        if (!marginBottom) {
            var css = document.defaultView.getComputedStyle(document.body, null);
            if (css) {
                marginBottom = css.marginBottom;
            }
        }
        document.body.style.marginBottom = (marginBottom.replace('px', '') - 0) + 36 + (7*2) + 2 + 'px';
        
        return statusBar;
    },
    
    ready: function () {
        this.playdarLinks.style.display = "";
        var message = "Ready";
        this.status.innerHTML = message;
    },
    offline: function () {
        this.playdarLinks.style.display = "none";
        var message = Playdar.client.get_auth_link_html();
        this.status.innerHTML = message;
    },
    startManualAuth: function () {
        this.playdarLinks.style.display = "none";
        var input_id = "manualAuth_" + Playdar.client.uuid;
        var form = '<form>'
            + '<input type="text" id="' + input_id + '" />'
            + ' <input type="submit" value="Allow access to Playdar"'
                + ' onclick="Playdar.client.manualAuthCallback(\'' + input_id + '\'); return false;'
            + '" />'
            + '</form>';
        this.status.innerHTML = form;
        Playdar.Util.select('#' + input_id)[0].focus();
    },
    
    handleStat: function (response) {
        if (response.authenticated) {
            this.ready();
        } else {
            this.offline();
        }
    },
    
    showResolutionStatus: function () {
        if (this.queryCount) {
            var status = " ";
            if (this.pendingCount) {
                status += this.pendingCount + ' <img src="' + Playdar.STATIC_HOST + '/static/track_throbber.gif" width="16" height="16" style="vertical-align: middle; margin: -2px 2px 0 2px"/> ';
            }
            status += " " + this.successCount + "/" + this.requestCount;
            this.queryCount.innerHTML = status;
        }
    },
    handleResults: function (response, final_answer) {
        if (final_answer) {
            this.pendingCount--;
            if (response.results.length) {
                this.successCount++;
            }
        }
        this.showResolutionStatus();
    },
    incrementRequests: function () {
        this.requestCount++;
        this.pendingCount++;
        this.showResolutionStatus();
    },
    cancelResolve: function () {
        this.pendingCount = 0;
        this.showResolutionStatus();
    },
    
    getSoundCallbacks: function (result) {
        return {
            whileplaying: function () {
                Playdar.statusBar.playingHandler(this);
            },
            whileloading: function () {
                Playdar.statusBar.loadingHandler(this);
            }
        };
    },
    
    playHandler: function (stream) {
        // Initialise the track progress
        this.trackElapsed.innerHTML = Playdar.Util.mmss(0);
        // Update the track link
        this.trackLink.href = Playdar.client.get_stream_url(stream.sid);
        this.trackLink.title = stream.source;
        this.trackName.innerHTML = stream.track;
        this.artistName.innerHTML = stream.artist;
        // Update the track duration
        this.trackDuration.innerHTML = Playdar.Util.mmss(stream.duration);
        // Show progress bar
        this.status.style.display = "none";
        this.playback.style.display = "";
    },
    playingHandler: function (sound) {
        // Update the track progress
        this.trackElapsed.innerHTML = Playdar.Util.mmss(Math.round(sound.position/1000));
        // Update the playback progress bar
        var duration;
        if (sound.readyState == 3) { // loaded/success
            duration = sound.duration;
        } else {
            duration = sound.durationEstimate;
        }
        var portionPlayed = sound.position / duration;
        this.playHead.style.width = Math.round(portionPlayed * this.progressBarWidth) + "px";
        // Call the loading handler too because the sound may have fully loaded while
        // we were playing a different track
        this.loadingHandler(sound);
    },
    loadingHandler: function (sound) {
        // Update the loading progress bar
        var loaded = sound.bytesLoaded/sound.bytesTotal;
        this.loadHead.style.width = Math.round(loaded * this.progressBarWidth) + "px";
    },
    stopCurrent: function () {
        this.playback.style.display = "none";
        this.status.style.display = "";
        
        this.trackLink.href = "#";
        this.trackLink.title = "";
        this.trackName.innerHTML = "";
        this.artistName.innerHTML = "";
        
        this.loadHead.style.width = 0;
        this.playHead.style.width = 0;
    }
};

Playdar.Util = {
    /**
     * Based on: Math.uuid.js
     * Copyright (c) 2008, Robert Kieffer. All rights reserved.
     * License and info: http://www.broofa.com/blog/2008/09/javascript-uuid-function/
    **/
    generate_uuid: function () {
        // Private array of chars to use
        var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');
        var uuid = [];
        var rnd = Math.random;
        
        // rfc4122, version 4 form
        var r;
        
        // rfc4122 requires these characters
        uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-';
        uuid[14] = '4';
        
        // Fill in random data.  At i==19 set the high bits of clock sequence as
        // per rfc4122, sec. 4.1.5
        for (var i = 0; i < 36; i++) {
            if (!uuid[i]) {
                r = 0 | rnd()*16;
                uuid[i] = chars[(i == 19) ? (r & 0x3) | 0x8 : r & 0xf];
            }
        }
        return uuid.join('');
    },
    
    // Query string helpers
    toQueryPair: function (key, value) {
        if (value === null) {
            return key;
        }
        return key + '=' + encodeURIComponent(value);
    },
    toQueryString: function (params) {
        var results = [];
        for (var key in params) {
            var value = params[key];
            key = encodeURIComponent(key);
            
            if (typeof(value) == 'object') {
                results.push(Playdar.Util.toQueryPair(key, JSON.stringify(value)));
            } else {
                results.push(Playdar.Util.toQueryPair(key, value));
            }
        }
        return results.join('&');
    },
    
    // format secs -> mm:ss helper.
    mmss: function (secs) {
        var s = secs % 60;
        if (s < 10) {
            s = "0" + s;
        }
        return Math.floor(secs/60) + ":" + s;
    },
    
    // JSON loader
    loadJs: function (url) {
       var s = document.createElement("script");
       s.src = url;
       document.getElementsByTagName("head")[0].appendChild(s);
    },
    
    // Cookie helpers
    setCookie: function (name, value, days) {
        var expires;
        if (days) {
            var date = new Date();
            date.setTime(date.getTime() + (days*24*60*60*1000));
            expires = "; expires=" + date.toGMTString();
        } else {
            expires = "";
        }
        document.cookie = name + "=" + value + expires + "; path=/";
    },
    getCookie: function (name) {
        var namekey = name + "=";
        var cookies = document.cookie.split(';');
        for (var i = 0; i < cookies.length;i++) {
            var c = cookies[i];
            while (c.charAt(0) == ' ') {
                c = c.substring(1, c.length);
            }
            if (c.indexOf(namekey) === 0) {
                return c.substring(namekey.length, c.length);
            }
        }
        return null;
    },
    deleteCookie: function (name) {
        Playdar.Util.setCookie(name, "", -1);
    },
    
    // Window dimension/position helpers
    getWindowPosition: function () {
        var location = {};
        if (window.screenLeft) {
            location.x = window.screenLeft || 0;
            location.y = window.screenTop || 0;
        } else {
            location.x = window.screenX || 0;
            location.y = window.screenY || 0;
        }
        return location;
    },
    getWindowSize: function () {
        return {
            'w': (window && window.innerWidth) || 
                 (document && document.documentElement && document.documentElement.clientWidth) || 
                 (document && document.body && document.body.clientWidth) || 
                 0,
            'h': (window && window.innerHeight) || 
                 (document && document.documentElement && document.documentElement.clientHeight) || 
                 (document && document.body && document.body.clientHeight) || 
                 0
        };
    },
    
    getPopupOptions: function (size) {
        var popupLocation = Playdar.Util.getPopupLocation(size);
        return [
            "left=" + popupLocation.x,
            "top=" + popupLocation.y,
            "width=" + size.w,
            "height=" + size.h,
            "location=yes",
            "toolbar=no",
            "menubar=yes",
            "status=yes",
            "resizable=yes",
            "scrollbars=yes"
        ].join(',');
    },
    getPopupLocation: function (size) {
        var windowLocation = Playdar.Util.getWindowPosition();
        var windowSize = Playdar.Util.getWindowSize();
        return {
            'x': Math.max(0, windowLocation.x + (windowSize.w - size.w) / 2),
            'y': Math.max(0, windowLocation.y + (windowSize.h - size.h) / 2)
        };
    },
    
    // http://ejohn.org/blog/flexible-javascript-events
    addEvent: function (obj, type, fn) {
        if (obj.attachEvent) {
            obj['e'+type+fn] = fn;
            obj[type+fn] = function () {
                obj['e'+type+fn](window.event);
            };
            obj.attachEvent('on'+type, obj[type+fn]);
        } else {
            obj.addEventListener(type, fn, false);
        }
    },
    // Event target helper
    getTarget: function (e) {
        e = e || window.event;
        return e.target || e.srcElement;
    },
    
    extendObject: function (destination, source) {
        source = source || {};
        for (var property in source) {
            destination[property] = source[property];
        }
        return destination;
    },
    
    mergeCallbackOptions: function (callbackOptions) {
        var optionMap = {};
        var keys = [];
        var i, options, optionName;
        // Loop through an array of option objects
        for (i = 0; i < callbackOptions.length; i++) {
            options = callbackOptions[i];
            // Process callback functions in each object
            for (optionName in options) {
                if (typeof (options[optionName]) == 'function') {
                    // Collect all matching option callbacks into one callback
                    if (!optionMap[optionName]) {
                        keys.push(optionName);
                        optionMap[optionName] = [];
                    }
                    optionMap[optionName].push(options);
                }
            }
        }
        var finalOptions = {};
        // Merge the mapped callback options
        for (i = 0; i < keys.length; i++) {
            var key = keys[i];
            // Pass in the scope because closures don't really work
            // with shared variables in a loop
            finalOptions[key] = (function (key, mappedOptions) {
                return function () {
                    // Call each function that's been mapped to this property
                    for (var j = 0; j < mappedOptions.length; j++) {
                        mappedOptions[j][key].apply(this, arguments);
                    }
                };
            })(key, optionMap[key]);
        }
        return finalOptions;
    },
    
    location_from_url: function (url) {
        // Create a dummy link to split out the url parts
        var dummy = document.createElement('a');
        dummy.href = url;
        var location = {};
        // Use the window.location to extract the location keys
        for (k in window.location) {
            if ((typeof(window.location[k]) === 'string')) {
                location[k] = dummy[k];
            }
        }
        return location;
    },
    
    log: function (response) {
        if (typeof console != 'undefined') {
            console.dir(response);
        }
    }
};

// CONTENT PARSING

Playdar.Parse = {
    getProperty: function (collection, prop) {
        var prop = prop || 'innerHTML';
        var i, coll, property;
        for (i = 0; i < collection.length; i++) {
            coll = collection[i];
            property = coll[prop] || coll.getAttribute(prop);
            if (property) {
                return property;
            }
        }
        return;
    },
    getValue: function (collection) {
        var i, coll, value;
        for (i = 0; i < collection.length; i++) {
            coll = collection[i];
            value = Playdar.Util.select('.value', coll);
            if (value.length) {
                return Playdar.Parse.getContentWithoutValue(value);
            }
        }
        return;
    },
    getContentWithoutValue: function (collection) {
        return Playdar.Parse.getProperty(collection, 'content')
            || Playdar.Parse.getProperty(collection, 'title')
            || Playdar.Parse.getProperty(collection);
    },
    getContent: function (collection) {
        var content = Playdar.Parse.getValue(collection)
                   || Playdar.Parse.getContentWithoutValue(collection);
        if (content) {
            return content.replace(/(^\s*)|(\s*$)/g, '');
        }
        return;
    },
    getPosition: function (trackNode) {
        // Extract position from ordered list
        var currentNode = trackNode;
        var elderSiblings = 0;
        if (trackNode.nodeName == 'LI' && trackNode.parentNode.nodeName == 'OL') {
            // Loop back through siblings and count how many come before
            while (currentNode.previousSibling) {
                currentNode = currentNode.previousSibling;
                if (currentNode.nodeName == 'LI') {
                    elderSiblings++;
                }
            }
            return elderSiblings + 1;
        }
        return;
    },
    getNS: function (node, url) {
        for (var i = 0; i < node.attributes.length; i++) {
            var attr = node.attributes[i];
            if (attr.nodeValue == url) {
                return attr.nodeName.replace('xmlns:', '');
            }
        }
    },
    /**
     * Playdar.Parse.getExc(exclude, selector)
     * - exclude (String): CSS selector to exclude results from
     * - selector (String): CSS selector we're looking for
     * 
     * Get a pseudo-selector part that excludes from a selector any results
     * contained within the exclude selector
    **/
    getExc: function (exclude, selector) {
        return ':not(' + exclude + ' ' + selector + ')';
    },
    
    microformats: function (context) {
        var sel = Playdar.Util.select;
        function selExcRec (selector, context) {
            return sel(selector + Playdar.Parse.getExc('.item', selector), context);
        }
        
        function getBuyData (context, rec) {
            var buySel = rec ? sel : selExcRec;
            var buyURL = Playdar.Parse.getProperty(buySel('.payment', context), 'href')
                      || Playdar.Parse.getProperty(buySel('[rel~=payment]', context), 'href');
            if (!buyURL) {
                return;
            }
            return {
                url: buyURL,
                currency: Playdar.Parse.getContent(buySel('.price .currency', context)),
                amount: Playdar.Parse.getContent(buySel('.price .amount', context))
            };
        }
        function getTrackData (tracks, artist, album) {
            var data = [];
            var i, track;
            for (i = 0; i < tracks.length; i++) {
                if (!tracks[i].playdarParsed) {
                    track = {
                        title: Playdar.Parse.getContent(sel('.fn', tracks[i]))
                            || Playdar.Parse.getContent(sel('.title', tracks[i])),
                        artist: Playdar.Parse.getContent(sel('.contributor', tracks[i]))
                             || artist,
                        album: album,
                        position: Playdar.Parse.getContent(sel('.position', tracks[i]))
                               || Playdar.Parse.getPosition(tracks[i]),
                        duration: Playdar.Parse.getContent(sel('.duration', tracks[i])),
                        buy: getBuyData(tracks[i], true),
                        element: tracks[i]
                    };
                    data.push(track);
                    tracks[i].playdarParsed = true;
                }
            }
            return data;
        }
        
        function getArtist (context) {
            // Check the .contributor property for .fn or innerHTML
            var artist = selExcRec('.contributor', context);
            var artistName = Playdar.Parse.getContent(sel('.fn', artist[0]));
            if (!artistName) {
                artistName = Playdar.Parse.getContent(artist);
            }
            return artistName;
        }
        
        function getAlbums (context) {
            var data = [];
            var albums = sel('.haudio', context);
            var i, album_name, album_artist, album_tracks, album, item_artist, item_track, tracks;
            for (i = 0; i < albums.length; i++) {
                if (!albums[i].playdarParsed) {
                    album_name = Playdar.Parse.getContent(selExcRec('.album', albums[i]));
                    if (!album_name) {
                        continue;
                    }
                    album_artist = getArtist(albums[i]);
                    if (!album_artist) {
                        continue;
                    }
                    album_tracks = getTrackData(sel('.item', albums[i]), album_artist, album_name);
                    if (!album_tracks.length) {
                        continue;
                    }
                    data.push({
                        type: 'album',
                        title: album_name,
                        artist: album_artist,
                        tracks: album_tracks,
                        image: Playdar.Parse.getProperty(selExcRec('.photo', albums[i]), 'src')
                            || Playdar.Parse.getProperty(selExcRec('.photo', albums[i]), 'href'),
                        download: Playdar.Parse.getProperty(selExcRec('[rel~=enclosure]', albums[i]), 'href'),
                        released: Playdar.Parse.getContent(selExcRec('.published', albums[i])),
                        duration: Playdar.Parse.getContent(selExcRec('.duration', albums[i])),
                        buy: getBuyData(albums[i])
                    });
                    albums[i].playdarParsed = true;
                }
            }
            return data;
        }
        
        function getTrackLists (context) {
            var lists = getAlbums(context);
            var tracks = getTrackData(sel('.haudio'));
            if (tracks.length) {
                lists.push({
                    type: 'page',
                    title: window.document.title || window.location.href,
                    tracks: tracks
                });
            }
            return lists;
        }
        
        var lists = getTrackLists(context);
        return lists;
    },
    
    rdfa: function (context) {
        var sel = Playdar.Util.select;
        
        var htmlNode = sel('html')[0];
        var commerceNS = Playdar.Parse.getNS(htmlNode, 'http://purl.org/commerce#');
        var audioNS = Playdar.Parse.getNS(htmlNode, 'http://purl.org/media/audio#');
        var mediaNS = Playdar.Parse.getNS(htmlNode, 'http://purl.org/media#');
        var dcNS = Playdar.Parse.getNS(htmlNode, 'http://purl.org/dc/terms/')
                || Playdar.Parse.getNS(htmlNode, 'http://purl.org/dc/elements/1.1/');
        
        var foafNS = Playdar.Parse.getNS(htmlNode, 'http://xmlns.com/foaf/0.1/');
        var moNS = Playdar.Parse.getNS(htmlNode, 'http://purl.org/ontology/mo/');
        
        function selExcRec (selector, context) {
            var final_selector = selector;
            if (audioNS) {
                final_selector += Playdar.Parse.getExc('[typeof='+audioNS+':Recording]', selector);
            }
            if (moNS) {
                final_selector += Playdar.Parse.getExc('[typeof='+moNS+':Track]', selector);
            }
            return sel(final_selector, context);
        }
        
        if (!audioNS && !moNS) {
            return [];
        }
        
        function getBuyData (context, rec) {
            var buySel = rec ? sel : selExcRec;
            var buyURL = Playdar.Parse.getProperty(buySel('[rel~='+commerceNS+':payment]', context), 'href');
            if (!buyURL) {
                return;
            }
            return {
                url: buyURL,
                currency: Playdar.Parse.getContent(buySel('[rel~='+commerceNS+':costs] [property='+commerceNS+':currency]', context)),
                amount: Playdar.Parse.getContent(buySel('[rel~='+commerceNS+':costs] [property='+commerceNS+':amount]', context))
            };
        }
        
        function getTracks (context, artist, album) {
            var data = [];
            var selectors = [];
            if (audioNS) {
                selectors.push('[typeof='+audioNS+':Recording]');
            }
            if (moNS) {
                selectors.push('[typeof='+moNS+':Track]');
            }
            var tracks = selExcRec(selectors.join(','), context);
            var i, track;
            for (i = 0; i < tracks.length; i++) {
                if (!tracks[i].playdarParsed) {
                    track = {
                        title: Playdar.Parse.getContent(sel('[property='+dcNS+':title]', tracks[i])),
                        artist: Playdar.Parse.getContent(sel('[property='+dcNS+':creator], [rel~='+foafNS+':maker] [property='+foafNS+':name]', tracks[i]))
                             || artist,
                        album: Playdar.Parse.getContent(sel('[typeof='+moNS+':Record] [property='+dcNS+':title]'))
                            || album,
                        position: Playdar.Parse.getContent(sel('[property='+mediaNS+':position]', tracks[i]))
                               || Playdar.Parse.getPosition(tracks[i]),
                        duration: Playdar.Parse.getContent(sel('[property='+mediaNS+':duration]', tracks[i]))
                               || Playdar.Parse.getContent(sel('[property='+dcNS+':duration]', tracks[i])),
                        buy: getBuyData(tracks[i], true),
                        element: tracks[i]
                    };
                    data.push(track);
                    tracks[i].playdarParsed = true;
                }
            }
            return data;
        }
        
        function getArtist (context) {
            // Check the dc:creator property for foaf:name or innerHTML
            var artist = selExcRec('[property='+dcNS+':creator]', context);
            if (!artist.length) {
                artist = selExcRec('[rel~='+foafNS+':maker]', context);
            }
            var artistName;
            if (artist.length) {
                artistName = Playdar.Parse.getContent(sel('[property='+foafNS+':name]', artist[0]));
            }
            if (!artistName) {
                // Follow a link to a resource that describes the artist
                var artistLink = sel('[rel~='+dcNS+':creator]', context);
                var artistId = Playdar.Parse.getProperty(artistLink, 'resource');
                if (artistId) {
                    var resource = sel('[about='+artistId+']');
                    artistName = Playdar.Parse.getContent(sel('[property='+foafNS+':name]', resource[0]))
                              || Playdar.Parse.getContent(resource);
                }
            }
            if (!artistName) {
                artistName = Playdar.Parse.getContent(artist);
            }
            return artistName;
        }
        
        function getAlbums (context) {
            var data = [];
            var albums = sel('[typeof='+audioNS+':Album], [typeof='+moNS+':Record]', context);
            var i, album, album_name, album_artist, album_tracks;
            for (i = 0; i < albums.length; i++) {
                if (!albums[i].playdarParsed) {
                    album_name = Playdar.Parse.getContent(selExcRec('[property='+dcNS+':title]', albums[i]));
                    if (!album_name) {
                        continue;
                    }
                    album_artist = getArtist(albums[i]);
                    if (!album_artist) {
                        continue;
                    }
                    album_tracks = getTracks(albums[i], album_artist, album_name);
                    if (!album_tracks.length) {
                        continue;
                    }
                    data.push({
                        type: 'album',
                        title: album_name,
                        artist: album_artist,
                        tracks: album_tracks,
                        image: Playdar.Parse.getProperty(selExcRec('[rel~='+mediaNS+':depiction]', albums[i]), 'src')
                            || Playdar.Parse.getProperty(selExcRec('[rev~='+mediaNS+':depiction]', albums[i]), 'src'),
                        download: Playdar.Parse.getProperty(selExcRec('[rel~='+mediaNS+':download]', albums[i]), 'href'),
                        released: Playdar.Parse.getContent(selExcRec('[property='+dcNS+':issued]', albums[i]))
                               || Playdar.Parse.getContent(selExcRec('[property='+dcNS+':published]', albums[i]))
                               || Playdar.Parse.getContent(selExcRec('[property='+dcNS+':date]', albums[i])),
                        duration: Playdar.Parse.getContent(selExcRec('[property='+mediaNS+':duration]', albums[i]))
                               || Playdar.Parse.getContent(selExcRec('[property='+dcNS+':duration]', albums[i])),
                        buy: getBuyData(albums[i])
                    });
                    albums[i].playdarParsed = true;
                }
            }
            return data;
        }
        
        function getTrackLists (context) {
            var lists = getAlbums(context);
            var tracks = getTracks(context);
            if (tracks.length) {
                lists.push({
                    type: 'page',
                    title: window.document.title || window.location.href,
                    tracks: tracks
                });
            }
            return lists;
        }
        
        var lists = getTrackLists(context);
        return lists;
    }
};

Playdar.Util.addEvent(window, 'beforeunload', Playdar.unload);

//= require "json2.js"
//= require "sizzle.js"
