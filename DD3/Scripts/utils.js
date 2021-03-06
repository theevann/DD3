function getUrlVar (variable) {
    var query = window.location.search.substring(1);
    var vars = query.split("&");
    for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split("=");
        if (pair[0] === variable) { return pair[1]; }
    }
    return false;
}

function clamp (value, min, max) {
	return value < min ? min : value > max ? max : value;
}

// p to true try to parse numbers
function d (k, p) {
    return function (d) { return ((p && +d[k]) || d[k]); };
};

// Basic extend
function extend (base, extension) {
  if (arguments.length > 2) {
  	[].forEach.call(arguments, function (extension) { 
 	 	extend(base, extension) 
 	})
  } else {
      for (var k in extension)
          base[k] = extension[k];
  }
  return base;
}

// Basic clone
function clone(source) {
    var destination;
    if (source instanceof Array) {
        destination = [];
    } else {
        destination = {};
    }

    for (var property in source) {
        if (typeof source[property] === "object" && source[property] !== null) {
            destination[property] = clone(source[property]);
        } else {
            destination[property] = source[property];
        }
    }
    return destination;
};

function log (message, sev) {
	var sevMessage = ["Debug", "Info", "Warning", "Error", "Critical"];
	var consoleFunction = ["debug", "log", "warn", "warn", "error"];
	log.sev = typeof log.sev === "undefined" ? 0 : log.sev;
	arr = (dd3 && dd3.browser) ? [dd3.browser().row, dd3.browser().column] : [];

	sev = clamp(sev || 0, 0, 4);
	if (log.sev <= sev) {
	    console[consoleFunction[sev]]("(" + sevMessage[sev] + ")  [" + arr + "] " + message);
	}
}



function getAttr (el) {
    var obj = el.attributes, objf = {};

    for (var key in obj) {
        if (obj.hasOwnProperty(key) && typeof obj[key].nodeName !== "undefined") {
            objf[obj[key].nodeName] = obj[key].nodeValue;
        }
    }

    return objf;
}


// Following functions : Keeped for memory for now, will probably be deleted as not needed

function getContainingGroup(el) {
    var container;

    while (!container && (el = el.parentNode)) {
        if (el.nodeName.toLowerCase() === 'g')
            container = el;
    }

    return container;
}

function copyCTMFromTo(original, copy) {
    copy.a = original.a;
    copy.b = original.b;
    copy.c = original.c;
    copy.d = original.d;
    copy.e = original.e;
    copy.f = original.f;
    return copy;
}


function getRotationCenter(t) {
    var c = /rotate\([\s]*[\d.]+(?:[\s,]+([\d.]+)[\s,]+([\d.]+))*[\s,]*\)/.exec(t);
    return c === null ? c : [+c[1], +c[2]];
}

function setRotationCenter(t, c) {
    var t2 = t.replace(/rotate\([\s]*([\d.]+)(?:[\s,]+([\d.]+)[\s,]+([\d.]+))*[\s,]*\)/, "rotate($1," + c + ")");
    return t2;
}


function getFullPath(el) {

    var path = [];
    var actual = "";

    do {
        actual = el.nodeName;

        if (el.id !== "")
            actual += "#" + el.id;

        if (!!el.classList.length)
            actual += "." + [].join.call(el.classList, ".");

        path.unshift(actual);
    } while ((el.nodeName.toLowerCase() != 'html') && (el = el.parentNode));

    return path.join(" ");
}