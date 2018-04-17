async function init() {
	localizeUI();
	document.getElementById("pinned").onchange = onChange;
	document.getElementById("height").onchange = onChange;
	let prefs = await browser.storage.local.get();
	document.getElementById("pinned").checked = prefs.pinned || false;
	document.getElementById("height").value = prefs.height || 80;
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

function onChange(event) {
	let pinned = document.getElementById("pinned").checked;
	let height = document.getElementById("height").value;
	browser.storage.local.set({ pinned, height });
	browser.runtime.sendMessage({ value: "visualtabs:rebuild" });
}

window.addEventListener("load", init, { once: true });
window.addEventListener("pagehide", uninit, { once: true });

