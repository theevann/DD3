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

function d (k) {
	return function (d) { return d[k];};
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
