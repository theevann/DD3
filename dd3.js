var d = function (k) {return function (d) { return d[k];}; };

var d3_scale_linear = d3.scale.linear;
d3.scale.linear = function () {
	var s = d3_scale_linear.apply(this, arguments);
	
	s.toLocalLeftGroup = function (x) {
		return dd3.toLocalLeftGroup(s(x));
	};
	
	return s;
};


// SET HERE OR GOT FROM SERVER ...

var totalWidth = 1280,
	totalHeight = 720,
	marginHeight = 20,
	marginWidth = 60;
	
var numberScreenW = 4,
	numberScreenH = 2;

// COMPUTED AND ACCESSIBLE

var totalAvailableHeight = totalHeight - 2 * marginHeight,
	totalAvailableWidth = totalWidth - 2 * marginWidth;

var mwl = posW == 0 ? marginWidth : 0,
	mwr = posW == numberScreenW - 1 ? marginWidth : 0, // use min cause' marginWidth
	mht = posH == 0 ? marginHeight : 0, //  may be bigger than a screen...
	mhb = posH == numberScreenH - 1 ? marginWidth : 0;
	
var width = totalWidth / numberScreenW,
	height = totalHeight / numberScreenH,
	availableWidth = width - mwl - mwr,
	availableHeight = height - mht - mhb;

// SVG INITIATED BY "DD3"

var svg = d3.select("body").append("svg")
    .attr("width", width)
    .attr("height", height)
    .append("g")
    .attr("transform", "translate(" + mwl + "," + mht + ")");

var dd3 = {};

dd3.toLocalLeftSvg = function (left) { // for global left
	return left - posW*width;
};

dd3.toLocalLeftGroup = function (left) { // for left from group
	return left - posW*width + marginWidth - mwl;
};

dd3.toLocalTopSvg = function (top) { // for global top
	return top - posH*height;
};

dd3.toLocalTopGroup = function (top) {
	return top - posH*height + marginHeight - mht;
};

dd3.getData = function () {
	//var data = d3.range(0,50,1).map(function(d) {return [d, Math.random()*10 + 10];});
	//var data = [[0,13.935022571725982],[1,14.195316692716805],[2,10.630630897129453],[3,17.845736514963843],[4,18.392379899075593],[5,13.85885863791841],[6,17.92150291488938],[7,19.310006281483293],[8,14.649300473234671],[9,14.99592581895215],[10,14.171931984585276],[11,14.988334728492731],[12,18.51726061593594],[13,15.446376473533453],[14,18.15280986449554],[15,18.615289495647513],[16,10.179303876578823],[17,14.443741608815877],[18,14.31828649534298],[19,18.634338077116197],[20,12.880603665638757],[21,17.555598075997633],[22,13.153222023942103],[23,12.314380964404979],[24,11.398427177823514],[25,13.644469793741433],[26,15.197317537264917],[27,14.315952457488013],[28,18.45677708206591],[29,12.716984193622718],[30,18.98882714449641],[31,11.9387956069152],[32,16.98176739306869],[33,19.36894322541897],[34,11.72891961567186],[35,17.170111943143702],[36,15.996658288408808],[37,17.270882035403233],[38,14.17964206893371],[39,18.252647043618943],[40,16.37923793013777],[41,16.193785569955338],[42,17.2109322899364],[43,12.171296032505168],[44,14.533200649891949],[45,17.950079195096347],[46,12.31497960237415],[47,11.48217913927598],[48,17.287026874890756],[49,15.891345959829742]];
	//var data = d3.range(0,4,0.3).map(function(d) {return [d, Math.cos(d*d)*3];});
	var data = d3.range(0,18,0.1).map(function(d) {return [d, Math.cos(d)*3];});
	
	var xScale = d3.scale.linear().range([0, totalAvailableWidth]);
	var yScale = d3.scale.linear().range([totalAvailableHeight, 0]);
	
	xScale.domain([d3.min(data, d(0))-1, d3.max(data, d(0))+1]);
	yScale.domain([d3.min(data, d(1))-1, d3.max(data, d(1))+1]);
	
	var scales = [xScale, yScale];
	
	data =  data.filter(function (d) {
		return dd3.toLocalLeftGroup(scales[0](d[0])) >= 0 && dd3.toLocalLeftGroup(scales[0](d[0])) <= width - mwl && dd3.toLocalTopGroup(scales[1](d[1])) >= 0 && dd3.toLocalTopGroup(scales[1](d[1])) <= height - mht;
	});
	
	data.unshift(yScale.domain());
	data.unshift(xScale.domain())
	
	return data;
};
