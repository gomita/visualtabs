var gPrefs = {};

async function init() {
	localizeUI();
	document.body.onchange = onChange;
	gPrefs = await browser.storage.local.get();
	const getPref = function(aName, aDefaultValue) {
		return aName in gPrefs ? gPrefs[aName] : aDefaultValue;
	}
	gPrefs.theme         = getPref("theme", "default");
	gPrefs.mode          = getPref("mode", "compact");
	gPrefs.stacking      = getPref("stacking", false);
	gPrefs.backMonitor   = getPref("backMonitor", false);
	gPrefs.effect        = getPref("effect", true);
	gPrefs.autoUpdate    = getPref("autoUpdate", 0);
	gPrefs.activeLine    = getPref("activeLine", "left");
	gPrefs.previewHeight = getPref("previewHeight", 80);
	gPrefs.hideScroll    = getPref("hideScroll", false);
	gPrefs.scrollWidth   = getPref("scrollWidth", 16);
	gPrefs.edge          = getPref("edge", false);
	gPrefs.edgeWidth     = getPref("edgeWidth", 50);
	document.getElementById(`theme:${gPrefs.theme}`).checked = true;
	document.getElementById(`mode:${gPrefs.mode}`).checked = true;
	document.getElementById(`stacking`).checked = gPrefs.stacking;
	document.getElementById(`backMonitor`).checked = gPrefs.backMonitor;
	document.getElementById(`effect`).checked = gPrefs.effect;
	document.getElementById(`autoUpdate`).checked = gPrefs.autoUpdate > 0;
	document.getElementById(`activeLine:${gPrefs.activeLine}`).checked = true;
	document.getElementById(`previewHeight`).value = gPrefs.previewHeight;
	document.getElementById(`hideScroll`).checked = gPrefs.hideScroll;
	document.getElementById(`scrollWidth`).value = gPrefs.scrollWidth;
	document.getElementById(`edge`).checked = gPrefs.edge;
	document.getElementById(`edgeWidth:` + (gPrefs.edgeWidth >= 0 ? "left" : "right")).checked = true;
	document.getElementById(`edgeWidth`).value = Math.abs(gPrefs.edgeWidth);
	updateUI();
}

function uninit() {
}

function localizeUI() {
	document.querySelectorAll("[i18n]").forEach(elt => {
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

function updateUI() {
	_syncToPref("scrollWidthBox", gPrefs.hideScroll);
	_syncToPref("edgeBox",        gPrefs.mode == "minimal" || gPrefs.mode == "compact");
	_syncToPref("edgeWidthBox",   (gPrefs.mode == "minimal" || gPrefs.mode == "compact") && gPrefs.edge);
	_syncToPref("backMonitorBox", gPrefs.mode != "full");
	_syncToPref("effectBox",      gPrefs.mode != "full");
}

function _syncToPref(aId, aEnable) {
	[...document.getElementById(aId).children].forEach(elt => {
		if (aEnable)
			elt.removeAttribute("disabled");
		else
			elt.setAttribute("disabled", "true");
	});
}

function onChange(event) {
	let edgeUpdated;
	switch (event.target.id) {
		case "theme:default"   : gPrefs.theme = "default"; break;
		case "theme:light"     : gPrefs.theme = "light"; break;
		case "theme:dark"      : gPrefs.theme = "dark"; break;
		case "mode:none"       : gPrefs.mode = "none";    updateUI(); edgeUpdated = true; break;
		case "mode:minimal"    : gPrefs.mode = "minimal"; updateUI(); edgeUpdated = true; break;
		case "mode:compact"    : gPrefs.mode = "compact"; updateUI(); edgeUpdated = true; break;
		case "mode:full"       : gPrefs.mode = "full";    updateUI(); edgeUpdated = true; break;
		case "stacking"        : gPrefs.stacking = event.target.checked; break;
		case "backMonitor"     : gPrefs.backMonitor = event.target.checked; break;
		case "effect"          : gPrefs.effect = event.target.checked; break;
		case "autoUpdate"      : gPrefs.autoUpdate = event.target.checked ? 1000 : 0; break;
		case "activeLine:left" : gPrefs.activeLine = "left"; break;
		case "activeLine:right": gPrefs.activeLine = "right"; break;
		case "previewHeight"   : gPrefs.previewHeight = parseInt(event.target.value, 10); break;
		case "hideScroll"      : gPrefs.hideScroll = event.target.checked; updateUI(); break;
		case "scrollWidth"     : gPrefs.scrollWidth = parseInt(event.target.value, 10); break;
		case "edge"            : gPrefs.edge = event.target.checked; updateUI(); edgeUpdated = true; break;
		case "edgeWidth:left"  : 
		case "edgeWidth:right" : 
		case "edgeWidth"       : 
			gPrefs.edgeWidth = parseInt(document.getElementById("edgeWidth").value, 10);
			if (document.getElementById("edgeWidth:right").checked)
				gPrefs.edgeWidth *= -1;
			edgeUpdated = true;
			break;
	}
	browser.storage.local.set(gPrefs);
	browser.runtime.sendMessage({ value: "visualtabs:rebuild", edgeUpdated });
}

window.addEventListener("load", init, { once: true });
window.addEventListener("pagehide", uninit, { once: true });

