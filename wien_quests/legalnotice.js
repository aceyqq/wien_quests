(() => {
	const resetButton = document.querySelector("#reset-quests");
	const status = document.querySelector("#reset-status");

	resetButton.addEventListener("click", () => {
		if (!window.confirm("Möchtest du wirklich alle erledigten Quests zurücksetzen?")) return;

		try {
			localStorage.removeItem("wienQuestsCompleted");
			status.textContent = "Alle Quests wurden zurückgesetzt.";
		} catch {
			status.textContent = "Der Questfortschritt konnte nicht zurückgesetzt werden.";
		}
	});
})();