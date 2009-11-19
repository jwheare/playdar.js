Playdar.Util = {
    /**
     * Based on: Math.uuid.js
     * Copyright (c) 2008, Robert Kieffer. All rights reserved.
     * License and info: http://www.broofa.com/blog/2008/09/javascript-uuid-function/
    **/
    generate_uuid: function () {
        // Private array of chars to use
        var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');
        var uuid = [];
        var rnd = Math.random;
        
        // rfc4122, version 4 form
        var r;
        
        // rfc4122 requires these characters
        uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-';
        uuid[14] = '4';
        
        // Fill in random data.  At i==19 set the high bits of clock sequence as
        // per rfc4122, sec. 4.1.5
        for (var i = 0; i < 36; i++) {
            if (!uuid[i]) {
                r = 0 | rnd()*16;
                uuid[i] = chars[(i == 19) ? (r & 0x3) | 0x8 : r & 0xf];
            }
        }
        return uuid.join('');
    },
    
    // Query string helpers
    toQueryPair: function (key, value) {
        if (value === null) {
            return key;
        }
        return key + '=' + encodeURIComponent(value);
    },
    toQueryString: function (params) {
        var results = [];
        for (var key in params) {
            var value = params[key];
            key = encodeURIComponent(key);
            
            if (typeof(value) == 'object') {
                results.push(Playdar.Util.toQueryPair(key, JSON.stringify(value)));
            } else {
                results.push(Playdar.Util.toQueryPair(key, value));
            }
        }
        return results.join('&');
    },
    
    // format secs -> mm:ss helper.
    mmss: function (secs) {
        var s = secs % 60;
        if (s < 10) {
            s = "0" + s;
        }
        return Math.floor(secs/60) + ":" + s;
    },
    
    // JSON loader
    loadJs: function (url) {
       var s = document.createElement("script");
       s.src = url;
       document.getElementsByTagName("head")[0].appendChild(s);
    },
    
    // Cookie helpers
    setCookie: function (name, value, days) {
        var expires;
        if (days) {
            var date = new Date();
            date.setTime(date.getTime() + (days*24*60*60*1000));
            expires = "; expires=" + date.toGMTString();
        } else {
            expires = "";
        }
        document.cookie = name + "=" + value + expires + "; path=/";
    },
    getCookie: function (name) {
        var namekey = name + "=";
        var cookies = document.cookie.split(';');
        for (var i = 0; i < cookies.length;i++) {
            var c = cookies[i];
            while (c.charAt(0) == ' ') {
                c = c.substring(1, c.length);
            }
            if (c.indexOf(namekey) === 0) {
                return c.substring(namekey.length, c.length);
            }
        }
        return null;
    },
    deleteCookie: function (name) {
        Playdar.Util.setCookie(name, "", -1);
    },
    
    // Window dimension/position helpers
    getWindowPosition: function () {
        var location = {};
        if (window.screenLeft) {
            location.x = window.screenLeft || 0;
            location.y = window.screenTop || 0;
        } else {
            location.x = window.screenX || 0;
            location.y = window.screenY || 0;
        }
        return location;
    },
    getWindowSize: function () {
        return {
            'w': (window && window.innerWidth) || 
                 (document && document.documentElement && document.documentElement.clientWidth) || 
                 (document && document.body && document.body.clientWidth) || 
                 0,
            'h': (window && window.innerHeight) || 
                 (document && document.documentElement && document.documentElement.clientHeight) || 
                 (document && document.body && document.body.clientHeight) || 
                 0
        };
    },
    
    getPopupOptions: function (size) {
        var popupLocation = Playdar.Util.getPopupLocation(size);
        return [
            "left=" + popupLocation.x,
            "top=" + popupLocation.y,
            "width=" + size.w,
            "height=" + size.h,
            "location=yes",
            "toolbar=no",
            "menubar=yes",
            "status=yes",
            "resizable=yes",
            "scrollbars=yes"
        ].join(',');
    },
    getPopupLocation: function (size) {
        var windowLocation = Playdar.Util.getWindowPosition();
        var windowSize = Playdar.Util.getWindowSize();
        return {
            'x': Math.max(0, windowLocation.x + (windowSize.w - size.w) / 2),
            'y': Math.max(0, windowLocation.y + (windowSize.h - size.h) / 2)
        };
    },
    
    // http://ejohn.org/blog/flexible-javascript-events
    addEvent: function (obj, type, fn) {
        if (obj.attachEvent) {
            obj['e'+type+fn] = fn;
            obj[type+fn] = function () {
                obj['e'+type+fn](window.event);
            };
            obj.attachEvent('on'+type, obj[type+fn]);
        } else {
            obj.addEventListener(type, fn, false);
        }
    },
    // Event target helper
    getTarget: function (e) {
        e = e || window.event;
        return e.target || e.srcElement;
    },
    
    extendObject: function (destination, source) {
        source = source || {};
        for (var property in source) {
            destination[property] = source[property];
        }
        return destination;
    },
    
    mergeCallbackOptions: function (callbackOptions) {
        var optionMap = {};
        var keys = [];
        var i, options, optionName;
        // Loop through an array of option objects
        for (i = 0; i < callbackOptions.length; i++) {
            options = callbackOptions[i];
            // Process callback functions in each object
            for (optionName in options) {
                if (typeof (options[optionName]) == 'function') {
                    // Collect all matching option callbacks into one callback
                    if (!optionMap[optionName]) {
                        keys.push(optionName);
                        optionMap[optionName] = [];
                    }
                    optionMap[optionName].push(options);
                }
            }
        }
        var finalOptions = {};
        // Merge the mapped callback options
        for (i = 0; i < keys.length; i++) {
            var key = keys[i];
            // Pass in the scope because closures don't really work
            // with shared variables in a loop
            finalOptions[key] = (function (key, mappedOptions) {
                return function () {
                    // Call each function that's been mapped to this property
                    for (var j = 0; j < mappedOptions.length; j++) {
                        mappedOptions[j][key].apply(this, arguments);
                    }
                };
            })(key, optionMap[key]);
        }
        return finalOptions;
    },
    
    location_from_url: function (url) {
        // Create a dummy link to split out the url parts
        var dummy = document.createElement('a');
        dummy.href = url;
        var location = {};
        // Use the window.location to extract the location keys
        for (k in window.location) {
            if ((typeof(window.location[k]) === 'string')) {
                location[k] = dummy[k];
            }
        }
        return location;
    },
    
    log: function (response) {
        if (typeof console != 'undefined') {
            console.dir(response);
        }
    }
};
