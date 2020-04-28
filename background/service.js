////////////////////////////////////////////////////////////////////////////////
// background service

var gMenuDefs = [
	{ id: "reload" },
	{ id: "mute" },
	{ id: "unmute" },
	{ id: "pin" },
	{ id: "unpin" },
	{ id: "duplicate" },
	{ id: "sep1", type: "separator" },
	{ id: "reopen" },
	{ id: "reopen:default", parentId: "reopen" },
	{ id: "reopen:sep", type: "separator", parentId: "reopen" },
	{ id: "move" },
	{ id: "moveToTop", parentId: "move" },
	{ id: "moveToBottom", parentId: "move" },
	{ id: "detach", parentId: "move" },
	{ id: "sep2", type: "separator" },
	{ id: "closeToTop" },
	{ id: "closeToBottom" },
	{ id: "closeOther" },
	{ id: "undoClose" },
	{ id: "close" }
];
var gCookieStoreIds = [];

async function init() {
	browser.browserAction.onClicked.addListener(handleBrowserAction);
	for (let def of gMenuDefs) {
		browser.menus.create({
			id: def.id,
			title: browser.i18n.getMessage(def.id),
			type: def.type || "normal",
			parentId: def.parentId,
			contexts: ["tab"],
			viewTypes: ["sidebar"],
			documentUrlPatterns: [`moz-extension://${location.host}/*`]
		});
	}
	browser.menus.onShown.addListener(handleMenuShown);
	browser.menus.onClicked.addListener(handleMenuClick);
	rebuildReopenMenu();
	browser.contextualIdentities.onCreated.addListener(rebuildReopenMenu);
	browser.contextualIdentities.onRemoved.addListener(rebuildReopenMenu);
	browser.contextualIdentities.onUpdated.addListener(rebuildReopenMenu);
}

function uninit() {
	browser.browserAction.onClicked.removeListener(handleBrowserAction);
	for (let def of gMenuDefs) {
		browser.menus.remove(def.id);
	}
	browser.menus.onShown.removeListener(handleMenuShown);
	browser.menus.onClicked.removeListener(handleMenuClick);
	for (let id of gCookieStoreIds) {
		browser.menus.remove("reopen:" + id);
	}
	browser.contextualIdentities.onCreated.removeListener(rebuildReopenMenu);
	browser.contextualIdentities.onRemoved.removeListener(rebuildReopenMenu);
	browser.contextualIdentities.onUpdated.removeListener(rebuildReopenMenu);
}

async function handleBrowserAction(tab) {
	if ("toggle" in browser.sidebarAction)
		browser.sidebarAction.toggle();
	else
		browser.sidebarAction.open();
}

async function handleMenuShown(info, tab) {
//	console.log("onShown: " + JSON.stringify(info) + "\n\n"+ JSON.stringify(tab));
	browser.menus.update("mute",   { visible: !tab.mutedInfo.muted });
	browser.menus.update("unmute", { visible: tab.mutedInfo.muted });
	browser.menus.update("pin",    { visible: !tab.pinned });
	browser.menus.update("unpin",  { visible: tab.pinned });
	browser.menus.update("reopen:default", { visible: tab.cookieStoreId != "firefox-default" });
	browser.menus.update("reopen:sep",     { visible: tab.cookieStoreId != "firefox-default" });
	// disable reopen menu items for privileged URL
	let enabled = tab.url.startsWith("http") || tab.url == "about:blank" || tab.url == "about:newtab";
	browser.menus.update("reopen", { enabled });
	// hide reopen menu items in private-browsing
	browser.menus.update("reopen", { visible: !tab.incognito });
	for (let id of gCookieStoreIds) {
		browser.menus.update("reopen:" + id, { visible: id != tab.cookieStoreId });
	}
	// enable/disable move and close menu items
	let tabs = await browser.tabs.query({ currentWindow: true });
	let pins = tabs.filter(_tab => _tab.pinned);
	let top    = tab.index == 0 || tab.index == pins.length;
	let bottom = tab.index == pins.length -1 || tab.index == tabs.length - 1;
	browser.menus.update("moveToTop",     { enabled: !top });
	browser.menus.update("moveToBottom",  { enabled: !bottom });
	browser.menus.update("closeToTop",    { enabled: tab.index > pins.length });
	browser.menus.update("closeToBottom", { enabled: tab.index < tabs.length - 1 });
	browser.menus.update("closeOther",    { enabled: tabs.length > 1 });
	// finally refresh menu
	browser.menus.refresh();
}

async function handleMenuClick(info, tab) {
//	console.log(JSON.stringify(info) + "\n\n"+ JSON.stringify(tab));
	// decide the context tabs which the command will be applied to.
	// note that if the clicked tab is not highlighted, the context tab is it only.
	let tabs = !tab.highlighted ? [tab] : 
	           await browser.tabs.query({ currentWindow: true, highlighted: true });
	switch (info.menuItemId) {
		case "reload"       : tabs.map(_tab => browser.tabs.reload(_tab.id)); break;
		case "mute"         : tabs.map(_tab => browser.tabs.update(_tab.id, { muted: true })); break;
		case "unmute"       : tabs.map(_tab => browser.tabs.update(_tab.id, { muted: false })); break;
		case "pin"          : tabs.map(_tab => browser.tabs.update(_tab.id, { pinned: true })); break;
		case "unpin"        : tabs.reverse().map(_tab => browser.tabs.update(_tab.id, { pinned: false })); break;
		case "duplicate"    : 
			let dupTabIds = [];
			for (let _tab of tabs) {
				let dupTab = await browser.tabs.duplicate(_tab.id);
				dupTabIds.push(dupTab.id);
			}
			// move duplicated tabs to the next of last context tab
			let prefs = await browser.storage.local.get();
			if (!prefs.stacking)
				browser.tabs.move(dupTabIds, { index: tabs[tabs.length - 1].index + 1 });
			break;
		case "moveToTop"    : 
			tabs = tabs.reverse();
			for (let _tab of tabs) {
				if (_tab.pinned) {
					browser.tabs.move(_tab.id, { index: 0 });
				}
				else {
					let pins = await browser.tabs.query({ currentWindow: true, pinned: true });
					browser.tabs.move(_tab.id, { index: pins.length });
				}
			}
			break;
		case "moveToBottom" : 
			for (let _tab of tabs) {
				if (_tab.pinned) {
					let pins = await browser.tabs.query({ currentWindow: true, pinned: true });
					browser.tabs.move(_tab.id, { index: pins.length - 1 });
				}
				else {
					browser.tabs.move(_tab.id, { index: -1 });
				}
			}
			break;
		case "detach"       : 
			let _tab = tabs.shift();
			let win = await browser.windows.create({ tabId: _tab.id, incognito: _tab.incognito });
			let tabIds = tabs.map(_tab => _tab.id);
			browser.tabs.move(tabIds, { windowId: win.id, index: -1 });
			break;
		case "closeToTop"   : 
		case "closeToBottom": 
		case "closeOther"   : 
			let remTabs = await browser.tabs.query({ currentWindow: true });
			remTabs = remTabs.filter(_tab => !_tab.hidden && !_tab.pinned);
			if (info.menuItemId == "closeToBottom") {
				if (!tab.highlighted)
					// 0 [1] 2 [3] 4 [5] 6 --> context on 2 --> removing 3,4,5,6
					remTabs = remTabs.filter(_tab => _tab.index > tab.index);
				else
					// 0 [1] 2 [3] 4 [5] 6 --> context on 3 --> removing 4,6
					remTabs = remTabs.filter(_tab => _tab.index > tab.index && !_tab.highlighted);
			}
			else if (info.menuItemId == "closeToTop") {
				if (!tab.highlighted)
					// 0 [1] 2 [3] 4 [5] 6 --> context on 4 --> removing 0,1,2,3
					remTabs = remTabs.filter(_tab => _tab.index < tab.index);
				else
					// 0 [1] 2 [3] 4 [5] 6 --> context on 5 --> removing 0,2,4
					remTabs = remTabs.filter(_tab => _tab.index < tab.index && !_tab.highlighted);
			}
			else if (info.menuItemId == "closeOther") {
				if (!tab.highlighted)
					// 0 [1] 2 [3] 4 [5] 6 --> context on 2 --> removing 0,1,3,4,5,6
					remTabs = remTabs.filter(_tab => _tab.index != tab.index);
				else
					// 0 [1] 2 [3] 4 [5] 6 --> context on 3 --> removing 0,2,4,6
					remTabs = remTabs.filter(_tab => _tab.index != tab.index && !_tab.highlighted);
			}
//			if (remTabs.length > 1 && 
//			    !window.confirm(browser.i18n.getMessage("closeConfirm", [remTabs.length])))
//				return;
			remTabs.map(_tab => browser.tabs.remove(_tab.id));
			break;
		case "undoClose": 
			let sessionInfos = await browser.sessions.getRecentlyClosed({ maxResults: 1 });
			if (sessionInfos.length == 0)
				return;
			browser.sessions.restore(sessionInfos[0].tab.sessionId);
			break;
		case "close": tabs.map(_tab => browser.tabs.remove(_tab.id)); break;
		default: 
			if (!/^reopen:(.+)$/.test(info.menuItemId))
				break;
			tabs.reverse().map(_tab => browser.tabs.create({
				url: _tab.url, index: ++_tab.index, pinned: _tab.pinned, active: true, 
				cookieStoreId: RegExp.$1 == "default" ? undefined : RegExp.$1
			}));
			break;
	}
}

async function rebuildReopenMenu() {
	// remove reopen menu items
	for (let id of gCookieStoreIds) {
		browser.menus.remove("reopen:" + id);
	}
	gCookieStoreIds = [];
	// create reopen menu items
	let details = await browser.contextualIdentities.query({});
	for (let detail of details) {
		gCookieStoreIds.push(detail.cookieStoreId);
		browser.menus.create({
			id: "reopen:" + detail.cookieStoreId,
			title: detail.name,
			type: "normal",
			icons: { "16": detail.iconUrl },
			parentId: "reopen",
			contexts: ["tab"],
			viewTypes: ["sidebar"],
			documentUrlPatterns: [`moz-extension://${location.host}/*`]
		});
	}
}

// entry point
window.addEventListener("load", init, { once: true });
window.addEventListener("pagehide", uninit, { once: true });

