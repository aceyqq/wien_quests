(() => {
	const storageKey = "wienQuestsCompleted";
	const questGroups = {
		foto: ["foto-01", "foto-02", "foto-03"],
		raetsel: ["raetsel-01", "raetsel-02", "raetsel-03"],
		side: ["side-01", "side-02", "side-04", "side-05"],
		lokal: ["lokal-01"]
	};
	const questIds = Object.values(questGroups).flat();
	const maximumFileSize = 10 * 1024 * 1024;
	const discordWebhookUrl = "https://discord.com/api/webhooks/1554819589588647999/_xs70McKwxQFTCavZxzg7ZKaxKKA9HscNPZLOwWI3AhiRQ9AahZspUK4M9j7zKHxYXDx";
	window.wienQuestWebhookUrl = discordWebhookUrl;
	let completedQuests = readCompletedQuests();

	function readCompletedQuests() {
		try {
			const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
			const completed = Array.isArray(saved) ? saved.filter((id) => questIds.includes(id)) : [];
			if (Array.isArray(saved) && completed.length !== saved.length) {
				try {
					localStorage.setItem(storageKey, JSON.stringify(completed));
				} catch {
					return completed;
				}
			}
			return completed;
		} catch {
			return [];
		}
	}

	function updateProgress() {
		const progressBar = document.querySelector(".progress-track");
		if (!progressBar) return;

		const completedCount = completedQuests.length;
		const countLabel = document.querySelector("#completed-count");
		const progressFill = progressBar.querySelector(".progress-fill");
		countLabel.textContent = completedCount;
		progressFill.style.width = `${(completedCount / questIds.length) * 100}%`;
		progressBar.setAttribute("aria-valuenow", completedCount);

		const rewardLink = document.querySelector("#reward-link");
		if (rewardLink) {
			const unlocked = completedCount >= 8;
			rewardLink.classList.toggle("is-unlocked", unlocked);
			rewardLink.closest(".progress-panel").classList.toggle("is-unlocked", unlocked);
			rewardLink.setAttribute("aria-disabled", String(!unlocked));
			rewardLink.tabIndex = unlocked ? 0 : -1;
			const remaining = 8 - completedCount;
			document.querySelector("#reward-unlock-status").textContent = unlocked
				? "Belohnung freigeschaltet. Fortschrittsbalken anklicken."
				: `Noch ${remaining} ${remaining === 1 ? "Quest" : "Quests"} bis zur Belohnung.`;
		}

		for (const indicator of document.querySelectorAll("[data-quest-group]")) {
			const groupIds = questGroups[indicator.dataset.questGroup];
			if (!groupIds) continue;

			const groupCompleted = groupIds.filter((id) => completedQuests.includes(id)).length;
			indicator.textContent = groupCompleted === groupIds.length
				? "Abgeschlossen"
				: `${groupCompleted}/${groupIds.length} erledigt`;
			indicator.closest(".quest-card").classList.toggle("is-complete", groupCompleted === groupIds.length);
		}
	}

	function markComplete(questId) {
		if (!completedQuests.includes(questId)) {
			completedQuests = [...completedQuests, questId];
			try {
				localStorage.setItem(storageKey, JSON.stringify(completedQuests));
			} catch {
				// Keep the current page's progress even when browser storage is unavailable.
			}
		}
		updateProgress();
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

	function setPhotoQuestComplete(form) {
		form.closest(".photo-quest").classList.add("is-complete");
		form.querySelector('input[type="file"]').disabled = true;
		form.querySelector(".upload-button").disabled = true;
		form.querySelector(".completion-label").hidden = false;
	}

	function syncPhotoQuestState() {
		for (const form of document.querySelectorAll("[data-photo-quest]")) {
			const isComplete = completedQuests.includes(form.dataset.questId);
			if (isComplete) {
				setPhotoQuestComplete(form);
				form.querySelector(".upload-status").textContent = "Diese Quest ist bereits abgeschlossen.";
				continue;
			}

			form.closest(".photo-quest").classList.remove("is-complete");
			form.querySelector('input[type="file"]').disabled = false;
			form.querySelector(".upload-button").disabled = false;
			form.querySelector(".completion-label").hidden = true;
			form.querySelector(".upload-status").textContent = "";
		}
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

	async function sendPhoto(webhookUrl, file, questTitle) {
		const payload = new FormData();
		payload.append("content", `Fotoquest erledigt: ${questTitle}`);
		payload.append("files[0]", file, file.name);
		const response = await fetch(`${webhookUrl}?wait=true`, {
			method: "POST",
			body: payload
		});
		if (!response.ok) throw new Error("Upload fehlgeschlagen");
	}

	async function sendUploadFailureNotice(webhookUrl, questTitle, reason) {
		const response = await fetch(`${webhookUrl}?wait=true`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				content: `Die Fotoübertragung für „${questTitle}“ ist fehlgeschlagen (${reason}). Die Quest wurde trotzdem als erledigt gespeichert.`
			})
		});
		if (!response.ok) throw new Error("Discord-Benachrichtigung fehlgeschlagen");
	}

	async function reportUploadFailure(status, questTitle, reason) {
		if (!isDiscordWebhook(discordWebhookUrl)) {
			status.textContent = "Quest erledigt, aber die Fotoübertragung ist fehlgeschlagen. Eine gültige Webhook-URL für die Benachrichtigung fehlt.";
			return;
		}

		try {
			await sendUploadFailureNotice(discordWebhookUrl, questTitle, reason);
			status.textContent = "Quest erledigt. Fotoübertragung fehlgeschlagen; Discord wurde informiert.";
		} catch {
			status.textContent = "Quest erledigt. Fotoübertragung und Discord-Benachrichtigung sind fehlgeschlagen.";
		}
	}

	function setupPhotoUploads() {
		for (const form of document.querySelectorAll("[data-photo-quest]")) {
			form.addEventListener("submit", async (event) => {
				event.preventDefault();
				const questId = form.dataset.questId;
				if (completedQuests.includes(questId)) return;

				const fileInput = form.querySelector('input[type="file"]');
				const file = fileInput.files[0];
				const status = form.querySelector(".upload-status");
				if (!file) {
					status.textContent = "Bitte wähle zuerst ein Foto aus.";
					return;
				}

				const quest = form.closest(".photo-quest");
				markComplete(questId);
				setPhotoQuestComplete(form);
				showConfetti();

				if (!file.type.startsWith("image/")) {
					await reportUploadFailure(status, quest.querySelector("h2").textContent, "die ausgewählte Datei ist kein Bild");
					return;
				}
				if (file.size > maximumFileSize) {
					await reportUploadFailure(status, quest.querySelector("h2").textContent, "das Bild ist größer als 10 MB");
					return;
				}

				if (!isDiscordWebhook(discordWebhookUrl)) {
					status.textContent = "Quest erledigt. Trage eine gültige Webhook-URL oben in fotoquest.js ein.";
					return;
				}

				status.textContent = "Quest erledigt. Foto wird an Discord gesendet ...";
				try {
					await sendPhoto(discordWebhookUrl, file, quest.querySelector("h2").textContent);
					status.textContent = "Foto an Discord gesendet.";
				} catch {
					await reportUploadFailure(status, quest.querySelector("h2").textContent, "der Bild-Upload an Discord ist fehlgeschlagen");
				}
			});
		}
	}

	function setupRewardLink() {
		const rewardLink = document.querySelector("#reward-link");
		if (!rewardLink) return;

		rewardLink.addEventListener("click", (event) => {
			if (completedQuests.length < 8) event.preventDefault();
		});
	}

	window.addEventListener("storage", (event) => {
		if (event.key === storageKey) {
			completedQuests = readCompletedQuests();
			updateProgress();
			syncPhotoQuestState();
		}
	});

	updateProgress();
	setupRewardLink();
	syncPhotoQuestState();
	setupPhotoUploads();
})();
