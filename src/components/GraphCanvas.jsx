import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { getThemeById, DEFAULT_THEME_ID } from "../data/colorThemes";
import { getEdgeKey } from "../utils/graphValidation";
import { IS_CRAZYGAMES } from "../platform";
import GameIconButton from "./GameIconButton";

const HOLD_DELAY = 350;
const MOVE_TOLERANCE = 12;

function getVertexRadius(vertexCount) {
  if (vertexCount <= 8) return 34;
  if (vertexCount <= 12) return 30;
  if (vertexCount <= 16) return 26;
  return 25;
}

function GraphCanvas({
  vertices,
  edges,
  conflicts,
  onVertexClick,
  width = 600,
  height = 480,
  colorTheme = getThemeById(DEFAULT_THEME_ID),
  toolbar = null,
  design = null,
  guidance = null,
  highlightedVertexIds = [],
  highlightedEdges = [],
  interactiveVertexIds = null,
  mobile = false,
  controls = null,
}) {
  const activeTheme = colorTheme ?? getThemeById(DEFAULT_THEME_ID);
  const [hoveredId, setHoveredId] = useState(null);
  const [focusedId, setFocusedId] = useState(null);
  const [heldId, setHeldId] = useState(null);
  const [zoom, setZoom] = useState(100);
  const [fitSize, setFitSize] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [displayMessage, setDisplayMessage] = useState("");
  const canvas = useRef(null);
  const viewport = useRef(null);
  const zoomAnchor = useRef(null);
  const holdTimer = useRef(null);
  const pointer = useRef(null);
  const suppressClick = useRef(false);
  const hintId = useId();
  const guidanceId = useId();
  const solved = vertices.every((vertex) => vertex.color !== null) && conflicts.length === 0;
  const hasGuidance = Boolean(guidance);

  useLayoutEffect(() => {
    const element = viewport.current;
    const measure = () => {
      const availableWidth = element.getBoundingClientRect().width;
      const maxHeight = parseFloat(getComputedStyle(element).maxHeight);
      const mobileHeight = mobile ? canvas.current.parentElement.clientHeight
        - (canvas.current.querySelector('.graphFooter')?.offsetHeight ?? 0)
        - (canvas.current.querySelector('.tutorialGuidance')?.offsetHeight ?? 0) : 0;
      const availableHeight = document.fullscreenElement === canvas.current
        ? element.clientHeight
        : mobile ? Math.max(1, mobileHeight) : Number.isFinite(maxHeight) ? maxHeight : window.innerHeight;
      if (!availableWidth || !availableHeight) return;
      const scale = Math.min(availableWidth / width, availableHeight / height);
      const next = { width: width * scale, height: height * scale, viewportWidth: availableWidth };
      setFitSize((previous) => previous &&
        Math.abs(previous.width - next.width) < 0.5 &&
        Math.abs(previous.height - next.height) < 0.5 &&
        Math.abs(previous.viewportWidth - next.viewportWidth) < 0.5 ? previous : next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    if (mobile) {
      observer.observe(canvas.current.parentElement);
      const instructions = canvas.current.querySelector('.tutorialGuidance');
      if (instructions) observer.observe(instructions);
    }
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [width, height, fullscreen, mobile, hasGuidance]);

  useLayoutEffect(() => {
    if (!mobile || !hasGuidance) return;
    setZoom(100);
    viewport.current?.scrollTo({ top: 0, left: 0 });
  }, [mobile, hasGuidance]);

  useLayoutEffect(() => {
    const anchor = zoomAnchor.current;
    if (!anchor || !fitSize) return;
    const element = viewport.current;
    const scale = zoom / 100;
    const leftPadding = Math.max(0, (fitSize.viewportWidth - fitSize.width * scale) / 2);
    element.scrollTo({
      left: anchor.x * scale + leftPadding - element.clientWidth / 2,
      top: anchor.y * scale - element.clientHeight / 2,
      behavior: "instant",
    });
    zoomAnchor.current = null;
  }, [zoom, fitSize]);

  function changeZoom(step) {
    const element = viewport.current;
    if (fitSize) {
      const scale = zoom / 100;
      const leftPadding = Math.max(0, (fitSize.viewportWidth - fitSize.width * scale) / 2);
      zoomAnchor.current = {
        x: (element.scrollLeft + element.clientWidth / 2 - leftPadding) / scale,
        y: (element.scrollTop + element.clientHeight / 2) / scale,
      };
    }
    setZoom((value) => Math.max(100, Math.min(300, value + step)));
  }

  useEffect(() => () => window.clearTimeout(holdTimer.current), []);
  useEffect(() => {
    if (IS_CRAZYGAMES) return;
    const handleFullscreen = () => setFullscreen(document.fullscreenElement === canvas.current);
    document.addEventListener("fullscreenchange", handleFullscreen);
    return () => document.removeEventListener("fullscreenchange", handleFullscreen);
  }, []);
  useEffect(() => {
    // Return to the completion card when the last circle is colored in full screen.
    if (!IS_CRAZYGAMES && solved && document.fullscreenElement === canvas.current) {
      document.exitFullscreen().catch(() => {});
    }
  }, [solved]);

  const candidateId = heldId ?? hoveredId ?? focusedId;
  const activeId = vertices.some((vertex) => vertex.id === candidateId) ? candidateId : null;
  const hasActiveVertex = activeId !== null;
  const conflictKeys = new Set(conflicts.map(([a, b]) => getEdgeKey(a, b)));
  const contourKeys = new Set((design?.contourEdges ?? []).map(([a,b])=>getEdgeKey(a,b)));
  const highlightedKeys = new Set(highlightedEdges.map(([a, b]) => getEdgeKey(a, b)));
  const activeEdgeKeys = new Set();
  const adjacentVertexIds = new Set();
  const verticesById = new Map(vertices.map((vertex) => [vertex.id, vertex]));
  const vertexRadius = getVertexRadius(vertices.length);

  for (const [a, b] of edges) {
    if (hasActiveVertex && (a === activeId || b === activeId)) {
      activeEdgeKeys.add(getEdgeKey(a, b));
      adjacentVertexIds.add(a === activeId ? b : a);
    }
  }

  // Draw the connections being traced last, so other edges cannot cover them.
  const edgePriority = edge => activeEdgeKeys.has(getEdgeKey(...edge)) ? 2 : contourKeys.has(getEdgeKey(...edge)) ? 1 : 0;
  const orderedEdges = [...edges].sort((a,b)=>edgePriority(a)-edgePriority(b));

  function clearHold() {
    window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
    pointer.current = null;
    setHeldId(null);
  }

  function handlePointerDown(event, vertexId) {
    suppressClick.current = false;
    setFocusedId(null);
    if (event.pointerType === "mouse" || event.isPrimary === false) return;
    clearHold();
    pointer.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    holdTimer.current = window.setTimeout(() => {
      suppressClick.current = true;
      setHeldId(vertexId);
    }, HOLD_DELAY);
  }

  function handlePointerMove(event) {
    if (!pointer.current || event.pointerId !== pointer.current.id) return;
    if (Math.hypot(event.clientX - pointer.current.x, event.clientY - pointer.current.y) > MOVE_TOLERANCE) {
      suppressClick.current = true;
      clearHold();
    }
  }

  return (
    <div ref={canvas} data-zoom={zoom} className={`graphCanvasWrap ${hasActiveVertex ? "isTracing" : ""} ${design ? "hasDesign" : ""} ${hasGuidance ? "withGuidance" : ""}`}>
      {guidance && <div id={guidanceId}>{guidance}</div>}
      {toolbar && <div className="graphToolbar">{toolbar}</div>}
      <div className="graphViewport" ref={viewport} tabIndex={0} aria-label="Puzzle canvas. Zoom in for larger circles, then scroll to explore.">
      <div className="graphStage" style={fitSize ? { width: Math.max(fitSize.viewportWidth, fitSize.width * zoom / 100) } : undefined}>
      <svg
        className="graphCanvas"
        style={fitSize ? { width: fitSize.width * zoom / 100, height: fitSize.height * zoom / 100, maxHeight: "none" } : undefined}
        viewBox={`0 0 ${width} ${height}`}
        role="group"
        aria-label="Interactive graph coloring puzzle"
        aria-describedby={guidance ? `${hintId} ${guidanceId}` : hintId}
      >
        <g className="graphEdges" aria-hidden="true">
          {orderedEdges.map(([a, b]) => {
            const start = verticesById.get(a);
            const end = verticesById.get(b);
            if (!start || !end) return null;
            const key = getEdgeKey(a, b);
            const isActive = activeEdgeKeys.has(key);
            const className = [
              "edge",
              contourKeys.has(key) ? "contourEdge" : "",
              highlightedKeys.has(key) ? "guidedEdge" : "",
              conflictKeys.has(key) ? "conflictEdge" : "",
              isActive ? "activeEdge" : "",
              hasActiveVertex && !isActive ? "dimmedEdge" : "",
            ].filter(Boolean).join(" ");
            const coordinates = { x1: start.x, y1: start.y, x2: end.x, y2: end.y };
            return (
              <g key={key}>
                {isActive && <line className="edgeHalo" {...coordinates} />}
                <line className={className} {...coordinates} />
              </g>
            );
          })}
        </g>
        {vertices.map((vertex) => {
          const isActive = vertex.id === activeId;
          const isAdjacent = adjacentVertexIds.has(vertex.id);
          const dimmed = hasActiveVertex && !isActive && !isAdjacent;
          const highlighted = highlightedVertexIds.includes(vertex.id);
          const interactive = interactiveVertexIds == null || interactiveVertexIds.includes(vertex.id);
          const fill = vertex.color === null
            ? "var(--uncolored-vertex)"
            : activeTheme.colors[vertex.color] ?? "var(--uncolored-vertex)";
          const connectionCount = edges.filter(([a, b]) => a === vertex.id || b === vertex.id).length;
          return (
            <g
              key={vertex.id}
              className={`vertexGroup ${dimmed ? "dimmedVertexGroup" : ""} ${!interactive ? "guidanceDimmedVertex" : ""}`}
              role="button"
              tabIndex={0}
              aria-label={`Circle, ${vertex.color ?? "uncolored"}, ${connectionCount} connections. ${interactive ? "Press Enter or Space to change color." : "Currently unavailable for coloring."}`}
              aria-disabled={!interactive || undefined}
              aria-describedby={guidance ? guidanceId : undefined}
              onFocus={(event) => {
                if (event.currentTarget.matches(":focus-visible")) setFocusedId(vertex.id);
              }}
              onBlur={() => setFocusedId(null)}
              onPointerEnter={(event) => {
                if (event.pointerType === "mouse") setHoveredId(vertex.id);
              }}
              onPointerLeave={(event) => {
                if (event.pointerType === "mouse") setHoveredId(null);
              }}
              onPointerDown={(event) => handlePointerDown(event, vertex.id)}
              onPointerMove={handlePointerMove}
              onPointerUp={clearHold}
              onPointerCancel={() => { suppressClick.current = true; clearHold(); }}
              onLostPointerCapture={clearHold}
              onContextMenu={(event) => event.preventDefault()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  if (!event.repeat && interactive) onVertexClick(vertex.id);
                }
              }}
              onClick={(event) => {
                if (suppressClick.current) {
                  suppressClick.current = false;
                  event.preventDefault();
                  return;
                }
                if (interactive) onVertexClick(vertex.id);
              }}
            >
              {isActive && <circle className="vertexFocusRing" cx={vertex.x} cy={vertex.y} r={vertexRadius + 7} />}
              {highlighted && <circle className="vertexGuidanceRing" cx={vertex.x} cy={vertex.y} r={vertexRadius + 10} />}
              <circle
                className={`vertex${isAdjacent ? " adjacentVertex" : ""}${isActive ? " focusedVertex" : ""}`}
                cx={vertex.x}
                cy={vertex.y}
                r={vertexRadius}
                fill={fill}
              />
            </g>
          );
        })}
      </svg>
      </div>
      </div>
      <div className="graphFooter">
        <div className="graphFeedback">
          <p id={hintId} className="graphHint">Tap to color · Hover or hold a circle to trace connections</p>
          <p className="traceStatus" role="status" aria-live="polite">
          {solved
            ? (fullscreen ? "Puzzle complete! Exit to continue." : "Puzzle complete!")
            : hasActiveVertex ? `Tracing ${adjacentVertexIds.size} connections` : displayMessage || (mobile && zoom > 100 ? "Drag to explore · Fit for overview" : "")}
          </p>
        </div>
        <div className="graphActions">
          {controls}
        <div className="graphZoom" role="group" aria-label="Graph zoom">
          {!IS_CRAZYGAMES && typeof document !== "undefined" && document.fullscreenEnabled && (
            <GameIconButton icon={fullscreen ? "minimize" : "maximize"} label={fullscreen ? "Exit full screen" : "Expand puzzle to full screen"} onClick={async () => {
              setDisplayMessage("");
              try {
                if (fullscreen) await document.exitFullscreen();
                else await canvas.current.requestFullscreen();
              } catch {
                setDisplayMessage("Full screen is unavailable. Use zoom to enlarge the graph.");
              }
            }} />
          )}
          <GameIconButton icon="minus" label="Zoom out" disabled={zoom === 100} onClick={() => changeZoom(-10)} />
          <GameIconButton icon="fit" label="Fit graph to screen" onClick={() => {
            zoomAnchor.current = null;
            setZoom(100);
            viewport.current?.scrollTo({ top: 0, left: 0 });
          }} />
          <GameIconButton icon="plus" label="Zoom in" disabled={zoom === 300} onClick={() => changeZoom(10)} />
          {mobile && <output className="graphZoomValue" aria-label="Graph zoom level">{zoom}%</output>}
        </div>
        </div>
      </div>
    </div>
  );
}

export default GraphCanvas;
