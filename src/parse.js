Playdar.Parse = {
    getProperty: function (collection, prop) {
        var prop = prop || 'innerHTML';
        var i, coll, property;
        for (i = 0; i < collection.length; i++) {
            coll = collection[i];
            property = coll[prop] || coll.getAttribute(prop);
            if (property) {
                return property;
            }
        }
        return;
    },
    getValue: function (collection) {
        var i, coll, value;
        for (i = 0; i < collection.length; i++) {
            coll = collection[i];
            value = Playdar.Util.select('.value', coll);
            if (value.length) {
                return Playdar.Parse.getContentWithoutValue(value);
            }
        }
        return;
    },
    getContentWithoutValue: function (collection) {
        return Playdar.Parse.getProperty(collection, 'content')
            || Playdar.Parse.getProperty(collection, 'title')
            || Playdar.Parse.getProperty(collection);
    },
    getContent: function (collection) {
        var content = Playdar.Parse.getValue(collection)
                   || Playdar.Parse.getContentWithoutValue(collection);
        if (content) {
            return content.replace(/(^\s*)|(\s*$)/g, '');
        }
        return;
    },
    getPosition: function (trackNode) {
        // Extract position from ordered list
        var currentNode = trackNode;
        var elderSiblings = 0;
        if (trackNode.nodeName == 'LI' && trackNode.parentNode.nodeName == 'OL') {
            // Loop back through siblings and count how many come before
            while (currentNode.previousSibling) {
                currentNode = currentNode.previousSibling;
                if (currentNode.nodeName == 'LI') {
                    elderSiblings++;
                }
            }
            return elderSiblings + 1;
        }
        return;
    },
    getNS: function (node, url) {
        for (var i = 0; i < node.attributes.length; i++) {
            var attr = node.attributes[i];
            if (attr.nodeValue == url) {
                return attr.nodeName.replace('xmlns:', '');
            }
        }
    },
    /**
     * Playdar.Parse.getExc(exclude, selector)
     * - exclude (String): CSS selector to exclude results from
     * - selector (String): CSS selector we're looking for
     * 
     * Get a pseudo-selector part that excludes from a selector any results
     * contained within the exclude selector
    **/
    getExc: function (exclude, selector) {
        return ':not(' + exclude + ' ' + selector + ')';
    },
    
    microformats: function (context) {
        var sel = Playdar.Util.select;
        function selExcRec (selector, context) {
            return sel(selector + Playdar.Parse.getExc('.item', selector), context);
        }
        
        function getBuyData (context, rec) {
            var buySel = rec ? sel : selExcRec;
            var buyURL = Playdar.Parse.getProperty(buySel('.payment', context), 'href')
                      || Playdar.Parse.getProperty(buySel('[rel~=payment]', context), 'href');
            if (!buyURL) {
                return;
            }
            return {
                url: buyURL,
                currency: Playdar.Parse.getContent(buySel('.price .currency', context)),
                amount: Playdar.Parse.getContent(buySel('.price .amount', context))
            };
        }
        function getTrackData (tracks, artist, album) {
            var data = [];
            var i, track;
            for (i = 0; i < tracks.length; i++) {
                if (!tracks[i].playdarParsed) {
                    track = {
                        title: Playdar.Parse.getContent(sel('.fn', tracks[i]))
                            || Playdar.Parse.getContent(sel('.title', tracks[i])),
                        artist: Playdar.Parse.getContent(sel('.contributor', tracks[i]))
                             || artist,
                        album: album,
                        position: Playdar.Parse.getContent(sel('.position', tracks[i]))
                               || Playdar.Parse.getPosition(tracks[i]),
                        duration: Playdar.Parse.getContent(sel('.duration', tracks[i])),
                        buy: getBuyData(tracks[i], true),
                        element: tracks[i]
                    };
                    data.push(track);
                    tracks[i].playdarParsed = true;
                }
            }
            return data;
        }
        
        function getArtist (context) {
            // Check the .contributor property for .fn or innerHTML
            var artist = selExcRec('.contributor', context);
            var artistName = Playdar.Parse.getContent(sel('.fn', artist[0]));
            if (!artistName) {
                artistName = Playdar.Parse.getContent(artist);
            }
            return artistName;
        }
        
        function getAlbums (context) {
            var data = [];
            var albums = sel('.haudio', context);
            var i, album_name, album_artist, album_tracks, album, item_artist, item_track, tracks;
            for (i = 0; i < albums.length; i++) {
                if (!albums[i].playdarParsed) {
                    album_name = Playdar.Parse.getContent(selExcRec('.album', albums[i]));
                    if (!album_name) {
                        continue;
                    }
                    album_artist = getArtist(albums[i]);
                    if (!album_artist) {
                        continue;
                    }
                    album_tracks = getTrackData(sel('.item', albums[i]), album_artist, album_name);
                    if (!album_tracks.length) {
                        continue;
                    }
                    data.push({
                        type: 'album',
                        title: album_name,
                        artist: album_artist,
                        tracks: album_tracks,
                        image: Playdar.Parse.getProperty(selExcRec('.photo', albums[i]), 'src')
                            || Playdar.Parse.getProperty(selExcRec('.photo', albums[i]), 'href'),
                        download: Playdar.Parse.getProperty(selExcRec('[rel~=enclosure]', albums[i]), 'href'),
                        released: Playdar.Parse.getContent(selExcRec('.published', albums[i])),
                        duration: Playdar.Parse.getContent(selExcRec('.duration', albums[i])),
                        buy: getBuyData(albums[i])
                    });
                    albums[i].playdarParsed = true;
                }
            }
            return data;
        }
        
        function getTrackLists (context) {
            var lists = getAlbums(context);
            var tracks = getTrackData(sel('.haudio'));
            if (tracks.length) {
                lists.push({
                    type: 'page',
                    title: window.document.title || window.location.href,
                    tracks: tracks
                });
            }
            return lists;
        }
        
        var lists = getTrackLists(context);
        return lists;
    },
    
    rdfa: function (context) {
        var sel = Playdar.Util.select;
        
        var htmlNode = sel('html')[0];
        var commerceNS = Playdar.Parse.getNS(htmlNode, 'http://purl.org/commerce#');
        var audioNS = Playdar.Parse.getNS(htmlNode, 'http://purl.org/media/audio#');
        var mediaNS = Playdar.Parse.getNS(htmlNode, 'http://purl.org/media#');
        var dcNS = Playdar.Parse.getNS(htmlNode, 'http://purl.org/dc/terms/')
                || Playdar.Parse.getNS(htmlNode, 'http://purl.org/dc/elements/1.1/');
        
        var foafNS = Playdar.Parse.getNS(htmlNode, 'http://xmlns.com/foaf/0.1/');
        var moNS = Playdar.Parse.getNS(htmlNode, 'http://purl.org/ontology/mo/');
        
        function selExcRec (selector, context) {
            var final_selector = selector;
            if (audioNS) {
                final_selector += Playdar.Parse.getExc('[typeof='+audioNS+':Recording]', selector);
            }
            if (moNS) {
                final_selector += Playdar.Parse.getExc('[typeof='+moNS+':Track]', selector);
            }
            return sel(final_selector, context);
        }
        
        if (!audioNS && !moNS) {
            return [];
        }
        
        function getBuyData (context, rec) {
            var buySel = rec ? sel : selExcRec;
            var buyURL = Playdar.Parse.getProperty(buySel('[rel~='+commerceNS+':payment]', context), 'href');
            if (!buyURL) {
                return;
            }
            return {
                url: buyURL,
                currency: Playdar.Parse.getContent(buySel('[rel~='+commerceNS+':costs] [property='+commerceNS+':currency]', context)),
                amount: Playdar.Parse.getContent(buySel('[rel~='+commerceNS+':costs] [property='+commerceNS+':amount]', context))
            };
        }
        
        function getTracks (context, artist, album) {
            var data = [];
            var selectors = [];
            if (audioNS) {
                selectors.push('[typeof='+audioNS+':Recording]');
            }
            if (moNS) {
                selectors.push('[typeof='+moNS+':Track]');
            }
            var tracks = selExcRec(selectors.join(','), context);
            var i, track;
            for (i = 0; i < tracks.length; i++) {
                if (!tracks[i].playdarParsed) {
                    track = {
                        title: Playdar.Parse.getContent(sel('[property='+dcNS+':title]', tracks[i])),
                        artist: Playdar.Parse.getContent(sel('[property='+dcNS+':creator], [rel~='+foafNS+':maker] [property='+foafNS+':name]', tracks[i]))
                             || artist,
                        album: Playdar.Parse.getContent(sel('[typeof='+moNS+':Record] [property='+dcNS+':title]'))
                            || album,
                        position: Playdar.Parse.getContent(sel('[property='+mediaNS+':position]', tracks[i]))
                               || Playdar.Parse.getPosition(tracks[i]),
                        duration: Playdar.Parse.getContent(sel('[property='+mediaNS+':duration]', tracks[i]))
                               || Playdar.Parse.getContent(sel('[property='+dcNS+':duration]', tracks[i])),
                        buy: getBuyData(tracks[i], true),
                        element: tracks[i]
                    };
                    data.push(track);
                    tracks[i].playdarParsed = true;
                }
            }
            return data;
        }
        
        function getArtist (context) {
            // Check the dc:creator property for foaf:name or innerHTML
            var artist = selExcRec('[property='+dcNS+':creator]', context);
            if (!artist.length) {
                artist = selExcRec('[rel~='+foafNS+':maker]', context);
            }
            var artistName;
            if (artist.length) {
                artistName = Playdar.Parse.getContent(sel('[property='+foafNS+':name]', artist[0]));
            }
            if (!artistName) {
                // Follow a link to a resource that describes the artist
                var artistLink = sel('[rel~='+dcNS+':creator]', context);
                var artistId = Playdar.Parse.getProperty(artistLink, 'resource');
                if (artistId) {
                    var resource = sel('[about='+artistId+']');
                    artistName = Playdar.Parse.getContent(sel('[property='+foafNS+':name]', resource[0]))
                              || Playdar.Parse.getContent(resource);
                }
            }
            if (!artistName) {
                artistName = Playdar.Parse.getContent(artist);
            }
            return artistName;
        }
        
        function getAlbums (context) {
            var data = [];
            var albums = sel('[typeof='+audioNS+':Album], [typeof='+moNS+':Record]', context);
            var i, album, album_name, album_artist, album_tracks;
            for (i = 0; i < albums.length; i++) {
                if (!albums[i].playdarParsed) {
                    album_name = Playdar.Parse.getContent(selExcRec('[property='+dcNS+':title]', albums[i]));
                    if (!album_name) {
                        continue;
                    }
                    album_artist = getArtist(albums[i]);
                    if (!album_artist) {
                        continue;
                    }
                    album_tracks = getTracks(albums[i], album_artist, album_name);
                    if (!album_tracks.length) {
                        continue;
                    }
                    data.push({
                        type: 'album',
                        title: album_name,
                        artist: album_artist,
                        tracks: album_tracks,
                        image: Playdar.Parse.getProperty(selExcRec('[rel~='+mediaNS+':depiction]', albums[i]), 'src')
                            || Playdar.Parse.getProperty(selExcRec('[rev~='+mediaNS+':depiction]', albums[i]), 'src'),
                        download: Playdar.Parse.getProperty(selExcRec('[rel~='+mediaNS+':download]', albums[i]), 'href'),
                        released: Playdar.Parse.getContent(selExcRec('[property='+dcNS+':issued]', albums[i]))
                               || Playdar.Parse.getContent(selExcRec('[property='+dcNS+':published]', albums[i]))
                               || Playdar.Parse.getContent(selExcRec('[property='+dcNS+':date]', albums[i])),
                        duration: Playdar.Parse.getContent(selExcRec('[property='+mediaNS+':duration]', albums[i]))
                               || Playdar.Parse.getContent(selExcRec('[property='+dcNS+':duration]', albums[i])),
                        buy: getBuyData(albums[i])
                    });
                    albums[i].playdarParsed = true;
                }
            }
            return data;
        }
        
        function getTrackLists (context) {
            var lists = getAlbums(context);
            var tracks = getTracks(context);
            if (tracks.length) {
                lists.push({
                    type: 'page',
                    title: window.document.title || window.location.href,
                    tracks: tracks
                });
            }
            return lists;
        }
        
        var lists = getTrackLists(context);
        return lists;
    }
};
