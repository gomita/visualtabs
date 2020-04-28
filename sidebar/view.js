////////////////////////////////////////////////////////////////////////////////
// global

var gWindowId;
var gIncognito;
var gPinList;
var gTabList;
var gTabElt;
var gPopup;
var gPrefs;
var gScrollTop = 0;
var gDragOverString = "";
var gDragLeaveTimer = 0;
var gMouseOverTabId;
var gMouseOverTimer;
var gMouseDownFlag = false;
var gHlightTabIds = [];

function init() {
	gPinList = document.getElementById("pinList");
	gTabList = document.getElementById("tabList");
	gTabElt  = document.getElementById("tab");
	gPopup   = document.getElementById("popup");
	gTabList.parentNode.addEventListener("mousedown", onMouseDown);
	gTabList.parentNode.addEventListener("mouseover", onMouseOver);
	document.addEventListener("contextmenu", onContextMenu);
	document.addEventListener("click", onClick);
	document.addEventListener("dblclick", onDblClick);
	document.addEventListener("keydown", onKeyDown);
	document.addEventListener("dragstart", onDragStart);
	document.addEventListener("dragover", onDragOver);
	document.addEventListener("dragleave", onDragLeave);
	document.addEventListener("drop", onDrop);
	document.addEventListener("wheel", onWheel);
	gPinList.addEventListener("auxclick", onAuxClick);
	gTabList.addEventListener("scroll", onScroll);
	gTabList.addEventListener("auxclick", onAuxClick);
	gTabList.addEventListener("animationend", onAnimationEnd);
	browser.tabs.onActivated.addListener(onActivated);
	browser.tabs.onCreated.addListener(onCreated);
	browser.tabs.onRemoved.addListener(onRemoved);
	browser.tabs.onUpdated.addListener(onUpdated);
	browser.tabs.onMoved.addListener(onMoved);
	browser.tabs.onAttached.addListener(onAttached);
	browser.tabs.onDetached.addListener(onDetached);
	browser.tabs.onReplaced.addListener(onReplaced);
	browser.tabs.onZoomChange.addListener(onZoomChange);
	browser.tabs.onHighlighted.addListener(onHighlighted);
	browser.runtime.onMessage.addListener(onMessage);
	browser.contextualIdentities.onCreated.addListener(onContextChanged);
	browser.contextualIdentities.onRemoved.addListener(onContextChanged);
	browser.contextualIdentities.onUpdated.addListener(onContextChanged);
	window.matchMedia("(prefers-color-scheme: dark)").addListener(rebuildList);
	rebuildList();
	setTimeout(() => localizeUI(), 0);
}

function uninit() {
	gTabList.parentNode.removeEventListener("mousedown", onMouseDown);
	gTabList.parentNode.removeEventListener("mouseover", onMouseOver);
	document.removeEventListener("contextmenu", onContextMenu);
	document.removeEventListener("click", onClick);
	document.removeEventListener("dblclick", onDblClick);
	document.removeEventListener("keydown", onKeyDown);
	document.removeEventListener("dragstart", onDragStart);
	document.removeEventListener("dragover", onDragOver);
	document.removeEventListener("dragleave", onDragLeave);
	document.removeEventListener("drop", onDrop);
	document.removeEventListener("wheel", onWheel);
	gPinList.removeEventListener("auxclick", onAuxClick);
	gTabList.removeEventListener("scroll", onScroll);
	gTabList.removeEventListener("auxclick", onAuxClick);
	gTabList.removeEventListener("animationend", onAnimationEnd);
	browser.tabs.onActivated.removeListener(onActivated);
	browser.tabs.onCreated.removeListener(onCreated);
	browser.tabs.onRemoved.removeListener(onRemoved);
	browser.tabs.onUpdated.removeListener(onUpdated);
	browser.tabs.onMoved.removeListener(onMoved);
	browser.tabs.onAttached.removeListener(onAttached);
	browser.tabs.onDetached.removeListener(onDetached);
	browser.tabs.onReplaced.removeListener(onReplaced);
	browser.tabs.onZoomChange.removeListener(onZoomChange);
	browser.tabs.onHighlighted.removeListener(onHighlighted);
	browser.runtime.onMessage.removeListener(onMessage);
	browser.contextualIdentities.onCreated.removeListener(onContextChanged);
	browser.contextualIdentities.onRemoved.removeListener(onContextChanged);
	browser.contextualIdentities.onUpdated.removeListener(onContextChanged);
	window.matchMedia("(prefers-color-scheme: dark)").removeListener(rebuildList);
	clearInterval(gMouseOverTimer);
	gPinList = null;
	gTabList = null;
	gTabElt  = null;
	gPopup   = null;
	gPrefs   = null;
}

function localizeUI() {
	[...document.querySelectorAll("[i18n]")].map(elt => {
		elt.getAttribute("i18n").split(",").map(val => {
			let [attr, msg] = val.split(":");
			if (attr == "text")
				elt.textContent = browser.i18n.getMessage(msg);
			else
				elt.setAttribute(attr, browser.i18n.getMessage(msg));
			elt.removeAttribute("i18n");
		});
	});
}

////////////////////////////////////////////////////////////////////////////////
// DOM event handlers

function onMouseDown(event) {
	// select tabs on mouse down
	if (event.button == 0 && gPopup.hidden) {
		let cmd;
		let tabId = getTabIdByElement(event.target);
		if (event.ctrlKey && event.shiftKey) {
			cmd = "hlightAdditionalRange";
		}
		else if (event.shiftKey) {
			cmd = "hlightRange";
		}
		else if (event.ctrlKey) {
			cmd = "hlight";
		}
		else if (gHlightTabIds.length == 1 || !gHlightTabIds.includes(tabId)) {
			// mousedown on a tab outside of the highlighted tabs
			gMouseDownFlag = false;
			cmd = "select";
		}
		else {
			// mousedown on a tab inside of the highlighted tabs
			gMouseDownFlag = true;
			cmd = "activeChange";
		}
		doCommand(cmd, tabId);
	}
	// prevent autoscroll with middle-button
	else if (event.button == 1) {
		event.preventDefault();
		event.stopPropagation();
		return;
	}
}

function onMouseOver(event) {
	if (gPrefs.mode == "none")
		return;
	if (gPrefs.mode == "full" && gPrefs.autoUpdate == 0)
		return;
	// do nothing when mouse is over blank area or same tab
	let tabId = getTabIdByElement(event.target);
	if (!tabId || tabId == gMouseOverTabId)
		return;
	// mouse is over on different tab
	gMouseOverTabId = tabId;
	let oldElt = gTabList.parentNode.querySelector(".tab[focus]");
	if (oldElt) {
		oldElt.removeAttribute("focus");
		oldElt.setAttribute("data-draw-age", 0);
	}
	if (!gPopup.hidden)
		hidePopup();
	let elt = getElementByTabId(tabId);
	elt.setAttribute("focus", "true");
	if (!elt.hasAttribute("data-draw-age"))
		drawThumbnail(tabId);
	if (gPrefs.mode == "minimal" || gPrefs.mode == "compact") {
		setTimeout(() => { elt.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, 300);
	}
	// set repeating timer
	clearInterval(gMouseOverTimer);
	gMouseOverTimer = setInterval(() => {
		// keep previewing while popup is showing
		if (!gPopup.hidden)
			return;
		// keep previewing while mouse points to the same tab
		let elt = gTabList.parentNode.querySelector(".tab:hover");
		if (elt && getTabIdByElement(elt) == gMouseOverTabId) {
			if (gPrefs.autoUpdate > 0) {
				// add elapsed time to age and redraw thumbnail at specified interval
				let age = parseInt(elt.getAttribute("data-draw-age"), 10);
				if ((age += 100) >= gPrefs.autoUpdate) {
					age = 0;
					drawThumbnail(gMouseOverTabId);
				}
				elt.setAttribute("data-draw-age", age);
			}
			return;
		}
		// stop previewing and cancel timer when outside the tab
		let oldElt = gTabList.parentNode.querySelector(".tab[focus]");
		if (oldElt) {
			oldElt.removeAttribute("focus");
			oldElt.setAttribute("data-draw-age", 0);
		}
		clearInterval(gMouseOverTimer);
		gMouseOverTabId = null;
	}, 100);
}

function onContextMenu(event) {
	// ignore right-click on menu and popup
	if (event.target.closest("#menu, #popup"))
		event.preventDefault();
	let tabId = getTabIdByElement(event.target);
	if (tabId) {
		// show built-in tab context menu
		browser.menus.overrideContext({ context: "tab", tabId });
	}
	else {
		// show popup
		event.preventDefault();
		showPopup(event);
	}
}

function onClick(event) {
	if (event.button == 2)
		return;
	let target = event.target;
	// clicks on popup
	if (!gPopup.hidden) {
		if (target == gPopup)
			return;
		hidePopup();
		doCommand(target.getAttribute("command"));
	}
	// clicks on blank space
	else if (target == document.body) {
		return;
	}
	// clicks on tab close button
	else if (target.classList.contains("close")) {
		doCommand("close", getTabIdByElement(target));
	}
	// click on tab
	else if (target.closest(".tab")) {
		// when clicks on a tab inside the highlighted tabs, 
		// reset all highlights and select only the clicked tab
		if (gMouseDownFlag) {
			gMouseDownFlag = false;
			doCommand("activeReset", getTabIdByElement(target));
		}
	}
	// clicks on new tab button
	else if (target.id == "newTab") {
		doCommand("create");
	}
	// clicks on menu_toggle button
	else if (target.id == "menu_toggle") {
		doCommand("menu_toggle");
	}
	// clicks on menu_mode button
	else if (target.id == "menu_mode") {
		switch (gPrefs.mode) {
			case "none"   : gPrefs.mode = "minimal"; break;
			case "minimal": gPrefs.mode = "compact"; break;
			case "compact": gPrefs.mode = "full"; break;
			case "full"   : gPrefs.mode = "none"; break;
		}
		browser.storage.local.set(gPrefs);
		rebuildList();
	}
	// clicks on menu_options button
	else if (target.id == "menu_options") {
		browser.runtime.openOptionsPage();
	}
	// clicks on menu_contexts button
	else if (target.id == "menu_contexts") {
		doCommand("menu_contexts");
	}
	// clicks on menu_contexts button
	else if (target.id.startsWith("firefox-container-")) {
		doCommand("container", target.id);
	}
}

function onAuxClick(event) {
	// middle-clicks on tab list
	if (event.button == 1)
		doCommand("close", getTabIdByElement(event.target));
}

function onDblClick(event) {
	// double-clicks on blank space
	if (event.button == 0 && event.target == document.body)
		doCommand("create");
}

function onKeyDown(event) {
	// Esc key to close on popup
	if (!gPopup.hidden && event.key == "Escape") {
		event.preventDefault();
		hidePopup();
	}
}

function onWheel(event) {
	// prevent zoom-in/out with mouse wheel
	if (event.ctrlKey || event.metaKey)
		event.preventDefault();
}

function onScroll(event) {
	let scrollTop = event.target.scrollTop;
	if (gScrollTop > 0 && scrollTop == 0)
		gTabList.removeAttribute("overflow");
	else if (gScrollTop == 0 && scrollTop > 0)
		gTabList.setAttribute("overflow", "true");
	gScrollTop = scrollTop;
}

function onAnimationEnd(event) {
	event.target.removeAttribute("bursting");
}

////////////////////////////////////////////////////////////////////////////////
// drag and drop

function onDragStart(event) {
	hidePopup();
	let tabId = getTabIdByElement(event.target);
	if (!tabId)
		return;
	let dt = event.dataTransfer;
	let elt = getElementByTabId(tabId);
	let pinned = elt.getAttribute("pinned") == "true";
	let title = elt.querySelector(".title").getAttribute("title");
	dt.setData("text/x-visualtabs", [gWindowId, tabId, pinned].join("|"));
	dt.setData("text/x-moz-url", elt.getAttribute("url") + "\n" + title);
	dt.dropEffect = "move";
}

function onDragOver(event) {
	if (gDragLeaveTimer)
		clearTimeout(gDragLeaveTimer);
	event.preventDefault();
	let dt = event.dataTransfer;
	// [...dt.mozTypesAt(0)].map(type => console.log(type + "\t" + dt.getData(type)));
	let type = "text/x-visualtabs", data = dt.getData(type);
	if (!data && !dt.mozTypesAt(0).contains("text/x-moz-url"))
		return;
	// target tabId
	let targetTabId = getTabIdByElement(event.target);
	if (!targetTabId)
		return;
	let target = getElementByTabId(targetTabId);
	if (data) {
		// source tabId
		let [sourceWinId, sourceTabId, sourcePinned] = data.split("|");
		sourceWinId = parseInt(sourceWinId, 10);
		sourceTabId = parseInt(sourceTabId, 10);
		sourcePinned = sourcePinned == "true";
		// cannot drop unpinned tab into pinned tab
		if (!sourcePinned && target.getAttribute("pinned") == "true")
			return;
		// cannot drop pinned tab into unpinned tab
		if (sourcePinned && target.getAttribute("pinned") != "true")
			return;
	}
	// orient
	let rect = target.getBoundingClientRect();
	let orient = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
	// avoid too much call, by comparing last drag over string
	let dragOverString = `drop|${orient}|${targetTabId}`;
	if (gDragOverString == dragOverString)
		return;
	gDragOverString = dragOverString;
	// show drop indicator
	let dropline = document.getElementById("dropline");
	dropline.hidden = false;
	dropline.style.top = (orient == "before" ? rect.top : rect.top + rect.height) + "px";
//	console.log(gDragOverString);
}

function onDragLeave(event) {
	// avoid flickering when dragging over dropline
	gDragLeaveTimer = setTimeout(() => {
		document.getElementById("dropline").hidden = true;
		gDragOverString = "";
	}, 10);
}

async function onDrop(event) {
	document.getElementById("dropline").hidden = true;
	event.preventDefault();
	// get first accepted flavor
	let dt = event.dataTransfer;
	let type = "text/x-visualtabs", data = dt.getData(type);
	if (!data) type = "text/x-moz-url", data = dt.getData(type);
	if (!data) return;
	// target
	let [, orient, targetTabId] = gDragOverString.split("|");
	if (!gDragOverString) {
		// drop on blank space
		orient = "after";
		targetTabId = gTabList.lastChild.getAttribute("tabId");
	}
	targetTabId = parseInt(targetTabId, 10);
	let targetTab = await browser.tabs.get(targetTabId);
	let targetIndex = targetTab.index;
	if (orient == "after")
		targetIndex++;
	if (type == "text/x-visualtabs") {
		// source
		let [sourceWinId, sourceTabId, sourcePinned] = data.split("|");
		sourceTabId = parseInt(sourceTabId, 10);
		sourceWinId = parseInt(sourceWinId, 10);
		sourcePinned = sourcePinned == "true";
		let sourceTab = await browser.tabs.get(sourceTabId);
		if (sourceWinId == gWindowId) {
			// move a tab in same window
			if (sourceTab.index < targetIndex)
				targetIndex--;
			browser.tabs.move(sourceTabId, { index: targetIndex });
		}
		else {
			// attach a tab from another window
			browser.tabs.move(sourceTabId, { windowId: gWindowId, index: targetIndex });
		}
	}
	else if (type == "text/x-moz-url") {
		// open URL in tab
		browser.tabs.create({ url: data.split("\n")[0], index: targetIndex});
	}
}

////////////////////////////////////////////////////////////////////////////////
// tab event listeners

function onActivated(activeInfo) {
	let elt = getElementByTabId(activeInfo.tabId);
	if (!elt)
		return;
//	console.log("onActivated: " + JSON.stringify(activeInfo));
	let old = gTabList.parentNode.querySelector("[selected]");
	if (old)
		old.removeAttribute("selected");
	elt.setAttribute("selected", "true");
	elt.scrollIntoView({ block: "nearest", behavior: "smooth" });
	drawThumbnail(activeInfo.tabId);
}

function onCreated(tab) {
	if (tab.windowId != gWindowId)
		return;
//	console.log("onCreated: " + JSON.stringify(tab));
	// if stacking option is enabled and tab has no opener, move it at the top
	let moveToTop = gPrefs.stacking && tab.openerTabId === undefined;
	if (moveToTop) {
		browser.tabs.move(tab.id, { index: gPinList.childNodes.length });
	}
	let elt;
	if (tab.pinned) {
		elt = gPinList.insertBefore(elementForTab(tab), [...gPinList.childNodes][tab.index]);
	}
	else if (moveToTop) {
		elt = gTabList.insertBefore(elementForTab(tab), gTabList.firstChild);
		gTabList.scrollTo(0, 0);
	}
	else {
		let index = tab.index - gPinList.childNodes.length;
		elt = gTabList.insertBefore(elementForTab(tab), [...gTabList.childNodes][index]);
		let sel = gTabList.parentNode.querySelector("[selected]");
		sel.scrollIntoView({ block: "start", behavior: "smooth" });
	}
	let newTab = document.querySelector("#newTab");
	if (newTab.getBoundingClientRect().top <= elt.getBoundingClientRect().top) {
		newTab.removeAttribute("flash");
		newTab.setAttribute("flash", "true");
		setTimeout(() => newTab.removeAttribute("flash"), 100);
	}
}

function onRemoved(tabId, removeInfo) {
	let elt = getElementByTabId(tabId);
	if (!elt)
		return;
//	console.log("onRemoved: " + tabId + " " + JSON.stringify(removeInfo));
	let list = elt.getAttribute("pinned") == "true" ? gPinList : gTabList;
	list.removeChild(elt);
}

function onUpdated(tabId, changeInfo, tab) {
	if (tab.windowId != gWindowId)
		return;
//	console.log("onUpdated: " + tabId + " " + JSON.stringify(changeInfo) + JSON.stringify(tab));
	let elt = getElementByTabId(tabId);
	if (!elt)
		return;
	// change tab title
	if (changeInfo.title) {
		elt.querySelector(".title").textContent = changeInfo.title;
		elt.querySelector(".title").setAttribute("title", changeInfo.title);
	}
	// change icon when loading start
	else if (changeInfo.status == "loading") {
		elt.querySelector(".favicon").style.backgroundImage = "";
		elt.querySelector(".burst").removeAttribute("bursting");
		elt.setAttribute("loading", "true");
		if (changeInfo.url && changeInfo.url != elt.getAttribute("url")) {
			elt.setAttribute("url", changeInfo.url);
			drawThumbnail(tabId);
		}
	}
	// refresh a tab after loading complete
	else if (changeInfo.status == "complete") {
		elt.querySelector(".favicon").style.backgroundImage = "url('" + getFaviconForTab(tab) + "')";
		elt.setAttribute("url", tab.url);
		elt.querySelector(".burst").setAttribute("bursting", "true");
		elt.removeAttribute("loading");
		drawThumbnail(tabId);
	}
	// change pinned status
	else if (changeInfo.pinned !== undefined) {
		if (changeInfo.pinned) {
			elt.setAttribute("pinned", "true");
			gPinList.insertBefore(elt, [...gPinList.childNodes][tab.index]);
		}
		else {
			elt.removeAttribute("pinned");
			gTabList.insertBefore(elt, [...gTabList.childNodes][tab.index - gPinList.childNodes.length + 1]);
		}
		drawThumbnail(tabId);
	}
	// change discarded status
	else if (changeInfo.discarded !== undefined) {
		if (changeInfo.discarded)
			elt.setAttribute("discarded", "true");
		else
			elt.removeAttribute("discarded");
	}
	// change muted status
	else if (changeInfo.mutedInfo !== undefined) {
		if (changeInfo.mutedInfo.muted)
			elt.setAttribute("muted", "true");
		else
			elt.removeAttribute("muted");
	}
}

function onMoved(tabId, moveInfo) {
	let elt = getElementByTabId(tabId);
	if (!elt)
		return;
//	console.log("onMoved: " + tabId + " " + JSON.stringify(moveInfo));
	let refIndex = moveInfo.toIndex;
	if (moveInfo.fromIndex < moveInfo.toIndex)
		refIndex++;
	if (elt.getAttribute("pinned") == "true") {
		gPinList.insertBefore(elt, [...gPinList.childNodes][refIndex]);
	}
	else {
		refIndex -= gPinList.childNodes.length;
		gTabList.insertBefore(elt, [...gTabList.childNodes][refIndex]);
	}
}

async function onAttached(tabId, attachInfo) {
	if (attachInfo.newWindowId != gWindowId)
		return;
//	console.log("onAttached: " + tabId + " " + JSON.stringify(attachInfo));
	let tabs = await browser.tabs.query({ currentWindow: true });
	let tab = tabs[attachInfo.newPosition];
	if (tab.pinned) {
		gPinList.insertBefore(elementForTab(tab), [...gPinList.childNodes][tab.index]);
	}
	else {
		let index = tab.index - gPinList.childNodes.length;
		gTabList.insertBefore(elementForTab(tab), [...gTabList.childNodes][index]);
		drawThumbnail(tab.id);
	}
}

function onDetached(tabId, detachInfo) {
	if (detachInfo.oldWindowId != gWindowId)
		return;
//	console.log("onDetached: " + tabId + " " + JSON.stringify(detachInfo));
	let elt = getElementByTabId(tabId);
	let list = elt.getAttribute("pinned") == "true" ? gPinList : gTabList;
	list.removeChild(elt);
}

function onReplaced(addedTabId, removedTabId) {
//	console.log("onReplaced: " + addedTabId + " " + removedTabId);
}

function onZoomChange(ZoomChangeInfo) {
	let elt = getElementByTabId(ZoomChangeInfo.tabId);
	if (!elt)
		return;
//	console.log("onZoomChange: " + JSON.stringify(ZoomChangeInfo));
	drawThumbnail(ZoomChangeInfo.tabId);
}

function onHighlighted(highlightInfo) {
	if (highlightInfo.windowId != gWindowId)
		return;
//	console.log("onHighlighted: " + JSON.stringify(highlightInfo));
	[...gTabList.parentNode.querySelectorAll("[highlighted]")].map(elt => {
		elt.removeAttribute("highlighted");
	});
	for (let tabId of highlightInfo.tabIds) {
		let tab = getElementByTabId(tabId);
		if (tab)
			tab.setAttribute("highlighted", "true");
		// see below
		if (!gHlightTabIds.includes(tabId))
			gHlightTabIds.push(tabId);
	}
	// gHlightTabIds is array of tabId which is sorted by user selection, 
	// while highlightInfo.tabIds is sorted by the actual visible order.
	gHlightTabIds = gHlightTabIds.filter(tabId => highlightInfo.tabIds.includes(tabId));
//	console.log("onHighlighted: gHlightTabIds = " + JSON.stringify(gHlightTabIds));
}

////////////////////////////////////////////////////////////////////////////////
// other listeners

function onMessage(request, sender, sendResponse) {
	if (request.value == "visualtabs:rebuild")
		rebuildList();
}

async function onContextChanged(ctx) {
//	console.log("context changed: " + JSON.stringify(ctx));
	rebuildList();
}

////////////////////////////////////////////////////////////////////////////////
// command

async function doCommand(aCommand, aTabId) {
	switch (aCommand) {
		case "create"   : browser.tabs.create({ active: true }); break;
		case "select"   : browser.tabs.update(aTabId, { active: true }); break;
		case "activeChange": 
			// select the tab with aTabId and keep all highlights
			var idxs = [];
			for (let id of gHlightTabIds) {
				let tab = await browser.tabs.get(id);
				tab.id == aTabId ? idxs.unshift(tab.index) : idxs.push(tab.index);
			}
			browser.tabs.highlight({ tabs: idxs }); 
			break;
		case "activeReset": 
			// select the tab with aTabId and reset all highlights
			var tab = await browser.tabs.get(aTabId);
			browser.tabs.highlight({ tabs: [tab.index] }); 
			break;
		case "hlight": 
			var idxs = [];
			for (let id of gHlightTabIds) {
				let tab = await browser.tabs.get(id);
				idxs.push(tab.index);
			}
			var tab = await browser.tabs.get(aTabId);
			let found = idxs.indexOf(tab.index);
			found < 0 ? idxs.push(tab.index) : idxs.splice(found, 1);
			browser.tabs.highlight({ tabs: idxs }); 
			break;
		case "hlightRange": 
			// fromTab is the active tab, toTab is the clicked tab
			var fromTab = await browser.tabs.get(gHlightTabIds[0]);
			var fromIdx = fromTab.index;
			var toTab = await browser.tabs.get(aTabId);
			var toIdx = toTab.index;
			var idxs = [];
			if (fromIdx < toIdx)
				for (let idx = fromIdx; idx <= toIdx; idx++) idxs.push(idx);
			else
				for (let idx = toIdx; idx <= fromIdx; idx++) idxs.push(idx);
			browser.tabs.highlight({ tabs: idxs });
			break;
		case "hlightAdditionalRange": 
			// fromTab is the last highlighted tab, toTab is the clicked tab
			var fromTab = await browser.tabs.get(gHlightTabIds[gHlightTabIds.length - 1]);
			var fromIdx = fromTab.index;
			var toTab = await browser.tabs.get(aTabId);
			var toIdx = toTab.index;
			var idxs = [];
			// first, idxs is array of indexes where the current highlighted tabs
			for (let id of gHlightTabIds) {
				let tab = await browser.tabs.get(id);
				idxs.push(tab.index);
			}
			// second, add the range of fromIdx...toIdx
			if (fromIdx < toIdx)
				for (let idx = fromIdx; idx <= toIdx; idx++) idxs.push(idx);
			else
				for (let idx = toIdx; idx <= fromIdx; idx++) idxs.push(idx);
			// third, remove duplicated indexes
			idxs = idxs.filter((idx, i, self) => self.indexOf(idx) == i);
			browser.tabs.highlight({ tabs: idxs });
			break;
		case "selectAll": 
			var tabs = await browser.tabs.query({ currentWindow: true, active: false });
			var idxs = tabs.filter(tab => !tab.hidden).map(tab => tab.index);
			tabs = await browser.tabs.query({ currentWindow: true, active: true });
			idxs.unshift(tabs[0].index);
			browser.tabs.highlight({ tabs: idxs });
			break;
		case "close"    : browser.tabs.remove(aTabId); break;
		case "undoClose": 
			let sessionInfos = await browser.sessions.getRecentlyClosed({ maxResults: 1 });
			if (sessionInfos.length == 0)
				return;
			browser.sessions.restore(sessionInfos[0].tab.sessionId);
			break;
		case "menu_toggle": 
			gPrefs.menu = !gPrefs.menu;
			browser.storage.local.set(gPrefs);
			rebuildMenu();
			break;
		case "menu_contexts": 
			let list = document.getElementById("ctxList");
			list.hidden = !list.hidden;
			rebuildContexts();
			break;
		case "container": 
			browser.tabs.create({ active: true, cookieStoreId: aTabId });
			document.getElementById("ctxList").hidden = true;
			break;
	}
}

function rebuildMenu() {
	let menu = document.getElementById("menu");
	let img = document.getElementById("menu_toggle").firstChild;
	menu.setAttribute("open", gPrefs.menu);
	if (gPrefs.menu) {
		img.src = "/icons/arrowhead-down-16.svg";
		rebuildContexts();
	}
	else {
		img.src = "/icons/arrowhead-up-16.svg";
	}
	// if in-private-browsing, hide menu_contexts button
	if (gIncognito)
		document.getElementById("menu_contexts").style.display = "none";
}

async function rebuildContexts() {
	let list = document.getElementById("ctxList");
	if (list.hidden)
		return;
	while (list.lastChild)
		list.removeChild(list.lastChild);
	let ctxs = await browser.contextualIdentities.query({});
	for (let ctx of ctxs) {
		let elt = document.getElementById("ctx").cloneNode(true);
		elt.hidden = false;
		elt.id = ctx.cookieStoreId;
		elt.querySelector("img").src = ctx.iconUrl;
		elt.querySelector("img").style.fill = ctx.colorCode;
		elt.querySelector("label").textContent = ctx.name;
		list.appendChild(elt);
	}
}

////////////////////////////////////////////////////////////////////////////////
// list

async function rebuildList() {
	// read prefs
	gPrefs = await browser.storage.local.get();
	const getPref = function(aName, aDefaultValue) {
		return aName in gPrefs ? gPrefs[aName] : aDefaultValue;
	}
	gPrefs.theme         = getPref("theme", "default");
	gPrefs.mode          = getPref("mode", "compact");
	gPrefs.stacking      = getPref("stacking", false);
	gPrefs.effect        = getPref("effect", true);
	gPrefs.autoUpdate    = getPref("autoUpdate", 0);
	gPrefs.activeLine    = getPref("activeLine", "left");
	gPrefs.previewHeight = getPref("previewHeight", 80);
	gPrefs.hideScroll    = getPref("hideScroll", false);
	gPrefs.scrollWidth   = getPref("scrollWidth", 16);
	gPrefs.menu          = getPref("menu", true);
	let theme = gPrefs.theme;
	if (theme == "default")
		theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
	document.documentElement.setAttribute("theme", theme);
	gTabList.style.setProperty("--preview-height", gPrefs.previewHeight + "px");
	gTabList.style.setProperty("--scroll-width", gPrefs.scrollWidth + "px");
	gTabList.setAttribute("mode", gPrefs.mode);
	gTabList.setAttribute("effect", gPrefs.effect);
	gTabList.setAttribute("hidescroll", gPrefs.hideScroll);
	gTabList.parentNode.setAttribute("stacking", gPrefs.stacking);
	gTabList.parentNode.setAttribute("activeline", gPrefs.activeLine);
	// remove all elements
	while (gPinList.lastChild)
		gPinList.removeChild(gPinList.lastChild);
	while (gTabList.lastChild)
		gTabList.removeChild(gTabList.lastChild);
	let tabs = await browser.tabs.query({ currentWindow: true });
	gWindowId = tabs[0].windowId;
	gIncognito = tabs[0].incognito;
	// gHlightTabIds is array of highlighted tabs, note that the first element is of active tab
	gHlightTabIds = tabs.filter(tab => tab.highlighted && !tab.active).map(tab => tab.id);
	gHlightTabIds.unshift(tabs.filter(tab => tab.active)[0].id);
	// first, create list without thumbnails
	tabs.map(tab => (tab.pinned ? gPinList : gTabList).appendChild(elementForTab(tab)));
	// show new tab button after building all tabs
	document.getElementById("newTab").style.visibility = "visible";
	// ensure the selected tab is visible
	let elt = gTabList.parentNode.querySelector("[selected]");
	elt.scrollIntoView({ block: "nearest" });
	// then, update thumbnails async
	if (gPrefs.mode == "compact" || gPrefs.mode == "full")
		tabs.forEach(tab => drawThumbnail(tab.id));
	// finally, rebuild menu
	rebuildMenu();
}

function elementForTab(aTab) {
	let elt = gTabElt.cloneNode(true);
	elt.hidden = false;
	elt.id = "tab:" + aTab.id;
	elt.setAttribute("tabId", aTab.id.toString());
	elt.setAttribute("url", aTab.url);
	elt.querySelector(".favicon").style.backgroundImage = "url('" + getFaviconForTab(aTab) + "')";
	elt.querySelector(".title").textContent = aTab.title;
	elt.querySelector(".title").setAttribute("title", aTab.title);
	elt.setAttribute("draggable", "true");
	if (aTab.active) {
		// remove [selected] from current selected element
		let old = gTabList.parentNode.querySelector("[selected]");
		if (old)
			old.removeAttribute("selected");
		elt.setAttribute("selected", "true");
	}
	if (aTab.pinned)
		elt.setAttribute("pinned", "true");
	if (aTab.discarded)
		elt.setAttribute("discarded", "true");
	if (aTab.muted)
		elt.setAttribute("muted", "true");
	if (aTab.highlighted)
		elt.setAttribute("highlighted", "true");
	if (aTab.cookieStoreId && aTab.cookieStoreId.startsWith("firefox-container-")) {
		// get context for container tab async
		browser.contextualIdentities.get(aTab.cookieStoreId).then(ctx => {
			elt.style.setProperty("--context-color", ctx.colorCode);
			elt.setAttribute("data-context", aTab.cookieStoreId);
		});
	}
	return elt;
}

async function drawThumbnail(aTabId) {
	let elt = getElementByTabId(aTabId);
	if (elt.getAttribute("pinned") == "true")
		return;
	let data = await browser.tabs.captureTab(aTabId);
	elt.querySelector(".thumbnail").style.backgroundImage = `url("${data}")`;
	elt.setAttribute("data-draw-age", 0);
//	console.log("drawThumbnail: " + aTabId);
}

// returns tabId as integer for element, or acendant element
function getTabIdByElement(aElt) {
	aElt = aElt.closest("[tabId]");
	return aElt ? parseInt(aElt.getAttribute("tabId"), 10) : null;
}

function getElementByTabId(aTabId) {
	return gTabList.parentNode.querySelector(`[tabId="${aTabId}"]`);
}

function getFaviconForTab(aTab) {
	if ("favIconUrl" in aTab === false)
		return "/icons/defaultFavicon.svg";
	if (aTab.favIconUrl == "chrome://mozapps/skin/extensions/extensionGeneric-16.svg")
		return "/icons/extensions-16.svg";
	return aTab.favIconUrl;
}

////////////////////////////////////////////////////////////////////////////////
// popup

function showPopup(event) {
	if (!gPopup.hidden)
		hidePopup();
	gPopup.hidden = false;
	var bodyWidth  = document.body.clientWidth;
	var bodyHeight = document.body.clientHeight;
	var x = Math.min(event.clientX, bodyWidth - gPopup.clientWidth - 6);
	var y = Math.min(event.clientY, bodyHeight - gPopup.clientHeight - 6);
	gPopup.style = `top: ${y}px; left: ${x}px;`;
	window.addEventListener("blur", hidePopup, { once: "true" });
}

function hidePopup() {
	window.removeEventListener("blur", hidePopup);
	gPopup.hidden = true;
}

window.addEventListener("load", init, { once: true });
window.addEventListener("pagehide", uninit, { once: true });

