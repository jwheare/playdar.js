Playdar = function (auth_details, handlers) {
    // Setup auth
    this.auth_details = auth_details;
    // Setup handlers
    this.register_handlers(Playdar.DefaultHandlers);
    this.register_handlers(handlers);
    // Register the instance
    this.uuid = Playdar.generate_uuid();
    Playdar.last = this;
    Playdar.instances[this.uuid] = Playdar.last;
};

Playdar.last = null;
Playdar.instances = {};
Playdar.create = function (auth_details, handlers) {
    return new Playdar(auth_details, handlers);
};

Playdar.status_bar = null;

Playdar.DefaultHandlers = {
    auth: function () {
        // Playdar authorised
    },
    clear_auth: function () {
        // Playdar deauthorised
    },
    stat: function (detected) {
        if (detected) {
            // Playdar detected
        } else {
            // Playdar not found
        }
    },
    results: function (response, final_answer) {
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

Playdar.prototype = {
    auth_details: null,
    lib_version: "0.3.5",
    server_root: "localhost",
    server_port: "8888",
    stat_timeout: 2000,
    web_host: "http://www.playdar.org",
    progress_bar_width: 200,
    auth_popup_name: "PD_auth",
    auth_popup_size: {
        'w': 500,
        'h': 260
    },
    
    handlers: {},
    register_handler: function (handler_name, callback) {
        if (!callback) {
            var callback = function () {};
        }
        var that = this;
        this.handlers[handler_name] = function () { return callback.apply(that, arguments); };
    },
    register_handlers: function (handlers) {
        if (!handlers) {
            return;
        }
        for (handler in handlers) {
            this.register_handler(handler, handlers[handler]);
        }
        return true;
    },
    // Custom search result handlers can be bound to a specific qid
    results_handlers: {},
    register_results_handler: function (handler, qid) {
        if (qid) {
            this.results_handlers[qid] = handler;
        } else {
            this.register_handler('results', handler);
        }
    },
    
    // INIT / STAT / AUTH
    
    auth_token: false,
    init: function () {
        if (!this.auth_token) {
            this.auth_token = Playdar.getcookie('auth');
        }
        this.stat();
    },
    
    stat_response: false,
    stat: function () {
        var that = this;
        setTimeout(function () {
            that.check_stat_timeout();
        }, this.stat_timeout);
        Playdar.loadjs(this.get_url("stat", "handle_stat"));
    },
    check_stat_timeout: function () {
        if (!this.stat_response || this.stat_response.name != "playdar") {
            this.handlers.stat(false);
        }
    },
    handle_stat: function (response) {
        this.stat_response = response;
        this.update_status_bar();
        this.handlers.stat(true);
        
        if (response.authenticated) {
            this.handlers.auth();
        } else if (this.auth_token) {
            this.clear_auth();
        }
    },
    clear_auth: function () {
        this.stop_all();
        Playdar.loadjs(this.get_revoke_url());
        this.auth_token = false;
        Playdar.deletecookie('auth');
        this.update_status_bar();
        this.handlers.clear_auth();
    },
    get_revoke_url: function () {
        return this.get_base_url("/auth/?" + Playdar.toQueryString({
            revoke: this.auth_token
        }));
    },
    update_status_bar: function () {
        if (!Playdar.status_bar) {
            Playdar.status_bar = this.build_status_bar();
        }
        var message;
        if (this.auth_token) {
            this.disconnect_link.style.display = "";
            this.track_list_container.style.display = "";
            this.load_tracks();
            message = "Ready";
        } else {
            this.disconnect_link.style.display = "none";
            this.track_list_container.style.display = "none";
            if (this.manual_auth) {
                var input_id = "manualAuth_" + this.uuid;
                message = '<input type="text" id="' + input_id + '" />'
                    + ' <input type="submit" value="Allow access to Playdar" onclick="'
                        + this.jsonp_callback('manual_auth_callback') + '(\'' + input_id + '\');'
                        + 'return false;'
                    + '" />';
            } else if (this.auth_details) {
                message = '<a href="' + this.get_auth_url()
                        + '" target="' + this.auth_popup_name
                        + '" onclick="'
                        + this.jsonp_callback('start_auth') + '();'
                        + 'return false;'
                    + '">Connect</a>';
            }
        }
        this.status.innerHTML = message;
    },
    load_tracks: function () {
        Playdar.loadjs(this.get_url("list_queries", "handle_queries"));
    },
    handle_queries: function (response) {
        var list_items = "";
        for (var i = 0; i < response.queries.length; i++) {
            var li = this.build_track_list_item(response.queries[i]);
            list_items += li;
        }
        this.track_list.innerHTML = list_items;
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
                + '<a href="' + this.get_base_url("/queries/" + response.query.qid) + '" style="'
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
    get_auth_url: function () {
        return this.get_base_url("/auth_1/?" + Playdar.toQueryString(this.auth_details));
    },
    auth_popup: null,
    manual_auth: false,
    start_auth: function () {
        if (this.auth_popup === null || this.auth_popup.closed) {
            this.auth_popup = window.open(
                this.get_auth_url(),
                this.auth_popup_name,
                this.get_auth_popup_options()
            );
        } else {
            this.auth_popup.focus();
        }
        if (!this.auth_details.receiverurl) {
            // Show manual auth form
            this.manual_auth = true;
            this.update_status_bar();
        }
    },
    get_auth_popup_options: function () {
        var popup_location = this.get_auth_popup_location();
        return [
            "left=" + popup_location.x,
            "top=" + popup_location.y,
            "width=" + this.auth_popup_size.w,
            "height=" + this.auth_popup_size.h,
            "location=yes",
            "toolbar=no",
            "menubar=yes",
            "status=yes",
            "resizable=yes",
            "scrollbars=yes"
        ].join(',');
    },
    get_auth_popup_location: function () {
        var window_location = Playdar.get_window_location();
        var window_size = Playdar.get_window_size();
        return {
            'x': Math.max(0, window_location.x + (window_size.w - this.auth_popup_size.w) / 2),
            'y': Math.max(0, window_location.y + (window_size.h - this.auth_popup_size.h) / 2)
        };
    },
    
    auth_callback: function (token) {
        Playdar.setcookie('auth', token, 365);
        if (this.auth_popup !== null && !this.auth_popup.closed) {
            this.auth_popup.close();
        }
        this.auth_token = token;
        this.manual_auth = false;
        this.stat();
    },
    manual_auth_callback: function (input_id) {
        var input = document.getElementById(input_id);
        if (input && input.value) {
            this.auth_callback(input.value);
        }
    },
    
    // CONTENT RESOLUTION
    
    resolve_qids: [],
    last_qid: "",
    request_count: 0,
    pending_count: 0,
    success_count: 0,
    poll_counts: {},
    /**
     * A query resolution queue consumed by process_resolution_queue, which is called
     * each time a final_answer is received from the daemon.
     */
    resolution_queue: [],
    max_concurrent_resolutions: 5,
    resolutions_in_progress: 0,
    
    resolve: function (art, alb, trk, qid) {
        var query = {
            artist: art,
            album: alb,
            track: trk
        };
        if (typeof qid !== 'undefined') {
            query.qid = qid;
        }
        this.increment_requests();
        
        this.resolution_queue.push(query);
        this.process_resolution_queue();
    },
    process_resolution_queue: function() {
        if (this.resolutions_in_progress >= this.max_concurrent_resolutions) {
            return false;
        }
        var available_resolution_slots = this.max_concurrent_resolutions - this.resolutions_in_progress;
        for (var i = 1; i <= available_resolution_slots; i++) {
            var query = this.resolution_queue.shift();
            if (!query) {
                break;
            }
            this.resolutions_in_progress++;
            Playdar.loadjs(this.get_url("resolve", "handle_resolution", query));
        }
    },
    handle_resolution: function (response) {
        this.last_qid = response.qid;
        this.resolve_qids.push(this.last_qid);
        this.get_results(response.qid);
    },
    increment_requests: function () {
        this.request_count++;
        this.pending_count++;
        this.show_resolution_status();
    },
    show_resolution_status: function () {
        if (this.query_count) {
            var status = " " + this.success_count + "/" + this.request_count;
            if (this.pending_count) {
                status += ' <img src="' + this.web_host + '/static/track_throbber.gif" width="16" height="16" style="vertical-align: middle; margin: -2px 2px 0 2px"/> ' + this.pending_count;
            }
            this.query_count.innerHTML = status;
        }
    },
    
    // poll results for a query id
    get_results: function (qid) {
        Playdar.loadjs(this.get_url("get_results", "handle_results", {
            qid: qid
        }));
    },
    poll_results: function (response, callback) {
        // figure out if we should re-poll, or if the query is solved/failed:
        var final_answer = this.should_stop_polling(response);
        var that = this;
        if (!final_answer) {
            setTimeout(function () {
                callback.call(that, response.qid);
            }, response.refresh_interval);
        }
        return final_answer;
    },
    handle_results: function (response) {
        var final_answer = this.poll_results(response, this.get_results);
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
        
        this.call_results_handler(response, final_answer);
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
    call_results_handler: function (response, final_answer) {
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
            this.handlers.results(response, final_answer);
        }
    },
    get_last_results: function () {
        if (this.last_qid) {
            this.increment_requests();
            this.get_results(this.last_qid);
        }
    },
    
    // SOUNDMANAGER 2 WRAPPERS
    
    results: {},
    nowplayingid: null,
    register_stream: function (result, options) {
        if (!this.soundmanager) {
            return false;
        }
        
        // Register result
        this.results[result.sid] = result;
        
        if (!options) {
            var options = {};
        }
        options.id = result.sid;
        options.url = this.get_stream_url(result.sid);
        var that = this;
        options.whileplaying = function () {
            // Update the track progress
            that.track_elapsed.innerHTML = Playdar.mmss(Math.round(this.position/1000));
            // Update the playback progress bar
            var duration;
            if (this.readyState == 3) { // loaded/success
                duration = this.duration;
            } else {
                duration = this.durationEstimate;
            }
            var portion_played = this.position/duration;
            that.playhead.style.width = Math.round(portion_played*that.progress_bar_width) + "px";
        };
        options.whileloading = function () {
            if ((!this.firstBytesLoadedValue || this.bytesLoaded == this.previousBytesLoadedValue)
             && (this.bytesLoaded != this.bytesTotal || (this.bytesTotal == 0 && this.bytesLoaded == 0))) {
                // check for firstBytesLoadedValue since some streams
                // don't start at 0 but still fail.
                this.firstBytesLoadedValue = this.bytesLoaded;
                var bytesLoaded = this.bytesLoaded;
                var bytesTotal = this.bytesTotal;
                // Setup a time delay to try and to figure
                // out if we've got a stream failure.
                var this_sound = this;
                setTimeout(function() {
                    // if it's still at the same point
                    if (this_sound.bytesLoaded == bytesLoaded
                     && this_sound.bytesTotal == this_sound.bytesTotal) {
                        this_sound.stop();
                        if (options.onstreamfailure) {
                            options.onstreamfailure();
                        }
                    }
                }, 4000);
            } else {
                // Update the loading progress bar
                var buffered = this.bytesLoaded/this.bytesTotal;
                that.bufferhead.style.width = Math.round(buffered*that.progress_bar_width) + "px";
            }
            this.previousBytesLoadedValue = this.bytesLoaded;
        };
        var sound = this.soundmanager.createSound(options);
        return sound;
    },
    play_stream: function (sid) {
        if (!this.soundmanager) {
            return false;
        }
        var sound = this.soundmanager.getSoundById(sid);
        if (this.nowplayingid != sid) {
            this.stop_all();
            if (sound.playState == 0) {
                // Initialise the track progress
                this.track_elapsed.innerHTML = Playdar.mmss(0);
                // Update the track link
                this.track_link.href = this.get_stream_url(this.results[sid].sid);
                this.track_link.title = this.results[sid].source;
                this.track_name.innerHTML = this.results[sid].track;
                this.artist_name.innerHTML = this.results[sid].artist;
                // Update the track duration
                this.track_duration.innerHTML = Playdar.mmss(this.results[sid].duration);
                // Show progress bar
                this.status.style.display = "none";
                this.playback.style.display = "";
                
                this.nowplayingid = sid;
            }
        }
        
        sound.togglePause();
        return sound;
    },
    stop_all: function () {
        if (this.soundmanager && this.nowplayingid) {
            var sound = this.soundmanager.getSoundById(this.nowplayingid);
            sound.stop();
            sound.setPosition(1);
            this.nowplayingid = null;
        }
        
        this.playback.style.display = "none";
        this.status.style.display = "";
        
        this.track_link.href = "#";
        this.track_link.title = "";
        this.track_name.innerHTML = "";
        this.artist_name.innerHTML = "";
    },
    
    // UTILITY FUNCTIONS
    
    get_base_url: function (path) {
        var url = "http://" + this.server_root + ":" + this.server_port;
        if (path) {
            url += path;
        }
        return url;
    },
    
    // build an api url for playdar requests
    get_url: function (method, jsonp, options) {
        if (!options) {
            options = {};
        }
        options.method = method;
        options.jsonp = this.jsonp_callback(jsonp);
        if (this.auth_token) {
            options.auth = this.auth_token;
        }
        return this.get_base_url("/api/?" + Playdar.toQueryString(options));
    },
    
    // turn a source id into a stream url
    get_stream_url: function (sid) {
        return this.get_base_url("/sid/" + sid);
    },
    
    // build the jsonp callback string
    jsonp_callback: function (callback) {
        return "Playdar.instances['" + this.uuid + "']." + callback;
    },
    
    list_results: function (response) {
        for (var i = 0; i < response.results.length; i++) {
            console.log(response.results[i].name);
        }
    },
    
    // STATUS BAR
    query_list_link: null,
    build_status_bar: function () {
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
        status_bar.style.borderTop = '1px solid #3f7d31';
        status_bar.style.font = 'normal 13px/18px "Calibri", "Lucida Grande", sans-serif';
        status_bar.style.color = "#517e09";
        status_bar.style.background = '#cbdab1';
        
        /* Left column
           ----------- */
        var left_col = document.createElement("div");
        left_col.style.padding = "0 7px";
        // Logo
        var logo = '<img src="' + this.web_host + '/static/playdar_logo_32x32.png" width="32" height="32" style="vertical-align: middle; float: left; margin: 0 10px 0 0; border: 0; line-height: 36px;" />';
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
        this.artist_name.style.color = "#5d8a0e";
        
        this.track_name = document.createElement("strong");
        this.track_name.style.margin = "0 0 0 10px";
        this.track_name.style.color = "#3e6206";
        
        this.track_link.appendChild(this.artist_name);
        this.track_link.appendChild(this.track_name);
        track_title.appendChild(this.track_link);
        this.playback.appendChild(track_title);
        
        // Playback Progress table
        var progress_table = document.createElement("table");
        progress_table.setAttribute('cellpadding', 0);
        progress_table.setAttribute('cellspacing', 0);
        progress_table.setAttribute('border', 0);
        progress_table.style.color = "#517e09";
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
        progress_bar.style.border = "1px solid #517e09";
        progress_bar.style.background = "#fff";
        progress_bar.style.position = "relative";
        // - Buffer progress
        this.bufferhead = document.createElement("div");
        this.bufferhead.style.position = "absolute";
        this.bufferhead.style.width = 0;
        this.bufferhead.style.height = "9px";
        this.bufferhead.style.background = "#e1f1c5";
        progress_bar.appendChild(this.bufferhead);
        // - Playback progress
        this.playhead = document.createElement("div");
        this.playhead.style.position = "absolute";
        this.playhead.style.width = 0;
        this.playhead.style.height = "9px";
        this.playhead.style.background = "#98be3d";
        progress_bar.appendChild(this.playhead);
        // Click to toggle pause
        var that = this;
        progress_bar.onclick = function () {
            if (that.nowplayingid) {
                that.play_stream(that.nowplayingid);
            }
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
        settings_link.innerHTML = '<a href="' + this.get_base_url() + '" target="_blank">Settings</a>';
        right_col.appendChild(settings_link);
        // - Disconnect link
        this.disconnect_link = document.createElement("p");
        this.disconnect_link.style.margin = 0;
        this.disconnect_link.innerHTML = '<a href="#" onclick="'
            + this.jsonp_callback('clear_auth') + '();'
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
        var that = this;
        track_list_head.onclick = function () {
            var hidden = (that.track_list_body.style.display == "none");
            that.track_list_body.style.display = hidden ? "" : "none";
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
        var that = this;
        this.track_list_body.onclick = function (e) {
            return that.querylist_click_handler.call(that, e);
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
        document.body.style.marginBottom = (marginBottom.replace('px', '') - 0) + 36 + 'px';
        
        return status_bar;
    },
    nowplaying_query_button: null,
    querylist_click_handler: function (e) {
        var target = Playdar.getTarget(e);
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
                this.play_stream(sid);
            }
            target = target.parentNode;
        }
    },
    expand_querylist_result: function (target) {
        this.hide_querylist_results();
        this.query_list_link = target;
        var url_root = this.get_base_url("/queries/");
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
        Playdar.loadjs(this.get_url("get_results", "show_querylist_results", {
            qid: qid
        }));
    },
    show_querylist_results: function (response) {
        if (this.query_list_link) {
            var final_answer = this.poll_results(response, this.get_querylist_results);
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
                    if (this.nowplayingid) {
                        var cells = querylist_results.getElementsByTagName('td');
                        for (var i = 0; i < cells.length; i++) {
                            var cell = cells[i];
                            if (cell.className == 'playdar_play') {
                                var sid = cell.parentNode.className.replace('sid_', '');
                                if (this.nowplayingid == sid) {
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
        var sound = this.register_stream(result);
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
                + '<td style="width: 35px; padding: 0 0 7px 0">' + Playdar.mmss(result.duration) + '</td>'
                + '<td style="width: 50px; padding: 0 0 7px 0; text-align: right;">' + result.bitrate + 'Kbps</td>'
            + '</tr>';
        return row;
    }
};

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
Playdar.generate_uuid = function () {
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
};

// Query string helper
Playdar.toQueryPair = function (key, value) {
    if (value === null) {
        return key;
    }
    return key + '=' + encodeURIComponent(value);
};
Playdar.toQueryString = function (params) {
    var results = [];
    for (key in params) {
        var values = params[key];
        key = encodeURIComponent(key);
        
        if (Object.prototype.toString.call(values) == '[object Array]') {
            for (i = 0; i < values.length; i++) {
                results.push(Playdar.toQueryPair(key, values[i]));
            }
        } else {
            results.push(Playdar.toQueryPair(key, values));
        }
    }
    return results.join('&');
};

// format secs -> mm:ss helper.
Playdar.mmss = function (secs) {
    var s = secs % 60;
    if (s < 10) {
        s = "0" + s;
    }
    return Math.floor(secs/60) + ":" + s;
};

// JSON loader
Playdar.loadjs = function (url) {
   var s = document.createElement("script");
   s.src = url;
   document.getElementsByTagName("head")[0].appendChild(s);
};

// Cookie helpers
Playdar.setcookie = function (name, value, days) {
    if (days) {
        var date = new Date();
        date.setTime(date.getTime() + (days*24*60*60*1000));
        var expires = "; expires=" + date.toGMTString();
    } else {
        var expires = "";
    }
    document.cookie = "PD_" + name + "=" + value + expires + "; path=/";
};
Playdar.getcookie = function (name) {
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
};
Playdar.deletecookie = function (name) {
    Playdar.setcookie(name, "", -1);
};

// Window dimension/position helpers
Playdar.get_window_location = function () {
    var location = {};
    if (window.screenLeft) {
        location.x = window.screenLeft || 0;
        location.y = window.screenTop || 0;
    } else {
        location.x = window.screenX || 0;
        location.y = window.screenY || 0;
    }
    return location;
};
Playdar.get_window_size = function () {
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
};

// Event target helper
Playdar.getTarget = function (e) {
    e = e || window.event;
    return e.target || e.srcElement;
};