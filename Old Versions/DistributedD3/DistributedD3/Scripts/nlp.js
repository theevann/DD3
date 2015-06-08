$(function () {

    var conn;
    var peer = new Peer({ key: 'x7fwx2kavpy6tj4i', debug: true });

    var thisBrowserObj = {};
    thisBrowserObj.browserNum = getUrlVar("browserNum");
    thisBrowserObj.col = getUrlVar("browserCol");
    thisBrowserObj.row = getUrlVar("browserRow");
    thisBrowserObj.height = $(window).height();
    thisBrowserObj.width = $(window).width();

    var browserInfoAry;
    browserNumAry = [];
    var peerConnectedAry = [];

    var networkHub = $.connection.networkHub;

    // ** Receive browser information from server
    networkHub.client.receiveBrowserInfo = function (browserInfo) {

        // browser dropdown menu
        $("#message_to").empty();

        browserInfoAry = JSON.parse(browserInfo);
        $.each(browserInfoAry, function (index, object) {
            //alert(object.peerId);

            browserNumAry[object.peerId] = object.browserNum;
            if (thisBrowserObj.browserNum !== object.browserNum) {

                if (typeof peerConnectedAry[object.peerId] == 'undefined') {
                    var c = peer.connect(object.peerId);
                    conn = c;
                    c.on('error', function (err) { alert(err) });
                    //c.on('open', function () { connectToPeer(c) });

                    peerConnectedAry[object.peerId] = 1;
                }

                // browser dropdown menu
                $("#message_to").append($("<option></option>")
                                    .attr("value", object.peerId)
                                    .text("Browser " + object.browserNum));
            }
        });
    };

    $.connection.hub.start().done(function () {
        peer.on('open', function (peerId) {
            thisBrowserObj.peerId = peerId;
            thisBrowserObj.connectionId = $.connection.hub.id;
            networkHub.server.sendBrowserInfo(thisBrowserObj);

            $('#browser_info').append("Col: " + thisBrowserObj.col + " Row: " + thisBrowserObj.row)
                              .append(" | Height: " + thisBrowserObj.height + " Width: " + thisBrowserObj.width);
            $('#browser_id').append("BrowserNum: " + thisBrowserObj.browserNum + " | PeerID: " + peerId);
        });
        peer.on('connection', connectToPeer);
    });

    $('#test_btn').click(function () {
        var peerId = $("#message_to option:selected").val();
        conn = peer.connections[peerId][0];
        var msg = $('#test_txt').val();
        conn.send(msg);
    });

    $('#test_json_btn').click(function () {
        var peerId = $("#message_to option:selected").val();
        conn = peer.connections[peerId][0];
        var msg = $('#test_txt').val();

        var jsonData = new Object();
        jsonData.label = "A JSON Test";
        jsonData.type = "data";
        jsonData.value = msg;
        var jsonDataStr = JSON.stringify(jsonData);

        conn.send(jsonDataStr);
    });

    function connectToPeer(c) {
        var conn = c;
        $("#message_log").append("Browser " + browserNumAry[conn.peer] + " is connected. ID: " + conn.peer + "<br/>");
        conn.on('data', function (data) {
            $("#message_log").append("Browser " + browserNumAry[conn.peer] + " says: " + data + "<br/>");
        });
        conn.on('close', function (err) {
            $("#message_log").append("Browser " + browserNumAry[conn.peer] + " is disconnected. ID: " + conn.peer + "<br/>");
            delete peerConnectedAry[conn.peer];
            delete browserNumAry[conn.peer];
        });
    }
});

function getUrlVar(variable) {
    var query = window.location.search.substring(1);
    var vars = query.split("&");
    for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split("=");
        if (pair[0] === variable) { return pair[1]; }
    }
    return (false);
}