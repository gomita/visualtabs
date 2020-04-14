var gPrefs = {};

async function init() {
	localizeUI();
	document.body.onchange = onChange;
	gPrefs = await browser.storage.local.get();
	// for compatibility with ver 0.9 or former
	if (gPrefs.mode == "normal")
		gPrefs.mode = "full";
	const getPref = function(aName, aDefaultValue) {
		return aName in gPrefs ? gPrefs[aName] : aDefaultValue;
	}
	let theme         = getPref("theme", "default");
	let mode          = getPref("mode", "compact");
	let stacking      = getPref("stacking", false);
	let effect        = getPref("effect", true);
	let autoUpdate    = getPref("autoUpdate", 0);
	let activeLine    = getPref("activeLine", "left");
	let previewHeight = getPref("previewHeight", 80);
	let hideScroll    = getPref("hideScroll", false);
	let scrollWidth   = getPref("scrollWidth", 16);
	document.getElementById(`theme:${theme}`).checked = true;
	document.getElementById(`mode:${mode}`).checked = true;
	document.getElementById(`stacking`).checked = stacking;
	document.getElementById(`effect`).checked = effect;
	document.getElementById(`autoUpdate`).checked = autoUpdate > 0;
	document.getElementById(`activeLine:${activeLine}`).checked = true;
	document.getElementById(`previewHeight`).value = previewHeight;
	document.getElementById(`hideScroll`).checked = hideScroll;
	document.getElementById(`scrollWidth`).value = scrollWidth;
	updateUI();
}

function uninit() {
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

function updateUI() {
	// if hide scroll is enabled, make scroll width option grayed-out
	[...document.querySelectorAll('#scrollWidth, [for="scrollWidth"]')].map(elt => {
		if (gPrefs.hideScroll)
			elt.removeAttribute("disabled");
		else
			elt.setAttribute("disabled", "true");
	});
}

function onChange(event) {
	switch (event.target.id) {
		case "theme:default"   : gPrefs.theme = "default"; break;
		case "theme:light"     : gPrefs.theme = "light"; break;
		case "theme:dark"      : gPrefs.theme = "dark"; break;
		case "mode:minimal"    : gPrefs.mode = "minimal"; break;
		case "mode:compact"    : gPrefs.mode = "compact"; break;
		case "mode:full"       : gPrefs.mode = "full"; break;
		case "stacking"        : gPrefs.stacking = event.target.checked; break;
		case "effect"          : gPrefs.effect = event.target.checked; break;
		case "autoUpdate"      : gPrefs.autoUpdate = event.target.checked ? 1000 : 0; break;
		case "activeLine:left" : gPrefs.activeLine = "left"; break;
		case "activeLine:right": gPrefs.activeLine = "right"; break;
		case "previewHeight"   : gPrefs.previewHeight = parseInt(event.target.value, 10); break;
		case "hideScroll"      : gPrefs.hideScroll = event.target.checked; updateUI(); break;
		case "scrollWidth"     : gPrefs.scrollWidth = parseInt(event.target.value, 10); break;
	}
	browser.storage.local.set(gPrefs);
	browser.runtime.sendMessage({ value: "visualtabs:rebuild" });
}

window.addEventListener("load", init, { once: true });
window.addEventListener("pagehide", uninit, { once: true });

