(function () {
    $('#latestVersion').text('(v'+Playdar.VERSION+')');
    var resolveOnAuth = false;
    Playdar.auth_details.receiverurl = Playdar.Util.location_from_url("/playdar_auth.html").href;
    Playdar.USE_STATUS_BAR = false;
    function resolveForm () {
        $('#sweep').show();
        Playdar.client.resolve($('#demo input[name=artist]').val(), $('#demo input[name=track]').val());
    }
    function enableLiveDemo () {
        // Replace artist with input
        var artist = $('<input name="artist" onclick="this.focus(); this.select();">')
            .val($('#demoArtist').text());
        $('#demoArtist').replaceWith(artist);
        // Replace track with input
        var track = $('<input name="track" onclick="this.focus(); this.select();">')
            .val($('#demoTrack').text());
        $('#demoTrack').replaceWith(track);
        // Replace go with submit
        var go = $('<input type="submit" id="demoSubmit">')
            .val($('#demoGo').text());
        $('#demoGo').replaceWith(go);
        // Show results
        $('#demoResults').show();
    }
    Playdar.setupClient({
        onStartStat: function () {
            $('#demoSubmit').attr('disabled', true);
            $('#stat').html('Scanning for Playdar…').removeClass('notFound');
        },
        onStat: function (status) {
            if (status) {
                if ($('#demoSubmit')[0]) {
                    $('#demoSubmit').attr('disabled', false);
                } else {
                    enableLiveDemo();
                }
                $('#stat').html('Playdar available • ' + Playdar.client.get_auth_link_html());
            } else {
                $('#stat').html('<a href="http://www.playdar.org/">Playdar</a> unavailable • ' + Playdar.client.get_stat_link_html()).addClass('notFound');
            }
        },
        onAuth: function () {
            $('#stat').html('Playdar connected • ' + Playdar.client.get_disconnect_link_html());
            if (resolveOnAuth) {
                resolveOnAuth = false;
                resolveForm();
            }
        },
        onResults: function (response, finalAnswer) {
            if (typeof(console) !== 'undefined') {
                console.log('Polling ' + response.qid);
            }
            var id = 'results_qid_' + response.qid;
            var row = $('#'+id);
            if (!row[0]) {
                row = $('<li id='+id+'>').text(response.query.artist + ' - ' + response.query.track);
                row.prepend('<span class="matches">');
                $('#results').append(row);
            }
            row.addClass('progress');
            row.append('.');
            $('span.matches', row).text(response.results.length);
            if (finalAnswer) {
                if (response.results.length) {
                    row.addClass('match');
                } else {
                    row.addClass('noMatch');
                }
                if (response.solved) {
                    row.addClass('perfectMatch');
                }
                if (typeof(console) !== 'undefined') {
                    console.dir(response);
                }
            }
        },
        onResolveIdle: function () {
            $('#sweep').hide();
        }
    });
    
    Playdar.client.go();
    
    $('#demo').submit(function (e) {
        e.preventDefault();
        if (Playdar.client.isAvailable()) {
            if (Playdar.client.is_authed()) {
                resolveForm();
            } else {
                resolveOnAuth = true;
                Playdar.client.start_auth();
            }
        }
    });
})();