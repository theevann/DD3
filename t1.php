
<html>
<meta charset="utf-8">
<style>
body {
  font: 11px sans-serif;
  padding : 0px;
  margin: 0px;
}

.axis path,
.axis line {
  fill: none;
  stroke: #000;
  shape-rendering: crispEdges;
}

.dot {
  stroke: #000;
}

</style>
<body>

<script src="http://d3js.org/d3.v3.js"></script>

<script>

<?php
	$col = $_REQUEST["col"];
	$row = $_REQUEST["row"];
	
	echo "var posW = ".$col.";";
	echo "var posH = ".$row.";";
?>
// SET HERE OR GOT FROM SERVER ...

</script>

<script src="dd3.js"></script>

<script>

var data = dd3.getData();
var xDomain = data.shift();
var yDomain = data.shift();

// setup x 
var xScale = d3.scale.linear().range([0, totalAvailableWidth]),
    xAxis = d3.svg.axis().scale(xScale).orient("bottom");

// setup y
var yScale = d3.scale.linear().range([totalAvailableHeight, 0]),
    yAxis = d3.svg.axis().scale(yScale).orient("left");
	
	xScale.domain(xDomain);
	yScale.domain(yDomain);

  // x-axis
	svg.append("g")
      .attr("class", "x axis")
      .attr("transform", "translate(" + dd3.toLocalLeftGroup(0) + "," + dd3.toLocalTopGroup(totalAvailableHeight) + ")")
      .call(xAxis)
    .append("text")
      .attr("class", "label")
      .attr("x", width)
      .attr("y", -6)
      .style("text-anchor", "end")
      .text("X axis");

  // y-axis
  svg.append("g")
      .attr("class", "y axis")
	  .attr("transform", "translate(" + dd3.toLocalLeftGroup(0) + "," + dd3.toLocalTopGroup(0) + ")")
      .call(yAxis)
    .append("text")
      .attr("class", "label")
      .attr("transform", "rotate(-90)")
      .attr("y", 6)
      .attr("dy", ".71em")
      .style("text-anchor", "end")
      .text("Y axis");

  // draw dots
  svg.selectAll(".dot")
      .data(data)
    .enter().append("circle")
      .attr("class", "dot")
      .attr("r", 3.5)
      .attr("cx", function (d) {return xScale.toLocalLeftGroup(d[0]);})
      .attr("cy", function (d) {return dd3.toLocalTopGroup(yScale(d[1]));})
      .style("fill", function(d) { return "black";}) ;

</script>
</body>
</html>