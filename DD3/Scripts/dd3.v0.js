/**
*   Version 0.0.1
*/

var peerObject = { key: 'q35ylav1jljo47vi', debug: 0 };


var dd3 = (function () {
    "use strict";
    var _dd3 = Object.create(d3);


    var state = (function () {
        var _state = 'loading';
        return function (newState) {
            if (arguments.length == 0) return _state;

            if (newState === 'connecting') {
                _state = 'connecting';
            } else if (newState === 'ready') {
                _state = 'ready';
                log('DD3 is ready !', 1);
            } else if (newState === 'fatal') {
                _state = 'fatal';
            } else {
                return false;
            }

            callbackListener[newState].forEach(function (f) { f(); });
            return true;
        };
    })();

    var callbackListener = {
        connecting: [],
        ready: [],
        fatal: []
    };

    var data = {};

    var signalR = {
        server: null,
        client: null,
        syncCallback: function () { }
    };

    var peer = {
        id: null,
        peers: [],
        connections: [],
        buffers: [],

        connect: function () { },
        receive: function () { },
        sendTo: function () { },
        flush: function () { }
    };

    var cave = {
        width: 0, // Computed from server data
        height: 0, // Computed from server data
        margin: {
            top: 0,
            bottom: 0,
            left: 0,
            right: 0
        }
    };

    var browser = {
        number: null,
        width: 1280 / 4, //$(this).width();
        height: 720 / 2 / 1, //$(this).height();
        margin: {
            top: 0,
            bottom: 0,
            left: 0,
            right: 0
        }
    };
    
    var syncTime;

    var initializer = (function () {
        /*
			Connect to peer server => Get peerId
			Connect to signalR server => Send browser information
									  => Receive configuration
			Connect to data api => Get data and metadata [emulated in js]
		*/

        var init = function () {
            if (!init.checkLibraries()) {
                state("fatal")
                return;
            }

            state('connecting');
            init.setBrowserConfiguration();
            init.connectToPeerServer(init.connectToSignalRServer);
            //init.getDataDimensions();
        };

        init.checkLibraries = function () {
            var toCheck = ['d3', 'Peer', 'jQuery', ['jQuery', 'signalR']];

            var check = toCheck.some(function (lib, i) {
                var ok = false;
                if (typeof lib === 'string' && typeof window[lib] === "undefined") {
                    log("Initialization failed : " + lib + " was not found", 4);
                    ok = true;
                } else if (typeof lib === 'object') {
                    var path = window;
                    ok = lib.some(function (l) {
                        if (!(path = path[l])) {
                            log("Initialization failed : " + l + " was not found", 4);
                            return true;
                        }
                        return false;
                    });
                    toCheck[i] = lib.join('.');
                }
                return ok;
            });

            if (check)
                return false;

            log("All Libraries successfully loaded\n[" + toCheck.join(', ') + ']', 1);
            return true;
        };

        init.setBrowserConfiguration = function () {
            var conf = api.getConf();

            browser.initColumn = +getUrlVar('column');
            browser.initRow = +getUrlVar('row');
            browser.number = +getUrlVar('number');

            cave.margin = conf.margin;
        };

        init.connectToPeerServer = function (callback) {

            var p = peer.peer = new Peer(peerObject);

            p.on('open', function (id) {
                log('Connected to peer server - id : ' + id, 1);
                peer.id = id;

                p.on('connection', function (c) {
                    // My previous mistake was to think that the 'connection' event was equivalent to the 'open' one.
                    // When 'connection' is fired, the connection is not yet ready to use :/
                    // Previous loss of data : the buffering in peer.js seems not to work anymore,
                    // and data have to be sent when connection is opened
                    // We have to wait for the 'open' event to be triggered to launch connection
                    c.on("open", function () { peer.connect(c); });
                });

                callback();
            });

            p.on("error", function (e) {
                if (e.type === "network" || e.type === "unavailable-id") {
                    log("[Peer] " + e, 4);
                    state("fatal");
                } else {
                    log("[Peer] " + e, 3);
                }

            });

            window.onunload = window.onbeforeunload = function (e) {
                if (!!peer.peer && !peer.peer.destroyed) {
                    peer.peer.destroy();
                }
            };
        };

        init.connectToSignalRServer = function () {
            var dd3Server = $.connection.dd3Hub;

            signalR.server = dd3Server.server;
            signalR.client = dd3Server.client;

            dd3Server.client.receiveConfiguration = init.getCaveConfiguration;
            dd3Server.client.synchronize = function () {
                signalR.syncCallback.apply(null)
            };

            $.connection.hub.error(function (error) {
                console.log('SignalR error: ' + error, 2)
            });

            $.connection.hub.start()
                .fail(function () { log('Unable to connect to signalR server', 2); })
                .done(function () {
                    log("Connected to signalR server", 1);
                    log("Waiting for everyone to connect", 1);

                    var thisInfo = {
                        browserNum: browser.number,
                        peerId: peer.id,
                        row: browser.initRow,
                        col: browser.initColumn,
                        height: browser.height,
                        width: browser.width
                    };

                    dd3Server.server.updateInformation(thisInfo);
                });
        };

        init.getCaveConfiguration = function (sid, obj) {
            log("Receiving connected browsers' ids from signalR server", 1);

            signalR.sid = sid;
            syncTime = Date.now();
            var peersInfo = JSON.parse(obj);
            var maxCol, minCol, maxRow, minRow;

            minCol = d3.min(peersInfo, d('col', true));
            maxCol = d3.max(peersInfo, d('col', true));
            minRow = d3.min(peersInfo, d('row', true));
            maxRow = d3.max(peersInfo, d('row', true));

            cave.rows = maxRow - minRow + 1;
            cave.columns = maxCol - minCol + 1;

            browser.column = browser.initColumn - minCol;
            browser.row = browser.initRow - minRow;

            peersInfo.forEach(function (p) {
                p.initColumn = +p.col;
                p.initRow = +p.row;
                p.col = p.initColumn - minCol;
                p.row = p.initRow - minRow;
            });

            peer.peers = peersInfo;
            peer.connections = d3.range(0, cave.rows).map(function () { return []; });
            peer.buffers = d3.range(0, cave.rows).map(function () { return []; });

            cave.width = cave.columns * browser.width;
            cave.height = cave.rows * browser.height;

            cave.svgWidth = cave.width - cave.margin.left - cave.margin.right;
            cave.svgHeight = cave.height - cave.margin.top - cave.margin.bottom;

            browser.margin = {
                top: Math.max(cave.margin.top - browser.row * browser.height, 0),
                left: Math.max(cave.margin.left - browser.column * browser.width, 0),
                bottom: Math.max(cave.margin.bottom - (cave.rows - browser.row - 1) * browser.height, 0),
                right: Math.max(cave.margin.right - (cave.columns - browser.column - 1) * browser.width, 0)
            };

            browser.svgWidth = Math.max(browser.width - browser.margin.left - browser.margin.right, 0);
            browser.svgHeight = Math.max(browser.height - browser.margin.top - browser.margin.bottom, 0);

            launch();
        };

        init.getDataDimensions = function () {
            log("Getting Data dimensions from api", 1);
            data.dataDimensions = api.getDataDimensions();
            return data.dataDimensions;
        };

        init.data = {};

        init.data.getBounds = function (scaleX, scaleY) {

            var d = data.dataDimensions;
            var p = _dd3.position('svg', 'local', 'svg', 'global');
            var domainX = scaleX ? scaleX.domain().slice() : [d.x.min, d.x.max],
				rangeX = scaleX ? scaleX.range().slice() : [0, cave.svgWidth],
				domainY = scaleY ? scaleY.domain().slice() : [d.y.min, d.y.max],
				rangeY = scaleY ? scaleY.range().slice() : [cave.svgHeight, 0];

            var invX = 1, invY = 1;

            if (domainX[0] > domainX[1]) {
                domainX.reverse();
                invX *= -1;
            }
            if (rangeX[0] > rangeX[1]) {
                rangeX.reverse();
                invX *= -1;
            }
            if (domainY[0] > domainY[1]) {
                domainY.reverse();
                invY *= -1;
            }
            if (rangeY[0] > rangeY[1]) {
                rangeY.reverse();
                invY *= -1;
            }

            var limit = {};
            var minX = Math.max(p.left(0), rangeX[0]),
				maxX = Math.min(p.left(browser.svgWidth), rangeX[1]),
				minY = Math.max(p.top(0), rangeY[0]),
				maxY = Math.min(p.top(browser.svgHeight), rangeY[1]);

            if (invX > 0) {
                limit.xmin = domainX[0] + (minX - rangeX[0]) / (rangeX[1] - rangeX[0]) * (domainX[1] - domainX[0]);
                limit.xmax = domainX[0] + (maxX - rangeX[0]) / (rangeX[1] - rangeX[0]) * (domainX[1] - domainX[0]);
            } else {
                limit.xmin = domainX[0] + (rangeX[1] - maxX) / (rangeX[1] - rangeX[0]) * (domainX[1] - domainX[0]);
                limit.xmax = domainX[0] + (rangeX[1] - minX) / (rangeX[1] - rangeX[0]) * (domainX[1] - domainX[0]);
            }

            if (invY > 0) {
                limit.ymin = domainY[0] + (minY - rangeY[0]) / (rangeY[1] - rangeY[0]) * (domainY[1] - domainY[0]);
                limit.ymax = domainY[0] + (maxY - rangeY[0]) / (rangeY[1] - rangeY[0]) * (domainY[1] - domainY[0]);
            } else {
                limit.ymin = domainY[0] + (rangeY[1] - maxY) / (rangeY[1] - rangeY[0]) * (domainY[1] - domainY[0]);
                limit.ymax = domainY[0] + (rangeY[1] - minY) / (rangeY[1] - rangeY[0]) * (domainY[1] - domainY[0]);
            }

            return limit;
        };

        // Way to much functions for requesting data, don't you think ?
        // I will find a good way out of that soon :)

        init.data.getData = function (scaleX, scaleY) {

            data.dataPoints = api.getData(init.data.getBounds(scaleX, scaleY));

            return data.dataPoints;
        };

        init.data.getPathData = function (scaleX, scaleY) {

            data.pathDataPoints = api.getPathData(init.data.getBounds(scaleX, scaleY));

            return data.pathDataPoints;
        };

        init.data.getBarData = function (scale, key, orientation) {

            orientation = orientation || "bottom";

            var r = scale.range(),
		        slsg = _dd3.position('svg', 'local', 'svg', 'global')[orientation === "bottom" || orientation === "top" ? 'left' : 'top'],
		        limit = {};

            // To improve ...
            data.barDataPoints = [];

            if (orientation === "bottom" && browser.row === cave.rows - 1 ||
                orientation === "top" && browser.row === 0 ||
                orientation === "left" && browser.column === 0 ||
                orientation === "right" && browser.column === cave.column - 1) {

                //To improve... some bars might not be displayed

                limit.min = d3.bisect(r, slsg(0) - scale.rangeBand() / 2);
                limit.max = d3.bisect(r, slsg(browser[orientation === "bottom" || orientation === "top" ? 'svgWidth' : 'svgHeight']) - scale.rangeBand() / 2);

                data.barDataPoints = api.getBarData(limit, key);
            }

            return data.barDataPoints;
        };

        init.data.getPieData = function (centerX, centerY) {
            var sgsl = _dd3.position('svg', 'global', 'svg', 'local');
            if (sgsl.left(centerX) >= 0 && sgsl.left(centerX) < browser.width)
                if (sgsl.top(centerY) >= 0 && sgsl.top(centerY) < browser.height)
                    return api.getPieData();
            return [];
        }

        return init;

    })();

    // Create every dd3 functions	
    var launch = function () {

        /**
		 * dd3.position
		 */

        function sumWith(s, sign) {
            return function (x) { return x + sign * s; };
        }

        _dd3.position = function (context1, range1, context2, range2) {
            var p = {};
            if (context1 === context2) {
                var f = dd3.position[(context1 === 'html') ? 'html' : 'svg'];
                var sign = (range1 == range2) ? 0 : (range1 == 'local') ? 1 : -1;
                p.left = sumWith(f.left, sign);
                p.top = sumWith(f.top, sign);
            } else if (range1 === range2) {
                var f = ((range1 === 'local') ? browser : cave).margin;
                var sign = (context1 === 'html') ? -1 : 1;
                p.left = sumWith(f.left, sign);
                p.top = sumWith(f.top, sign);
            } else {
                var f = _dd3.position(context1, range1, context1, range2);
                var g = _dd3.position(context1, range2, context2, range2);
                p.left = function (x) { return g.left(f.left(x)); };
                p.top = function (x) { return g.top(f.top(x)); };
            }
            return p;
        };

        _dd3.position.svg = {
            left: browser.column * browser.width - cave.margin.left + browser.margin.left,
            top: browser.row * browser.height - cave.margin.top + browser.margin.top
        };

        _dd3.position.html = {
            left: browser.column * browser.width,
            top: browser.row * browser.height
        };


        // Most used functions already computed ... time saving !
        var hghl = _dd3.position('html', 'global', 'html', 'local'),
            hlhg = _dd3.position('html', 'local', 'html', 'global'),
            hlsg = _dd3.position('html', 'local', 'svg', 'global'),
		    sghg = _dd3.position('svg', 'global', 'html', 'global'),
	        slsg = _dd3.position('svg', 'local', 'svg', 'global');


        /**
         * Create the svg and provide it for use
         */

        _dd3.svgCanvas = d3.select("body").append("svg")
		    .attr("width", browser.width)
		    .attr("height", browser.height)
		    .append("g")
		    .attr("transform", "translate(" + [browser.margin.left - slsg.left(0), browser.margin.top - slsg.top(0)] + ")");

        /**
         * Peer functions
         * dataHandler
         */

        //To Do, problem of double connection to same peer
        peer.connect = function (c) {
            log("Connection with established Peer : " + c.peer, 0);

            peer.peers.some(function (p) {
                if (p.peerId === c.peer) {
                    c.on("data", function () { peer.receive.apply(this, arguments); });
                    // Once we are connected : 
                    //  -> we save the connection in the 2 dimensional array representing the cave
                    peer.connections[p.row][p.col] = c;
                    //  -> we flush the buffered data
                    peer.flush(p.row, p.col);
                    return true;
                }
                return false;
            });
        };

        peer.sendTo = function (r, c, data, buffer) {
            var conn;

            if (typeof peer.connections[r][c] === "undefined") {

                // Try to find peer with r and c as row and column - use Array.some to stop when found
                var check = peer.peers.some(function (p) {
                    if (+p.col === +c && +p.row === +r) {
                        conn = peer.peer.connect(p.peerId, { reliable: true });
                        conn.on("open", function () { peer.connect(conn); });
                        peer.connections[r][c] = true;
                        peer.buffers[r][c] = [];
                        return true;
                    }
                    return false;
                })

                // If there is no such peer
                if (!check)
                    return false;
            }

            // If connection is being established or we asked to buffer, we buffer - else we send
            if (peer.connections[r][c] === true || buffer) {
                peer.buffers[r][c].push(data);
            } else {
                peer.connections[r][c].send(data);
            }

            return true;
        };

        peer.flush = function (r, c) {
            var b = peer.buffers[r][c],
                co = peer.connections[r][c];
            if (b && b.length > 0 && co && co.open) {
                co.send(b);
                peer.buffers[r][c] = [];
                return true;
            }
            return false;
        };

        peer.receive = function (data) {
            if (data instanceof Array) {
                data.forEach(peer.receive);
                return;
            }

            log("Receiving an object...");
            switch (data.type) {
                case 'shape':
                    _dd3_plotter(data);
                    break;
                case 'property':
                    _dd3_propertyUpdater(data);
                    break;
                default:
                    log(data, 2);
            }
        };

        var _dd3_plotter = function (data) {

            if (data.action === "exit") {
                var g = d3.select(getContainingGroup(d3.select("#" + data.sendId).node()));
                if (!g.empty() )
                    g.remove();
                return;
            }

            var svg = d3.select("svg"), // To-Do : Make sure to select the right svg if many ... 
                g = d3.select(data.container);

            // If id of the container doesn't exist in the receiver dom, take 'svg g' instead
            g = g.empty() ? svg.select("g") : g;

            // Get the group container ctm and create a new matrix for the incoming svg object
            var gCtm = g.node().getCTM(),
                ctm = svg.node().createSVGMatrix();

            // Convert the global translate parameter to local one
            data.ctm.e = hghl.left(+data.ctm.e);
            data.ctm.f = hghl.top(+data.ctm.f);

            // ctm = data.ctm
            copyCTMFromTo(data.ctm, ctm);
            // The svg object will be placed in the group. To keep its position and orientation,
            // we applied the inverse transformation of the one that will be applied to it
            // by the container group transform attribute.
            ctm = gCtm.inverse().multiply(ctm);

            var obj;
            if ((obj = d3.select("#" + data.sendId)).empty()) {

                // Make it clean by appending the svg object into a group to which we apply the transformation
                g.append("g")
                    .attr("transform", "matrix(" + [ctm.a, ctm.b, ctm.c, ctm.d, ctm.e, ctm.f] + ")")
                    .append(data.name)
                    .attr(data.attr)
                    .html(data.html)
                    .attr("id", data.sendId);

            } else {
                g = d3.select(getContainingGroup(obj.node()));
                g.attr("transform", "matrix(" + [ctm.a, ctm.b, ctm.c, ctm.d, ctm.e, ctm.f] + ")")
                obj.attr(data.attr)
                   .html(data.html);
            }
        };

        var _dd3_propertyUpdater = function (data) {
            if (data.action !== 'update') {
                _dd3_plotter(data);
                return;
            }

            var obj;
            if (!(obj = d3.select("#" + data.sendId)).empty()) {
                obj[data.function](data.property, data.value);
            }
        }

        /**
		 * Hook helper functions for d3
		 */

        var _dd3_hook_d3 = function (hook, newObj) {
            var a = function () {
                if (!arguments.length) return hook();
                hook.apply(this, arguments);
                return newObj;
            };
            return a;
        };

        var _dd3_hook_basic = function (hook) {
            var a = function () {
                return hook.apply(this, arguments);
            };
            return a;
        };

        var _dd3_hookD3Object = function (oldObj, newObj) {
            for (var func in oldObj) {
                if (oldObj.hasOwnProperty(func)) {
                    newObj[func] = _dd3_hook_d3(oldObj[func], newObj);
                }
            }
        };

        var _dd3_hookObject = function (oldObj, newObj) {
            for (var func in oldObj) {
                if (oldObj.hasOwnProperty(func)) {
                    newObj[func] = _dd3_hook_basic(oldObj[func]);
                }
            }
        };

        /**
         * dd3.synchronize
         */

        // Send a message to server to synchronize after the optionnal timeout,
        // the callback is then triggered by the server on every browsers approximately simultaneously
        _dd3.synchronize = (function () {
            var nop = function () { };

            return function (_, t) {
                _ = typeof _ === "function" ? _ : nop;
                signalR.syncCallback = function () {
                    syncTime = Date.now();
                    log("Synchronized !", 0);
                    setTimeout(_, t || 0);
                }
                signalR.server.synchronize(signalR.sid);
            }
        })();

        /**
		 * dd3.scale : deprecated - old implementation
		 */

        _dd3.scale = Object.create(d3.scale);

        var _dd3_scale_toLocal = function (side, d3_scale) {
            var a = function () {
                var f = _dd3.position('svg', 'global', 'svg', 'local')[side],
			        g = _dd3.position('svg', 'local', 'svg', 'global')[side];

                var dd3_scale = function (x) {
                    return f(d3_scale(x));
                };

                _dd3_hookD3Object(d3_scale, dd3_scale);
                dd3_scale.ticks = _dd3_hook_basic(d3_scale.ticks);
                dd3_scale.tickFormat = _dd3_hook_basic(d3_scale.tickFormat);
                dd3_scale.invert = function (x) {
                    return d3_scale.invert(g(x));
                };

                return dd3_scale;
            };
            return a;
        };

        _dd3.scale.linear = function () {
            var scale = d3.scale.linear();
            scale.toLocalLeft = _dd3_scale_toLocal('left', scale);
            scale.toLocalTop = _dd3_scale_toLocal('top', scale);
            return scale;
        };

        /**
		 * dd3.svg.axis : deprecated - old implementation
		 */

        _dd3.svg = Object.create(d3.svg);

        _dd3.svg.axis = function () {
            var d3_axis = d3.svg.axis();
            var f = _dd3.position('svg', 'global', 'svg', 'local');

            var dd3_axis = function (g) {
                g.each(function () {
                    var g = d3.select(this);
                    var t = d3.transform(g.attr("transform"));
                    var left = f.left(t.translate[0]),
						top = f.top(t.translate[1]),
						rotate = t.rotate,
						scale = t.scale;

                    g.attr("transform", "translate(" + [left, top] + ") rotate(" + rotate + ") scale(" + scale + ")");
                });
                return d3_axis(g);
            };

            _dd3_hookD3Object(d3_axis, dd3_axis);

            return dd3_axis;
        };

        /**
		* dd3.selection
		*/

        _dd3.selection = d3.selection;

        // To hook : attr, style, html, text.

        var _dd3_hook_attr = d3.selection.prototype.attr;
        _dd3.selection.prototype.attr = function () {
            if (arguments.length < 2)
                return _dd3_hook_attr.apply(this, arguments);
            _dd3_hook_attr.apply(this, arguments);

            var e = this.filter(function (d, i) {
                return !!this.__watch__;
            })

            if(!e.empty())
                e.send('attr', arguments[0]);

            return this;
        };

        var _dd3_getSelections = function (newSelection, oldSelection) {
            var ns = newSelection.slice(),
		        os = oldSelection.slice();

            var enter = [],
                update = [],
                exit = [],
		        i;

            var contain = function (a, v) {
                var r = -1;
                a.some(function (d, i) {
                    if (d[0] === v[0] && d[1] === v[1]) {
                        r = i;
                        return true;
                    }
                    return false;
                });
                return r;
            }

            ns.forEach(function (d) {
                if ((i = contain(os, d)) >= 0) {
                    update.push(os.splice(i, 1)[0]);
                }
                else {
                    enter.push(d);
                }
            });

            exit = os;

            return [enter, update, exit];
        }

        // Find all browsers which MAY need to receive the element :
        // Take the bounding rectangle and find browsers at the extremities of it
        // Add as recipients every browsers inside the 4 browsers found above
        // We in fact need only 2 browsers as they already form a rectangle
        var _dd3_findRecipients = function (el) {
            var rcpt = [];
            var rect = el.getBoundingClientRect();

            if (rect.bottom > browser.height || rect.top < 0 || rect.right > browser.width || rect.left < 0) {
                var f = hlhg,
                    topLeft = _dd3_findBrowserAt(f.left(rect.left), f.top(rect.top), 'html'),
		            bottomRight = _dd3_findBrowserAt(f.left(rect.right), f.top(rect.bottom), 'html');

                for (var i = Math.max(topLeft[0], 0), maxR = Math.min(bottomRight[0], cave.rows - 1) ; i <= maxR ; i++) {
                    for (var j = Math.max(topLeft[1], 0), maxC = Math.min(bottomRight[1], cave.columns - 1) ; j <= maxC; j++) { // Check to simplify
                        if (i != browser.row || j != browser.column) {
                            rcpt.push([i, j]);
                        }
                    }
                }
            }

            return rcpt;
        };

        var _dd3_findBrowserAt = function (left, top, context) {
            context = context || 'svg';

            if (context === "svg") {
                left = sghg.left(left);
                top = sghg.top(top);
            }

            var pos = [];
            pos[0] = ~~(top / browser.height);
            pos[1] = ~~(left / browser.width);

            return pos;
        };

        // Take the first array of recipients and add to the second one all those which are not already in it
        var _dd3_mergeRecipientsIn = function (a, b) {
            var chk;
            a.forEach(function (c) {
                chk = b.some(function (d) {
                    return (c[0] === d[0] && c[1] === d[1]);
                });

                if (!chk) {
                    b.push(c);
                }
            });
        };

        _dd3.selection.prototype.send = function (funcName, propName) {
            var counter = 0, formerRcpts, rcpt, rcpts = [], objs, selections;

            this.each(function (d, i) {
                // Get former recipients list saved in the __recipients__ variable to send them 'exit' message
                formerRcpts = typeof this.__recipients__ === "undefined" ? [] : this.__recipients__;
                // Get current recipients - See above the function _dd3_findRecipients for more info
                rcpt = this.__recipients__ = _dd3_findRecipients(this);
                // Create (enter,update,exit) selections with the recipients - See above the function _dd3_getSelections for more info
                selections = _dd3_getSelections(rcpt, formerRcpts);

                if (rcpt.length > 0 || formerRcpts.length > 0) {
                    // Create the object to send
                    objs = _dd3_dataFormatter(this, funcName ? 'property' : 'shape', selections, funcName, propName);
                    // Send it to all who may have to plot it
                    rcpt = _dd3_dataSender(objs, selections);
                    // Save all recipients to flush buffer for them afterwards
                    _dd3_mergeRecipientsIn(rcpt, rcpts);
                    counter += rcpt.length;
                }
            });

            // If we chose to buffer, then we need to flush buffers for recipients !
            rcpts.forEach(function (d) { peer.flush(d[0], d[1]); });

            log("Sending " + counter + " objects...");
            // We may choose to return only sent objects ... to be decided !
            return this;
        };

        var _dd3_dataFormatter = (function () {
            var sendId = 0,
                actions = ['enter', 'update', 'exit'];

            var createShapeObject = function (obj, elem) {
                var idContainer = getIdentifiedContainer(elem, false),
                       ctm = elem.getCTM();

                /*
                obj = {
                    action: null,
                    name: null,
                    attr: null,
                    html: null,
                    ctm: null,
                    container: null
                };
                */

                obj.attr = getAttr(elem);
                obj.name = elem.nodeName;
                obj.html = elem.innerHTML;

                // Make the translation parameter global to send it to others
                ctm.e = hlhg.left(ctm.e);
                ctm.f = hlhg.top(ctm.f);

                // Remove any transformation on the object as we handle it with the ctm
                obj.attr.transform = null;

                // Matrix CTM not sendable with peer.js, just copy the parameter into a normal object
                copyCTMFromTo(ctm, obj.ctm = {});
                // Remember the container to keep the drawing order (superposition)
                obj.container = idContainer;
            };

            var createPropertyObject = function (obj, elem, f, p) {
                obj.function = f;

                switch (f) {
                    case 'attr':
                        obj.property = p;
                        obj.value = elem.attributes[p].nodeValue;
                        break;
                }
            };

            return function (elem, type, selections, f, p) {

                // Bound sendId to the sent shape to be able to retrieve it later in recipients' dom
                elem.__sendId__ = typeof elem.__sendId__ === "undefined" ? sendId++ : elem.__sendId__;

                var objs = [],
                    obj = {
                    type: type,
                    sendId : "dd3_" + browser.row + '-' + browser.column + "_" + elem.__sendId__
                };

                selections.forEach(function (s, i) {
                    if (s.length == 0) {
                        objs.push(false);
                        return;
                    }

                    var objTemp = clone(obj);
                    objTemp.action = actions[i];

                    if (i === 0) { // If enter, in both cases we send a new shape
                        createShapeObject(objTemp, elem);
                    } else if (i === 1) { // If update...
                        if (type === 'shape') { // If we want to send the shape...
                            createShapeObject(objTemp, elem);
                        } else if (type === 'property') { // otherwise, if we just want to update a property ...
                            createPropertyObject(objTemp, elem, f, p);
                        }
                    }

                    objs.push(objTemp);
                });

                return objs;
            };

        })();

        var _dd3_dataSender = function (objs, selections) {
            // Allow to do something special for each selection (enter, update, exit) of recipients
            selections.forEach(function (s, i) {
                s.forEach(function (d) {
                    peer.sendTo(d[0], d[1], objs[i], true); // true for buffering 
                });
            });

            return d3.merge(selections);
        };

        _dd3.selection.prototype.watch = function () {
            this.send();
            this.each(function (d, i) {
                this.__watch__ = true;
            });
        };

        _dd3.selection.prototype.unwatch = function () {
            this.each(function (d, i) {
                this.__watch__ = false;
            });
        };

        /**
		 * Getter
		 */

        _dd3.dataPoints = function () { return data.dataPoints.slice(); };

        _dd3.dataDimensions = function () { initializer.getDataDimensions(); return clone(data.dataDimensions); };

        _dd3.peers = function () { return extend({}, peer); };

        _dd3.cave = function () { return clone(cave); };

        _dd3.browser = function () { return clone(browser); };

        _dd3.getData = initializer.data.getData;

        _dd3.getPathData = initializer.data.getPathData;

        _dd3.getBarData = initializer.data.getBarData;

        _dd3.getPieData = initializer.data.getPieData;

        _dd3.state = function () { return state(); };

        // We could re-synchronize before emitting the 'ready' event
        state('ready');
    };

    /**
	 * Initialize
	 */

    initializer();

    /**
	* Provide listener function to listen for ready state !
	*/

    _dd3.on = function (p, f) {
        if (typeof callbackListener[p] !== "undefined") {
            callbackListener[p].push(f);
            return true;
        }
        return false;
    };

    return _dd3;
})();


/*
Recent fix, for temporary memory if needed

var int = setInterval(function () {
    log("Connection state : " + (c.open ? "Open " : "Closed ") + browser.row + "," + browser.column);
    if (c.open) {
        clearInterval(int);
        //c.send("Hi it's (" + browser.row + "," + browser.column + ")");
        c.send(data);
    }
}, 100);
*/