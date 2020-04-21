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
}

function uninit() {
	browser.browserAction.onClicked.removeListener(handleBrowserAction);
	for (let def of gMenuDefs) {
		browser.menus.remove(def.id);
	}
	browser.menus.onShown.removeListener(handleMenuShown);
	browser.menus.onClicked.removeListener(handleMenuClick);
}

async function handleBrowserAction(tab) {
	if ("toggle" in browser.sidebarAction)
		browser.sidebarAction.toggle();
	else
		browser.sidebarAction.open();
}

function handleMenuShown(info, tab) {
//	console.log("onShown: " + JSON.stringify(info) + "\n\n"+ JSON.stringify(tab));
	browser.menus.update("mute",   { visible: !tab.mutedInfo.muted });
	browser.menus.update("unmute", { visible: tab.mutedInfo.muted });
	browser.menus.update("pin",    { visible: !tab.pinned });
	browser.menus.update("unpin",  { visible: tab.pinned });
	browser.menus.refresh();
}

async function handleMenuClick(info, tab) {
//	console.log(JSON.stringify(info) + "\n\n"+ JSON.stringify(tab));
	switch (info.menuItemId) {
		case "reload"       : browser.tabs.reload(tab.id); break;
		case "mute"         : browser.tabs.update(tab.id, { muted: true }); break;
		case "unmute"       : browser.tabs.update(tab.id, { muted: false }); break;
		case "pin"          : browser.tabs.update(tab.id, { pinned: true }); break;
		case "unpin"        : browser.tabs.update(tab.id, { pinned: false }); break;
		case "duplicate"    : browser.tabs.duplicate(tab.id); break;
		case "moveToTop"    : 
			let pins = await browser.tabs.query({ currentWindow: true, pinned: true });
			browser.tabs.move(tab.id, { index: pins.length });
			break;
		case "moveToBottom" : browser.tabs.move(tab.id, { index: -1 }); break;
		case "detach"       : browser.windows.create({ tabId: tab.id, incognito: tab.incognito }); break;
		case "closeToTop"   : 
		case "closeToBottom": 
		case "closeOther"   : 
			let ref = await browser.tabs.get(tab.id);
			let tabs = await browser.tabs.query({ currentWindow: true });
			tabs = tabs.filter(tab => !tab.hidden && !tab.pinned);
			if (info.menuItemId == "closeToBottom")
				tabs = tabs.filter(tab => tab.index > ref.index);
			else if (info.menuItemId == "closeToTop")
				tabs = tabs.filter(tab => tab.index < ref.index);
			else if (info.menuItemId == "closeOther")
				tabs = tabs.filter(tab => tab.id != ref.id);
//			if (tabs.length > 1 && 
//			    !window.confirm(browser.i18n.getMessage("closeConfirm", [tabs.length])))
//				return;
			tabs.map(_tab => browser.tabs.remove(_tab.id));
			break;
		case "undoClose": 
			let sessionInfos = await browser.sessions.getRecentlyClosed({ maxResults: 1 });
			if (sessionInfos.length == 0)
				return;
			browser.sessions.restore(sessionInfos[0].tab.sessionId);
			break;
		case "close": browser.tabs.remove(tab.id); break;
	}
}


// entry point
window.addEventListener("load", init, { once: true });
window.addEventListener("pagehide", uninit, { once: true });

