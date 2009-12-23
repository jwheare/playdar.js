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
        Playdar.Util.loadJs(this.getUrl("stat", {}, "handleStat"));
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
        if (Playdar.scrobbler) {
            // Stop scrobbling
            Playdar.scrobbler.stop(true);
        }
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
        if (!Playdar.USE_JSONP) {
            return true;
        }
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
            revoke: this.auth_token
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
        qid = qid || Playdar.Util.generate_uuid();
        var query = {
            artist: artist || '',
            album: album || '',
            track: track || '',
            qid: qid,
            results: results
        };
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
        return qid;
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
                Playdar.Util.loadJs(this.getUrl("resolve", query, "handleResolution"));
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
            return this.getResultsPoll(qid);
        }
    },
    // Start polling for results for a query id
    getResultsPoll: function (qid) {
        if (!this.pollCounts[qid]) {
            this.pollCounts[qid] = 0;
        }
        this.pollCounts[qid]++;
        Playdar.Util.loadJs(this.getUrl("get_results", {
            qid: qid,
            poll: this.pollCounts[qid]
        }, "handleResults"));
    },
    // Get long response results for a query id
    getResultsLong: function (qid) {
        Playdar.Util.loadJs(this.getUrl("get_results_long", {
            qid: qid
        }, "handleResultsLong"));
    },
    pollResults: function (response, callback, scope) {
        // figure out if we should re-poll, or if the query is solved/failed:
        var final_answer = this.shouldStopPolling(response);
        scope = scope || this;
        if (!final_answer) {
            setTimeout(function () {
                callback.call(scope, response.qid);
            }, response.poll_interval);
        }
        return final_answer;
    },
    shouldStopPolling: function (response) {
        // Stop if the server tells us to
        if (response.poll_interval <= 0) {
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
    handleResultsCallback: function (response, final_answer) {
        if (this.resultsCallbacks[response.qid]) {
            // try a custom handler registered for this query id
            this.resultsCallbacks[response.qid](response, final_answer);
        } else {
            // fall back to standard handler
            this.listeners.onResults(response, final_answer);
        }
    },
    handleResults: function (response) {
        // Check resolving hasn't been cancelled
        if (this.resolutionsInProgress.queries[response.qid]) {
            var final_answer = this.pollResults(response, this.getResults);
            // Status bar handler
            if (Playdar.statusBar) {
                Playdar.statusBar.handleResults(response, final_answer);
            }
            this.handleResultsCallback(response, final_answer);
            // Check to see if we can make some more resolve calls
            if (final_answer) {
                delete this.resolutionsInProgress.queries[response.qid];
                this.resolutionsInProgress.count--;
                this.processResolutionQueue();
            }
        }
    },
    handleResultsLong: function (response) {
        // Check resolving hasn't been cancelled
        if (this.resolutionsInProgress.queries[response.qid]) {
            // Status bar handler
            if (Playdar.statusBar) {
                Playdar.statusBar.handleResults(response, true);
            }
            if (this.resultsCallbacks[response.qid]) {
                // try a custom handler registered for this query id
                this.resultsCallbacks[response.qid](response, true);
            } else {
                // fall back to standard handler
                this.listeners.onResults(response, true);
            }
            // Check to see if we can make some more resolve calls
            delete this.resolutionsInProgress.queries[response.qid];
            this.resolutionsInProgress.count--;
            this.processResolutionQueue();
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
     * Playdar.client.getUrl(method[, query_params][, callback]) -> String | Array
     * - method (String): Method to call on the Playdar API
     * - query_params (Object): An optional object that defines extra query params
     * - callback (String): JSONP Callback name. Must be a member of Playdar.client
     * 
     * Builds an API URL from a method name, jsonp parameter and an optional object
     * of extra query parameters.
     * If USE_JSONP is false, returns an array of the URL and the callback function
    **/
    getUrl: function (method, query_params, callback) {
        query_params = query_params || {};
        query_params.call_id = new Date().getTime();
        query_params.method = method;
        this.addAuthToken(query_params);
        if (Playdar.USE_JSONP) {
            // Add the callback, as a string jsonp parameter to the URL
            callback = callback ? ("Playdar.client." + callback) : "Playdar.nop";
            query_params.jsonp = callback;
            return this.getBaseUrl("/api/", query_params);
        } else {
            // Return the callback along with the URL
            var onLoad = Playdar.nop;
            if (callback) {
                onLoad = function () {
                    Playdar.client[callback].apply(Playdar.client, arguments);
                };
            }
            return [this.getBaseUrl("/api/", query_params), onLoad];
        }
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
    }
};
