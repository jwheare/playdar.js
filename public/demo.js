(function () {
    function resolveForm () {
        Playdar.client.resolve($('#demo input[name=artist]').val(), $('#demo input[name=track]').val());
    }
    Playdar.auth_details.receiverurl = Playdar.Util.location_from_url("/playdar_auth.html").href;
    Playdar.setupClient({
        onStat: function (status) {
            if (!status.authenticated) {
                Playdar.client.start_auth();
            }
        },
        onAuth: function () {
            resolveForm();
        },
        onResults: function (response, finalAnswer) {
            console.log('Polling ' + response.qid);
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
                console.dir(response);
            }
        }
    });
    var gone = false;
    $('#demo').submit(function (e) {
        e.preventDefault();
        if (!gone) {
            Playdar.client.go();
            gone = true;
        } else if (Playdar.client.is_authed()) {
            resolveForm();
        } else {
            Playdar.client.start_auth();
        }
    });
})();