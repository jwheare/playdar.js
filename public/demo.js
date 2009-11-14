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
                $('#results').append(row);
            }
            row.append('.');
            if (finalAnswer) {
                if (response.solved) {
                    row.css('background', 'green');
                } else {
                    row.css('background', 'orange');
                }
                if (!response.results.length) {
                    row.css('background', 'red');
                }
                row.prepend('<span style="float:right;">'+response.results.length+'</span>');
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