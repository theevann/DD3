/**
*   Version 0.0.2
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
			Connect to data api => Get metadata [emulated in js]
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

                p.on('connection', function (conn) {
                    // Previous loss of data : the buffering in peer.js seems not to work anymore,
                    // and data have to be sent only when connection is opened (connection != open)
                    var r = +conn.metadata.initiator[0],
                        c = +conn.metadata.initiator[1];

                    // If there is already a connection, we allow only one connection to remain active
                    // The priority is given to higher row browsers, and if equal then higher colmun
                    if (peer.connections[r][c]) {
                        var priority = r > browser.row || (r === browser.row && c > browser.column);

                        if (!priority) {
                            conn.on("open", conn.close);
                            return;
                        }

                        peer.connections[r][c].open ?
                        peer.connections[r][c].close() :
                        peer.connections[r][c].removeAllListeners().on("open", peer.connections[r][c].close);
                    }

                    peer.connections[r][c] = conn;
                    peer.buffers[r][c] = peer.buffers[r][c] || [];
                    conn.on("open", peer.init.bind(null, conn, r, c));
                });

                callback();
            });

            p.on("error", function (e) {
                if (e.type === "network") {
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

        _dd3.svgNode = d3.select("body").append("svg");

        _dd3.svgCanvas = _dd3.svgNode
		    .attr("width", browser.width)
		    .attr("height", browser.height)
		    .append("g")
            .attr("id", "dd3_rootGroup")
		    .attr("transform", "translate(" + [browser.margin.left - slsg.left(0), browser.margin.top - slsg.top(0)] + ")");

        /**
         * Peer functions
         * dataHandler
         */

        peer.init = function (conn, r, c) {
            log("Connection established with Peer (" + [r,c] + "): " + conn.peer, 0);
            conn.on("data", peer.receive);
            peer.flush(r, c);
        };

        peer.connect = function (r, c) {
            r = +r;
            c = +c;

            // Try to find peer with r and c as row and column - use Array.some to stop when found
            return peer.peers.some(function (p) {
                if (+p.row !== r || +p.col !== c)
                    return false;

                var conn = peer.peer.connect(p.peerId, { reliable: true, metadata: { initiator: [browser.row, browser.column] } });
                conn.on("open", peer.init.bind(null, conn, r, c));
                peer.connections[r][c] = conn;
                peer.buffers[r][c] = [];
                return true;
            });
        };

        peer.sendTo = function (r, c, data, buffer) {

            if (typeof peer.connections[r][c] === "undefined" && !peer.connect(r, c)) {
                // If there is no such peer
                return false;
            }

            // If connection is being established or we asked to buffer, we buffer - else we send
            if (!peer.connections[r][c].open || buffer) {
                peer.buffers[r][c].push(data);
            } else {
                peer.connections[r][c].send(data);
            }

            return true;
        };

        peer.flush = function (r, c) {
            var buff = peer.buffers[r][c],
                conn = peer.connections[r][c];
            if (buff && buff.length > 0 && conn && conn.open) {
                conn.send(buff);
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

            switch (data.type) {
                case 'shape':
                    log("Receiving a new shape...");
                    _dd3_shapeHandler(data);
                    break;

                case 'property':
                    log("Receiving a property [" + data.function + (data.property ? (":" + data.property) : "") + "] update...");
                    _dd3_propertyHandler(data);
                    break;

                case 'remove':
                    log("Receiving an exiting shape...");
                    _dd3_removeHandler(data);
                    break;

                case 'transition':
                    log("Receiving a transition...");
                    _dd3_transitionHandler(data);
                    break;

                case 'endTransition':
                    log("Receiving a end transition event...");
                    _dd3_endTransitionHandler(data);
                    break;

                default:
                    log("Receiving an unsupported data : Aborting !", 2);
                    log(data, 2);
            }

        };

        var getIdFollower = function (g, id) {
            var elems = g.selectAll("#" + g.node().id + " > .dd3_received"),
                currentFollower = "z";

            elems[0].forEach(function (a) {
                if (a.id > id && a.id < currentFollower) {
                    currentFollower = a.id;
                }
            });

            return currentFollower;
        };

        var _dd3_shapeHandler = function (data) {
            var obj = d3.select("#" + data.sendId),
                g1 = d3.select("#" + data.containers.shift()), g2,
                c = false; // Whether the object was changed of group since last time

            if (g1.empty()) {
                log("One of the group received doesn't exist in the dom - An group with an id must exist in every browsers !", 2);
                return;
            }
            
            data.containers.forEach(function (o) {
                g2 = g1.select("#" + o.id);
                g1 = g2.empty() ? (c = true, g1.insert('g', '#' + getIdFollower(g1, o.id)).attr_(o)) : g2;
            });

            // Here we create an absolute ordering in one group
            if (obj.empty() || c) {
                obj.remove();
                obj = g1.insert(data.name, '#' + getIdFollower(g1, data.sendId));
            }

            obj.attr_(data.attr)
               .html_(data.html)
               .classed_('dd3_received', true)
               .attr_("id", data.sendId); // Here because attr can contain id
        };

        var _dd3_removeHandler = function (data) {
            return d3.select("#" + data.sendId).remove_();
        };

        var _dd3_propertyHandler = function (data) {
            var obj = d3.select("#" + data.sendId);
            
            if (!obj.empty()) {
                var args = typeof data.property !== "undefined" ? [data.property, data.value] : [data.value];
                obj[data.function].apply(obj, args)
                    .classed_('dd3_received', true)
                    .attr_("id", data.sendId);
            }
        };

        var _dd3_transitionHandler = function (data) {
            var obj = d3.select("#" + data.sendId);
            obj.interrupt(data.name);
            var trst =  _dd3_hook_selection_transition.call(obj, data.name);

            log("Delay taken: " + (data.delay + (syncTime + data.elapsed - Date.now())), 0);

            obj.attr_(data.start.attr)
               .style_(data.start.style);

            trst.attr(data.end.attr)
                .style(data.end.style)
                .duration(data.duration)
                .delay(data.delay + (syncTime + data.elapsed - Date.now()));

            if(data.ease)
                trst.ease(data.ease);
        };

        var _dd3_endTransitionHandler = function (data) {
            var obj = d3.select("#" + data.sendId);
            obj.interrupt(data.name);
            if (data.remove)
                _dd3_removeHandler(data);
        };

        /**
        *  ! Deprecated !
        */

        var _dd3_CTMUpdater = function (obj, g, dataCtm) {
            // Get the group container ctm and create a new matrix for the incoming svg object
            var gCtm = g.node().getCTM(),
                ctm = _dd3.svgNode.node().createSVGMatrix();

            // Convert the global translate parameter to local one
            dataCtm.e = hghl.left(+dataCtm.e);
            dataCtm.f = hghl.top(+dataCtm.f);

            // ctm = data.ctm
            copyCTMFromTo(dataCtm, ctm);

            // The svg object will be placed in the group. To keep its position and orientation,
            // we applied the inverse transformation of the one that will be applied to it
            // by the container group transform attribute.
            ctm = gCtm.inverse().multiply(ctm);

            d3.select(getContainingGroup(obj.node()))
              .attr("transform", "matrix(" + [ctm.a, ctm.b, ctm.c, ctm.d, ctm.e, ctm.f] + ")");
        };

        /**
		 *  Hook helper functions for d3
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

        var _dd3_default = function (value, def) {
            return typeof value === "undefined" ? def : value;
        };

        /**
         *  dd3.synchronize
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
                    _();
                }
                setTimeout(function () {
                    signalR.server.synchronize(signalR.sid);
                }, t || 0);
            }
        })();



        /**
		 *  dd3.scale : deprecated - old implementation
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
		 *  dd3.svg.axis : deprecated - old implementation
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
		*  dd3.selection
		*/

        _dd3.selection = d3.selection;

        var _dd3_watchFactory = function (original, funcName, expectedArg) {
            _dd3.selection.prototype[funcName + '_'] = original;

            var f = function () {
                if (arguments.length < expectedArg && typeof arguments[0] !== 'object')
                    return original.apply(this, arguments);
                original.apply(this, arguments);

                var e = _dd3_selection_createProperties(_dd3_selection_filterWatched(this));

                if (!e.empty())
                    _dd3_selection_send.call(e, 'property', { 'function': funcName, 'property': arguments[0] });

                return this;
            }
/*
            var g = g || function (_) { return _; };
            var h = h || function (_) { return ['property', { 'function': funcName, 'property': _[0] }]; };
*/
            return f ;
        };

        _dd3.selection.prototype.attr = _dd3_watchFactory(d3.selection.prototype.attr, 'attr', 2, function (s, a) {
            return (a[0] === "id") ? d3.select() : s;
        });

        _dd3.selection.prototype.style = _dd3_watchFactory(d3.selection.prototype.style, 'style', 2);

        _dd3.selection.prototype.html = _dd3_watchFactory(d3.selection.prototype.html, 'html', 1);

        _dd3.selection.prototype.text = _dd3_watchFactory(d3.selection.prototype.text, 'text', 1);

        _dd3.selection.prototype.classed = _dd3_watchFactory(d3.selection.prototype.classed, 'classed', 2);

        _dd3.selection.prototype.property = _dd3_watchFactory(d3.selection.prototype.property, 'property', 2);

        _dd3.selection.prototype.remove = _dd3_watchFactory(d3.selection.prototype.remove, 'remove', 0);


        /**
        *  Function for sending data
        */

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

        // Find all browsers which MAY need to receive the element
        var _dd3_findRecipients = function (el) {
            if (!el)
                return [];
            // Take the bounding rectangle and find browsers at the extremities of it (topleft and bottomright are enough)
            // Add as recipients every browsers inside the 2 browsers found above
            // An improvement could be to check if there is an interesection between the shape and a browser
            // Which means between a rectangle and an svg element -> see the 'intersection library' which computes
            // intersection between svg elements. (Be careful - filled elements should be sent to browsers they contain !)
            
            var rcpt = [];
            var rect = el.getBoundingClientRect(); // Relative to local html

            if ((rect.bottom > browser.height || rect.top < 0 || rect.right > browser.width || rect.left < 0) && (rect.width != 0 && rect.height != 0)) {
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

        var _dd3_mergeRecipients = function (a, b) {
            var c = b.slice();
            _dd3_mergeRecipientsIn(a, c);
            return c;
        };

        _dd3.selection.prototype.send = function () {
            _dd3_selection_createProperties(this);
            return _dd3_selection_send.call(this, 'shape');
        }

        var _dd3_selection_send = function (type, args) {
            var counter = 0, formerRcpts, rcpt, rcpts = [], objs, selections;

            this.each(function (d, i) {
                var active = this.__dd3_transitions__.size() > 0;

                // Get former recipients list saved in the __recipients__ variable to send them 'exit' message
                formerRcpts = this.__recipients__;
                // Get current recipients
                rcpt = this.__recipients__ = active ? _dd3_findTransitionsRecipients(this) : _dd3_findRecipients(this);
                // Create (enter,update,exit) selections with the recipients
                selections = _dd3_getSelections(rcpt, formerRcpts);

                if (rcpt.length > 0 || formerRcpts.length > 0) {
                    // Create the object to send
                    objs = _dd3_dataFormatter(this, type, selections, args, active);
                    // Send it to all who may have to plot it
                    rcpt = _dd3_dataSender(objs, selections);
                    // Save all recipients to flush buffer for them afterwards
                    _dd3_mergeRecipientsIn(rcpt, rcpts);
                    counter += rcpt.length; 
                }
            });

            // We buffered so we need to flush buffer of recipients !
            rcpts.forEach(function (d) { peer.flush(d[0], d[1]); });
            
            if (counter > 0)
                log("Sending " + type + " to " + counter + " recipients...");

            return this;
        };

        var _dd3_dataFormatter = (function () {
            var sendId = 1;

            //- Functions for creating objects to be send

            var createShapeObject = function (obj, elem) {
                var groups = getParentGroups(elem);

                obj.type = 'shape';
                obj.attr = getAttr(elem);
                obj.name = elem.nodeName;
                obj.html = elem.innerHTML;
                
                // Remember the container to keep the drawing order (superposition)
                obj.containers = groups;
            };

            var createPropertiesObject = function (obj, elem, f, props) {
                var array = [];
                for (var prop in props) {
                    var objTemp = clone(obj);
                    createPropertyObject(objTemp, elem, f, prop);
                    array.push(objTemp);
                }
                return array;
            };

            var createPropertyObject = function (obj, elem, f, p) {
                if (f === "remove") {
                    obj.type = 'property';
                } else {
                    obj.type = 'property';
                    obj.function = f;

                    if (f !== "text" && f !== "html") {
                        obj.value = d3.select(elem)[f + '_'](obj.property = p);
                    } else {
                        obj.value = d3.select(elem)[f + '_']();
                    }
                }

                
                /*
                switch (f) {
                    case 'attr':
                        obj.property = p;
                        obj.value = elem.attributes[p].nodeValue;
                        break;
                    case 'style':
                        obj.property = p;
                        obj.value = d3.select(elem).style(p);
                        break;
                    case 'classed':
                        obj.property = p;
                        obj.value = d3.select(elem).classed(p);
                        break;
                    case 'property':
                        obj.property = p;
                        obj.value = d3.select(elem).property(p);
                        break;
                    case 'html':
                        obj.value = elem.innerHTML;
                        break;
                    case 'text':
                        obj.value = elem.textContent;
                        break;
                    case 'remove':
                        obj.type = 'remove';
                        break;
                }
                */
            };

            var createTransitionsObject = function (obj, elem) {
                return elem.__dd3_transitions__.values().map(function (v) {
                    var objTemp = clone(obj);
                    createTransitionObject(objTemp, v);
                    return objTemp;
                });
            };

            var createTransitionObject = function (obj, args) {
                obj.type = 'transition';

                obj.name = args.name;
                obj.duration = args.duration;
                obj.delay = args.delay;
                obj.elapsed = args.transition.time - syncTime;
                obj.ease = args.ease;
                obj.start = { attr: {}, style: {} };
                obj.end = { attr: {}, style: {} };

                args.properties.forEach(function (p, i) {
                    var d = p.split('.');
                    obj.start[d[0]][d[1]] = args.startValues[i];
                    obj.end[d[0]][d[1]] = args.endValues[i];
                });
            };

            var createEndTransitionsObject = function (obj, elem, remove) {
                return elem.__dd3_transitions__.values().map(function (v) {
                    var objTemp = clone(obj);
                    createEndTransitionObject(objTemp, v.name, remove);
                    return objTemp;
                });
            };

            var createEndTransitionObject = function (obj, name, remove) {
                obj.type = 'endTransition';
                obj.name = name;
                obj.remove = remove;
            };

            // Deprecated
            var createCTMObject = function (elem) {
                var ctm = elem.getCTM();

                // Make the translation parameter global to send it to others
                ctm.e = hlhg.left(ctm.e);
                ctm.f = hlhg.top(ctm.f);

                // Matrix CTM not sendable with peer.js, just copy the parameter into a normal object
                return copyCTMFromTo(ctm, {});
            };

            //- Helper functions

            var getParentGroups = function (elem) {
                var containers = [], g = elem.parentNode;

                do {
                    if (g.id === "") {
                        g.__sendId__ = g.__sendId__ || sendId++;
                        containers.unshift({ 'id': getSendId(g.__sendId__), 'transform': g.getAttribute("transform"), 'class': (g.getAttribute("class") || "") + ' dd3_received'});                    } else {
                        containers.unshift(g.id);
                    }
                } while (g.id === "" && (g = g.parentNode));

                return containers;
            };

            var getSendId = function (id) {
                return ("dd3_" + browser.row + '-' + browser.column + "_" + id);
            };

            return function (elem, type, selections, args, active) {

                // Bound sendId to the sent shape to be able to retrieve it later in recipients' dom
                elem.__sendId__ = elem.__sendId__ || sendId++;

                var objs = [],
                    obj = {
                    type : 'remove',
                    sendId : getSendId(elem.__sendId__)
                };

                selections.forEach(function (s, i) {
                    if (s.length == 0) {
                        objs.push(false);
                        return;
                    }

                    var objTemp = clone(obj);

                    switch (i) {
                        case 0:  // If enter, in all cases we send a new shape
                            createShapeObject(objTemp, elem);

                            if (active) {
                                objTemp = [objTemp, createTransitionsObject(clone(obj), elem)];
                            }
                            break;

                        case 1: // If update...

                            if (type === 'shape') { // If we want to send the shape...
                                createShapeObject(objTemp, elem);
                            } else if (type === 'property') { // Otherwise, if we just want to update a property ...
                                if (typeof args.property === 'object') { // If we gave object as { property -> value, ... }
                                    objTemp = createPropertiesObject(objTemp, elem, args.function, args.property);
                                } else {
                                    createPropertyObject(objTemp, elem, args.function, args.property);
                                }
                            } else if (type === "endTransition") {
                                createEndTransitionObject(objTemp, args.name, false);
                            }

                            if (active && type !== "endTransition") {
                                var array = [createTransitionsObject(clone(obj), elem)];
                                if (type !== "transitions")
                                    array.unshift(objTemp);
                                objTemp = array;
                            }
                            break;

                        case 2:

                            if (type === "transitions") {
                                createEndTransitionsObject(objTemp, elem, true);
                            } else if (type === "endTransition") {
                                createEndTransitionObject(objTemp, args.name, true);
                            }
                            break;
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


        /**
        *  Watch methods
        */


        _dd3.selection.prototype.watch = function () {
            this.each(function (d, i) {
                if (this.__unwatch__) delete this.__unwatch__;
            });
            return this;
        };

        _dd3.selection.prototype.unwatch = function () {
            this.each(function (d, i) {
                this.__unwatch__ = true;
            });
            return this;
        };

        var _dd3_selection_createProperties = function (elem) {
            elem.each(function () { _dd3_createProperties(this); });
            return elem;
        };

        var _dd3_selection_deleteProperties = function (elem) {
            elem.each(function () { _dd3_deleteProperties(this); });
            return elem;
        };

        var _dd3_createProperties = function (elem) {
            elem.__recipients__ = elem.__recipients__ || [];
            if (!elem.__dd3_transitions__)
                elem.__dd3_transitions__ = d3.map();
            //_dd3_retrieveTransitions(elem);
        };

        var _dd3_deleteProperties = function (elem) {
            delete elem.__recipients__;
            delete elem.__dd3_transitions__;
        };

        var _dd3_selection_filterWatched = function (e) {
            return e.filter(function (d, i) {
                return !this.__unwatch__ && ([].indexOf.call(this.classList, 'dd3_received') < 0);
            })
        };


        /**
		 *  Transition
		 */

        var _dd3_precision = 0.01;

        var _dd3_transitionNamespace = function (name) {
            return name == null ? "__transition__" : "__transition_" + name + "__";
        };

        var _dd3_findTransitionsRecipients = function (elem) {
            if (!elem)
                return [];

            var node = elem.cloneNode(true),
                group = getContainingGroup(elem),
                transitionsInfos,
                tween,
                rcpts = [],
                now = Date.now(),
                max = 0,
                precision = 1;

            transitionsInfos = elem.__dd3_transitions__.values().map(function (v) {
                var trst = v.transition;
                max = (trst.time + trst.duration + trst.delay) > max ? (trst.time + trst.duration + trst.delay) : max;
                precision = v.precision < precision ? v.precision : precision;
                return { tweened: v.tweened, ease: d3.ease(v.ease), time: trst.time + trst.delay, duration: trst.duration };
            });

            group.appendChild(node);
            
            // ! Doesn't take in account order of the transitions !

            d3.range(now, max, precision * (max - now)).forEach(function (time) {
                transitionsInfos.forEach(function (obj) {
                    var a = (time - obj.time) / obj.duration;
                    if (a >= 0 && a <= 1) {
                        var t = obj.ease(a);
                        obj.tweened.forEach(function (f) {
                            f.call(node, t);
                        });
                    }
                });
                _dd3_mergeRecipientsIn(_dd3_findRecipients(node), rcpts);
            });

            group.removeChild(node);

            //log("Computed in " + (Date.now() - now)/1000 + "s probable recipients: [" + rcpts.join('],[') + ']', 2);
            return rcpts;
        };

        var _dd3_retrieveTransitionSettings = function (elem, args) {
            var node = elem.cloneNode(true),
                group = getContainingGroup(elem),
                tween = args.transition.tween,
                tweened = [],
                properties = [],
                startValues = [],
                endValues = [];

            tween.forEach(function (key, value) {
                if (value = value.call(elem, args.data, args.index)) {
                    properties.push(key);
                    tweened.push(value);
                }
            });

            group.appendChild(node);

            var d3_node = d3.select(node);
            tweened.forEach(function (f, j) {
                var ps = properties[j].split('.'),
                    p0 = ps[0],
                    p1 = typeof ps[1] !== "undefined" ? [ps[1]] : [];

                f.call(node, 0);
                startValues.push(d3_node[p0].apply(d3_node, p1));
                f.call(node, 1);
                endValues.push(d3_node[p0].apply(d3_node, p1));
            });

            group.removeChild(node);

            args.startValues = startValues;
            args.endValues = endValues;
            args.tweened = tweened;
            args.properties = properties;
        };

        var _dd3_hook_selection_transition = d3.selection.prototype.transition;

        var _dd3_hook_transition_transition = d3.transition.prototype.transition;

        _dd3.selection.prototype.transition = function (name) {
            var t = _dd3_selection_filterWatched(_dd3_hook_selection_transition.apply(this, arguments)),
                ns = _dd3_transitionNamespace(name),
                ease = "cubic-in-out",
                precision = _dd3_precision;
            
            var initialize = function (t, ease, precision) {

                t.each("start.dd3", function (d, i) {
                    var transition = this[ns][this[ns].active];
                
                    var args = {
                        endValues : [],
                        properties : [],
                        tweened : [],
                        ns: ns,
                        name: name,
                        delay: transition.delay,
                        duration: transition.duration,
                        transition : transition,
                        precision : precision,
                        ease : ease
                    };

                    _dd3_retrieveTransitionSettings(this, args);
                    this.__dd3_transitions__.set(ns, args);

                    _dd3_selection_send.call(d3.select(this), 'transitions');
                });

                t.each("interrupt.dd3", function (d, i) {
                    this.__dd3_transitions__.remove(ns);
                    _dd3_selection_send.call(d3.select(this), 'endTransition', { name: name });
                });

                t.each("end.dd3", function (d, i) {
                    this.__dd3_transitions__.remove(ns);
                    _dd3_selection_send.call(d3.select(this), 'endTransition', { name: name });
                });

                t.ease = function (e) {
                    if (typeof e !== "string") {
                        log("Custom ease functions not supported", 2);
                        return this;
                    }
                    ease = e;
                    return d3.selection.prototype.ease.call(this, arguments);
                };

                t.precision = function (p) {
                    if (arguments.length < 1) return precision;
                    precision = p;
                    return this;
                };

                t.transition = function () {
                    return initialize(_dd3_selection_filterWatched(_dd3_hook_transition_transition.apply(this, arguments)), ease, precision);
                };

                return t;
            }

            return initialize(t, ease, precision);
        };


        /**
		 *  Getter
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
	 *  Initialize
	 */

    initializer();

    /**
	*  Provide listener function to listen for ready state !
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
If object is a shape

obj = {
    action: null,
    name: null,
    attr: null,
    html: null,
    ctm: null,
    container: null
};
*/

/*
var node = n.cloneNode(true),
        group = getContainingGroup(n),
        tween = transition.tween,
        tweened = [],
        rcpts = [];

    tween.forEach(function (key, value) {
        if (value = value.call(n, n.__data__, i)) { // If you prefer to use node here, need to append it to group before !
            properties.push(key);
            tweened.push(value);
        }
    });

    group.appendChild(node);
            
    d3.range(0, 1, _dd3_precision).forEach(function (d) {
        tweened.forEach(function (t) {
            t.call(node, d);
        });
        _dd3_mergeRecipientsIn(_dd3_findRecipients(node), rcpts);
    });

    var d3_node = d3.select(node);
    tweened.forEach(function (t, j) {
        var ps = properties[j].split('.'),
            p0 = ps[0],
            p1 = typeof ps[1] !== "undefined" ? [ps[1]] : [];

        t.call(node, 0);
        startValues.push(d3_node[p0].apply(d3_node, p1));
        t.call(node, 1);
        endValues.push(d3_node[p0].apply(d3_node, p1));
    });
    _dd3_mergeRecipientsIn(_dd3_findRecipients(node), rcpts);

    group.removeChild(node);

    return rcpts;

    */