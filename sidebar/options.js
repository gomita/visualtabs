var gPrefs = {};

async function init() {
	localizeUI();
	document.body.onchange = onChange;
	gPrefs = await browser.storage.local.get();
	let mode          = gPrefs.mode          || "normal";
	let activeLine    = gPrefs.activeLine    || "left";
	let previewHeight = gPrefs.previewHeight || 80;
	let hideScroll    = gPrefs.hideScroll    || false;
	let scrollWidth   = gPrefs.scrollWidth   || 16;
	document.getElementById(`mode:${mode}`).checked = true;
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
	[...document.querySelectorAll('#scrollWidth, [for="scrollWidth"]')]
	.map(elt => {
		if (gPrefs.hideScroll)
			elt.removeAttribute("disabled");
		else
			elt.setAttribute("disabled", "true");
	});
}

function onChange(event) {
	switch (event.target.id) {
		case "mode:normal"     : gPrefs.mode = "normal"; break;
		case "mode:compact"    : gPrefs.mode = "compact"; break;
		case "activeLine:left" : gPrefs.activeLine = "left"; break;
		case "activeLine:right": gPrefs.activeLine = "right"; break;
		case "previewHeight"   : gPrefs.previewHeight = event.target.value; break;
		case "hideScroll"      : gPrefs.hideScroll = event.target.checked; updateUI(); break;
		case "scrollWidth"     : gPrefs.scrollWidth = event.target.value; break;
	}
	browser.storage.local.set(gPrefs);
	browser.runtime.sendMessage({ value: "visualtabs:rebuild" });
}

window.addEventListener("load", init, { once: true });
window.addEventListener("pagehide", uninit, { once: true });

