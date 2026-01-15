// JobPort Shell Builder — Phase 3.2 scaffolding add-ons
// Adds: Left Nav (in 1 Desktop / Shell) + Applications List rows (in Frame 2 / Applications List)
// Constraints: no catch {}, no layoutSizingHorizontal="FILL"

figma.skipInvisibleInstanceChildren = true;

function findFrameByNameOnPage(page, name) {
  for (const n of page.children) {
    if (n.type === "FRAME" && n.name === name) return n;
  }
  return null;
}

function ensureFrame(parent, name) {
  const existing = parent.children.find(n => n.type === "FRAME" && n.name === name);
  if (existing && existing.type === "FRAME") return existing;
  const f = figma.createFrame();
  f.name = name;
  parent.appendChild(f);
  return f;
}

function ensureText(parent, name, chars) {
  const existing = parent.children.find(n => n.type === "TEXT" && n.name === name);
  if (existing && existing.type === "TEXT") {
    existing.characters = chars;
    return existing;
  }
  const t = figma.createText();
  t.name = name;
  t.characters = chars;
  parent.appendChild(t);
  return t;
}

function setSolidFill(node, hex, opacity) {
  const rgb = hexToRgb01(hex);
  node.fills = [{
    type: "SOLID",
    color: rgb,
    opacity: opacity == null ? 1 : opacity
  }];
}

function setSolidStroke(node, hex, opacity) {
  const rgb = hexToRgb01(hex);
  node.strokes = [{
    type: "SOLID",
    color: rgb,
    opacity: opacity == null ? 1 : opacity
  }];
  node.strokeWeight = 1;
}

function hexToRgb01(hex) {
  const h = hex.replace("#", "").trim();
  const bigint = parseInt(h, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return { r: r / 255, g: g / 255, b: b / 255 };
}

function setAutoLayoutRow(frame, gap, padH, padV) {
  frame.layoutMode = "HORIZONTAL";
  frame.primaryAxisAlignItems = "MIN";
  frame.counterAxisAlignItems = "CENTER";
  frame.itemSpacing = gap;
  frame.paddingLeft = padH;
  frame.paddingRight = padH;
  frame.paddingTop = padV;
  frame.paddingBottom = padV;
  frame.primaryAxisSizingMode = "FIXED";
  frame.counterAxisSizingMode = "FIXED";
}

function setAutoLayoutCol(frame, gap, padH, padV) {
  frame.layoutMode = "VERTICAL";
  frame.primaryAxisAlignItems = "MIN";
  frame.counterAxisAlignItems = "MIN";
  frame.itemSpacing = gap;
  frame.paddingLeft = padH;
  frame.paddingRight = padH;
  frame.paddingTop = padV;
  frame.paddingBottom = padV;
  frame.primaryAxisSizingMode = "FIXED";
  frame.counterAxisSizingMode = "FIXED";
}

async function main() {
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  await figma.loadFontAsync({ family: "Inter", style: "Medium" });

  const page = figma.currentPage;

    // --- Locate frames from selection (no name dependency) ---
    let shell = null;
    let appsFrame = null;

    for (const n of figma.currentPage.selection) {
      if (n.type === "FRAME" && n.name.includes("Shell")) shell = n;
      if (n.type === "FRAME" && n.name.includes("Applications List")) appsFrame = n;
    }

    if (!shell || !appsFrame) {
      figma.notify('Select BOTH frames: the Shell frame and "Frame 2 / Applications List", then run again.');
      figma.closePlugin();
      return;
    }

  // =========================
  // 1) Add Left Nav to Shell
  // =========================
  const TOPBAR_H = 64;
  const SHELL_W = shell.width;
  const SHELL_H = shell.height;

  // Ensure Shell has a neutral background so nav reads visually
  setSolidFill(shell, "#F7F7F8", 1);

  const leftNav = ensureFrame(shell, "Left Nav");
  leftNav.x = 0;
  leftNav.y = TOPBAR_H;
  leftNav.resize(240, SHELL_H - TOPBAR_H);

  // Subtle surface + border
  setSolidFill(leftNav, "#FFFFFF", 1);
  setSolidStroke(leftNav, "#E6E6EA", 1);

  setAutoLayoutCol(leftNav, 8, 12, 12);

  // Nav Items container (so you can componentize later)
  const navList = ensureFrame(leftNav, "Nav / List");
  navList.resize(240 - 24, (SHELL_H - TOPBAR_H) - 24);
  setAutoLayoutCol(navList, 8, 0, 0);
  navList.fills = []; // transparent

  function makeNavItem(label, state) {
    const item = figma.createFrame();
    item.name = `Nav / Item (${label})`;
    item.resize(240 - 24, 40);
    setAutoLayoutRow(item, 10, 12, 10);
    item.cornerRadius = 10;

    // state styling (neutral only)
    if (state === "active") {
      setSolidFill(item, "#F2F2F5", 1);
    } else {
      item.fills = [];
    }

    // Icon placeholder
    const icon = figma.createRectangle();
    icon.name = "Icon";
    icon.resize(20, 20);
    icon.cornerRadius = 5;
    setSolidFill(icon, "#D8D8DE", 1);

    // Label
    const t = figma.createText();
    t.name = "Label";
    t.fontName = { family: "Inter", style: "Medium" };
    t.fontSize = 14;
    t.characters = label;
    t.fills = [{
      type: "SOLID",
      color: hexToRgb01(state === "disabled" ? "#9B9BA3" : "#1C1C22"),
      opacity: 1
    }];

    item.appendChild(icon);
    item.appendChild(t);
    return item;
  }

  // Build nav items only if missing
  const hasAppsNav = navList.children.some(n => n.type === "FRAME" && n.name.includes("(Applications)"));
  const hasAlertsNav = navList.children.some(n => n.type === "FRAME" && n.name.includes("(Alerts)"));
  if (!hasAppsNav) navList.appendChild(makeNavItem("Applications", "active"));
  if (!hasAlertsNav) navList.appendChild(makeNavItem("Alerts", "default"));

  // ==========================================
  // 2) Add Applications List + row skeletons
  // ==========================================
  // Place list under existing header
  const header = ensureFrame(appsFrame, "Applications / Header");
  // If header exists, leave it alone. If not, it’s now created but empty.

  const list = ensureFrame(appsFrame, "Applications / List");
  // Position below header (simple heuristic)
  list.x = 0;
  list.y = header.y + header.height + 16;

  // Size it to the frame
  const listW = appsFrame.width;
  const listH = Math.max(300, appsFrame.height - list.y - 16);
  list.resize(listW, listH);

  list.fills = [];
  setAutoLayoutCol(list, 8, 0, 0);

  function makeAppRow(i) {
    const row = figma.createFrame();
    row.name = `Application Row ${i}`;
    row.resize(listW, 52);
    setAutoLayoutRow(row, 12, 16, 14);
    row.cornerRadius = 12;
    setSolidFill(row, "#FFFFFF", 1);
    setSolidStroke(row, "#E6E6EA", 1);

    function col(name, text, w) {
      const c = figma.createFrame();
      c.name = name;
      c.resize(w, 24);
      c.layoutMode = "HORIZONTAL";
      c.primaryAxisAlignItems = "MIN";
      c.counterAxisAlignItems = "CENTER";
      c.primaryAxisSizingMode = "FIXED";
      c.counterAxisSizingMode = "FIXED";
      c.fills = [];

      const t = figma.createText();
      t.name = "Text";
      t.fontName = { family: "Inter", style: "Regular" };
      t.fontSize = 13;
      t.characters = text;
      t.fills = [{ type: "SOLID", color: hexToRgb01("#6B6B73"), opacity: 1 }];

      c.appendChild(t);
      return c;
    }

    // Column widths (structure-first; tweak later)
    const company = col("Company", "Company", 220);
    const role = col("Role", "Role", 260);
    const status = col("Status", "Status", 140);
    const lastChecked = col("Last Checked", "Last checked", 160);
    const health = col("Health", "—", 80);

    row.appendChild(company);
    row.appendChild(role);
    row.appendChild(status);
    row.appendChild(lastChecked);
    row.appendChild(health);

    return row;
  }

  // Add rows only if list is empty
  if (list.children.length === 0) {
    for (let i = 1; i <= 6; i++) {
      list.appendChild(makeAppRow(i));
    }
  }

  // Helpful: ensure content area accounts for nav width (visual only)
  // (We won't reposition your existing content if you already did.)
  figma.notify("Added Left Nav + Applications list row skeletons.");
  figma.closePlugin();
}

main();
