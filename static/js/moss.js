var defaultState = {
    lineThreshold: 40,
    percentThreshold: 40,
    shortenNames: false,
    id: null,
    allMatches: [],
    allLinks: [],
    allNodes: []
};
var state = JSON.parse(JSON.stringify(defaultState));


function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

function renderGraph() {
    let links = state.allLinks.filter(l => {
        return l.linesMatched >= state.lineThreshold
            || l.percentMatched >= state.percentThreshold;
    });

    let names = new Set();
    for(let link of links) {
        names.add(link.source.id || link.source);
        names.add(link.target.id || link.target);
    }
    let nodes = state.allNodes.filter(n => names.has(n.id));

    drag = simulation => {
  
        function dragstarted(d) {
          if (!d3.event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        }
        
        function dragged(d) {
          d.fx = d3.event.x;
          d.fy = d3.event.y;
        }
        
        function dragended(d) {
          if (!d3.event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }
        
        return d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended);
    };

    const padding = 0;
    
    // https://bl.ocks.org/mbostock/4055889
    function collide() {
        ry = 10;
        for (var k = 0, iterations = 4, strength = 0.5; k < iterations; ++k) {
            for (var i = 0, n = nodes.length; i < n; ++i) {
                for (var a = nodes[i], j = i + 1; j < n; ++j) {
                    var b = nodes[j],
                        x = a.x + a.vx - b.x - b.vx,
                        y = a.y + a.vy - b.y - b.vy,
                        lx = Math.abs(x),
                        ly = Math.abs(y),
                        rx = Math.max(a.label.length, b.label.length)*2.5;
                    if (lx < rx && ly < ry) {
                        if (lx > ly) {
                            lx = (lx - rx) * (x < 0 ? -strength : strength);
                            a.vx -= lx, b.vx += lx;
                        } else {
                            ly = (ly - ry) * (y < 0 ? -strength : strength);
                            a.vy -= ly, b.vy += ly;
                        }
                    }
                }
            }
        }
    }
    
    let g = d3.select("svg").select("g");

    var simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).iterations(1)/*.strength(0.1)*/)
        .force("charge", d3.forceManyBody().strength(-500))
        .force("x", d3.forceX())
        .force("y", d3.forceY())
        .force("collide", collide);
    
    const link = g.select(".linkGroup")
        .selectAll(".linkLine")
        .data(links)
        .join("line")
        .attr("class", "linkLine")
    
    // http://bl.ocks.org/jhb/5955887
    const edgelabels = g.select(".edgeLabelGroup")
        .selectAll(".edgeLabel")
        .data(links)
        .join("text")
        .attr("class", "edgeLabel")
        .attr("id", (d, i) => 'edgelabel'+i)
        .text(d => d.label);

    const node = g.select(".nodeGroup")
        .selectAll(".node")
        .data(nodes)
        .join(
            enter => {
                let thisNode = enter.append("g")
                    .attr("class", "node")
                thisNode.append("ellipse")
                    .attr("class", "nodeShape")
                    .attr("rx", d => d.label.length*2.25)
                    .attr("ry", 10);
                thisNode.append("text")
                    .attr("class", "nodeText")
                    .text(d => d.label);
                return thisNode;
            },
            update => {
                update.select("ellipse").attr("rx", d => d.label.length*2.25)
                update.select("text").text(d => d.label);
                return update;
            }
        ).call(drag(simulation));
  
    simulation.on("tick", () => {
        link
          .attr("x1", d => d.source.x)
          .attr("y1", d => d.source.y)
          .attr("x2", d => d.target.x)
          .attr("y2", d => d.target.y);
  
        node
          .attr("transform", d => "translate(" + d.x + "," + d.y + ")");     

        edgelabels.attr('transform', d => {
            startX = Math.min(d.source.x, d.target.x);
            distX = Math.abs(d.source.x - d.target.x);
            xCoord = startX+distX/2;
            startY = Math.min(d.source.y, d.target.y);
            distY = Math.abs(d.source.y - d.target.y);
            yCoord = startY+distY/2;
            transform = "translate(" + xCoord + "," + yCoord + ")";
            return transform;
        });
    });
}

function getName(string) {
    if(!state.shortenNames) return string;

    if(string[string.length-1] === '/') {
        string = string.slice(0, -1);
    }
    for(let i = string.length-1; i >= 0; --i) {
        if(string[i] === '/') {
            return string.slice(i+1);
        }
    }
    return string;
}

async function buildGraph(matches) {
    state.allMatches = matches;
    state.allNodes = [];
    state.allLinks = [];

    let names = new Set();
    for(match of matches) {
        if(!names.has(match['firstFile'])) {
            state.allNodes.push({id: match['firstFile'], label: getName(match['firstFile'])});
            names.add(match['firstFile']);
        }
        if(!names.has(match['secondFile'])) {
            state.allNodes.push({id: match['secondFile'], label: getName(match['secondFile'])});
            names.add(match['secondFile']);
        }

        const percentMatched = Math.max(match['firstPercentMatched'], match['secondPercentMatched'])
        const label = `${match['linesMatched']} (${percentMatched}%)`
        state.allLinks.push({
            source: match['firstFile'],
            target: match['secondFile'],
            label: label,
            percentMatched: percentMatched,
            linesMatched: match['linesMatched']
        });
    }

    renderGraph();
}

function getMatches(id) {
    return new Promise((resolve, reject) => {
        let xhr = new XMLHttpRequest();
        xhr.open("GET", "../api/results/" + id);
        xhr.responseType = "json"
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status <= 300) {
                resolve(xhr.response);
            } else {
                reject({
                    status: this.status,
                    statusText: xhr.statusText
                });
            }
        };
        xhr.onerror = () => {
            reject({
                status: this.status,
                statusText: xhr.statusText
            });
        };
        xhr.send(null);
    });
}

function isValidId(id) {
    if(id.length != 9) {
        return false;
    }
    for(let i = 0; i < id.length; ++i) {
        if(id[i]-'0' < 0 || id[i]-'0' > 9) {
            return false;
        } 
    }
    return true;

}

function updateIfProvided(queryParams, param, stateVar, isInt) {
    if(queryParams.has(param)) {
        if(isInt) {
            state[stateVar] = Number(queryParams.get(param));
        } else {
            state[stateVar] = queryParams.get(param);
        }

    }
}

function initWindow() {
    window.onpopstate = event => {
        console.log(document.location);
        console.log(event);
    };
}

function initState() {
    const urlParams = new URLSearchParams(window.location.search);
    updateIfProvided(urlParams, "l", "lineThreshold", true);
    updateIfProvided(urlParams, "p", "percentThreshold", true);
    updateIfProvided(urlParams, "id", "id", false);
    updateIfProvided(urlParams, "s", "shortenNames", false);

    document.getElementById("lineThreshold").value = state.lineThreshold;
    document.getElementById("lineThresholdValue").value = state.lineThreshold;
    document.getElementById("percentThreshold").value = state.percentThreshold;
    document.getElementById("percentThresholdValue").value = state.percentThreshold;
    document.getElementById("shortenNames").checked = state.shortenNames;
    document.getElementById("id").value = state.id;
}

function initGraph() {
    initWindow();
    initState();
    
    let rect = document.getElementById("graph").getBoundingClientRect();
    let width = rect.width;
    let height = rect.height;
    let svg = d3.select("svg")
        .attr("viewBox", [-width / 2, -height / 2, width, height]);
    let g = svg.append("g");
    g.append("g").attr("class", "linkGroup");
    g.append("g").attr("class", "edgeLabelGroup");
    g.append("g").attr("class", "nodeGroup");
    svg.call(d3.zoom()
        .scaleExtent([1 / 2, 8])
        .on("zoom", () => g.attr("transform", d3.event.transform)));

    const id = getQueryParam('id');
    if(id === null || !isValidId(id)) {
        return;
    } else {
        document.getElementById("id").value = id;
        getMatches(id).then(matches => {
            if(matches.length > 0) {
                state.id = id;
                updateUrl();
                buildGraph(matches);
            }
        });
    }
}

function updateUrl() {
    let newUrl = window.location.pathname + "?";
    if(state.id !== defaultState.id)
        newUrl += "id=" + state.id;
    if(state.lineThreshold !== defaultState.lineThreshold)
        newUrl += "&l=" + state.lineThreshold;
    if(state.percentThreshold !== defaultState.percentThreshold)
        newUrl += "&p=" + state.percentThreshold;
    if(state.shortenNames !== defaultState.shortenNames)
        newUrl += "&s=" + state.shortenNames;
    window.history.replaceState({state: state}, '', newUrl);
}

function changeLineThreshold(value) {
    state.lineThreshold = value;
    updateUrl();
    renderGraph();
}

function inputLineThreshold(value) {
    document.getElementById("lineThresholdValue").value = value;
}

function incrementLineThreshold() {
    inputLineThreshold(lineThreshold+1);
    changeLineThreshold(lineThreshold+1);
}

function decrementLineThreshold() {
    inputLineThreshold(lineThreshold-1);
    changeLineThreshold(lineThreshold-1);
}

function changePercentThreshold(value) {
    state.percentThreshold = value;
    updateUrl();
    renderGraph();
}

function inputPercentThreshold(value) {
    document.getElementById("percentThresholdValue").value = value;
}

function incrementPercentThreshold() {
    inputPercentThreshold(percentThreshold+1);
    changePercentThreshold(percentThreshold+1);
}

function decrementPercentThreshold() {
    inputPercentThreshold(percentThreshold-1);
    changePercentThreshold(percentThreshold-1);
}

function inputId(value) {
    if(value != state.id && isValidId(value)) {
        getMatches(value).then(matches => {
            if(matches.length > 0) {
                state.id = value;
                updateUrl();
                buildGraph(matches);
            }
        });
    }
}

function clickShortenNames(checkbox) {
    state.shortenNames = checkbox.checked;
    updateUrl();
    for(node of state.allNodes) {
        node.label = getName(node.id);
    }
    renderGraph();
}