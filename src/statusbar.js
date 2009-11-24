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
    
    playHandler: function (result) {
        // Initialise the track progress
        this.trackElapsed.innerHTML = Playdar.Util.mmss(0);
        // Update the track link
        this.trackLink.href = Playdar.client.get_stream_url(result.sid);
        this.trackLink.title = result.source;
        this.trackName.innerHTML = result.track;
        this.artistName.innerHTML = result.artist;
        // Update the track duration
        this.trackDuration.innerHTML = Playdar.Util.mmss(result.duration);
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
