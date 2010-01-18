[Playdar.js](http://www.playdarjs.org/) is a JavaScript client library for interacting with the [Playdar HTTP API](http://www.playdar.org/api.html).

The source code is distributed under the terms of the [BSD license](http://www.playdarjs.org/LICENSE) and uses [Semantic Versioning](http://semver.org/)

Here’s how you can use it to query Playdar for a specific track:

    <!-- Include the library -->
    <script src="playdar.js"></script>
    <script>
        /* First, set the client up with some callbacks. */
        Playdar.setupClient({
            
            // Called when the browser is authorised to query Playdar.
            onAuth: function () {
                // At this point, we can query the Playdar API for a track and start polling for matches.
                Playdar.client.resolve("Mokele", "Hiding in your Insides");
            },
            
            // Called in response to each poll with the results so far.
            onResults: function (response, lastPoll) {
                console.log('Polling ' + response.qid);
                if (lastPoll) {
                    // Take a look at the final response.
                    console.dir(response);
                }
            }
            
        });
        
        /* The client is now ready to check in with Playdar. */
        Playdar.client.go();
    </script>

The library is separated into modules: `client`, `player` and `status_bar`.

The `client.go()` method checks for Playdar running on a visitor’s machine. The `onStat` event is then fired and if Playdar is detected a status bar appears at the bottom of the window. Your visitor can now authorise your domain to make use of Playdar. Once they’ve completed the authorisation process, the `onAuth` event is fired and you can start querying Playdar.

Advanced authorisation
======================

If you'd like to streamline the auth process, you can specify a `receiverurl` on the `Playdar.auth_details` object. This should be a URL to a file hosted on your domain that will be able to receive messages through its location object.

After a visitor allows access to Playdar, the authorisation dialog will redirect to your `receiverurl`, with an authentication token in the URL. JavaScript on the `receiverurl` reads this token from the `window.location` and passes it back to your application via `window.opener`. Playdar.js then stores this token in a cookie for your domain. This only works if `receiverurl` is on the same domain as your application.

Use this file as your `receiverurl`: [playdar_auth.html](http://www.playdarjs.org/playdar_auth.html)

Resolving content
=================

As seen above, querying Playdar for music is a two step process.

1. Set the client up with an `onResults` callback.
2. Call `Playdar.client.resolve`

The `resolve` method queries the Playdar API and starts polling for results using the `get_results` API method. Here’s the method signature:

    /**
     * Playdar.client.resolve(artist, track[, album][, qid][, results])
     * - artist (String): Track artist
     * - track (String): Track title
     * - album (String): Track album. This will only be used for sorting results
     * - qid (UUID): ID to use for this query
     * - results (Array): An array of result objects to seed the response set with
    **/

The `onResults` callback is fired in response to each poll, and is passed two arguments:

* `response` *(JSON)* Contains information about your query and any results Playdar has found so far.
* `finalAnswer` *(bool)* Indicates whether polling has ended.

Per-query results callbacks
===========================

If you need custom `onResults` callbacks for each of your queries, for example if you're using a closure to an element that needs updating when the final response comes in, you can use the `Playdar.client.register_results_handler` method. This takes two parameters:

* `onResults` *(Function)* Your custom onResults callback function.
* `qid` *(UUID)* The query ID for your `resolve` call.

In order to be able to pass a `qid` for your query to this method, you need to define it yourself and also pass it to `resolve` as the fourth parameter.

Autodetection
=============

If you have music marked up with either the [hAudio microformat](http://microformats.org/wiki/haudio) or RDFa Audio or Music Ontologies, you can use the `Playdar.client.autodetect()` method to resolve this content.

`autodetect` takes an optional callback function, that will get called for each track detected. This callback is passed an object containing the artist and track name along with the matched element. If the function returns a qid, this will be passed on to the resolve call so you can hook results up to a custom `onResults` callback.

    var trackCallback = function (track) {
        /**
         * Track object has these properties:
         *    'name': [String Track title],
         *    'artist':  [String Track artist],
         *    'element':  [DOMElement Element that contained the data]
        **/
        
        // Add a classname to the element so we can locate it by qid in our onResults callback
        var qid = Playdar.Util.generate_uuid();
        track.element.className = 'q' + qid;
        return qid;
    };
    
    Playdar.client.autodetect(trackCallback);

Playing sound
=============

Once you've got a good result, you can construct a URL to stream by calling `Playdar.client.get_stream_url()` on the result’s stream ID.

    alert("Stream URL: " + Playdar.client.get_stream_url(result.sid));

The Playdar library also has a built in wrapper for the [SoundManager 2 audio library](http://www.schillmania.com/projects/soundmanager2/), available through the `Playdar.player` module. Simply upload the `soundmanager2.js` and `soundmanager2_flash9.swf` files to your server, and pass their file paths into the `Playdar.setupPlayer` function to initialise the `Playdar.player` module.

    Playdar.setupPlayer(
        '/path/to/soundmanager2.js',
        '/path/to/soundmanager2_flash9.swf',
        function onready (status) {
            if (status.success) {
                Playdar.client.go();
            } else {
                // soundManager failed to load properly
            }
        },
        {
            // extra options for soundManager
        }
    );

Since SoundManager works via a flash object that’s loaded asynchronously, you need to wait for the `onready` callback before calling `Playdar.client.go()`, or else you may end up calling SoundManager functions before it’s ready.

The fourth optional argument is an object that lets you pass in <a href="http://www.schillmania.com/projects/soundmanager2/doc/#soundmanager-properties">extra options</a> to the soundManager JavaScript object.

Now you’ve set up the player, you’ve got a couple of methods available for registering and playing Playdar streams:

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
    
    // Stops a specific sound if it’s now playing
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

Calling these according to the [Scrobsub API](http://www.audioscrobbler.net/development/scrobsub/docs/html/class_scrob_submitter.html) will allow an authorised Playdar client with audioscrobbler capabilities to scrobble. The client’s capabilities are returned in the `stat` API method, which you can setup an `onStat` callback to handle.