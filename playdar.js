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
    MAX_CONCURRENT_RESOLUTIONS: 50,
    USE_STATUS_BAR: true,
    
    client: null,
    status_bar: null,
    player: null,
    setup: function (auth_details) {
        Playdar.client = new Playdar.Client(auth_details);
    },
    setup_player: function (soundmanager) {
        Playdar.player = new Playdar.Player(soundmanager);
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
    }
};

Playdar.Client = function (auth_details, listeners) {
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
        if (!callback) {
            var callback = function () {};
        }
        this.listeners[event] = function () { return callback.apply(Playdar.client, arguments); };
    },
    register_listeners: function (listeners) {
        if (!listeners) {
            return;
        }
        for (event in listeners) {
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
            Playdar.status_bar = new Playdar.StatusBar();
            if (this.auth_token) {
                Playdar.status_bar.ready();
                Playdar.status_bar.load_tracks();
            } else {
                Playdar.status_bar.offline();
            }
        }
        this.listeners.onStat(true);
        
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
        return this.get_base_url("/auth/", {
            revoke: this.auth_token
        });
    },
    get_auth_url: function () {
        return this.get_base_url("/auth_1/", this.auth_details);
    },
    start_auth: function () {
        if (this.auth_popup === null || this.auth_popup.closed) {
            this.auth_popup = window.open(
                this.get_auth_url(),
                Playdar.AUTH_POPUP_NAME,
                this.get_auth_popup_options()
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
    get_auth_popup_options: function () {
        var popup_location = this.get_auth_popup_location();
        return [
            "left=" + popup_location.x,
            "top=" + popup_location.y,
            "width=" + Playdar.AUTH_POPUP_SIZE.w,
            "height=" + Playdar.AUTH_POPUP_SIZE.h,
            "location=yes",
            "toolbar=no",
            "menubar=yes",
            "status=yes",
            "resizable=yes",
            "scrollbars=yes"
        ].join(',');
    },
    get_auth_popup_location: function () {
        var window_location = Playdar.Util.get_window_position();
        var window_size = Playdar.Util.get_window_size();
        return {
            'x': Math.max(0, window_location.x + (window_size.w - Playdar.AUTH_POPUP_SIZE.w) / 2),
            'y': Math.max(0, window_location.y + (window_size.h - Playdar.AUTH_POPUP_SIZE.h) / 2)
        };
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
        Playdar.Util.loadjs(this.get_url("get_results", "handle_results", {
            qid: qid
        }));
    },
    poll_results: function (response, callback, context) {
        // figure out if we should re-poll, or if the query is solved/failed:
        var final_answer = this.should_stop_polling(response);
        if (!context) {
            context = this;
        }
        if (!final_answer) {
            setTimeout(function () {
                callback.call(context, response.qid);
            }, response.refresh_interval);
        }
        return final_answer;
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
    should_stop_polling: function (response) {
        // Stop if we've exceeded our refresh limit
        if (response.refresh_interval <= 0) {
            return true;
        }
        // Stop if the query is solved
        if (response.query.solved == true) {
            return true;
        }
        // Stop if we've got a perfect match
        if (response.results.length && response.results[0].score == 1.0) {
            return true;
        }
        // Stop if we've exceeded 4 poll requests
        if (!this.poll_counts[response.qid]) {
            this.poll_counts[response.qid] = 0;
        }
        if (++this.poll_counts[response.qid] >= 4) {
            return true;
        }
        return false;
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
        if (!query_params) {
            query_params = {};
        }
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

Playdar.Scrobbler = function () {
};
Playdar.Scrobbler.prototype = {
    get_url: function (method, query_params) {
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
    }
};

Playdar.Player = function (soundmanager) {
    this.streams = {};
    this.nowplayingid = null;
    this.soundmanager = soundmanager;
    this.scrobbler = new Playdar.Scrobbler();
};
Playdar.Player.prototype = {
    register_stream: function (result, options) {
        // Register result
        this.streams[result.sid] = result;
        
        var sound_options = {};
        if (options) {
            for (k in options) {
                sound_options[k] = options[k];
            }
        }
        sound_options.id = result.sid;
        sound_options.url = Playdar.client.get_stream_url(result.sid);
        // Playback progress in status bar
        if (Playdar.status_bar) {
            sound_options.whileplaying = function () {
                Playdar.status_bar.playing_handler(this);
                if (options && options.whileplaying) {
                    options.whileplaying.apply(this, arguments);
                }
            };
            sound_options.whileloading = function () {
                Playdar.status_bar.loading_handler(this);
                if (options && options.whileloading) {
                    options.whileloading.apply(this, arguments);
                }
            };
        }
        // Wrap sound lifecycle callbacks in scrobbling calls
        if (this.scrobbler) {
            var scrobbler = this.scrobbler;
            sound_options.onplay = function () {
                scrobbler.start(result.artist, result.track, result.album, result.duration);
                if (options && options.onplay) {
                    options.onplay.apply(this, arguments);
                }
            };
            sound_options.onpause = function () {
                scrobbler.pause();
                if (options && options.onpause) {
                    options.onpause.apply(this, arguments);
                }
            };
            sound_options.onresume = function () {
                scrobbler.resume();
                if (options && options.onresume) {
                    options.onresume.apply(this, arguments);
                }
            };
            sound_options.onstop = function () {
                scrobbler.stop();
                if (options && options.onstop) {
                    options.onstop.apply(this, arguments);
                }
            };
            sound_options.onfinish = function () {
                scrobbler.stop();
                if (options && options.onfinish) {
                    options.onfinish.apply(this, arguments);
                }
            };
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
        this.disconnect_link = document.createElement("p");
        this.disconnect_link.style.margin = 0;
        this.disconnect_link.innerHTML = '<a href="#" onclick="'
            + Playdar.client.jsonp_callback('clear_auth') + '();'
            + 'return false;'
            + '">Disconnect</a>';
        right_col.appendChild(this.disconnect_link);
        
        /* Build status bar
           --------------- */
        status_bar.appendChild(right_col);
        status_bar.appendChild(left_col);
        
        /* Track list
           ---------- */
        // - Track list container
        this.track_list_container = document.createElement("div");
        this.track_list_container.style.position = "fixed";
        this.track_list_container.style.bottom = 0;
        this.track_list_container.style.left = 0;
        this.track_list_container.style.zIndex = 100;
        this.track_list_container.style.marginBottom = 36 + (7*2) + "px";
        this.track_list_container.style.font = 'normal 13px/18px "Calibri", "Lucida Grande", sans-serif';
        this.track_list_container.style.color = "#fff";
        // - Track list head
        var track_list_head = document.createElement("h2");
        track_list_head.style.cssFloat = "left";
        track_list_head.style.margin = "0 0 -1px 0";
        track_list_head.style.padding = "5px 7px";
        track_list_head.style.border = "1px solid #3f7d31";
        track_list_head.style.borderWidth = "1px 1px 1px 0";
        track_list_head.style.borderBottomColor = "#669a28";
        track_list_head.style.fontSize = "15px";
        track_list_head.style.background = "#669a28";
        track_list_head.style.color = "#fff";
        track_list_head.innerHTML = "Tracks";
        // - Query count
        this.query_count = document.createElement("span");
        this.query_count.style.margin = "0 0 0 5px";
        this.query_count.style.fontSize = "11px";
        this.query_count.style.fontWeight = "normal";
        this.query_count.style.color = "#cbdab1";
        track_list_head.appendChild(this.query_count);
        // - Toggle track list body
        track_list_head.onclick = function () {
            var hidden = (Playdar.status_bar.track_list_body.style.display == "none");
            Playdar.status_bar.track_list_body.style.display = hidden ? "" : "none";
        };
        this.track_list_container.appendChild(track_list_head);
        
        // var playlist_head = track_list_head.cloneNode(false);
        // playlist_head.style.background = "#3f7d31";
        // playlist_head.innerHTML = "Playlist";
        // this.track_list_container.appendChild(playlist_head);
        
        // - Track list body
        this.track_list_body = document.createElement("div");
        this.track_list_body.style.clear = "left";
        this.track_list_body.style.display = "none";
        this.track_list_body.style.width = "300px";
        this.track_list_body.style.height = "300px";
        this.track_list_body.style.overflowY = "auto";
        this.track_list_body.style.overflowX = "hidden";
        this.track_list_body.style.whiteSpace = "nowrap";
        this.track_list_body.style.padding = 0;
        this.track_list_body.style.border = "1px solid #3f7d31";
        this.track_list_body.style.borderWidth = "1px 1px 0 0";
        this.track_list_body.style.background = "#669a28";
        // - Track list
        this.track_list = document.createElement("ul");
        this.track_list.style.margin = 0;
        this.track_list.style.padding = 0;
        // - Session track list
        this.session_track_list = this.track_list.cloneNode(false);
        this.session_track_list.style.paddingBottom = "7px";
        this.session_track_list.style.borderBottom = "1px solid #3f7d31";
        this.session_track_list.style.display = "none";
        // - Toggle query results
        this.track_list_body.onclick = function (e) {
            return Playdar.status_bar.querylist_click_handler.call(Playdar.status_bar, e);
        };
        
        this.track_list_body.appendChild(this.session_track_list);
        this.track_list_body.appendChild(this.track_list);
        
        this.track_list_container.appendChild(this.track_list_body);
        
        /* Build status bar */
        document.body.appendChild(this.track_list_container);
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
        this.disconnect_link.style.display = "";
        this.track_list_container.style.display = "";
        var message = "Ready";
        this.status.innerHTML = message;
        
    },
    offline: function () {
        this.disconnect_link.style.display = "none";
        this.track_list_container.style.display = "none";
        var message = '<a href="' + Playdar.client.get_auth_url()
                + '" target="' + Playdar.AUTH_POPUP_NAME
                + '" onclick="'
                + Playdar.client.jsonp_callback('start_auth') + '();'
                + 'return false;'
            + '">Connect</a>';
        this.status.innerHTML = message;
    },
    start_manual_auth: function () {
        this.disconnect_link.style.display = "none";
        this.track_list_container.style.display = "none";
        var input_id = "manualAuth_" + Playdar.client.uuid;
        var message = '<input type="text" id="' + input_id + '" />'
            + ' <input type="submit" value="Allow access to Playdar" onclick="'
                + Playdar.client.jsonp_callback('manual_auth_callback') + '(\'' + input_id + '\');'
                + 'return false;'
            + '" />';
        this.status.innerHTML = message;
    },
    
    load_tracks: function () {
        Playdar.Util.loadjs(Playdar.client.get_url(
            "list_queries",
            ["Playdar.status_bar", "handle_queries"]
        ));
    },
    handle_queries: function (response) {
        var list_items = "";
        for (var i = 0; i < response.queries.length; i++) {
            var li = Playdar.status_bar.build_track_list_item(response.queries[i]);
            list_items += li;
        }
        Playdar.status_bar.track_list.innerHTML = list_items;
    },
    
    handle_results: function (response, final_answer) {
        if (final_answer) {
            this.pending_count--;
            if (response.results.length) {
                this.success_count++;
            }
            list_item = this.build_track_list_item(response);
            this.session_track_list.innerHTML = list_item + this.session_track_list.innerHTML;
            this.session_track_list.style.display = "";
        }
        this.show_resolution_status();
    },
    
    build_track_list_item: function (response) {
        var color = response.query.solved ? 'fff' : 'cbdab1';
        var num_results = (response.results && response.results.length) || response.num_results;
        var track = response.query.artist + ' - ' + response.query.track;
        if (!num_results) {
            track = "<s>" + track + "</s>";
        }
        var li = '<li style="'
                + 'margin: 4px 0 0 0;'
                + 'padding: 4px 0 0 0;'
                + 'line-height: 11px;'
            + '">'
                + '<span style="padding: 0 7px">+</span>'
                + '<span style="padding: 0 7px 0 0">▸</span>'
                + '<a href="' + Playdar.client.get_base_url("/queries/" + response.query.qid) + '" style="'
                    + 'padding: 0 7px 0 0;'
                    + 'text-decoration: none;'
                    + 'color: #' + color + ';'
                + '" class="playdar_query">'
                    + track
                + '</a>'
                + '<div style="display: none; margin-top: 5px; padding: 5px; border: 1px solid #3f7d31; border-width: 1px 0; background: #cbdab1; color: #3E6206;"></div>'
            + '</li>';
        return li;
    },
    
    show_resolution_status: function () {
        if (this.query_count) {
            var status = " " + this.success_count + "/" + this.request_count;
            if (this.pending_count) {
                status += ' <img src="' + Playdar.STATIC_HOST + '/static/track_throbber.gif" width="16" height="16" style="vertical-align: middle; margin: -2px 2px 0 2px"/> ' + this.pending_count;
            }
            this.query_count.innerHTML = status;
        }
    },
    increment_requests: function () {
        this.request_count++;
        this.pending_count++;
        this.show_resolution_status();
    },
    
    querylist_click_handler: function (e) {
        var target = Playdar.Util.getTarget(e);
        while (target && target.parentNode) {
            if (target.nodeName == 'A' && target.className == 'playdar_query') {
                if (target.nextSibling.style.display == "none") {
                    this.expand_querylist_result(target);
                } else {
                    this.query_list_link = target;
                    this.hide_querylist_results();
                }
                return false;
            } else if (target.nodeName == 'TR' && target.className.indexOf('sid_') == 0) {
                var sid = target.className.replace('sid_', '');
                if (this.nowplaying_query_button) {
                    this.nowplaying_query_button.style.visibility = 'hidden';
                }
                // Find: tr td.playdar_play span
                if (target.firstChild.className == 'playdar_play') {
                    this.nowplaying_query_button = target.firstChild.firstChild;
                } else {
                    this.nowplaying_query_button = target.previousSibling.firstChild.firstChild;
                }
                this.nowplaying_query_button.style.visibility = 'visible';
                Playdar.player.play_stream(sid);
            }
            target = target.parentNode;
        }
    },
    expand_querylist_result: function (target) {
        this.hide_querylist_results();
        this.query_list_link = target;
        var url_root = Playdar.client.get_base_url("/queries/");
        var qid = target.href.replace(url_root, '');
        if (qid) {
            this.get_querylist_results(qid);
        }
    },
    hide_querylist_results: function () {
        if (this.query_list_link) {
            this.query_list_link.parentNode.style.background = "none";
            this.query_list_link.nextSibling.style.display = "none";
            this.query_list_link = null;
        }
    },
    get_querylist_results: function (qid) {
        Playdar.Util.loadjs(Playdar.client.get_url(
            'get_results',
            ['Playdar.status_bar', 'show_querylist_results'],
            {
                qid: qid
            }
        ));
    },
    show_querylist_results: function (response) {
        if (this.query_list_link) {
            var final_answer = Playdar.client.poll_results(response, this.get_querylist_results, this);
            var querylist_results = this.query_list_link.nextSibling;
            if (final_answer) {
                if (response.results.length) {
                    var result_table = '<table cellpadding="0" cellspacing="0" border="0" style="'
                            + 'width: 275px;'
                        + '">';
                    for (var i = 0; i < response.results.length; i++) {
                        result_table += this.build_querylist_result_table(response.results[i], i);
                    }
                    result_table += '</table>';
                    querylist_results.innerHTML = result_table;
                    
                    // Show correct play button
                    if (Playdar.player.nowplayingid) {
                        var cells = querylist_results.getElementsByTagName('td');
                        for (var i = 0; i < cells.length; i++) {
                            var cell = cells[i];
                            if (cell.className == 'playdar_play') {
                                var sid = cell.parentNode.className.replace('sid_', '');
                                if (Playdar.player.nowplayingid == sid) {
                                    this.nowplaying_query_button = cell.firstChild;
                                    this.nowplaying_query_button.style.visibility = 'visible';
                                }
                            }
                        }
                    }
                } else {
                    querylist_results.innerHTML = "No results";
                }
            } else {
                querylist_results.innerHTML = "Checking results...";
            }
            
            this.query_list_link.parentNode.style.background = "#55851a";
            querylist_results.style.display = "";
        }
    },
    build_querylist_result_table: function (result, i) {
        var sound = Playdar.player.register_stream(result);
        var row_tag_contents = ' class="sid_' + result.sid + '"';
        var border = '';
        if (i > 0) {
            border = 'border-top: 1px solid #bbcaa1;';
        }
        var score = '';
        if (result.score < 1) {
            row_tag_contents = row_tag_contents + ' style="color: #5D8A0E;"';
            score = result.score.toFixed(1);
        }
        var row = '<tr' + row_tag_contents + '>'
                + '<td class="playdar_play" style="'
                    + 'width: 12px;'
                    + 'text-align: right;'
                    + 'padding: 5px;'
                    + border
                + '">'
                    + '<span style="visibility: hidden;">'
                        + '▸'
                    + '</span>'
                + '</td>'
                + '<td colspan="3" style="padding: 5px 3px;' + border + '">'
                    + result.artist + ' - ' + result.track
                + '</td>'
            + '</tr>'
            + '<tr' + row_tag_contents + '>'
                + '<td style=" padding: 0 2px 7px 2px; text-align: right;">' + score + '</td>'
                + '<td style="width: 100px; padding: 0 3px 7px 3px;">' + result.source + '</td>'
                + '<td style="width: 35px; padding: 0 0 7px 0">' + Playdar.Util.mmss(result.duration) + '</td>'
                + '<td style="width: 50px; padding: 0 0 7px 0; text-align: right;">' + result.bitrate + 'Kbps</td>'
            + '</tr>';
        return row;
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
        for (key in params) {
            var values = params[key];
            key = encodeURIComponent(key);
            
            if (Object.prototype.toString.call(values) == '[object Array]') {
                for (i = 0; i < values.length; i++) {
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
    
    // Event target helper
    getTarget: function (e) {
        e = e || window.event;
        return e.target || e.srcElement;
    }
};
