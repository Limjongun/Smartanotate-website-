import sys

content = open(r'D:\anotation\frontend\app\annotate\[imageId]\page.tsx', 'r', encoding='utf-8').read()

part1_target = """  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(pan.x, pan.y);

    // Draw image
    ctx.drawImage(img, 0, 0, canvas.width / zoom, canvas.height / zoom);

    const W = canvas.width / zoom;
    const H = canvas.height / zoom;

    // Draw annotations
    annotations.forEach((ann) => {
      if (!ann.visible) return;
      const cls = projectClasses.find((c) => c.id === ann.classId);
      const color = cls?.color || "#3b82f6";
      const selected = ann.selected;
      const fillAlpha = showMasks ? "40" : "18";

      if (ann.type === "bbox" && ann.bbox) {
        const { x, y, w, h } = ann.bbox;
        const px = x * W, py = y * H, pw = w * W, ph = h * H;"""

part1_repl = """  const getImageLayout = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return null;
    
    const canvasW = canvas.width / zoom;
    const canvasH = canvas.height / zoom;
    const imgRatio = img.width / img.height;
    const canvasRatio = canvasW / canvasH;
    
    let drawW, drawH, offsetX, offsetY;
    if (imgRatio > canvasRatio) {
      drawW = canvasW;
      drawH = canvasW / imgRatio;
      offsetX = 0;
      offsetY = (canvasH - drawH) / 2;
    } else {
      drawH = canvasH;
      drawW = canvasH * imgRatio;
      offsetX = (canvasW - drawW) / 2;
      offsetY = 0;
    }
    
    return { drawW, drawH, offsetX, offsetY };
  }, [zoom]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(pan.x, pan.y);

    const layout = getImageLayout();
    if (!layout) {
      ctx.restore();
      return;
    }
    const { drawW: W, drawH: H, offsetX, offsetY } = layout;

    // Draw image
    ctx.drawImage(img, offsetX, offsetY, W, H);

    // Draw annotations
    annotations.forEach((ann) => {
      if (!ann.visible) return;
      const cls = projectClasses.find((c) => c.id === ann.classId);
      const color = cls?.color || "#3b82f6";
      const selected = ann.selected;
      const fillAlpha = showMasks ? "40" : "18";

      if (ann.type === "bbox" && ann.bbox) {
        const { x, y, w, h } = ann.bbox;
        const px = offsetX + x * W, py = offsetY + y * H, pw = w * W, ph = h * H;"""

content = content.replace(part1_target, part1_repl)

part2_target = """        ctx.beginPath();
        ann.polygon.forEach((p, i) => {
          if (i === 0) ctx.moveTo(p.x * W, p.y * H);
          else ctx.lineTo(p.x * W, p.y * H);
        });
        ctx.closePath();
        if (showMasks || selected) {
          ctx.fill();
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Polygon handles
        if (selected) {
          ctx.fillStyle = color;
          ann.polygon.forEach((p) => {
            ctx.fillRect(p.x * W - 3, p.y * H - 3, 6, 6);
          });
        }
        
        // Label at first point
        if (ann.polygon.length > 0) {
          const conf = ann.confidence ? ` ${(ann.confidence * 100).toFixed(0)}%` : "";
          const label = `${ann.className}${conf}`;
          ctx.font = "bold 11px Inter, sans-serif";
          const tw = ctx.measureText(label).width;
          const labelY = ann.polygon[0].y * H - 10;
          ctx.fillStyle = color;
          ctx.fillRect(ann.polygon[0].x * W, labelY - 12, tw + 10, 16);
          ctx.fillStyle = "white";
          ctx.fillText(label, ann.polygon[0].x * W + 5, labelY);
        }"""

part2_repl = """        ctx.beginPath();
        ann.polygon.forEach((p, i) => {
          if (i === 0) ctx.moveTo(offsetX + p.x * W, offsetY + p.y * H);
          else ctx.lineTo(offsetX + p.x * W, offsetY + p.y * H);
        });
        ctx.closePath();
        if (showMasks || selected) {
          ctx.fill();
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Polygon handles
        if (selected) {
          ctx.fillStyle = color;
          ann.polygon.forEach((p) => {
            ctx.fillRect(offsetX + p.x * W - 3, offsetY + p.y * H - 3, 6, 6);
          });
        }
        
        // Label at first point
        if (ann.polygon.length > 0) {
          const conf = ann.confidence ? ` ${(ann.confidence * 100).toFixed(0)}%` : "";
          const label = `${ann.className}${conf}`;
          ctx.font = "bold 11px Inter, sans-serif";
          const tw = ctx.measureText(label).width;
          const labelY = offsetY + ann.polygon[0].y * H - 10;
          ctx.fillStyle = color;
          ctx.fillRect(offsetX + ann.polygon[0].x * W, labelY - 12, tw + 10, 16);
          ctx.fillStyle = "white";
          ctx.fillText(label, offsetX + ann.polygon[0].x * W + 5, labelY);
        }"""

content = content.replace(part2_target, part2_repl)

part3_target = """]}, [annotations, drawing, startPos, currentPos, tool, zoom, pan, classId, projectClasses, currentPolygon, showMasks]);"""

part3_repl = """]}, [annotations, drawing, startPos, currentPos, tool, zoom, pan, classId, projectClasses, currentPolygon, showMasks, getImageLayout]);"""
content = content.replace(part3_target, part3_repl)

part4_target = """    const pos = getCanvasPos(e);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.width / zoom;
    const H = canvas.height / zoom;

    if (tool === "select") {
      // Check if clicking on an annotation
      let found: string | null = null;
      for (const ann of [...annotations].reverse()) {
        if (ann.type === "bbox" && ann.bbox) {
          const { x, y, w, h } = ann.bbox;
          if (pos.x >= x * W && pos.x <= (x + w) * W && pos.y >= y * H && pos.y <= (y + h) * H) {
            found = ann.id;
            break;
          }
        }
      }"""

part4_repl = """    const pos = getCanvasPos(e);
    const layout = getImageLayout();
    if (!layout) return;
    const { drawW: W, drawH: H, offsetX, offsetY } = layout;

    if (tool === "select") {
      // Check if clicking on an annotation
      let found: string | null = null;
      for (const ann of [...annotations].reverse()) {
        if (ann.type === "bbox" && ann.bbox) {
          const { x, y, w, h } = ann.bbox;
          if (pos.x >= offsetX + x * W && pos.x <= offsetX + (x + w) * W && pos.y >= offsetY + y * H && pos.y <= offsetY + (y + h) * H) {
            found = ann.id;
            break;
          }
        }
      }"""

content = content.replace(part4_target, part4_repl)

part5_target = """            type: "polygon",
            polygon: currentPolygon.map((p) => ({ x: p.x / W, y: p.y / H })),
            source: "manual",
            visible: true,"""

part5_repl = """            type: "polygon",
            polygon: currentPolygon.map((p) => ({ x: (p.x - offsetX) / W, y: (p.y - offsetY) / H })),
            source: "manual",
            visible: true,"""

content = content.replace(part5_target, part5_repl)

part6_target = """    if (drawing && startPos && currentPos && tool === "bbox") {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const W = canvas.width / zoom;
      const H = canvas.height / zoom;

      const bx = Math.min(startPos.x, currentPos.x) / W;
      const by = Math.min(startPos.y, currentPos.y) / H;
      const bw = Math.abs(currentPos.x - startPos.x) / W;
      const bh = Math.abs(currentPos.y - startPos.y) / H;"""

part6_repl = """    if (drawing && startPos && currentPos && tool === "bbox") {
      const layout = getImageLayout();
      if (!layout) return;
      const { drawW: W, drawH: H, offsetX, offsetY } = layout;

      const bx = (Math.min(startPos.x, currentPos.x) - offsetX) / W;
      const by = (Math.min(startPos.y, currentPos.y) - offsetY) / H;
      const bw = Math.abs(currentPos.x - startPos.x) / W;
      const bh = Math.abs(currentPos.y - startPos.y) / H;"""

content = content.replace(part6_target, part6_repl)

open(r'D:\anotation\frontend\app\annotate\[imageId]\page.tsx', 'w', encoding='utf-8').write(content)
print('Done!')
