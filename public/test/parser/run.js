Playdar.auth_details.name = "Playdar.js Parse Tests";
Playdar.auth_details.receiverurl = Playdar.Util.location_from_url("/playdar_auth.html").href;
Playdar.setupClient({
    onStat: function (detected) {
        if (!detected) {
            console.warn('no playdar');
        }
    },
    onAuth: function () {
        var results = Playdar.client.autodetect();
        // console.log(JSON.stringify(results));
        // console.dir(results);
        if (fireunit) {
            var remainder = runTests(results);
            // console.dir(remainder);
        }
    }
});

Playdar.client.go();

function testBuy (expected, actual, label) {
    if (expected) {
        if (actual) {
            if (expected.url) {
                fireunit.compare(Playdar.Util.location_from_url(expected.url).href, Playdar.Util.location_from_url(actual.url).href, label + ' buy URL');
                delete actual.url;
            }
            for (var k in actual) {
                fireunit.compare(expected[k], actual[k], label + ' buy ' + k);
            }
        } else {
            fireunit.ok(false, 'Missing ' + label + ' buy');
        }
    } else {
        fireunit.compare(expected, actual, label + ' buy');
    }
}

function runTests (results) {
    if (!EXPECTED) {
        console.warn('No test expectations');
    }
    try {
        var i, j, track, keys, k;
        fireunit.compare(EXPECTED.length, results.length, 'Results length');
        for (i = 0; i < EXPECTED.length; i++) {
            fireunit.compare(EXPECTED[i].tracks.length, results[i].tracks.length, 'Playlist length');
            for (j = 0; j < EXPECTED[i].tracks.length; j++) {
                track = results[i].tracks[j];
                expected = EXPECTED[i].tracks[j];
                delete track.element;
                testBuy(expected.buy, track.buy, 'Track');
                delete track.buy;
                for (k in track) {
                    fireunit.compare(expected[k], track[k], 'Track ' + k);
                }
            }
            delete results[i].tracks;
            
            fireunit.compare(EXPECTED[i].type, results[i].type, 'Playlist type');
            delete results[i].type;
            if (EXPECTED[i].type == 'album') {
                fireunit.compare(EXPECTED[i].artist, results[i].artist, 'Album artist');
                delete results[i].artist;
                fireunit.compare(Playdar.Util.location_from_url(EXPECTED[i].download).href, Playdar.Util.location_from_url(results[i].download).href, 'Album download');
                delete results[i].download;
                fireunit.compare(EXPECTED[i].duration, results[i].duration, 'Album duration');
                delete results[i].duration;
                fireunit.compare(EXPECTED[i].released, results[i].released, 'Album released');
                delete results[i].released;
                fireunit.compare(Playdar.Util.location_from_url(EXPECTED[i].image).href, Playdar.Util.location_from_url(results[i].image).href, 'Album image');
                delete results[i].image;
                testBuy(EXPECTED[i].buy, results[i].buy, 'Album');
                delete results[i].buy;
                fireunit.compare(EXPECTED[i].title, results[i].title, 'Album title');
                delete results[i].title;
            } else {
                fireunit.compare(EXPECTED[i].title, results[i].title, 'Page title');
            }
            delete results[i].title;
            keys = 0;
            for (k in results[i]) {
                keys++;
            }
            if (!keys) {
                delete results[i];
            }
        }
        var remainder = [];
        for (i = 0; i < results.length; i++) {
            if (results[i] !== undefined) {
                remainder.push(results[i]);
            }
        }
        fireunit.compare(0, remainder.length, 'No remainder');
    } catch (e) {
        console.warn(e);
        fireunit.ok(false, e.name + ' on line ' + e.lineNumber + ': ' + e.message);
    }
    fireunit.testDone();
    return remainder;

}