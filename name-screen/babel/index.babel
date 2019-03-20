'use strict';

const cloneText = (title, countBefore = 1, countAfter = 1) => {
	if (!title) return;
	
	const posterTitleText = title.textContent;
	
	const repeatsPosterTitle = document.createElement('div');
	repeatsPosterTitle.classList.add('poster__text');
	repeatsPosterTitle.textContent = posterTitleText;
	
	const repeatsPosterTitleUp = repeatsPosterTitle.cloneNode(true);
	repeatsPosterTitleUp.classList.add('poster__text--up');
	
	const repeatsPosterTitleDown = repeatsPosterTitle.cloneNode(true);
	repeatsPosterTitleDown.classList.add('poster__text--down');
	
	let elementsUp = [];
	for (let i = 0; i < countBefore; i++) {
		elementsUp.push(repeatsPosterTitleUp);
	}
	
	for (let i = 0; i < elementsUp.length; i++) {
		title.parentNode.insertAdjacentHTML('afterbegin', elementsUp[i].outerHTML);
	}
	
	let elementsDown = [];
	for (let i = 0; i < 4; i++) {
		elementsDown.push(repeatsPosterTitleDown);
	}
	
	for (let i = 0; i < elementsDown.length; i++) {
		title.parentNode.insertAdjacentHTML('beforeend', elementsDown[i].outerHTML);
	}
}

const posterTitle = document.querySelector('.poster__title');
cloneText(posterTitle, 5, 5);












