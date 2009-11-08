Playdar.setup({
    name: "Playdar.js RDFA Tests",
    website: "http://www.playdarjs.org/"
});
Playdar.client.register_listeners({
    onStat: function (detected) {
        if (!detected) {
            console.warn('no playdar');
        }
    },
    onAuth: function () {
        console.dir(Playdar.client.autodetect());
    }
});
Playdar.client.register_results_handler(function (response, final_answer) {
    if (final_answer) {
        console.dir(response);
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
