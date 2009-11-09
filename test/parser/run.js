Playdar.setup({
    name: "Playdar.js Parse Tests",
    website: "http://www.playdarjs.org/"
});
Playdar.client.register_listeners({
    onStat: function (detected) {
        if (!detected) {
            console.warn('no playdar');
        }
    },
    onAuth: function () {
        var results = Playdar.client.autodetect();
        console.log(JSON.stringify(results));
        console.dir(results);
        if (EXPECTED) {
            console.dir(runTests(results));
        }
    }
});

/* Soundmanager options */
soundManager.waitForWindowLoad = true;
soundManager.url = '/soundmanager2_flash9_xdomain.swf';

// Enable flash 9 features, like mpeg4 support
soundManager.flashVersion = 9;
soundManager.useMovieStar = true;

// Debug settings
soundManager.consoleOnly = true;
soundManager.debugMode = false;

// Set an infinite timeout to allow for flashblockers
soundManager.flashLoadTimeout = 0;

soundManager.onready(function (status) {
    if (status.success) {
        Playdar.setup_player(soundManager);
        Playdar.client.init();
    }
});

function runTests (results) {
    var i, j, track, keys, k;
    fireunit.compare(EXPECTED.length, results.length, 'Results length');
    for (i = 0; i < EXPECTED.length; i++) {
        fireunit.compare(EXPECTED[i].tracks.length, results[i].tracks.length, 'Playlist length');
        for (j = 0; j < EXPECTED[i].tracks.length; j++) {
            track = results[i].tracks[j];
            expected = EXPECTED[i].tracks[j];
            delete track.element;
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
            fireunit.compare(EXPECTED[i].download, results[i].download, 'Album download');
            delete results[i].download;
            fireunit.compare(EXPECTED[i].duration, results[i].duration, 'Album duration');
            delete results[i].duration;
            fireunit.compare(EXPECTED[i].released, results[i].released, 'Album released');
            delete results[i].released;
            fireunit.compare(EXPECTED[i].image, results[i].image, 'Album image');
            delete results[i].image;
            if (EXPECTED[i].buy) {
                for (k in EXPECTED[i].buy) {
                    fireunit.compare(EXPECTED[i].buy[k], results[i].buy[k], 'Album buy ' + k);
                }
            } else {
                fireunit.compare(EXPECTED[i].buy, results[i].buy, 'Album buy');
            }
            delete results[i].buy;
            fireunit.compare(EXPECTED[i].title, results[i].title, 'Album title');
            delete results[i].title;
        } else {
            fireunit.compare(window.title || window.location.href, results[i].title, 'Page title');
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
    fireunit.testDone();
    return remainder;

}