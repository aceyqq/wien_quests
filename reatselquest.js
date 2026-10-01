(() => {
	const storageKey = "wienQuestsCompleted";
	const riddles = [
		{ id: "raetsel-01", answers: ["Urania-Sternwarte", "Urania", "Sternwarte", "Urania Sternwarte", "Urania Sternenwarte", "Urania-Sternenwarte"] },
		{ id: "raetsel-02", answers: ["O5", "05", "O-fünf", "Null fünf"] },
		{ id: "raetsel-03", answers: ["Carl", "Erzherzog-Carl-Reiterdenkmal", "Erzherzog-Carl"] }
	];

	function normalizeAnswer(value) {
		return value
			.trim()
			.normalize("NFD")
			.replace(/[\u0300-\u036f]/g, "")
			.toLocaleLowerCase("de")
			.replace(/[.,!?]/g, "")
			.replace(/\s+/g, " ");
	}

	function readCompletedQuests() {
		try {
			const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
			return Array.isArray(saved) ? saved : [];
		} catch {
			return [];
		}
	}

	function markComplete(questId) {
		const completed = readCompletedQuests();
		if (completed.includes(questId)) return;

		completed.push(questId);
		try {
			localStorage.setItem(storageKey, JSON.stringify(completed));
		} catch {
			return;
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

	function setPassed(form) {
		const card = form.closest(".riddle-card");
		card.classList.add("is-complete");
		form.querySelector("input").disabled = true;
		form.querySelector("button").disabled = true;
		form.querySelector(".riddle-feedback").textContent = "Richtig. Rätsel bestanden!";
		form.querySelector(".riddle-feedback").classList.add("is-correct");
	}

	function setupHints() {
		const dialog = document.querySelector("#riddle-hint-dialog");
		const title = document.querySelector("#riddle-hint-title");
		const text = document.querySelector("#riddle-hint-text");
		const closeButton = dialog.querySelector(".riddle-hint-close");

		for (const button of document.querySelectorAll("[data-riddle-hint]")) {
			button.addEventListener("click", () => {
				const number = button.closest(".riddle-card").querySelector(".quest-number").textContent;
				title.textContent = `Tipp zu Rätsel ${number}`;
				text.textContent = button.dataset.riddleHint;
				dialog.showModal();
			});
		}

		closeButton.addEventListener("click", () => dialog.close());
		dialog.addEventListener("click", (event) => {
			if (event.target === dialog) dialog.close();
		});
	}

	function setupRiddles() {
		const completed = readCompletedQuests();
		for (const form of document.querySelectorAll("[data-riddle-form]")) {
			const riddle = riddles.find((item) => item.id === form.dataset.riddleId);
			if (!riddle) continue;

			if (completed.includes(riddle.id)) {
				setPassed(form);
				continue;
			}

			const input = form.querySelector("input");
			const feedback = form.querySelector(".riddle-feedback");
			input.addEventListener("input", () => {
				input.removeAttribute("aria-invalid");
				feedback.classList.remove("is-incorrect");
				feedback.textContent = "";
			});

			form.addEventListener("submit", (event) => {
				event.preventDefault();
				const answer = normalizeAnswer(input.value);
				const correct = riddle.answers.some((expected) => normalizeAnswer(expected) === answer);

				if (!correct) {
					input.setAttribute("aria-invalid", "true");
					feedback.textContent = "Das stimmt noch nicht. Versuch es noch einmal.";
					feedback.classList.add("is-incorrect");
					return;
				}

				markComplete(riddle.id);
				showConfetti();
				setPassed(form);
			});
		}
	}

	setupRiddles();
	setupHints();
})();
