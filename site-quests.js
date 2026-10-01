(() => {
	const storageKey = "wienQuestsCompleted";
	const questIds = ["side-01", "side-02", "side-04", "side-05"];
	let completedQuests = readCompletedQuests();

	function readCompletedQuests() {
		try {
			const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
			return Array.isArray(saved) ? saved : [];
		} catch {
			return [];
		}
	}

	function showConfetti() {
		const layer = document.createElement("div");
		layer.className = "confetti-layer";
		layer.setAttribute("aria-hidden", "true");
		const colors = ["#ff766d", "#ffd166", "#f2f0e9", "#92d6c2", "#e9a1a9"];

		for (let index = 0; index < 64; index += 1) {
			const piece = document.createElement("span");
			piece.className = "confetti-piece";
			piece.style.left = `${Math.random() * 100}%`;
			piece.style.backgroundColor = colors[index % colors.length];
			piece.style.setProperty("--confetti-drift", `${Math.random() * 240 - 120}px`);
			piece.style.animationDelay = `${Math.random() * 350}ms`;
			layer.append(piece);
		}

		document.body.append(layer);
		window.setTimeout(() => layer.remove(), 3600);
	}

	function completeQuest(questId) {
		if (completedQuests.includes(questId)) return false;

		completedQuests = [...completedQuests, questId];
		try {
			localStorage.setItem(storageKey, JSON.stringify(completedQuests));
		} catch {
			// Keep the completion state for this page session if browser storage is unavailable.
		}

		const card = document.querySelector(`[data-side-quest="${questId}"]`);
		card.classList.add("is-complete");
		for (const control of card.querySelectorAll("input, button")) control.disabled = true;
		card.querySelector(".side-quest-status").textContent = "Quest erledigt.";
		showConfetti();
		return true;
	}

	function syncCompletedQuests() {
		for (const questId of questIds) {
			if (!completedQuests.includes(questId)) continue;

			const card = document.querySelector(`[data-side-quest="${questId}"]`);
			card.classList.add("is-complete");
			for (const control of card.querySelectorAll("input, button")) control.disabled = true;
			card.querySelector(".side-quest-status").textContent = "Quest bereits erledigt.";
		}
	}

	function setupNumberQuest() {
		const form = document.querySelector("[data-number-quest]");
		form.addEventListener("submit", (event) => {
			event.preventDefault();
			completeQuest(form.dataset.questId);
		});
	}

	function setupDoneQuest() {
		for (const button of document.querySelectorAll("[data-done-quest]")) {
			button.addEventListener("click", () => completeQuest(button.dataset.doneQuest));
		}
	}

	function setupLinkQuest() {
		const form = document.querySelector("[data-link-quest]");
		form.addEventListener("submit", async (event) => {
			event.preventDefault();
			if (completedQuests.includes(form.dataset.questId)) return;

			const input = form.querySelector('input[type="url"]');
			const status = form.closest(".side-quest").querySelector(".side-quest-status");
			let link;
			try {
				link = new URL(input.value.trim());
				if (!["http:", "https:"].includes(link.protocol) || link.username || link.password) {
					throw new Error("Ungültiger Link");
				}
			} catch {
				input.setCustomValidity("Bitte gib einen gültigen HTTP- oder HTTPS-Link ein.");
				input.reportValidity();
				return;
			}
			input.setCustomValidity("");

			if (!completeQuest(form.dataset.questId)) return;
			const webhookUrl = window.wienQuestWebhookUrl;
			if (!isDiscordWebhook(webhookUrl)) {
				status.textContent = "Quest erledigt, aber der Discord-Webhook ist nicht verfügbar.";
				return;
			}

			status.textContent = "Quest erledigt. Link wird an Discord gesendet ...";
			try {
				const response = await fetch(`${webhookUrl}?wait=true`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						content: `Side-Quest-Link: ${link.href}`,
						allowed_mentions: { parse: [] }
					})
				});
				if (!response.ok) throw new Error("Link konnte nicht gesendet werden");
				status.textContent = "Link an Discord gesendet.";
			} catch {
				status.textContent = "Quest erledigt, aber der Link konnte nicht an Discord gesendet werden.";
			}
		});
	}

	function isDiscordWebhook(value) {
		try {
			const url = new URL(value);
			return url.protocol === "https:" &&
				["discord.com", "discordapp.com"].includes(url.hostname) &&
				/^\/api\/webhooks\/[^/]+\/[^/]+\/?$/.test(url.pathname);
		} catch {
			return false;
		}
	}

	async function sendPhoto(webhookUrl, file) {
		const payload = new FormData();
		payload.append("content", "Side-Quest erledigt: Abendmoment");
		payload.append("files[0]", file, file.name);
		const response = await fetch(`${webhookUrl}?wait=true`, {
			method: "POST",
			body: payload
		});
		if (!response.ok) throw new Error("Fotoübertragung fehlgeschlagen");
	}

	async function reportPhotoFailure(status, reason) {
		const webhookUrl = window.wienQuestWebhookUrl;
		if (!isDiscordWebhook(webhookUrl)) {
			status.textContent = "Quest erledigt, aber die Fotoübertragung ist fehlgeschlagen. Der Webhook ist nicht verfügbar.";
			return;
		}

		try {
			const response = await fetch(`${webhookUrl}?wait=true`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					content: `Die Fotoübertragung für die Side-Quest „Abendmoment“ ist fehlgeschlagen (${reason}). Die Quest wurde trotzdem als erledigt gespeichert.`
				})
			});
			if (!response.ok) throw new Error("Discord-Benachrichtigung fehlgeschlagen");
			status.textContent = "Quest erledigt. Fotoübertragung fehlgeschlagen; Discord wurde informiert.";
		} catch {
			status.textContent = "Quest erledigt. Fotoübertragung und Discord-Benachrichtigung sind fehlgeschlagen.";
		}
	}

	function setupTimePhotoQuest() {
		const form = document.querySelector("[data-time-photo-quest]");
		const input = form.querySelector('input[type="file"]');

	function updateTimeQuest() {
		const button = document.querySelector("[data-time-quest]");
		const status = document.querySelector("[data-time-status]");
		if (completedQuests.includes(button.dataset.timeQuest)) return;

		const now = new Date();
		const available = now.getHours() >= 18;
		input.disabled = !available;
		button.disabled = !available;
		status.textContent = available
			? "Jetzt verfügbar."
			: `Verfügbar ab 18:00 Uhr. Aktuelle Ortszeit: ${now.toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" })}.`;
	}

		const button = document.querySelector("[data-time-quest]");
		form.addEventListener("submit", async (event) => {
			event.preventDefault();
			if (completedQuests.includes(form.dataset.questId)) return;

			updateTimeQuest();
			if (button.disabled) return;

			const file = input.files[0];
			const status = document.querySelector("[data-time-status]");
			if (!file) {
				status.textContent = "Bitte wähle ein Foto aus.";
				return;
			}

			const questId = form.dataset.questId;
			const completed = completeQuest(questId);
			if (!completed) return;

			if (!file.type.startsWith("image/")) {
				await reportPhotoFailure(status, "die ausgewählte Datei ist kein Bild");
				return;
			}
			if (file.size > 10 * 1024 * 1024) {
				await reportPhotoFailure(status, "das Bild ist größer als 10 MB");
				return;
			}

			const webhookUrl = window.wienQuestWebhookUrl;
			if (!isDiscordWebhook(webhookUrl)) {
				status.textContent = "Quest erledigt. Der Discord-Webhook ist nicht verfügbar.";
				return;
			}

			status.textContent = "Quest erledigt. Foto wird an Discord gesendet ...";
			try {
				await sendPhoto(webhookUrl, file);
				status.textContent = "Foto an Discord gesendet.";
			} catch {
				await reportPhotoFailure(status, "der Bild-Upload an Discord ist fehlgeschlagen");
			}
		});
		updateTimeQuest();
		window.setInterval(updateTimeQuest, 30000);
	}

	window.addEventListener("storage", (event) => {
		if (event.key !== storageKey) return;
		completedQuests = readCompletedQuests();
		syncCompletedQuests();
		updateTimeQuest();
	});

	syncCompletedQuests();
	setupNumberQuest();
	setupDoneQuest();
	setupLinkQuest();
	setupTimePhotoQuest();
})();
