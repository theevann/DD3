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

function d (k, p) {
	return function (d) { return p ? +d[k] : d[k];};
};

//Not exactly what I need, to improve :)
function extend (base, extension) {
  if (arguments.length > 2) 
  	[].forEach.call(arguments, function (extension) { 
 	 	extend(base, extension) 
 	})
  else 
  	for (var k in extension) 
  		base[k] = extension[k]
  return base;
}

function log (message, sev) {
	var sevMessage = ["Debug", "Info", "Warning", "Error", "Critical"];
	var consoleFunction = ["debug", "log", "warn", "warn", "error"];
	log.sev = typeof log.sev === "undefined" ? 0 : log.sev;
	
	sev = clamp(sev || 0, 0, 4);
	if (log.sev <= sev) {
		console[consoleFunction[sev]]("(" + sevMessage[sev] + ")  " + message);
	}
}


function getFullPath (el) {

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

function getAttr (el) {
    var obj = el.attributes, objf = {};

    for (var key in obj) {
        if (obj.hasOwnProperty(key) && typeof obj[key].nodeName !== "undefined") {
            objf[obj[key].nodeName] = obj[key].nodeValue;
        }
    }

    return objf;
}

//Maybe should check that container != svg at the beggining
function getIdentifiedContainer(el, returnElement) {
    var container;

    while (!container && (el = el.parentNode)) {
        if (el.id !== "" || el.nodeName.toLowerCase() === 'svg')
            container = el;
    } 

    container = returnElement ? container : container.id !== "" ? "#" + container.id : 'svg g';
    return container;
}