import sys

file_path = r'D:\anotation\frontend\app\segment-annotate\[imageId]\page.tsx'
content = open(file_path, 'r', encoding='utf-8').read()

# 1. Update Tools (Remove bbox)
content = content.replace(
    '{ id: "bbox",    icon: Square,        label: "Box",        key: "B" },',
    ''
)

# 2. Add brush logic to handleMouseDown
target_mousedown_polygon = '''    if (tool === "polygon") {'''
replacement_mousedown_polygon = '''    if (tool === "brush") {
      setDrawing(true);
      setCurrentPolygon([pos]);
      setCurrentPos(pos);
      return;
    }

    if (tool === "polygon") {'''
content = content.replace(target_mousedown_polygon, replacement_mousedown_polygon)

# 3. Add brush logic to handleMouseMove
target_mousemove = '''    if (tool === "polygon" && currentPolygon.length > 0) {'''
replacement_mousemove = '''    if (drawing && tool === "brush") {
      setCurrentPolygon((prev) => [...prev, getCanvasPos(e)]);
      setCurrentPos(getCanvasPos(e));
      return;
    }
    if (tool === "polygon" && currentPolygon.length > 0) {'''
content = content.replace(target_mousemove, replacement_mousemove)

# 4. Add brush logic to handleMouseUp
target_mouseup = '''    if (drawing && startPos && currentPos && tool === "bbox") {'''
replacement_mouseup = '''    if (drawing && tool === "brush") {
      const cls = projectClasses.find((c) => c.id === classId) || projectClasses[0];
      const layout = getImageLayout();
      if (!layout) return;
      const { drawW: W, drawH: H, offsetX, offsetY } = layout;

      if (currentPolygon.length > 2) {
        const newAnn: AnnotationObj = {
          id: `ann-${Date.now()}`,
          classId: cls.id,
          className: cls.name,
          type: "polygon",
          polygon: currentPolygon.map((p) => ({ x: (p.x - offsetX) / W, y: (p.y - offsetY) / H })),
          source: "manual",
          visible: true,
          selected: true,
        };
        onAnnotationsChange([...annotations.map(a => ({...a, selected: false})), newAnn]);
        onSelect(newAnn.id);
      }
      setCurrentPolygon([]);
      setDrawing(false);
      setCurrentPos(null);
      return;
    }

    if (drawing && startPos && currentPos && tool === "bbox") {'''
content = content.replace(target_mouseup, replacement_mouseup)

# 5. Update draw() to render brush
target_draw_polygon = '''    // Draw current polygon being drawn
    if (tool === "polygon" && currentPolygon.length > 0) {'''
replacement_draw_polygon = '''    // Draw current polygon/brush being drawn
    if ((tool === "polygon" || tool === "brush") && currentPolygon.length > 0) {'''
content = content.replace(target_draw_polygon, replacement_draw_polygon)

# 6. Change breadcrumbs
content = content.replace(
    '''<span style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>Annotate</span>''',
    '''<span style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>Segment Annotate</span>'''
)
content = content.replace(
    '''onClick={() => hasPrev && router.push(`/annotate/${filmStripImages[currentIndex - 1].id}`)}''',
    '''onClick={() => hasPrev && router.push(`/segment-annotate/${filmStripImages[currentIndex - 1].id}`)}'''
)
content = content.replace(
    '''onClick={() => hasNext && router.push(`/annotate/${filmStripImages[currentIndex + 1].id}`)}''',
    '''onClick={() => hasNext && router.push(`/segment-annotate/${filmStripImages[currentIndex + 1].id}`)}'''
)

open(file_path, 'w', encoding='utf-8').write(content)
print("Patch applied")
