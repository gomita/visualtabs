////////////////////////////////////////////////////////////////////////////////
// global

var gWindowId;
var gTabList;
var gTabElt;
var gPopup;
var gLastDragOver;

function init() {
	gTabList = document.getElementById("tabList");
	gTabElt  = document.getElementById("tab");
	gPopup   = document.getElementById("popup");
	document.addEventListener("mousedown", onMouseDown);
	document.addEventListener("contextmenu", onContextMenu);
	document.addEventListener("click", onClick);
	document.addEventListener("keypress", onKeyPress);
	document.addEventListener("dragstart", onDragStart);
	document.addEventListener("dragover", onDragOver);
	document.addEventListener("dragleave", onDragLeave);
	document.addEventListener("drop", onDrop);
	browser.tabs.onActivated.addListener(onActivated);
	browser.tabs.onCreated.addListener(onCreated);
	browser.tabs.onRemoved.addListener(onRemoved);
	browser.tabs.onUpdated.addListener(onUpdated);
	browser.tabs.onMoved.addListener(onMoved);
	browser.tabs.onAttached.addListener(onAttached);
	browser.tabs.onDetached.addListener(onDetached);
	browser.tabs.onReplaced.addListener(onReplaced);
	browser.tabs.onZoomChange.addListener(onZoomChange);
	browser.runtime.onMessage.addListener(onMessage);
	rebuildTree();
	setTimeout(() => localizeUI(), 0);
}

function uninit() {
	document.removeEventListener("mousedown", onMouseDown);
	document.removeEventListener("contextmenu", onContextMenu);
	document.removeEventListener("click", onClick);
	document.removeEventListener("keypress", onKeyPress);
	document.removeEventListener("dragstart", onDragStart);
	document.removeEventListener("dragover", onDragOver);
	document.removeEventListener("dragleave", onDragLeave);
	document.removeEventListener("drop", onDrop);
	browser.tabs.onActivated.removeListener(onActivated);
	browser.tabs.onCreated.removeListener(onCreated);
	browser.tabs.onRemoved.removeListener(onRemoved);
	browser.tabs.onUpdated.removeListener(onUpdated);
	browser.tabs.onMoved.removeListener(onMoved);
	browser.tabs.onAttached.removeListener(onAttached);
	browser.tabs.onDetached.removeListener(onDetached);
	browser.tabs.onReplaced.removeListener(onReplaced);
	browser.tabs.onZoomChange.removeListener(onZoomChange);
	browser.runtime.onMessage.removeListener(onMessage);
	gTabList = null;
	gTabElt  = null;
	gPopup   = null;
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
	// prevent autoscroll with middle-button
	if (event.button == 1) {
		event.preventDefault();
		event.stopPropagation();
		return;
	}
}

function onContextMenu(event) {
	// prevent default contextmenu
	event.preventDefault();
	event.stopPropagation();
	// ignore right-click on popup
	if (event.target == gPopup || event.target.parentNode == gPopup)
		return;
	// show popup
	showPopup(event);
}

function onClick(event) {
	if (event.button == 2)
		return;
	let target = event.target;
	// clicks on popup
	if (!gPopup.hidden) {
		if (target == gPopup || target.localName == "hr")
			return;
		let tabId = getTabIdByElement(gPopup);
		hidePopup();
		doCommand(target.getAttribute("command"), tabId);
	}
	// clicks on tab close button
	else if (target.localName == "button") {
		doCommand("close", getTabIdByElement(target));
	}
	// clicks on new tab button
	else if (target.id == "newTab" || 
	        (target.parentNode && target.parentNode.id == "newTab")) {
		doCommand("create");
	}
	// clicks on tab list
	else {
		if (event.button == 0)
			doCommand("select", getTabIdByElement(target));
		else if (event.button == 1)
			doCommand("close", getTabIdByElement(target));
	}
}

function onKeyPress(event) {
	// Esc key to close on popup
	if (!gPopup.hidden && event.keyCode == event.DOM_VK_ESCAPE)
		hidePopup();
}

////////////////////////////////////////////////////////////////////////////////
// drag and drop

function onDragStart(event) {
	let tabId = getTabIdByElement(event.target);
	if (!tabId)
		return;
	let dt = event.dataTransfer;
	let tab = getElementByTabId(tabId);
	dt.setData("text/x-tab-id", tabId);
	dt.setData("text/x-moz-url", tab.getAttribute("url"));
	dt.dropEffect = "move";
}

function onDragOver(event) {
	event.preventDefault();
	let dt = event.dataTransfer;
	// source tabId
	let sourceTabId = dt.getData("text/x-tab-id");
	if (!sourceTabId)
		return;
	let source = getElementByTabId(sourceTabId);
	// target tabId
	let targetTabId = getTabIdByElement(event.target);
	if (!targetTabId)
		return;
	let target = getElementByTabId(targetTabId);
	// cannot drop normal tab into pinned tab
	if (source.getAttribute("pinned") != "true" && target.getAttribute("pinned") == "true")
		return;
	// orient
	let rect = target.getBoundingClientRect();
	let orient = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
	// avoid too much call, by comparing last drag over string
	let lastDragOver = `drop|${orient}|${targetTabId}`;
	if (gLastDragOver == lastDragOver)
		return;
	gLastDragOver = lastDragOver;
	// show drop indicator
	let dropline = document.getElementById("dropline");
	dropline.hidden = false;
	dropline.style.top = (orient == "before" ? rect.top : rect.top + rect.height) + "px";
	// [ToDo] need to -3px when dragover on the last tab
	console.log(gLastDragOver);
}

function onDragLeave(event) {
	document.getElementById("dropline").hidden = true;
	let elt = event.target.parentNode.querySelector("[dragover]");
	if (elt) elt.removeAttribute("dragover");
	gLastDragOver = "";
}

async function onDrop(event) {
	document.getElementById("dropline").hidden = true;
	event.preventDefault();
	// do nothing when dropping on new tab button
	if (event.target.id == "newTab" || 
	   (event.target.parentNode && event.target.parentNode.id == "newTab"))
		return;
	let dt = event.dataTransfer;
	let sourceTabId = dt.getData("text/x-tab-id");
	if (!sourceTabId)
		return;
	let [, orient, targetTabId] = gLastDragOver.split("|");
	sourceTabId = parseInt(sourceTabId, 10);
	targetTabId = parseInt(targetTabId, 10);
	let sourceTab = await browser.tabs.get(sourceTabId);
	let targetTab = await browser.tabs.get(targetTabId);
	let targetIndex = targetTab.index;
	if (orient == "after")
		targetIndex++;
	if (sourceTab.index < targetIndex)
		targetIndex--;
	browser.tabs.move(sourceTabId, { index: targetIndex });
}

////////////////////////////////////////////////////////////////////////////////
// tab event listeners

function onActivated(activeInfo) {
	let elt = getElementByTabId(activeInfo.tabId);
	if (!elt)
		return;
	console.log("onActivated: " + activeInfo.toSource());
	let old = gTabList.querySelector("[selected]");
	if (old)
		old.removeAttribute("selected");
	elt.setAttribute("selected", "true");
	// XXX when the last tab is activated, scroll into new tab button
	if (elt.nextSibling.id == "newTab")
		elt = elt.nextSibling;
	elt.scrollIntoView({ block: "nearest" });
}

function onCreated(tab) {
	if (tab.windowId != gWindowId)
		return;
	console.log("onCreated: " + tab.toSource());
	gTabList.insertBefore(elementForTab(tab), [...gTabList.childNodes][tab.index]);
}

function onRemoved(tabId, removeInfo) {
	let elt = getElementByTabId(tabId);
	if (!elt)
		return;
	console.log("onRemoved: " + tabId + " " + removeInfo.toSource());
	gTabList.removeChild(elt);
}

function onUpdated(tabId, changeInfo, tab) {
	if (tab.windowId != gWindowId)
		return;
	console.log("onUpdated: " + tabId + " " + changeInfo.toSource());
	let elt = getElementByTabId(tabId);
	// refresh a tab after loading complete
	if (changeInfo.status == "complete") {
		elt.querySelector(".title").textContent = tab.title;
		elt.querySelector(".favicon").src = tab.favIconUrl || "/icons/defaultFavicon.svg";
		refreshThumbnail(tabId);
	}
	// change pinned status
	else if (changeInfo.pinned !== undefined) {
		if (changeInfo.pinned)
			elt.setAttribute("pinned", "true");
		else
			elt.removeAttribute("pinned");
	}
}

function onMoved(tabId, moveInfo) {
	let elt = getElementByTabId(tabId);
	if (!elt)
		return;
	console.log("onMoved: " + tabId + " " + moveInfo.toSource());
	let refIndex = moveInfo.toIndex;
	if (moveInfo.fromIndex < moveInfo.toIndex)
		refIndex++;
	gTabList.insertBefore(elt, [...gTabList.childNodes][refIndex]);
}

async function onAttached(tabId, attachInfo) {
	if (attachInfo.newWindowId != gWindowId)
		return;
	console.log("onAttached: " + tabId + " " + attachInfo.toSource());
	let tabs = await browser.tabs.query({ currentWindow: true });
	let tab = tabs[attachInfo.newPosition];
	gTabList.insertBefore(elementForTab(tab), [...gTabList.childNodes][tab.index]);
	refreshThumbnail(tab.id);
}

function onDetached(tabId, detachInfo) {
	if (detachInfo.oldWindowId != gWindowId)
		return;
	console.log("onDetached: " + tabId + " " + detachInfo.toSource());
	let elt = [...gTabList.childNodes][detachInfo.oldPosition];
	gTabList.removeChild(elt);
}

function onReplaced(addedTabId, removedTabId) {
	console.log("onReplaced: " + addedTabId + " " + removedTabId);
}

function onZoomChange(ZoomChangeInfo) {
	let elt = getElementByTabId(ZoomChangeInfo.tabId);
	if (!elt)
		return;
	console.log("onZoomChange: " + ZoomChangeInfo.toSource());
	refreshThumbnail(ZoomChangeInfo.tabId);
}

async function onMessage(request, sender, sendResponse) {
	if (request.value == "VisualTabs:reload")
		rebuildTree();
}

////////////////////////////////////////////////////////////////////////////////
// command

async function doCommand(aCommand, aTabId) {
	switch (aCommand) {
		case "create"   : browser.tabs.create({ active: true }); break;
		case "select"   : browser.tabs.update(aTabId, { active: true }); break;
		case "reload"   : browser.tabs.reload(aTabId); break;
		case "pin"      : browser.tabs.update(aTabId, { pinned: true }); break;
		case "unpin"    : browser.tabs.update(aTabId, { pinned: false }); break;
		case "duplicate": browser.tabs.duplicate(aTabId); break;
		case "close"    : browser.tabs.remove(aTabId); break;
		case "undoclose": 
			let sessionInfos = await browser.sessions.getRecentlyClosed({ maxResults: 1 });
			if (sessionInfos.length == 0)
				return;
			browser.sessions.restore(sessionInfos[0].tab.sessionId);
			break;
		case "detach": 
			// [FIXME] not implemented
			break;
	}
}

////////////////////////////////////////////////////////////////////////////////
// tree

async function rebuildTree() {
	// read pref
	let prefs = await browser.storage.local.get();
	prefs.pinned = prefs.pinned || false;
	prefs.height = prefs.height || 80;
	// set user style
	let elt = document.getElementById("userstyle");
	if (elt)
		elt.parentNode.removeChild(elt);
	elt = document.createElement("style");
	elt.id = "userstyle";
	document.head.appendChild(elt);
	elt.sheet.insertRule(".tab .thumbnail { height: " + prefs.height + "px; }");
	gTabList.setAttribute("pinned", prefs.pinned);
	// remove all elements
	while (gTabList.lastChild)
		gTabList.removeChild(gTabList.lastChild);
	let tabs = await browser.tabs.query({ currentWindow: true });
	gWindowId = tabs[0].windowId;
	// first, create list without thumbnails
	tabs.map(tab => gTabList.appendChild(elementForTab(tab)));
	// add new tab button
	let newTab = document.querySelector(".new-tab").cloneNode(true);
	newTab.id = "newTab";
	newTab.hidden = false;
	gTabList.appendChild(newTab);
	// ensure the selected tab is visible
	let elt = gTabList.querySelector("[selected]");
	// XXX when the last tab is activated, scroll into new tab button
	if (elt.nextSibling.id == "newTab")
		elt = elt.nextSibling;
	elt.scrollIntoView({ block: "nearest" });
	// then, update thumbnails async
	tabs.map(tab => refreshThumbnail(tab.id));
}

function elementForTab(aTab) {
	let elt = gTabElt.cloneNode(true);
	elt.hidden = false;
	elt.id = "tab:" + aTab.id;
	elt.setAttribute("tabId", aTab.id.toString());
	elt.setAttribute("url", aTab.url);
	elt.querySelector(".favicon").src = aTab.favIconUrl || "/icons/defaultFavicon.svg";
	elt.querySelector(".title").textContent = aTab.title;
	elt.setAttribute("draggable", "true");
	if (aTab.active) {
		// remove [selected] from current selected element
		let old = gTabList.querySelector("[selected]");
		if (old)
			old.removeAttribute("selected");
		elt.setAttribute("selected", "true");
	}
	if (aTab.pinned)
		elt.setAttribute("pinned", "true");
	return elt;
}

async function refreshThumbnail(aTabId) {
	let data = await browser.tabs.captureTab(aTabId);
	let elt = getElementByTabId(aTabId).querySelector(".thumbnail");
	elt.style.backgroundImage = `url("${data}")`;
}

// f**kin' function to return tabId as integer for element, or parent of parent, or...
function getTabIdByElement(aElt) {
	let tabId = aElt.getAttribute("tabId");
	if (tabId)
		return parseInt(tabId, 10);
	for (let i = 0; i < 3; i++) {
		aElt = aElt.parentNode;
		if (!aElt || aElt == document.documentElement)
			return null;
		tabId = aElt.getAttribute("tabId");
		if (tabId)
			return parseInt(tabId, 10);
	}
	return null;
}

function getElementByTabId(aTabId) {
	return gTabList.querySelector(`[tabId="${aTabId}"]`);
}

////////////////////////////////////////////////////////////////////////////////
// popup

function showPopup(event) {
	if (!gPopup.hidden)
		hidePopup();
	let tabId = getTabIdByElement(event.target);
	if (!tabId)
		return;
	let pinned = getElementByTabId(tabId).getAttribute("pinned") == "true";
	gPopup.hidden = false;
	gPopup.querySelector('[command="pin"]').hidden = pinned;
	gPopup.querySelector('[command="unpin"]').hidden = !pinned;
	gPopup.setAttribute("tabId", tabId);
	var bodyWidth  = document.body.clientWidth;
	var bodyHeight = document.body.clientHeight;
	var x = Math.min(event.clientX, bodyWidth - gPopup.clientWidth - 6);
	var y = Math.min(event.clientY, bodyHeight - gPopup.clientHeight - 6);
	gPopup.style = `top: ${y}px; left: ${x}px;`;
	window.addEventListener("blur", hidePopup, { once: "true" });
}

function hidePopup() {
	window.removeEventListener("blur", hidePopup);
	gPopup.removeAttribute("tabId");
	gPopup.hidden = true;
}

window.addEventListener("load", init, { once: true });
window.addEventListener("pagehide", uninit, { once: true });

