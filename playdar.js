Playdar = {
    VERSION: "0.4.1",
    SERVER_ROOT: "localhost",
    SERVER_PORT: "8888",
    STATIC_HOST: "http://www.playdar.org",
    STAT_TIMEOUT: 2000,
    AUTH_POPUP_NAME: "PD_auth",
    AUTH_POPUP_SIZE: {
        'w': 500,
        'h': 260
    },
    QUERIES_POPUP_NAME: "PD_queries",
    QUERIES_POPUP_SIZE: {
        'w': 640,
        'h': 700
    },
    MAX_CONCURRENT_RESOLUTIONS: 5,
    USE_STATUS_BAR: true,
    
    client: null,
    status_bar: null,
    player: null,
    setup: function (auth_details) {
        new Playdar.Client(auth_details);
        new Playdar.Boffin();
    },
    setup_player: function (soundmanager) {
        new Playdar.Player(soundmanager);
    }
};

Playdar.DefaultListeners = {
    onStat: function (detected) {
        if (detected) {
            // Playdar detected
        } else {
            // Playdar not found
        }
    },
    onAuth: function () {
        // Playdar authorised
    },
    onAuthClear: function () {
        // Playdar deauthorised
    },
    onResults: function (response, final_answer) {
        if (final_answer) {
            if (response.results.length) {
                // Found results
            } else {
                // No results
            }
        } else {
            // Still polling
        }
    },
    onTagCloud: function (response) {
        // Tag cloud response
    },
    onRQL: function (response) {
        // RQL playlist response
    }
};

Playdar.Client = function (auth_details, listeners) {
    Playdar.client = this;
    
    this.auth_token = false;
    this.auth_popup = null;
    
    this.listeners = {};
    this.results_handlers = {};
    
    this.resolve_qids = [];
    this.last_qid = "";
    this.poll_counts = {};
    
    /**
     * A query resolution queue consumed by process_resolution_queue, which is called
     * each time a final_answer is received from the daemon.
    **/
    this.resolution_queue = [];
    this.resolutions_in_progress = 0;
    
    // Setup auth
    this.auth_details = auth_details;
    // Setup listeners
    this.register_listeners(Playdar.DefaultListeners);
    this.register_listeners(listeners);
    
    this.uuid = Playdar.Util.generate_uuid();
};
Playdar.Client.prototype = {
    register_listener: function (event, callback) {
        callback = callback || Playdar.Util.null_callback;
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
            this.results_handlers[qid] = handler;
        } else {
            this.register_listener('onResults', handler);
        }
    },
    
    // INIT / STAT / AUTH
    
    init: function () {
        if (!this.auth_token) {
            this.auth_token = Playdar.Util.getcookie('auth');
        }
        this.stat();
    },
    
    stat: function () {
        setTimeout(function () {
            Playdar.client.check_stat_timeout();
        }, Playdar.STAT_TIMEOUT);
        Playdar.Util.loadjs(this.get_url("stat", "handle_stat"));
    },
    check_stat_timeout: function () {
        if (!this.stat_response || this.stat_response.name != "playdar") {
            this.listeners.onStat(false);
        }
    },
    handle_stat: function (response) {
        this.stat_response = response;
        // Update status bar
        if (Playdar.USE_STATUS_BAR) {
            new Playdar.StatusBar();
            Playdar.status_bar.handle_stat(response);
        }
        this.listeners.onStat(response);
        
        if (response.authenticated) {
            this.listeners.onAuth();
        } else if (this.auth_token) {
            this.clear_auth();
        }
    },
    clear_auth: function () {
        // Stop the music
        if (Playdar.player) {
            Playdar.player.stop_all();
        }
        // Revoke auth at the server
        Playdar.Util.loadjs(this.get_revoke_url());
        // Clear auth token
        this.auth_token = false;
        Playdar.Util.deletecookie('auth');
        // Callback
        this.listeners.onAuthClear();
        // Update status bar
        if (Playdar.status_bar) {
            Playdar.status_bar.offline();
        }
    },
    get_revoke_url: function () {
        return this.get_base_url("/settings/auth/", {
            revoke: this.auth_token
        });
    },
    get_auth_url: function () {
        return this.get_base_url("/auth_1/", this.auth_details);
    },
    get_auth_link_html: function (title) {
        title = title || "Connect";
        var html = '<a href="' + this.get_auth_url()
            + '" target="' + Playdar.AUTH_POPUP_NAME
            + '" onclick="Playdar.client.start_auth(); return false;'
        + '">' + title + '</a>';
        return html;
    },
    start_auth: function () {
        if (this.auth_popup === null || this.auth_popup.closed) {
            this.auth_popup = window.open(
                this.get_auth_url(),
                Playdar.AUTH_POPUP_NAME,
                Playdar.Util.get_popup_options(Playdar.AUTH_POPUP_SIZE)
            );
        } else {
            this.auth_popup.focus();
        }
        if (!this.auth_details.receiverurl) {
            // Show manual auth form
            if (Playdar.status_bar) {
                Playdar.status_bar.start_manual_auth();
            }
        }
    },
    
    auth_callback: function (token) {
        Playdar.Util.setcookie('auth', token, 365);
        if (this.auth_popup !== null && !this.auth_popup.closed) {
            this.auth_popup.close();
        }
        this.auth_token = token;
        this.stat();
    },
    manual_auth_callback: function (input_id) {
        var input = document.getElementById(input_id);
        if (input && input.value) {
            this.auth_callback(input.value);
        }
    },
    
    // CONTENT RESOLUTION
    
    resolve: function (art, alb, trk, qid) {
        var query = {
            artist: art,
            album: alb,
            track: trk
        };
        if (typeof qid !== 'undefined') {
            query.qid = qid;
        }
        // Update resolving progress status
        if (Playdar.status_bar) {
            Playdar.status_bar.increment_requests();
        }
        
        this.resolution_queue.push(query);
        this.process_resolution_queue();
    },
    process_resolution_queue: function() {
        if (this.resolutions_in_progress >= Playdar.MAX_CONCURRENT_RESOLUTIONS) {
            return false;
        }
        var available_resolution_slots = Playdar.MAX_CONCURRENT_RESOLUTIONS - this.resolutions_in_progress;
        for (var i = 1; i <= available_resolution_slots; i++) {
            var query = this.resolution_queue.shift();
            if (!query) {
                break;
            }
            this.resolutions_in_progress++;
            Playdar.Util.loadjs(this.get_url("resolve", "handle_resolution", query));
        }
    },
    handle_resolution: function (response) {
        this.last_qid = response.qid;
        this.resolve_qids.push(this.last_qid);
        this.get_results(response.qid);
    },
    
    // poll results for a query id
    get_results: function (qid) {
        if (!this.poll_counts[qid]) {
            this.poll_counts[qid] = 0;
        }
        this.poll_counts[qid]++;
        Playdar.Util.loadjs(this.get_url("get_results", "handle_results", {
            qid: qid,
            poll: this.poll_counts[qid]
        }));
    },
    poll_results: function (response, callback, context) {
        // figure out if we should re-poll, or if the query is solved/failed:
        var final_answer = this.should_stop_polling(response);
        context = context || this;
        if (!final_answer) {
            setTimeout(function () {
                callback.call(context, response.qid);
            }, response.refresh_interval);
        }
        return final_answer;
    },
    should_stop_polling: function (response) {
        // Stop if we've exceeded our refresh limit
        if (response.refresh_interval <= 0) {
            return true;
        }
        // Stop if the query is solved
        if (response.query.solved == true) {
            return true;
        }
        // Stop if we've exceeded 4 poll requests
        if (this.poll_counts[response.qid] >= 4) {
            return true;
        }
        return false;
    },
    handle_results: function (response) {
        var final_answer = this.poll_results(response, this.get_results);
        // Status bar handler
        if (Playdar.status_bar) {
            Playdar.status_bar.handle_results(response, final_answer);
        }
        // Check to see if we can make some more resolve calls
        if (final_answer) {
            this.resolutions_in_progress--;
            this.process_resolution_queue();
        }
        if (response.qid && this.results_handlers[response.qid]) {
            // try a custom handler registered for this query id
            this.results_handlers[response.qid](response, final_answer);
        } else {
            // fall back to standard handler
            this.listeners.onResults(response, final_answer);
        }
    },
    get_last_results: function () {
        if (this.last_qid) {
            if (Playdar.status_bar) {
                Playdar.status_bar.increment_requests();
            }
            this.get_results(this.last_qid);
        }
    },
    
    // UTILITY FUNCTIONS
    
    get_base_url: function (path, query_params) {
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
     * Playdar.client.get_url(method, jsonp[, options]) -> String
     * - method (String): Method to call on the Playdar API
     * - jsonp (String | Array): JSONP Callback name.
     *     If a string, will be passed to Playdar.client.jsonp_callback to build
     *     a callback of the form Playdar.client.<callback>
     *     If an array, will be joined together with dot notation.
     * - query_params (Object): An optional object that defines extra query params
    **/
    get_url: function (method, jsonp, query_params) {
        query_params = query_params || {};
        query_params.method = method;
        if (!query_params.jsonp) {
            if (jsonp.join) { // duck type check for array
                query_params.jsonp = jsonp.join('.');
            } else {
                query_params.jsonp = this.jsonp_callback(jsonp);
            }
        }
        if (this.auth_token) {
            query_params.auth = this.auth_token;
        }
        return this.get_base_url("/api/", query_params);
    },
    
    // turn a source id into a stream url
    get_stream_url: function (sid) {
        return this.get_base_url("/sid/" + sid);
    },
    
    // build the jsonp callback string
    jsonp_callback: function (callback) {
        return "Playdar.client." + callback;
    },
    
    list_results: function (response) {
        for (var i = 0; i < response.results.length; i++) {
            console.log(response.results[i].name);
        }
    }
};

Playdar.Boffin = function () {
    Playdar.boffin = this;
};
Playdar.Boffin.prototype = {
    get_url: function (method, query_params) {
        query_params = query_params || {};
        query_params.jsonp = query_params.jsonp || 'Playdar.Util.null_callback';
        return Playdar.client.get_base_url("/boffin/" + method, query_params);
    },
    get_tagcloud: function () {
        // Update resolving progress status
        if (Playdar.status_bar) {
            Playdar.status_bar.increment_requests();
        }
        Playdar.client.resolutions_in_progress++;
        Playdar.Util.loadjs(this.get_url("tagcloud", {
            jsonp: 'Playdar.boffin.handle_tagcloud'
        }));
    },
    handle_tagcloud: function (response) {
        Playdar.client.register_results_handler(Playdar.client.listeners.onTagCloud, response.qid);
        Playdar.client.get_results(response.qid);
    },
    get_tag_rql: function (tag) {
        // Update resolving progress status
        if (Playdar.status_bar) {
            Playdar.status_bar.increment_requests();
        }
        Playdar.client.resolutions_in_progress++;
        Playdar.Util.loadjs(this.get_url("rql/tag:" + tag, {
            jsonp: 'Playdar.boffin.handle_rql'
        }));
    },
    handle_rql: function (response) {
        Playdar.client.register_results_handler(Playdar.client.listeners.onRQL, response.qid);
        Playdar.client.get_results(response.qid);
    }
};

Playdar.Scrobbler = function () {
    Playdar.scrobbler = this;
};
Playdar.Scrobbler.prototype = {
    get_url: function (method, query_params) {
        query_params = query_params || {};
        query_params.jsonp = query_params.jsonp || 'Playdar.Util.null_callback';
        return Playdar.client.get_base_url("/audioscrobbler/" + method, query_params);
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
        Playdar.Util.loadjs(this.get_url("start", query_params));
    },
    stop: function () {
        Playdar.Util.loadjs(this.get_url("stop"));
    },
    pause: function () {
        Playdar.Util.loadjs(this.get_url("pause"));
    },
    resume: function () {
        Playdar.Util.loadjs(this.get_url("resume"));
    },
    get_sound_options: function (result, options) {
        var scrobbler = this;
        return {
            onplay: function () {
                scrobbler.start(result.artist, result.track, result.album, result.duration);
                Playdar.Util.apply_property_function(options, 'onplay', this, arguments);
            },
            onbufferchange: function () {
                if (this.isBuffering) {
                    scrobbler.pause();
                } else {
                    scrobbler.resume();
                }
                Playdar.Util.apply_property_function(options, 'onbufferchange', this, arguments);
            },
            onpause: function () {
                scrobbler.pause();
                Playdar.Util.apply_property_function(options, 'onpause', this, arguments);
            },
            onresume: function () {
                scrobbler.resume();
                Playdar.Util.apply_property_function(options, 'onresume', this, arguments);
            },
            onstop: function () {
                scrobbler.stop();
                Playdar.Util.apply_property_function(options, 'onstop', this, arguments);
            },
            onfinish: function () {
                scrobbler.stop();
                Playdar.Util.apply_property_function(options, 'onfinish', this, arguments);
            }
        };
    }
};

Playdar.Player = function (soundmanager) {
    Playdar.player = this;
    
    this.streams = {};
    this.nowplayingid = null;
    this.soundmanager = soundmanager;
    
    new Playdar.Scrobbler();
};
Playdar.Player.prototype = {
    register_stream: function (result, options) {
        // Register result
        this.streams[result.sid] = result;
        
        var sound_options = Playdar.Util.extend_object({
            id: result.sid,
            url: Playdar.client.get_stream_url(result.sid)
        }, options);
        
        // Wrap sound progress callbacks with status bar
        if (Playdar.status_bar) {
            Playdar.Util.extend_object(sound_options, Playdar.status_bar.get_sound_options(result, options));
        }
        // Wrap sound lifecycle callbacks in scrobbling calls
        if (Playdar.scrobbler) {
            Playdar.Util.extend_object(sound_options, Playdar.scrobbler.get_sound_options(result, options));
        }
        return this.soundmanager.createSound(sound_options);
    },
    play_stream: function (sid) {
        var sound = this.soundmanager.getSoundById(sid);
        if (this.nowplayingid != sid) {
            this.stop_all();
            if (sound.playState == 0) {
                this.nowplayingid = sid;
                // Update status bar
                if (Playdar.status_bar) {
                    Playdar.status_bar.play_handler(this.streams[sid]);
                }
            }
        }
        
        sound.togglePause();
        return sound;
    },
    stop_all: function () {
        if (this.nowplayingid) {
            var sound = this.soundmanager.getSoundById(this.nowplayingid);
            sound.stop();
            sound.setPosition(1);
            this.nowplayingid = null;
        }
        // Update status bar
        if (Playdar.status_bar) {
            Playdar.status_bar.stop_handler();
        }
    },
    toggle_nowplaying: function () {
        if (this.nowplayingid) {
            this.play_stream(this.nowplayingid);
        }
    }
};

Playdar.StatusBar = function () {
    Playdar.status_bar = this;
    
    this.queries_popup = null;
    
    this.progress_bar_width = 200;
    
    this.request_count = 0;
    this.pending_count = 0;
    this.success_count = 0;
    
    this.query_list_link = null;
    this.nowplaying_query_button = null;
    
    this.build();
};
Playdar.StatusBar.prototype = {
    build: function () {
        /* Status bar
           ---------- */
        var status_bar = document.createElement("div");
        status_bar.style.position = 'fixed';
        status_bar.style.bottom = 0;
        status_bar.style.left = 0;
        status_bar.style.zIndex = 100;
        status_bar.style.width = '100%';
        status_bar.style.height = '36px';
        status_bar.style.padding = '7px 0';
        status_bar.style.borderTop = '2px solid #4c7a0f';
        status_bar.style.font = 'normal 13px/18px "Calibri", "Lucida Grande", sans-serif';
        status_bar.style.color = "#335507";
        status_bar.style.background = '#e8f9bb';
        
        /* Left column
           ----------- */
        var left_col = document.createElement("div");
        left_col.style.padding = "0 7px";
        // Logo
        var logo = '<img src="' + Playdar.STATIC_HOST + '/static/playdar_logo_32x32.png" width="32" height="32" style="vertical-align: middle; float: left; margin: 0 10px 0 0; border: 0; line-height: 36px;" />';
        left_col.innerHTML = logo;
        
        // - Status message
        this.status = document.createElement("p");
        this.status.style.margin = "0";
        this.status.style.padding = "0 8px";
        this.status.style.lineHeight = "36px";
        this.status.style.fontSize = "15px";
        left_col.appendChild(this.status);
        
        // - Playback
        this.playback = document.createElement("div");
        this.playback.style.padding = "0 7px";
        this.playback.style.display = "none";
        // - Now playing track
        var track_title = document.createElement("p");
        track_title.style.margin = "0";
        this.track_link = document.createElement("a");
        this.track_link.style.textDecoration = "none";
        
        this.artist_name = document.createElement("span");
        this.artist_name.style.textTransform = "uppercase";
        this.artist_name.style.color = "#4c7a0f";
        
        this.track_name = document.createElement("strong");
        this.track_name.style.margin = "0 0 0 10px";
        this.track_name.style.color = "#335507";
        
        this.track_link.appendChild(this.artist_name);
        this.track_link.appendChild(this.track_name);
        track_title.appendChild(this.track_link);
        this.playback.appendChild(track_title);
        
        // Playback Progress table
        var progress_table = document.createElement("table");
        progress_table.setAttribute('cellpadding', 0);
        progress_table.setAttribute('cellspacing', 0);
        progress_table.setAttribute('border', 0);
        progress_table.style.color = "#4c7a0f";
        progress_table.style.font = 'normal 10px/16px "Verdana", sans-serif';
        var progress_tbody = document.createElement("tbody");
        var progress_row = document.createElement("tr");
        // L: - Time elapsed
        this.track_elapsed = document.createElement("td");
        this.track_elapsed.style.verticalAlign = "middle";
        progress_row.appendChild(this.track_elapsed);
        // M: Bar column
        var progress_cell = document.createElement("td");
        progress_cell.style.padding = "0 5px";
        progress_cell.style.verticalAlign = "middle";
        // Bar container
        var progress_bar = document.createElement("div");
        progress_bar.style.width = this.progress_bar_width + "px";
        progress_bar.style.height = "9px";
        progress_bar.style.border = "1px solid #4c7a0f";
        progress_bar.style.background = "#fff";
        progress_bar.style.position = "relative";
        // - Buffer progress
        this.bufferhead = document.createElement("div");
        this.bufferhead.style.position = "absolute";
        this.bufferhead.style.width = 0;
        this.bufferhead.style.height = "9px";
        this.bufferhead.style.background = "#d2f380";
        progress_bar.appendChild(this.bufferhead);
        // - Playback progress
        this.playhead = document.createElement("div");
        this.playhead.style.position = "absolute";
        this.playhead.style.width = 0;
        this.playhead.style.height = "9px";
        this.playhead.style.background = "#6ea31e";
        progress_bar.appendChild(this.playhead);
        // Click to toggle pause
        progress_bar.onclick = function () {
            Playdar.player.toggle_nowplaying();
        };
        progress_cell.appendChild(progress_bar);
        progress_row.appendChild(progress_cell);
        // R: - Track duration
        this.track_duration = document.createElement("td");
        this.track_duration.style.verticalAlign = "middle";
        progress_row.appendChild(this.track_duration);
        
        progress_tbody.appendChild(progress_row);
        progress_table.appendChild(progress_tbody);
        this.playback.appendChild(progress_table);
        
        left_col.appendChild(this.playback);
        
        /* Right column
           ------------ */
        right_col = document.createElement("div");
        right_col.style.cssFloat = "right";
        right_col.style.padding = "0 8px";
        right_col.style.textAlign = "right";
        // Settings link
        var settings_link = document.createElement("p");
        settings_link.style.margin = 0;
        settings_link.innerHTML = '<a href="' + Playdar.client.get_base_url() + '" target="_blank">Settings</a>';
        right_col.appendChild(settings_link);
        // - Disconnect link
        this.playdar_links = document.createElement("p");
        this.playdar_links.style.margin = 0;
        
        this.playdar_links.innerHTML = '<a href="' +  this.get_queries_popup_url()
                + '" target="' + Playdar.QUERIES_POPUP_NAME
                + '" onclick="Playdar.status_bar.open_queries_popup(); return false;'
            + '">Tracks</a>'
            + ' | '
            + '<a href="#" onclick="Playdar.client.clear_auth(); return false;">Disconnect</a>';
        right_col.appendChild(this.playdar_links);
        
        // - Query count
        this.query_count = document.createElement("span");
        this.query_count.style.margin = "0 5px 0 5px";
        this.query_count.style.fontSize = "11px";
        this.query_count.style.fontWeight = "normal";
        this.query_count.style.color = "#6ea31e";
        this.playdar_links.insertBefore(this.query_count, this.playdar_links.firstChild);
        
        /* Build status bar
           --------------- */
        status_bar.appendChild(right_col);
        status_bar.appendChild(left_col);
        
        /* Build status bar */
        document.body.appendChild(status_bar);
        
        // Adjust the page bottom margin to fit status bar
        var marginBottom = document.body.style.marginBottom;
        if (!marginBottom) {
            var css = document.defaultView.getComputedStyle(document.body, null);
            if (css) {
                marginBottom = css.marginBottom;
            }
        }
        document.body.style.marginBottom = (marginBottom.replace('px', '') - 0) + 36 + (7*2) + 2 + 'px';
        
        return status_bar;
    },
    
    ready: function () {
        this.playdar_links.style.display = "";
        var message = "Ready";
        this.status.innerHTML = message;
    },
    offline: function () {
        this.playdar_links.style.display = "none";
        var message = Playdar.client.get_auth_link_html();
        this.status.innerHTML = message;
    },
    start_manual_auth: function () {
        this.playdar_links.style.display = "none";
        var input_id = "manualAuth_" + Playdar.client.uuid;
        var message = '<input type="text" id="' + input_id + '" />'
            + ' <input type="submit" value="Allow access to Playdar"'
                + ' onclick="Playdar.client.manual_auth_callback(\'' + input_id + '\'); return false;'
            + '" />';
        this.status.innerHTML = message;
    },
    
    handle_stat: function (response) {
        if (response.authenticated) {
            this.ready();
        } else {
            this.offline();
        }
    },
    
    get_queries_popup_url: function () {
        return Playdar.STATIC_HOST + '/demos/tracks.html';
    },
    open_queries_popup: function () {
        if (this.queries_popup === null || this.queries_popup.closed) {
            this.queries_popup = window.open(
                this.get_queries_popup_url(),
                Playdar.QUERIES_POPUP_NAME,
                Playdar.Util.get_popup_options(Playdar.QUERIES_POPUP_SIZE)
            );
        } else {
            this.queries_popup.focus();
        }
    },
    
    show_resolution_status: function () {
        if (this.query_count) {
            var status = " ";
            if (this.pending_count) {
                status += this.pending_count + ' <img src="' + Playdar.STATIC_HOST + '/static/track_throbber.gif" width="16" height="16" style="vertical-align: middle; margin: -2px 2px 0 2px"/> ';
            }
            status += " " + this.success_count + "/" + this.request_count;
            this.query_count.innerHTML = status;
        }
    },
    handle_results: function (response, final_answer) {
        if (final_answer) {
            this.pending_count--;
            if (response.results.length) {
                this.success_count++;
            }
        }
        this.show_resolution_status();
    },
    increment_requests: function () {
        this.request_count++;
        this.pending_count++;
        this.show_resolution_status();
    },
    
    get_sound_options: function (result, options) {
        return {
            whileplaying: function () {
                Playdar.status_bar.playing_handler(this);
                Playdar.Util.apply_property_function(options, 'whileplaying', this, arguments);
            },
            whileloading: function () {
                Playdar.status_bar.loading_handler(this);
                Playdar.Util.apply_property_function(options, 'whileloading', this, arguments);
            }
        };
    },
    
    play_handler: function (stream) {
        // Initialise the track progress
        this.track_elapsed.innerHTML = Playdar.Util.mmss(0);
        // Update the track link
        this.track_link.href = Playdar.client.get_stream_url(stream.sid);
        this.track_link.title = stream.source;
        this.track_name.innerHTML = stream.track;
        this.artist_name.innerHTML = stream.artist;
        // Update the track duration
        this.track_duration.innerHTML = Playdar.Util.mmss(stream.duration);
        // Show progress bar
        this.status.style.display = "none";
        this.playback.style.display = "";
    },
    playing_handler: function (sound) {
        // Update the track progress
        this.track_elapsed.innerHTML = Playdar.Util.mmss(Math.round(sound.position/1000));
        // Update the playback progress bar
        var duration;
        if (sound.readyState == 3) { // loaded/success
            duration = sound.duration;
        } else {
            duration = sound.durationEstimate;
        }
        var portion_played = sound.position / duration;
        this.playhead.style.width = Math.round(portion_played * this.progress_bar_width) + "px";
    },
    loading_handler: function (sound) {
        // Update the loading progress bar
        var buffered = sound.bytesLoaded/sound.bytesTotal;
        this.bufferhead.style.width = Math.round(buffered * this.progress_bar_width) + "px";
    },
    stop_handler: function () {
        this.playback.style.display = "none";
        this.status.style.display = "";
        
        this.track_link.href = "#";
        this.track_link.title = "";
        this.track_name.innerHTML = "";
        this.artist_name.innerHTML = "";
        
        this.bufferhead.style.width = 0;
        this.playhead.style.width = 0;
    }
};

Playdar.Util = {
    /*
    Based on: Math.uuid.js
    Version: 1.3
    Latest version:   http://www.broofa.com/Tools/Math.uuid.js
    Information:      http://www.broofa.com/blog/?p=151
    Contact:          robert@broofa.com
    ----
    Copyright (c) 2008, Robert Kieffer
    All rights reserved.
    
    Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
    
        * Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
        * Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
        * Neither the name of Robert Kieffer nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
    
    THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
    */
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
            var values = params[key];
            key = encodeURIComponent(key);
            
            if (Object.prototype.toString.call(values) == '[object Array]') {
                for (var i = 0; i < values.length; i++) {
                    results.push(Playdar.Util.toQueryPair(key, values[i]));
                }
            } else {
                results.push(Playdar.Util.toQueryPair(key, values));
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
    loadjs: function (url) {
       var s = document.createElement("script");
       s.src = url;
       document.getElementsByTagName("head")[0].appendChild(s);
    },
    
    // Cookie helpers
    setcookie: function (name, value, days) {
        if (days) {
            var date = new Date();
            date.setTime(date.getTime() + (days*24*60*60*1000));
            var expires = "; expires=" + date.toGMTString();
        } else {
            var expires = "";
        }
        document.cookie = "PD_" + name + "=" + value + expires + "; path=/";
    },
    getcookie: function (name) {
        var namekey = "PD_" + name + "=";
        var cookies = document.cookie.split(';');
        for (var i = 0; i < cookies.length;i++) {
            var c = cookies[i];
            while (c.charAt(0) == ' ') {
                c = c.substring(1, c.length);
            }
            if (c.indexOf(namekey) == 0) {
                return c.substring(namekey.length, c.length);
            }
        }
        return null;
    },
    deletecookie: function (name) {
        Playdar.Util.setcookie(name, "", -1);
    },
    
    // Window dimension/position helpers
    get_window_position: function () {
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
    get_window_size: function () {
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
    
    get_popup_options: function (size) {
        var popup_location = Playdar.Util.get_popup_location(size);
        return [
            "left=" + popup_location.x,
            "top=" + popup_location.y,
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
    get_popup_location: function (size) {
        var window_location = Playdar.Util.get_window_position();
        var window_size = Playdar.Util.get_window_size();
        return {
            'x': Math.max(0, window_location.x + (window_size.w - size.w) / 2),
            'y': Math.max(0, window_location.y + (window_size.h - size.h) / 2)
        };
    },
    
    // Event target helper
    getTarget: function (e) {
        e = e || window.event;
        return e.target || e.srcElement;
    },
    
    extend_object: function (destination, source) {
        source = source || {};
        for (var property in source) {
            destination[property] = source[property];
        }
        return destination;
    },
    
    apply_property_function: function (obj, property, scope, args) {
        if (obj && obj[property]) {
            obj[property].apply(scope, args);
        }
    },
    
    log: function (response) {
        if (typeof console != 'undefined') {
            console.dir(response);
        }
    },
    null_callback: function () {}
};
