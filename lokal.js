(() => {
	const ratingsKey = "wienLocalRatings";
	const completedKey = "wienQuestsCompleted";
	const localQuestId = "lokal-01";
	const localList = document.querySelector("#local-list");
	const globalStatus = document.querySelector("#local-quest-status");
	let entries = readRatings();

	function readRatings() {
		try {
			const saved = JSON.parse(localStorage.getItem(ratingsKey) || "[]");
			return Array.isArray(saved) ? saved : [];
		} catch {
			return [];
		}
	}

	function saveRatings() {
		try {
			localStorage.setItem(ratingsKey, JSON.stringify(entries));
			return true;
		} catch {
			return false;
		}
	}

	function isEmptyEntry(entry) {
		return !entry.name?.trim() && !entry.note?.trim() && Number(entry.rating || 5) === 5;
	}

	function hasQuestPoint() {
		try {
			const completed = JSON.parse(localStorage.getItem(completedKey) || "[]");
			return Array.isArray(completed) && completed.includes(localQuestId);
		} catch {
			return false;
		}
	}

	function saveFirstQuestPoint() {
		try {
			const completed = JSON.parse(localStorage.getItem(completedKey) || "[]");
			const questIds = Array.isArray(completed) ? completed : [];
			if (questIds.includes(localQuestId)) return true;
			localStorage.setItem(completedKey, JSON.stringify([...questIds, localQuestId]));
			return true;
		} catch {
			return false;
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

	async function sendRatingToDiscord(entry) {
		const webhookUrl = window.wienQuestWebhookUrl;
		if (!isDiscordWebhook(webhookUrl)) throw new Error("Discord-Webhook ist nicht verfügbar");

		const response = await fetch(`${webhookUrl}?wait=true`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				content: `Lokalbewertung\nLokal: ${entry.name}\nBewertung: ${entry.rating}/10\nNotiz: ${entry.note || "Keine Notiz"}`,
				allowed_mentions: { parse: [] }
			})
		});
		if (!response.ok) throw new Error("Discord-Nachricht konnte nicht gesendet werden");
	}

	function createEntry(entry, index) {
		const article = document.createElement("article");
		article.className = "local-entry";
		const deleteButton = document.createElement("button");
		deleteButton.className = "local-entry-delete";
		deleteButton.type = "button";
		deleteButton.setAttribute("aria-label", `Leeren Lokaleintrag ${index + 1} entfernen`);
		deleteButton.title = "Leeren Eintrag entfernen";
		const deleteIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		deleteIcon.setAttribute("viewBox", "0 0 24 24");
		deleteIcon.setAttribute("aria-hidden", "true");
		const deletePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
		deletePath.setAttribute("d", "M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3");
		deleteIcon.append(deletePath);
		deleteButton.append(deleteIcon);

		function syncDeleteButton() {
			const empty = isEmptyEntry({
				name: nameInput.value,
				rating: ratingInput.value,
				note: noteInput.value
			});
			deleteButton.disabled = !empty;
			article.classList.toggle("is-empty", empty);
		}

		const heading = document.createElement("h2");
		heading.className = "local-entry-title";
		const nameInput = document.createElement("input");
		nameInput.className = "local-entry-title-input";
		nameInput.id = `local-name-${index + 1}`;
		nameInput.name = "name";
		nameInput.type = "text";
		nameInput.maxLength = 100;
		nameInput.required = true;
		nameInput.setAttribute("aria-label", `Name des Lokals ${index + 1}`);
		nameInput.placeholder = `Lokal ${index + 1}`;
		nameInput.value = entry.name || "";
		nameInput.addEventListener("input", syncDeleteButton);
		heading.append(nameInput);
		article.append(heading);

		const form = document.createElement("form");
		form.className = "local-entry-form";
		form.id = `local-form-${index + 1}`;
		nameInput.setAttribute("form", form.id);

		const ratingId = `local-rating-${index + 1}`;
		const ratingLabel = document.createElement("label");
		ratingLabel.htmlFor = ratingId;
		ratingLabel.append("Bewertung: ");
		const ratingOutput = document.createElement("output");
		ratingOutput.textContent = String(entry.rating || 5);
		ratingLabel.append(ratingOutput, "/10");
		const ratingInput = document.createElement("input");
		ratingInput.id = ratingId;
		ratingInput.name = "rating";
		ratingInput.type = "range";
		ratingInput.min = "1";
		ratingInput.max = "10";
		ratingInput.step = "1";
		ratingInput.value = String(entry.rating || 5);
		ratingInput.addEventListener("input", () => {
			ratingOutput.value = ratingInput.value;
			ratingOutput.textContent = ratingInput.value;
			syncDeleteButton();
		});
		form.append(ratingLabel, ratingInput);

		const noteId = `local-note-${index + 1}`;
		const noteLabel = document.createElement("label");
		noteLabel.htmlFor = noteId;
		noteLabel.textContent = "Deine Notiz";
		const noteInput = document.createElement("textarea");
		noteInput.id = noteId;
		noteInput.name = "note";
		noteInput.maxLength = 1000;
		noteInput.rows = 3;
		noteInput.placeholder = "Bspw. was du hier gefuttert/gesüffelt hast";
		noteInput.value = entry.note || "";
		noteInput.addEventListener("input", syncDeleteButton);
		form.append(noteLabel, noteInput);

		const saveButton = document.createElement("button");
		saveButton.className = "upload-button";
		saveButton.type = "submit";
		saveButton.textContent = "Bewertung speichern";
		const actions = document.createElement("div");
		actions.className = "local-entry-actions";
		actions.append(saveButton, deleteButton);
		form.append(actions);

		const status = document.createElement("p");
		status.className = "local-entry-status";
		status.setAttribute("role", "status");
		status.setAttribute("aria-live", "polite");
		if (entry.name) {
			status.textContent = hasQuestPoint()
				? "Bewertung gespeichert. Der einmalige Lokal-Questpunkt ist bereits vergeben."
				: "Bewertung gespeichert.";
		}
		form.append(status);

		let isSubmitting = false;
		form.addEventListener("submit", async (event) => {
			event.preventDefault();
			if (isSubmitting) return;
			isSubmitting = true;
			saveButton.disabled = true;
			entries[index] = {
				name: nameInput.value.trim(),
				rating: Number(ratingInput.value),
				note: noteInput.value.trim()
			};

			if (!saveRatings()) {
				status.textContent = "Die Bewertung konnte nicht gespeichert werden.";
				saveButton.disabled = false;
				isSubmitting = false;
				return;
			}

			const firstRating = !hasQuestPoint();
			if (firstRating) {
				if (!saveFirstQuestPoint()) {
					status.textContent = "Bewertung gespeichert, aber der Questpunkt konnte nicht gespeichert werden.";
					saveButton.disabled = false;
					isSubmitting = false;
					return;
				}
				globalStatus.textContent = "Dein einmaliger Lokal-Questpunkt ist gespeichert.";
			}

			status.textContent = firstRating
				? "Bewertung gespeichert. Dein Lokal-Questpunkt ist vergeben. Sende an Discord …"
				: "Bewertung gespeichert. Sende an Discord …";
			try {
				await sendRatingToDiscord(entries[index]);
				status.textContent = firstRating
					? "Bewertung an Discord gesendet. Dein einmaliger Lokal-Questpunkt ist vergeben."
					: "Bewertung an Discord gesendet. Dafür gibt es keinen zusätzlichen Questpunkt.";
			} catch {
				status.textContent = firstRating
					? "Bewertung gespeichert und Questpunkt vergeben, aber Discord konnte nicht benachrichtigt werden."
					: "Bewertung gespeichert, aber Discord konnte nicht benachrichtigt werden. Es gibt keinen zusätzlichen Questpunkt.";
			} finally {
				saveButton.disabled = false;
				isSubmitting = false;
			}
		});

		article.append(form);
		deleteButton.addEventListener("click", () => {
			if (!isEmptyEntry({ name: nameInput.value, rating: ratingInput.value, note: noteInput.value })) return;

			const removed = entries.splice(index, 1)[0];
			if (!saveRatings()) {
				entries.splice(index, 0, removed);
				globalStatus.textContent = "Der leere Eintrag konnte nicht entfernt werden.";
				return;
			}
			renderEntries();
			globalStatus.textContent = "Leerer Eintrag entfernt.";
		});
		syncDeleteButton();
		return article;
	}

	function renderEntries() {
		localList.replaceChildren(...entries.map(createEntry));
	}

	document.querySelector("#add-local").addEventListener("click", () => {
		entries.push({ name: "", rating: 5, note: "" });
		if (!saveRatings()) {
			entries.pop();
			globalStatus.textContent = "Ein weiterer Eintrag konnte nicht gespeichert werden.";
			return;
		}
		renderEntries();
		localList.lastElementChild.querySelector("input[name='name']").focus();
	});

	if (entries.length === 0) entries.push({ name: "", rating: 5, note: "" });
	renderEntries();
})();