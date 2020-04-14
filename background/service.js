////////////////////////////////////////////////////////////////////////////////
// background service

var VisualTabs = {

	_init: async function() {
		browser.browserAction.onClicked.addListener(this._handleBrowserAction);
	},

	_destroy: function() {
		browser.browserAction.onClicked.removeListener(this._handleBrowserAction);
	},

	_handleBrowserAction: async function(tab) {
		if ("toggle" in browser.sidebarAction)
			browser.sidebarAction.toggle();
		else
			browser.sidebarAction.open();
	},

};

VisualTabs._init();

