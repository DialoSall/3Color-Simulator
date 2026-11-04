import { contourEdges } from "./dailyDesigns.js";
import { adjacency, distanceToSegment, evaluateDifficulty, isBipartite, isConnected, layoutMetrics, seededRandom, shuffle, solveThreeColoring, topologySignature } from "./dailyGraph.js";
import { classifyDifficulty } from "./dailyCalibration.js";

export function generateDesignedCandidate(seed, template, calibration) {
  const random=seededRandom(seed);
  const scaleX=0.96+random()*0.08, scaleY=0.96+random()*0.08;
  const vertices=template.points.map(([x,y],id)=>({id,x:Math.round(550+(x-550)*scaleX),y:Math.round(400+(y-400)*scaleY),color:null}));
  const required=contourEdges(template);
  const base={vertices,edges:required};
  const geometry=layoutMetrics(base);
  if(geometry.vertexSpacing<72 || geometry.edgeClearance<34)return null;
  const planted=solveThreeColoring(base,{tieSeed:seed,colorSeed:seed,dynamic:true}).solution;
  if(!planted || new Set(Object.values(planted)).size<3)return null;
  const allowed=[];
  for(let a=0;a<vertices.length;a++)for(let b=a+1;b<vertices.length;b++){
    if(planted[a]===planted[b])continue;
    if(vertices.some(vertex=>vertex.id!==a && vertex.id!==b && distanceToSegment(vertex,vertices[a],vertices[b])<34))continue;
    allowed.push([a,b]);
  }
  const requiredKeys=new Set(required.map(edge=>edge.join(':')));
  if(!required.every(edge=>allowed.some(pair=>pair[0]===edge[0] && pair[1]===edge[1])))return null;
  const target=Math.round((0.27+random()*0.115)*vertices.length*(vertices.length-1)/2);
  if(target<required.length || allowed.length<target)return null;
  const edges=[...required,...shuffle(allowed.filter(edge=>!requiredKeys.has(edge.join(':'))),random).slice(0,target-required.length)].sort(([a,b],[c,d])=>a-c||b-d);
  const graph={width:1100,height:800,vertices,edges};
  if(!isConnected(graph)||isBipartite(graph)||[...adjacency(graph).values()].some(set=>set.size<2))return null;
  const metrics=evaluateDifficulty(graph);
  const difficulty=classifyDifficulty(metrics,calibration);
  if(!difficulty)return null;
  const layout=layoutMetrics(graph);
  if(layout.vertexSpacing<72 || layout.edgeClearance<34)return null;
  return {...graph,difficulty,metrics:{...metrics,minVertexSpacing:Number(layout.vertexSpacing.toFixed(3)),minEdgeClearance:Number(layout.edgeClearance.toFixed(3))},
    design:{version:1,motif:template.id,name:template.name,contourEdges:required},
    theme:{id:`design-${template.id}`,name:template.name,colors:{red:template.colors[0],blue:template.colors[1],yellow:template.colors[2]}},
    signature:topologySignature(graph),
  };
}
