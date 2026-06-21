import sys
import re

file_path = r'D:\anotation\frontend\app\segment-annotate\[imageId]\page.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Imports
content = content.replace(
    'Layers, SlidersHorizontal, Loader2, FileText, X, FileJson',
    'Layers, SlidersHorizontal, Loader2, FileText, X, FileJson, PenTool'
)

# 2. Update Tool Type
content = content.replace(
    'type Tool = "select" | "bbox" | "polygon" | "mask" | "brush" | "eraser" | "wand" | "pan" | "zoom";',
    'type Tool = "select" | "bbox" | "polygon" | "mask" | "brush" | "eraser" | "wand" | "pan" | "zoom" | "pen";'
)

# 3. Add BezierNode interface
interface_target = 'interface Point { x: number; y: number }'
interface_new = '''interface Point { x: number; y: number }
interface BezierNode { x: number; y: number; cp1x?: number; cp1y?: number; cp2x?: number; cp2y?: number }'''
content = content.replace(interface_target, interface_new)

# 4. Add Pen to TOOLS
tools_target = '{ id: "brush",   icon: Brush,         label: "Brush",      key: "/" },'
tools_new = '''  { id: "pen",     icon: PenTool,       label: "Pen Tool",   key: "N" },
  { id: "brush",   icon: Brush,         label: "Brush",      key: "/" },'''
content = content.replace(tools_target, tools_new)

# 5. Add penNodes state
state_target = 'const [currentPolygon, setCurrentPolygon] = useState<Point[]>([]);'
state_new = '''const [currentPolygon, setCurrentPolygon] = useState<Point[]>([]);
  const [penNodes, setPenNodes] = useState<BezierNode[]>([]);'''
content = content.replace(state_target, state_new)

# 6. Add draw logic
draw_target = '''    // Draw current polygon/brush being drawn'''
draw_new = '''    // Draw current pen path
    if (tool === "pen" && penNodes.length > 0) {
      const cls = projectClasses.find((c) => c.id === classId) || projectClasses[0];
      const color = cls?.color || "#3b82f6";
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(penNodes[0].x, penNodes[0].y);
      for(let i=1; i<penNodes.length; i++) {
        const prev = penNodes[i-1];
        const curr = penNodes[i];
        ctx.bezierCurveTo(
          prev.cp2x ?? prev.x, prev.cp2y ?? prev.y,
          curr.cp1x ?? curr.x, curr.cp1y ?? curr.y,
          curr.x, curr.y
        );
      }
      if (currentPos && !drawing) { // preview line
        const prev = penNodes[penNodes.length - 1];
        ctx.bezierCurveTo(
          prev.cp2x ?? prev.x, prev.cp2y ?? prev.y,
          currentPos.x, currentPos.y,
          currentPos.x, currentPos.y
        );
      }
      ctx.stroke();

      // Draw nodes and handles
      penNodes.forEach(node => {
        ctx.fillStyle = "white"; ctx.fillRect(node.x-2, node.y-2, 4, 4);
        if (node.cp2x !== undefined && node.cp2y !== undefined && (node.cp2x !== node.x || node.cp2y !== node.y)) {
          ctx.beginPath(); ctx.moveTo(node.x, node.y); ctx.lineTo(node.cp2x, node.cp2y); ctx.stroke();
          ctx.fillRect(node.cp2x-2, node.cp2y-2, 4, 4);
        }
        if (node.cp1x !== undefined && node.cp1y !== undefined && (node.cp1x !== node.x || node.cp1y !== node.y)) {
          ctx.beginPath(); ctx.moveTo(node.x, node.y); ctx.lineTo(node.cp1x, node.cp1y); ctx.stroke();
          ctx.fillRect(node.cp1x-2, node.cp1y-2, 4, 4);
        }
      });
    }

    // Draw current polygon/brush being drawn'''
content = content.replace(draw_target, draw_new)

# 7. Add mouse handlers
# handleMouseDown
mousedown_target = '''    if (tool === "brush") {'''
mousedown_new = '''    if (tool === "pen") {
      setDrawing(true);
      if (penNodes.length >= 2) {
        const first = penNodes[0];
        const dist = Math.hypot(pos.x - first.x, pos.y - first.y);
        if (dist < 10 / zoom) {
          // Close path
          const polyPoints: Point[] = [];
          const steps = 20;
          for(let i=0; i<penNodes.length; i++) {
             const p0 = penNodes[i];
             const p3 = penNodes[(i+1)%penNodes.length];
             const p1 = {x: p0.cp2x ?? p0.x, y: p0.cp2y ?? p0.y};
             const p2 = {x: p3.cp1x ?? p3.x, y: p3.cp1y ?? p3.y};
             for(let t=0; t<1; t+=1/steps) {
                 const mt = 1-t;
                 const x = mt*mt*mt*p0.x + 3*mt*mt*t*p1.x + 3*mt*t*t*p2.x + t*t*t*p3.x;
                 const y = mt*mt*mt*p0.y + 3*mt*mt*t*p1.y + 3*mt*t*t*p2.y + t*t*t*p3.y;
                 polyPoints.push({x, y});
             }
          }
          const cls = projectClasses.find((c) => c.id === classId) || projectClasses[0];
          const newAnn: AnnotationObj = {
            id: `ann-${Date.now()}`,
            classId: cls.id,
            className: cls.name,
            type: "polygon",
            polygon: polyPoints.map((p) => ({ x: (p.x - offsetX) / W, y: (p.y - offsetY) / H })),
            source: "manual",
            visible: true,
            selected: true,
          };
          onAnnotationsChange([...annotations.map(a => ({...a, selected: false})), newAnn]);
          onSelect(newAnn.id);
          setPenNodes([]);
          setDrawing(false);
          setCurrentPos(null);
          return;
        }
      }
      setPenNodes([...penNodes, { x: pos.x, y: pos.y, cp1x: pos.x, cp1y: pos.y, cp2x: pos.x, cp2y: pos.y }]);
      setCurrentPos(pos);
      return;
    }

    if (tool === "brush") {'''
content = content.replace(mousedown_target, mousedown_new)

# handleMouseMove
mousemove_target = '''    if (drawing && tool === "brush") {'''
mousemove_new = '''    if (tool === "pen") {
      if (drawing) {
        setPenNodes(prev => {
          if(prev.length === 0) return prev;
          const next = [...prev];
          const last = {...next[next.length - 1]};
          last.cp2x = getCanvasPos(e).x;
          last.cp2y = getCanvasPos(e).y;
          last.cp1x = last.x - (getCanvasPos(e).x - last.x);
          last.cp1y = last.y - (getCanvasPos(e).y - last.y);
          next[next.length - 1] = last;
          return next;
        });
      }
      setCurrentPos(getCanvasPos(e));
      return;
    }
    if (drawing && tool === "brush") {'''
content = content.replace(mousemove_target, mousemove_new)

# handleMouseUp
mouseup_target = '''    if (drawing && tool === "brush") {'''
mouseup_new = '''    if (tool === "pen") {
      setDrawing(false);
      return;
    }
    if (drawing && tool === "brush") {'''
content = content.replace(mouseup_target, mouseup_new)

# 8. Update Keyboard Map
keymap_target = '''        "/": "brush"'''
keymap_new = '''        "/": "brush",
        n: "pen"'''
content = content.replace(keymap_target, keymap_new)

# 9. Update cursor
cursor_target = '''    tool === "brush" ? "crosshair" :'''
cursor_new = '''    tool === "brush" ? "crosshair" :
    tool === "pen" ? "crosshair" :'''
content = content.replace(cursor_target, cursor_new)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Patch applied successfully")
