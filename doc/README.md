playdar.js Javascript client library
====================================

**playdar.js** is a Javascript client library for interacting with the [Playdar HTTP API](http://www.playdar.org/api.html).

Here's how you use it:

    var auth_details = {
        name: "playdar.js Documentation",
        website: "http://playdarjs.org"
    };
    var listeners = {
        onStat: function (detected) {
            if (detected) {
                alert('Playdar detected');
            } else {
                alert('Playdar unavailabled');
            }
        },
        onAuth: function () {
            alert('Access to Playdar authorised');
        },
        onAuthClear: function () {
            alert('User revoked authorisation');
        }
    };
    
    Playdar.setup(auth_details);
    Playdar.client.register_listeners(listeners);
    Playdar.client.init();

This will setup the Playdar library with authorisation credentials for your domain, and register a series of lifecycle event listeners.

The library is separated into modules: `client`, `player` and `status_bar`.

The `client.init()` method checks for a running Playdar service. The `onStat` event is then fired and if Playdar is detected a status bar appears at the bottom of the window. A user is then able to allow a domain to make use of Playdar. After user authorisation, the `onAuth` event is fired and you can start querying Playdar. If a user clicks the "Disconnect" link in the status bar, their authorisation will be revoked and the `onAuthClear` event is fired.

Advanced authorisation
======================

If you'd like to streamline the auth process, you can include a `receiverurl` in the `auth_details` object. This should be a URL that points to a [playdarauth.html](/playdarauth.html) file hosted on your domain that receives messages through the location hash and passes it back to a `window.opener`. An auth token will be sent to this URL after user authorisation so that Playdar can set an auth cookie on your domain.

Resolving content
=================

Searching an available Playdar service for streamable music is a two step process.

1. Register a results handler.
2. Call the `Playdar.client.resolve()` method with artist, track (and optionally album) names.

    var results_handler = function (response, final_answer) {
        if (final_answer) {
            if (response.results.length) {
                alert('Found results: ' + response.results.length);
            } else {
                alert('No results');
            }
        }
    };

    Playdar.client.register_results_handler(results_handler);
    Playdar.client.resolve("Weezer", "Pinkerton", "Getchoo");

Results handlers are called with two arguments:

* `response` *(JSON)* from the `get_results` API method.
* `final_answer` *(bool)* indicating whether polling has ended.

The `register_results_handler()` and `resolve()` methods also take an optional final argument, `qid` which lets you define your own query id, and define custom handlers for content resolution.

Note: You can alternatively register a default results handler along with the other event listeners. Just include an `onResults` listener when you call `register_listeners`. This is sometimes more convenient when you don't need custom handlers for each query.

Autodetection
=============

If you have content marked up with the [hAudio microformat](http://microformats.org/wiki/haudio), you can use the `Playdar.client.autodetect()` method to resolve this content.

`autodetect` takes an optional callback function, that will get called for each track, passing an object containing the artist and track name and the matched element. If the function returns a qid, this will be passed on to the resolve call so you can hook results up to a custom handler.

    var track_handler = function (track) {
        // Track object looks like this
        // {
        //    'name': [track_name String],
        //    'artist':  [artist_name String],
        //    'element':  [element DOMElement]
        // }
        
        var qid = Playdar.Util.generate_uuid();
        track.element.className = 'q' + qid;
        return qid;
    };
    
    Playdar.client.autodetect(track_handler);

Query history
=============

Each query id passed back from `Playdar.client.resolve()` calls is stored in `Playdar.client.resolve_qids` (with the last one in `Playdar.client.last_qid` for convenience). So you can easily refetch results by calling `get_results()` yourself:

    // Refetch the last query
    Playdar.client.get_results(Playdar.client.last_qid);
    
    // Refetch the first query
    Playdar.client.get_results(Playdar.client.resolve_qids[0]);

Streaming
=========

Once you've got a good result, you can construct a streaming url by calling `Playdar.client.get_stream_url()` on the sid.

    alert("Stream URL: " + Playdar.client.get_stream_url(result.sid));

The Playdar library also has a built in wrapper for the [SoundManager 2 audio library](http://www.schillmania.com/projects/soundmanager2/), available through the `Playdar.player` module. Simply include the `soundmanager2.js` file, configure the global `soundManager` object it creates and pass it into the `Playdar.setup_player` function to initialise the `Playdar.player` module.

    soundManager.url = '/path/to/soundmanager2_flash9.swf';
    soundManager.flashVersion = 9;
    soundManager.onload = function () {
        Playdar.setup_player(soundManager);
        Playdar.client.init();
    };

Since SoundManager works via a flash object that's loaded asynchronously, you need to wait for the soundManager.onload event before calling `Playdar.client.init()`, or else you may end up calling SoundManager functions before it's ready.

You now have a couple of methods available for registering and playing Playdar streams:

    // register_stream passes options onto SM createSound
    Playdar.player.register_stream(result, {
        onstop: function () {
            // Scope of 'this' is a SM Sound object
            alert('Stopped playing sound: ' + this.sID);
        }
    });
    
    // Play a specific sound. Calls togglePause on the SM Sound object
    Playdar.player.play_stream(sid);
    
    // togglePause on the current sound
    Playdar.player.toggle_nowplaying();
    
    // Stop the current playing sound
    Playdar.player.stop_current();
    
    // Stops a specific sound if it's now playing
    Playdar.player.stop_stream(sid);
    
    // Whether any sound is playing at the moment
    Playdar.player.is_now_playing();

Scrobbling
==========

Scrobbling works out of the box with the built in player. If you've implemented your own player, you can use the `Playdar.Scrobbler` module:

    var scrobbler = new Playdar.Scrobbler();
    scrobbler.start(artist, track, album, duration, track_number, mbid);
    scrobbler.pause();
    scrobbler.resume();
    scrobbler.stop();

Calling these according to the  will keep the Playdar daemon's audioscrobbler plugin up to date with your playback process and automatically handle the scrobbling protocol.

Utility Functions
=================

The Playdar library defines a few utility functions that are mainly used internally for framework tasks, but you may find them useful:

* Playdar.Util.generate_uuid
* Playdar.Util.toQueryPair
* Playdar.Util.toQueryString
* Playdar.Util.mmss (formats seconds as mm:ss)
* Playdar.Util.loadjs
* Playdar.Util.setcookie
* Playdar.Util.getcookie
* Playdar.Util.deletecookie
* Playdar.Util.get_window_position
* Playdar.Util.get_window_size
* Playdar.Util.getTarget